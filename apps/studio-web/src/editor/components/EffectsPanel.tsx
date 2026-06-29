import { useProject } from '../state/store.tsx';
import {
  findClip,
  defaultFilters,
  defaultChroma,
  defaultMask,
  type Clip,
  type Filters,
  type Anim,
  type AnimType,
  type MediaClip,
  type ChromaKey,
  type Mask,
} from '../state/project.ts';

const ANIMS: { type: AnimType; label: string; icon: string }[] = [
  { type: 'fade', label: 'Плавно', icon: '◐' },
  { type: 'slideL', label: 'Слева', icon: '⬅' },
  { type: 'slideR', label: 'Справа', icon: '➡' },
  { type: 'slideU', label: 'Снизу', icon: '⬆' },
  { type: 'slideD', label: 'Сверху', icon: '⬇' },
  { type: 'zoom', label: 'Зум', icon: '🔍' },
  { type: 'pop', label: 'Поп', icon: '✦' },
];

const FILTER_PRESETS: { label: string; f: Partial<Filters> }[] = [
  { label: 'Оригинал', f: {} },
  { label: 'Яркий', f: { saturate: 1.4, contrast: 1.15, brightness: 1.05 } },
  { label: 'Тёплый', f: { sepia: 0.28, saturate: 1.12, brightness: 1.03 } },
  { label: 'Холодный', f: { saturate: 1.1, contrast: 1.06, hue: 8 } },
  { label: 'Ч/Б', f: { grayscale: 1, contrast: 1.1 } },
  { label: 'Винтаж', f: { sepia: 0.5, saturate: 1.2, contrast: 0.95 } },
  { label: 'Кино', f: { contrast: 1.22, saturate: 0.9, brightness: 0.98 } },
  { label: 'Негатив', f: { invert: 1 } },
];

