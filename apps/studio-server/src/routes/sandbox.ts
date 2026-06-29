import { Router, type Request, type Response } from 'express';

export const sandboxRouter = Router();

interface SandboxRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string | null;
  timeoutMs?: number;
}

/**
 * Universal HTTP tester.
 * POST /ctrl/sandbox/request
 * body: { method, url, headers?, body?, timeoutMs? }
 */
sandboxRouter.post('/request', async (req: Request, res: Response) => {
  const { method, url, headers, body, timeoutMs } = (req.body ?? {}) as SandboxRequest;

  if (!method || !url) {
    res.status(400).json({ error: 'method and url are required' });
    return;
  }
  if (!/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: 'url must start with http:// or https://' });
    return;
  }

  const timeout = Math.max(50, Math.min(60_000, Number(timeoutMs ?? 10_000)));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);

  const t0 = Date.now();
  try {
    const init: RequestInit = {
      method,
      headers: headers ?? {},
      body: body ?? undefined,
      signal: ctrl.signal,
    };
    const upstream = await fetch(url, init);

    const buf = Buffer.from(await upstream.arrayBuffer());
    const respHeaders: Record<string, string> = {};
    upstream.headers.forEach((v, k) => {
      respHeaders[k] = v;
    });

    res.json({
      ok: upstream.ok,
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders,
      body: buf.toString('utf8'),
      bytes: buf.length,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message, durationMs: Date.now() - t0 });
  } finally {
    clearTimeout(timer);
  }
});

/** GET /ctrl/sandbox/health — quick proxy health listing */
sandboxRouter.get('/targets', (_req, res) => {
  res.json({
    targets: [
      { name: 'OmniVoice', base: 'http://127.0.0.1:3900', sample: '/system/info' },
      { name: 'Lottie', base: 'http://127.0.0.1:3030', sample: '/__context' },
      { name: 'studio/server', base: 'http://127.0.0.1:4100', sample: '/ctrl/health' },
    ],
  });
});