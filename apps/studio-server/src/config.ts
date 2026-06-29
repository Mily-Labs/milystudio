import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

/**
 * Single source of truth for managed subsystems.
 * Paths are absolute, resolved relative to the repo root
 * (apps/studio-server/src/ → ../../../<area>/<subsystem>).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '../../..');
export const FFMPEG_DIR = path.resolve(PROJECT_ROOT, 'services', 'ffmpeg-worker');

export interface ServiceConfig {
  id: string;
  label: string;
  dir: string; // absolute path to the subsystem folder
  command: string[]; // argv for spawn
  port: number | null;
  healthUrl: string | null;
  envFile: string; // absolute path to .env (may not exist)
  envRequired: string[];
  description: { ru: string; en: string };
}

export const SERVICES: ServiceConfig[] = [
  {
    id: 'omnivoice',
    label: 'OmniVoice',
    dir: path.resolve(PROJECT_ROOT, 'services', 'omnivoice'),
    // `python -m uvicorn` (not the `uvicorn` shim) avoids stale venv script paths.
    command: ['uv', 'run', 'python', '-m', 'uvicorn', 'main:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', '3900'],
    port: 3900,
    healthUrl: 'http://localhost:3900/system/info',
    envFile: path.resolve(PROJECT_ROOT, 'services', 'omnivoice', '.env'),
    envRequired: [],
    description: {
      ru: 'TTS, клонирование голоса, ASR (WhisperX), дубляж',
      en: 'TTS, voice cloning, ASR (WhisperX), dubbing pipeline',
    },
  },
  {
    id: 'lottie',
    label: 'Lottie',
    dir: path.resolve(PROJECT_ROOT, 'services', 'text-to-lottie'),
    command: ['npm', 'run', 'dev'],
    port: 3030,
    healthUrl: 'http://localhost:3030/__context',
    envFile: path.resolve(PROJECT_ROOT, 'services', 'text-to-lottie', '.env'),
    envRequired: [],
    description: {
      ru: 'Генерация и плеер Lottie-анимаций (Bodymovin)',
      en: 'Lottie animation generator + Skottie player',
    },
  },
  {
    id: 'ffmpeg',
    label: 'ffmpeg',
    dir: path.resolve(PROJECT_ROOT, 'services', 'ffmpeg-worker'),
    command: ['npm', 'run', 'worker'],
    port: null,
    healthUrl: null,
    envFile: path.resolve(PROJECT_ROOT, 'services', 'ffmpeg-worker', '.env'),
    envRequired: ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'],
    description: {
      ru: 'Медиа-воркер: транскод, субтитры, whisper',
      en: 'Media worker: transcode, subtitles, whisper',
    },
  },
];

export function getService(id: string): ServiceConfig | undefined {
  return SERVICES.find((s) => s.id === id);
}

/**
 * Minimal .env loader (KEY=VALUE, # comments, optional quotes).
 * Returns empty object if the file does not exist.
 */
export function loadEnvFile(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  const out: Record<string, string> = {};
  const text = fs.readFileSync(envPath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

/** Path to ffmpeg.exe — overridable via FFMPEG_PATH. */
export const FFMPEG_BIN =
  process.env.FFMPEG_PATH ?? path.resolve(FFMPEG_DIR, 'ffmpeg.exe');
