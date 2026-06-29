import { useState } from 'react';
import EditorApp from './editor/EditorApp.tsx';
import SystemApp from './SystemApp.tsx';

export default function App() {
  const [mode, setMode] = useState<'editor' | 'system'>('editor');
  return mode === 'editor' ? (
    <EditorApp onOpenSystem={() => setMode('system')} />
  ) : (
    <SystemApp onBack={() => setMode('editor')} />
  );
}
