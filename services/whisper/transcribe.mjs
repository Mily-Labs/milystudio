import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Local Whisper ASR subsystem. Wraps the installed `openai-whisper` Python CLI
 * (`python -m whisper`) to turn an audio/video file into SRT subtitles —
 * fully offline, no OmniVoice / network required.
 */

const PYTHON = process.env.WHISPER_PYTHON || process.env.PYTHON_BIN || 'python';

export const WHISPER_MODELS = ['tiny', 'base', 'small', 'medium', 'large', 'turbo'];

/**
 * @param {string} inputPath absolute path to an audio/video file
 * @param {{model?:string, language?:string|null, ffmpegDir?:string|null}} opts
 * @returns {Promise<string>} SRT text
 */
export async function transcribeToSrt(inputPath, opts = {}) {
  const model = WHISPER_MODELS.includes(opts.model) ? opts.model : 'small';
  const language = opts.language && opts.language !== 'auto' ? opts.language : null;
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mily-whisper-'));

  const args = [
    '-X', 'utf8',
    '-m', 'whisper',
    inputPath,
    '--model', model,
    '--output_format', 'srt',
    '--output_dir', outDir,
    '--verbose', 'False',
  ];
  if (language) args.push('--language', language);

  const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
  // Whisper decodes audio via ffmpeg — make our bundled ffmpeg discoverable.
  if (opts.ffmpegDir) env.PATH = `${opts.ffmpegDir}${path.delimiter}${env.PATH ?? ''}`;

  await run(PYTHON, args, env);

  const base = path.basename(inputPath, path.extname(inputPath));
  const srtPath = path.join(outDir, `${base}.srt`);
  if (!fs.existsSync(srtPath)) {
    safeRm(outDir);
    throw new Error('Whisper finished but produced no SRT file');
  }
  const srt = fs.readFileSync(srtPath, 'utf8');
  safeRm(outDir);
  return srt;
}

/** Quick availability probe: is the whisper Python module importable? */
export async function checkWhisper() {
  try {
    await run(PYTHON, ['-c', 'import whisper'], { ...process.env, PYTHONIOENCODING: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env, windowsHide: true });
    let err = '';
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`whisper exited ${code}: ${err.slice(-600)}`)),
    );
  });
}

function safeRm(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
