import { describe, it, expect } from 'vitest';
import { migrateWorld, loadAndMigrateWorld } from '../../src/engine/migrations';

const validProp = (overrides: Record<string, unknown> = {}) => ({
  id: 'prop-1',
  cx: 1,
  cy: 2,
  h: 10,
  top: { color: 1 },
  right: { color: 2 },
  left: { color: 3 },
  category: 'floor',
  ...overrides,
});

const validLegacyWorld = (overrides: Record<string, unknown> = {}) => ({
  wallN: Array(7).fill(null).map(() => Array(6).fill(null).map(() => ({ s: false }))),
  wallW: Array(6).fill(null).map(() => Array(7).fill(null).map(() => ({ w: false }))),
  props: [
    validProp({ id: 'wall-1', category: 'wall', side: 'N' }),
    validProp({ id: 'floor-1', category: 'floor', side: 'N' }),
  ],
  rooms: [
    {
      id: 'r1',
      name: 'cocina',
      kind: 'kitchen',
      source: 'manual',
      cells: [{ cx: 0, cy: 0 }],
      color: 0xff0000,
      anchorCx: 2,
      anchorCy: 3,
    },
    {
      id: 'r2',
      name: 'auto',
      source: 'auto',
      cells: [{ cx: 1, cy: 1 }],
      color: 0x00ff00,
    },
  ],
  agents: [{ id: 'agent-1', cx: 0, cy: 0 }],
  ...overrides,
});

describe('migrateWorld', () => {
  it('sides N→S, W→E en wall props', () => {
    const w: any = { wallN: [], wallW: [], props: [
      { category: 'wall', side: 'N' },
      { category: 'wall', side: 'W' },
      { category: 'floor', side: 'N' },
    ]};
    migrateWorld(w);
    expect(w.props[0].side).toBe('S');
    expect(w.props[1].side).toBe('E');
    expect(w.props[2].side).toBe('N');
  });

  it('rooms → zones (solo source=manual)', () => {
    const w: any = {
      wallN: [], wallW: [], props: [],
      rooms: [
        { id: 'r1', name: 'cocina', source: 'manual', cells: [{cx:0,cy:0}], color: 0xff0000 },
        { id: 'r2', name: 'auto', source: 'auto', cells: [{cx:1,cy:1}] },
      ],
    };
    migrateWorld(w);
    expect(w.zones).toHaveLength(1);
    expect(w.zones[0].id).toBe('r1');
    expect(w.roomMeta).toHaveLength(1);
    expect(w.rooms).toBeUndefined();
  });

  it('rooms vacío → zones=[]', () => {
    const w: any = { wallN: [], wallW: [], props: [], rooms: [] };
    migrateWorld(w);
    expect(w.zones).toEqual([]);
  });

  it('default zones/roomMeta si missing', () => {
    const w: any = { wallN: [], wallW: [], props: [] };
    migrateWorld(w);
    expect(w.zones).toEqual([]);
    expect(w.roomMeta).toEqual([]);
  });

  it('idempotente (correr 2 veces produce mismo resultado)', () => {
    const w1: any = {
      wallN: [], wallW: [], props: [{ category: 'wall', side: 'N' }],
      rooms: [{ id: 'r1', name: 'a', source: 'manual', cells: [], color: 1 }],
    };
    migrateWorld(w1);
    const after1 = JSON.stringify(w1);
    migrateWorld(w1);
    const after2 = JSON.stringify(w1);
    expect(after2).toEqual(after1);
  });

  it('raw no-objeto retorna sin tocar', () => {
    expect(migrateWorld(null)).toBe(null);
    expect(migrateWorld(42)).toBe(42);
  });

  it('zones ya existentes no se tocan (no re-migra)', () => {
    const w: any = {
      wallN: [], wallW: [], props: [],
      rooms: [{ id: 'r1', name: 'a', source: 'manual', cells: [], color: 1 }],
      zones: [{ id: 'existing', name: 'kept', kind: null, color: 0, cells: [] }],
    };
    migrateWorld(w);
    expect(w.zones).toHaveLength(1);
    expect(w.zones[0].id).toBe('existing');
  });

  it('cells inválidas se filtran en zona migrada', () => {
    const w: any = {
      wallN: [], wallW: [], props: [],
      rooms: [{ id: 'r1', name: 'a', source: 'manual', cells: [{cx:0,cy:0},{invalid:true}], color: 1 }],
    };
    migrateWorld(w);
    expect(w.zones[0].cells).toHaveLength(1);
    expect(w.zones[0].cells[0]).toEqual({ cx: 0, cy: 0 });
  });

  it('roomMeta copia anchorCx/anchorCy correctamente', () => {
    const w: any = {
      wallN: [], wallW: [], props: [],
      rooms: [{ id: 'r1', name: 'sala', source: 'manual', cells: [], color: 5, anchorCx: 3, anchorCy: 4 }],
    };
    migrateWorld(w);
    expect(w.roomMeta[0].anchorCx).toBe(3);
    expect(w.roomMeta[0].anchorCy).toBe(4);
  });

  it('rooms sin source no generan zonas', () => {
    const w: any = {
      wallN: [], wallW: [], props: [],
      rooms: [{ id: 'r1', name: 'sin source', cells: [], color: 1 }],
    };
    migrateWorld(w);
    expect(w.zones).toEqual([]);
    expect(w.roomMeta).toEqual([]);
  });
});

describe('loadAndMigrateWorld', () => {
  it('happy path: world legacy → ok=true', () => {
    const r = loadAndMigrateWorld(validLegacyWorld());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.world.props[0]?.side).toBe('S');
    expect(r.world.props[1]?.side).toBe('N');
    expect(r.world.zones).toEqual([
      {
        id: 'r1',
        name: 'cocina',
        kind: 'kitchen',
        color: 0xff0000,
        cells: [{ cx: 0, cy: 0 }],
      },
    ]);
    expect(r.world.roomMeta?.[0]).toMatchObject({
      id: 'r1',
      name: 'cocina',
      kind: 'kitchen',
      color: 0xff0000,
      anchorCx: 2,
      anchorCy: 3,
    });
  });

  it('clone: raw original NO se muta', () => {
    const w: any = { wallN: [], wallW: [], props: [], rooms: [{ id: 'r1', source: 'manual', name: 'x', cells: [], color: 1 }] };
    const before = JSON.stringify(w);
    loadAndMigrateWorld(w);
    expect(JSON.stringify(w)).toBe(before);
  });

  it('falla post-migrate: shape sigue inválido', () => {
    const w: any = { wallN: 'not array', wallW: [], props: [] };
    const r = loadAndMigrateWorld(w);
    expect(r.ok).toBe(false);
  });

  it('raw original no se corrompe cuando validate falla', () => {
    const w: any = { wallN: 'not array', wallW: [], props: [] };
    const before = JSON.stringify(w);
    loadAndMigrateWorld(w);
    expect(JSON.stringify(w)).toBe(before);
  });
});
