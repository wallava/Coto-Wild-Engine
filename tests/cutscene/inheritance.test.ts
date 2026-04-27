import { describe, it, expect } from 'vitest';
import {
  inheritanceChain,
  lastKfWithInheritance,
  kfIsVisible,
} from '../../src/cutscene/inheritance';
import { computeSceneView } from '../../src/cutscene/scenes';
import type { Cutscene, Scene, AgentKf } from '../../src/cutscene/model';

function mkScene(over: Partial<Scene> & { id: string; tStart: number; tEnd: number }): Scene {
  return {
    name: '',
    inheritState: true,
    ...over,
  };
}

function mkCutscene(scenes: Scene[]): Cutscene {
  return {
    id: 'cs-test',
    name: 'test',
    duration: scenes.length > 0 ? Math.max(...scenes.map(s => s.tEnd)) : 10,
    scenes,
    camera: { keyframes: [], parentAgentId: null },
    walls: { keyframes: [] },
    fx: { entities: [] },
    tracks: [],
    agents: [],
  } as any;
}

describe('inheritanceChain', () => {
  it('returns empty chain when scene is null', () => {
    const cs = mkCutscene([]);
    expect(inheritanceChain(cs, null)).toEqual([]);
  });

  it('returns single-element chain when inheritState is false', () => {
    const sc = mkScene({ id: 's1', tStart: 0, tEnd: 5, inheritState: false });
    const cs = mkCutscene([sc]);
    const chain = inheritanceChain(cs, sc);
    expect(chain).toHaveLength(1);
    expect(chain[0]!.id).toBe('s1');
  });

  it('walks parent chain via escenaRootId in reverse-chrono order', () => {
    const root = mkScene({ id: 'root', tStart: 0, tEnd: 5, escenaRootId: 'root' });
    const mid = mkScene({ id: 'mid', tStart: 5, tEnd: 10, escenaRootId: 'root' });
    const tail = mkScene({ id: 'tail', tStart: 10, tEnd: 15, escenaRootId: 'root' });
    const cs = mkCutscene([root, mid, tail]);
    const chain = inheritanceChain(cs, tail);
    expect(chain.map(c => c.id)).toEqual(['tail', 'mid', 'root']);
  });

  it('does NOT include scenes with different escenaRootId', () => {
    const a = mkScene({ id: 'a', tStart: 0, tEnd: 5, escenaRootId: 'root-a' });
    const b = mkScene({ id: 'b', tStart: 5, tEnd: 10, escenaRootId: 'root-b' });
    const cs = mkCutscene([a, b]);
    const chain = inheritanceChain(cs, b);
    expect(chain).toHaveLength(1);
    expect(chain[0]!.id).toBe('b');
  });

  it('uses scene.id as escenaRootId fallback when not set', () => {
    const a = mkScene({ id: 'a', tStart: 0, tEnd: 5, escenaRootId: 'shared' });
    const b = mkScene({ id: 'b', tStart: 5, tEnd: 10 });   // no escenaRootId, default = b.id
    const cs = mkCutscene([a, b]);
    const chain = inheritanceChain(cs, b);
    expect(chain).toHaveLength(1);   // 'a' tiene root='shared', 'b' tiene root='b' → no match
  });
});

