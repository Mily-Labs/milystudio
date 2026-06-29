import { useEffect, useState } from 'react';
import { api } from './lib/api.ts';
import RunTab from './tabs/Run.tsx';
import OmniVoiceTab from './tabs/OmniVoice.tsx';
import LottieTab from './tabs/Lottie.tsx';
import FfmpegTab from './tabs/Ffmpeg.tsx';
import SandboxTab from './tabs/Sandbox.tsx';
import SkillsTab from './tabs/Skills.tsx';

type TabId = 'run' | 'omnivoice' | 'lottie' | 'ffmpeg' | 'sandbox' | 'skills';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'run', label: 'Run', icon: '▶' },
  { id: 'omnivoice', label: 'OmniVoice', icon: '🎙' },
  { id: 'lottie', label: 'Lottie', icon: '✨' },
  { id: 'ffmpeg', label: 'ffmpeg', icon: '🎬' },
  { id: 'sandbox', label: 'API Sandbox', icon: '🛠' },
  { id: 'skills', label: 'Skills', icon: '🧩' },
];

export default function SystemApp({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<TabId>('run');
  const [health, setHealth] = useState<{ ok: boolean; services: string[] } | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ ok: false, services: [] }));
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <button onClick={onBack} style={{ marginRight: 12 }}>← Редактор</button>
        <h1>MilyStudio · Система</h1>
        <div className="grow" />
        {health ? (
          <span className="pill" style={{ color: health.ok ? 'var(--ok)' : 'var(--bad)' }}>
            {health.ok ? `● orchestrator :4100` : '● orchestrator down'}
          </span>
        ) : (
          <span className="pill">… connecting</span>
        )}
      </header>

      <nav className="sidebar">
        {TABS.map((t) => (
          <div
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="icon">{t.icon}</span>
            <span>{t.label}</span>
          </div>
        ))}
      </nav>

      <main className="content">
        {tab === 'run' && <RunTab />}
        {tab === 'omnivoice' && <OmniVoiceTab />}
        {tab === 'lottie' && <LottieTab />}
        {tab === 'ffmpeg' && <FfmpegTab />}
        {tab === 'sandbox' && <SandboxTab />}
        {tab === 'skills' && <SkillsTab />}
      </main>
    </div>
  );
}
