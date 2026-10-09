import { createServer } from 'node:http'
import type { ServerResponse } from 'node:http'
import { parseAnalysisResult } from '../shared/analysis.ts'
import { AnalysisError } from './errors.ts'
import { readAnalysisUpload } from './routes/analyzeAnswer.ts'
import type { AnalysisService } from './services/analysisService.ts'

function sendJson(response: ServerResponse, status: number, body: unknown) {
  if (response.destroyed || response.writableEnded) return
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

export function createAnalysisServer(analyze: AnalysisService, timeoutMs = 60000) {
  const server = createServer((request, response) => {
    if (request.url?.split('?', 1)[0] !== '/api/analyze-answer') {
      request.resume()
      sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } })
      return
    }
    if (request.method !== 'POST') {
      request.resume()
      response.setHeader('Allow', 'POST')
      sendJson(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST to submit an answer.' } })
      return
    }

    const controller = new AbortController()
    const disconnect = () => controller.abort(new DOMException('Client disconnected', 'AbortError'))
    const close = () => { if (!response.writableEnded) disconnect() }
    request.once('aborted', disconnect)
    response.once('close', close)

    void (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const input = await readAnalysisUpload(request, controller.signal)
        timer = setTimeout(() => controller.abort(new AnalysisError(504, 'ANALYSIS_TIMEOUT', 'Analysis timed out. Your recording is still available; try again.')), timeoutMs)
        const result = await abortable(analyze(input, controller.signal), controller.signal)
        let validated
        try { validated = parseAnalysisResult(result) }
        catch { throw new AnalysisError(502, 'INVALID_ANALYSIS', 'The analysis response was invalid. Your recording is still available.') }
        sendJson(response, 200, validated)
      } catch (error) {
        request.resume()
        const failure = error instanceof AnalysisError ? error : new AnalysisError(502, 'ANALYSIS_FAILED', 'Analysis failed. Your recording is still available; try again.')
        sendJson(response, failure.status, { error: { code: failure.code, message: failure.message } })
      } finally {
        if (timer) clearTimeout(timer)
        request.off('aborted', disconnect)
        response.off('close', close)
      }
    })()
  })
  server.requestTimeout = 30000
  server.headersTimeout = 15000
  return server
}
