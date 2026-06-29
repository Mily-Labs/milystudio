<div align="center">

<img src="docs/logo.png" alt="MilyStudio" width="116" height="116" />

# MilyStudio

**A local, self-hosted creative-AI workspace — video, voice, and motion graphics under one roof.**
_Локальная медиа-студия: видео, голос и motion graphics в одной панели._

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node ≥ 20](https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev)
[![SolidJS](https://img.shields.io/badge/SolidJS-2C4F7C?logo=solid&logoColor=white)](https://www.solidjs.com)
[![Tauri](https://img.shields.io/badge/Tauri-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?logo=ffmpeg&logoColor=white)](https://ffmpeg.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## What is this

**MilyStudio** is a monorepo of independent, self-hostable services for media creation —
AI dubbing & voice, Lottie motion graphics, transcription, and FFmpeg processing — tied
together by a single orchestrator UI that launches them, streams their logs, and proxies
their APIs. Everything runs **locally**; each service also works standalone.

| Subsystem | What it does | Stack |
|---|---|---|
| [`apps/studio-server`](apps/studio-server) | **Orchestrator** — launches/stops services, live logs, API proxy | Node + Express |
| [`apps/studio-web`](apps/studio-web) | **Studio UI** — one panel for every subsystem | React + Vite |
| [`services/omnivoice`](services/omnivoice) | AI **dubbing studio** — TTS, voice cloning, ASR (WhisperX), dubbing pipeline | Python · FastAPI · React · Tauri |
| [`services/text-to-lottie`](services/text-to-lottie) | **Lottie** generation + Skia/Skottie player (Bodymovin) | SolidJS · CanvasKit-WASM |
| [`services/whisper`](services/whisper) | Word-level **transcription** worker | Node + Whisper |
| [`services/ffmpeg-worker`](services/ffmpeg-worker) | Media processing: transcode, scaling, subtitles (`.ass`) | Node + `ffmpeg.exe` |

It also ships an agent skill in [`.agents/skills/text-to-lottie`](.agents/skills/text-to-lottie)
— published standalone at **[Mily-Labs/agent-skills](https://github.com/Mily-Labs/agent-skills)**.

---

## Quick start

**Prerequisites:** Node ≥ 20. For `services/omnivoice`: Python 3.10+ with [`uv`](https://github.com/astral-sh/uv)
and [`bun`](https://bun.sh). For FFmpeg work: `ffmpeg` on PATH (or set `FFMPEG_PATH`).

```bash
# install the orchestrator + UI workspaces
npm run install:all

# dev: orchestrator (:4100) + studio UI (:5174)
npm run dev
```

Open <http://localhost:5174> → the **Run** tab starts each service; the other tabs drive
OmniVoice, Lottie, FFmpeg, and a universal API sandbox.

```bash
# production: build the UI, serve everything from the orchestrator on :4100
npm run build && npm start
```

Each service can also be run on its own — see its folder's README
(e.g. [`services/omnivoice/README.md`](services/omnivoice/README.md),
[`services/text-to-lottie/README.md`](services/text-to-lottie/README.md)).

---

## Port map

| Port | Service |
|---|---|
| `4100` | `apps/studio-server` — orchestrator API (+ prod UI) |
| `5174` | `apps/studio-web` — Vite dev server |
| `3030` | `services/text-to-lottie` — Skottie player dev server |
| `3900` | `services/omnivoice` — dubbing API |

---

## Repository layout

```
milystudio/
├── apps/
│   ├── studio-server/     # orchestrator (Express) — launches services, logs, proxy
│   └── studio-web/        # studio UI (React + Vite)
├── services/
│   ├── omnivoice/         # AI dubbing studio (FastAPI backend + React/Tauri frontend)
│   ├── text-to-lottie/    # Skia/Skottie Lottie player & generator
│   ├── whisper/           # transcription worker
│   └── ffmpeg-worker/     # media processing (transcode, subtitles)
├── packages/              # shared workspace packages
└── .agents/skills/        # text-to-lottie agent skill (also on Mily-Labs/agent-skills)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design and [AI_RULES.md](AI_RULES.md) for
the coding conventions used across subsystems.

---

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © 2026 MilyStudio.
