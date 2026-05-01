import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/game/llm-agents/conversation', () => ({
  startConversation: vi.fn(() => Promise.resolve()),
}));

import { setupAgentRuntime } from '../../../src/game/llm-agents/runtime';
import { startConversation } from '../../../src/game/llm-agents/conversation';
import { AgentBrain, type SpeakResult } from '../../../src/game/llm-agents/brain';
import { MockLLMClient } from '../../../src/llm/mock-client';
import { createSessionCostTracker } from '../../../src/llm/cost-tracker';
import { getGlobalQueue, resetGlobalQueueForTests } from '../../../src/llm/queue';
import { ceoPretender } from '../../../src/game/llm-agents/personalities/ceo-pretender';
import { LLM_STORAGE_KEYS } from '../../../src/llm/storage-keys';

beforeEach(() => {
  resetGlobalQueueForTests();
  vi.clearAllMocks();
  vi.restoreAllMocks();
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
      getAgentPositionX: () => null,
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
      getAgentPositionX: () => null,
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
      getAgentPositionX: (id) => id === 'a' ? 0 : 1,
      personalityFor: () => null,
      agentRef: (id) => ({ id, talking: false, activeConversationId: null }),
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

  it('social_encounter event dispara startConversation, no speak directo', async () => {
    const speakSpy = vi.spyOn(AgentBrain.prototype, 'speak');
    let now = 0;
    const agents = new Map([
      ['a', { id: 'a', px: 0, talking: false, activeConversationId: null }],
      ['b', { id: 'b', px: 1, talking: false, activeConversationId: null }],
    ]);
    const handle = setupAgentRuntime({
      listActiveAgentIds: () => ['a', 'b'],
      getAgentCell: (id) => id === 'a' ? {cx:0,cy:0} : {cx:1,cy:0},
      getAgentPositionX: (id) => agents.get(id)?.px ?? null,
      personalityFor: () => ceoPretender,
      agentRef: (id) => agents.get(id) ?? null,
      client: new MockLLMClient(),
      tracker: createSessionCostTracker(),
      queue: getGlobalQueue(),
      showSpeechBubble: vi.fn(),
      tickIntervalMs: 100000,
      nowMs: () => now,
    });
    await handle.tick();
    now = 4000;
    await handle.tick();
    expect(startConversation).toHaveBeenCalledTimes(1);
    expect(speakSpy).not.toHaveBeenCalled();
    handle.stop();
  });

  it('crisis event sigue con speak directo', async () => {
    const speakResult: SpeakResult = { ok: true, text: 'Necesito comer.', cost: 0.001 };
    const speakSpy = vi.spyOn(AgentBrain.prototype, 'speak').mockResolvedValue(speakResult);
    const handle = setupAgentRuntime({
      listActiveAgentIds: () => ['a'],
      getAgentCell: () => ({cx:0,cy:0}),
      getAgentPositionX: () => 0,
      getAgentNeed: (_id, kind) => kind === 'hunger' ? 10 : null,
      personalityFor: () => ceoPretender,
      agentRef: (id) => ({ id, talking: false, activeConversationId: null }),
      client: new MockLLMClient(),
      tracker: createSessionCostTracker(),
      queue: getGlobalQueue(),
      showSpeechBubble: vi.fn(),
      tickIntervalMs: 100000,
      nowMs: () => 5000,
    });
    await handle.tick();
    expect(speakSpy).toHaveBeenCalledTimes(1);
    expect(startConversation).not.toHaveBeenCalled();
    handle.stop();
  });

  it('crisis lock: setea talking=true + path/target limpios; finally restaura + waiting=1.5', async () => {
    let resolveSpeak: ((r: SpeakResult) => void) | null = null;
    vi.spyOn(AgentBrain.prototype, 'speak').mockImplementation(
      () => new Promise<SpeakResult>(res => { resolveSpeak = res; }),
    );
    const agent: any = {
      id: 'a',
      talking: false,
      activeConversationId: null,
      path: [[1,1],[2,2]],
      target: [2,2],
      waiting: 0,
    };
    const handle = setupAgentRuntime({
      listActiveAgentIds: () => ['a'],
      getAgentCell: () => ({cx:0,cy:0}),
      getAgentPositionX: () => 0,
      getAgentNeed: (_id, kind) => kind === 'hunger' ? 10 : null,
      personalityFor: () => ceoPretender,
      agentRef: () => agent,
      client: new MockLLMClient(),
      tracker: createSessionCostTracker(),
      queue: getGlobalQueue(),
      showSpeechBubble: vi.fn(),
      tickIntervalMs: 100000,
      nowMs: () => 5000,
    });
    await handle.tick();
    // Inmediatamente post-tick: locks aplicados.
    expect(agent.talking).toBe(true);
    expect(agent.path).toEqual([]);
    expect(agent.target).toBeNull();
    // Resolver speak → finally limpia talking + setea waiting.
    resolveSpeak!({ ok: true, text: 'X', cost: 0 });
    await Promise.resolve();
    await Promise.resolve();
    expect(agent.talking).toBe(false);
    expect(agent.waiting).toBe(1.5);
    handle.stop();
  });

  it('crisis: si agent.talking=true ya, no re-dispara speak', async () => {
    const speakSpy = vi.spyOn(AgentBrain.prototype, 'speak').mockResolvedValue({ ok: true, text: 'x', cost: 0 } as SpeakResult);
    const agent: any = { id: 'a', talking: true, activeConversationId: null };
    const handle = setupAgentRuntime({
      listActiveAgentIds: () => ['a'],
      getAgentCell: () => ({cx:0,cy:0}),
      getAgentPositionX: () => 0,
      getAgentNeed: (_id, kind) => kind === 'hunger' ? 10 : null,
      personalityFor: () => ceoPretender,
      agentRef: () => agent,
      client: new MockLLMClient(),
      tracker: createSessionCostTracker(),
      queue: getGlobalQueue(),
      showSpeechBubble: vi.fn(),
      tickIntervalMs: 100000,
      nowMs: () => 5000,
    });
    await handle.tick();
    expect(speakSpy).not.toHaveBeenCalled();
    handle.stop();
  });

  it('T21 crisis path: speak retorna SpeakResult sin romper runtime', async () => {
    const speakResult: SpeakResult = { ok: false, text: 'Ahora no.', cost: 0, reason: 'agent_cooldown' };
    vi.spyOn(AgentBrain.prototype, 'speak').mockResolvedValue(speakResult);
    const handle = setupAgentRuntime({
      listActiveAgentIds: () => ['a'],
      getAgentCell: () => ({cx:0,cy:0}),
      getAgentPositionX: () => 0,
      getAgentNeed: (_id, kind) => kind === 'energy' ? 5 : null,
      personalityFor: () => ceoPretender,
      agentRef: (id) => ({ id, talking: false, activeConversationId: null }),
      client: new MockLLMClient(),
      tracker: createSessionCostTracker(),
      queue: getGlobalQueue(),
      showSpeechBubble: vi.fn(),
      tickIntervalMs: 100000,
      nowMs: () => 5000,
    });
    await expect(handle.tick()).resolves.toBeUndefined();
    handle.stop();
  });

  it('defensa secundaria: agent.talking=true → no dispara startConversation', async () => {
    const agents = new Map([
      ['a', { id: 'a', px: 0, talking: true, activeConversationId: null }],
      ['b', { id: 'b', px: 1, talking: false, activeConversationId: null }],
    ]);
    let now = 0;
    const handle = setupAgentRuntime({
      listActiveAgentIds: () => ['a', 'b'],
      getAgentCell: (id) => id === 'a' ? {cx:0,cy:0} : {cx:1,cy:0},
      getAgentPositionX: (id) => agents.get(id)?.px ?? null,
      personalityFor: () => ceoPretender,
      agentRef: (id) => agents.get(id) ?? null,
      client: new MockLLMClient(),
      tracker: createSessionCostTracker(),
      queue: getGlobalQueue(),
      showSpeechBubble: vi.fn(),
      tickIntervalMs: 100000,
      nowMs: () => now,
    });
    await handle.tick();
    now = 4000;
    await handle.tick();
    expect(startConversation).not.toHaveBeenCalled();
    handle.stop();
  });
});
