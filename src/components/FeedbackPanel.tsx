import type { AnswerFeedback } from '../types/session'

type FeedbackPanelProps = {
  feedback: AnswerFeedback
  onRetry: () => void
}

function FeedbackPanel({ feedback, onRetry }: FeedbackPanelProps) {
  const insufficient = feedback.status === 'insufficient'

  return (
    <section className="panel feedback-panel" aria-labelledby="feedback-heading">
      <div className="panel-header feedback-header">
        <h2 id="feedback-heading">AI Feedback</h2>
        <span className="availability-label">{insufficient ? 'Insufficient audio for evaluation' : 'Analysis complete'}</span>
      </div>

      <section className={insufficient ? 'sample-notice' : 'feedback-summary'} aria-labelledby="summary-heading">
        <h3 id="summary-heading">Summary</h3>
        <p className="transcript-text">{feedback.summary}</p>
      </section>

      <div className="feedback-content">
        <section className="transcript-section" aria-labelledby="transcript-heading">
          <h3 id="transcript-heading">Your answer transcription</h3>
          <p className={feedback.transcript ? 'transcript-text' : 'empty-text'}>
            {feedback.transcript || 'No reliable speech could be transcribed.'}
          </p>
        </section>

        {!insufficient && (
          <div className="feedback-columns">
            <section aria-labelledby="strengths-heading">
              <h3 id="strengths-heading">Strengths</h3>
              <ul>{feedback.strengths.map((strength) => <li key={strength}>{strength}</li>)}</ul>
            </section>
            <section aria-labelledby="improvements-heading">
              <h3 id="improvements-heading">Areas for improvement</h3>
              <ul>{feedback.improvements.map((improvement) => <li key={improvement}>{improvement}</li>)}</ul>
            </section>
          </div>
        )}

        <section className="next-attempt next-attempt-suggestion" aria-labelledby="next-attempt-heading">
          <h3 id="next-attempt-heading">Next attempt</h3>
          <p className="suggestion-text">{feedback.nextAttemptFocus}</p>
        </section>
      </div>

      <div className="feedback-actions">
        <button className="button button-primary" type="button" onClick={onRetry}>Try Again</button>
        <span className="supporting-text">Clears this recording and returns to the same question.</span>
      </div>
    </section>
  )
}

export default FeedbackPanel
