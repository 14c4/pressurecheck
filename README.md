# PressureCheck

A local interview-practice prototype built with React, TypeScript, and Vite.

## Current prototype

Current build provides real microphone recording and playback in a call-style
interview workspace. The homepage and Home/Practice navigation are preserved.

The workflow has four states:

1. **Ready:** question above the interview stage; Start Recording requests microphone access.
2. **Recording:** active indicator, elapsed timer, and Stop Recording control.
3. **Review:** play the actual recording, discard it to start over, or submit.
4. **Feedback:** a separate results view with explicitly labeled sample feedback.

Gemini is not connected. Submission does not upload or analyze audio. The user's
transcription is shown as unavailable; a separate written example demonstrates
the eventual feedback layout. Try Again clears the recording and returns to Ready.

The central stage reserves space for a future webcam preview, but only microphone
audio is captured. Live Signals remains a smaller placeholder with unavailable
values. Voice playback, ElevenLabs, Presage, and camera capture are not implemented.

Recordings stay in memory in the current tab. They are cleared when discarded,
when choosing Try Again, when leaving Practice, or when reloading/closing the page.
The browser releases microphone tracks after Stop Recording or navigation.

## Run locally

Use Node.js 24 LTS and npm. From the project directory:

```powershell
npm install
npm run dev
```

Open the local address printed by Vite (normally `http://localhost:5173`).
Stop the development server with `Ctrl+C`.

## Checks

```powershell
npm run build
npm run lint
```

The build runs TypeScript checks and generates the production app in `dist/`.
Lint uses Oxlint, included in the Vite React–TypeScript starter.

To serve the production build locally after building:

```powershell
npm run preview
```

### Test recording, review, and retry

Use Chrome or Edge on Windows for the initial demo, with a connected microphone.
Open the `localhost` URL; microphone access otherwise requires HTTPS.

1. Open the homepage and select **Start Practice**. Confirm the question is above
   the recording workspace, with Live Signals beside it and no feedback section.
2. Select **Start Recording** and allow microphone access. Camera permission
   should never be requested. Confirm the Recording indicator and timer appear.
3. Speak for 5–10 seconds, then select **Stop Recording**. Confirm Review appears,
   the timer freezes, and the browser/OS active microphone indicator turns off.
   A site-permission icon may remain because permission is still granted.
4. Play the audio using the native playback controls. Verify the beginning and
   end of your answer are present. Test pause and seeking if the browser supports it.
5. Select **Discard & Rerecord**. Confirm the old recording disappears, the timer
   resets, and Start Recording is available. Record another short answer.
6. Stop, then select **Submit for Analysis**. Confirm only the feedback results
   view appears. The notice must state that no actual analysis occurred. Your
   transcription stays unavailable, and the written example is not your transcript.
7. Select **Try Again**. Confirm Ready returns with the same question, `00:00`,
   and no old audio. Repeat the full workflow.
8. Start recording and navigate **Home**. Confirm microphone capture stops.
   Return to Practice and verify the recording is gone.
9. Check keyboard navigation with Tab/Enter and a narrow mobile viewport. The
   panels should stack in the order: question, recording, Live Signals.

### Permission and device failures

- Block microphone access in the browser's site settings, then try recording.
  Confirm the permission error is actionable. Re-enable access and retry.
- If the browser shows a permission prompt, select **Cancel waiting**, then grant
  permission. No recording should begin from that abandoned request. The browser
  prompt itself cannot be programmatically dismissed by this application.
- While waiting for permission, navigate Home and then allow access. Any late
  microphone stream must be stopped immediately, without starting a recording.
- If possible, disconnect the microphone while recording. Review any captured
  audio, or use the displayed error and retry; the timer must not keep running.
- Try another current browser. The recorder chooses a supported audio MIME type
  at runtime (WebM/Opus, MP4, Ogg, or the browser default) instead of hardcoding it.
  Playback duration/seeking behavior can differ between recording formats.

Navigation is held in React state, rather than in URLs. Browser Back/Forward does
not switch these screens. Refreshing intentionally starts on Home.

## Important files

```text
src/
├── main.tsx                      # Mounts React and loads shared styles
├── App.tsx                       # Shared layout and Home/Practice screen state
├── styles.css                    # Dark theme, responsive layout, focus styles
├── components/
│   ├── HomeScreen.tsx             # Homepage and Start Practice button
│   ├── PracticeScreen.tsx         # Question, workspace layout, return navigation
│   ├── RecordingPanel.tsx         # Call-style stage, state controls, native playback
│   ├── LiveSignalsPanel.tsx       # Unavailable camera and measurement placeholders
│   ├── FeedbackPanel.tsx          # Data-driven results and Try Again control
│   └── Icon.tsx                   # Small shared SVG icons, no icon dependency
├── data/
│   ├── question.ts               # Single source for question content and type
│   └── mockFeedback.ts           # Fixed written example, never generated from audio
├── hooks/
│   └── useAudioRecorder.ts        # Permissions, MediaRecorder, timer, Blob/URL cleanup
└── types/
    └── session.ts                # Recorded-answer and future feedback contracts
```

The screen components receive data and navigation callbacks from `App.tsx`.
They do not need to know how navigation is stored. The question is defined once
and shared by both screens.

`PracticeScreen.tsx` owns the workflow and passes recorder state/actions into
`RecordingPanel.tsx`. `useAudioRecorder.ts` finalizes audio only after the final
MediaRecorder data event, stops microphone tracks, ignores abandoned permission
requests, and revokes playback URLs during cleanup. Playback is paused when leaving
Review. `LiveSignalsPanel.tsx` remains purely presentational.

`FeedbackPanel.tsx` accepts an `AnswerFeedback` object rather than importing mock
data itself. A later Gemini integration can provide real results using the same
layout. Sample data has `source: 'sample'` and `transcript: null`.

`vite.config.ts` configures the React development/build integration;
`tsconfig*.json` enables strict TypeScript checking; `.oxlintrc.json` configures lint
rules; `package.json` defines scripts and dependencies. `package-lock.json` records
the installed dependency versions.
