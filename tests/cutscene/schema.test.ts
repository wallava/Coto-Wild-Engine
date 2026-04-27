import { describe, it, expect } from 'vitest';
import {
  AgentKfSchema,
  AgentTrackSchema,
  CameraKfSchema,
  CutsceneAgentSchema,
  CutsceneSchema,
  FxEntitySchema,
  FxKfSchema,
  FxTargetSchema,
  SceneSchema,
  WallsKfSchema,
} from '../../src/cutscene/schema';

describe('SceneSchema', () => {
  it('accepts a valid scene', () => {
    const result = SceneSchema.safeParse({ id: 's1', tStart: 0, tEnd: 5, name: 'plano 1' });
    expect(result.success).toBe(true);
  });

  it('rejects tEnd equal to tStart', () => {
    const result = SceneSchema.safeParse({ id: 's1', tStart: 0, tEnd: 0, name: 'plano 1' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty id', () => {
    const result = SceneSchema.safeParse({ id: '', tStart: 0, tEnd: 5, name: 'plano 1' });
    expect(result.success).toBe(false);
  });

  it('preserves passthrough fields', () => {
    const result = SceneSchema.safeParse({
      id: 's1',
      tStart: 0,
      tEnd: 5,
      name: 'plano 1',
      extraField: 42,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.extraField).toBe(42);
  });
});

describe('FxTargetSchema', () => {
  it('accepts an agent target', () => {
    const result = FxTargetSchema.safeParse({ kind: 'agent', id: 'agent-1' });
    expect(result.success).toBe(true);
  });

  it('accepts a cell target', () => {
    const result = FxTargetSchema.safeParse({ kind: 'cell', cx: 0, cy: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts a generic target kind', () => {
    const result = FxTargetSchema.safeParse({ kind: 'world', radius: 3 });
    expect(result.success).toBe(true);
  });

  it('rejects an agent target without id', () => {
    const result = FxTargetSchema.safeParse({ kind: 'agent' });
    expect(result.success).toBe(false);
  });

  it('rejects a cell target without cx', () => {
    const result = FxTargetSchema.safeParse({ kind: 'cell', cy: 0 });
    expect(result.success).toBe(false);
  });
});

describe('CameraKfSchema', () => {
  it('accepts position and target Vec3 objects', () => {
    const result = CameraKfSchema.safeParse({
      t: 0,
      type: 'camera',
      position: { x: 1, y: 2, z: 3 },
      target: { x: 4, y: 5, z: 6 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a null position', () => {
    const result = CameraKfSchema.safeParse({
      t: 0,
      position: null,
      target: { x: 4, y: 5, z: 6 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-camera type when type is present', () => {
    const result = CameraKfSchema.safeParse({ t: 0, type: 'shot' });
    expect(result.success).toBe(false);
  });
});

describe('WallsKfSchema', () => {
  it('accepts hidden ids', () => {
    const result = WallsKfSchema.safeParse({ t: 0, hiddenIds: ['w1', 'w2'] });
    expect(result.success).toBe(true);
  });

  it('rejects negative time', () => {
    const result = WallsKfSchema.safeParse({ t: -1, hiddenIds: [] });
    expect(result.success).toBe(false);
  });
});

describe('FxKfSchema', () => {
  it('accepts a target and fx payload', () => {
    const result = FxKfSchema.safeParse({
      t: 0,
      target: { kind: 'cell', cx: 1, cy: 2 },
      fx: 'spark',
      duration: 1,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a null target', () => {
    const result = FxKfSchema.safeParse({ t: 0, target: null });
    expect(result.success).toBe(true);
  });
});

describe('AgentKfSchema', () => {
  it('accepts a custom type', () => {
    const result = AgentKfSchema.safeParse({ t: 0, type: 'walk' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing type', () => {
    const result = AgentKfSchema.safeParse({ t: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects an empty type', () => {
    const result = AgentKfSchema.safeParse({ t: 0, type: '' });
    expect(result.success).toBe(false);
  });
});

describe('AgentTrackSchema', () => {
  it('accepts an agent track with keyframes', () => {
    const result = AgentTrackSchema.safeParse({
      agentId: 'agent-1',
      keyframes: [{ t: 0, type: 'walk' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty agent id', () => {
    const result = AgentTrackSchema.safeParse({ agentId: '', keyframes: [] });
    expect(result.success).toBe(false);
  });
});

describe('CutsceneAgentSchema', () => {
  it('accepts a minimal cutscene agent', () => {
    const result = CutsceneAgentSchema.safeParse({ id: 'agent-1' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty id', () => {
    const result = CutsceneAgentSchema.safeParse({ id: '' });
    expect(result.success).toBe(false);
  });
});

describe('FxEntitySchema', () => {
  it('rejects a missing keyframes field', () => {
    const result = FxEntitySchema.safeParse({ id: 'fx-1', kind: 'spark' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty id', () => {
    const result = FxEntitySchema.safeParse({ id: '', kind: 'spark', keyframes: [] });
    expect(result.success).toBe(false);
  });

  it('accepts a valid entity with minimal keyframes', () => {
    const result = FxEntitySchema.safeParse({
      id: 'fx-1',
      kind: 'spark',
      keyframes: [{ t: 0 }],
    });
    expect(result.success).toBe(true);
  });
});

describe('CutsceneSchema', () => {
  it('accepts a minimal valid cutscene', () => {
    const result = CutsceneSchema.safeParse({
      duration: 5,
      camera: { keyframes: [] },
      walls: { keyframes: [] },
      fx: { entities: [] },
      tracks: [],
      agents: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects duration less than or equal to zero', () => {
    const result = CutsceneSchema.safeParse({
      duration: 0,
      camera: { keyframes: [] },
      walls: { keyframes: [] },
      fx: { entities: [] },
      tracks: [],
      agents: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-array tracks', () => {
    const result = CutsceneSchema.safeParse({
      duration: 5,
      camera: { keyframes: [] },
      walls: { keyframes: [] },
      fx: { entities: [] },
      tracks: {},
      agents: [],
    });
    expect(result.success).toBe(false);
  });
});
