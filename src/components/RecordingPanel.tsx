import { useEffect, useRef } from 'react'
import type { useAudioRecorder } from '../hooks/useAudioRecorder'
import Icon from './Icon'

type RecordingPanelProps = {
  recorder: ReturnType<typeof useAudioRecorder>
  onSubmit: () => void
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

function RecordingPanel({ recorder, onSubmit }: RecordingPanelProps) {
  const { phase, busy, elapsedSeconds, recordedAnswer, error, supportError } = recorder
  const audioRef = useRef<HTMLAudioElement>(null)
  const stopRef = useRef<HTMLButtonElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (phase === 'recording') stopRef.current?.focus()
    else headingRef.current?.focus()
  }, [phase])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    function rewind() {
      if (audio) audio.currentTime = 0
    }

    function resolveDuration() {
      // Some MediaRecorder WebM files omit duration metadata. Seeking through
      // the finite local Blob lets the browser discover its end, then rewind.
      if (!audio || audio.duration !== Infinity) return
      audio.addEventListener('seeked', rewind, { once: true })
      try {
        audio.currentTime = Number.MAX_SAFE_INTEGER
      } catch {
        // Playback still works in browsers that cannot seek this format.
        audio.removeEventListener('seeked', rewind)
      }
    }

    audio.addEventListener('loadedmetadata', resolveDuration)
    if (audio.readyState >= 1) resolveDuration()
    return () => {
      audio.removeEventListener('loadedmetadata', resolveDuration)
      audio.removeEventListener('seeked', rewind)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
  }, [recordedAnswer?.url])

  const status = busy === 'requesting' ? 'Waiting for permission'
    : busy === 'stopping' ? 'Finishing recording'
      : phase === 'recording' ? 'Recording'
        : phase === 'review' ? 'Ready to review' : 'Ready'

  return (
    <section className="panel recording-panel" aria-labelledby="recording-heading">
      <div className="recording-topbar">
        <h2 id="recording-heading" ref={headingRef} tabIndex={-1}>
          {phase === 'review' ? 'Review your answer' : 'Your answer'}
        </h2>
        <div className="recording-status-group">
          <span className={phase === 'recording' ? 'recording-status is-recording' : 'recording-status'} role="status">
            {phase === 'recording' && <span className="recording-dot" aria-hidden="true" />}
            {status}
          </span>
          <span className="recording-timer" aria-label={`Elapsed time: ${formatTime(elapsedSeconds)}`}>
            {formatTime(elapsedSeconds)}
          </span>
        </div>
      </div>

      <div className="interview-stage">
        <div className="stage-microphone"><Icon name="microphone" /></div>
        <p className="stage-title">
          {busy === 'requesting' ? 'Allow microphone access to begin'
            : phase === 'recording' ? 'Recording your answer'
              : phase === 'review' ? 'Your answer is recorded' : 'Ready when you are'}
        </p>
        <p className="supporting-text stage-description">
          {busy === 'requesting' ? 'Use your browser’s permission prompt, or cancel waiting below.'
            : phase === 'recording' ? 'Speak naturally. Stop when you have finished.'
              : phase === 'review' ? 'Listen back before choosing your next step.' : 'Start recording to answer the question above.'}
        </p>
        <span className="stage-camera-label"><Icon name="camera" /> Camera off · Preview coming soon</span>
      </div>

      <div className="recording-bottom-bar">
        {(error || supportError) && <p className="recording-error" role="alert">{error || supportError}</p>}

        {phase === 'review' && recordedAnswer && (
          <div className="audio-review">
            <label className="placeholder-title" htmlFor="answer-playback">Your recording</label>
            <audio id="answer-playback" ref={audioRef} controls preload="auto" src={recordedAnswer.url} onError={recorder.reportPlaybackError}>
              Your browser does not support audio playback.
            </audio>
          </div>
        )}

        <div className="recording-controls">
          {phase === 'ready' && (
            busy === 'requesting' ? (
              <button className="button button-secondary" type="button" onClick={recorder.discard}>Cancel waiting</button>
            ) : (
              <button className="button button-primary" type="button" onClick={() => void recorder.start()} disabled={Boolean(supportError)}>
                <Icon name="microphone" /> Start Recording
              </button>
            )
          )}
          {phase === 'recording' && (
            <button ref={stopRef} className="button button-stop" type="button" onClick={recorder.stop} disabled={busy === 'stopping'}>
              <Icon name="stop" /> {busy === 'stopping' ? 'Finishing…' : 'Stop Recording'}
            </button>
          )}
          {phase === 'review' && (
            <>
              <button className="button button-secondary" type="button" onClick={recorder.discard}>Discard &amp; Rerecord</button>
              <button className="button button-primary" type="button" onClick={onSubmit}>Submit for Analysis</button>
            </>
          )}
        </div>

        <p className="supporting-text recording-note">
          {phase === 'review'
            ? 'Gemini is not connected. Submission opens sample feedback; your recording is not uploaded or analyzed.'
            : 'Microphone only. Audio stays in this tab and is cleared when you discard it or leave Practice.'}
        </p>
      </div>
    </section>
  )
}

export default RecordingPanel
