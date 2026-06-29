import { useRef, useState } from 'react';
import { useProject } from '../state/store.tsx';
import { exportProject, downloadBlob } from '../engine/exporter.ts';

const PRESETS = [
  { label: 'Исходный', scale: 1 },
  { label: '720p', scale: 720 / 1920 },
  { label: '540p', scale: 540 / 1920 },
];

export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const store = useProject();
  const [scaleIdx, setScaleIdx] = useState(0);
  const [fps, setFps] = useState(store.project.fps);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const cancelRef = useRef({ cancelled: false });

  const baseW = store.project.width;
  const baseH = store.project.height;
  const scale = PRESETS[scaleIdx].scale;
  const outW = even(Math.round(baseW * scale));
  const outH = even(Math.round(baseH * scale));

  const run = async () => {
    setProgress(0);
    setDone(false);
    cancelRef.current.cancelled = false;
    store.setPlaying(false);
    try {
      const blob = await exportProject(store.project, {
        width: outW,
        height: outH,
        fps,
        onProgress: setProgress,
        signal: cancelRef.current,
      });
      downloadBlob(blob, `${sanitize(store.project.name)}.webm`);
      setDone(true);
    } catch (e) {
      alert(`Ошибка экспорта: ${(e as Error).message}`);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Экспорт видео</h3>
        <p className="dim sm">
          Рендер в реальном времени (canvas + звук → WebM). Включает видео, текст, Lottie и эффекты.
        </p>

        <label>Разрешение</label>
        <div className="seg">
          {PRESETS.map((p, i) => (
            <button key={p.label} className={i === scaleIdx ? 'on' : ''} onClick={() => setScaleIdx(i)}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="dim sm">{outW}×{outH} · {fps}fps · ~{store.duration.toFixed(1)}с</p>

        <label className="mt-12">FPS</label>
        <select value={fps} onChange={(e) => setFps(Number(e.target.value))}>
          <option value={24}>24</option>
          <option value={30}>30</option>
          <option value={60}>60</option>
        </select>

        {progress !== null && (
          <div className="progress mt-16">
            <div className="bar" style={{ width: `${Math.round(progress * 100)}%` }} />
            <span>{Math.round(progress * 100)}%</span>
          </div>
        )}
        {done && <p className="ok sm mt-12">✓ Файл сохранён в загрузки.</p>}

        <div className="row between mt-16">
          <button onClick={onClose}>Закрыть</button>
          {progress !== null ? (
            <button className="danger" onClick={() => (cancelRef.current.cancelled = true)}>Отмена</button>
          ) : (
            <button className="primary" onClick={run}>▶ Начать экспорт</button>
          )}
        </div>
      </div>
    </div>
  );
}

function even(n: number): number {
  return n % 2 === 0 ? n : n + 1;
}
function sanitize(s: string): string {
  return s.replace(/[^\w\-а-яё ]/gi, '').trim() || 'milystudio';
}