export default function EffectsPanel() {
  const store = useProject();
  const found = findClip(store.project, store.selection);

  if (!found) {
    return (
      <div className="panel">
        <h3>Эффекты</h3>
        <p className="dim sm">Выберите клип на таймлайне — эффекты применяются к нему.</p>
      </div>
    );
  }

  const clip = found.clip;
  const isMedia = clip.type === 'video' || clip.type === 'image';
  const setAnim = (slot: 'appear' | 'disappear', a: Anim | undefined) =>
    store.updateClip(clip.id, { [slot]: a } as Partial<Clip>);
  const applyFilters = (f: Partial<Filters>) =>
    store.updateClip(clip.id, { filters: { ...defaultFilters(), ...f } } as Partial<Clip>);
  const patchFilters = (f: Partial<Filters>) =>
    store.updateClip(clip.id, { filters: { ...clip.filters, ...f } } as Partial<Clip>);
  const patchChroma = (c: Partial<ChromaKey>) => {
    const base = (clip as MediaClip).chroma ?? defaultChroma();
    store.updateClip(clip.id, { chroma: { ...base, ...c } } as Partial<Clip>);
  };
  const patchMask = (m: Partial<Mask>) => {
    const base = clip.mask ?? defaultMask();
    store.updateClip(clip.id, { mask: { ...base, ...m } } as Partial<Clip>);
  };

  const dur = (slot: 'appear' | 'disappear') => clip[slot]?.duration ?? 0.5;

  return (
    <div className="panel">
      <h3>Эффекты <span className="dim sm">· {clip.name}</span></h3>

      <AnimSection
        title="Появление"
        current={clip.appear}
        onPick={(t) => setAnim('appear', { type: t, duration: dur('appear') })}
        onClear={() => setAnim('appear', undefined)}
        onDur={(d) => clip.appear && setAnim('appear', { ...clip.appear, duration: d })}
      />
      <AnimSection
        title="Исчезание"
        current={clip.disappear}
        onPick={(t) => setAnim('disappear', { type: t, duration: dur('disappear') })}
        onClear={() => setAnim('disappear', undefined)}
        onDur={(d) => clip.disappear && setAnim('disappear', { ...clip.disappear, duration: d })}
      />

      <div className="insp-section">
        <div className="insp-title">Цвет / фильтры</div>
        <div className="chip-grid">
          {FILTER_PRESETS.map((p) => (
            <button key={p.label} className="chip" onClick={() => applyFilters(p.f)}>{p.label}</button>
          ))}
        </div>
        <Range label="Яркость" min={0} max={2} step={0.01} value={clip.filters.brightness} onChange={(v) => patchFilters({ brightness: v })} />
        <Range label="Контраст" min={0} max={2} step={0.01} value={clip.filters.contrast} onChange={(v) => patchFilters({ contrast: v })} />
        <Range label="Насыщенность" min={0} max={2} step={0.01} value={clip.filters.saturate} onChange={(v) => patchFilters({ saturate: v })} />
        <Range label="Теплота" min={0} max={1} step={0.01} value={clip.filters.sepia} onChange={(v) => patchFilters({ sepia: v })} />
        <Range label="Оттенок°" min={0} max={360} step={1} value={clip.filters.hue} onChange={(v) => patchFilters({ hue: v })} />
        <Range label="Размытие" min={0} max={20} step={0.5} value={clip.filters.blur} onChange={(v) => patchFilters({ blur: v })} />
      </div>

      {isMedia && (
        <div className="insp-section">
          <div className="insp-title">Удаление фона (хромакей)</div>
          <label className="chk">
            <input
              type="checkbox"
              checked={!!(clip as MediaClip).chroma?.enabled}
              onChange={(e) => patchChroma({ enabled: e.target.checked })}
            />
            Вырезать фон по цвету
          </label>
          <div className="row gap-12 mt-12">
            <div><label>Цвет фона</label><input type="color" value={(clip as MediaClip).chroma?.color ?? '#00d000'} onChange={(e) => patchChroma({ color: e.target.value })} /></div>
            <div className="dim sm" style={{ alignSelf: 'end' }}>зелёный по умолчанию</div>
          </div>
          <Range label="Допуск" min={0.05} max={1} step={0.01} value={(clip as MediaClip).chroma?.similarity ?? 0.4} onChange={(v) => patchChroma({ similarity: v })} />
          <Range label="Сглаживание краёв" min={0} max={0.5} step={0.01} value={(clip as MediaClip).chroma?.smoothness ?? 0.12} onChange={(v) => patchChroma({ smoothness: v })} />
        </div>
      )}

      {clip.type !== 'audio' && (
        <div className="insp-section">
          <div className="insp-title">Маска</div>
          <label className="chk">
            <input type="checkbox" checked={!!clip.mask?.enabled} onChange={(e) => patchMask({ enabled: e.target.checked })} />
            Включить маску
          </label>
          <div className="seg mt-12">
            {(['rect', 'ellipse'] as const).map((sh) => (
              <button key={sh} className={(clip.mask?.shape ?? 'rect') === sh ? 'on' : ''} onClick={() => patchMask({ shape: sh })}>
                {sh === 'rect' ? 'Прямоугольник' : 'Эллипс'}
              </button>
            ))}
          </div>
          <Range label="Центр X" min={0} max={1} step={0.01} value={clip.mask?.x ?? 0.5} onChange={(v) => patchMask({ x: v })} />
          <Range label="Центр Y" min={0} max={1} step={0.01} value={clip.mask?.y ?? 0.5} onChange={(v) => patchMask({ y: v })} />
          <Range label="Ширина" min={0.05} max={1} step={0.01} value={clip.mask?.w ?? 0.6} onChange={(v) => patchMask({ w: v })} />
          <Range label="Высота" min={0.05} max={1} step={0.01} value={clip.mask?.h ?? 0.6} onChange={(v) => patchMask({ h: v })} />
          <label className="chk mt-12">
            <input type="checkbox" checked={!!clip.mask?.invert} onChange={(e) => patchMask({ invert: e.target.checked })} />
            Инвертировать
          </label>
        </div>
      )}

      {(clip.type === 'video' || clip.type === 'audio') && (
        <div className="insp-section">
          <div className="insp-title">Скорость</div>
          <Range label={`${((clip as MediaClip).speed ?? 1).toFixed(2)}×`} min={0.25} max={4} step={0.05} value={(clip as MediaClip).speed ?? 1} onChange={(v) => store.updateClip(clip.id, { speed: v } as Partial<Clip>)} />
        </div>
      )}
    </div>
  );
}

function AnimSection({
  title,
  current,
  onPick,
  onClear,
  onDur,
}: {
  title: string;
  current: Anim | undefined;
  onPick: (t: AnimType) => void;
  onClear: () => void;
  onDur: (d: number) => void;
}) {
  return (
    <div className="insp-section">
      <div className="insp-title">{title}</div>
      <div className="chip-grid">
        <button className={`chip ${!current ? 'on' : ''}`} onClick={onClear}>Нет</button>
        {ANIMS.map((a) => (
          <button key={a.type} className={`chip ${current?.type === a.type ? 'on' : ''}`} onClick={() => onPick(a.type)} title={a.label}>
            <span>{a.icon}</span> {a.label}
          </button>
        ))}
      </div>
      {current && (
        <Range label="Длительность, с" min={0.1} max={3} step={0.05} value={current.duration} onChange={onDur} />
      )}
    </div>
  );
}

function Range({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="insp-field">
      <label>{label} <span className="dim">{Math.round(value * 100) / 100}</span></label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
