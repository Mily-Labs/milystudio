import { useState } from 'react';
import { useProject } from '../state/store.tsx';
import { findClip } from '../state/project.ts';
import { splitSelected, dupSelected, delSelected } from '../lib/projectActions.ts';
import ExportDialog from './ExportDialog.tsx';

export default function Toolbar({ onOpenSystem }: { onOpenSystem: () => void }) {
  const store = useProject();
  const [showExport, setShowExport] = useState(false);
  const sel = findClip(store.project, store.selection);

  const split = () => splitSelected(store);
  const dup = () => dupSelected(store);
  const del = () => delSelected(store);

  return (
    <header className="ed-toolbar">
      <div className="brand">Mily<span>Studio</span></div>
      <input
        className="proj-name"
        value={store.project.name}
        onChange={(e) => store.setProject({ ...store.project, name: e.target.value }, false)}
      />
      <span className="divider" />
      <button onClick={store.undo} title="Ctrl+Z">↶</button>
      <button onClick={store.redo} title="Ctrl+Shift+Z">↷</button>
      <span className="divider" />
      <button onClick={split} disabled={!sel} title="Разрезать (S)">✂ Split</button>
      <button onClick={dup} disabled={!sel} title="Дублировать (Ctrl+D)">⧉ Дубль</button>
      <button onClick={del} disabled={!sel} className="danger" title="Удалить (Del)">🗑</button>
      <span className="grow" />
      <button onClick={onOpenSystem} title="Управление сервисами">⚙ Система</button>
      <button className="primary" onClick={() => setShowExport(true)}>⬇ Экспорт</button>
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
    </header>
  );
}
