import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { MAX_AUDIO_BYTES, parseAnalysisResult } from '../shared/analysis.ts'
import { createAnalysisServer } from '../server/app.ts'
import { AnalysisError } from '../server/errors.ts'
import { loadConfig } from '../server/config.ts'
import { createGeminiAnalyzer } from '../server/providers/gemini.ts'
import type { AnalysisInput, AnalysisService } from '../server/services/analysisService.ts'
import { insufficientResult, successResult, webmFixture } from './fixtures.ts'

async function startServer(t: TestContext, analyze: AnalysisService, timeout = 1000) {
  const server = createAnalysisServer(analyze, timeout)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  t.after(() => new Promise<void>((resolve, reject) => {
    server.closeAllConnections()
    server.close((error) => error ? reject(error) : resolve())
  }))
  return `http://127.0.0.1:${address.port}/api/analyze-answer`
}

function form(audio = webmFixture, mimeType = 'audio/webm;codecs=opus') {
  const body = new FormData()
  body.append('question', 'Tell me about a team challenge.')
  body.append('mimeType', mimeType)
  body.append('audio', new Blob([new Uint8Array(audio)], { type: mimeType }), 'answer')
  return body
}

test('upload preserves original MIME and bytes and returns validated feedback without caching', async (t) => {
  const calls: AnalysisInput[] = []
  const url = await startServer(t, async (input) => { calls.push(input); return successResult })
  const response = await fetch(url, { method: 'POST', body: form() })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), successResult)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].mimeType, 'audio/webm;codecs=opus')
  assert.deepEqual(calls[0].audio, webmFixture)
})

test('malformed, duplicate, empty, unsupported, mismatched, and oversized uploads never call analysis', async (t) => {
  let calls = 0
  const url = await startServer(t, async () => { calls++; return successResult })
  const missing = new FormData()
  missing.append('question', 'Question')
  const duplicate = form()
  duplicate.append('question', 'Another question')
  const mismatch = form()
  mismatch.set('mimeType', 'audio/ogg')
  const damaged = form(Buffer.from('not valid audio'))
  const longQuestion = form()
  longQuestion.set('question', 'x'.repeat(2001))
  const excessFields = form()
  excessFields.append('unexpected', 'value')
  const multipleFiles = form()
  multipleFiles.append('extra', new Blob(['extra']), 'extra')
  for (const [body, status] of [
    [missing, 400], [duplicate, 400], [mismatch, 400], [damaged, 400], [longQuestion, 400],
    [excessFields, 400], [multipleFiles, 400], [form(Buffer.alloc(0)), 400],
    [form(webmFixture, 'audio/unknown'), 415], [form(Buffer.alloc(MAX_AUDIO_BYTES + 1)), 413],
  ] as const) {
    const response = await fetch(url, { method: 'POST', body })
    assert.equal(response.status, status)
    const result = await response.json() as { error: { message: string } }
    assert(result.error.message)
  }
  const malformed = await fetch(url, { method: 'POST', body: 'broken', headers: { 'Content-Type': 'multipart/form-data; boundary=missing' } })
  assert.equal(malformed.status, 400)
  const json = await fetch(url, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })
  assert.equal(json.status, 400)
  assert.equal(calls, 0)
})

test('chunked oversized uploads are bounded without a Content-Length header', async (t) => {
  let calls = 0
  const url = await startServer(t, async () => { calls++; return successResult })
  const status = await new Promise<number>((resolve, reject) => {
    const request = httpRequest(url, { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=test-boundary' } }, (response) => {
      response.resume()
      response.on('end', () => resolve(response.statusCode!))
    })
    request.on('error', reject)
    request.write('--test-boundary\r\nContent-Disposition: form-data; name="audio"; filename="answer"\r\nContent-Type: audio/webm\r\n\r\n')
    for (let i = 0; i < 129; i++) request.write(Buffer.alloc(65536))
    request.end('\r\n--test-boundary--\r\n')
  })
  assert.equal(status, 413)
  assert.equal(calls, 0)
})

test('insufficient analysis is a valid result; failed/invalid analysis is an error', async (t) => {
  const insufficientUrl = await startServer(t, async () => insufficientResult)
  const response = await fetch(insufficientUrl, { method: 'POST', body: form() })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), insufficientResult)
  const invalidUrl = await startServer(t, async () => ({ ...successResult, transcript: null }))
  const invalid = await fetch(invalidUrl, { method: 'POST', body: form() })
  assert.equal(invalid.status, 502)
  const failedUrl = await startServer(t, async () => { throw new Error('Do not expose provider secrets') })
  const failed = await fetch(failedUrl, { method: 'POST', body: form() })
  assert.equal(failed.status, 502)
  assert(!(await failed.text()).includes('secrets'))
  const disabledUrl = await startServer(t, async () => { throw new AnalysisError(503, 'ANALYSIS_NOT_CONFIGURED', 'Analysis is not configured.') })
  assert.equal((await fetch(disabledUrl, { method: 'POST', body: form() })).status, 503)
})

test('timeouts stop waiting, signal the provider, and leave the server usable', async (t) => {
  let signal: AbortSignal | undefined
  const url = await startServer(t, async (_input, abortSignal) => {
    signal = abortSignal
    return new Promise(() => {})
  }, 40)
  const response = await fetch(url, { method: 'POST', body: form() })
  assert.equal(response.status, 504)
  assert(signal?.aborted)
  assert.equal((await fetch(url)).status, 405)
})

test('Gemini upstream diagnostics are server-only and do not leak in HTTP errors', async (t) => {
  const log = t.mock.method(console, 'error', () => {})
  const config = loadConfig({ ANALYSIS_PROVIDER: 'gemini', GEMINI_API_KEY: 'offline-private-key' })
  const analyze = createGeminiAnalyzer(config, async () => {
    throw { status: 404, message: JSON.stringify({ error: {
      message: `private-provider-detail ${config.apiKey}`,
      details: { transcript: 'private speech' },
    } }) }
  })
  const url = await startServer(t, async (input, signal) => parseAnalysisResult(await analyze(input, signal)))
  const response = await fetch(url, { method: 'POST', body: form() })
  assert.equal(response.status, 503)
  const body = await response.text()
  assert.equal(JSON.parse(body).error.code, 'PROVIDER_MODEL')
  assert(body.includes('backend terminal'))
  for (const secret of [config.apiKey, 'private-provider-detail', 'private speech']) assert(!body.includes(secret))
  assert.equal(log.mock.callCount(), 1)
  const diagnostic = log.mock.calls[0].arguments[1]
  assert(diagnostic.includes('private-provider-detail'))
  assert(!diagnostic.includes(config.apiKey))
  assert(!diagnostic.includes('private speech'))
})

test('a disconnected client aborts analysis after the upload completes', async (t) => {
  let begin: () => void = () => {}
  let finish: () => void = () => {}
  const started = new Promise<void>((resolve) => { begin = resolve })
  const aborted = new Promise<void>((resolve) => { finish = resolve })
  const url = await startServer(t, async (_input, signal) => {
    begin()
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => { finish(); reject(signal.reason) }, { once: true })
    })
  })
  const controller = new AbortController()
  const response = fetch(url, { method: 'POST', body: form(), signal: controller.signal })
  const rejection = assert.rejects(response, { name: 'AbortError' })
  await started
  controller.abort()
  await rejection
  await aborted
})
