import { describe, it, expect, beforeEach } from 'vitest';
import { StateHistory } from '../StateHistory';
import type { WorldState } from '../../../types/world';

function makeState(tick: number): WorldState {
  return {
    config: { seed: 1, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
    tick,
    tiles: [],
    civilizations: new Map(),
    wars: [],
    chronicle: [],
    diplomacyMatrix: new Map(),
  };
}

describe('StateHistory', () => {
  let history: StateHistory;

  beforeEach(() => {
    history = new StateHistory();
  });

  it('starts empty', () => {
    expect(history.getSnapshotCount()).toBe(0);
    expect(history.getOldestTick()).toBeNull();
    expect(history.getNewestTick()).toBeNull();
  });

  it('stores pushed snapshots and reports count', () => {
    history.push(makeState(1));
    history.push(makeState(2));
    history.push(makeState(3));
    expect(history.getSnapshotCount()).toBe(3);
  });

  it('undo(1) returns the last pushed state', () => {
    const s1 = makeState(1);
    const s2 = makeState(2);
    history.push(s1);
    history.push(s2);
    expect(history.undo(1)).toBe(s2);
  });

  it('undo(2) returns the second-to-last state', () => {
    const s1 = makeState(1);
    const s2 = makeState(2);
    const s3 = makeState(3);
    history.push(s1);
    history.push(s2);
    history.push(s3);
    expect(history.undo(2)).toBe(s2);
  });

  it('canUndo returns false when steps > count', () => {
    history.push(makeState(1));
    expect(history.canUndo(2)).toBe(false);
  });

  it('canUndo returns true when steps <= count', () => {
    history.push(makeState(1));
    history.push(makeState(2));
    expect(history.canUndo(2)).toBe(true);
    expect(history.canUndo(3)).toBe(false);
  });

  it('undo returns null when canUndo is false', () => {
    history.push(makeState(1));
    expect(history.undo(5)).toBeNull();
  });

  it('getOldestTick and getNewestTick are correct', () => {
    history.push(makeState(10));
    history.push(makeState(11));
    history.push(makeState(12));
    expect(history.getOldestTick()).toBe(10);
    expect(history.getNewestTick()).toBe(12);
  });

  it('seekTo returns snapshot with highest tick <= requested tick', () => {
    const s5 = makeState(5);
    const s10 = makeState(10);
    const s15 = makeState(15);
    history.push(s5);
    history.push(s10);
    history.push(s15);
    expect(history.seekTo(12)).toBe(s10);
    expect(history.seekTo(15)).toBe(s15);
    expect(history.seekTo(5)).toBe(s5);
  });

  it('seekTo returns oldest snapshot if requested tick is before all snapshots', () => {
    history.push(makeState(100));
    history.push(makeState(200));
    expect(history.seekTo(50)).toBeNull();
  });

  it('stores references without deep copies (identity check)', () => {
    const state = makeState(1);
    history.push(state);
    expect(history.undo(1)).toBe(state);
  });

  it('caps count at MAX_SNAPSHOTS (600) on overflow', () => {
    for (let i = 0; i < 610; i++) {
      history.push(makeState(i));
    }
    expect(history.getSnapshotCount()).toBe(600);
  });

  it('overwrites oldest entry on overflow', () => {
    for (let i = 0; i < 601; i++) {
      history.push(makeState(i));
    }
    // Oldest should now be tick=1, not tick=0
    expect(history.getOldestTick()).toBe(1);
  });

  it('clear resets everything', () => {
    history.push(makeState(1));
    history.push(makeState(2));
    history.clear();
    expect(history.getSnapshotCount()).toBe(0);
    expect(history.undo(1)).toBeNull();
    expect(history.getOldestTick()).toBeNull();
  });
});
