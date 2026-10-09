# PressureCheck technical roadmap

Approved roadmap and architecture assessment; audit date: **2026-10-09**.
This document is the detailed source of truth. See [README](../README.md) for
setup and verification procedures and [AGENTS.md](../AGENTS.md) for conventions.
Roadmap approval establishes direction; implementation requires approval of the
individual milestone. The documentation task does not start application work.

## Product vision and scope

Help users improve spoken communication through realistic interview practice,
personalized Gemini feedback, an ElevenLabs interviewer, and optional validated
Presage camera measurements. Keep the primary experience simple:

**Start → Hear/read question → Record → Review → Submit → Feedback → Retry**

The interview must remain useful if voice or sensing is unavailable. Physiological
measurements are informational context, not evidence of anxiety, confidence,
honesty, medical conditions, or interview performance. Keep them separate from
Gemini's communication evaluation.

Required MVP: reliable recording, real transcription and personalized feedback,
ElevenLabs question audio, optional working Presage measurements, feedback/retry,
secure backend integrations, graceful errors, and a repeatable demonstration.
Strongly recommended: evidence-grounded attempt comparison, a small question bank,
at least two modes, measurement summaries, and focused integration tests.
Future scope: personalities, dynamic follow-ups, realtime conversation, full
presentation coaching, accounts, persistent history, deployment, and analytics.

## Current implementation and evidence

Status vocabulary: **implemented** means inspected in code; **offline verified**
means exercised without a real provider/device; **live unverified** means the
required real-world acceptance test has not been performed in this audit.
Documentation research establishes supported capabilities, not machine compatibility.

| Area | Status and evidence |
| --- | --- |
| Foundation | Implemented: React 19, TypeScript 6, Vite 8, Node 24, npm, Git/remote, frontend/backend separation. |
| UI/workflow | Implemented: Home/Practice, one behavioral question, dark/mint workspace, review, feedback, same-question reset/retry, responsive CSS and keyboard/focus provisions. Browser usability is live unverified. |
| Recording | Implemented: microphone-only MediaRecorder, permission/device errors, timer, stop/finalization, playback, discard, tracks/object-URL cleanup. Device behavior is live unverified. |
| Gemini | Implemented: official `@google/genai`, original audio bytes plus question, server-side key, structured transcript/feedback, safe errors. SDK serialization/transport is offline verified; actual transcription/feedback is live unverified. |
| Contracts/reliability | Offline verified: upload byte/MIME preservation, bounds, validation, insufficient-result shape, provider errors, cancellation and timeout. Hook duplicate/stale guards are code-inspected, not browser-tested. |
| Voice | Not implemented. Hear Question is disabled; browser speech synthesis is also absent. |
| Sensing | Not implemented. Live Signals is an honest unavailable placeholder; no camera capture. |
| Progress/modes | Not implemented: previous-attempt retention/comparison, guided goal persistence, question selection/bank, technical or presentation rubric. |
| Collaboration docs | README existed; concise agent guidance and this approved roadmap are now documented. Team branch/PR workflow and a committed verified application baseline remain to be established. |

### Audit checks completed

- Windows `win32-x64`, Node **24.21.0**.
- `npm test`: **21 passed, 0 failed**; tests use injected results/stubbed SDK
  transport. The WebM fixture is a parser fixture, not decodable speech.
- `npm run lint`: passed.
- Frontend and backend/shared/tests TypeScript checks: passed with
  `--noEmit --incremental false` on their respective project configurations.
- Production bundling: passed via programmatic Vite with `write: false` and
  `emptyOutDir: false`. Standard `npm run build` was not run in the read-only audit.
- Endpoint tests started local HTTP servers and covered lifecycle/error behavior.
- `server/.env` is ignored and untracked; inspected frontend code has no provider
  credentials/imports. There is no application sample-feedback fallback.

Normal dev-server startup, actual browser microphone/playback behavior, real
Gemini content/silence handling, and all Presage/ElevenLabs live behavior remain
unverified. **No complete live milestone is marked finished.**

