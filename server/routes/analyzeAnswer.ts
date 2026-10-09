import type { IncomingMessage } from 'node:http'
import busboy from 'busboy'
import { AUDIO_MIME_TYPES, baseAudioMimeType, MAX_AUDIO_BYTES, MAX_QUESTION_LENGTH } from '../../shared/analysis.ts'
import { AnalysisError } from '../errors.ts'
import type { AnalysisInput } from '../services/analysisService.ts'

const MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + 64 * 1024

function invalidUpload(message = 'Send one audio file, the question, and its original MIME type.') {
  return new AnalysisError(400, 'INVALID_UPLOAD', message)
}

function tooLarge() {
  return new AnalysisError(413, 'AUDIO_TOO_LARGE', 'The recording is too large. Record a shorter answer (maximum 8 MiB).')
}

export function validateAudioContainer(audio: Uint8Array, mimeType: string) {
  const bytes = Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength)
  const base = baseAudioMimeType(mimeType)
  if (!AUDIO_MIME_TYPES.some((type) => type === base)) {
    throw new AnalysisError(415, 'UNSUPPORTED_AUDIO', 'Unsupported recording format. Use WebM, Ogg, MP4/M4A, or WAV audio.')
  }
  if (!bytes.length) throw invalidUpload('The recording is empty. Record an answer before submitting.')
  if (bytes.length > MAX_AUDIO_BYTES) throw tooLarge()
  // Basic container checks catch obvious mismatches. The provider is responsible
  // for decoding the audio; these signatures do not prove speech is present.
  const valid = base === 'audio/webm'
    ? bytes.length >= 16 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) && bytes.subarray(0, 4096).includes('webm')
    : base === 'audio/ogg'
      ? bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'OggS'
      : base === 'audio/wav'
        ? bytes.length >= 44 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE'
        : bytes.length >= 16 && bytes.toString('ascii', 4, 8) === 'ftyp'
  if (!valid) throw invalidUpload('The audio is damaged or does not match its declared format. Try recording again.')
}

export function readAnalysisUpload(request: IncomingMessage, signal: AbortSignal): Promise<AnalysisInput> {
  const contentType = request.headers['content-type'] || ''
  if (!/^multipart\/form-data\s*;/i.test(contentType)) return Promise.reject(invalidUpload('Use multipart/form-data to submit the recorded answer.'))
  if (Number(request.headers['content-length']) > MAX_REQUEST_BYTES) return Promise.reject(tooLarge())

  return new Promise((resolve, reject) => {
    let parser: ReturnType<typeof busboy>
    try {
      parser = busboy({
        headers: request.headers,
        limits: { files: 1, fields: 2, parts: 4, fileSize: MAX_AUDIO_BYTES + 1, fieldSize: 8192, fieldNameSize: 32, headerPairs: 32 },
      })
    } catch {
      reject(invalidUpload('The upload boundary or headers are invalid.'))
      return
    }
    const fields = new Map<string, string>()
    let chunks: Buffer[] = []
    let audioSize = 0
    let requestSize = 0
    let fileMimeType = ''
    let receivedFile = false
    let settled = false

    function cleanup() {
      request.off('data', countBytes)
      request.off('error', onRequestError)
      signal.removeEventListener('abort', onAbort)
    }

    function fail(error: unknown) {
      if (settled) return
      settled = true
      chunks = []
      cleanup()
      request.unpipe(parser)
      parser.destroy()
      request.resume()
      reject(error)
    }

    function countBytes(chunk: Buffer) {
      requestSize += chunk.length
      if (requestSize > MAX_REQUEST_BYTES) fail(tooLarge())
    }
    function onRequestError() { fail(invalidUpload('The audio upload was interrupted. Please retry.')) }
    function onAbort() { fail(signal.reason) }

    parser.on('field', (name, value, info) => {
      if (settled) return
      if (!['question', 'mimeType'].includes(name) || fields.has(name) || info.nameTruncated || info.valueTruncated) {
        fail(invalidUpload('Upload fields are duplicated, unexpected, or too long.'))
      } else fields.set(name, value)
    })
    parser.on('file', (name, file, info) => {
      file.on('error', onRequestError)
      if (settled || receivedFile || name !== 'audio') {
        file.resume()
        fail(invalidUpload())
        return
      }
      receivedFile = true
      fileMimeType = info.mimeType
      file.on('limit', () => fail(tooLarge()))
      file.on('data', (chunk: Buffer) => {
        if (settled) return
        audioSize += chunk.length
        if (audioSize > MAX_AUDIO_BYTES) fail(tooLarge())
        else chunks.push(chunk)
      })
    })
    parser.on('filesLimit', () => fail(invalidUpload()))
    parser.on('fieldsLimit', () => fail(invalidUpload()))
    parser.on('partsLimit', () => fail(invalidUpload()))
    parser.on('error', () => fail(invalidUpload('The multipart upload is incomplete or malformed.')))
    parser.on('close', () => {
      if (settled) return
      try {
        const question = fields.get('question')?.trim()
        const mimeType = fields.get('mimeType')?.trim()
        if (!receivedFile || !question || question.length > MAX_QUESTION_LENGTH || !mimeType || mimeType.length > 128) throw invalidUpload()
        if (!/^audio\/[a-z0-9.+-]+(?:\s*;[\x20-\x7e]+)?$/i.test(mimeType)) throw invalidUpload('The recorded MIME type is invalid.')
        if (baseAudioMimeType(mimeType) !== baseAudioMimeType(fileMimeType)) throw invalidUpload('The audio upload and original MIME type do not match.')
        const audio = Buffer.concat(chunks, audioSize)
        validateAudioContainer(audio, mimeType)
        settled = true
        chunks = []
        cleanup()
        resolve({ question, audio, mimeType })
      } catch (error) { fail(error) }
    })
    request.on('data', countBytes)
    request.on('error', onRequestError)
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
    else request.pipe(parser)
  })
}
