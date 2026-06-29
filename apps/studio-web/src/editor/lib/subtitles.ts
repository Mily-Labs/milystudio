/** Subtitle parsing/serialisation (SRT + VTT) and cue helpers. */

export interface Cue {
  start: number; // seconds
  end: number;
  text: string;
}

function parseTimestamp(s: string): number {
  // HH:MM:SS,mmm | HH:MM:SS.mmm | MM:SS.mmm
  const m = s.trim().match(/(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})/);
  if (!m) return 0;
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const sec = Number(m[3]);
  const ms = Number(m[4].padEnd(3, '0'));
  return h * 3600 + min * 60 + sec + ms / 1000;
}

/** Parse SRT or VTT text into cues. */
export function parseSubtitles(text: string): Cue[] {
  const clean = text.replace(/^﻿/, '').replace(/\r/g, '');
  const blocks = clean.split(/\n\s*\n/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '' && l.trim().toUpperCase() !== 'WEBVTT');
    const arrowIdx = lines.findIndex((l) => l.includes('-->'));
    if (arrowIdx === -1) continue;
    const [a, b] = lines[arrowIdx].split('-->');
    const start = parseTimestamp(a);
    const end = parseTimestamp(b);
    const txt = lines.slice(arrowIdx + 1).join('\n').trim();
    if (txt) cues.push({ start, end: end > start ? end : start + 2, text: txt });
  }
  return cues.sort((x, y) => x.start - y.start);
}

function fmt(t: number): string {
  if (t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(ms, 3)}`;
}

export function toSrt(cues: Cue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}`)
    .join('\n\n')
    .concat('\n');
}

/** Naive auto-split of a paragraph into timed cues across a duration. */
export function autoSplit(text: string, total: number, perCue = 7): Cue[] {
  const sentences = text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return [];
  const span = total > 0 ? total / sentences.length : perCue;
  return sentences.map((s, i) => ({
    start: i * span,
    end: (i + 1) * span,
    text: s,
  }));
}
