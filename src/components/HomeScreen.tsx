import type { InterviewQuestion } from '../data/question'

type HomeScreenProps = {
  question: InterviewQuestion
  onStart: () => void
}

function HomeScreen({ question, onStart }: HomeScreenProps) {
  return (
    <section className="home-layout" aria-labelledby="home-heading">
      <div className="home-copy">
        <h1 id="home-heading">Practice your interview answers.</h1>
        <p className="intro">Record an answer, get feedback, and try again.</p>
        <button className="button button-primary" type="button" onClick={onStart}>
          Start Practice
        </button>
      </div>

      <aside className="question-preview panel" aria-labelledby="preview-heading">
        <div className="panel-header">
          <h2 id="preview-heading">Interview question</h2>
          <span className="tag">{question.category}</span>
        </div>
        <p className="preview-prompt">{question.prompt}</p>
      </aside>
    </section>
  )
}

export default HomeScreen
