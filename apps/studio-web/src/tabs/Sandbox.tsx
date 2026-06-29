import { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';

interface SandboxResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  bytes: number;
  durationMs: number;
}

export default function SandboxTab() {
  const [targets, setTargets] = useState<{ name: string; base: string; sample: string }[]>([]);
  const [method, setMethod] = useState<string>('GET');
  const [url, setUrl] = useState<string>('http://127.0.0.1:3900/system/info');
  const [headersText, setHeadersText] = useState<string>('Content-Type: application/json');
  const [body, setBody] = useState<string>('');
  const [resp, setResp] = useState<SandboxResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.sandbox.targets().then((d) => setTargets(d.targets)).catch(() => {});
  }, []);

  const send = async (): Promise<void> => {
    setBusy(true);
    setErr(null);
    setResp(null);
    try {
      const headers: Record<string, string> = {};
      for (const line of headersText.split(/\r?\n/)) {
        const m = line.match(/^([A-Za-z0-9-_]+)\s*:\s*(.*)$/);
        if (m) headers[m[1]] = m[2];
      }
      const r = await api.sandbox.request({ method, url, headers, body: body || null });
      setResp(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const usePreset = (base: string, sample: string): void => {
    setMethod('GET');
    setUrl(`${base}${sample}`);
    setHeadersText('Content-Type: application/json');
    setBody('');
  };

  return (
    <div>
      <h2>API Sandbox</h2>
      <p className="muted">Универсальный HTTP-тестер. Дёргайте любой backend без curl.</p>

      <div className="card">
        <h3>Пресеты</h3>
        <div className="row wrap gap-12">
          {targets.map((t) => (
            <button key={t.base + t.sample} onClick={() => usePreset(t.base, t.sample)}>
              {t.name} — <code>{t.sample}</code>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Запрос</h3>
        <div className="row gap-12">
          <div style={{ width: 100 }}>
            <label>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
        </div>
        <div className="mt-12">
          <label>Headers (по одному на строку)</label>
          <textarea rows={3} value={headersText} onChange={(e) => setHeadersText(e.target.value)} />
        </div>
        <div className="mt-12">
          <label>Body</label>
          <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder='{"hello":"world"}' />
        </div>
        <div className="mt-12">
          <button className="primary" onClick={send} disabled={busy}>{busy ? '…' : 'Send'}</button>
        </div>
      </div>

      {err && <pre className="json" style={{ borderColor: 'var(--bad)' }}>{err}</pre>}
      {resp && (
        <div className="card">
          <h3>
            Ответ
            <span className="state-badge" style={{ background: resp.ok ? 'rgba(52,211,153,.15)' : 'rgba(248,113,113,.15)', color: resp.ok ? 'var(--ok)' : 'var(--bad)' }}>
              {resp.status} {resp.statusText}
            </span>
            <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
              {resp.bytes} B · {resp.durationMs} ms
            </span>
          </h3>
          <pre className="json">{resp.body || '(empty body)'}</pre>
          <details className="mt-12">
            <summary className="muted" style={{ cursor: 'pointer' }}>Headers</summary>
            <pre className="json mt-12">{JSON.stringify(resp.headers, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}