# PressureCheck contributor guide

PressureCheck is an existing hackathon interview/presentation coaching app.
Preserve its recording → submission → Gemini feedback → retry workflow.
Read [docs/ROADMAP.md](docs/ROADMAP.md) before planning or implementing work;
it is the source of truth for status, priorities, acceptance criteria, and risks.
Use [README.md](README.md) for installation, configuration, and local checks.

## Stack and boundaries

- React 19 + TypeScript 6 + Vite 8 frontend; Node.js 24 backend running TypeScript
  directly; npm; Oxlint; Node's built-in test runner.
- `src/components/`: UI; `src/hooks/`: recording and request lifecycle;
  `src/services/`: browser HTTP requests; `src/types/`: frontend types.
- `server/routes/`: upload parsing; `server/services/`: analysis boundary;
  `server/providers/`: existing official `@google/genai` integration.
- `shared/analysis.ts`: shared response contract, schema, limits, and runtime
  validation. Validate external results before display.
- Home/Practice navigation uses React state. Audio is held in memory; there is
  no database. ElevenLabs, browser speech fallback, and Presage are planned.

## Working conventions

- Inspect existing code and user changes first. Preserve the Gemini integration;
  make small, justified changes rather than rebuilding completed components.
- Implement one explicitly approved milestone at a time. Roadmap approval alone
  does not authorize implementing every milestone.
- Follow surrounding TypeScript/React style: function components, reusable hooks,
  explicit types, type-only imports, single quotes, and no unnecessary dependencies.
  Backend/shared Node imports use explicit `.ts` extensions.
- Keep analysis, voice, and sensing modular. Keep keys in backend environment
  configuration, never React, `VITE_*` variables, browser bundles, or logs.
- Preserve original recording formats, recoverable-error playback, duplicate
  submission guards, stale-response protection, and media/request cleanup.
- Require explicit camera opt-in. Keep validated physiological summaries separate
  from communication evaluation; never infer anxiety, confidence, honesty, medical
  conditions, or interview quality from those signals. Never fake provider output.
- Consult current official SDK documentation before integration work. Presage's
  Windows/camera/entitlement test must precede its architecture selection.
- Avoid broad refactors, realtime interviewing, accounts, persistence, deployment
  infrastructure, or specialist delegation without a concrete approved need.

## Verification and handoff

- For application changes, run relevant tests plus `npm test`, `npm run lint`, and
  `npm run build`. Add meaningful tests for new behavior; avoid redundant tests.
- Offline tests do not verify live Gemini, microphone, camera, or provider access.
  Live tests send audio/use quota; follow README's explicit opt-in instructions.
- For documentation-only work, review accuracy/links and run `git diff --check`;
  application checks need not be repeated without a relevant code change.
- Report files changed, checks actually performed, remaining blockers, and next
  work. Update roadmap status only with evidence; label unverified/user-reported
  behavior explicitly. Recommend a small commit after verified milestones, but
  commit/push/create PRs only when requested and stage only intended files.
