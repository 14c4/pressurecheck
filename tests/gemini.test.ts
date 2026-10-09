import assert from 'node:assert/strict'
import test from 'node:test'
import { GoogleGenAI } from '@google/genai'
import type { GenerateContentParameters } from '@google/genai'
import { analysisResultSchema } from '../shared/analysis.ts'
import { createGeminiAnalyzer } from '../server/providers/gemini.ts'
import { loadConfig } from '../server/config.ts'
import { successResult, webmFixture } from './fixtures.ts'

const config = loadConfig({ ANALYSIS_PROVIDER: 'gemini', GEMINI_API_KEY: 'offline-test-key', ANALYSIS_MODEL: 'test-model' })
const input = { question: 'Tell me about a team challenge.', audio: webmFixture, mimeType: 'audio/webm;codecs=opus' }

test('Gemini adapter sends one request with faithful bytes and a structured schema', async () => {
  const calls: GenerateContentParameters[] = []
  const analyze = createGeminiAnalyzer(config, async (request) => { calls.push(request); return { text: JSON.stringify(successResult) } })
  const signal = new AbortController().signal
  assert.deepEqual(await analyze(input, signal), successResult)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].model, 'test-model')
  assert.deepEqual(calls[0].config?.responseJsonSchema, analysisResultSchema)
  assert.equal(calls[0].config?.abortSignal, signal)
  assert.equal(calls[0].config?.httpOptions?.retryOptions?.attempts, 1)
  const parts = (calls[0].contents as { parts: { inlineData?: { data: string; mimeType: string } }[] }[])[0].parts
  assert.equal(parts[1].inlineData?.mimeType, 'audio/webm')
  assert.deepEqual(Buffer.from(parts[1].inlineData!.data, 'base64'), webmFixture)
  assert.equal(input.mimeType, 'audio/webm;codecs=opus')
})

test('official SDK serializes the adapter request and parses a response entirely offline', async () => {
  let count = 0
  let requestBody = ''
  const client = new GoogleGenAI({ apiKey: 'offline-test-key', httpOptions: {
    retryOptions: { attempts: 1 },
    fetch: async (_url, init) => {
      count++
      requestBody = String(init?.body)
      return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(successResult) }] }, finishReason: 'STOP' }] }), { headers: { 'Content-Type': 'application/json' } })
    },
  } })
  const analyze = createGeminiAnalyzer(config, (request) => client.models.generateContent(request))
  assert.deepEqual(await analyze(input, new AbortController().signal), successResult)
  assert.equal(count, 1)
  assert(requestBody.includes(webmFixture.toString('base64')))
  assert(!requestBody.includes('offline-test-key'))
})

test('unverified MP4, missing feedback, and invalid JSON never become successful analysis', async () => {
  let calls = 0
  const analyzer = createGeminiAnalyzer(config, async () => { calls++; return { text: 'not json' } })
  await assert.rejects(analyzer({ ...input, mimeType: 'audio/mp4' }, new AbortController().signal), { code: 'UNSUPPORTED_PROVIDER_AUDIO' })
  assert.equal(calls, 0)
  await assert.rejects(analyzer(input, new AbortController().signal), { code: 'INVALID_ANALYSIS' })
  const empty = createGeminiAnalyzer(config, async () => ({}))
  await assert.rejects(empty(input, new AbortController().signal), { code: 'INVALID_ANALYSIS' })
})

test('provider errors are sanitized and cancellation is propagated', async (t) => {
  const log = t.mock.method(console, 'error', () => {})
  for (const [status, code] of [[403, 'PROVIDER_AUTH'], [404, 'PROVIDER_MODEL'], [429, 'PROVIDER_RATE_LIMIT'], [500, 'PROVIDER_FAILED']] as const) {
    const analyze = createGeminiAnalyzer(config, async () => { throw { status, message: 'sensitive-provider-diagnostic' } })
    await assert.rejects(analyze(input, new AbortController().signal), (error: unknown) => {
      assert(error instanceof Error && 'code' in error)
      assert.equal(error.code, code)
      assert(!error.message.includes('sensitive-provider-diagnostic'))
      return true
    })
  }
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(createGeminiAnalyzer(config, async () => { throw new Error('Must not be called') })(input, controller.signal), { name: 'AbortError' })
  assert.equal(log.mock.callCount(), 4)
})

test('backend diagnostic extracts the SDK explanation without logging its error details', async (t) => {
  const log = t.mock.method(console, 'error', () => {})
  const upstream = `models/test-model is not found for API version v1beta, or is not supported for generateContent.`
  const analyze = createGeminiAnalyzer(config, async () => {
    throw { status: 404, message: JSON.stringify({ error: {
      code: 404, status: 'NOT_FOUND', message: upstream,
      details: [{ apiKey: config.apiKey, question: input.question, audio: webmFixture.toString('base64'), transcript: 'private speech' }],
    } }) }
  })
  await assert.rejects(analyze(input, new AbortController().signal), { code: 'PROVIDER_MODEL' })
  assert.equal(log.mock.callCount(), 1)
  const [label, serialized] = log.mock.calls[0].arguments
  assert.equal(label, '[Gemini analysis]')
  assert.deepEqual(JSON.parse(serialized), { model: 'test-model', status: 404, message: upstream })
  assert(!serialized.includes('private speech'))
  assert(!serialized.includes(config.apiKey))
})

test('diagnostics redact credentials, question, audio, and encoded variants before truncation', async (t) => {
  const log = t.mock.method(console, 'error', () => {})
  const privateInput = { ...input, question: 'Private "question"\nwith a newline' }
  const secrets = [config.apiKey, privateInput.question, webmFixture.toString('base64')]
  const variants = secrets.flatMap((value) => [value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value)])
  const analyze = createGeminiAnalyzer(config, async () => {
    throw { status: 404, message: `Endpoint not found. ${variants.join(' | ')}\n${'long diagnostic '.repeat(100)}` }
  })
  await assert.rejects(analyze(privateInput, new AbortController().signal), { code: 'PROVIDER_MODEL' })
  const diagnostic = JSON.parse(log.mock.calls[0].arguments[1]) as { message: string }
  assert(diagnostic.message.startsWith('Endpoint not found.'))
  assert(diagnostic.message.includes('[REDACTED]'))
  assert.equal(diagnostic.message.length, 1000)
  assert(!diagnostic.message.includes('\n'))
  for (const secret of variants) assert(!diagnostic.message.includes(secret))
})

test('missing, malformed structured, and excessive upstream diagnostics are bounded', async (t) => {
  const log = t.mock.method(console, 'error', () => {})
  for (const message of [undefined, JSON.stringify({ request: { transcript: 'private speech' } }), 'x'.repeat(17000)]) {
    const analyze = createGeminiAnalyzer(config, async () => { throw { status: 404, message } })
    await assert.rejects(analyze(input, new AbortController().signal), { code: 'PROVIDER_MODEL' })
  }
  assert.equal(log.mock.callCount(), 3)
  for (const call of log.mock.calls) {
    const diagnostic = JSON.parse(call.arguments[1]) as { message: string }
    assert(diagnostic.message.length <= 1000)
    assert(!diagnostic.message.includes('private speech'))
  }
})
