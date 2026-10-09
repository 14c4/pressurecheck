import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeRecordedAnswer } from '../src/services/answerAnalysis.ts'
import { successResult, webmFixture } from './fixtures.ts'

const blob = new Blob([new Uint8Array(webmFixture)], { type: 'audio/webm;codecs=opus' })
const answer = { blob, mimeType: blob.type, url: 'blob:local-playback', durationSeconds: 1 }
const signal = () => new AbortController().signal

test('client submits the original Blob as multipart and validates feedback', async () => {
  const feedback = await analyzeRecordedAnswer('Question', answer, signal(), async (url, options) => {
    assert.equal(url, '/api/analyze-answer')
    assert.equal(options?.headers, undefined) // Browser owns the multipart boundary.
    assert(options?.body instanceof FormData)
    assert.equal(options.body.get('mimeType'), answer.mimeType)
    const audio = options.body.get('audio') as File
    assert.equal(audio.type, answer.mimeType)
    assert.deepEqual(new Uint8Array(await audio.arrayBuffer()), new Uint8Array(webmFixture))
    return Response.json(successResult)
  })
  assert.deepEqual(feedback, successResult)
  assert.equal(answer.url, 'blob:local-playback')
})

test('invalid response, network error, and server error remain recoverable failures', async () => {
  await assert.rejects(analyzeRecordedAnswer('Question', answer, signal(), async () => Response.json({ ...successResult, transcript: null })), /feedback was incomplete or invalid/)
  await assert.rejects(analyzeRecordedAnswer('Question', answer, signal(), async () => new Response('<html>proxy error</html>', { status: 502 })), /invalid response/)
  await assert.rejects(analyzeRecordedAnswer('Question', answer, signal(), async () => { throw new TypeError('Failed to fetch') }), /Could not reach/)
  await assert.rejects(analyzeRecordedAnswer('Question', answer, signal(), async () => Response.json({ error: { code: 'ANALYSIS_NOT_CONFIGURED', message: 'Analysis is not configured.' } }, { status: 503 })), /not configured/)
  assert.equal(answer.blob, blob)
})

test('empty audio never uploads, and aborted requests never return late feedback', async () => {
  let called = false
  await assert.rejects(analyzeRecordedAnswer('Question', { ...answer, blob: new Blob([]) }, signal(), async () => { called = true; return Response.json(successResult) }), /empty/)
  assert.equal(called, false)
  const controller = new AbortController()
  await assert.rejects(analyzeRecordedAnswer('Question', answer, controller.signal, async () => {
    controller.abort()
    return Response.json(successResult)
  }), { name: 'AbortError' })
})
