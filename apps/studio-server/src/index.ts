import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runRouter } from './routes/run.js';
import { proxyRouter } from './routes/proxy.js';
import { ffmpegRouter } from './routes/ffmpeg.js';
import { sandboxRouter } from './routes/sandbox.js';
import { skillsRouter } from './routes/skills.js';
import { ttsRouter } from './routes/tts.js';
import { lottieRouter } from './routes/lottie.js';
import { captionsRouter } from './routes/captions.js';
import { SERVICES } from './config.js';

const PORT = Number(process.env.PORT ?? 4100);
const HOST = process.env.HOST ?? '0.0.0.0';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/studio-server/src → apps/studio-web/dist
const WEB_DIST = path.resolve(__dirname, '..', '..', 'studio-web', 'dist');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Permissive CORS — dev: Vite on :5174 → :4100; prod: same-origin.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Tiny request log (skip SSE/logs streams — too noisy).
app.use((req, _res, next) => {
  if (!req.url.includes('/ctrl/run/logs/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Health & metadata
app.get('/ctrl/health', (_req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    services: SERVICES.map((s) => s.id),
    version: '0.1.0',
  });
});

// API routes (all under /ctrl/*)
app.use('/ctrl/run', runRouter);
app.use('/ctrl/proxy', proxyRouter);
app.use('/ctrl/ffmpeg', ffmpegRouter);
app.use('/ctrl/sandbox', sandboxRouter);
app.use('/ctrl/skills', skillsRouter);
app.use('/ctrl/tts', ttsRouter);
app.use('/ctrl/lottie', lottieRouter);
app.use('/ctrl/captions', captionsRouter);

// SPA — only in production mode, when the build artifacts exist.
if (fs.existsSync(WEB_DIST) && process.env.NODE_ENV !== 'development') {
  app.use(express.static(WEB_DIST, { maxAge: '1h', index: false }));
  app.get(/^(?!\/ctrl\/).*/, (_req, res, next) => {
    const indexHtml = path.join(WEB_DIST, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      next();
    }
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      ok: true,
      mode: 'api-only',
      message:
        'studio-web build not found. Run `npm run dev` at the repo root for the SPA, or `npm run build` then `npm start`.',
      web: 'http://localhost:5174',
      api: `http://localhost:${PORT}/ctrl/health`,
    });
  });
}

const server = app.listen(PORT, HOST, () => {
  console.log(`[studio/server] listening on http://${HOST}:${PORT}`);
  console.log(
    `[studio/server] managing: ${SERVICES.map((s) => `${s.id}${s.port ? `:${s.port}` : ''}`).join(', ')}`,
  );
  if (!fs.existsSync(WEB_DIST)) {
    console.log(`[studio/server] (no built SPA at ${WEB_DIST} — API-only mode)`);
  }
});

function shutdown(signal: string): void {
  console.log(`[studio/server] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));