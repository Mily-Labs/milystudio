import { spawn, type ChildProcess } from 'node:child_process';
import { nanoid } from 'nanoid';
import { loadEnvFile, type ServiceConfig, getService } from './config.js';

export type ProcessState = 'stopped' | 'starting' | 'running' | 'crashed' | 'stopping';

export interface ProcessInfo {
  id: string; // unique run id
  serviceId: string;
  pid: number | null;
  state: ProcessState;
  startedAt: number | null;
  stoppedAt: number | null;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  lastError: string | null;
}

interface InternalRun {
  info: ProcessInfo;
  proc: ChildProcess | null;
  logBuffer: string[]; // ring buffer (last N lines)
  logListeners: Set<(line: string) => void>;
  stateListeners: Set<(info: ProcessInfo) => void>;
}

const MAX_LOG_LINES = 2000;

/** Singleton registry: one run per serviceId. */
const runs = new Map<string, InternalRun>();

function emitLog(run: InternalRun, line: string): void {
  run.logBuffer.push(line);
  if (run.logBuffer.length > MAX_LOG_LINES) run.logBuffer.shift();
  for (const fn of run.logListeners) {
    try {
      fn(line);
    } catch {
      // ignore listener errors
    }
  }
}

function emitState(run: InternalRun): void {
  for (const fn of run.stateListeners) {
    try {
      fn(run.info);
    } catch {
      // ignore listener errors
    }
  }
}

function setState(run: InternalRun, state: ProcessState): void {
  run.info.state = state;
  emitState(run);
}

function snapshot(run: InternalRun): ProcessInfo {
  return { ...run.info };
}

function newRun(serviceId: string): InternalRun {
  return {
    info: {
      id: nanoid(10),
      serviceId,
      pid: null,
      state: 'stopped',
      startedAt: null,
      stoppedAt: null,
      exitCode: null,
      signal: null,
      lastError: null,
    },
    proc: null,
    logBuffer: [],
    logListeners: new Set(),
    stateListeners: new Set(),
  };
}

export interface StartOptions {
  /** Extra environment overrides applied on top of .env + process.env. */
  envOverrides?: Record<string, string>;
}

export function startService(serviceId: string, options: StartOptions = {}): ProcessInfo {
  const svc = getService(serviceId);
  if (!svc) throw new Error(`Unknown service: ${serviceId}`);

  const existing = runs.get(serviceId);
  if (existing && (existing.info.state === 'running' || existing.info.state === 'starting')) {
    return snapshot(existing);
  }

  const run = existing ?? newRun(serviceId);
  runs.set(serviceId, run);

  // Merge env: process.env <- .env file <- overrides
  const fileEnv = loadEnvFile(svc.envFile);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...fileEnv,
    ...(options.envOverrides ?? {}),
  };

  // Strip empty values to avoid surprises.
  for (const k of Object.keys(env)) {
    if (env[k] === '') delete env[k];
  }

  setState(run, 'starting');
  run.info.startedAt = Date.now();
  run.info.stoppedAt = null;
  run.info.exitCode = null;
  run.info.signal = null;
  run.info.lastError = null;
  run.logBuffer.length = 0;

  const [cmd, ...args] = svc.command;
  const proc = spawn(cmd, args, {
    cwd: svc.dir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  run.proc = proc;
  run.info.pid = proc.pid ?? null;

  proc.stdout?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString('utf8').split(/\r?\n/)) {
      if (line.length === 0) continue;
      emitLog(run, line);
    }
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString('utf8').split(/\r?\n/)) {
      if (line.length === 0) continue;
      emitLog(run, `[stderr] ${line}`);
    }
  });

  proc.on('error', (err) => {
    run.info.lastError = err.message;
    emitLog(run, `[error] ${err.message}`);
  });

  proc.on('exit', (code, signal) => {
    run.info.exitCode = code;
    run.info.signal = signal;
    run.info.pid = null;
    run.info.stoppedAt = Date.now();
    const wasStopping = run.info.state === 'stopping';
    setState(run, wasStopping ? 'stopped' : code === 0 ? 'stopped' : 'crashed');
    run.proc = null;
    if (wasStopping) {
      emitLog(run, `[studio] service ${serviceId} stopped (signal=${signal ?? 'none'})`);
    } else if (code !== 0) {
      emitLog(run, `[studio] service ${serviceId} exited with code ${code}`);
    } else {
      emitLog(run, `[studio] service ${serviceId} exited cleanly`);
    }
  });

  // Optimistic "running" — health probe will catch truth later.
  setState(run, 'running');
  emitLog(run, `[studio] starting ${svc.id} (pid=${proc.pid ?? '?'}) via ${cmd} ${args.join(' ')}`);

  return snapshot(run);
}

