import { useProject } from '../state/store.tsx';
import { textClip } from '../lib/clips.ts';
import type { Track } from '../state/project.ts';

const PRESETS: { label: string; text: string; size: number; color: string; bg: string | null }[] = [
  { label: 'Заголовок', text: 'ЗАГОЛОВОК', size: 130, color: '#ffffff', bg: null },
  { label: 'Подзаголовок', text: 'подзаголовок', size: 72, color: '#e6ecff', bg: null },
  { label: 'Плашка', text: 'Подпись', size: 64, color: '#0b1020', bg: '#22d3ee' },
  { label: 'Капшен', text: 'Субтитр', size: 60, color: '#ffffff', bg: 'rgba(0,0,0,0.5)' },
];

export default function TextPanel() {
  const store = useProject();

  const add = (p: (typeof PRESETS)[number]) => {
    const track = overlayTrack(store.project.tracks);
    const clip = textClip(track.id, store.playhead, p.text);
    clip.style = { ...clip.style, fontSize: p.size, color: p.color, bg: p.bg };
    store.addClip(track.id, clip);
  };

  return (
    <div className="panel">
      <h3>Текст</h3>
      <p className="dim sm">Добавляется на оверлей‑дорожку в позиции плейхеда.</p>
      <div className="preset-list">
        {PRESETS.map((p) => (
          <button key={p.label} className="preset" onClick={() => add(p)}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{p.label}</span>
            <span className="dim sm">{p.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function overlayTrack(tracks: Track[]): Track {
  return tracks.find((t) => t.kind === 'overlay') ?? tracks[0];
}
