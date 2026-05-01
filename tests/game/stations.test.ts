import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleAgentLanded } from '../../src/game/stations';
import { setAgentsGetter } from '../../src/engine/agents-state';

// stub thought-bubbles para que showAgentThought no rompa en jsdom-less env
vi.mock('../../src/engine/thought-bubbles', () => ({
  showAgentThought: vi.fn(),
}));

type TestAgent = {
  cx: number;
  cy: number;
  px: number;
  py: number;
  spriteH: number;
  path: [number, number][];
  target: [number, number] | null;
  waiting: number;
  working: null;
};

function mkAgent(overrides: Partial<TestAgent> = {}): TestAgent {
  return {
    cx: 0, cy: 0, px: 0.5, py: 0.5, spriteH: 0,
    path: [], target: null, waiting: 0, working: null,
    ...overrides,
  };
}

describe('handleAgentLanded — pausa social al landing', () => {
  beforeEach(() => {
    setAgentsGetter(() => []);
  });

  it('sin otro agente cerca: no setea waiting (cae al flujo confused)', () => {
    const a = mkAgent({ cx: 3, cy: 3 });
    setAgentsGetter(() => [a]);
    handleAgentLanded(a);
    expect(a.waiting).toBe(0);
  });

  it('con otro agente adyacente (chebyshev 1): setea waiting=5 + return', () => {
    const a = mkAgent({ cx: 3, cy: 3 });
    const b = mkAgent({ cx: 4, cy: 3 });
    setAgentsGetter(() => [a, b]);
    handleAgentLanded(a);
    expect(a.waiting).toBe(5);
  });

  it('con otro agente diagonal (chebyshev 1): setea waiting=5', () => {
    const a = mkAgent({ cx: 3, cy: 3 });
    const b = mkAgent({ cx: 4, cy: 4 });
    setAgentsGetter(() => [a, b]);
    handleAgentLanded(a);
    expect(a.waiting).toBe(5);
  });

  it('con otro agente a distancia 2: NO setea waiting', () => {
    const a = mkAgent({ cx: 3, cy: 3 });
    const b = mkAgent({ cx: 5, cy: 3 });
    setAgentsGetter(() => [a, b]);
    handleAgentLanded(a);
    expect(a.waiting).toBe(0);
  });

  it('self no cuenta como adyacente', () => {
    const a = mkAgent({ cx: 3, cy: 3 });
    setAgentsGetter(() => [a]);   // solo self
    handleAgentLanded(a);
    expect(a.waiting).toBe(0);
  });
});
