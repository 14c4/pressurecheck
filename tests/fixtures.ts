import type { AnalysisResult } from '../shared/analysis.ts'

// Upload-parser fixture only, not decodable speech and never used by live tests.
export const webmFixture = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('webm'), Buffer.alloc(24)])
export const successResult: AnalysisResult = {
  status: 'success',
  transcript: 'I helped the team agree on responsibilities and made a shared checklist.',
  summary: 'A clear team example with a concrete action.',
  strengths: ['You identified your own action: creating a shared checklist.'],
  improvements: ['Explain the result of the checklist.'],
  nextAttemptFocus: 'Add one sentence describing what changed after the team used the checklist.',
}
export const insufficientResult: AnalysisResult = {
  status: 'insufficient', transcript: null,
  summary: 'There was not enough intelligible speech to evaluate.',
  strengths: [], improvements: [],
  nextAttemptFocus: 'Record a short answer with your microphone closer to you.',
}
