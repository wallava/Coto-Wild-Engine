import { describe, it, expect } from 'vitest';
import {
  AgentSchema,
  PropSchema,
  RoomMetaSchema,
  WorldSchema,
  ZoneSchema,
} from '../../src/engine/schema';
import { validateWorld, isValidWorldData } from '../../src/engine/persistence';

const wallN = () => Array(7).fill(null).map(() => Array(6).fill(null).map(() => ({ s: false })));
const wallW = () => Array(6).fill(null).map(() => Array(7).fill(null).map(() => ({ w: false })));

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

describe('AgentSchema', () => {
  it('accepts a minimum valid agent', () => {
    const result = AgentSchema.safeParse({ id: 'agent-1', cx: 0, cy: 0 });
    expect(result.success).toBe(true);
  });

  it('rejects an empty id', () => {
    const result = AgentSchema.safeParse({ id: '', cx: 0, cy: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts valid needs', () => {
    const result = AgentSchema.safeParse({
      id: 'agent-1',
      cx: 0,
      cy: 0,
      needs: { hunger: 0.2, energy: 0.9 },
    });
    expect(result.success).toBe(true);
  });
});

describe('PropSchema', () => {
  it('accepts a minimum valid floor prop', () => {
    const result = PropSchema.safeParse(validProp());
    expect(result.success).toBe(true);
  });

  it('accepts a wall prop with a valid side', () => {
    const result = PropSchema.safeParse(validProp({ category: 'wall', side: 'N' }));
    expect(result.success).toBe(true);
  });

  it('rejects a side outside N/S/E/W', () => {
    const result = PropSchema.safeParse(validProp({ category: 'wall', side: 'Q' }));
    expect(result.success).toBe(false);
  });

  it('preserves passthrough fields', () => {
    const result = PropSchema.safeParse(validProp({ customField: 42 }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.customField).toBe(42);
  });
});

describe('ZoneSchema', () => {
  it('accepts a zone with valid cells', () => {
    const result = ZoneSchema.safeParse({
      id: 'zone-1',
      name: 'Cocina',
      kind: null,
      color: 0xffcc00,
      cells: [{ cx: 1, cy: 2 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a cell without cx/cy', () => {
    const result = ZoneSchema.safeParse({
      id: 'zone-1',
      name: 'Cocina',
      kind: null,
      color: 0xffcc00,
      cells: [{ cx: 1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('RoomMetaSchema', () => {
  it('accepts a valid room meta', () => {
    const result = RoomMetaSchema.safeParse({
      id: 'room-1',
      name: 'Dormitorio',
      kind: null,
      color: 0x6699ff,
      anchorCx: 1,
      anchorCy: 2,
    });
    expect(result.success).toBe(true);
  });
});

describe('WorldSchema integration', () => {
  it('accepts a minimum valid world with empty walls and props array', () => {
    const result = WorldSchema.safeParse({ wallN: [], wallW: [], props: [] });
    expect(result.success).toBe(true);
  });

  it('rejects non-array props', () => {
    const result = WorldSchema.safeParse({ wallN: [], wallW: [], props: {} });
    expect(result.success).toBe(false);
  });

  it('rejects non-array wallN', () => {
    const result = WorldSchema.safeParse({ wallN: {}, wallW: [], props: [] });
    expect(result.success).toBe(false);
  });

  it('preserves passthrough fields', () => {
    const result = WorldSchema.safeParse({
      wallN: [],
      wallW: [],
      props: [],
      customWorldField: 'legacy',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.customWorldField).toBe('legacy');
  });
});

describe('validateWorld', () => {
  it('shape valido + dim correctas ok', () => {
    const world = { wallN: wallN(), wallW: wallW(), props: [] };
    const r = validateWorld(world);
    expect(r.ok).toBe(true);
  });

  it('shape valido + dim malas BAD_DIMENSIONS', () => {
    const world = { wallN: [[]], wallW: [[]], props: [] };
    const r = validateWorld(world);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatchObject({ code: 'BAD_DIMENSIONS' });
  });

  it('shape invalido ZodError', () => {
    const r = validateWorld({ wallN: 'not array', wallW: [], props: [] });
    expect(r.ok).toBe(false);
  });
});

describe('isValidWorldData compat legacy', () => {
  it('props [{}] sigue pasando el guard laxo', () => {
    const world = {
      wallN: Array(7).fill(null).map(() => Array(6).fill(null).map(() => ({}))),
      wallW: Array(6).fill(null).map(() => Array(7).fill(null).map(() => ({}))),
      props: [{}],
    };
    expect(isValidWorldData(world)).toBe(true);
  });
});
