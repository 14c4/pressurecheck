import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { parseArgs } from 'node:util'
import { MAX_AUDIO_BYTES } from '../shared/analysis.ts'
import { loadConfig } from '../server/config.ts'
import { validateAudioContainer } from '../server/routes/analyzeAnswer.ts'
import { createAnalysisService } from '../server/services/analysisService.ts'

function silenceWav() {
  const audio = Buffer.alloc(44 + 16000 * 2 * 2) // 2 seconds, 16 kHz mono PCM.
  audio.write('RIFF', 0)
  audio.writeUInt32LE(audio.length - 8, 4)
  audio.write('WAVEfmt ', 8)
  audio.writeUInt32LE(16, 16)
  audio.writeUInt16LE(1, 20)
  audio.writeUInt16LE(1, 22)
  audio.writeUInt32LE(16000, 24)
  audio.writeUInt32LE(32000, 28)
  audio.writeUInt16LE(2, 32)
  audio.writeUInt16LE(16, 34)
  audio.write('data', 36)
  audio.writeUInt32LE(audio.length - 44, 40)
  return audio
}

async function main() {
  const { values } = parseArgs({ options: {
    audio: { type: 'string' }, expect: { type: 'string' }, 'mime-type': { type: 'string' },
    silence: { type: 'boolean', default: false },
  } })
  const config = loadConfig()
  if (config.provider !== 'gemini' || !config.apiKey) throw new Error('Live test requires ANALYSIS_PROVIDER=gemini and GEMINI_API_KEY in server/.env. No API call was made.')
  if (!values.audio || !values.expect?.trim()) throw new Error('Usage: npm run test:live -- --audio "C:/path/answer.webm" --expect "checklist" [--silence]. This opt-in test sends audio to Gemini and uses quota.')
  const size = (await stat(values.audio)).size
  if (!size || size > MAX_AUDIO_BYTES) throw new Error('Choose a nonempty spoken recording no larger than 8 MiB.')
  const extensions: Record<string, string> = { '.webm': 'audio/webm', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/m4a', '.mp4': 'audio/mp4' }
  const mimeType = values['mime-type'] || extensions[extname(values.audio).toLowerCase()]
  if (!mimeType) throw new Error('Provide --mime-type with the actual recording MIME type.')
  const audio = await readFile(values.audio)
  validateAudioContainer(audio, mimeType)
  const analyze = createAnalysisService(config)
  const question = 'Tell me about a time you faced a difficult challenge on a team. What did you do, and what was the outcome?'
  const result = await analyze({ question, audio, mimeType }, AbortSignal.timeout(config.timeoutMs))
  assert.equal(result.status, 'success', 'The known spoken-answer fixture should be analyzable.')
  assert(result.transcript?.toLowerCase().includes(values.expect.toLowerCase()), 'The transcript did not contain the expected fixture phrase.')
  console.log(`PASS: ${config.model} transcribed the known audio and returned validated interview feedback.`)
  if (values.silence) {
    const silentResult = await analyze({ question, audio: silenceWav(), mimeType: 'audio/wav' }, AbortSignal.timeout(config.timeoutMs))
    assert.equal(silentResult.status, 'insufficient', 'Silence must not produce invented interview feedback.')
    assert.equal(silentResult.transcript, null, 'Silence must not produce invented speech.')
    console.log('PASS: silent audio produced insufficient analysis without an invented transcript.')
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Live smoke test failed.')
  process.exitCode = 1
})
