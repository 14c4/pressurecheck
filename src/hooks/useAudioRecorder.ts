import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecordedAnswer, RecordingPhase } from '../types/session'

type CaptureSession = {
  stream: MediaStream | null
  recorder: MediaRecorder | null
  chunks: Blob[]
  timer: number | null
  startedAt: number
  finishedAt: number | null
}

const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg']

function recordingSupportError() {
  if (!window.isSecureContext) return 'Microphone recording needs localhost or HTTPS. Open the local Vite address.'
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    return 'This browser does not support microphone recording. Try a current version of Chrome, Edge, Firefox, or Safari.'
  }
  return null
}

function captureErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access was blocked. Allow it in your browser’s site settings, check your system microphone permissions, and try again.'
  }
  if (name === 'NotFoundError') return 'No microphone was found. Connect a microphone and try again.'
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The microphone could not be opened. Check your device or close another app using it, then try again.'
  }
  if (name === 'NotSupportedError') return 'This browser could not record audio in a supported format. Try another current browser.'
  return 'Recording could not start or was interrupted. Check your microphone and try again.'
}

function stopTracks(session: CaptureSession) {
  session.stream?.getTracks().forEach((track) => {
    track.onended = null
    track.stop()
  })
}

function releaseSession(session: CaptureSession | null) {
  if (!session) return
  if (session.timer !== null) window.clearInterval(session.timer)
  const recorder = session.recorder
  if (recorder) {
    recorder.ondataavailable = null
    recorder.onstop = null
    recorder.onerror = null
    // Abandoned recordings must not publish a late result after navigation/reset.
    try {
      if (recorder.state !== 'inactive') recorder.stop()
    } catch {
      // A failed recorder must not prevent its microphone tracks being released.
    } finally {
      stopTracks(session)
    }
  } else {
    stopTracks(session)
  }
}

function durationSeconds(session: CaptureSession) {
  return Math.max(0, Math.floor(((session.finishedAt ?? performance.now()) - session.startedAt) / 1000))
}

export function useAudioRecorder() {
  const [phase, setPhase] = useState<RecordingPhase>('ready')
  const [busy, setBusy] = useState<'requesting' | 'stopping' | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [recordedAnswer, setRecordedAnswer] = useState<RecordedAnswer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef<CaptureSession | null>(null)
  const urlRef = useRef<string | null>(null)
  const supportError = recordingSupportError()

  const releaseResources = useCallback(() => {
    const session = sessionRef.current
    // Invalidate pending permission requests and all queued recorder callbacks.
    sessionRef.current = null
    releaseSession(session)
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  useEffect(() => releaseResources, [releaseResources])

  function discard() {
    releaseResources()
    setRecordedAnswer(null)
    setElapsedSeconds(0)
    setError(null)
    setBusy(null)
    setPhase('ready')
  }

  const finishCapture = useCallback((session: CaptureSession) => {
    if (session.finishedAt !== null || !session.recorder) return
    session.finishedAt = performance.now()
    if (session.timer !== null) window.clearInterval(session.timer)
    setElapsedSeconds(durationSeconds(session))
    setBusy('stopping')
    // Keep handlers attached until onstop has received the final audio chunk.
    try {
      if (session.recorder.state !== 'inactive') session.recorder.stop()
    } catch {
      sessionRef.current = null
      releaseSession(session)
      setError('The recording could not be finished. Please try again.')
      setBusy(null)
      setPhase('ready')
      setElapsedSeconds(0)
    } finally {
      stopTracks(session)
    }
  }, [])

  const start = useCallback(async () => {
    // Ref guards also prevent double clicks before React has rerendered.
    if (sessionRef.current || urlRef.current || supportError) return
    const session: CaptureSession = {
      stream: null, recorder: null, chunks: [], timer: null, startedAt: 0, finishedAt: null,
    }
    sessionRef.current = session
    setError(null)
    setElapsedSeconds(0)
    setBusy('requesting')

    function fail(message: string) {
      if (sessionRef.current !== session) return
      sessionRef.current = null
      releaseSession(session)
      setError(message)
      setBusy(null)
      setPhase('ready')
      setElapsedSeconds(0)
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      // Permission can resolve after Cancel or after leaving Practice.
      if (sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      session.stream = stream
      if (!stream.getAudioTracks().some((track) => track.readyState === 'live')) {
        fail('The microphone disconnected before recording started. Connect it and try again.')
        return
      }
      const mimeType = typeof MediaRecorder.isTypeSupported === 'function'
        ? mimeTypes.find((type) => MediaRecorder.isTypeSupported(type))
        : undefined
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      session.recorder = recorder

      recorder.ondataavailable = (event) => {
        if (sessionRef.current === session && event.data.size > 0) session.chunks.push(event.data)
      }
      recorder.onerror = () => fail('Audio capture failed. Check your microphone and try recording again.')
      recorder.onstop = () => {
        if (sessionRef.current !== session) return
        const seconds = durationSeconds(session)
        // The final dataavailable event precedes onstop; only finalize here.
        const blob = new Blob(session.chunks, { type: recorder.mimeType || session.chunks[0]?.type || '' })
        if (!blob.size) {
          fail('No audio was captured. Try recording for a few seconds before stopping.')
          return
        }
        try {
          const url = URL.createObjectURL(blob)
          sessionRef.current = null
          releaseSession(session)
          urlRef.current = url
          setRecordedAnswer({ blob, url, mimeType: blob.type, durationSeconds: seconds })
          setElapsedSeconds(seconds)
          setBusy(null)
          setPhase('review')
        } catch {
          fail('The recording could not be prepared for playback. Please try again.')
        }
      }

      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (sessionRef.current !== session || session.finishedAt !== null) return
          setError('The microphone disconnected. Review the captured audio before using it, or discard it and try again.')
          finishCapture(session)
        }
      })
      session.startedAt = performance.now()
      recorder.start(1000)
      session.timer = window.setInterval(() => {
        if (sessionRef.current === session) setElapsedSeconds(durationSeconds(session))
      }, 250)
      setBusy(null)
      setPhase('recording')
    } catch (cause) {
      fail(captureErrorMessage(cause))
    }
  }, [supportError, finishCapture])

  function stop() {
    const session = sessionRef.current
    if (session) finishCapture(session)
  }

  return {
    phase, busy, elapsedSeconds, recordedAnswer, error, supportError,
    start, stop, discard,
    reportPlaybackError: () => setError('This browser could not play the recorded audio. Discard it and retry, or try another current browser.'),
  }
}
