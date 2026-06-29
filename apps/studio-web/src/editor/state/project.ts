/**
 * Core project model. Everything in the editor revolves around this structure.
 * Times are in SECONDS. Coordinates/sizes for transforms are in project pixels
 * relative to the composition centre (0,0 = centre, like CapCut).
 */

export type TrackKind = 'video' | 'audio' | 'text' | 'overlay';
export type ClipType = 'video' | 'image' | 'audio' | 'text' | 'lottie';

export interface Transform {
  x: number; // px offset from centre
  y: number;
  scale: number; // 1 = 100%
  rotation: number; // degrees
  opacity: number; // 0..1
}

export interface Filters {
  brightness: number; // 1 = normal
  contrast: number;
  saturate: number;
  blur: number; // px
  hue: number; // deg
  sepia: number; // 0..1
  grayscale: number; // 0..1
  invert: number; // 0..1
}

/** Enter/exit animation ("появление / исчезание"). */
export type AnimType =
  | 'fade'
  | 'slideL'
  | 'slideR'
  | 'slideU'
  | 'slideD'
  | 'zoom'
  | 'pop';

export interface Anim {
  type: AnimType;
  duration: number; // seconds
}

/** Colour-key background removal (chroma key / green screen). */
export interface ChromaKey {
  enabled: boolean;
  color: string; // hex key colour
  similarity: number; // 0..1 tolerance
  smoothness: number; // 0..1 edge softness
}

/** Shape mask — clips the layer to a screen-space window. */
export interface Mask {
  enabled: boolean;
  shape: 'rect' | 'ellipse';
  x: number; // 0..1 centre, fraction of frame
  y: number;
  w: number; // 0..1 size
  h: number;
  invert: boolean;
}

export interface Keyframe {
  t: number; // local time within clip, seconds
  props: Partial<Transform>;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number; // px in project space
  color: string;
  weight: number;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  bg: string | null; // background box colour or null
  stroke: string | null;
  strokeWidth: number;
  shadow: boolean;
  lineHeight: number;
}

export interface BaseClip {
  id: string;
  trackId: string;
  type: ClipType;
  name: string;
  start: number; // timeline position, seconds
  duration: number; // seconds on the timeline
  transform: Transform;
  filters: Filters;
  volume: number; // 0..1 (audio/video)
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  keyframes: Keyframe[];
  appear?: Anim; // enter animation
  disappear?: Anim; // exit animation
  mask?: Mask; // shape mask
}

export interface MediaClip extends BaseClip {
  type: 'video' | 'image' | 'audio';
  mediaId: string;
  src: string;
  inPoint: number; // source trim start, seconds (video/audio)
  outPoint: number; // source trim end, seconds
  speed?: number; // playback rate (1 = normal)
  chroma?: ChromaKey; // background removal
}

export interface TextClip extends BaseClip {
  type: 'text';
  text: string;
  style: TextStyle;
}

export interface LottieClip extends BaseClip {
  type: 'lottie';
  lottieId: string; // key into the lottie cache
  loop: boolean;
  speed: number;
}

export type Clip = MediaClip | TextClip | LottieClip;

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  clips: Clip[];
  muted: boolean;
  hidden: boolean;
  locked: boolean;
}

export interface Project {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  tracks: Track[];
  version: number;
}

export const defaultTransform = (): Transform => ({
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
});

export const defaultFilters = (): Filters => ({
  brightness: 1,
  contrast: 1,
  saturate: 1,
  blur: 0,
  hue: 0,
  sepia: 0,
  grayscale: 0,
  invert: 0,
});

export const defaultChroma = (): ChromaKey => ({
  enabled: false,
  color: '#00d000',
  similarity: 0.4,
  smoothness: 0.12,
});

export const defaultMask = (): Mask => ({
  enabled: false,
  shape: 'rect',
  x: 0.5,
  y: 0.5,
  w: 0.6,
  h: 0.6,
  invert: false,
});

export const defaultTextStyle = (): TextStyle => ({
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 96,
  color: '#ffffff',
  weight: 700,
  italic: false,
  align: 'center',
  bg: null,
  stroke: '#000000',
  strokeWidth: 0,
  shadow: true,
  lineHeight: 1.2,
});

let seq = 0;
export function uid(prefix = 'id'): string {
  seq += 1;
  // performance.now is allowed in the browser; avoid Date.now per harness note.
  const t = Math.floor(performance.now() * 1000) % 1_000_000;
  return `${prefix}_${t}_${seq}`;
}

export function createEmptyProject(): Project {
  const videoTrack: Track = {
    id: uid('trk'),
    kind: 'video',
    name: 'Видео 1',
    clips: [],
    muted: false,
    hidden: false,
    locked: false,
  };
  const overlayTrack: Track = {
    id: uid('trk'),
    kind: 'overlay',
    name: 'Оверлей 1',
    clips: [],
    muted: false,
    hidden: false,
    locked: false,
  };
  const audioTrack: Track = {
    id: uid('trk'),
    kind: 'audio',
    name: 'Аудио 1',
    clips: [],
    muted: false,
    hidden: false,
    locked: false,
  };
  return {
    id: uid('prj'),
    name: 'Без названия',
    fps: 30,
    width: 1080,
    height: 1920,
    tracks: [overlayTrack, videoTrack, audioTrack],
    version: 1,
  };
}

export const clipEnd = (c: Clip): number => c.start + c.duration;

export function projectDuration(p: Project): number {
  let max = 0;
  for (const t of p.tracks) {
    for (const c of t.clips) {
      if (clipEnd(c) > max) max = clipEnd(c);
    }
  }
  return Math.max(max, 1);
}

export function findClip(p: Project, clipId: string | null): { track: Track; clip: Clip } | null {
  if (!clipId) return null;
  for (const track of p.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}
