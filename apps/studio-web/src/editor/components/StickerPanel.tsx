import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.ts';
import { useProject } from '../state/store.tsx';
import { registerLottie, getLottieMeta, warmLottie } from '../engine/lottieCache.ts';
import { lottieClip } from '../lib/clips.ts';
import { uid, type Track } from '../state/project.ts';

export default function StickerPanel() {
  const store = useProject();
  const [items, setItems] = useState<{ id: string; name: string; url: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.lottie
      .list()
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, []);

  const addLottie = (id: string, name: string, json: unknown) => {
    registerLottie(id, json);
    warmLottie(id);
    const meta = getLottieMeta(id);
    const dur = meta && meta.duration > 0 ? meta.duration : 3;
    const track = overlayTrack(store.project.tracks);
    store.addClip(track.id, lottieClip(id, name, track.id, store.playhead, dur));
  };

  const addFromUrl = async (it: { id: string; name: string; url: string }) => {
    setErr(null);
    try {
      const json = await fetch(it.url).then((r) => r.json());
      addLottie(`lib_${it.id}`, it.name, json);
    } catch (e) {
      setErr(`Не удалось загрузить ${it.name}: ${(e as Error).message}`);
    }
  };

  const importFile = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    setErr(null);
    try {
      const txt = await files[0].text();
      const json = JSON.parse(txt);
      if (!json || !Array.isArray(json.layers)) throw new Error('не похоже на Lottie JSON');
      addLottie(uid('lot'), files[0].name.replace(/\.json$/, ''), json);
    } catch (e) {
      setErr(`Импорт не удался: ${(e as Error).message}`);
    }
  };

  return (
    <div className="panel">
      <h3>Стикеры · Lottie</h3>
      <button className="primary block" onClick={() => fileRef.current?.click()}>
        ⬆ Импорт Lottie .json
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => importFile(e.target.files)}
      />
      <p className="dim sm">Библиотека анимаций. Клик — добавить на оверлей.</p>

      <div className="sticker-grid">
        {items.length === 0 && <div className="empty">Библиотека пуста</div>}
        {items.map((it) => (
          <button key={it.id} className="sticker-card" onClick={() => addFromUrl(it)}>
            <span className="sticker-ico">✨</span>
            <span className="sticker-name">{it.name}</span>
          </button>
        ))}
      </div>
      {err && <p className="error sm">{err}</p>}
    </div>
  );
}

function overlayTrack(tracks: Track[]): Track {
  return tracks.find((t) => t.kind === 'overlay') ?? tracks[0];
}
