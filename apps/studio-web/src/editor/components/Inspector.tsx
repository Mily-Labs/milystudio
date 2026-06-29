import { useProject } from '../state/store.tsx';
import {
  type Clip,
  type MediaClip,
  type TextClip,
  type LottieClip,
  type Transform,
  type Filters,
  type TextStyle,
  findClip,
} from '../state/project.ts';

export default function Inspector() {
  const store = useProject();
  const found = findClip(store.project, store.selection);

  if (!found) {
    return (
      <div className="inspector">
        <h3>Свойства</h3>
        <p className="dim sm">Выберите клип на таймлайне, чтобы редактировать его.</p>
        <div className="card-lite">
          <div className="row between"><span className="dim sm">Проект</span><b>{store.project.name}</b></div>
          <div className="row between"><span className="dim sm">Формат</span><span>{store.project.width}×{store.project.height}</span></div>
          <div className="row between"><span className="dim sm">FPS</span><span>{store.project.fps}</span></div>
        </div>
      </div>
    );
  }

  const clip = found.clip;
  const patchTransform = (p: Partial<Transform>) =>
    store.updateClip(clip.id, { transform: { ...clip.transform, ...p } } as Partial<Clip>);
  const patchFilters = (p: Partial<Filters>) =>
    store.updateClip(clip.id, { filters: { ...clip.filters, ...p } } as Partial<Clip>);

  const addKeyframe = () => {
    const local = store.playhead - clip.start;
    const kf = { t: Math.max(0, local), props: { ...clip.transform } };
    const next = [...clip.keyframes.filter((k) => Math.abs(k.t - kf.t) > 0.03), kf];
    store.updateClip(clip.id, { keyframes: next } as Partial<Clip>);
  };

  return (
    <div className="inspector">
      <h3>{label(clip)} <span className="dim sm">· {clip.name}</span></h3>

      <Section title="Время">
        <Field label="Начало, с">
          <input type="number" step={0.1} value={round(clip.start)}
            onChange={(e) => store.updateClip(clip.id, { start: Math.max(0, Number(e.target.value)) })} />
        </Field>
        <Field label="Длительность, с">
          <input type="number" step={0.1} value={round(clip.duration)}
            onChange={(e) => store.updateClip(clip.id, { duration: Math.max(0.1, Number(e.target.value)) })} />
        </Field>
      </Section>

      {clip.type === 'text' && <TextEditor clip={clip as TextClip} store={store} />}

      {clip.type === 'lottie' && (
        <Section title="Lottie">
          <label className="chk">
            <input type="checkbox" checked={(clip as LottieClip).loop}
              onChange={(e) => store.updateClip(clip.id, { loop: e.target.checked } as Partial<Clip>)} />
            Зациклить
          </label>
          <Field label={`Скорость ${(clip as LottieClip).speed.toFixed(2)}×`}>
            <input type="range" min={0.25} max={3} step={0.05} value={(clip as LottieClip).speed}
              onChange={(e) => store.updateClip(clip.id, { speed: Number(e.target.value) } as Partial<Clip>)} />
          </Field>
        </Section>
      )}

      {clip.type !== 'audio' && (
        <Section title="Трансформация">
          <Range label="Позиция X" min={-1000} max={1000} step={1} value={clip.transform.x} onChange={(x) => patchTransform({ x })} />
          <Range label="Позиция Y" min={-1000} max={1000} step={1} value={clip.transform.y} onChange={(y) => patchTransform({ y })} />
          <Range label="Масштаб" min={0.1} max={4} step={0.01} value={clip.transform.scale} onChange={(scale) => patchTransform({ scale })} />
          <Range label="Поворот°" min={-180} max={180} step={1} value={clip.transform.rotation} onChange={(rotation) => patchTransform({ rotation })} />
          <Range label="Прозрачность" min={0} max={1} step={0.01} value={clip.transform.opacity} onChange={(opacity) => patchTransform({ opacity })} />
          <button className="block mt-12" onClick={addKeyframe}>◆ Ключевой кадр (на плейхеде)</button>
          {clip.keyframes.length > 0 && (
            <div className="row between mt-12">
              <span className="dim sm">{clip.keyframes.length} ключей</span>
              <button onClick={() => store.updateClip(clip.id, { keyframes: [] } as Partial<Clip>)}>Очистить</button>
            </div>
          )}
        </Section>
      )}

      {clip.type !== 'audio' && clip.type !== 'text' && (
        <Section title="Фильтры">
          <Range label="Яркость" min={0} max={2} step={0.01} value={clip.filters.brightness} onChange={(brightness) => patchFilters({ brightness })} />
          <Range label="Контраст" min={0} max={2} step={0.01} value={clip.filters.contrast} onChange={(contrast) => patchFilters({ contrast })} />
          <Range label="Насыщенность" min={0} max={2} step={0.01} value={clip.filters.saturate} onChange={(saturate) => patchFilters({ saturate })} />
          <Range label="Размытие" min={0} max={20} step={0.5} value={clip.filters.blur} onChange={(blur) => patchFilters({ blur })} />
          <Range label="Оттенок°" min={0} max={360} step={1} value={clip.filters.hue} onChange={(hue) => patchFilters({ hue })} />
        </Section>
      )}

      {(clip.type === 'audio' || clip.type === 'video') && (
        <Section title="Звук">
          <Range label="Громкость" min={0} max={1} step={0.01} value={(clip as MediaClip).volume} onChange={(volume) => store.updateClip(clip.id, { volume } as Partial<Clip>)} />
          <Field label="Fade in, с">
            <input type="number" step={0.1} value={round(clip.fadeIn)} onChange={(e) => store.updateClip(clip.id, { fadeIn: Math.max(0, Number(e.target.value)) })} />
          </Field>
          <Field label="Fade out, с">
            <input type="number" step={0.1} value={round(clip.fadeOut)} onChange={(e) => store.updateClip(clip.id, { fadeOut: Math.max(0, Number(e.target.value)) })} />
          </Field>
        </Section>
      )}
    </div>
  );
}