describe('lastKfWithInheritance', () => {
  it('returns null when scene is null', () => {
    const cs = mkCutscene([]);
    const result = lastKfWithInheritance<AgentKf>([], null, 5, computeSceneView(cs));
    expect(result).toBeNull();
  });

  it('returns null when no kfs match the inheritance chain', () => {
    const sc = mkScene({ id: 's1', tStart: 0, tEnd: 5 });
    const cs = mkCutscene([sc]);
    const kf: AgentKf = { t: 1, sceneId: 'other-scene', type: 'move', cx: 0, cy: 0 };
    const result = lastKfWithInheritance<AgentKf>([kf], sc, 5, computeSceneView(cs));
    expect(result).toBeNull();
  });

  it('returns most recent kf within scene before playhead', () => {
    const sc = mkScene({ id: 's1', tStart: 0, tEnd: 10 });
    const cs = mkCutscene([sc]);
    const kfs: AgentKf[] = [
      { t: 1, sceneId: 's1', type: 'move', cx: 0, cy: 0 },
      { t: 3, sceneId: 's1', type: 'move', cx: 1, cy: 0 },
      { t: 5, sceneId: 's1', type: 'move', cx: 2, cy: 0 },
      { t: 8, sceneId: 's1', type: 'move', cx: 3, cy: 0 },   // future, no match
    ];
    const result = lastKfWithInheritance<AgentKf>(kfs, sc, 6, computeSceneView(cs));
    expect(result?.t).toBe(5);
    expect(result?.cx).toBe(2);
  });

  it('inherits last kf from parent scene when current has none', () => {
    const root = mkScene({ id: 'root', tStart: 0, tEnd: 5, escenaRootId: 'r' });
    const child = mkScene({ id: 'child', tStart: 5, tEnd: 10, escenaRootId: 'r' });
    const cs = mkCutscene([root, child]);
    const kfs: AgentKf[] = [
      { t: 2, sceneId: 'root', type: 'move', cx: 1, cy: 1 },
      { t: 4, sceneId: 'root', type: 'move', cx: 2, cy: 2 },
    ];
    const result = lastKfWithInheritance<AgentKf>(kfs, child, 7, computeSceneView(cs));
    expect(result?.t).toBe(4);
    expect(result?.cx).toBe(2);
  });

  it('does not inherit when inheritState is false', () => {
    const root = mkScene({ id: 'root', tStart: 0, tEnd: 5, escenaRootId: 'r' });
    const child = mkScene({ id: 'child', tStart: 5, tEnd: 10, escenaRootId: 'r', inheritState: false });
    const cs = mkCutscene([root, child]);
    const kfs: AgentKf[] = [
      { t: 2, sceneId: 'root', type: 'move', cx: 1, cy: 1 },
    ];
    const result = lastKfWithInheritance<AgentKf>(kfs, child, 7, computeSceneView(cs));
    expect(result).toBeNull();
  });

  it('handles legacy kfs without sceneId via temporal range match', () => {
    const sc = mkScene({ id: 's1', tStart: 2, tEnd: 8 });
    const cs = mkCutscene([sc]);
    const kfs: AgentKf[] = [
      { t: 1, type: 'move', cx: 0, cy: 0 },     // antes del plano, no match
      { t: 3, type: 'move', cx: 1, cy: 0 },     // dentro
      { t: 5, type: 'move', cx: 2, cy: 0 },     // dentro
      { t: 9, type: 'move', cx: 3, cy: 0 },     // después, no match
    ];
    const result = lastKfWithInheritance<AgentKf>(kfs, sc, 6, computeSceneView(cs));
    expect(result?.t).toBe(5);
  });
});

describe('kfIsVisible', () => {
  it('returns true for kfs without sceneId (legacy)', () => {
    const sc = mkScene({ id: 's1', tStart: 0, tEnd: 5 });
    const kf: AgentKf = { t: 2, type: 'move', cx: 0, cy: 0 };
    expect(kfIsVisible(kf, [sc])).toBe(true);
  });

  it('returns false when sceneId references missing scene', () => {
    const sc = mkScene({ id: 's1', tStart: 0, tEnd: 5 });
    const kf: AgentKf = { t: 2, sceneId: 'missing', type: 'move', cx: 0, cy: 0 };
    expect(kfIsVisible(kf, [sc])).toBe(false);
  });

  it('returns true when kf.t falls within scene range', () => {
    const sc = mkScene({ id: 's1', tStart: 2, tEnd: 8 });
    const kf: AgentKf = { t: 5, sceneId: 's1', type: 'move', cx: 0, cy: 0 };
    expect(kfIsVisible(kf, [sc])).toBe(true);
  });

  it('returns false when kf.t falls outside scene range (dormant kf)', () => {
    const sc = mkScene({ id: 's1', tStart: 5, tEnd: 8 });
    const kf: AgentKf = { t: 2, sceneId: 's1', type: 'move', cx: 0, cy: 0 };
    expect(kfIsVisible(kf, [sc])).toBe(false);
  });

  it('respects epsilon at scene boundaries', () => {
    const sc = mkScene({ id: 's1', tStart: 2, tEnd: 8 });
    expect(kfIsVisible({ t: 2.0005, sceneId: 's1' } as AgentKf, [sc])).toBe(true);
    expect(kfIsVisible({ t: 1.9995, sceneId: 's1' } as AgentKf, [sc])).toBe(true);   // dentro de epsilon
  });
});
