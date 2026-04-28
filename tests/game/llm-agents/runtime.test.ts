import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupAgentRuntime } from '../../../src/game/llm-agents/runtime';
import { MockLLMClient } from '../../../src/llm/mock-client';
import { createSessionCostTracker } from '../../../src/llm/cost-tracker';
import { getGlobalQueue, resetGlobalQueueForTests } from '../../../src/llm/queue';
import { ceoPretender } from '../../../src/game/llm-agents/personalities/ceo-pretender';
import { LLM_STORAGE_KEYS } from '../../../src/llm/storage-keys';

beforeEach(() => {
  resetGlobalQueueForTests();
  // localStorage stub
  if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = { _data: {} as any, getItem(k:string){return this._data[k]??null}, setItem(k:string,v:string){this._data[k]=v}, removeItem(k:string){delete this._data[k]}, clear(){this._data={}}, get length(){return Object.keys(this._data).length}, key(i:number){return Object.keys(this._data)[i]??null} } as any;
  }
  localStorage.clear();
  localStorage.setItem(LLM_STORAGE_KEYS.apiKey, 'sk-ant-api01-XXX');
});

describe('setupAgentRuntime', () => {
  it('tick() retorna sin error con 0 agents', async () => {
    const handle = setupAgentRuntime({
      listActiveAgentIds: () => [],
      getAgentCell: () => null,
      personalityFor: () => null,
      agentRef: () => null,
      client: new MockLLMClient(),
      tracker: createSessionCostTracker(),
      queue: getGlobalQueue(),
      showSpeechBubble: vi.fn(),
      tickIntervalMs: 100000,
    });
    await handle.tick();
    handle.stop();
  });

  it('stop() limpia interval', () => {
    const handle = setupAgentRuntime({
      listActiveAgentIds: () => [],
      getAgentCell: () => null,
      personalityFor: () => null,
      agentRef: () => null,
      client: new MockLLMClient(),
      tracker: createSessionCostTracker(),
      queue: getGlobalQueue(),
      showSpeechBubble: vi.fn(),
    });
    expect(() => handle.stop()).not.toThrow();
  });

  it('skip si personalityFor retorna null', async () => {
    const client = new MockLLMClient();
    const completeSpy = vi.spyOn(client, 'completeStream' as any);
    const handle = setupAgentRuntime({
      listActiveAgentIds: () => ['a', 'b'],
      getAgentCell: (id) => id === 'a' ? {cx:0,cy:0} : {cx:1,cy:0},
      personalityFor: () => null,
      agentRef: (id) => ({ id }),
      client,
      tracker: createSessionCostTracker(),
      queue: getGlobalQueue(),
      showSpeechBubble: vi.fn(),
      tickIntervalMs: 100000,
      nowMs: () => 5000,
    });
    await handle.tick();
    expect(completeSpy).not.toHaveBeenCalled();
    handle.stop();
  });

  it('llama brain.speak cuando trigger emit', async () => {
    const client = new MockLLMClient();
    client.queue({ text: 'Excelente punto, gente.' });
    const tracker = createSessionCostTracker();
    let now = 0;
    const handle = setupAgentRuntime({
      listActiveAgentIds: () => ['a', 'b'],
      getAgentCell: (id) => id === 'a' ? {cx:0,cy:0} : {cx:1,cy:0},
      personalityFor: () => ceoPretender,
      agentRef: (id) => ({ id }),
      client,
      tracker,
      queue: getGlobalQueue(),
      showSpeechBubble: vi.fn(),
      tickIntervalMs: 100000,
      nowMs: () => now,
    });
    await handle.tick();
    now = 4000;
    await handle.tick();
    await new Promise(r => setTimeout(r, 50));
    expect(tracker.getSessionCost()).toBeGreaterThan(0);
    handle.stop();
  });
});