## Existing architecture to preserve

```text
src/hooks/useAudioRecorder.ts → recorded Blob
src/hooks/useAnswerAnalysis.ts → src/services/answerAnalysis.ts
POST /api/analyze-answer → server/routes/analyzeAnswer.ts
server/services/analysisService.ts → server/providers/gemini.ts
shared/analysis.ts validation → src/components/FeedbackPanel.tsx
```

The Node HTTP backend listens on `127.0.0.1:3001`; Vite dev/preview proxy `/api`.
Node runs backend TypeScript directly. Busboy parses bounded in-memory uploads.
`server/config.ts` loads backend-only environment settings. Analysis defaults to
disabled; Gemini currently defaults to configurable `gemini-2.5-flash`.
Results carry transcript, summary, strengths, improvements, and one retry focus.
The frontend retains audio after recoverable failures and guards pending requests.
Navigation/session state is in React; refresh/navigation clears the attempt.
No raw audio/video storage or database is required for the MVP.

Extend separate voice and sensing services instead of routing them through the
Gemini answer-analysis provider. Reuse components, hooks, and shared contracts
where useful without adding a generic framework or unnecessary abstraction.

## Milestone status and approved execution order

| Order | Master brief milestone | Current status/dependency |
| --- | --- | --- |
| Prep | I: collaboration documentation | Documentation established; broader team workflow pending. |
| 1 | A: audit/stabilize | Code audit and offline checks complete; live acceptance pending. **Current priority.** |
| 2 | C: Presage compatibility | Documentation research complete; independent machine test and architecture decision pending. Investigate early. |
| 3 | B: ElevenLabs interviewer | Planned; depends on a stable recording loop. Can overlap approved independent C work. |
| 4 | D: sensing integration | Planned; requires successful C test and selected architecture. |
| 5 | F: guided retry/comparison | Planned; requires reliable Gemini results and session/question identity. |
| 6 | E: question bank/two modes | Planned; generalize existing question type and add validated mode-specific evaluation. |
| 7 | G/H/J: integration, reliability, demo | Some H upload/key/error safeguards are implemented; full integrated acceptance and demo remain planned. Combine validated integrations and repeat the complete two-attempt demo. |

### A — Verify and stabilize the existing interview loop

Use the existing README manual browser checklist and opt-in live test. Target
Chrome/Edge WebM first. Verify normal frontend/backend startup, permissions,
recording stop/playback, original audio submission, answer-grounded transcription
and feedback, silence/noise, invalid uploads, cancellation/navigation, failures,
and consecutive attempts. Add a practical capture-duration limit and fix only
concrete issues; retain Gemini and the existing response contract.

**Acceptance:** two real attempts work from record through feedback/retry; silent
audio returns insufficient speech without invention; API failure preserves audio;
duplicate/late requests cannot corrupt a newer attempt; reset clears old capture;
microphone cleanup is confirmed; tests, lint, and standard build pass.

### C — Independent Presage compatibility and architecture decision

Run the official SmartSpectra example and test the native Node camera path on the
actual Windows demo machine, independently of PressureCheck. Pin the version
tested. Inspect camera discovery, native loading, authentication/cardio entitlement,
baseline pulse/breathing, timestamps, confidence/stability/validation, clean stop,
destroy, camera release, and restart. Confirm usage/licensing requirements.

**Acceptance:** real valid quiet measurements and repeated clean lifecycle work;
record SDK/runtime/device versions and quality rules; choose and document a
practical integration path. Do not change the app architecture before this gate.

### B — ElevenLabs question audio

Add a server-side text-to-speech provider/endpoint using current official docs;
configurable voice/model, validated text and audio, bounded response size, timeout,
cancellation/error handling, and reuse/cache of preset question audio where permitted.
Provide user-initiated play/replay/stop and loading/error status with written text
always visible. Add browser speech fallback where supported; it is new work.

