# whisper — local ASR subsystem

Turns audio/video into SRT subtitles **fully offline** using the installed
`openai-whisper` Python package. A peer subsystem alongside `ffmpeg/`,
`OmniVoice/`, and `text-to-lottie/`. Used by the studio orchestrator for the
editor's **Субтитры** (auto-captions) feature — independent of OmniVoice.

## Requirements
- Python with `openai-whisper` installed (`pip install openai-whisper`).
- ffmpeg available (the bundled `../ffmpeg/ffmpeg.exe` is passed on PATH by the
  orchestrator; standalone use needs ffmpeg on PATH).

## Use
```sh
node cli.mjs path/to/media.mp4 --model small --lang ru --ffmpeg-dir ../ffmpeg > out.srt
```
Models: `tiny | base | small | medium | large | turbo` (first run downloads the
model into the Whisper cache). Env overrides: `WHISPER_PYTHON` / `PYTHON_BIN`.

## API
```js
import { transcribeToSrt, checkWhisper } from './transcribe.mjs';
const srt = await transcribeToSrt(inputPath, { model: 'small', language: 'ru', ffmpegDir });
```
