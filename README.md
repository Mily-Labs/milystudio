# MilyStudio

> Локальная медиа-студия: видео, голос, motion graphics — в одной панели управления.
> A local media studio: video, voice, motion graphics — under one control panel.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node ≥ 20](https://img.shields.io/badge/node-%E2%89%A520-339933)](https://nodejs.org)

---

## 🇷🇺 Что это

**MilyStudio** — монорепо из четырёх независимых модулей для локальной работы с медиа. Каждый модуль запускается отдельно, а модуль `studio/` поднимает их как подпроцессы и даёт единый веб-интерфейс для управления, логов и API.

| Модуль | Что делает | Стек | Порт |
| --- | --- | --- | --- |
| [`ffmpeg/`](./ffmpeg) | Физическая обработка медиа: транскод, субтитры, whisper-воркер | Node.js + `ffmpeg.exe` | — |
| [`OmniVoice/`](./OmniVoice) | TTS, клонирование голоса, ASR (WhisperX), дубляж | Python + bun + FastAPI | `:3900` |
| [`text-to-lottie/`](./text-to-lottie) | Генерация и плеер Lottie-анимаций (Bodymovin) | SolidJS + Skia/Skottie | `:3030` |
| [`studio/`](./studio) | **Оркестратор** — Node control-сервер + React SPA | Node + Express + React/Vite | `:4100` |

Все модули — **MIT**, можно форкать и использовать по отдельности.

---

## 🇬🇧 What is this

**MilyStudio** is a monorepo of four independent modules for local media work. Each module runs on its own; `studio/` orchestrates them as child processes and gives you a single web UI for control, live logs, and API access.

| Module | Does | Stack | Port |
| --- | --- | --- | --- |
| [`ffmpeg/`](./ffmpeg) | Physical media processing: transcode, subtitles, whisper worker | Node.js + `ffmpeg.exe` | — |
| [`OmniVoice/`](./OmniVoice) | TTS, voice cloning, ASR (WhisperX), dubbing pipeline | Python + bun + FastAPI | `:3900` |
| [`text-to-lottie/`](./text-to-lottie) | Lottie animation generation + player (Bodymovin) | SolidJS + Skia/Skottie | `:3030` |
| [`studio/`](./studio) | **Orchestrator** — Node control server + React SPA | Node + Express + React/Vite | `:4100` |

All modules are **MIT** — fork and use individually.

---

## 🚀 Quick Start / Быстрый старт

### Prerequisites / Зависимости

| Tool | Why | Install |
| --- | --- | --- |
| **Node.js ≥ 20** | `ffmpeg/`, `text-to-lottie/`, `studio/` | <https://nodejs.org> |
| **bun** | `OmniVoice/` runtime | `npm i -g bun` |
| **uv + Python 3.10+** | `OmniVoice/` (WhisperX, TTS) | `pip install uv` |
| **ffmpeg.exe** | Should live at `ffmpeg/ffmpeg.exe` (override with `FFMPEG_PATH`) | <https://ffmpeg.org> |

### Install / Установка

```bash
# 1. Subsystems / подсистемы
npm --prefix ffmpeg install
npm --prefix text-to-lottie install     # postinstall копирует canvaskit.wasm

# 2. OmniVoice (one-time)
cd OmniVoice && uv sync && bun run setup:api && cd ..

# 3. Studio
npm --prefix studio install
```

### Run / Запуск

```bash
# Dev: orchestrator :4100 + SPA :5174
npm --prefix studio run dev

# Production: single port :4100 serves both API and built SPA
npm --prefix studio run build
npm --prefix studio start
```

Open <http://localhost:4100> (prod) or <http://localhost:5174> (dev) → in the **Run** tab start `omniVoice` and `lottie`, then explore the other tabs.

Откройте <http://localhost:4100> (prod) или <http://localhost:5174> (dev) → на вкладке **Run** запустите `omniVoice` и `lottie`, дальше — остальные вкладки.

---

## 🗺 Port Map / Карта портов

| Port | Service | Started by |
| --- | --- | --- |
| `4100` | `studio/` orchestrator (API + prod SPA) | `npm --prefix studio start` |
| `5174` | `studio/web/` Vite dev server | `npm --prefix studio run dev:web` |
| `3900` | `OmniVoice/` API | `bun run dev` (from `OmniVoice/`) |
| `3030` | `text-to-lottie/` dev server | `npm run dev` (from `text-to-lottie/`) |

---

## 📚 Tabs in `studio/` UI / Вкладки в `studio/`

| Tab | What | Backend |
| --- | --- | --- |
| **Run** | Launch / stop / restart any subsystem, live logs | `studio/server` |
| **OmniVoice** | Generate speech, manage profiles, transcribe, dub | proxied to `:3900` |
| **Lottie** | Scene tree, current context, JSON edit | proxied to `:3030` |
| **ffmpeg** | Video info, subtitles, whisper, transcode | `ffmpeg/` helpers |
| **API Sandbox** | Universal HTTP tester across all backends | direct fetch |
| **Skills** | Install guides: text-to-lottie skill + OmniVoice MCP | docs |

Полный список эндпоинтов оркестратора — в [`studio/README.md`](./studio/README.md).

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Issues and PRs welcome.

## 📜 License

[MIT](./LICENSE) — Copyright (c) 2026 MilyStudio.
