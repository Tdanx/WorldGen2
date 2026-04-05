import React, { useState } from 'react';
import { useWorldStore } from '../../../store/useWorldStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { worldEngine } from '../../../hooks/useEngine';
import { useGodControls } from '../../../hooks/useGodControls';
import { BiomeType } from '../../../types/terrain';
import { SpeciesRegistry } from '../../../registries/SpeciesRegistry';
import type { BlessingType, GodCommand } from '../../../types/simulation';
import type { CivId } from '../../../types/civilization';

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  root: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    fontSize: 12,
    overflowY: 'auto' as const,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: 700 as const,
    letterSpacing: '0.12em',
    color: 'var(--text-dim)',
    marginBottom: 4,
  },
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 5,
    padding: '8px 10px',
    background: 'var(--border)',
    borderRadius: 4,
  },
  row: {
    display: 'flex',
    gap: 5,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
  },
  select: {
    flex: 1,
    minWidth: 80,
    background: 'var(--bg)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    padding: '3px 5px',
    fontSize: 11,
  },
  btn: (disabled: boolean, danger = false) => ({
    padding: '4px 10px',
    borderRadius: 3,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 11,
    fontWeight: 600 as const,
    background: disabled
      ? '#333'
      : danger
        ? '#7a1a1a'
        : 'var(--accent)',
    color: disabled ? 'var(--text-dim)' : '#fff',
    opacity: disabled ? 0.5 : 1,
    transition: 'opacity 0.15s',
    whiteSpace: 'nowrap' as const,
  }),
  hint: {
    fontSize: 10,
    color: 'var(--text-dim)',
    fontStyle: 'italic' as const,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dispatch(cmd: GodCommand) {
  worldEngine.queueCommand(cmd);
}

const BIOME_OPTIONS = Object.values(BiomeType).filter(
  b => b !== BiomeType.DeepOcean && b !== BiomeType.ShallowSea,
);

const BLESSING_OPTIONS: { value: BlessingType; label: string }[] = [
  { value: 'food',      label: 'Food (population)' },
  { value: 'military',  label: 'Military (strength)' },
  { value: 'stability', label: 'Stability (clear flags)' },
  { value: 'tech',      label: 'Technology (+1 level)' },
  { value: 'faith',     label: 'Faith (religion boost)' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function NoWorldMsg() {
  return (
    <div style={{ padding: 16, color: 'var(--text-dim)', fontSize: 12 }}>
      <div style={S.sectionHeader}>GOD CONTROLS</div>
      <span>Generate a world first to use divine powers.</span>
    </div>
  );
}

function SelectionHint({ tileNeeded = false, civNeeded = false }: { tileNeeded?: boolean; civNeeded?: boolean }) {
  const parts: string[] = [];
  if (tileNeeded) parts.push('select a tile on the map');
  if (civNeeded)  parts.push('select a civilization in the Civs tab');
  if (parts.length === 0) return null;
  return <div style={S.hint}>Requires: {parts.join(' and ')}</div>;
}

// ─── Terrain section ──────────────────────────────────────────────────────────

function TerrainSection({ selectedTile }: { selectedTile: number | null }) {
  const [biome, setBiome] = useState<BiomeType>(BiomeType.Grassland);
  const noTile = selectedTile === null;
  const { activeTool, toggleTool } = useGodControls();

  const activeStyle = {
    ...S.btn(false),
    background: 'var(--highlight)',
    outline: '1px solid var(--accent)',
  };

  return (
    <div style={S.section}>
      <div style={S.sectionHeader}>TERRAIN</div>
      <div style={{ ...S.hint, marginBottom: 2 }}>
        {activeTool ? `${activeTool === 'raise' ? '▲ Raise' : '▼ Lower'} active — click map to paint` : 'Toggle a tool then click the map'}
      </div>

      <div style={S.row}>
        <button
          style={activeTool === 'raise' ? activeStyle : S.btn(false)}
          onClick={() => toggleTool('raise')}
        >
          ▲ Raise
        </button>
        <button
          style={activeTool === 'lower' ? activeStyle : S.btn(false)}
          onClick={() => toggleTool('lower')}
        >
          ▼ Lower
        </button>
      </div>

      <div style={S.row}>
        <select
          style={S.select}
          value={biome}
          onChange={e => setBiome(e.target.value as BiomeType)}
        >
          {BIOME_OPTIONS.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <button
          style={S.btn(noTile)}
          disabled={noTile}
          onClick={() => dispatch({ type: 'SET_BIOME', tiles: [selectedTile!], biome })}
        >
          Set Biome
        </button>
      </div>

    </div>
  );
}

// ─── Disasters section ────────────────────────────────────────────────────────

function DisastersSection({ selectedTile, selectedCiv }: { selectedTile: number | null; selectedCiv: CivId | null }) {
  const noTile = selectedTile === null;
  const noCiv  = selectedCiv === null;

  return (
    <div style={S.section}>
      <div style={S.sectionHeader}>DISASTERS</div>

      <div style={S.row}>
        <button
          style={S.btn(noTile, true)}
          disabled={noTile}
          onClick={() => dispatch({ type: 'VOLCANIC_ERUPTION', epicenter: selectedTile!, magnitude: 0.8 })}
        >
          🌋 Volcano
        </button>
        <button
          style={S.btn(noTile, true)}
          disabled={noTile}
          onClick={() => dispatch({ type: 'METEOR_IMPACT', epicenter: selectedTile!, radius: 3 })}
        >
          ☄ Meteor
        </button>
      </div>

      <div style={S.row}>
        <button
          style={S.btn(noTile, true)}
          disabled={noTile}
          onClick={() => dispatch({ type: 'FLOOD', region: [selectedTile!], severity: 0.7 })}
        >
          🌊 Flood
        </button>
        <button
          style={S.btn(noTile, true)}
          disabled={noTile}
          onClick={() => dispatch({ type: 'DROUGHT', region: [selectedTile!], duration: 20 })}
        >
          ☀ Drought
        </button>
        <button
          style={S.btn(noCiv, true)}
          disabled={noCiv}
          onClick={() => dispatch({ type: 'PLAGUE', targetCiv: selectedCiv!, severity: 0.6 })}
        >
          ☠ Plague
        </button>
      </div>

      {(noTile || noCiv) && <SelectionHint tileNeeded={noTile} civNeeded={noCiv} />}
    </div>
  );
}

// ─── Civilizations section ────────────────────────────────────────────────────

function CivilizationsSection({
  selectedTile,
  selectedCiv,
  civIds,
}: {
  selectedTile: number | null;
  selectedCiv: CivId | null;
  civIds: CivId[];
}) {
  const [warCivA, setWarCivA] = useState<CivId>('');
  const [warCivB, setWarCivB] = useState<CivId>('');
  const [blessing, setBlessing] = useState<BlessingType>('food');
  const [spawnSpecies, setSpawnSpecies] = useState<string>('human');

  const allSpecies = SpeciesRegistry.getAll();
  const noTile  = selectedTile === null;
  const noCiv   = selectedCiv === null;
  const noWar   = !warCivA || !warCivB || warCivA === warCivB;

  return (
    <div style={S.section}>
      <div style={S.sectionHeader}>CIVILIZATIONS</div>

      {/* Force War */}
      <div style={{ ...S.row, flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={S.hint}>Force War between:</div>
        <div style={S.row}>
          <select style={S.select} value={warCivA} onChange={e => setWarCivA(e.target.value)}>
            <option value=''>— Aggressor —</option>
            {civIds.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
          <select style={S.select} value={warCivB} onChange={e => setWarCivB(e.target.value)}>
            <option value=''>— Defender —</option>
            {civIds.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
          <button
            style={S.btn(noWar, true)}
            disabled={noWar}
            onClick={() => dispatch({ type: 'FORCE_WAR', aggressor: warCivA, defender: warCivB })}
          >
            ⚔ War
          </button>
        </div>
      </div>

      {/* Divine Blessing */}
      <div style={S.row}>
        <select
          style={S.select}
          value={blessing}
          onChange={e => setBlessing(e.target.value as BlessingType)}
        >
          {BLESSING_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          style={S.btn(noCiv)}
          disabled={noCiv}
          onClick={() => dispatch({ type: 'DIVINE_BLESSING', targetCiv: selectedCiv!, boost: blessing })}
        >
          ✨ Bless
        </button>
      </div>

      {/* Spawn Civilization */}
      <div style={S.row}>
        <select
          style={S.select}
          value={spawnSpecies}
          onChange={e => setSpawnSpecies(e.target.value)}
        >
          {allSpecies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button
          style={S.btn(noTile)}
          disabled={noTile}
          onClick={() => dispatch({ type: 'SPAWN_CIVILIZATION', tile: selectedTile!, speciesId: spawnSpecies })}
        >
          🌱 Spawn Civ
        </button>
      </div>

      {(noTile || noCiv) && <SelectionHint tileNeeded={noTile} civNeeded={noCiv} />}
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function GodTab() {
  const worldState    = useWorldStore(s => s.worldState);
  const selectedTile  = useSelectionStore(s => s.selectedTile);
  const selectedCiv   = useSelectionStore(s => s.selectedCiv);

  if (!worldState) return <NoWorldMsg />;

  const civIds = Array.from(worldState.civilizations.keys());

  return (
    <div style={S.root}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
        GOD CONTROLS
      </div>

      {/* Context strip */}
      <div style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--border)', padding: '4px 8px', borderRadius: 3 }}>
        {selectedTile !== null
          ? `Tile #${selectedTile} selected`
          : 'No tile selected — click the map'}
        {' · '}
        {selectedCiv
          ? `${worldState.civilizations.get(selectedCiv)?.name ?? selectedCiv} selected`
          : 'No civ selected'}
      </div>

      <TerrainSection selectedTile={selectedTile} />
      <DisastersSection selectedTile={selectedTile} selectedCiv={selectedCiv} />
      <CivilizationsSection selectedTile={selectedTile} selectedCiv={selectedCiv} civIds={civIds} />
    </div>
  );
}
