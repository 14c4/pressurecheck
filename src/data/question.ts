export const interviewQuestion = {
  id: 'team-challenge',
  category: 'Behavioral',
  title: 'Navigating a team challenge',
  prompt: 'Tell me about a time you faced a difficult challenge on a team. What did you do, and what was the outcome?',
} as const

export type InterviewQuestion = typeof interviewQuestion
