import { useEffect, useRef } from 'react';
import { useProject } from '../state/store.tsx';
import { Compositor } from '../engine/compositor.ts';
import { MediaSync } from '../engine/playback.ts';
import { onLottieReady } from '../engine/lottieCache.ts';
import { fmtTimecode } from '../lib/time.ts';

export default function Preview() {
  const store = useProject();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compRef = useRef<Compositor | null>(null);
  const syncRef = useRef<MediaSync | null>(null);
  const live = useRef(store);
  live.current = store;

  // mount compositor once
  useEffect(() => {
    if (!canvasRef.current) return;
    const comp = new Compositor(canvasRef.current);
    compRef.current = comp;
    syncRef.current = new MediaSync(comp);
    // first paint
    comp.draw(store.project, store.playhead);
    // repaint when an async-loaded lottie becomes ready
    const unsub = onLottieReady(() => {
      const s = live.current;
      if (!s.isPlaying) compRef.current?.draw(s.project, s.playhead);
    });
    return () => {
      unsub();
      syncRef.current?.dispose();
      comp.dispose();
      compRef.current = null;
      syncRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reactive redraw while paused (no RAF dependency)
  useEffect(() => {
    const comp = compRef.current;
    if (!comp || store.isPlaying) return;
    syncRef.current?.update(store.project, store.playhead, false);
    comp.syncVideoTimes(store.project, store.playhead, false);
    comp.draw(store.project, store.playhead);
    // a delayed second paint to catch async video seeks
    const id = window.setTimeout(() => {
      if (!live.current.isPlaying) comp.draw(live.current.project, live.current.playhead);
    }, 140);
    return () => window.clearTimeout(id);
  }, [store.project, store.playhead, store.isPlaying]);

  // RAF transport loop only while playing
  useEffect(() => {
    if (!store.isPlaying) return;
    const comp = compRef.current;
    if (!comp) return;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const s = live.current;
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      let time = s.playhead + dt;
      if (time >= s.duration) {
        time = s.duration;
        s.setPlaying(false);
      }
      s.setPlayhead(time);
      try {
        syncRef.current?.update(s.project, time, true);
        comp.draw(s.project, time);
      } catch {
        /* keep loop alive */
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      syncRef.current?.stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.isPlaying]);

  const togglePlay = () => {
    if (store.playhead >= store.duration - 0.05) store.setPlayhead(0);
    store.setPlaying(!store.isPlaying);
  };

  return (
    <div className="preview">
      <div className="preview-stage">
        <canvas ref={canvasRef} className="preview-canvas" />
      </div>
      <div className="transport">
        <button onClick={() => store.setPlayhead(0)} title="В начало">⏮</button>
        <button className="primary" onClick={togglePlay} title="Пробел">
          {store.isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={() => store.setPlayhead(store.duration)} title="В конец">⏭</button>
        <span className="timecode">
          {fmtTimecode(store.playhead, store.project.fps)} / {fmtTimecode(store.duration, store.project.fps)}
        </span>
        <span className="grow" />
        <span className="dim">{store.project.width}×{store.project.height} · {store.project.fps}fps</span>
      </div>
    </div>
  );
}
