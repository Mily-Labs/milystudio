import { Router, type Request, type Response } from 'express';
import {
  getStatus,
  listStatus,
  startService,
  stopService,
  restartService,
  subscribeLogs,
  subscribeState,
  probeHealth,
  type ProcessInfo,
} from '../processManager.js';
import { SERVICES, getService } from '../config.js';

export const runRouter = Router();

// GET /ctrl/run/services — list known services with descriptions
runRouter.get('/services', (_req, res) => {
  res.json({
    services: SERVICES.map((s) => ({
      id: s.id,
      label: s.label,
      port: s.port,
      healthUrl: s.healthUrl,
      description: s.description,
      command: s.command,
      dir: s.dir,
      envRequired: s.envRequired,
    })),
  });
});

// GET /ctrl/run/status — overall snapshot
runRouter.get('/status', (_req, res) => {
  res.json({ processes: listStatus(), ts: Date.now() });
});

// GET /ctrl/run/status/:id — single service status
runRouter.get('/status/:id', (req, res) => {
  const info = getStatus(req.params.id);
  if (!info) {
    res.status(404).json({ error: 'no run for that service' });
    return;
  }
  res.json(info);
});

// POST /ctrl/run/start/:id   body: { envOverrides?: {...} }
runRouter.post('/start/:id', (req: Request, res: Response) => {
  try {
    const overrides =
      req.body && typeof req.body === 'object' && req.body.envOverrides
        ? (req.body.envOverrides as Record<string, string>)
        : undefined;
    const info = startService(req.params.id, { envOverrides: overrides });
    res.json(info);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// POST /ctrl/run/stop/:id    body: { signal?: 'SIGTERM'|'SIGKINT'|'SIGINT' }
runRouter.post('/stop/:id', (req: Request, res: Response) => {
  const sig = (req.body?.signal as NodeJS.Signals | undefined) ?? 'SIGTERM';
  const info = stopService(req.params.id, sig);
  res.json(info);
});

// POST /ctrl/run/restart/:id
runRouter.post('/restart/:id', (req, res) => {
  const info = restartService(req.params.id);
  res.json(info);
});

// GET /ctrl/run/health/:id  — one-shot health probe
runRouter.get('/health/:id', async (req, res) => {
  const svc = getService(req.params.id);
  if (!svc) {
    res.status(404).json({ error: 'unknown service' });
    return;
  }
  const result = await probeHealth(svc);
  if (!result) {
    res.json({ serviceId: svc.id, ok: false, status: null, note: 'no health url configured' });
    return;
  }
  res.json(result);
});

// GET /ctrl/run/logs/:id  — Server-Sent Events stream of live logs
runRouter.get('/logs/:id', (req, res) => {
  const id = req.params.id;
  const svc = getService(id);
  if (!svc) {
    res.status(404).json({ error: 'unknown service' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event: string, data: unknown): void => {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      // socket already gone
    }
  };

  // Replay existing log buffer so clients see history immediately.
  const existing = listStatus().find((p) => p.serviceId === id);
  if (existing) {
    send('snapshot', existing);
  }

  const unsubLogs = subscribeLogs(id, (line) => send('log', { line, ts: Date.now() }));
  const unsubState = subscribeState(id, (info) => send('state', info));

  // Heartbeat keeps proxies from buffering the stream closed.
  const heartbeat = setInterval(() => {
    try {
      res.write(`: keep-alive ${Date.now()}\n\n`);
    } catch {
      // ignore
    }
  }, 15000);

  const cleanup = (): void => {
    clearInterval(heartbeat);
    unsubLogs();
    unsubState();
    try {
      res.end();
    } catch {
      // ignore
    }
  };

  req.on('close', cleanup);
  req.on('error', cleanup);

  // initial hello
  send('hello', { serviceId: id, ts: Date.now() });
});