export const MAX_AUDIO_BYTES = 8 * 1024 * 1024
export const MAX_QUESTION_LENGTH = 2000
export const MAX_RESPONSE_LENGTH = 64_000
export const AUDIO_MIME_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/m4a', 'audio/wav'] as const

export type AnalysisResult = {
  status: 'success' | 'insufficient'
  transcript: string | null
  summary: string
  strengths: string[]
  improvements: string[]
  nextAttemptFocus: string
}

export function baseAudioMimeType(value: string) {
  return value.split(';', 1)[0].trim().toLowerCase()
}

// This same schema is sent to Gemini; runtime checks below also enforce
// status-dependent rules and reject whitespace-only strings.
export const analysisResultSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'transcript', 'summary', 'strengths', 'improvements', 'nextAttemptFocus'],
  properties: {
    status: { type: 'string', enum: ['success', 'insufficient'] },
    transcript: { type: ['string', 'null'], maxLength: 12000 },
    summary: { type: 'string', minLength: 1, maxLength: 1200 },
    strengths: { type: 'array', maxItems: 3, items: { type: 'string', minLength: 1, maxLength: 600 } },
    improvements: { type: 'array', maxItems: 3, items: { type: 'string', minLength: 1, maxLength: 600 } },
    nextAttemptFocus: { type: 'string', minLength: 1, maxLength: 600 },
  },
}

function invalid(): never {
  throw new Error('The analysis response did not match the expected format.')
}

function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) return invalid()
  return value.trim()
}

function observations(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 3) return invalid()
  return value.map((item: unknown) => text(item, 600))
}

export function parseAnalysisResult(value: unknown): AnalysisResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const result = value as Record<string, unknown>
  if (Object.keys(result).some((key) => !analysisResultSchema.required.includes(key))) return invalid()
  if (result.status !== 'success' && result.status !== 'insufficient') return invalid()
  const transcript = result.transcript === null ? null : text(result.transcript, 12000)
  const strengths = observations(result.strengths)
  const improvements = observations(result.improvements)
  if (result.status === 'success' && !transcript) return invalid()
  if (result.status === 'insufficient' && (strengths.length || improvements.length)) return invalid()
  return {
    status: result.status,
    transcript,
    summary: text(result.summary, 1200),
    strengths,
    improvements,
    nextAttemptFocus: text(result.nextAttemptFocus, 600),
  }
}
