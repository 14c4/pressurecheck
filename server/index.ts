import { createAnalysisServer } from './app.ts'
import { loadConfig } from './config.ts'
import { createAnalysisService } from './services/analysisService.ts'

const config = loadConfig()
const server = createAnalysisServer(createAnalysisService(config), config.timeoutMs)
server.listen(3001, '127.0.0.1', () => {
  console.log(`PressureCheck API: http://127.0.0.1:3001 (provider: ${config.provider})`)
})
server.on('error', () => {
  console.error('The API server could not start. Check whether port 3001 is already in use.')
  process.exitCode = 1
})
