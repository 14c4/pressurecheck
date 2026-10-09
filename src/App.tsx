import { useEffect, useRef, useState } from 'react'
import HomeScreen from './components/HomeScreen'
import PracticeScreen from './components/PracticeScreen'
import { interviewQuestion } from './data/question'

type Screen = 'home' | 'practice'

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    document.title = `${screen === 'home' ? 'Home' : 'Practice'} · PressureCheck`
    mainRef.current?.focus()
  }, [screen])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>

      <header className="site-header">
        <button className="brand" type="button" onClick={() => setScreen('home')} aria-label="PressureCheck home">
          <span className="brand-mark" aria-hidden="true">p</span>
          <span>PressureCheck</span>
        </button>

        <nav className="navigation" aria-label="Main navigation">
          <button type="button" className="nav-button" aria-current={screen === 'home' ? 'page' : undefined} onClick={() => setScreen('home')}>
            Home
          </button>
          <button type="button" className="nav-button" aria-current={screen === 'practice' ? 'page' : undefined} onClick={() => setScreen('practice')}>
            Practice
          </button>
        </nav>
      </header>

      <main id="main-content" ref={mainRef} tabIndex={-1}>
        {screen === 'home' ? (
          <HomeScreen question={interviewQuestion} onStart={() => setScreen('practice')} />
        ) : (
          <PracticeScreen question={interviewQuestion} onBack={() => setScreen('home')} />
        )}
      </main>
    </div>
  )
}

export default App