export function stopService(serviceId: string, signal: NodeJS.Signals = 'SIGTERM'): ProcessInfo {
  const run = runs.get(serviceId);
  if (!run || !run.proc) {
    // Nothing to stop — return a synthetic "stopped" record.
    return {
      id: nanoid(10),
      serviceId,
      pid: null,
      state: 'stopped',
      startedAt: null,
      stoppedAt: Date.now(),
      exitCode: null,
      signal: null,
      lastError: null,
    };
  }

  setState(run, 'stopping');
  emitLog(run, `[studio] sending ${signal} to ${serviceId} (pid=${run.info.pid})`);
  try {
    run.proc.kill(signal);
  } catch (err) {
    emitLog(run, `[error] failed to signal ${serviceId}: ${(err as Error).message}`);
  }

  return snapshot(run);
}

export function restartService(serviceId: string): ProcessInfo {
  stopService(serviceId, 'SIGTERM');
  // Give it a moment to die cleanly, then start again.
  setTimeout(() => startService(serviceId), 400);
  // Return current snapshot; UI will see state transition.
  const run = runs.get(serviceId);
  return run ? snapshot(run) : new ProcessInfoProxy(serviceId);
}

export function getStatus(serviceId: string): ProcessInfo | null {
  const run = runs.get(serviceId);
  return run ? snapshot(run) : null;
}

export function listStatus(): ProcessInfo[] {
  const out: ProcessInfo[] = [];
  for (const [, run] of runs) out.push(snapshot(run));
  return out;
}

export function getLogs(serviceId: string, since?: number): string[] {
  const run = runs.get(serviceId);
  if (!run) return [];
  return run.logBuffer.slice();
}

export function subscribeLogs(serviceId: string, listener: (line: string) => void): () => void {
  const run = runs.get(serviceId);
  if (!run) {
    // Auto-create an empty run so the subscription still works for streaming.
    const fresh = newRun(serviceId);
    runs.set(serviceId, fresh);
    fresh.logListeners.add(listener);
    return () => fresh.logListeners.delete(listener);
  }
  run.logListeners.add(listener);
  return () => run.logListeners.delete(listener);
}

export function subscribeState(serviceId: string, listener: (info: ProcessInfo) => void): () => void {
  const run = runs.get(serviceId);
  if (!run) return () => {};
  run.stateListeners.add(listener);
  return () => run.stateListeners.delete(listener);
}

// Helper class to satisfy restartService typing when no run exists yet.
class ProcessInfoProxy implements ProcessInfo {
  id: string;
  serviceId: string;
  pid: number | null;
  state: ProcessState;
  startedAt: number | null;
  stoppedAt: number | null;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  lastError: string | null;
  constructor(serviceId: string) {
    this.id = nanoid(10);
    this.serviceId = serviceId;
    this.pid = null;
    this.state = 'stopped';
    this.startedAt = null;
    this.stoppedAt = null;
    this.exitCode = null;
    this.signal = null;
    this.lastError = null;
  }
}

export interface HealthCheckResult {
  serviceId: string;
  ok: boolean;
  status: number | null;
  error: string | null;
  durationMs: number;
}

/**
 * Lightweight HTTP health probe. Returns null for services without a health URL.
 */
export async function probeHealth(svc: ServiceConfig): Promise<HealthCheckResult | null> {
  if (!svc.healthUrl) return null;
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(svc.healthUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    return {
      serviceId: svc.id,
      ok: res.ok,
      status: res.status,
      error: null,
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      serviceId: svc.id,
      ok: false,
      status: null,
      error: (err as Error).message,
      durationMs: Date.now() - t0,
    };
  }
}