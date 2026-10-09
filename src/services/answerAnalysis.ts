import { AUDIO_MIME_TYPES, baseAudioMimeType, MAX_AUDIO_BYTES, MAX_QUESTION_LENGTH, MAX_RESPONSE_LENGTH, parseAnalysisResult } from '../../shared/analysis.ts'
import type { RecordedAnswer } from '../types/session.ts'

export class AnalysisRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AnalysisRequestError'
  }
}

function serverErrorMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = payload.error
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.length <= 1000) return error.message
  }
  return 'The analysis server could not process the answer. Check that the backend is running and try again.'
}

export async function analyzeRecordedAnswer(question: string, answer: RecordedAnswer, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  signal.throwIfAborted()
  if (!question.trim() || question.length > MAX_QUESTION_LENGTH) throw new AnalysisRequestError('The interview question is missing or too long.')
  if (!answer.blob.size) throw new AnalysisRequestError('The recording is empty. Record an answer before submitting.')
  if (answer.blob.size > MAX_AUDIO_BYTES) throw new AnalysisRequestError('The recording is too large. Record a shorter answer (maximum 8 MiB).')
  if (!AUDIO_MIME_TYPES.some((type) => type === baseAudioMimeType(answer.mimeType)) || answer.blob.type !== answer.mimeType) {
    throw new AnalysisRequestError('The recording format is unsupported or missing. Try recording in a current Chrome, Edge, or Firefox browser.')
  }
  const form = new FormData()
  form.append('question', question)
  form.append('mimeType', answer.mimeType)
  form.append('audio', answer.blob, 'answer')

  let response: Response
  try {
    response = await fetcher('/api/analyze-answer', { method: 'POST', body: form, signal })
  } catch {
    signal.throwIfAborted()
    throw new AnalysisRequestError('Could not reach the analysis server. Start the backend with npm run dev:server and try submitting again.')
  }
  let body: string
  try { body = await response.text() }
  catch {
    signal.throwIfAborted()
    throw new AnalysisRequestError('The connection ended before feedback arrived. Your audio is still available; try submitting again.')
  }
  signal.throwIfAborted()
  let payload: unknown
  try {
    if (body.length > MAX_RESPONSE_LENGTH) throw new Error('Response too long')
    payload = JSON.parse(body) as unknown
  } catch {
    throw new AnalysisRequestError('The analysis server returned an invalid response. Check that the backend is running; your audio is still available.')
  }
  if (!response.ok) throw new AnalysisRequestError(serverErrorMessage(payload))
  try {
    return parseAnalysisResult(payload)
  } catch {
    throw new AnalysisRequestError('The feedback was incomplete or invalid and has not been displayed. Your audio is still available; try again.')
  }
}
