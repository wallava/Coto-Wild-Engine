import { describe, it, expect } from 'vitest';
import { loadAndMigrateWorld } from '../../src/engine/migrations';

const wallN = () => Array(7).fill(null).map(() => Array(6).fill(null).map(() => ({ s: false })));
const wallW = () => Array(6).fill(null).map(() => Array(7).fill(null).map(() => ({ w: false })));

const prop = (overrides: Record<string, unknown> = {}) => ({
  id: 'prop-1',
  cx: 0,
  cy: 0,
  h: 1,
  top: null,
  right: null,
  left: null,
  category: 'floor',
  ...overrides,
});

describe('loadAndMigrateWorld integration', () => {
  it('migra payload legacy realista con rooms manuales y autogenerados', () => {
    const result = loadAndMigrateWorld({
      wallN: wallN(),
      wallW: wallW(),
      props: [
        prop({ id: 'wall-n', category: 'wall', side: 'N', cx: 2, cy: 1 }),
        prop({ id: 'wall-w', category: 'wall', side: 'W', cx: 3, cy: 1 }),
        prop({ id: 'floor-1', category: 'floor', side: 'N', cx: 1, cy: 1 }),
      ],
      rooms: [
        {
          id: 'kitchen',
          name: 'Cocina',
          kind: 'kitchen',
          source: 'manual',
          color: 0xffcc00,
          anchorCx: 1,
          anchorCy: 2,
          cells: [{ cx: 1, cy: 1 }, { cx: 2, cy: 1 }],
        },
        {
          id: 'auto-1',
          name: 'Auto',
          kind: null,
          source: 'auto',
          color: 0xcccccc,
          cells: [{ cx: 4, cy: 4 }],
        },
      ],
      agents: [{ id: 'agent-1', cx: 1, cy: 1, needs: { hunger: 0.4 } }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.world.props.map((p) => p.side)).toEqual(['S', 'E', 'N']);
    expect(result.world.zones).toHaveLength(1);
    expect(result.world.zones?.[0]?.id).toBe('kitchen');
    expect(result.world.roomMeta?.[0]).toMatchObject({ id: 'kitchen', anchorCx: 1, anchorCy: 2 });
    expect(result.world.agents?.[0]?.needs?.hunger).toBe(0.4);
  });

  it('acepta payload moderno sin rooms y garantiza defaults', () => {
    const result = loadAndMigrateWorld({
      wallN: wallN(),
      wallW: wallW(),
      props: [prop({ id: 'floor-1', cx: 2, cy: 2 })],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.world.zones).toEqual([]);
    expect(result.world.roomMeta).toEqual([]);
  });

  it('preserva zones existentes y no convierte rooms legacy duplicados', () => {
    const result = loadAndMigrateWorld({
      wallN: wallN(),
      wallW: wallW(),
      props: [],
      zones: [{ id: 'existing', name: 'Existente', kind: null, color: 1, cells: [] }],
      rooms: [{ id: 'legacy', name: 'Legacy', source: 'manual', color: 2, cells: [{ cx: 0, cy: 0 }] }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.world.zones).toEqual([{ id: 'existing', name: 'Existente', kind: null, color: 1, cells: [] }]);
    expect(result.world.roomMeta).toEqual([]);
  });
});
