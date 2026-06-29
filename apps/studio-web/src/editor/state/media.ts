/** Imported media assets. URLs are client object URLs (instant, no upload needed). */

import { uid } from './project.ts';

export type MediaKind = 'video' | 'image' | 'audio';

export interface MediaAsset {
  id: string;
  name: string;
  kind: MediaKind;
  url: string; // object URL
  duration: number; // seconds (0 for images use a default)
  width: number;
  height: number;
  thumb: string | null; // data URL preview
  file?: File;
}

export function kindOf(file: File): MediaKind | null {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  // fall back on extension
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) return 'video';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) return 'audio';
  return null;
}

/** Probe a media file in the browser to read duration + dimensions + a thumbnail. */
export async function probeMedia(file: File): Promise<MediaAsset> {
  const kind = kindOf(file);
  const url = URL.createObjectURL(file);
  const base: MediaAsset = {
    id: uid('media'),
    name: file.name,
    kind: kind ?? 'video',
    url,
    duration: 0,
    width: 0,
    height: 0,
    thumb: null,
    file,
  };

  if (kind === 'image') {
    const img = await loadImage(url);
    base.width = img.naturalWidth;
    base.height = img.naturalHeight;
    base.duration = 5; // default still duration
    base.thumb = thumbFromDrawable(img, img.naturalWidth, img.naturalHeight);
    return base;
  }

  if (kind === 'audio') {
    const a = document.createElement('audio');
    a.src = url;
    await once(a, 'loadedmetadata');
    base.duration = isFinite(a.duration) ? a.duration : 0;
    return base;
  }

  // video
  const v = document.createElement('video');
  v.src = url;
  v.muted = true;
  await once(v, 'loadedmetadata');
  base.duration = isFinite(v.duration) ? v.duration : 0;
  base.width = v.videoWidth;
  base.height = v.videoHeight;
  // grab a thumbnail near the start
  try {
    await seek(v, Math.min(0.1, base.duration / 2));
    base.thumb = thumbFromDrawable(v, v.videoWidth, v.videoHeight);
  } catch {
    /* ignore thumb failure */
  }
  return base;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function once(el: HTMLMediaElement, ev: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => {
      cleanup();
      resolve();
    };
    const bad = () => {
      cleanup();
      reject(new Error(`media error on ${ev}`));
    };
    const cleanup = () => {
      el.removeEventListener(ev, ok);
      el.removeEventListener('error', bad);
    };
    el.addEventListener(ev, ok, { once: true });
    el.addEventListener('error', bad, { once: true });
  });
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      v.removeEventListener('seeked', done);
      resolve();
    };
    v.addEventListener('seeked', done, { once: true });
    v.currentTime = t;
  });
}

function thumbFromDrawable(
  src: CanvasImageSource,
  w: number,
  h: number,
): string | null {
  try {
    const tw = 160;
    const th = Math.max(1, Math.round((h / w) * tw));
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(src, 0, 0, tw, th);
    return c.toDataURL('image/jpeg', 0.6);
  } catch {
    return null;
  }
}
