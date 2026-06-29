/**
 * Loads Lottie JSON into offscreen canvas-renderer instances and exposes the
 * rendered frame at an arbitrary local time, so the compositor can drawImage it.
 */

import lottie, { type AnimationItem } from 'lottie-web';

interface Entry {
  anim: AnimationItem;
  container: HTMLDivElement;
  canvas: HTMLCanvasElement | null;
  totalFrames: number;
  frameRate: number;
  ready: boolean;
  w: number;
  h: number;
}

const cache = new Map<string, Entry>();
const sources = new Map<string, unknown>(); // lottieId -> animationData json
const readyListeners = new Set<() => void>();

/** Subscribe to "an animation finished loading" so the preview can repaint. */
export function onLottieReady(cb: () => void): () => void {
  readyListeners.add(cb);
  return () => readyListeners.delete(cb);
}

export function registerLottie(id: string, json: unknown): void {
  sources.set(id, json);
}

export function getLottieMeta(id: string): { duration: number; w: number; h: number } | null {
  const j = sources.get(id) as
    | { op?: number; ip?: number; fr?: number; w?: number; h?: number }
    | undefined;
  if (!j) return null;
  const fr = j.fr ?? 30;
  const frames = (j.op ?? 0) - (j.ip ?? 0);
  return { duration: frames / fr, w: j.w ?? 512, h: j.h ?? 512 };
}

function ensure(id: string): Entry | null {
  const existing = cache.get(id);
  if (existing) return existing;
  const json = sources.get(id);
  if (!json) return null;

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  const meta = getLottieMeta(id) ?? { duration: 1, w: 512, h: 512 };
  const anim = lottie.loadAnimation({
    container,
    renderer: 'canvas',
    loop: false,
    autoplay: false,
    animationData: JSON.parse(JSON.stringify(json)),
    rendererSettings: { clearCanvas: true, preserveAspectRatio: 'xMidYMid meet' },
  });

  const entry: Entry = {
    anim,
    container,
    canvas: null,
    totalFrames: anim.totalFrames || 30,
    frameRate: anim.frameRate || 30,
    ready: false,
    w: meta.w,
    h: meta.h,
  };

  anim.addEventListener('DOMLoaded', () => {
    entry.canvas = container.querySelector('canvas');
    entry.totalFrames = anim.totalFrames || entry.totalFrames;
    entry.frameRate = anim.frameRate || entry.frameRate;
    entry.ready = true;
    for (const cb of readyListeners) {
      try {
        cb();
      } catch {
        /* ignore listener errors */
      }
    }
  });

  cache.set(id, entry);
  return entry;
}

/** Returns the offscreen canvas rendered at `localTime` (seconds), or null if not ready. */
export function frameAt(id: string, localTime: number, loop: boolean, speed: number): HTMLCanvasElement | null {
  const e = ensure(id);
  if (!e || !e.ready || !e.canvas) return null;
  const durFrames = e.totalFrames;
  let frame = localTime * e.frameRate * speed;
  if (loop && durFrames > 0) frame = frame % durFrames;
  frame = Math.max(0, Math.min(durFrames - 1, frame));
  try {
    e.anim.goToAndStop(frame, true);
  } catch {
    return null;
  }
  return e.canvas;
}

export function disposeLottie(id: string): void {
  const e = cache.get(id);
  if (!e) return;
  try {
    e.anim.destroy();
    e.container.remove();
  } catch {
    /* ignore */
  }
  cache.delete(id);
}

export function warmLottie(id: string): void {
  ensure(id);
}
