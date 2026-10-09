# PressureCheck

A local interview-practice application: React + TypeScript + Vite, real microphone
recording/playback, and a minimal Node backend for Gemini audio analysis.

PressureCheck's goal adds an ElevenLabs interviewer and optional
validated Presage measurements to this practice loop, with guided retry and
evidence-grounded improvement. Those additions are planned, not implemented.

Current build provides real microphone recording and playback in a call-style
interview workspace. The homepage and Home/Practice navigation are preserved.

## Project documentation

- [Technical roadmap](docs/ROADMAP.md): approved priorities, implementation status,
  acceptance criteria, dependencies, Presage compatibility findings, and blockers.
- [Contributor and agent guide](AGENTS.md): concise architectural, coding, and
  verification conventions. Consult the roadmap before starting a milestone.

## Implemented workflow

**Home → Ready → Recording → Review → Submit → Feedback → Try Again**

- Record microphone audio with MediaRecorder, stop, play it back, and rerecord.
- Submit the original audio and question to `/api/analyze-answer`.
- When configured, Gemini transcribes and evaluates the same audio in one request.
- Display validated transcript, summary, strengths, improvements, and one next-attempt suggestion.
- Handle insufficient speech, loading, cancellation, network/provider errors, and retry.
- Preserve the recording for playback if submission fails. There is no sample-feedback fallback.

The backend defaults to **disabled**. Without configuration, recording/playback
still work and submission displays an honest configuration error.

Camera capture, interviewer voice, ElevenLabs, Presage, accounts, and a database
are not implemented. Live Signals remains a clearly unavailable placeholder.
Browser speech synthesis, multiple questions/modes, previous-attempt retention,
and attempt comparison are also not implemented. Try Again currently clears the
recording and feedback rather than preserving the previous improvement goal.

### Verification status

The **2026-10-09 audit** inspected the workflow and Gemini request path, passed
all **21 offline tests**, lint, both TypeScript project checks, and an in-memory
Vite production build. The audit did not run the standard disk-writing
`npm run build`; it separately verified types and bundling without file output.

Real browser microphone/playback behavior, normal development-server startup,
live Gemini transcription/answer-grounded feedback, and live silence handling
remain unverified by that audit. Offline fixtures do not prove a real interview
session works. **Milestone A's live verification is the next application priority.**
Presage Windows/Node support is documented, but its independent actual-machine
test and architecture decision are still pending. See the roadmap for details.

## Run locally

Use **Node.js 24 LTS** and npm. From `C:\pressurecheck`:

```powershell
npm install
```

Start the backend in one terminal:

```powershell
npm run dev:server
```

Start the frontend in another terminal:

```powershell
npm run dev
```

Open the Vite localhost address (normally `http://localhost:5173`). The backend
listens only on `127.0.0.1:3001`; Vite proxies `/api` requests to it. Use `Ctrl+C`
to stop each process. `npm run start:server` runs the backend without watch mode.

After `npm run build`, `npm run preview` serves the built frontend and proxies
the same endpoint; keep the backend running in its own terminal.

## Set up Gemini

