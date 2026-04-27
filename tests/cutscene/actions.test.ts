import { describe, it, expect } from 'vitest';
import {
  compileWalkAction, compileSpeakAction, compileMiraAction,
  compileAnimaAction, compileEsperaAction,
  type WorldStateAtT,
} from '../../src/cutscene/actions';
import type { AgentPos } from '../../src/cutscene/shots';

const CELL = 70;

function mkWorld(agents: Array<[string, number, number]>, zones: Array<[string, number, number]> = []): WorldStateAtT {
  const aMap = new Map<string, AgentPos>();
  for (const [id, cx, cy] of agents) aMap.set(id, { id, x: cx * CELL, y: 0, z: cy * CELL });
  const zMap = new Map<string, AgentPos>();
  for (const [id, cx, cy] of zones) zMap.set(id, { id, x: cx * CELL, y: 0, z: cy * CELL });
  return { agents: aMap, zones: zMap };
}

describe('compileWalkAction', () => {
  it('resuelve target agent y emite kf type=move con cx/cy del target', () => {
    const world = mkWorld([['mike', 0, 0], ['cris', 3, 4]]);
    const r = compileWalkAction('mike', 'cris', 1.0, 'scene-1', world);
    expect(r.kfs).toHaveLength(1);
    expect(r.kfs[0]).toMatchObject({ t: 1.0, sceneId: 'scene-1', type: 'move', cx: 3, cy: 4 });
    expect(r.resolvedTarget).toBeDefined();
    expect(r.warnings).toHaveLength(0);
  });

  it('resuelve target zone', () => {
    const world = mkWorld([['mike', 0, 0]], [['cocina-1', 5, 5]]);
    const r = compileWalkAction('mike', 'cocina-1', 0.5, 'scene-1', world);
    expect(r.kfs[0]?.cx).toBe(5);
    expect(r.kfs[0]?.cy).toBe(5);
  });

  it('target no encontrado: warning + kfs vacío', () => {
    const world = mkWorld([['mike', 0, 0]]);
    const r = compileWalkAction('mike', 'fantasma', 1.0, 'scene-1', world);
    expect(r.kfs).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('compileSpeakAction', () => {
  it('emite kf type=speak con text', () => {
    const r = compileSpeakAction('mike', 'hola', 0.5, 'scene-1');
    expect(r.kfs[0]).toMatchObject({ t: 0.5, sceneId: 'scene-1', type: 'speak', text: 'hola' });
  });

  it('text vacío permitido', () => {
    const r = compileSpeakAction('mike', '', 0, 'scene-1');
    expect(r.kfs).toHaveLength(1);
  });
});

describe('compileMiraAction', () => {
  it('emite kf type=animation preset=mira con targetId metadata', () => {
    const world = mkWorld([['mike', 0, 0], ['cris', 1, 1]]);
    const r = compileMiraAction('mike', 'cris', 1.0, 'scene-1', world);
    expect(r.kfs[0]).toMatchObject({ type: 'animation', preset: 'mira' });
    expect((r.kfs[0] as any).targetId).toBe('cris');
  });

  it('target no encontrado: warning + sin kf', () => {
    const world = mkWorld([['mike', 0, 0]]);
    const r = compileMiraAction('mike', 'ghost', 0, 'scene-1', world);
    expect(r.kfs).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('compileAnimaAction', () => {
  it('emite kf type=animation con preset y duration default 1.0', () => {
    const r = compileAnimaAction('mike', 'wave', 2.0, 'scene-1');
    expect(r.kfs[0]).toMatchObject({ type: 'animation', preset: 'wave', duration: 1.0 });
  });

  it('duration override', () => {
    const r = compileAnimaAction('mike', 'wave', 0, 'scene-1', 2.5);
    expect(r.kfs[0]?.duration).toBe(2.5);
  });
});

describe('compileEsperaAction', () => {
  it('no emite kfs (no-op)', () => {
    const r = compileEsperaAction('mike', 1.5, 0, 'scene-1');
    expect(r.kfs).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });
});
