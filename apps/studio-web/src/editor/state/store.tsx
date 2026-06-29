/** Single source of truth for the editor: project + media + UI state + history. */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  type Project,
  type Clip,
  type Track,
  createEmptyProject,
  projectDuration,
} from './project.ts';
import type { MediaAsset } from './media.ts';

interface State {
  project: Project;
  media: MediaAsset[];
  selection: string | null; // clip id
  playhead: number; // seconds
  zoom: number; // px per second
  isPlaying: boolean;
  past: Project[];
  future: Project[];
}

type Action =
  | { type: 'setProject'; project: Project; history?: boolean }
  | { type: 'addMedia'; assets: MediaAsset[] }
  | { type: 'addClip'; trackId: string; clip: Clip }
  | { type: 'updateClip'; clipId: string; patch: Partial<Clip> }
  | { type: 'moveClip'; clipId: string; start: number; trackId?: string }
  | { type: 'removeClip'; clipId: string }
  | { type: 'addTrack'; track: Track }
  | { type: 'updateTrack'; trackId: string; patch: Partial<Track> }
  | { type: 'select'; clipId: string | null }
  | { type: 'setPlayhead'; time: number }
  | { type: 'setZoom'; zoom: number }
  | { type: 'setPlaying'; playing: boolean }
  | { type: 'undo' }
  | { type: 'redo' };

const HISTORY_CAP = 50;

function pushHistory(s: State, next: Project): State {
  return {
    ...s,
    past: [...s.past, s.project].slice(-HISTORY_CAP),
    future: [],
    project: next,
  };
}

function mapClips(project: Project, fn: (c: Clip, t: Track) => Clip | null): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => fn(c, t)).filter((c): c is Clip => c !== null),
    })),
  };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'setProject':
      return a.history === false
        ? { ...s, project: a.project }
        : pushHistory(s, a.project);

    case 'addMedia':
      return { ...s, media: [...s.media, ...a.assets] };

    case 'addClip': {
      const next: Project = {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id === a.trackId ? { ...t, clips: [...t.clips, a.clip] } : t,
        ),
      };
      return { ...pushHistory(s, next), selection: a.clip.id };
    }

    case 'updateClip': {
      const next = mapClips(s.project, (c) =>
        c.id === a.clipId ? ({ ...c, ...a.patch } as Clip) : c,
      );
      return pushHistory(s, next);
    }

    case 'moveClip': {
      // remove from current track, place on target track
      let moving: Clip | null = null;
      const stripped: Project = {
        ...s.project,
        tracks: s.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.filter((c) => {
            if (c.id === a.clipId) {
              moving = c;
              return false;
            }
            return true;
          }),
        })),
      };
      if (!moving) return s;
      const targetTrackId = a.trackId ?? (moving as Clip).trackId;
      const placed: Clip = { ...(moving as Clip), start: Math.max(0, a.start), trackId: targetTrackId };
      const next: Project = {
        ...stripped,
        tracks: stripped.tracks.map((t) =>
          t.id === targetTrackId ? { ...t, clips: [...t.clips, placed] } : t,
        ),
      };
      return pushHistory(s, next);
    }

    case 'removeClip': {
      const next = mapClips(s.project, (c) => (c.id === a.clipId ? null : c));
      return { ...pushHistory(s, next), selection: s.selection === a.clipId ? null : s.selection };
    }

    case 'addTrack':
      return pushHistory(s, { ...s.project, tracks: [...s.project.tracks, a.track] });

    case 'updateTrack':
      return {
        ...s,
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) =>
            t.id === a.trackId ? { ...t, ...a.patch } : t,
          ),
        },
      };

    case 'select':
      return { ...s, selection: a.clipId };

    case 'setPlayhead':
      return { ...s, playhead: Math.max(0, a.time) };

    case 'setZoom':
      return { ...s, zoom: Math.min(400, Math.max(8, a.zoom)) };

    case 'setPlaying':
      return { ...s, isPlaying: a.playing };

    case 'undo': {
      if (s.past.length === 0) return s;
      const prev = s.past[s.past.length - 1];
      return {
        ...s,
        project: prev,
        past: s.past.slice(0, -1),
        future: [s.project, ...s.future].slice(0, HISTORY_CAP),
      };
    }

    case 'redo': {
      if (s.future.length === 0) return s;
      const nxt = s.future[0];
      return {
        ...s,
        project: nxt,
        past: [...s.past, s.project].slice(-HISTORY_CAP),
        future: s.future.slice(1),
      };
    }

    default:
      return s;
  }
}

function initialState(): State {
  return {
    project: createEmptyProject(),
    media: [],
    selection: null,
    playhead: 0,
    zoom: 60,
    isPlaying: false,
    past: [],
    future: [],
  };
}

interface Store extends State {
  duration: number;
  dispatch: React.Dispatch<Action>;
  setProject: (p: Project, history?: boolean) => void;
  addMedia: (assets: MediaAsset[]) => void;
  addClip: (trackId: string, clip: Clip) => void;
  updateClip: (clipId: string, patch: Partial<Clip>) => void;
  moveClip: (clipId: string, start: number, trackId?: string) => void;
  removeClip: (clipId: string) => void;
  addTrack: (track: Track) => void;
  updateTrack: (trackId: string, patch: Partial<Track>) => void;
  select: (clipId: string | null) => void;
  setPlayhead: (time: number) => void;
  setZoom: (zoom: number) => void;
  setPlaying: (playing: boolean) => void;
  undo: () => void;
  redo: () => void;
}

const Ctx = createContext<Store | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const store = useMemo<Store>(() => {
    return {
      ...state,
      duration: projectDuration(state.project),
      dispatch,
      setProject: (p, history) => dispatch({ type: 'setProject', project: p, history }),
      addMedia: (assets) => dispatch({ type: 'addMedia', assets }),
      addClip: (trackId, clip) => dispatch({ type: 'addClip', trackId, clip }),
      updateClip: (clipId, patch) => dispatch({ type: 'updateClip', clipId, patch }),
      moveClip: (clipId, start, trackId) => dispatch({ type: 'moveClip', clipId, start, trackId }),
      removeClip: (clipId) => dispatch({ type: 'removeClip', clipId }),
      addTrack: (track) => dispatch({ type: 'addTrack', track }),
      updateTrack: (trackId, patch) => dispatch({ type: 'updateTrack', trackId, patch }),
      select: (clipId) => dispatch({ type: 'select', clipId }),
      setPlayhead: (time) => dispatch({ type: 'setPlayhead', time }),
      setZoom: (zoom) => dispatch({ type: 'setZoom', zoom }),
      setPlaying: (playing) => dispatch({ type: 'setPlaying', playing }),
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
    };
  }, [state]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useProject(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProject must be used within ProjectProvider');
  return v;
}

/** Stable helper to build a default clip from a media asset. */
export { initialState };

export function useSelectedClip() {
  const { project, selection } = useProject();
  return useCallback(() => {
    for (const t of project.tracks) {
      const c = t.clips.find((x) => x.id === selection);
      if (c) return c;
    }
    return null;
  }, [project, selection])();
}
