import { Fragment, useEffect, useState } from 'react';
import { ProjectProvider, useProject } from './state/store.tsx';
import Toolbar from './components/Toolbar.tsx';
import Preview from './components/Preview.tsx';
import Timeline from './components/Timeline.tsx';
import Inspector from './components/Inspector.tsx';
import MediaPanel from './components/MediaPanel.tsx';
import TextPanel from './components/TextPanel.tsx';
import VoicePanel from './components/VoicePanel.tsx';
import StickerPanel from './components/StickerPanel.tsx';
import CaptionsPanel from './components/CaptionsPanel.tsx';
import EffectsPanel from './components/EffectsPanel.tsx';
import Splitter from './components/Splitter.tsx';
import { splitSelected, dupSelected, delSelected } from './lib/projectActions.ts';
import { clamp } from './lib/time.ts';
import './editor.css';

type Tool = 'media' | 'text' | 'captions' | 'voice' | 'sticker' | 'effects';
type DockId = 'tools' | 'inspector' | 'preview';

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'media', label: 'Медиа', icon: '🎞' },
  { id: 'text', label: 'Текст', icon: 'T' },
  { id: 'captions', label: 'Субтитры', icon: '💬' },
  { id: 'voice', label: 'Голос', icon: '🎙' },
  { id: 'sticker', label: 'Lottie', icon: '✨' },
  { id: 'effects', label: 'Эффекты', icon: '🎨' },
];

const DOCK_TITLES: Record<DockId, string> = {
  tools: 'Инструменты',
  inspector: 'Свойства',
  preview: 'Просмотр',
};

interface Layout {
  order: DockId[];
  sizes: { tools: number; inspector: number; timeline: number };
}

const DEFAULT_LAYOUT: Layout = {
  order: ['tools', 'inspector', 'preview'],
  sizes: { tools: 300, inspector: 320, timeline: 300 },
};

function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem('mily.layout');
    if (raw) {
      const p = JSON.parse(raw) as Layout;
      if (Array.isArray(p.order) && p.order.length === 3 && p.sizes) return p;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LAYOUT;
}

function Shell({ onOpenSystem }: { onOpenSystem: () => void }) {
  const store = useProject();
  const [tool, setTool] = useState<Tool>('media');
  const [layout, setLayout] = useState<Layout>(loadLayout);

  useEffect(() => {
    try {
      localStorage.setItem('mily.layout', JSON.stringify(layout));
    } catch {
      /* ignore */
    }
  }, [layout]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? store.redo() : store.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        store.redo();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        dupSelected(store);
      } else if (e.key === ' ') {
        e.preventDefault();
        if (store.playhead >= store.duration - 0.05) store.setPlayhead(0);
        store.setPlaying(!store.isPlaying);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        delSelected(store);
      } else if (e.key.toLowerCase() === 's') {
        splitSelected(store);
      } else if (e.key === '+' || e.key === '=') {
        store.setZoom(store.zoom * 1.2);
      } else if (e.key === '-') {
        store.setZoom(store.zoom / 1.2);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const move = (id: DockId, dir: -1 | 1) =>
    setLayout((l) => {
      const i = l.order.indexOf(id);
      const j = i + dir;
      if (j < 0 || j >= l.order.length) return l;
      const order = [...l.order];
      [order[i], order[j]] = [order[j], order[i]];
      return { ...l, order };
    });

  const resizeBetween = (a: DockId, b: DockId, d: number) =>
    setLayout((l) => {
      const sizes = { ...l.sizes };
      if (a !== 'preview') sizes[a] = clamp(sizes[a] + d, 200, 720);
      else if (b !== 'preview') sizes[b] = clamp(sizes[b] - d, 200, 720);
      return { ...l, sizes };
    });

  const renderDockBody = (id: DockId) => {
    if (id === 'preview') return <Preview />;
    if (id === 'inspector') return <Inspector />;
    return (
      <>
        {tool === 'media' && <MediaPanel />}
        {tool === 'text' && <TextPanel />}
        {tool === 'captions' && <CaptionsPanel />}
        {tool === 'voice' && <VoicePanel />}
        {tool === 'sticker' && <StickerPanel />}
        {tool === 'effects' && <EffectsPanel />}
      </>
    );
  };

  return (
    <div className="editor flex-layout">
      <Toolbar onOpenSystem={onOpenSystem} />

      <div className="ed-body">
        <nav className="ed-rail">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`rail-btn ${tool === t.id ? 'active' : ''}`}
              onClick={() => setTool(t.id)}
            >
              <span className="rail-ico">{t.icon}</span>
              <span className="rail-lbl">{t.label}</span>
            </button>
          ))}
        </nav>

        {layout.order.map((id, i) => {
          const isPreview = id === 'preview';
          const style = isPreview
            ? { flex: '1 1 0', minWidth: 260 }
            : { flex: `0 0 ${layout.sizes[id]}px`, width: layout.sizes[id] };
          return (
            <Fragment key={id}>
              <section className={`dock dock-${id}`} style={style}>
                <div className="dock-head">
                  <span className="dock-title">{DOCK_TITLES[id]}</span>
                  <span className="grow" />
                  <button className="dock-move" disabled={i === 0} onClick={() => move(id, -1)} title="Влево">◀</button>
                  <button className="dock-move" disabled={i === layout.order.length - 1} onClick={() => move(id, 1)} title="Вправо">▶</button>
                </div>
                <div className={`dock-body ${isPreview ? 'no-pad' : ''}`}>{renderDockBody(id)}</div>
              </section>
              {i < layout.order.length - 1 && (
                <Splitter orientation="v" onResize={(d) => resizeBetween(id, layout.order[i + 1], d)} />
              )}
            </Fragment>
          );
        })}
      </div>

      <Splitter
        orientation="h"
        onResize={(d) => setLayout((l) => ({ ...l, sizes: { ...l.sizes, timeline: clamp(l.sizes.timeline - d, 140, 620) } }))}
      />

      <footer className="ed-timeline" style={{ height: layout.sizes.timeline }}>
        <Timeline />
      </footer>
    </div>
  );
}

export default function EditorApp({ onOpenSystem }: { onOpenSystem: () => void }) {
  return (
    <ProjectProvider>
      <Shell onOpenSystem={onOpenSystem} />
    </ProjectProvider>
  );
}
