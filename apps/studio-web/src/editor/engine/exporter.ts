/**
 * Client-side export. Records the compositor canvas + mixed media audio in real
 * time via MediaRecorder. Produces a self-contained WebM with everything visible
 * in the preview (video, images, text, lottie, effects) plus audio. No server
 * needed — this is the reliable MVP render path (high-quality ffmpeg = phase 7.2).
 */

import { Compositor } from './compositor.ts';
import { type Project, type MediaClip, projectDuration } from '../state/project.ts';

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  onProgress?: (p: number) => void;
  signal?: { cancelled: boolean };
}

function pickMime(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'video/webm';
}

export async function exportProject(
  project: Project,
  opts: ExportOptions,
): Promise<Blob> {
  const duration = projectDuration(project);
  const canvas = document.createElement('canvas');
  canvas.width = opts.width;
  canvas.height = opts.height;
  const comp = new Compositor(canvas);

  // Export uses a render project scaled to the requested resolution.
  const sx = opts.width / project.width;
  const sy = opts.height / project.height;
  const renderProject: Project = {
    ...project,
    width: opts.width,
    height: opts.height,
    tracks: project.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => ({
        ...c,
        transform: {
          ...c.transform,
          x: c.transform.x * sx,
          y: c.transform.y * sy,
        },
      })),
    })),
  };

  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const dest = audioCtx.createMediaStreamDestination();
  const elements: HTMLMediaElement[] = [];
  const byId = new Map<string, HTMLMediaElement>();

  // Build fresh elements with audio routed into the capture graph.
  for (const track of renderProject.tracks) {
    for (const c of track.clips) {
      if (c.type !== 'video' && c.type !== 'audio') continue;
      const mc = c as MediaClip;
      if (byId.has(mc.mediaId)) continue;
      const el: HTMLMediaElement =
        c.type === 'video' ? document.createElement('video') : new Audio();
      el.src = mc.src;
      el.preload = 'auto';
      (el as HTMLVideoElement).muted = false;
      el.crossOrigin = 'anonymous';
      try {
        const node = audioCtx.createMediaElementSource(el);
        node.connect(dest);
        node.connect(audioCtx.destination);
      } catch {
        /* element may have no audio track */
      }
      byId.set(mc.mediaId, el);
      elements.push(el);
      if (c.type === 'video') comp.setVideo(mc.mediaId, el as HTMLVideoElement);
    }
  }

  await Promise.all(
    elements.map(
      (el) =>
        new Promise<void>((resolve) => {
          if (el.readyState >= 1) return resolve();
          el.addEventListener('loadedmetadata', () => resolve(), { once: true });
          el.addEventListener('error', () => resolve(), { once: true });
          // safety timeout
          setTimeout(resolve, 4000);
        }),
    ),
  );

  const stream = canvas.captureStream(opts.fps);
  for (const tr of dest.stream.getAudioTracks()) stream.addTrack(tr);

  const chunks: BlobPart[] = [];
  const mime = pickMime();
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
  });

  await audioCtx.resume();
  recorder.start(100);

  const t0 = performance.now();
  const fade = (mc: MediaClip, time: number) => {
    const local = time - mc.start;
    let v = mc.volume;
    if (mc.fadeIn > 0 && local < mc.fadeIn) v *= local / mc.fadeIn;
    const tail = mc.duration - mc.fadeOut;
    if (mc.fadeOut > 0 && local > tail) v *= Math.max(0, (mc.duration - local) / mc.fadeOut);
    return Math.max(0, Math.min(1, v));
  };

  await new Promise<void>((resolve) => {
    const loop = () => {
      const time = (performance.now() - t0) / 1000;
      if (opts.signal?.cancelled || time >= duration) {
        resolve();
        return;
      }
      // drive media elements
      for (const track of renderProject.tracks) {
        for (const c of track.clips) {
          if (c.type !== 'video' && c.type !== 'audio') continue;
          const mc = c as MediaClip;
          const el = byId.get(mc.mediaId);
          if (!el) continue;
          const active = time >= c.start && time < c.start + c.duration;
          if (active) {
            const speed = Math.min(4, Math.max(0.25, mc.speed ?? 1));
            if (el.playbackRate !== speed) el.playbackRate = speed;
            const target = mc.inPoint + (time - c.start) * speed;
            if (Math.abs(el.currentTime - target) > 0.35) {
              try {
                el.currentTime = target;
              } catch {
                /* ignore */
              }
            }
            el.volume = track.muted ? 0 : fade(mc, time);
            if (el.paused) el.play().catch(() => {});
          } else if (!el.paused) {
            el.pause();
          }
        }
      }
      comp.draw(renderProject, time);
      opts.onProgress?.(Math.min(1, time / duration));
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  recorder.stop();
  const blob = await done;

  // cleanup
  for (const el of elements) {
    el.pause();
    if (el instanceof HTMLVideoElement) el.remove();
  }
  comp.dispose();
  await audioCtx.close().catch(() => {});
  opts.onProgress?.(1);
  return blob;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
