export type RecordingPhase = 'ready' | 'recording' | 'review'

export type RecordedAnswer = {
  blob: Blob
  url: string
  mimeType: string
  durationSeconds: number
}

export type AnswerFeedback = {
  source: 'sample' | 'gemini'
  transcript: string | null
  exampleAnswer?: string
  strengths: readonly string[]
  improvements: readonly string[]
  nextAttemptFocus: string
}
