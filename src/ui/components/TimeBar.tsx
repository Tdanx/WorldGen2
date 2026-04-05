import React from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useWorldStore } from '../../store/useWorldStore';
import { worldEngine } from '../../hooks/useEngine';

export function TimeBar() {
  const { paused, setPaused, speed, setSpeed, canRewind } = useSimulationStore();
  const worldState = useWorldStore(s => s.worldState);
  const hasWorld = worldState !== null;

  function handleSkipToStart() {
    const oldest = worldEngine.getHistory().getOldestTick();
    if (oldest === null) return;
    setPaused(true);
    worldEngine.seekToTick(oldest);
  }

  function handleRewind() {
    setPaused(true);
    worldEngine.stepBack(1);
  }

  function handleSkipToEnd() {
    // Resume live simulation from the current (possibly rewound) state
    setPaused(false);
  }

  return (
    <>
      <button
        className="btn btn-ghost"
        onClick={handleSkipToStart}
        disabled={!canRewind}
        title="Skip to start"
        style={{ fontSize: 11 }}
      >|◀</button>
      <button
        className="btn btn-ghost"
        onClick={handleRewind}
        disabled={!canRewind}
        title="Rewind"
        style={{ fontSize: 11 }}
      >◀◀</button>
      <button
        className="btn"
        onClick={() => setPaused(!paused)}
        disabled={!hasWorld}
        title={paused ? 'Play' : 'Pause'}
        style={{ minWidth: 36 }}
      >
        {paused ? '▶' : '⏸'}
      </button>
      <button className="btn btn-ghost" disabled title="Fast forward" style={{ fontSize: 11 }}>▶▶</button>
      <button
        className="btn btn-ghost"
        onClick={handleSkipToEnd}
        disabled={!hasWorld || !paused}
        title="Resume live"
        style={{ fontSize: 11 }}
      >▶|</button>

      <span style={{ flex: 1, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, letterSpacing: '0.04em' }}>
        {hasWorld ? `Year ${worldState.tick} · Age of Legends` : '— no world —'}
      </span>

      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Speed</span>
      <input
        type="range" min={0.5} max={10} step={0.5}
        value={speed}
        onChange={e => setSpeed(parseFloat(e.target.value))}
        disabled={!hasWorld}
        style={{ accentColor: 'var(--accent)', width: 80 }}
      />
      <span style={{ fontSize: 11, color: 'var(--text)', width: 28, textAlign: 'right' }}>{speed}x</span>
    </>
  );
}
