import { beforeEach, describe, expect, it } from 'vitest';
import { spawnAgent } from '../../src/engine/agent-chassis';

function installCanvasStub(): void {
  globalThis.document = {
    createElement(tagName: string) {
      if (tagName !== 'canvas') throw new Error(`Unexpected element: ${tagName}`);
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          clearRect: () => {},
          fillText: () => {},
          restore: () => {},
          save: () => {},
          scale: () => {},
          translate: () => {},
          font: '',
          textAlign: 'center',
          textBaseline: 'middle',
        }),
      };
    },
  } as unknown as Document;
}

describe('spawnAgent', () => {
  beforeEach(() => {
    installCanvasStub();
  });

  it('inicializa activeConversationId en null', () => {
    const agents = [];

    const agent = spawnAgent(agents, 1, 2, {
      id: 'agent-1',
      emoji: ['brain', 'lamp'],
    });

    expect(agent.activeConversationId).toBeNull();
    expect(agents[0]).toBe(agent);
  });
});
