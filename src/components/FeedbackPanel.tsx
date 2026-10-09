import type { AnswerFeedback } from '../types/session'

type FeedbackPanelProps = {
  feedback: AnswerFeedback
  onRetry: () => void
}

function FeedbackPanel({ feedback, onRetry }: FeedbackPanelProps) {
  const isSample = feedback.source === 'sample'

  return (
    <section className="panel feedback-panel" aria-labelledby="feedback-heading">
      <div className="panel-header feedback-header">
        <h2 id="feedback-heading">{isSample ? 'AI Feedback · Sample preview' : 'AI Feedback'}</h2>
        {isSample && <span className="availability-label">Gemini · Not connected</span>}
      </div>

      {isSample && (
        <p className="sample-notice">
          No actual analysis has occurred. This is example feedback for a written sample answer,
          not your recording. Your audio has not been uploaded or transcribed.
        </p>
      )}

      <div className="feedback-content">
        <section className="transcript-section" aria-labelledby="transcript-heading">
          <h3 id="transcript-heading">Your answer transcription</h3>
          <p className={!isSample && feedback.transcript ? 'transcript-text' : 'empty-text'}>
            {!isSample && feedback.transcript
              ? feedback.transcript : 'Unavailable — your recording has not been transcribed.'}
          </p>
        </section>

        {isSample && feedback.exampleAnswer && (
          <section className="written-example" aria-labelledby="example-heading">
            <h3 id="example-heading">Written example answer (not your transcript)</h3>
            <p className="transcript-text">{feedback.exampleAnswer}</p>
          </section>
        )}

        <div className="feedback-columns">
          <section aria-labelledby="strengths-heading">
            <h3 id="strengths-heading">{isSample ? 'Example strengths' : 'Strengths'}</h3>
            <ul>{feedback.strengths.map((strength) => <li key={strength}>{strength}</li>)}</ul>
          </section>
          <section aria-labelledby="improvements-heading">
            <h3 id="improvements-heading">{isSample ? 'Example areas for improvement' : 'Areas for improvement'}</h3>
            <ul>{feedback.improvements.map((improvement) => <li key={improvement}>{improvement}</li>)}</ul>
          </section>
        </div>

        <section className="next-attempt sample-suggestion" aria-labelledby="next-attempt-heading">
          <h3 id="next-attempt-heading">{isSample ? 'Example next-attempt suggestion' : 'Next attempt'}</h3>
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
