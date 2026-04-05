import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../EventBus';
import type { EngineEventMap } from '../EventBus';

function makeState() {
  return {
    config: { seed: 1, spacing: 5.5, seaLevel: 0.5, mountainSpacing: 35 },
    tick: 0,
    tiles: [],
    civilizations: new Map(),
    wars: [],
    chronicle: [],
    diplomacyMatrix: new Map(),
  } satisfies EngineEventMap['world:tick'];
}

describe('EventBus', () => {
  it('calls a registered handler when event is emitted', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('world:tick', handler);
    const state = makeState();
    bus.emit('world:tick', state);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('passes the correct payload to the handler', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('world:tick', handler);
    const state = makeState();
    bus.emit('world:tick', state);
    expect(handler).toHaveBeenCalledWith(state);
  });

  it('calls multiple handlers for the same event', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('world:tick', h1);
    bus.on('world:tick', h2);
    bus.emit('world:tick', makeState());
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('does not call handlers for a different event', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('world:generated', handler);
    bus.emit('world:tick', makeState());
    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribe fn from on() prevents future calls', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on('world:tick', handler);
    unsub();
    bus.emit('world:tick', makeState());
    expect(handler).not.toHaveBeenCalled();
  });

  it('off() removes a specific handler without affecting others', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('world:tick', h1);
    bus.on('world:tick', h2);
    bus.off('world:tick', h1);
    bus.emit('world:tick', makeState());
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('emitting with no subscribers does not throw', () => {
    const bus = new EventBus();
    expect(() => bus.emit('world:tick', makeState())).not.toThrow();
  });

  it('handlers added during emit are not called in that same emit cycle', () => {
    const bus = new EventBus();
    const late = vi.fn();
    bus.on('world:tick', () => {
      bus.on('world:tick', late);
    });
    bus.emit('world:tick', makeState());
    expect(late).not.toHaveBeenCalled();
    // But is called on the next emit
    bus.emit('world:tick', makeState());
    expect(late).toHaveBeenCalledOnce();
  });

  it('same handler registered twice is only called once per emit', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('world:tick', handler);
    bus.on('world:tick', handler); // duplicate
    bus.emit('world:tick', makeState());
    expect(handler).toHaveBeenCalledOnce();
  });
});
