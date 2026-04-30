import { describe, expect, it } from 'vitest';
import { NEED_DECAY, updateAgentNeeds } from '../../src/game/needs';

type TestAgent = {
  cx: number;
  cy: number;
  needs: Record<string, number>;
  working: { elapsed: number; duration: number; prop: unknown; zoneKind: string } | null;
  talking?: boolean;
  statusEmoji?: string | null;
  statusMesh?: null;
};

function makeAgent(overrides: Partial<TestAgent> = {}): TestAgent {
  return {
    cx: 0,
    cy: 0,
    needs: {
      focus: 80,
      hunger: 80,
      social: 80,
      bathroom: 80,
    },
    working: null,
    statusEmoji: null,
    statusMesh: null,
    ...overrides,
  };
}

describe('updateAgentNeeds talking guard', () => {
  it('agente con talking=true: needs no decae', () => {
    const agent = makeAgent({ talking: true });

    updateAgentNeeds([agent], 10);

    expect(agent.needs).toEqual({
      focus: 80,
      hunger: 80,
      social: 80,
      bathroom: 80,
    });
  });

  it('agente con talking=false: needs decae normal', () => {
    const agent = makeAgent({ talking: false });

    updateAgentNeeds([agent], 10);

    expect(agent.needs['focus']).toBe(80 - NEED_DECAY.focus * 10);
    expect(agent.needs['hunger']).toBe(80 - NEED_DECAY.hunger * 10);
    expect(agent.needs['social']).toBe(80 - NEED_DECAY.social * 10);
    expect(agent.needs['bathroom']).toBe(80 - NEED_DECAY.bathroom * 10);
  });

  it('agente con talking=true + working=null: working timer no avanza', () => {
    const working = {
      elapsed: 2,
      duration: 8,
      prop: null,
      zoneKind: 'office',
    };
    const agent = makeAgent({ talking: true, working });

    updateAgentNeeds([agent], 3);

    expect(agent.working).toBe(working);
    expect(agent.working?.elapsed).toBe(2);
  });
});
