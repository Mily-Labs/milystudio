import { useEffect, useState } from 'react';
import { api, type SkillEntry } from '../lib/api.ts';

export default function SkillsTab() {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [selected, setSelected] = useState<SkillEntry | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lang, setLang] = useState<'ru' | 'en'>('en');

  useEffect(() => {
    api.skills.list()
      .then((d) => {
        setSkills(d.skills);
        if (d.skills[0]) void selectSkill(d.skills[0].id);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  const selectSkill = async (id: string): Promise<void> => {
    try {
      const s = await api.skills.get(id);
      setSelected(s);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div>
      <h2>Skills</h2>
      <p className="muted">
        Инструкции по установке скиллов в Claude Code / Codex / Cursor, чтобы AI-агент мог управлять модулями MilyStudio.
      </p>

      {err && <pre className="json" style={{ borderColor: 'var(--bad)' }}>{err}</pre>}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <h3>Доступные</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {skills.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSkill(s.id)}
                style={{
                  textAlign: 'left',
                  background: selected?.id === s.id ? 'var(--bg-2)' : 'transparent',
                  borderColor: selected?.id === s.id ? 'var(--accent)' : 'transparent',
                }}
              >
                {s.label}
              </button>
            ))}
            {skills.length === 0 && <span className="muted">no skills registered</span>}
          </div>
        </div>

        <div>
          {selected ? (
            <div className="card">
              <h3>
                {selected.label}
                <span className="row gap-12" style={{ marginLeft: 'auto' }}>
                  <button onClick={() => setLang('ru')} className={lang === 'ru' ? 'primary' : ''}>RU</button>
                  <button onClick={() => setLang('en')} className={lang === 'en' ? 'primary' : ''}>EN</button>
                </span>
              </h3>
              <p>{lang === 'ru' ? selected.ru : selected.en}</p>
              <h3 style={{ marginTop: 12 }}>Установка / Install</h3>
              <ol>
                {(selected.install[lang] ?? []).map((step, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>{step}</li>
                ))}
              </ol>
              {selected.markdown && (
                <details className="mt-12">
                  <summary className="muted" style={{ cursor: 'pointer' }}>SKILL.md (raw)</summary>
                  <pre className="json mt-12">{selected.markdown}</pre>
                </details>
              )}
            </div>
          ) : (
            <div className="card">
              <p className="muted">Выберите скилл слева.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}