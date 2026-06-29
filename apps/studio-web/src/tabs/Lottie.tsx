import { useEffect, useState } from 'react';

interface LottieContext {
  [k: string]: unknown;
}

export default function LottieTab() {
  const [ctx, setCtx] = useState<LottieContext | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/ctrl/proxy/lottie/__context')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setCtx(j);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  return (
    <div>
      <h2>Lottie</h2>
      <p className="muted">
        Сцена, текущий контекст и Bodymovin JSON. Проксируется на <code>http://localhost:3030</code>.
      </p>

      {err && (
        <div className="card" style={{ borderColor: 'var(--bad)' }}>
          <h3 style={{ color: 'var(--bad)' }}>Lottie dev-сервер недоступен</h3>
          <p>
            Запустите на вкладке <span className="kbd">Run</span> или: <code>npm --prefix text-to-lottie run dev</code>
          </p>
          <pre className="json">{err}</pre>
        </div>
      )}

      {ctx && (
        <div className="card">
          <h3>Context</h3>
          <pre className="json">{JSON.stringify(ctx, null, 2)}</pre>
        </div>
      )}

      <div className="card">
        <h3>Полезные эндпоинты text-to-lottie</h3>
        <ul className="muted">
          <li><code>GET /__context</code> — текущий контекст сцены</li>
          <li><code>GET /__scenes</code> — список сцен</li>
          <li><code>POST /__scenes/:id</code> — обновить сцену</li>
          <li><code>GET /lottie.json</code> — последний сгенерированный JSON</li>
        </ul>
      </div>
    </div>
  );
}