**Acceptance:** real ElevenLabs question → spoken recording → Gemini feedback
works. Recording stops/cancels speech and prevents late audio from auto-playing;
playback is unavailable during capture. Voice failure preserves the practice flow;
credentials never reach the browser; controls/resources clean up on navigation.

### D — Optional live sensing and separate results summary

Implement explicit enable/disable, permission/device errors, connection/quality
status, and optional preview with one camera owner. Offer quiet baseline warm-up
plus enough valid samples, with skip/timeout controls. Preserve timestamps and
quality; exclude invalid, unstable, stale, and out-of-window samples. Suppress
breathing during speech; show pulse only where validity conditions hold.

**Acceptance:** valid baseline/live pulse and available quiet breathing appear;
unavailable results remain unavailable. Summary shows validated coverage and
limitations separately from AI feedback. Rolling windows crossing baseline/answer
boundaries are not mislabeled as answer-only data. Disabling/leaving releases the
camera; camera-off practice and provider failure do not break Gemini or recording.

### F — Guided retry and grounded attempt comparison

Keep question identity, transcript, feedback, duration, attempt number, goal, and
available validated summaries in session memory. Retain the previous goal across
retry while clearing capture/current feedback. Compare both transcripts and goal
through Gemini; validate the comparison contract before display.

**Acceptance:** two answers to the same question show evidence-supported progress,
remaining ambiguity, goal coverage, and one further suggestion; no invented gains
or arbitrary confidence scores. Comparison failure preserves individual feedback.
Duration/word count are descriptive; pace requires reliable timing/transcription.

### E — Small question bank and meaningful modes

Generalize the current literal question type with identifier, text, category,
difficulty, and optional tags. Add several behavioral/technical questions, simple
mode/question selection, and backend-validated context with different evaluation
rubrics. Keep retry on the same question; avoid excessive configuration screens.

**Acceptance:** at least two modes and multiple questions complete the existing
workflow; analysis uses the selected rubric; changing questions/modes cannot mix
attempts or accept stale feedback. Presentation mode/follow-ups may follow later.

### G/H/J — Integrated reliability and hackathon demonstration

Exercise mode selection, optional baseline, ElevenLabs audio, recording/review,
Gemini feedback, separate measurements, guided retry, and attempt comparison.
Test unavailable providers/devices, unsupported media, malformed responses, quota,
network/timeout, cancellation, late responses, and navigation cleanup. Check
keyboard controls and narrow layouts. Avoid logs/persistence of sensitive media.

**Acceptance:** repeat the complete two-attempt flow without manual repair, with
each provider failing independently and an audio-only path available. Verify
credentials remain private, upload/duration limits hold, and microphone/camera
release. Prepare a concise demo and clearly labeled backup recording of an actual
working session; never present fabricated output as real.

## Presage research and architecture gate

Official docs and npm metadata reviewed on the audit date list
`@smartspectra/node-sdk` **3.4.0**, Windows x64, Node **20+** (24 recommended), and
Electron **28+**. The package ships an FFI binding and native platform runtimes;
installation can download several hundred MB across platforms. These are research
findings, not proof of hardware/runtime compatibility.

Native Node supports camera discovery/capture or custom frames. Electron's
renderer entry point needs its main/preload bridge; it is not a standalone browser
SDK. Request cardio/pulse explicitly; default metrics are breathing. Account
provisioning may restrict cardio. Measurements are documented as on-device;
network authentication/subscription validation is required and aggregate telemetry
defaults on (configurable). The SDK is proprietary under Presage's terms.

| Option | Benefits | Implications |
| --- | --- | --- |
| A: React browser + local Node sensing service | Preserves current frontend/backend; documented native Windows camera path; keeps keys server-side. Separate sensing process can isolate native failures. | Explicit UI opt-in and OS permission handling: native capture does not produce a browser permission prompt. Needs measurement/control transport and shared-source preview; avoid two camera captures. |
| B: Electron + reusable React UI | Official reference app, renderer-owned MediaStream/preview, supported IPC path. | Adds launch/packaging and native-resource work. Packaged pages need an API strategy beyond Vite's relative `/api` proxy. Keep keys in the private host/main process rather than copying sample renderer credentials. |

