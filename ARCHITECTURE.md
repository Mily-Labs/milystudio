# MilyStudio — Architecture

A local-first media editor organised as an **npm-workspaces monorepo**, cleanly split
into front-of-house apps, polyglot backend services, and shared libraries. The layout
is structured so each concern can scale independently.

```
milystudio/
├─ apps/                      # user-facing applications (npm workspaces)
│  ├─ studio-web/             # React + Vite SPA — the editor UI (port 5174)
│  └─ studio-server/          # Express orchestrator + API gateway (port 4100)
├─ services/                  # independent backend subsystems (polyglot)
│  ├─ omnivoice/              # TTS / voice cloning / dubbing — Python + uv (port 3900)
│  ├─ whisper/                # local ASR (subtitles) — Node wrapper over openai-whisper
│  ├─ ffmpeg-worker/          # ffmpeg.exe + media worker
│  └─ text-to-lottie/         # Lottie generator/player app (port 3030)
├─ packages/                  # shared workspace libraries (see packages/README.md)
└─ package.json               # root: workspaces + dev/build scripts
```

## Boundaries & data flow

- **studio-web** is a pure client. It talks only to **studio-server** via `/ctrl/*`
  (Vite dev-proxies `/ctrl/*` → `127.0.0.1:4100`; in prod the server serves the SPA).
  The editor's preview/compositing/export run client-side (Canvas2D + WebAudio +
  MediaRecorder) for instant feedback.
- **studio-server** is the single gateway. It never embeds subsystem logic — it
  proxies/spawns services:
  - `/ctrl/tts/*`   → OmniVoice (`services/omnivoice`, :3900)
  - `/ctrl/captions/*` → local Whisper (`services/whisper`) using `services/ffmpeg-worker`
  - `/ctrl/lottie/*` → bundled Lottie library (served from `apps/studio-web`)
  - `/ctrl/ffmpeg/*` → `services/ffmpeg-worker/ffmpeg.exe`
  - `/ctrl/run/*`    → start/stop/health of the managed services (`config.ts` registry)
- **services/** are decoupled and independently runnable. Heavy/optional ones
  (OmniVoice on CUDA) degrade gracefully when down — the UI shows status, never crashes.

## Why this scales

- **Separation of concerns**: UI, gateway, and each capability are independent units
  with explicit contracts (HTTP). Any service can be split out, replicated, or replaced
  without touching the others.
- **Polyglot-friendly**: services are not forced into the JS workspace graph; the Python
  TTS stack and the ffmpeg binary live as first-class peers.
- **Single source of truth for wiring**: `apps/studio-server/src/config.ts` is the
  service registry (dir, command, port, health, required env).
- **Shared libraries** (`packages/`) keep cross-app code DRY and testable in isolation.

## Run

```sh
npm install            # root: installs concurrently (services manage their own deps)
npm run dev            # concurrently: studio-server (:4100) + studio-web (:5174)
```
Open http://localhost:5174. OmniVoice (optional, for voice) needs `uv` and boots via the
**Голос** panel's start button or `cd services/omnivoice && uv run uvicorn main:app --app-dir backend --port 3900`.
Subtitles use local Whisper and need no external service.
