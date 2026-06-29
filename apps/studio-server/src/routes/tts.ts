import { Router } from 'express';

/**
 * Thin proxy to the OmniVoice FastAPI service (:3900). The editor's Voice panel
 * talks only to these endpoints so it never needs to know OmniVoice internals,
 * and degrades gracefully when the service is down.
 */

export const ttsRouter = Router();

const OMNI = process.env.OMNIVOICE_URL ?? 'http://127.0.0.1:3900';

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await p(ac.signal);
  } finally {
    clearTimeout(timer);
  }
}

// GET /ctrl/tts/status — is OmniVoice reachable?
ttsRouter.get('/status', async (_req, res) => {
  try {
    const r = await withTimeout(
      (signal) => fetch(`${OMNI}/system/info`, { signal }),
      2500,
    );
    if (!r.ok) {
      res.json({ up: false, error: `HTTP ${r.status}` });
      return;
    }
    const info = await r.json().catch(() => null);
    res.json({ up: true, info });
  } catch (e) {
    res.json({ up: false, error: (e as Error).message });
  }
});

// GET /ctrl/tts/voices — map OmniVoice profiles → {id,name}
ttsRouter.get('/voices', async (_req, res) => {
  const voices: { id: string; name: string }[] = [{ id: '', name: 'Голос по умолчанию' }];
  try {
    const r = await withTimeout((signal) => fetch(`${OMNI}/profiles`, { signal }), 3000);
    if (r.ok) {
      const data = (await r.json()) as unknown;
      const arr = Array.isArray(data)
        ? data
        : Array.isArray((data as { profiles?: unknown[] })?.profiles)
          ? (data as { profiles: unknown[] }).profiles
          : [];
      for (const p of arr as Record<string, unknown>[]) {
        const id = String(p.id ?? p.profile_id ?? p.name ?? '');
        const name = String(p.name ?? p.label ?? p.title ?? id);
        if (id) voices.push({ id, name });
      }
    }
  } catch {
    /* return at least the default */
  }
  res.json({ voices });
});

// POST /ctrl/tts/generate  body: { text, language?, profile_id?, speed? } → audio/wav bytes
ttsRouter.post('/generate', async (req, res) => {
  const { text, language, profile_id, speed } = req.body ?? {};
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'missing text' });
    return;
  }
  try {
    const form = new FormData();
    form.set('text', text);
    if (language) form.set('language', String(language));
    if (profile_id) form.set('profile_id', String(profile_id));
    if (speed) form.set('speed', String(speed));

    const r = await withTimeout(
      (signal) => fetch(`${OMNI}/generate`, { method: 'POST', body: form, signal }),
      120_000,
    );
    if (!r.ok || !r.body) {
      const msg = await r.text().catch(() => `HTTP ${r.status}`);
      res.status(502).json({ error: `OmniVoice: ${msg.slice(0, 300)}` });
      return;
    }
    res.setHeader('Content-Type', r.headers.get('content-type') ?? 'audio/wav');
    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (e) {
    res.status(502).json({ error: `OmniVoice unreachable: ${(e as Error).message}` });
  }
});
