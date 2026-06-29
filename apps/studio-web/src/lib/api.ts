/** Thin client for the orchestrator REST API. */

const BASE = '/ctrl';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = body as { error?: string } | string | null;
    const msg =
      (typeof err === 'object' && err && 'error' in err && err.error) ||
      (typeof err === 'string' ? err : `HTTP ${res.status}`);
    throw new Error(String(msg));
  }
  return body as T;
}

export interface ServiceEntry {
  id: string;
  label: string;
  port: number | null;
  healthUrl: string | null;
  description: { ru: string; en: string };
  command: string[];
  dir: string;
  envRequired: string[];
}

export interface ProcessInfo {
  id: string;
  serviceId: string;
  pid: number | null;
  state: 'stopped' | 'starting' | 'running' | 'crashed' | 'stopping';
  startedAt: number | null;
  stoppedAt: number | null;
  exitCode: number | null;
  signal: string | null;
  lastError: string | null;
}

export interface HealthCheck {
  serviceId: string;
  ok: boolean;
  status: number | null;
  error: string | null;
  durationMs: number;
}

export interface SkillEntry {
  id: string;
  label: string;
  ru: string;
  en: string;
  source: string;
  install: { ru: string[]; en: string[] };
  markdown?: string | null;
}

export const api = {
  health: () => request<{ ok: boolean; ts: number; services: string[]; version: string }>('/health'),
  run: {
    services: () => request<{ services: ServiceEntry[] }>('/run/services'),
    status: () => request<{ processes: ProcessInfo[]; ts: number }>('/run/status'),
    statusOne: (id: string) => request<ProcessInfo>(`/run/status/${id}`),
    start: (id: string, envOverrides?: Record<string, string>) =>
      request<ProcessInfo>(`/run/start/${id}`, {
        method: 'POST',
        body: JSON.stringify({ envOverrides }),
      }),
    stop: (id: string, signal = 'SIGTERM') =>
      request<ProcessInfo>(`/run/stop/${id}`, {
        method: 'POST',
        body: JSON.stringify({ signal }),
      }),
    restart: (id: string) => request<ProcessInfo>(`/run/restart/${id}`, { method: 'POST' }),
    health: (id: string) => request<HealthCheck>(`/run/health/${id}`),
  },
  ffmpeg: {
    bin: () => request<{ bin: string; exists: boolean; ffmpegDir: string }>('/ffmpeg/bin'),
    info: (filePath: string) =>
      request<{ ok: boolean; file: string; raw: string }>(`/ffmpeg/info?path=${encodeURIComponent(filePath)}`),
    probe: (args: string[]) =>
      request<{ code: number | null; stdout: string; stderr: string }>('/ffmpeg/probe', {
        method: 'POST',
        body: JSON.stringify({ args }),
      }),
  },
  sandbox: {
    targets: () =>
      request<{ targets: { name: string; base: string; sample: string }[] }>('/sandbox/targets'),
    request: (req: {
      method: string;
      url: string;
      headers?: Record<string, string>;
      body?: string | null;
      timeoutMs?: number;
    }) =>
      request<{
        ok: boolean;
        status: number;
        statusText: string;
        headers: Record<string, string>;
        body: string;
        bytes: number;
        durationMs: number;
      }>('/sandbox/request', { method: 'POST', body: JSON.stringify(req) }),
  },
  skills: {
    list: () => request<{ skills: SkillEntry[] }>('/skills'),
    get: (id: string) => request<SkillEntry>(`/skills/${id}`),
  },
  tts: {
    status: () => request<{ up: boolean; info?: unknown; error?: string }>('/tts/status'),
    voices: () => request<{ voices: { id: string; name: string }[] }>('/tts/voices'),
    // returns a wav blob URL via fetch (handled in the panel directly)
    generateUrl: () => `${BASE}/tts/generate`,
  },
  lottie: {
    list: () => request<{ items: { id: string; name: string; url: string }[] }>('/lottie/list'),
  },
  captions: {
    status: () => request<{ up: boolean; engine?: string; error?: string }>('/captions/status'),
    // POST media bytes as octet-stream; returns { srt }
    transcribeUrl: (name: string, model: string, lang?: string) =>
      `${BASE}/captions/transcribe?name=${encodeURIComponent(name)}&model=${encodeURIComponent(model)}${lang ? `&lang=${encodeURIComponent(lang)}` : ''}`,
  },
};
