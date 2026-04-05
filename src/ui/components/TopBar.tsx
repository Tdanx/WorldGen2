import React, { useState } from 'react';

interface TopBarProps {
  onNew: () => void;
  onSave: () => void;
  onLoad: () => Promise<boolean>;
}

export function TopBar({ onNew, onSave, onLoad }: TopBarProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  function flash(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  }

  function handleSave() {
    onSave();
    flash('World saved.');
  }

  async function handleLoad() {
    const ok = await onLoad();
    if (!ok) flash('No save found.');
  }

  return (
    <>
      <button className="btn" onClick={onNew}>🌍 New World</button>
      <button className="btn btn-ghost" onClick={handleSave}>💾 Save</button>
      <button className="btn btn-ghost" onClick={handleLoad}>📂 Load</button>
      <button className="btn btn-ghost" disabled>📤 Export</button>
      <span style={{ flex: 1, textAlign: 'center', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--accent)' }}>
        {feedback
          ? <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{feedback}</span>
          : 'WorldGen2'}
      </span>
      <button className="btn btn-ghost" disabled>⚙</button>
    </>
  );
}
