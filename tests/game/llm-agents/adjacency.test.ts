import { describe, expect, it } from 'vitest';
import { areAgentsAdjacent, chebyshevCellDistance } from '../../../src/game/llm-agents/adjacency';

describe('llm-agent adjacency helpers', () => {
  it('misma celda (0,0)-(0,0) retorna true', () => {
    expect(areAgentsAdjacent({ cx: 0, cy: 0 }, { cx: 0, cy: 0 })).toBe(true);
  });

  it('ortogonal adyacente (0,0)-(1,0) retorna true', () => {
    expect(areAgentsAdjacent({ cx: 0, cy: 0 }, { cx: 1, cy: 0 })).toBe(true);
  });

  it('diagonal adyacente (0,0)-(1,1) retorna true', () => {
    expect(areAgentsAdjacent({ cx: 0, cy: 0 }, { cx: 1, cy: 1 })).toBe(true);
  });

  it('2 celdas distancia (0,0)-(2,0) retorna false', () => {
    expect(areAgentsAdjacent({ cx: 0, cy: 0 }, { cx: 2, cy: 0 })).toBe(false);
  });

  it('lejano (0,0)-(5,5) retorna false', () => {
    expect(areAgentsAdjacent({ cx: 0, cy: 0 }, { cx: 5, cy: 5 })).toBe(false);
  });

  it('chebyshevCellDistance retorna 0, 1, 2 para los casos correspondientes', () => {
    expect(chebyshevCellDistance({ cx: 0, cy: 0 }, { cx: 0, cy: 0 })).toBe(0);
    expect(chebyshevCellDistance({ cx: 0, cy: 0 }, { cx: 1, cy: 1 })).toBe(1);
    expect(chebyshevCellDistance({ cx: 0, cy: 0 }, { cx: 2, cy: 0 })).toBe(2);
  });

  it('negativos: (-1,-1)-(0,0) retorna true', () => {
    expect(areAgentsAdjacent({ cx: -1, cy: -1 }, { cx: 0, cy: 0 })).toBe(true);
  });
});
