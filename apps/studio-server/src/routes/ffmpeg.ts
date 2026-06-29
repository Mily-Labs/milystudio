import { Router } from 'express';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { FFMPEG_BIN, FFMPEG_DIR } from '../config.js';

export const ffmpegRouter = Router();

// GET /ctrl/ffmpeg/info?path=<absolute file path>
ffmpegRouter.get('/info', (req, res) => {
  const file = String(req.query.path ?? '').trim();
  if (!file) {
    res.status(400).json({ error: 'missing ?path=' });
    return;
  }
  if (!fs.existsSync(file)) {
    res.status(404).json({ error: 'file not found', path: file });
    return;
  }
  runFfprobe(file, res);
});

function runFfprobe(file: string, res: import('express').Response): void {
  const proc = spawn(FFMPEG_BIN, ['-hide_banner', '-i', file], { windowsHide: true });
  let stderr = '';
  proc.stderr.on('data', (b: Buffer) => {
    stderr += b.toString('utf8');
  });
  proc.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
  proc.on('close', (code) => {
    // ffprobe-via-ffmpeg always exits with code 1, but prints metadata on stderr.
    if (code !== null && code !== 1 && code !== 0) {
      res.status(500).json({ error: `ffmpeg exited ${code}`, stderr });
      return;
    }
    res.json({ ok: true, file, raw: stderr });
  });
}

// POST /ctrl/ffmpeg/probe   body: { args: string[] }
ffmpegRouter.post('/probe', (req, res) => {
  const args = Array.isArray(req.body?.args) ? (req.body.args as string[]) : [];
  if (args.length === 0) {
    res.status(400).json({ error: 'missing args[]' });
    return;
  }
  const proc = spawn(FFMPEG_BIN, ['-hide_banner', ...args], { windowsHide: true });
  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (b: Buffer) => (stdout += b.toString('utf8')));
  proc.stderr.on('data', (b: Buffer) => (stderr += b.toString('utf8')));
  proc.on('error', (err) => res.status(500).json({ error: err.message }));
  proc.on('close', (code) => {
    res.json({ code, stdout, stderr });
  });
});

// GET /ctrl/ffmpeg/bin
ffmpegRouter.get('/bin', (_req, res) => {
  res.json({
    bin: FFMPEG_BIN,
    exists: fs.existsSync(FFMPEG_BIN),
    ffmpegDir: FFMPEG_DIR,
  });
});