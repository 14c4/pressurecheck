export type BackendConfig = {
  provider: 'disabled' | 'gemini'
  model: string
  apiKey: string
  timeoutMs: number
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  const provider = env.ANALYSIS_PROVIDER?.trim() || 'disabled'
  if (provider !== 'disabled' && provider !== 'gemini') {
    throw new Error('ANALYSIS_PROVIDER must be disabled or gemini.')
  }
  const timeoutMs = Number(env.ANALYSIS_TIMEOUT_MS || 60000)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
    throw new Error('ANALYSIS_TIMEOUT_MS must be between 1000 and 120000 milliseconds.')
  }
  return {
    provider,
    model: env.ANALYSIS_MODEL?.trim() || 'gemini-2.5-flash',
    apiKey: env.GEMINI_API_KEY?.trim() || '',
    timeoutMs,
  }
}
