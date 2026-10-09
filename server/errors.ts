export class AnalysisError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'AnalysisError'
    this.status = status
    this.code = code
  }
}
