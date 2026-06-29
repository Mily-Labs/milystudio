import { useEffect, useState } from 'react';

interface SystemInfo {
  ok?: boolean;
  service?: string;
  version?: string;
  [k: string]: unknown;
}

export default function OmniVoiceTab() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/ctrl/proxy/omnivoice/system/info')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setInfo(j);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  return (
    <div>
      <h2>OmniVoice</h2>
      <p className="muted">
        TTS, клонирование голоса, ASR (WhisperX), дубляж. Все запросы проксируются на{' '}
        <code>http://localhost:3900</code> через оркестратор.
      </p>

      {err && (
        <div className="card" style={{ borderColor: 'var(--bad)' }}>
          <h3 style={{ color: 'var(--bad)' }}>OmniVoice API недоступен</h3>
          <p>
            Запустите его на вкладке <span className="kbd">Run</span> или вручную:{' '}
            <code>bun --prefix OmniVoice run dev:api</code>
          </p>
          <pre className="json">{err}</pre>
        </div>
      )}

      {info && (
        <div className="card">
          <h3>System info</h3>
          <pre className="json">{JSON.stringify(info, null, 2)}</pre>
        </div>
      )}

      <div className="card">
        <h3>Полезные эндпоинты</h3>
        <ul className="muted">
          <li><code>GET /system/info</code> — статус сервиса</li>
          <li><code>POST /tts</code> — синтез речи (form-data: <code>text</code>, <code>voice_id</code>)</li>
          <li><code>POST /asr</code> — распознавание речи (multipart: <code>audio</code>)</li>
          <li><code>POST /dubbing</code> — дубляж видео (multipart: <code>video</code>, <code>target_voice</code>)</li>
          <li><code>GET /voices</code> — список голосов</li>
        </ul>
        <p className="muted">
          Откройте вкладку <span className="kbd">API Sandbox</span> — там можно дёрнуть любой из них без curl.
        </p>
      </div>
    </div>
  );
}