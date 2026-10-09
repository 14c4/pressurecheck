import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnalysisResult } from '../../shared/analysis.ts'
import { analyzeRecordedAnswer } from '../services/answerAnalysis'
import type { RecordedAnswer } from '../types/session'

type PendingRequest = {
  controller: AbortController
  timer: number
  timedOut: boolean
}

export function useAnswerAnalysis() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const activeRef = useRef<PendingRequest | null>(null)

  const abortRequest = useCallback(() => {
    const request = activeRef.current
    activeRef.current = null
    if (request) {
      window.clearTimeout(request.timer)
      request.controller.abort()
    }
  }, [])

  useEffect(() => abortRequest, [abortRequest])

  function reset() {
    abortRequest()
    setPending(false)
    setError(null)
    setResult(null)
  }

  async function submit(question: string, answer: RecordedAnswer) {
    if (activeRef.current) return
    const request: PendingRequest = { controller: new AbortController(), timer: 0, timedOut: false }
    // Backend timeout is configurable up to 120s; allow an extra 10s for upload.
    request.timer = window.setTimeout(() => {
      request.timedOut = true
      request.controller.abort()
    }, 130000)
    activeRef.current = request
    setPending(true)
    setError(null)
    setResult(null)
    try {
      const feedback = await analyzeRecordedAnswer(question, answer, request.controller.signal)
      if (activeRef.current === request) setResult(feedback)
    } catch (cause) {
      if (activeRef.current === request) {
        setError(request.timedOut ? 'The analysis request timed out. Your recording is still available; try again.'
          : cause instanceof Error ? cause.message : 'Analysis failed. Please try submitting again.')
      }
    } finally {
      window.clearTimeout(request.timer)
      if (activeRef.current === request) {
        activeRef.current = null
        setPending(false)
      }
    }
  }

  return { pending, error, result, submit, reset }
}
