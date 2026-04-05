import React, { useState, useEffect } from 'react';
import type { WorldConfig } from '../../types/world';
import { WORLD_SIZE_PRESETS, DEFAULT_WORLD_CONFIG } from '../../utils/constants';

interface WorldGenWizardProps {
  onGenerate: (config: WorldConfig) => void;
  onCancel?: () => void;
  errorMessage?: string | null;
}

type SizeKey = keyof typeof WORLD_SIZE_PRESETS;

export function WorldGenWizard({ onGenerate, onCancel, errorMessage }: WorldGenWizardProps) {
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 1_000_000)));
  const [size, setSize] = useState<SizeKey>('Medium');
  const [seaLevel, setSeaLevel] = useState(DEFAULT_WORLD_CONFIG.seaLevel);

  const seedInt = parseInt(seed, 10);
  const seedValid = seed.trim() !== '' && !isNaN(seedInt) && String(seedInt) === seed.trim();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && onCancel) onCancel();
      if (e.key === 'Enter') handleGenerate();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel, seedValid, seedInt, size, seaLevel]);

  function randomizeSeed() {
    setSeed(String(Math.floor(Math.random() * 1_000_000)));
  }

  function handleGenerate() {
    if (!seedValid) return;
    onGenerate({
      seed: seedInt,
      spacing: WORLD_SIZE_PRESETS[size].spacing,
      seaLevel,
      mountainSpacing: DEFAULT_WORLD_CONFIG.mountainSpacing,
    });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 8, padding: 32, minWidth: 340,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em' }}>
          Generate New World
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.1em' }}>SEED</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={seed}
              onChange={e => setSeed(e.target.value)}
              style={{
                flex: 1, background: 'var(--bg)',
                border: `1px solid ${!seedValid && seed.trim() !== '' ? '#e05555' : 'var(--border)'}`,
                color: 'var(--text)', borderRadius: 4, padding: '6px 10px', fontSize: 13,
              }}
            />
            <button className="btn btn-ghost" onClick={randomizeSeed}>
              Randomize
            </button>
          </div>
          {!seedValid && seed.trim() !== '' && (
            <span style={{ fontSize: 11, color: '#e05555' }}>Seed must be a whole number.</span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.1em' }}>WORLD SIZE</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(Object.keys(WORLD_SIZE_PRESETS) as SizeKey[]).map(k => {
              const cellCount = WORLD_SIZE_PRESETS[k].label.split('(')[1]?.replace(')', '') ?? '';
              return (
                <button
                  key={k}
                  className={`btn ${size === k ? '' : 'btn-ghost'}`}
                  onClick={() => setSize(k)}
                  style={{ flex: 1, lineHeight: 1.4 }}
                >
                  <span style={{ display: 'block' }}>{k}</span>
                  <span style={{ fontSize: 10, color: size === k ? 'rgba(255,255,255,0.6)' : 'var(--text-dim)' }}>{cellCount}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.1em' }}>
            SEA LEVEL — {Math.round(seaLevel * 100)}%
          </label>
          <input
            type="range" min={0.3} max={0.7} step={0.01}
            value={seaLevel}
            onChange={e => setSeaLevel(parseFloat(e.target.value))}
            style={{ accentColor: 'var(--accent)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)' }}>
            <span>30% (more land)</span>
            <span>70% (more ocean)</span>
          </div>
        </div>

        {errorMessage && (
          <div style={{ fontSize: 12, color: '#e05555', background: 'rgba(224,85,85,0.1)', borderRadius: 4, padding: '8px 10px' }}>
            {errorMessage}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {onCancel && (
            <button className="btn btn-ghost" onClick={onCancel} style={{ flex: 1, padding: '10px 0', fontSize: 14 }}>
              Cancel
            </button>
          )}
          <button className="btn" onClick={handleGenerate} disabled={!seedValid} style={{ flex: 2, marginTop: 4, padding: '10px 0', fontSize: 14 }}>
            Generate World
          </button>
        </div>
      </div>
    </div>
  );
}
