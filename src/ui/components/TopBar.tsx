import React, { useState } from 'react';

export type LoadResult = 'ok' | 'no-save' | 'corrupted' | 'failed';

interface TopBarProps {
  onNew: () => void;
  onSave: () => { ok: boolean; error?: string };
  onLoad: () => Promise<LoadResult>;
  hasWorld: boolean;
  onZoomFit: () => void;
}

export function TopBar({ onNew, onSave, onLoad, hasWorld, onZoomFit }: TopBarProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingLoad, setPendingLoad] = useState(false);

  function flash(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  }

  function handleSave() {
    const result = onSave();
    if (result.ok) flash('World saved.');
    else flash(result.error ?? 'Nothing to save.');
  }

  async function handleLoad() {
    if (hasWorld && !pendingLoad) {
      setPendingLoad(true);
      setTimeout(() => setPendingLoad(false), 3000);
      return;
    }
    setPendingLoad(false);
    const result = await onLoad();
    if (result === 'no-save') flash('No save found.');
    else if (result === 'corrupted') flash('Save data is corrupted.');
    else if (result === 'failed') flash('Load failed — check console for details.');
  }

  return (
    <>
      <button className="btn" onClick={onNew}>🌍 New World</button>
      <button className="btn btn-ghost" onClick={handleSave} disabled={!hasWorld} title={hasWorld ? 'Save world' : 'No world to save'}>💾 Save</button>
      <button
        className={`btn ${pendingLoad ? '' : 'btn-ghost'}`}
        onClick={handleLoad}
        title="Load last saved world"
        style={pendingLoad ? { background: '#7a4a1a', color: '#fff' } : undefined}
      >{pendingLoad ? '⚠ Replace world?' : '📂 Load'}</button>
      <button className="btn btn-ghost" disabled style={{ opacity: 0.4 }}>📤 Export <span style={{ fontSize: 10 }}>(soon)</span></button>
      <button className="btn btn-ghost" onClick={onZoomFit} disabled={!hasWorld} title="Zoom to fit world">⊡ Fit</button>
      <span style={{ flex: 1, textAlign: 'center', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--accent)' }}>
        {feedback
          ? <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{feedback}</span>
          : 'WorldGen2'}
      </span>
      <button className="btn btn-ghost" disabled style={{ opacity: 0.4 }}>⚙ <span style={{ fontSize: 10 }}>(soon)</span></button>
    </>
  );
}
