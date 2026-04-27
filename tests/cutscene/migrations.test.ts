import { describe, it, expect } from 'vitest';
import { migrateCutscene, loadAndMigrateCutscene } from '../../src/cutscene/migrations';

function mkMinimal() {
  return {
    duration: 10,
    camera: { keyframes: [] },
    walls: { keyframes: [] },
    fx: { entities: [] },
    tracks: [],
    agents: [],
  };
}

describe('migrateCutscene — ensureScenesInModel', () => {
  it('genera scene única si no hay scenes ni cuts', () => {
    const c: any = mkMinimal();
    delete c.scenes;
    migrateCutscene(c);
    expect(Array.isArray(c.scenes)).toBe(true);
    expect(c.scenes).toHaveLength(1);
    expect(c.scenes[0].tStart).toBe(0);
    expect(c.scenes[0].tEnd).toBe(10);
    expect(c.scenes[0].inheritState).toBe(false);
  });

  it('genera scenes desde camera kfs cut=true', () => {
    const c: any = {
      ...mkMinimal(),
      camera: {
        keyframes: [
          { t: 3, cut: true, position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
          { t: 7, cut: true, position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
        ],
      },
    };
    delete c.scenes;
    migrateCutscene(c);
    expect(c.scenes).toHaveLength(3);
    expect(c.scenes[0].tStart).toBe(0);
    expect(c.scenes[1].tStart).toBe(3);
    expect(c.scenes[2].tStart).toBe(7);
  });

  it('respeta scenes existentes sin regenerar', () => {
    const c: any = mkMinimal();
    c.scenes = [
      { id: 'pre1', tStart: 0, tEnd: 5, name: 'manual', inheritState: false, escenaRootId: 'pre1' },
    ];
    migrateCutscene(c);
    expect(c.scenes[0].id).toBe('pre1');
  });
});

describe('migrateCutscene — migrateKfsToScenes', () => {
  it('asigna sceneId a kfs sin él (camera)', () => {
    const c: any = mkMinimal();
    c.camera.keyframes = [
      { t: 2, position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    ];
    delete c.scenes;
    migrateCutscene(c);
    expect(c.camera.keyframes[0].sceneId).toBe(c.scenes[0].id);
  });

  it('asigna sceneId a agent kfs', () => {
    const c: any = mkMinimal();
    c.tracks = [
      { agentId: 'a1', keyframes: [{ t: 4, type: 'move', cx: 1, cy: 1 }] },
    ];
    delete c.scenes;
    migrateCutscene(c);
    expect(c.tracks[0].keyframes[0].sceneId).toBe(c.scenes[0].id);
  });

  it('preserva sceneId existente', () => {
    const c: any = mkMinimal();
    c.scenes = [
      { id: 's-fixed', tStart: 0, tEnd: 10, name: '', inheritState: false, escenaRootId: 's-fixed' },
    ];
    c.camera.keyframes = [
      { t: 2, sceneId: 's-original', position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    ];
    migrateCutscene(c);
    expect(c.camera.keyframes[0].sceneId).toBe('s-original');
  });
});

describe('migrateCutscene — assignEscenaRootIds', () => {
  it('recalcula desde scratch cuando grafo parcial', () => {
    const c: any = mkMinimal();
    c.scenes = [
      { id: 's1', tStart: 0, tEnd: 5, name: '', inheritState: false },   // sin escenaRootId
      { id: 's2', tStart: 5, tEnd: 10, name: '', inheritState: true },
    ];
    migrateCutscene(c);
    expect(c.scenes[0].escenaRootId).toBe('s1');
    expect(c.scenes[1].escenaRootId).toBe('s1');
  });

  it('respeta escenaRootId si todo el grafo es válido', () => {
    const c: any = mkMinimal();
    c.scenes = [
      { id: 's1', tStart: 0, tEnd: 5, name: '', inheritState: false, escenaRootId: 's1' },
      { id: 's2', tStart: 5, tEnd: 10, name: '', inheritState: true, escenaRootId: 's1' },
    ];
    const beforeRoots = c.scenes.map((s: any) => s.escenaRootId);
    migrateCutscene(c);
    const afterRoots = c.scenes.map((s: any) => s.escenaRootId);
    expect(afterRoots).toEqual(beforeRoots);
  });

  it('recalcula si escenaRootId apunta a id inexistente', () => {
    const c: any = mkMinimal();
    c.scenes = [
      { id: 's1', tStart: 0, tEnd: 5, name: '', inheritState: false, escenaRootId: 's1' },
      { id: 's2', tStart: 5, tEnd: 10, name: '', inheritState: true, escenaRootId: 'ghost' },
    ];
    migrateCutscene(c);
    expect(c.scenes[1].escenaRootId).toBe('s1');
  });
});

describe('migrateCutscene — ensureAgentKfTypes', () => {
  it('infiere move desde cx/cy', () => {
    const c: any = mkMinimal();
    c.tracks = [{ agentId: 'a1', keyframes: [{ t: 1, cx: 0, cy: 0 }] }];
    migrateCutscene(c);
    expect(c.tracks[0].keyframes[0].type).toBe('move');
  });

  it('infiere speak desde text', () => {
    const c: any = mkMinimal();
    c.tracks = [{ agentId: 'a1', keyframes: [{ t: 1, text: 'hola' }] }];
    migrateCutscene(c);
    expect(c.tracks[0].keyframes[0].type).toBe('speak');
  });

  it('infiere animation desde preset', () => {
    const c: any = mkMinimal();
    c.tracks = [{ agentId: 'a1', keyframes: [{ t: 1, preset: 'wave' }] }];
    migrateCutscene(c);
    expect(c.tracks[0].keyframes[0].type).toBe('animation');
  });

  it('NO setea type si no hay señal', () => {
    const c: any = mkMinimal();
    c.tracks = [{ agentId: 'a1', keyframes: [{ t: 1 }] }];
    migrateCutscene(c);
    expect(c.tracks[0].keyframes[0].type).toBeUndefined();
  });
});

describe('migrateCutscene — fx legacy', () => {
  it('fx.keyframes legacy → fx.entities', () => {
    const c: any = mkMinimal();
    delete c.fx;
    c.fx = { keyframes: [{ t: 1, fx: 'smoke', target: { kind: 'cell', cx: 0, cy: 0 } }] };
    migrateCutscene(c);
    expect(Array.isArray(c.fx.entities)).toBe(true);
    expect(c.fx.entities[0].kind).toBe('smoke');
    expect(c.fx.keyframes).toBeUndefined();
  });
});

describe('migrateCutscene — idempotencia', () => {
  it('correr 2 veces produce mismo resultado (deep-equal)', () => {
    const c: any = mkMinimal();
    c.tracks = [{ agentId: 'a1', keyframes: [{ t: 1, cx: 1, cy: 1 }] }];
    delete c.scenes;
    migrateCutscene(c);
    const after1 = JSON.stringify(c);
    migrateCutscene(c);
    const after2 = JSON.stringify(c);
    expect(after2).toEqual(after1);
  });

  it('raw no-objeto retorna sin tocar', () => {
    expect(migrateCutscene(null)).toBe(null);
    expect(migrateCutscene(42)).toBe(42);
  });
});

describe('loadAndMigrateCutscene', () => {
  it('happy path: legacy cutscene válida después de migrate', () => {
    const c: any = {
      duration: 10,
      camera: { keyframes: [] },
      walls: { keyframes: [] },
      fx: { keyframes: [] },   // legacy
      tracks: [{ agentId: 'a1', keyframes: [{ t: 1, cx: 1, cy: 1 }] }],
      agents: [{ id: 'a1' }],
    };
    const r = loadAndMigrateCutscene(c);
    expect(r.ok).toBe(true);
  });

  it('clone: raw original NO se muta', () => {
    const c: any = mkMinimal();
    c.tracks = [{ agentId: 'a1', keyframes: [{ t: 1, cx: 1, cy: 1 }] }];
    const before = JSON.stringify(c);
    loadAndMigrateCutscene(c);
    expect(JSON.stringify(c)).toBe(before);
  });

  it('falla post-migrate cuando shape sigue inválido', () => {
    // Agent kf con type='' (vacío explícito) y sin señales para inferir.
    // Migrate respeta type existente (no setea si ya hay), schema rechaza min(1).
    const c: any = {
      duration: 10,
      camera: { keyframes: [] },
      walls: { keyframes: [] },
      fx: { entities: [] },
      tracks: [{ agentId: 'a1', keyframes: [{ t: 1, type: '' }] }],
      agents: [{ id: 'a1' }],
    };
    const r = loadAndMigrateCutscene(c);
    expect(r.ok).toBe(false);
  });

  it('raw original no se corrompe cuando validate falla', () => {
    const c: any = {
      duration: 10,
      camera: { keyframes: [] },
      walls: { keyframes: [] },
      fx: { entities: [] },
      tracks: [{ agentId: 'a1', keyframes: [{ t: 1, type: '' }] }],
      agents: [{ id: 'a1' }],
    };
    const before = JSON.stringify(c);
    loadAndMigrateCutscene(c);
    expect(JSON.stringify(c)).toBe(before);
  });
});