function TextEditor({ clip, store }: { clip: TextClip; store: ReturnType<typeof useProject> }) {
  const patchStyle = (p: Partial<TextStyle>) =>
    store.updateClip(clip.id, { style: { ...clip.style, ...p } } as Partial<Clip>);
  return (
    <Section title="Текст">
      <textarea rows={2} value={clip.text} onChange={(e) => store.updateClip(clip.id, { text: e.target.value, name: e.target.value.slice(0, 18) || 'Текст' } as Partial<Clip>)} />
      <div className="row gap-12 mt-12">
        <div style={{ flex: 1 }}>
          <label>Размер</label>
          <input type="number" value={clip.style.fontSize} onChange={(e) => patchStyle({ fontSize: Number(e.target.value) })} />
        </div>
        <div>
          <label>Цвет</label>
          <input type="color" value={clip.style.color} onChange={(e) => patchStyle({ color: e.target.value })} />
        </div>
      </div>
      <div className="row gap-12 mt-12">
        <div style={{ flex: 1 }}>
          <label>Выравнивание</label>
          <select value={clip.style.align} onChange={(e) => patchStyle({ align: e.target.value as TextStyle['align'] })}>
            <option value="left">слева</option>
            <option value="center">по центру</option>
            <option value="right">справа</option>
          </select>
        </div>
        <div>
          <label>Обводка</label>
          <input type="number" value={clip.style.strokeWidth} onChange={(e) => patchStyle({ strokeWidth: Number(e.target.value) })} />
        </div>
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="insp-section">
      <div className="insp-title">{title}</div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="insp-field">
      <label>{label}</label>
      {children}
    </div>
  );
}
function Range({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="insp-field">
      <label>{label} <span className="dim">{round(value)}</span></label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
function label(c: Clip): string {
  return { video: '🎬 Видео', image: '🖼 Изображение', audio: '🎵 Аудио', text: 'T Текст', lottie: '✨ Lottie' }[c.type];
}