**Provisional preference: A**, subject to C's actual-machine test. If the required
permission/preview flow makes A unreliable or more complex, reevaluate B rather
than forcing an unsupported browser integration. No architecture has been selected.

Pulse is documented with an approximately 12-second window; breathing guidance
states 30 seconds, while linked model-card guidance differs on windows/ranges.
Reconcile version-specific rules before shipping. Confidence/stability/validation
must travel with readings; do not invent a universal confidence cutoff. Talking,
motion, lighting, and framing can invalidate data even with high confidence.
Exclude stress indices, expression interpretation, and medical judgments from MVP.

Research references (recheck at integration time):

- [Node/Electron SDK](https://smartspectra.presagetech.com/docs/nodejs)
- [Official Electron example](https://github.com/Presage-Security/SmartSpectra/tree/main/nodejs/samples/electron-quickstart)
- [Metrics](https://smartspectra.presagetech.com/docs/nodejs/metrics)
- [Measurement quality](https://smartspectra.presagetech.com/docs/measurement-quality)
- [Model cards/limitations](https://smartspectra.presagetech.com/docs/model-cards-and-limitations)
- [Telemetry/privacy](https://smartspectra.presagetech.com/docs/telemetry-and-privacy)
- [SDK license](https://github.com/Presage-Security/SmartSpectra/blob/main/LICENSE)
- [Presage terms](https://physiology.presagetech.com/tos) (full terms not verified in the audit)
- [Google GenAI SDK](https://github.com/googleapis/js-genai)
- [ElevenLabs official JavaScript SDK](https://github.com/elevenlabs/elevenlabs-js)

## Known risks and blockers

- Live A acceptance needs a microphone/browser, configured Gemini access, and an
  actual speech recording. Offline tests cannot establish semantic correctness.
- Recording currently has no duration limit; 8 MiB upload bounds do not cap capture
  memory. Silence behavior is prompt-driven and needs real-provider verification.
- Safari MP4 is locally playable but explicitly rejected by the Gemini adapter;
  no transcoding exists. Prioritize Chrome/Edge WebM for the demo.
- Browser recording/hooks, accessibility, and media cleanup lack automated browser
  coverage. Verify manually first; add focused coverage for meaningful new behavior.
- Previous attempts/goals are discarded, and the question type is tied to a single
  literal. Extend these narrowly in F/E, not with a broad state-management rewrite.
- Presage needs an API key, cardio entitlement, compatible webcam/lighting/FPS,
  resolved quality rules, and confirmed license/usage access. Sensing remains blocked
  on C, not on speculation about browser support.
- Voice access/quota and capture/playback turn-taking must be verified before B is
  complete. Neither provider failure may discard the user's recording.
- At audit time the Gemini/backend/shared/tests work was modified or untracked.
  Preserve it; establish a reviewed verified baseline so teammates receive it.

## Team work boundaries and handoff

Parallel work requires separately approved scopes and agreed contracts:

- **Frontend/integration:** component UI, playback interlocks, guided retry, session
  coordination. Assign one owner to `PracticeScreen.tsx` and app-level wiring.
- **AI/voice:** ElevenLabs service/endpoint, later comparison and mode-specific
  Gemini evaluation. Preserve the existing answer-analysis path.
- **Sensing:** independent C test, camera lifecycle, quality filtering, transport.
  This can overlap A or B while remaining outside the application.

Coordinate shared edits to server routing/configuration, contracts, package files,
and styles; agree transport/result shapes before integrating. Use feature branches
and small PRs when collaboration begins. No Docker, database, cloud infrastructure,
or elaborate CI is needed without a concrete requirement.

After each milestone, record changed files, exact checks/evidence, blockers, and
next steps here. Recommend a small commit once verified; commit only when asked.
**Next application milestone: A.** Documentation is complete; no new application
features have been implemented as part of this documentation task.
