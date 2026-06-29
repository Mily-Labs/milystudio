#!/usr/bin/env node
import { transcribeToSrt, checkWhisper, WHISPER_MODELS } from './transcribe.mjs';

/**
 * CLI: node cli.mjs <input> [--model small] [--lang ru] [--ffmpeg-dir <dir>]
 *      node cli.mjs --check   → prints "ok" if whisper is importable, else "no"
 * Prints the SRT to stdout. Used by the studio orchestrator and standalone.
 */

const argv = process.argv.slice(2);

if (argv[0] === '--check') {
  const ok = await checkWhisper();
  process.stdout.write(ok ? 'ok' : 'no');
  process.exit(ok ? 0 : 1);
}

const input = argv[0];
if (!input || input.startsWith('--')) {
  process.stderr.write(`usage: cli.mjs <input> [--model ${WHISPER_MODELS.join('|')}] [--lang xx] [--ffmpeg-dir DIR]\n`);
  process.exit(2);
}
const get = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};

try {
  const srt = await transcribeToSrt(input, {
    model: get('--model') ?? 'small',
    language: get('--lang') ?? null,
    ffmpegDir: get('--ffmpeg-dir') ?? null,
  });
  process.stdout.write(srt);
} catch (e) {
  process.stderr.write(String(e?.message ?? e) + '\n');
  process.exit(1);
}
