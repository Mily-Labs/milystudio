/**
 * Frame compositor. Owns a pool of <video> elements and draws the composed
 * frame for a given project time onto a 2D canvas. Tracks render bottom→top so
 * overlays/text land above the video.
 */

import {
  type Project,
  type Clip,
  type MediaClip,
  type TextClip,
  type LottieClip,
  type Transform,
} from '../state/project.ts';
import { frameAt } from './lottieCache.ts';

export class Compositor {
  private videos = new Map<string, HTMLVideoElement>();
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;
  }

  /** Lazily create / fetch the hidden <video> for a media clip. */
  getVideo(clip: MediaClip): HTMLVideoElement {
    let v = this.videos.get(clip.mediaId);
    if (!v) {
      v = document.createElement('video');
      v.src = clip.src;
      v.muted = clip.type === 'video' ? false : true;
      v.playsInline = true;
      v.preload = 'auto';
      v.style.display = 'none';
      v.crossOrigin = 'anonymous';
      document.body.appendChild(v);
      this.videos.set(clip.mediaId, v);
    }
    return v;
  }

  allVideos(): HTMLVideoElement[] {
    return [...this.videos.values()];
  }

  /** Inject an externally-managed video element (used by the exporter). */
  setVideo(mediaId: string, el: HTMLVideoElement): void {
    this.videos.set(mediaId, el);
  }

  activeClips(project: Project, time: number): { track: number; clip: Clip }[] {
    const out: { track: number; clip: Clip }[] = [];
    const ordered = [...project.tracks].reverse(); // bottom first
    ordered.forEach((t, i) => {
      if (t.hidden) return;
      for (const c of t.clips) {
        if (time >= c.start && time < c.start + c.duration) out.push({ track: i, clip: c });
      }
    });
    return out;
  }

  /** Resolve transform with keyframe interpolation at local time. */
  private resolveTransform(clip: Clip, localTime: number): Transform {
    const base = clip.transform;
    if (!clip.keyframes || clip.keyframes.length === 0) return base;
    const kfs = [...clip.keyframes].sort((a, b) => a.t - b.t);
    let prev = kfs[0];
    let next = kfs[kfs.length - 1];
    for (let i = 0; i < kfs.length; i++) {
      if (kfs[i].t <= localTime) prev = kfs[i];
      if (kfs[i].t >= localTime) {
        next = kfs[i];
        break;
      }
    }
    const span = next.t - prev.t;
    const f = span > 0 ? (localTime - prev.t) / span : 0;
    const lerp = (a: number | undefined, b: number | undefined, d: number) =>
      (a ?? d) + ((b ?? d) - (a ?? d)) * f;
    return {
      x: lerp(prev.props.x, next.props.x, base.x),
      y: lerp(prev.props.y, next.props.y, base.y),
      scale: lerp(prev.props.scale, next.props.scale, base.scale),
      rotation: lerp(prev.props.rotation, next.props.rotation, base.rotation),
      opacity: lerp(prev.props.opacity, next.props.opacity, base.opacity),
    };
  }

  private fadeOpacity(clip: Clip, time: number): number {
    const local = time - clip.start;
    let o = 1;
    if (clip.fadeIn > 0 && local < clip.fadeIn) o *= local / clip.fadeIn;
    const tailStart = clip.duration - clip.fadeOut;
    if (clip.fadeOut > 0 && local > tailStart) o *= Math.max(0, (clip.duration - local) / clip.fadeOut);
    return o;
  }

  /** For scrubbing: align hidden video currentTime to the playhead. */
  syncVideoTimes(project: Project, time: number, playing: boolean): void {
    if (playing) return;
    for (const t of project.tracks) {
      for (const c of t.clips) {
        if (c.type !== 'video' && c.type !== 'audio') continue;
        if (time < c.start || time >= c.start + c.duration) continue;
        const mc = c as MediaClip;
        const target = mc.inPoint + (time - c.start) * (mc.speed ?? 1);
        const v = this.getVideo(mc);
        if (Math.abs(v.currentTime - target) > 0.06) {
          try {
            v.currentTime = target;
          } catch {
            /* not seekable yet */
          }
        }
      }
    }
  }

  /** Enter/exit ("появление/исчезание") animation contribution at the given time. */
  private animState(clip: Clip, time: number): { opacity: number; dx: number; dy: number; scale: number } {
    const W = this.canvas.width;
    const H = this.canvas.height;
    let opacity = 1;
    let dx = 0;
    let dy = 0;
    let scale = 1;
    const local = time - clip.start;

    const applyEnter = (a: NonNullable<Clip['appear']>, p: number) => {
      const k = 1 - p; // remaining offset magnitude
      switch (a.type) {
        case 'fade': opacity *= p; break;
        case 'slideL': dx -= k * W * 0.5; opacity *= Math.min(1, p * 1.5); break;
        case 'slideR': dx += k * W * 0.5; opacity *= Math.min(1, p * 1.5); break;
        case 'slideU': dy -= k * H * 0.5; opacity *= Math.min(1, p * 1.5); break;
        case 'slideD': dy += k * H * 0.5; opacity *= Math.min(1, p * 1.5); break;
        case 'zoom': scale *= 0.2 + 0.8 * p; opacity *= p; break;
        case 'pop': scale *= popEase(p); opacity *= Math.min(1, p * 2); break;
      }
    };

    if (clip.appear && clip.appear.duration > 0 && local < clip.appear.duration) {
      applyEnter(clip.appear, Math.max(0, local / clip.appear.duration));
    }
    if (clip.disappear && clip.disappear.duration > 0) {
      const tail = clip.duration - local;
      if (tail < clip.disappear.duration) {
        applyEnter(clip.disappear, Math.max(0, tail / clip.disappear.duration));
      }
    }
    return { opacity, dx, dy, scale };
  }

  /** Clip subsequent drawing to a screen-space mask window (set before transform). */
  private applyMask(m: NonNullable<Clip['mask']>): void {
    const { ctx, canvas } = this;
    const cx = m.x * canvas.width;
    const cy = m.y * canvas.height;
    const w = m.w * canvas.width;
    const h = m.h * canvas.height;
    ctx.beginPath();
    if (m.invert) {
      // outer rect + inner shape, even-odd → keep the OUTSIDE of the shape
      ctx.rect(0, 0, canvas.width, canvas.height);
    }
    if (m.shape === 'ellipse') {
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    } else {
      ctx.rect(cx - w / 2, cy - h / 2, w, h);
    }
    ctx.clip('evenodd');
  }

  draw(project: Project, time: number): void {
    const { ctx, canvas } = this;
    canvas.width = project.width;
    canvas.height = project.height;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    for (const { clip } of this.activeClips(project, time)) {
      const local = time - clip.start;
      const tr = this.resolveTransform(clip, local);
      const anim = this.animState(clip, time);
      const opacity = tr.opacity * this.fadeOpacity(clip, time) * anim.opacity;
      if (opacity <= 0.001) continue;

      ctx.save();
      ctx.globalAlpha = opacity;
      if (clip.mask?.enabled) this.applyMask(clip.mask);
      ctx.translate(canvas.width / 2 + tr.x + anim.dx, canvas.height / 2 + tr.y + anim.dy);
      ctx.rotate((tr.rotation * Math.PI) / 180);
      ctx.scale(tr.scale * anim.scale, tr.scale * anim.scale);
      const f = clip.filters;
      ctx.filter = `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturate}) blur(${f.blur}px) hue-rotate(${f.hue}deg) sepia(${f.sepia ?? 0}) grayscale(${f.grayscale ?? 0}) invert(${f.invert ?? 0})`;

      try {
        if (clip.type === 'video') this.drawVideo(clip as MediaClip);
        else if (clip.type === 'image') this.drawImage(clip as MediaClip);
        else if (clip.type === 'text') this.drawText(clip as TextClip);
        else if (clip.type === 'lottie') this.drawLottie(clip as LottieClip, local);
      } catch {
        /* skip frame errors */
      }
      ctx.restore();
    }
  }

  private imgCache = new Map<string, HTMLImageElement>();

  private drawImage(clip: MediaClip): void {
    let img = this.imgCache.get(clip.mediaId);
    if (!img) {
      img = new Image();
      img.src = clip.src;
      this.imgCache.set(clip.mediaId, img);
    }
    if (!img.complete || img.naturalWidth === 0) return;
    if (clip.chroma?.enabled) this.drawChroma(img, img.naturalWidth, img.naturalHeight, clip.chroma);
    else this.drawContain(img, img.naturalWidth, img.naturalHeight);
  }

  private drawVideo(clip: MediaClip): void {
    const v = this.getVideo(clip);
    if (v.readyState < 2 || v.videoWidth === 0) return;
    if (clip.chroma?.enabled) this.drawChroma(v, v.videoWidth, v.videoHeight, clip.chroma);
    else this.drawContain(v, v.videoWidth, v.videoHeight);
  }

  private scratch: HTMLCanvasElement | null = null;

  /** Colour-key out the background, then draw the keyed result (contain-fit). */
  private drawChroma(
    src: CanvasImageSource,
    sw: number,
    sh: number,
    key: { color: string; similarity: number; smoothness: number },
  ): void {
    // bound processing cost: cap the scratch width
    const cap = 720;
    const scale = Math.min(1, cap / sw);
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    if (!this.scratch) this.scratch = document.createElement('canvas');
    const sc = this.scratch;
    sc.width = w;
    sc.height = h;
    const sctx = sc.getContext('2d', { willReadFrequently: true });
    if (!sctx) return;
    sctx.clearRect(0, 0, w, h);
    sctx.drawImage(src, 0, 0, w, h);
    const img = sctx.getImageData(0, 0, w, h);
    const d = img.data;
    const [kr, kg, kb] = hexRgb(key.color);
    const sim = key.similarity * 255; // distance threshold per maxdist scaling
    const smooth = Math.max(0.001, key.smoothness * 255);
    for (let i = 0; i < d.length; i += 4) {
      const dist = Math.sqrt(
        (d[i] - kr) ** 2 + (d[i + 1] - kg) ** 2 + (d[i + 2] - kb) ** 2,
      );
      if (dist < sim) {
        d[i + 3] = 0;
      } else if (dist < sim + smooth) {
        d[i + 3] = Math.round(((dist - sim) / smooth) * d[i + 3]);
      }
    }
    sctx.putImageData(img, 0, 0);
    this.drawContain(sc, w, h);
  }

  private drawContain(src: CanvasImageSource, sw: number, sh: number): void {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const scale = Math.min(cw / sw, ch / sh);
    const w = sw * scale;
    const h = sh * scale;
    this.ctx.drawImage(src, -w / 2, -h / 2, w, h);
  }

  private drawText(clip: TextClip): void {
    const { ctx } = this;
    const s = clip.style;
    ctx.filter = 'none';
    ctx.textAlign = s.align;
    ctx.textBaseline = 'middle';
    ctx.font = `${s.italic ? 'italic ' : ''}${s.weight} ${s.fontSize}px ${s.fontFamily}`;
    const lines = clip.text.split('\n');
    const lh = s.fontSize * s.lineHeight;
    const totalH = lh * lines.length;
    let y = -totalH / 2 + lh / 2;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      const ax = s.align === 'left' ? 0 : s.align === 'right' ? -w : -w / 2;
      if (s.bg) {
        ctx.fillStyle = s.bg;
        ctx.fillRect(ax - 16, y - lh / 2, w + 32, lh);
      }
      if (s.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = s.fontSize * 0.08;
        ctx.shadowOffsetY = s.fontSize * 0.04;
      }
      if (s.stroke && s.strokeWidth > 0) {
        ctx.lineWidth = s.strokeWidth;
        ctx.strokeStyle = s.stroke;
        ctx.lineJoin = 'round';
        ctx.strokeText(line, 0, y);
      }
      ctx.fillStyle = s.color;
      ctx.fillText(line, 0, y);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      y += lh;
    }
  }

  private drawLottie(clip: LottieClip, local: number): void {
    const fc = frameAt(clip.lottieId, local, clip.loop, clip.speed);
    if (!fc) return;
    this.drawContain(fc, fc.width, fc.height);
  }

  dispose(): void {
    for (const v of this.videos.values()) {
      v.pause();
      v.remove();
    }
    this.videos.clear();
    this.imgCache.clear();
  }
}

function popEase(p: number): number {
  // easeOutBack — slight overshoot then settle to 1
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = Math.min(1, Math.max(0, p));
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

function hexRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(v.slice(0, 6) || '00d000', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
