import { useRef, useState } from 'react';
import { api } from '../../lib/api.ts';
import { useProject } from '../state/store.tsx';
import { parseSubtitles, toSrt, autoSplit, type Cue } from '../lib/subtitles.ts';
import { textClip } from '../lib/clips.ts';
import { uid, type Project, type TextClip } from '../state/project.ts';

type Pos = 'bottom' | 'center' | 'top';

export default function CaptionsPanel() {
  const store = useProject();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [draft, setDraft] = useState('');
  const [size, setSize] = useState(60);
  const [color, setColor] = useState('#ffffff');
  const [withBg, setWithBg] = useState(true);
  const [pos, setPos] = useState<Pos>('bottom');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [model, setModel] = useState('small');
  const [lang, setLang] = useState('');

  const importFile = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    setErr(null);
    try {
      const txt = await files[0].text();
      setCues(parseSubtitles(txt));
    } catch (e) {
      setErr(`Импорт не удался: ${(e as Error).message}`);
    }
  };

  const fromText = () => {
    setErr(null);
    setCues(autoSplit(draft, store.duration));
  };

  const autoFromVideo = async () => {
    setErr(null);
    const asset = pickVideoAsset();
    if (!asset || !asset.file) {
      setErr('Сначала импортируйте видео/аудио во вкладке «Медиа».');
      return;
    }
    setBusy(`Whisper (${model}) распознаёт речь…`);
    try {
      const res = await fetch(api.captions.transcribeUrl(asset.name, model, lang || undefined), {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: asset.file,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { srt: string };
      setCues(parseSubtitles(data.srt ?? ''));
    } catch (e) {
      setErr(`Авто‑субтитры (Whisper): ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const updateCue = (i: number, patch: Partial<Cue>) =>
    setCues((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const removeCue = (i: number) => setCues((cs) => cs.filter((_, j) => j !== i));
  const addCue = () =>
    setCues((cs) => [...cs, { start: store.playhead, end: store.playhead + 2, text: 'Новый субтитр' }]);

  const applyToTimeline = () => {
    if (cues.length === 0) return;
    // Build the whole next project atomically (avoid stale state between dispatches).
    let project: Project = store.project;
    let track = project.tracks.find((t) => t.name === 'Субтитры');
    if (!track) {
      track = {
        id: uid('trk'),
        kind: 'overlay',
        name: 'Субтитры',
        clips: [],
        muted: false,
        hidden: false,
        locked: false,
      };
      project = { ...project, tracks: [...project.tracks, track] };
    }
    const trackId = track.id;
    const y = pos === 'bottom' ? project.height * 0.34 : pos === 'top' ? -project.height * 0.34 : 0;
    const newClips: TextClip[] = cues.map((c) => {
      const clip = textClip(trackId, c.start, c.text);
      clip.duration = Math.max(0.3, c.end - c.start);
      clip.transform = { ...clip.transform, y };
      clip.style = {
        ...clip.style,
        fontSize: size,
        color,
        bg: withBg ? 'rgba(0,0,0,0.55)' : null,
        strokeWidth: withBg ? 0 : 6,
        align: 'center',
      };
      clip.name = c.text.slice(0, 18) || 'Субтитр';
      return clip;
    });
    const next: Project = {
      ...project,
      tracks: project.tracks.map((t) => (t.id === trackId ? { ...t, clips: newClips } : t)),
    };
    store.setProject(next);
  };

  const exportSrt = () => {
    const blob = new Blob([toSrt(cues)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${store.project.name || 'subtitles'}.srt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const pickVideoAsset = () =>
    store.media.find((m) => m.kind === 'video') ?? store.media.find((m) => m.kind === 'audio');

  return (
    <div className="panel">
      <h3>Субтитры</h3>

      <div className="btn-col">
        <button className="primary block" onClick={() => fileRef.current?.click()}>⬆ Импорт .srt / .vtt</button>
      </div>
      <input ref={fileRef} type="file" accept=".srt,.vtt,text/plain" style={{ display: 'none' }} onChange={(e) => importFile(e.target.files)} />

      <div className="insp-section mt-12">
        <div className="insp-title">Авто‑субтитры · Whisper (локально)</div>
        <div className="row gap-12">
          <div style={{ flex: 1 }}>
            <label>Модель</label>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="tiny">tiny (быстро)</option>
              <option value="base">base</option>
              <option value="small">small</option>
              <option value="medium">medium</option>
              <option value="turbo">turbo (точно)</option>
            </select>
          </div>
          <div style={{ width: 90 }}>
            <label>Язык</label>
            <input placeholder="auto" value={lang} onChange={(e) => setLang(e.target.value)} />
          </div>
        </div>
        <button className="block mt-12" onClick={autoFromVideo} disabled={!!busy}>
          {busy ? '⏳ ' + busy : '🎧 Распознать речь из видео'}
        </button>
        <p className="dim sm">Использует Whisper на вашем ПК. Первый запуск модели скачает её один раз.</p>
      </div>

      <label className="mt-12">Сгенерировать из текста</label>
      <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Вставьте сценарий — разобьём по фразам на длину проекта" />
      <button className="block mt-12" onClick={fromText}>✂ Разбить текст на субтитры</button>

      <div className="insp-section mt-16">
        <div className="insp-title">Стиль</div>
        <div className="row gap-12">
          <div style={{ flex: 1 }}><label>Размер</label><input type="number" value={size} onChange={(e) => setSize(Number(e.target.value))} /></div>
          <div><label>Цвет</label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></div>
        </div>
        <label className="chk mt-12"><input type="checkbox" checked={withBg} onChange={(e) => setWithBg(e.target.checked)} /> Подложка под текст</label>
        <label className="mt-12">Позиция</label>
        <div className="seg">
          {(['top', 'center', 'bottom'] as Pos[]).map((p) => (
            <button key={p} className={pos === p ? 'on' : ''} onClick={() => setPos(p)}>
              {p === 'top' ? 'Сверху' : p === 'center' ? 'Центр' : 'Снизу'}
            </button>
          ))}
        </div>
      </div>

      <div className="row between mt-12">
        <button className="primary" onClick={applyToTimeline} disabled={cues.length === 0}>✓ На таймлайн ({cues.length})</button>
        <button onClick={exportSrt} disabled={cues.length === 0}>⬇ .srt</button>
        <button onClick={addCue}>＋ реплика</button>
      </div>
      {err && <p className="error sm">{err}</p>}

      <div className="cue-list mt-12">
        {cues.map((c, i) => (
          <div key={i} className="cue">
            <div className="row gap-12">
              <input className="cue-t" type="number" step={0.1} value={round(c.start)} onChange={(e) => updateCue(i, { start: Number(e.target.value) })} />
              <span className="dim">→</span>
              <input className="cue-t" type="number" step={0.1} value={round(c.end)} onChange={(e) => updateCue(i, { end: Number(e.target.value) })} />
              <button className="danger sm" onClick={() => removeCue(i)}>✕</button>
            </div>
            <textarea rows={1} value={c.text} onChange={(e) => updateCue(i, { text: e.target.value })} />
          </div>
        ))}
      </div>
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
