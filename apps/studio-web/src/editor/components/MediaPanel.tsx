import { useRef, useState } from 'react';
import { useProject } from '../state/store.tsx';
import { probeMedia, type MediaAsset } from '../state/media.ts';
import { mediaClip, appendStart } from '../lib/clips.ts';
import type { Track } from '../state/project.ts';

export default function MediaPanel() {
  const store = useProject();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const importFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const assets: MediaAsset[] = [];
    for (const f of Array.from(files)) {
      try {
        assets.push(await probeMedia(f));
      } catch {
        /* skip unreadable */
      }
    }
    store.addMedia(assets);
    setBusy(false);
  };

  const addToTimeline = (asset: MediaAsset) => {
    const kind = asset.kind === 'audio' ? 'audio' : asset.kind === 'video' ? 'video' : 'overlay';
    const track = pickTrack(store.project.tracks, kind);
    if (!track) return;
    const start = appendStart(track.clips);
    store.addClip(track.id, mediaClip(asset, track.id, start));
  };

  return (
    <div className="panel">
      <h3>Медиа</h3>
      <button
        className="primary block"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? 'Импорт…' : '⬆ Импортировать файлы'}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/*,image/*,audio/*"
        style={{ display: 'none' }}
        onChange={(e) => importFiles(e.target.files)}
      />
      <p className="dim sm">Видео, изображения, аудио. Двойной клик — добавить на таймлайн.</p>

      <div
        className="media-grid"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          importFiles(e.dataTransfer.files);
        }}
      >
        {store.media.length === 0 && <div className="empty">Перетащите файлы сюда</div>}
        {store.media.map((m) => (
          <div
            key={m.id}
            className="media-card"
            title={m.name}
            onDoubleClick={() => addToTimeline(m)}
          >
            <div className="media-thumb">
              {m.thumb ? <img src={m.thumb} alt="" /> : <span className="ph">{icon(m.kind)}</span>}
              <span className="media-badge">{icon(m.kind)}</span>
            </div>
            <div className="media-name">{m.name}</div>
            <button className="add" onClick={() => addToTimeline(m)}>＋</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function pickTrack(tracks: Track[], kind: 'video' | 'audio' | 'overlay'): Track | undefined {
  return tracks.find((t) => t.kind === kind) ?? tracks.find((t) => t.kind !== 'audio');
}

function icon(k: string): string {
  return k === 'video' ? '🎬' : k === 'audio' ? '🎵' : '🖼';
}
