import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseAnalysisResult } from '../shared/analysis.ts'
import { loadConfig } from '../server/config.ts'
import { createAnalysisService } from '../server/services/analysisService.ts'
import { insufficientResult, successResult } from './fixtures.ts'

test('valid successful and insufficient results retain their meaning', () => {
  assert.deepEqual(parseAnalysisResult(successResult), successResult)
  assert.deepEqual(parseAnalysisResult(insufficientResult), insufficientResult)
  assert.equal(parseAnalysisResult({ ...insufficientResult, transcript: 'A reliable partial sentence.' }).transcript, 'A reliable partial sentence.')
})

test('invalid and unsupported feedback is rejected, not displayed as a result', () => {
  for (const value of [
    null, [], {}, { ...successResult, status: 'failed' },
    { ...successResult, transcript: null }, { ...successResult, summary: ' ' },
    { ...successResult, strengths: [4] }, { ...successResult, strengths: ['a', 'b', 'c', 'd'] },
    { ...successResult, nextAttemptFocus: '' }, { ...successResult, transcript: 'x'.repeat(12001) },
    { ...successResult, extra: true }, { ...insufficientResult, strengths: ['Invented strength'] },
  ]) assert.throws(() => parseAnalysisResult(value))
})

test('provider/model configuration stays explicit and disabled by default', async () => {
  assert.equal(loadConfig({}).provider, 'disabled')
  assert.equal(loadConfig({ ANALYSIS_MODEL: 'custom-model' }).model, 'custom-model')
  assert.throws(() => loadConfig({ ANALYSIS_PROVIDER: 'unknown' }))
  assert.throws(() => loadConfig({ ANALYSIS_TIMEOUT_MS: '-1' }))
  for (const config of [loadConfig({}), loadConfig({ ANALYSIS_PROVIDER: 'gemini' })]) {
    await assert.rejects(createAnalysisService(config)({ question: 'Question', audio: new Uint8Array(), mimeType: 'audio/webm' }, new AbortController().signal), { code: 'ANALYSIS_NOT_CONFIGURED' })
  }
})

test('live smoke test refuses to run without explicit provider/key configuration', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/test-live.ts', import.meta.url))], {
    env: { ...process.env, ANALYSIS_PROVIDER: 'disabled', GEMINI_API_KEY: '' },
    encoding: 'utf8',
  })
  assert.equal(result.status, 1)
  assert(result.stderr.includes('No API call was made.'))
  assert.equal(result.stdout, '')
})
