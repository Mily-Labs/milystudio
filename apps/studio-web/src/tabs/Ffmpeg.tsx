import { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';

export default function FfmpegTab() {
  const [bin, setBin] = useState<{ bin: string; exists: boolean; ffmpegDir: string } | null>(null);
  const [filePath, setFilePath] = useState<string>('');
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [args, setArgs] = useState<string>('-hide_banner -version');
  const [probe, setProbe] = useState<{ code: number | null; stdout: string; stderr: string } | null>(null);

  useEffect(() => {
    api.ffmpeg.bin().then(setBin).catch((e: Error) => setErr(e.message));
  }, []);

  const runInfo = async (): Promise<void> => {
    setErr(null);
    setInfo(null);
    try {
      const r = await api.ffmpeg.info(filePath);
      setInfo(r.raw);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const runProbe = async (): Promise<void> => {
    setErr(null);
    setProbe(null);
    const parsed = args.trim().split(/\s+/).filter(Boolean);
    try {
      const r = await api.ffmpeg.probe(parsed);
      setProbe(r);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div>
      <h2>ffmpeg</h2>
      <p className="muted">
        Видео-инспекция и пробинг <code>ffmpeg.exe</code>. Бинарь определяется из <code>FFMPEG_PATH</code> или{' '}
        <code>ffmpeg/ffmpeg.exe</code>.
      </p>

      <div className="card">
        <h3>Бинарь</h3>
        {bin ? (
          <div className="row wrap gap-12">
            <span className="state-badge" style={{ background: bin.exists ? 'rgba(52,211,153,.15)' : 'rgba(248,113,113,.15)', color: bin.exists ? 'var(--ok)' : 'var(--bad)' }}>
              {bin.exists ? 'FOUND' : 'MISSING'}
            </span>
            <code>{bin.bin}</code>
          </div>
        ) : (
          <span className="muted">loading…</span>
        )}
      </div>

      <div className="card">
        <h3>ffmpeg -i &lt;file&gt;</h3>
        <label>Путь к медиа-файлу</label>
        <div className="row gap-12">
          <input value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="C:\path\to\video.mp4" />
          <button className="primary" onClick={runInfo} disabled={!filePath}>Запустить</button>
        </div>
        {info && <pre className="json mt-12">{info}</pre>}
      </div>

      <div className="card">
        <h3>Probe args</h3>
        <label>argv (через пробел)</label>
        <input value={args} onChange={(e) => setArgs(e.target.value)} />
        <div className="mt-12"><button onClick={runProbe}>Запустить</button></div>
        {probe && (
          <pre className="json mt-12">
            {`exit=${probe.code}\n--- stdout ---\n${probe.stdout}\n--- stderr ---\n${probe.stderr}`}
          </pre>
        )}
      </div>

      {err && <pre className="json" style={{ borderColor: 'var(--bad)' }}>{err}</pre>}
    </div>
  );
}