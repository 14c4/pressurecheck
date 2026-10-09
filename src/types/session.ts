export type RecordingPhase = 'ready' | 'recording' | 'review'

export type RecordedAnswer = {
  blob: Blob
  url: string
  mimeType: string
  durationSeconds: number
}

export type { AnalysisResult as AnswerFeedback } from '../../shared/analysis.ts'
