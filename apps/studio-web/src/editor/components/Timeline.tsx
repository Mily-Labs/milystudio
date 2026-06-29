import { useRef, useState, type PointerEvent as RPE } from 'react';
import { useProject } from '../state/store.tsx';
import { type Clip, type Track, type MediaClip, uid } from '../state/project.ts';
import { fmtDuration } from '../lib/time.ts';

const TRACK_H = 56;
const HEADER_W = 132;

type DragState =
  | null
  | {
      kind: 'move' | 'trimL' | 'trimR';
      clipId: string;
      startX: number;
      origStart: number;
      origDur: number;
      origIn: number;
    }
  | { kind: 'scrub'; startX: number };

export default function Timeline() {
  const store = useProject();
  const { project, zoom, playhead, selection, duration } = store;
  const laneRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>(null);
  // local visual override during a drag (no history spam)
  const [override, setOverride] = useState<Record<string, Partial<Clip>>>({});

  const totalWidth = Math.max(duration * zoom + 400, 800);

  const clipView = (clip: Clip): Clip => ({ ...clip, ...(override[clip.id] ?? {}) } as Clip);

  const snap = (t: number): number => {
    const targets = [0, playhead];
    for (const tg of targets) if (Math.abs(t - tg) * zoom < 7) return tg;
    return t;
  };

  const onClipPointerDown = (
    e: RPE,
    clip: Clip,
    kind: 'move' | 'trimL' | 'trimR',
  ) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    store.select(clip.id);
    const mc = clip as MediaClip;
    setDrag({
      kind,
      clipId: clip.id,
      startX: e.clientX,
      origStart: clip.start,
      origDur: clip.duration,
      origIn: mc.inPoint ?? 0,
    });
  };

  const onPointerMove = (e: RPE) => {
    if (!drag) return;
    if (drag.kind === 'scrub') {
      const rect = laneRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left + laneRef.current!.scrollLeft;
      store.setPlayhead(Math.max(0, x / zoom));
      return;
    }
    const dt = (e.clientX - drag.startX) / zoom;
    const found = findClip(project, drag.clipId);
    if (!found) return;
    const { clip } = found;

    if (drag.kind === 'move') {
      const ns = snap(Math.max(0, drag.origStart + dt));
      setOverride({ [clip.id]: { start: ns } });
    } else if (drag.kind === 'trimR') {
      const nd = Math.max(0.1, drag.origDur + dt);
      setOverride({ [clip.id]: { duration: nd } });
    } else if (drag.kind === 'trimL') {
      const maxDelta = drag.origDur - 0.1;
      const d = Math.min(Math.max(drag.origIn > 0 ? -drag.origIn : -Infinity, dt), maxDelta);
      const ns = Math.max(0, drag.origStart + d);
      const nd = drag.origDur - (ns - drag.origStart);
      const patch: Partial<Clip> = { start: ns, duration: nd };
      if (clip.type === 'video' || clip.type === 'audio') {
        (patch as Partial<MediaClip>).inPoint = drag.origIn + (ns - drag.origStart);
      }
      setOverride({ [clip.id]: patch });
    }
  };

  const onPointerUp = (e: RPE) => {
    if (!drag) return;
    if (drag.kind === 'scrub') {
      setDrag(null);
      return;
    }
    const patch = override[drag.clipId];
    if (patch) {
      if (drag.kind === 'move') {
        // detect target track under pointer
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const row = el?.closest('[data-track-id]') as HTMLElement | null;
        const targetTrack = row?.dataset.trackId;
        const src = findClip(project, drag.clipId);
        const compatible =
          targetTrack &&
          src &&
          trackAccepts(project.tracks.find((t) => t.id === targetTrack)!, src.clip);
        store.moveClip(drag.clipId, patch.start ?? src!.clip.start, compatible ? targetTrack : undefined);
      } else {
        store.updateClip(drag.clipId, patch);
      }
    }
    setOverride({});
    setDrag(null);
  };

  const onRulerDown = (e: RPE) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const rect = laneRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left + laneRef.current!.scrollLeft;
    store.setPlayhead(Math.max(0, x / zoom));
    setDrag({ kind: 'scrub', startX: e.clientX });
  };

  const tickStep = chooseTickStep(zoom);

  return (
    <div className="timeline">
      <div className="tl-toolbar">
        <button onClick={() => store.addTrack(newTrack('video', project.tracks.length))}>+ Видео</button>
        <button onClick={() => store.addTrack(newTrack('overlay', project.tracks.length))}>+ Оверлей</button>
        <button onClick={() => store.addTrack(newTrack('audio', project.tracks.length))}>+ Аудио</button>
        <span className="grow" />
        <span className="dim">Zoom</span>
        <input
          type="range"
          min={8}
          max={300}
          value={zoom}
          style={{ width: 140 }}
          onChange={(e) => store.setZoom(Number(e.target.value))}
        />
      </div>

      <div className="tl-body">
        {/* headers column */}
        <div className="tl-headers" style={{ width: HEADER_W }}>
          <div className="tl-corner" />
          {project.tracks.map((t) => (
            <div key={t.id} className="tl-head" style={{ height: TRACK_H }}>
              <span className="tl-head-name" title={t.name}>{t.name}</span>
              <div className="tl-head-btns">
                <button
                  className={t.muted ? 'on' : ''}
                  title="Mute"
                  onClick={() => store.updateTrack(t.id, { muted: !t.muted })}
                >
                  {t.muted ? '🔇' : '🔊'}
                </button>
                <button
                  className={t.hidden ? 'on' : ''}
                  title="Hide"
                  onClick={() => store.updateTrack(t.id, { hidden: !t.hidden })}
                >
                  {t.hidden ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* scrollable lane */}
        <div
          className="tl-lane"
          ref={laneRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="tl-inner" style={{ width: totalWidth }}>
            <div className="tl-ruler" onPointerDown={onRulerDown}>
              {buildTicks(duration + 4, tickStep).map((t) => (
                <div key={t} className="tl-tick" style={{ left: t * zoom }}>
                  <span>{fmtDuration(t)}</span>
                </div>
              ))}
            </div>

            {project.tracks.map((t) => (
              <div
                key={t.id}
                className={`tl-track ${t.kind}`}
                data-track-id={t.id}
                style={{ height: TRACK_H }}
              >
                {t.clips.map((raw) => {
                  const c = clipView(raw);
                  return (
                    <div
                      key={c.id}
                      className={`tl-clip ${c.type} ${selection === c.id ? 'sel' : ''}`}
                      style={{ left: c.start * zoom, width: Math.max(8, c.duration * zoom) }}
                      onPointerDown={(e) => onClipPointerDown(e, c, 'move')}
                    >
                      <div
                        className="tl-handle l"
                        onPointerDown={(e) => onClipPointerDown(e, c, 'trimL')}
                      />
                      <div className="tl-clip-label">
                        <span className="ico">{clipIcon(c.type)}</span>
                        <span className="nm">{c.name}</span>
                      </div>
                      <div
                        className="tl-handle r"
                        onPointerDown={(e) => onClipPointerDown(e, c, 'trimR')}
                      />
                    </div>
                  );
                })}
              </div>
            ))}

            {/* playhead */}
            <div className="tl-playhead" style={{ left: playhead * zoom }}>
              <div className="tl-playhead-knob" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function findClip(p: { tracks: Track[] }, id: string): { track: Track; clip: Clip } | null {
  for (const t of p.tracks) {
    const c = t.clips.find((x) => x.id === id);
    if (c) return { track: t, clip: c };
  }
  return null;
}

function trackAccepts(track: Track, clip: Clip): boolean {
  if (clip.type === 'audio') return track.kind === 'audio';
  return track.kind !== 'audio'; // video/overlay accept visual clips
}

function newTrack(kind: Track['kind'], idx: number): Track {
  const label =
    kind === 'video' ? 'Видео' : kind === 'audio' ? 'Аудио' : 'Оверлей';
  return { id: uid('trk'), kind, name: `${label} ${idx + 1}`, clips: [], muted: false, hidden: false, locked: false };
}

function clipIcon(type: Clip['type']): string {
  return { video: '🎬', image: '🖼', audio: '🎵', text: 'T', lottie: '✨' }[type];
}

function chooseTickStep(zoom: number): number {
  const target = 80; // px between labels
  const sec = target / zoom;
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  for (const s of steps) if (s >= sec) return s;
  return 600;
}

function buildTicks(maxT: number, step: number): number[] {
  const out: number[] = [];
  for (let t = 0; t <= maxT; t += step) out.push(Number(t.toFixed(3)));
  return out;
}
