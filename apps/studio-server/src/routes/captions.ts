import { Router, raw } from 'express';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Auto-subtitles via the LOCAL Whisper subsystem (../../../../whisper) — fully
 * offline, no OmniVoice required. The browser POSTs media bytes (octet-stream);
 * we transcribe and return the SRT.
 */

export const captionsRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/studio-server/src/routes → repo root
const ROOT = path.resolve(__dirname, '../../../..');
const WHISPER_CLI = path.resolve(ROOT, 'services', 'whisper', 'cli.mjs');
const FFMPEG_DIR = path.resolve(ROOT, 'services', 'ffmpeg-worker');

function runNode(args: string[], timeoutMs: number): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => p.kill(), timeoutMs);
    p.stdout.on('data', (b: Buffer) => (stdout += b.toString('utf8')));
    p.stderr.on('data', (b: Buffer) => (stderr += b.toString('utf8')));
    p.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: String(e) });
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

// GET /ctrl/captions/status — is local Whisper available?
captionsRouter.get('/status', async (_req, res) => {
  if (!fs.existsSync(WHISPER_CLI)) {
    res.json({ up: false, error: 'whisper subsystem missing' });
    return;
  }
  const r = await runNode([WHISPER_CLI, '--check'], 15_000);
  res.json({ up: r.stdout.trim() === 'ok', engine: 'whisper-local' });
});

// POST /ctrl/captions/transcribe?name=clip.mp4&model=small&lang=ru  (octet-stream body)
captionsRouter.post('/transcribe', raw({ type: () => true, limit: '600mb' }), async (req, res) => {
  const buf = req.body as Buffer;
  if (!buf || !buf.length) {
    res.status(400).json({ error: 'empty body' });
    return;
  }
  const name = String(req.query.name ?? 'audio.wav');
  const model = String(req.query.model ?? 'small');
  const lang = req.query.lang ? String(req.query.lang) : '';
  const ext = path.extname(name) || '.wav';

  const tmp = path.join(os.tmpdir(), `mily-src-${process.pid}-${Date.now()}${ext}`);
  try {
    fs.writeFileSync(tmp, buf);
    const args = [WHISPER_CLI, tmp, '--model', model, '--ffmpeg-dir', FFMPEG_DIR];
    if (lang) args.push('--lang', lang);
    const r = await runNode(args, 1_800_000); // up to 30 min (first run downloads model)
    if (r.code !== 0 || !r.stdout.trim()) {
      res.status(500).json({ error: `Whisper: ${(r.stderr || 'no output').slice(0, 400)}` });
      return;
    }
    res.json({ srt: r.stdout, engine: 'whisper-local' });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
});
