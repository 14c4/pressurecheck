import { useEffect, useRef, useState } from 'react'
import type { InterviewQuestion } from '../data/question'
import { mockFeedback } from '../data/mockFeedback'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import FeedbackPanel from './FeedbackPanel'
import Icon from './Icon'
import LiveSignalsPanel from './LiveSignalsPanel'
import RecordingPanel from './RecordingPanel'

type PracticeScreenProps = {
  question: InterviewQuestion
  onBack: () => void
}

function PracticeScreen({ question, onBack }: PracticeScreenProps) {
  const recorder = useAudioRecorder()
  const [showFeedback, setShowFeedback] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
    document.title = `${showFeedback ? 'Feedback' : 'Practice'} · PressureCheck`
  }, [showFeedback])

  function submit() {
    if (recorder.phase === 'review' && recorder.recordedAnswer) setShowFeedback(true)
  }

  function tryAgain() {
    recorder.discard()
    setShowFeedback(false)
  }

  return (
    <section className="practice-layout" aria-labelledby="practice-heading">
      <div className="workspace-header">
        <h1 id="practice-heading" ref={headingRef} tabIndex={-1}>
          {showFeedback ? 'Practice feedback' : 'Interview practice'}
        </h1>
        <button className="back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span> Back to home
        </button>
      </div>

      {showFeedback ? (
        <FeedbackPanel feedback={mockFeedback} onRetry={tryAgain} />
      ) : (
        <>
          <section className="panel question-panel" aria-labelledby="question-heading">
            <div className="panel-header">
              <h2 id="question-heading">Interview Question</h2>
              <span className="tag">{question.category}</span>
            </div>
            <p className="question-prompt">{question.prompt}</p>
            <div className="voice-control">
              <button className="button button-secondary button-small" type="button" disabled>
                <Icon name="speaker" /> Hear question
              </button>
              <span className="supporting-text">ElevenLabs voice · Coming soon</span>
            </div>
          </section>

          <div className="practice-grid">
            <RecordingPanel recorder={recorder} onSubmit={submit} />
            <LiveSignalsPanel />
          </div>
        </>
      )}
    </section>
  )
}

export default PracticeScreen
