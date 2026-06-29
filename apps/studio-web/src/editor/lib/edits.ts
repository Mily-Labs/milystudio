/** Pure editing operations: split / duplicate. They return new clip objects. */

import { type Clip, type MediaClip, uid } from '../state/project.ts';

/** Split a clip at an absolute timeline time. Returns [left, right] or null. */
export function splitAt(clip: Clip, time: number): [Clip, Clip] | null {
  const localOffset = time - clip.start;
  if (localOffset <= 0.02 || localOffset >= clip.duration - 0.02) return null;

  const left: Clip = { ...clip, duration: localOffset } as Clip;
  const right: Clip = {
    ...clip,
    id: uid('clip'),
    start: clip.start + localOffset,
    duration: clip.duration - localOffset,
  } as Clip;

  // for media clips, advance the source in-point on the right half
  if (clip.type === 'video' || clip.type === 'audio') {
    const mc = clip as MediaClip;
    (right as MediaClip).inPoint = mc.inPoint + localOffset;
  }
  return [left, right];
}

export function duplicate(clip: Clip): Clip {
  return {
    ...clip,
    id: uid('clip'),
    start: clip.start + clip.duration,
    name: clip.name,
  } as Clip;
}