1. Open [Google AI Studio API Keys](https://aistudio.google.com/apikey), sign in,
   and create/select a project and a new Gemini API key. Import an existing Cloud
   project through AI Studio's Projects dashboard if necessary.
2. Copy `server/.env.example` to `server/.env`, then edit it locally:

   ```dotenv
   ANALYSIS_PROVIDER=gemini
   ANALYSIS_MODEL=gemini-2.5-flash
   GEMINI_API_KEY=YOUR_ACTUAL_KEY
   ANALYSIS_TIMEOUT_MS=60000
   ```

3. Restart the backend. Its startup message should show `provider: gemini`.
4. Record a short answer in Chrome or Edge, review it, then submit.

`server/.env` is ignored by Git. Never put the key in React, `VITE_*` variables,
or a committed file. The SDK receives the backend's explicit `GEMINI_API_KEY`;
no key is sent to the browser. Check `git status` before committing your work.

`gemini-2.5-flash` supports audio input and structured output. The model remains
configurable: use an available model supporting both capabilities for your project.
The free tier does not require Cloud Billing; model availability and quotas depend
on your account. Consult [API key setup](https://ai.google.dev/gemini-api/docs/api-key)
and [billing](https://ai.google.dev/gemini-api/docs/billing) for current requirements.

Set `ANALYSIS_PROVIDER=disabled` to turn off live calls. An invalid provider or
timeout setting fails startup clearly. Missing credentials produce a recoverable
configuration error rather than fake feedback.

### Troubleshooting Gemini errors

If submission fails, check the terminal running `npm run dev:server` for a
`[Gemini analysis]` line. It includes the configured model, upstream HTTP status,
and a bounded, sanitized upstream explanation. API keys, the submitted question,
and encoded recording data are redacted; the full SDK error, request, response
details, and transcript are not logged. These diagnostics stay in the backend;
the browser receives a safe error message.

A `404` can indicate a model/API-version/access problem. The diagnostic helps
distinguish these instead of treating every `404` as proof the model is missing.
After editing `server/.env`, stop and restart the backend completely.

## Tests and checks

```powershell
npm test
npm run build
npm run lint
```

- `npm test` is **offline**: it uses injected analysis results and a stubbed SDK
  transport. It never loads `server/.env` or calls Google. Tests cover upload
  bounds/MIME preservation, structured validation, errors, cancellation,
  timeout behavior, and the official SDK request/response path.
- `npm run build` type-checks the frontend, shared contract, backend, tests, and
  scripts, then builds the frontend into `dist/`. Node runs the backend TypeScript
  directly; it does not require a separate emitted backend bundle.
- `npm run lint` uses the starter's Oxlint tooling.

### Opt-in live smoke test

This test **sends your chosen recording to Gemini and consumes quota**. It is not
part of `npm test`. Configure `server/.env` first; the backend server itself does
not need to be running because this test calls the adapter directly.

Record a short behavioral answer containing a distinctive phrase such as
"shared checklist". In Review, Chrome's native audio player's menu may let you
download the recording. Save a temporary fixture outside the repository, keeping
its actual format (do not rename MP4 to WebM or WAV).

```powershell
npm run test:live -- --audio "C:\path\answer.webm" --expect "shared checklist"
```

The test checks that analysis succeeds, structured validation passes, and the
transcript includes the expected phrase. It does not demand exact AI phrasing.
It reads your fixture without creating new recording files or printing the transcript.
Choose an expected phrase that you actually said.

Optionally test generated silent WAV audio as a **second live request**:

```powershell
npm run test:live -- --audio "C:\path\answer.webm" --expect "shared checklist" --silence
```

Silence must return `insufficient` with no invented transcript. Delete your temporary
fixture when finished. Live verification requires your own key and project access;
offline test success alone does not verify those.

### Manual browser verification

1. Home → Start Practice → Start Recording. Allow microphone access; camera
   access should never be requested. Speak for 15–30 seconds.
2. Stop and play back the beginning and end. The timer freezes and capture stops.
3. Discard & Rerecord, then record another answer. The previous audio must be gone.
4. Submit. Confirm the button is disabled while pending; playback remains available.
5. With Gemini enabled, check that the transcript reflects your actual words,
   and the feedback refers to details from your answer.
6. Try Again returns to the same question with `00:00` and no previous recording.
7. Submit silence. The results should explain insufficient speech without invented strengths.
8. Stop the backend and submit again: the error should preserve your audio.
9. During submission, cancel, discard, or navigate Home. No late response should
   replace a new attempt. Canceling locally cannot guarantee that Google stops an
   already accepted operation or its quota usage.
10. Check narrow/mobile layout, Tab/Enter navigation, blocked microphone permissions,
    and leaving Practice during recording. Microphone tracks should be released.

## Upload/result contract

`POST /api/analyze-answer` accepts `multipart/form-data` with exactly:

- `question`: nonempty text, maximum 2,000 characters.
- `mimeType`: the original Blob MIME type, including any codec parameters.
- `audio`: one nonempty audio file, maximum **8 MiB**.

The original bytes/type are retained. Multipart parsing is bounded even without
Content-Length; basic container signatures are checked. Signatures do not prove
that speech is present or that every frame can be decoded.

The upload layer accepts WebM, Ogg, MP4/M4A, and WAV. Google documents `audio/m4a`
but not `audio/mp4`; the Gemini adapter explicitly rejects unverified MP4 instead
of silently relabeling it. Safari MP4 recordings remain playable locally. Start
with Chrome/Edge WebM or Firefox Ogg for analysis. No transcoding is performed.

Results contain:

```text
status: success | insufficient
transcript: string | null
summary: string
strengths: string[]
improvements: string[]
nextAttemptFocus: string
```

Both backend and frontend validate results before display. Successful results need
a transcript; insufficient results have no strengths/improvements. Structured
output constrains shape but cannot guarantee semantic correctness.

Errors return `{ error: { code, message } }`: `400` malformed/empty upload, `413`
too large, `415` unsupported audio, `503` missing credentials/model access, `429`
provider quota, `502` provider/invalid-result failure, or `504` timeout.

Audio remains in tab/backend memory only; this application does not persist it to
disk or a database, use Google's Files API, or log audio/transcripts. Only submission
uploads audio, and an enabled adapter sends it to Google under your API project's
applicable terms/data handling. Responses use `Cache-Control: no-store`.

## Important files

```text
shared/analysis.ts                  # Result contract, schema, runtime validation, limits
server/
├── index.ts                       # Local server startup
├── app.ts                         # Endpoint lifecycle, timeout/cancellation, JSON errors
├── config.ts                      # Backend-only provider/key/model configuration
├── errors.ts                      # Safe HTTP error contract
├── routes/analyzeAnswer.ts         # Bounded in-memory multipart parsing
├── services/analysisService.ts     # Configurable analysis boundary and validation
└── providers/gemini.ts             # Official @google/genai audio + structured output
src/
├── components/PracticeScreen.tsx   # Recording/submission/results workflow
├── components/RecordingPanel.tsx   # Recording stage and retained native playback
├── components/FeedbackPanel.tsx    # Validated success/insufficient results
├── hooks/useAudioRecorder.ts       # Existing microphone/timer/Blob cleanup
├── hooks/useAnswerAnalysis.ts      # Pending/error/result state and stale-request guards
└── services/answerAnalysis.ts      # Browser upload and response validation
tests/                             # Offline Node tests
scripts/test-live.ts                # Explicit opt-in live provider test
```

React screens never import provider code or credentials. New provider adapters can
be selected in the analysis service while keeping the HTTP contract and frontend.
The only new runtime dependencies are Busboy (multipart parsing) and the official
Google GenAI SDK; Busboy's TypeScript definitions are a development dependency.

Home/Practice navigation remains React state rather than URL routing. Refreshing
starts on Home and clears the current recording.
