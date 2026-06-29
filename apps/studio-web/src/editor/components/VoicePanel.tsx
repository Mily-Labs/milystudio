import { useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import { useProject } from '../state/store.tsx';
import { probeMedia } from '../state/media.ts';
import { mediaClip, appendStart } from '../lib/clips.ts';
import type { Track } from '../state/project.ts';

export default function VoicePanel() {
  const store = useProject();
  const [up, setUp] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<{ id: string; name: string }[]>([]);
  const [voice, setVoice] = useState('');
  const [text, setText] = useState('Привет! Это озвучка из MilyStudio.');
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const refresh = async () => {
    try {
      const s = await api.tts.status();
      setUp(s.up);
      if (s.up) {
        const v = await api.tts.voices();
        setVoices(v.voices);
      }
    } catch {
      setUp(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const startService = async () => {
    setStarting(true);
    try {
      await api.run.start('omnivoice');
    } catch {
      /* ignore */
    }
    // poll for readiness
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const s = await api.tts.status();
        if (s.up) break;
      } catch {
        /* keep polling */
      }
    }
    setStarting(false);
    refresh();
  };

  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(api.tts.generateUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, profile_id: voice || undefined, speed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const file = new File([blob], `voice_${Date.now()}.wav`, { type: 'audio/wav' });
      const asset = await probeMedia(file);
      store.addMedia([asset]);
      const track = audioTrack(store.project.tracks);
      const start = appendStart(track.clips);
      store.addClip(track.id, mediaClip(asset, track.id, start));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h3>Озвучка · OmniVoice</h3>

      {up === false && (
        <div className="banner warn">
          <div>OmniVoice не запущен (порт 3900).</div>
          <button className="primary" onClick={startService} disabled={starting}>
            {starting ? 'Запуск… (может занять минуту)' : '▶ Запустить OmniVoice'}
          </button>
          <button onClick={refresh}>Проверить снова</button>
        </div>
      )}
      {up === null && <p className="dim sm">Проверка статуса сервиса…</p>}
      {up && <p className="dim sm">● сервис на связи (:3900)</p>}

      <label>Текст</label>
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />

      <label className="mt-12">Голос</label>
      <select value={voice} onChange={(e) => setVoice(e.target.value)} disabled={!up}>
        {voices.length === 0 && <option value="">Голос по умолчанию</option>}
        {voices.map((v) => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </select>

      <label className="mt-12">Скорость · {speed.toFixed(2)}×</label>
      <input
        type="range"
        min={0.5}
        max={2}
        step={0.05}
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
      />

      <button className="primary block mt-12" onClick={generate} disabled={busy || !up}>
        {busy ? 'Синтез…' : '🎙 Озвучить → на таймлайн'}
      </button>
      {err && <p className="error sm">{err}</p>}
    </div>
  );
}

function audioTrack(tracks: Track[]): Track {
  return tracks.find((t) => t.kind === 'audio') ?? tracks[tracks.length - 1];
}
