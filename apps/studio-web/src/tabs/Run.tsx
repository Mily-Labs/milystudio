import { useEffect, useRef, useState } from 'react';
import { api, type ProcessInfo, type ServiceEntry } from '../lib/api.ts';

function StateBadge({ state }: { state: ProcessInfo['state'] }) {
  return <span className={`state-badge state-${state}`}>{state}</span>;
}

function ServiceCard({ svc }: { svc: ServiceEntry }) {
  const [info, setInfo] = useState<ProcessInfo | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [health, setHealth] = useState<{ ok: boolean; status: number | null } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const refresh = async (): Promise<void> => {
    try {
      const s = await api.run.statusOne(svc.id);
      setInfo(s);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [svc.id]);

  // SSE log stream
  useEffect(() => {
    const es = new EventSource(`/ctrl/run/logs/${svc.id}`);
    es.addEventListener('hello', () => {
      setLogs([]);
    });
    es.addEventListener('log', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { line: string };
        setLogs((prev) => {
          const next = [...prev, data.line];
          return next.length > 1500 ? next.slice(next.length - 1500) : next;
        });
      } catch {
        // ignore malformed
      }
    });
    es.onerror = () => {
      // browser will auto-reconnect; we just don't crash UI
    };
    return () => es.close();
  }, [svc.id]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const call = async (fn: () => Promise<unknown>): Promise<void> => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const probe = async (): Promise<void> => {
    setHealth(null);
    try {
      const h = await api.run.health(svc.id);
      setHealth({ ok: h.ok, status: h.status });
    } catch (e) {
      setHealth({ ok: false, status: null });
      setErr((e as Error).message);
    }
  };

  return (
    <div className="card">
      <h3>
        <span>{svc.label}</span>
        {info && <StateBadge state={info.state} />}
        {svc.port && <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>:{svc.port}</span>}
      </h3>
      <p>{svc.description.en}</p>
      <div className="meta">
        <code>{svc.command.join(' ')}</code>
      </div>
      <div className="meta mt-12">cwd: <code>{svc.dir}</code></div>

      <div className="row mt-12 wrap gap-12">
        <button className="primary" disabled={busy || info?.state === 'running' || info?.state === 'starting'} onClick={() => call(() => api.run.start(svc.id))}>
          Start
        </button>
        <button disabled={busy || info?.state === 'stopped'} onClick={() => call(() => api.run.stop(svc.id))}>
          Stop
        </button>
        <button disabled={busy} onClick={() => call(() => api.run.restart(svc.id))}>
          Restart
        </button>
        {svc.healthUrl && (
          <button disabled={busy} onClick={probe}>
            Probe health
          </button>
        )}
        {health && (
          <span className="state-badge" style={{ background: health.ok ? 'rgba(52,211,153,.15)' : 'rgba(248,113,113,.15)', color: health.ok ? 'var(--ok)' : 'var(--bad)' }}>
            {health.ok ? `OK ${health.status ?? ''}` : `DOWN${health.status ? ` ${health.status}` : ''}`}
          </span>
        )}
      </div>

      {err && <pre className="json" style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}>{err}</pre>}

      <div className="row between mt-12">
        <span className="muted" style={{ fontSize: 12 }}>
          {info?.pid ? `pid ${info.pid}` : 'no pid'} · {info?.startedAt ? `started ${new Date(info.startedAt).toLocaleTimeString()}` : 'never started'}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>{logs.length} lines</span>
      </div>

      <div className="log-viewer mt-12" ref={logRef}>
        {logs.length === 0 ? (
          <span className="muted">(no output yet — start the service to see logs)</span>
        ) : (
          logs.map((l, i) => (
            <div key={i} className={`line ${l.startsWith('[stderr]') || l.startsWith('[error]') ? 'stderr' : ''}`}>
              {l}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function RunTab() {
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.run.services()
      .then((d) => setServices(d.services))
      .catch((e: Error) => setErr(e.message));
  }, []);

  return (
    <div>
      <h2>Run</h2>
      <p className="muted">
        Launch / stop / restart any subsystem. Live stdout + stderr streams below each card. Health probes hit the
        service's own <code>healthUrl</code>.
      </p>
      {err && <pre className="json" style={{ borderColor: 'var(--bad)' }}>{err}</pre>}
      <div className="grid-2 mt-16">
        {services.map((s) => (
          <ServiceCard key={s.id} svc={s} />
        ))}
      </div>
    </div>
  );
}