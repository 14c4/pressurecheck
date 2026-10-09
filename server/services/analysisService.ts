import { parseAnalysisResult } from '../../shared/analysis.ts'
import type { AnalysisResult } from '../../shared/analysis.ts'
import type { BackendConfig } from '../config.ts'
import { AnalysisError } from '../errors.ts'
import { createGeminiAnalyzer } from '../providers/gemini.ts'

export type AnalysisInput = {
  question: string
  audio: Uint8Array
  mimeType: string
}

export type AnalysisService = (input: AnalysisInput, signal: AbortSignal) => Promise<AnalysisResult>

export function createAnalysisService(config: BackendConfig): AnalysisService {
  if (config.provider === 'disabled' || !config.apiKey) {
    return async () => {
      throw new AnalysisError(503, 'ANALYSIS_NOT_CONFIGURED', 'Analysis is not configured. Set ANALYSIS_PROVIDER=gemini and GEMINI_API_KEY in server/.env, then restart the backend.')
    }
  }
  const analyze = createGeminiAnalyzer(config)
  return async (input, signal) => {
    const result = await analyze(input, signal)
    try {
      return parseAnalysisResult(result)
    } catch {
      throw new AnalysisError(502, 'INVALID_ANALYSIS', 'The AI returned incomplete or invalid feedback. Your recording is still available; try submitting again.')
    }
  }
}
