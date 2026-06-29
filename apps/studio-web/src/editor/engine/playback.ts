/**
 * Media synchronisation for transport. Owns <audio> elements for audio clips and
 * drives play/pause/seek/volume of both audio and the compositor's video elements
 * so the timeline stays in sync during playback.
 */

import type { Project, MediaClip } from '../state/project.ts';
import type { Compositor } from './compositor.ts';

export class MediaSync {
  private audios = new Map<string, HTMLAudioElement>();
  constructor(private comp: Compositor) {}

  private audio(mediaId: string, src: string): HTMLAudioElement {
    let a = this.audios.get(mediaId);
    if (!a) {
      a = new Audio(src);
      a.preload = 'auto';
      this.audios.set(mediaId, a);
    }
    return a;
  }

  private fade(clip: MediaClip, time: number): number {
    const local = time - clip.start;
    let v = clip.volume;
    if (clip.fadeIn > 0 && local < clip.fadeIn) v *= local / clip.fadeIn;
    const tail = clip.duration - clip.fadeOut;
    if (clip.fadeOut > 0 && local > tail) v *= Math.max(0, (clip.duration - local) / clip.fadeOut);
    return Math.max(0, Math.min(1, v));
  }

  update(project: Project, time: number, playing: boolean): void {
    const activeEls = new Set<HTMLMediaElement>();

    for (const track of project.tracks) {
      for (const c of track.clips) {
        if (c.type !== 'audio' && c.type !== 'video') continue;
        const mc = c as MediaClip;
        const active = time >= c.start && time < c.start + c.duration;
        const el =
          c.type === 'audio' ? this.audio(mc.mediaId, mc.src) : this.comp.getVideo(mc);

        if (active && playing) {
          activeEls.add(el);
          const speed = Math.min(4, Math.max(0.25, mc.speed ?? 1));
          if (el.playbackRate !== speed) el.playbackRate = speed;
          const target = mc.inPoint + (time - c.start) * speed;
          if (Math.abs(el.currentTime - target) > 0.3) {
            try {
              el.currentTime = target;
            } catch {
              /* not ready */
            }
          }
          el.volume = this.fade(mc, time);
          el.muted = track.muted || (c.type === 'video' && false);
          if (el.paused) el.play().catch(() => {});
        }
      }
    }

    // pause everything that should not be sounding
    for (const a of this.audios.values()) if (!activeEls.has(a)) a.pause();
    for (const v of this.comp.allVideos()) if (!activeEls.has(v)) v.pause();
  }

  stopAll(): void {
    for (const a of this.audios.values()) a.pause();
    for (const v of this.comp.allVideos()) v.pause();
  }

  dispose(): void {
    this.stopAll();
    this.audios.clear();
  }
}
