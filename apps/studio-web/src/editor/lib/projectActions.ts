/** Higher-level editor actions shared by the toolbar and keyboard shortcuts. */

import type { useProject } from '../state/store.tsx';
import { findClip, type Project } from '../state/project.ts';
import { splitAt, duplicate } from './edits.ts';

type Store = ReturnType<typeof useProject>;

export function splitSelected(store: Store): void {
  const sel = findClip(store.project, store.selection);
  if (!sel) return;
  const res = splitAt(sel.clip, store.playhead);
  if (!res) return;
  const [left, right] = res;
  const next: Project = {
    ...store.project,
    tracks: store.project.tracks.map((t) =>
      t.id === sel.track.id
        ? { ...t, clips: t.clips.flatMap((c) => (c.id === sel.clip.id ? [left, right] : [c])) }
        : t,
    ),
  };
  store.setProject(next);
  store.select(right.id);
}

export function dupSelected(store: Store): void {
  const sel = findClip(store.project, store.selection);
  if (sel) store.addClip(sel.track.id, duplicate(sel.clip));
}

export function delSelected(store: Store): void {
  if (store.selection) store.removeClip(store.selection);
}
