// Written example only. This data is never derived from microphone input or AI.
import type { AnswerFeedback } from '../types/session'

export const mockFeedback: AnswerFeedback = {
  source: 'sample',
  transcript: null,
  exampleAnswer: 'During a team project, two teammates disagreed about how to divide the work. I suggested a short meeting to list the remaining tasks and agree on who would own each one. I also set up a shared checklist. We finished the project on time, and everyone knew what they needed to do.',
  strengths: [
    'The example addresses a specific team challenge.',
    'The answer clearly identifies the actions taken: a meeting and a shared checklist.',
  ],
  improvements: [
    'Add a little context about the project and why the disagreement mattered.',
    'Explain how the meeting helped the teammates resolve their disagreement.',
  ],
  nextAttemptFocus: 'Add one sentence explaining what you said or did in the meeting to help the team agree on responsibilities.',
}
