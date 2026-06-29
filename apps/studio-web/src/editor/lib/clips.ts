/** Factory functions that build clips for the timeline. */

import {
  type Clip,
  type MediaClip,
  type TextClip,
  type LottieClip,
  uid,
  defaultTransform,
  defaultFilters,
  defaultTextStyle,
} from '../state/project.ts';
import type { MediaAsset } from '../state/media.ts';

const common = (trackId: string, start: number, duration: number, name: string) => ({
  id: uid('clip'),
  trackId,
  name,
  start: Math.max(0, start),
  duration,
  transform: defaultTransform(),
  filters: defaultFilters(),
  volume: 1,
  fadeIn: 0,
  fadeOut: 0,
  keyframes: [],
});

export function mediaClip(asset: MediaAsset, trackId: string, start: number): MediaClip {
  const dur = asset.duration > 0 ? asset.duration : 5;
  return {
    ...common(trackId, start, dur, asset.name),
    type: asset.kind, // 'video' | 'image' | 'audio'
    mediaId: asset.id,
    src: asset.url,
    inPoint: 0,
    outPoint: dur,
  } as MediaClip;
}

export function textClip(trackId: string, start: number, text = 'Текст'): TextClip {
  return {
    ...common(trackId, start, 3, text.slice(0, 20) || 'Текст'),
    type: 'text',
    text,
    style: defaultTextStyle(),
  };
}

export function lottieClip(
  lottieId: string,
  name: string,
  trackId: string,
  start: number,
  duration: number,
): LottieClip {
  return {
    ...common(trackId, start, Math.max(0.5, duration), name),
    type: 'lottie',
    lottieId,
    loop: true,
    speed: 1,
  };
}

/** End time used to auto-append clips at the tail of a track. */
export function appendStart(clips: Clip[]): number {
  let max = 0;
  for (const c of clips) max = Math.max(max, c.start + c.duration);
  return max;
}
