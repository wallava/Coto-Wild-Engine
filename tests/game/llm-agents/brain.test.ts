import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentBrain } from '../../../src/game/llm-agents/brain';
import { MockLLMClient } from '../../../src/llm/mock-client';
import { createSessionCostTracker } from '../../../src/llm/cost-tracker';
import { getGlobalQueue, resetGlobalQueueForTests } from '../../../src/llm/queue';
import { ceoPretender } from '../../../src/game/llm-agents/personalities/ceo-pretender';
import { createEmptyMemory } from '../../../src/game/llm-agents/memory';
import { LLM_STORAGE_KEYS } from '../../../src/llm/storage-keys';
import type { AgentLike } from '../../../src/game/llm-agents/actions';
import type { Personality } from '../../../src/game/llm-agents/personality';
import type { LLMClient } from '../../../src/llm/types';
import { LLMError } from '../../../src/llm/types';
import { getBubbleDurationMs } from '../../../src/game/llm-agents/bubble-duration';
import { memoryStorageKey } from '../../../src/game/llm-agents/persistence';

type BubbleStub = { fullText: string; autoCloseAfter: number | null; timeRevealed: number | null };
let lastBubbleHandle: BubbleStub | null = null;

const mockBubbleImpl = (_agent: unknown, text: string, opts?: { autoCloseAfter?: number }) => {
  lastBubbleHandle = {
    fullText: text,
    autoCloseAfter: opts?.autoCloseAfter ?? null,
    timeRevealed: null,
  };
  return lastBubbleHandle;
};
const mockBubble = vi.fn(mockBubbleImpl);

beforeEach(() => {
  resetGlobalQueueForTests();
  mockBubble.mockReset();
  mockBubble.mockImplementation(mockBubbleImpl);
  lastBubbleHandle = null;
  if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = {
      _data: {} as Record<string, string>,
      getItem(k: string) { return (this as any)._data[k] ?? null; },
      setItem(k: string, v: string) { (this as any)._data[k] = v; },
      removeItem(k: string) { delete (this as any)._data[k]; },
      clear() { (this as any)._data = {}; },
      get length() { return Object.keys((this as any)._data).length; },
      key(i: number) { return Object.keys((this as any)._data)[i] ?? null; },
    } as any;
  }
  localStorage.clear();
  localStorage.setItem(LLM_STORAGE_KEYS.apiKey, 'sk-ant-api01-XXX');
});

afterEach(() => {
  vi.useRealTimers();
});

function fallbackPhrases(): string[] {
  return ceoPretender.fallbackPhrases;
}

function expectFallbackBubble(agent: AgentLike): void {
  expect(mockBubble).toHaveBeenCalledTimes(1);
  const phraseRegex = new RegExp(fallbackPhrases().map(escapeRegExp).join('|'));
  const lastCall = mockBubble.mock.calls[mockBubble.mock.calls.length - 1]!;
  const [calledAgent, calledText, calledOpts] = lastCall;
  expect(calledAgent).toBe(agent);
  expect(calledText as string).toMatch(phraseRegex);
  expect(calledOpts).toEqual({ autoCloseAfter: getBubbleDurationMs(calledText as string) / 1000 });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function testPersonality(overrides: Partial<Personality> = {}): Personality {
  return {
    ...ceoPretender,
    triggers: {
      ...ceoPretender.triggers,
      cooldownMsAfterSpeak: 30_000,
    },
    ...overrides,
  };
}

function createBrain(opts: {
  agentId?: string;
  client?: LLMClient;
  capUSD?: number;
  nowMs?: () => number;
  personality?: Personality;
} = {}): {
  agent: AgentLike;
  brain: AgentBrain;
  client: LLMClient;
  memory: ReturnType<typeof createEmptyMemory>;
  tracker: ReturnType<typeof createSessionCostTracker>;
} {
  const agent: AgentLike = { id: opts.agentId ?? 'agent-1' };
  const client = opts.client ?? new MockLLMClient();
  const memory = createEmptyMemory(agent.id);
  const tracker = createSessionCostTracker(
    opts.capUSD === undefined ? undefined : { capUSD: opts.capUSD },
  );

  return {
    agent,
    brain: new AgentBrain({
      agent,
      personality: opts.personality ?? testPersonality(),
      memory,
      client,
      tracker,
      queue: getGlobalQueue(),
      showSpeechBubble: mockBubble,
      nowMs: opts.nowMs,
    }),
    client,
    memory,
    tracker,
  };
}

describe('AgentBrain.speak', () => {
  it('streams to bubble, tracks cost, and adds one memory episode on happy path', async () => {
    const { agent, brain, client, memory, tracker } = createBrain();
    (client as MockLLMClient).queue({ text: 'Alineacion estrategica clara' });

    await brain.speak('employee-1');

    // R3 fix: streaming-ui crea bubble UNA vez con texto vacío y muta
    // handle.fullText/autoCloseAfter después. mockBubble.calls = 1 (initial).
    expect(mockBubble).toHaveBeenCalledTimes(1);
    expect(mockBubble).toHaveBeenCalledWith(agent, ' ', { autoCloseAfter: 999 });
    expect(lastBubbleHandle?.fullText).toBe('Alineacion estrategica clara ');
    expect(lastBubbleHandle?.autoCloseAfter).toBe(
      getBubbleDurationMs('Alineacion estrategica clara ') / 1000,
    );
    expect(tracker.getSessionCost()).toBeGreaterThan(0);
    expect(memory.episodes).toHaveLength(1);
    expect(memory.episodes[0]).toMatchObject({
      type: 'spoke_to',
      participants: ['employee-1'],
      summary: 'Alineacion estrategica clara ',
    });
  });

  it('speak() retorna SpeakResult ok=true text=stream output en happy path', async () => {
    const { brain, client } = createBrain();
    (client as MockLLMClient).queue({ text: 'Resultado ejecutivo' });

    const result = await brain.speak('employee-1');

    expect(result).toMatchObject({
      ok: true,
      text: 'Resultado ejecutivo ',
    });
    expect(result.cost).toBeGreaterThan(0);
    expect(result.reason).toBeUndefined();
  });

  it('uses canned fallback without calling completeStream when kill switch is on', async () => {
    localStorage.setItem(LLM_STORAGE_KEYS.killswitch, 'on');
    const { agent, brain, client } = createBrain();
    const completeStream = vi.spyOn(client, 'completeStream');

    await brain.speak('employee-1');

    expect(completeStream).not.toHaveBeenCalled();
    expectFallbackBubble(agent);
  });

  it('speak() retorna SpeakResult ok=false reason=llm_disabled cuando killswitch on', async () => {
    localStorage.setItem(LLM_STORAGE_KEYS.killswitch, 'on');
    const { agent, brain, client } = createBrain();
    const completeStream = vi.spyOn(client, 'completeStream');

    const result = await brain.speak('employee-1');

    expect(completeStream).not.toHaveBeenCalled();
    expectFallbackBubble(agent);
    expect(result).toMatchObject({
      ok: false,
      cost: 0,
      reason: 'llm_disabled',
    });
    expect(result.text).toEqual(lastBubbleHandle?.fullText);
  });

  it('speak() con skipMemoryWrite=true: no añade episode ni guarda memoria', async () => {
    const { agent, brain, client, memory } = createBrain();
    (client as MockLLMClient).queue({ text: 'Sin escritura persistente' });

    const result = await brain.speak('employee-1', { skipMemoryWrite: true });

    expect(result.ok).toBe(true);
    expect(memory.episodes).toHaveLength(0);
    expect(memory.relationships).toEqual({});
    expect(localStorage.getItem(memoryStorageKey(agent.id))).toBeNull();
  });

  it('speak() con turnContext incluye [Otro agente...] en user message', async () => {
    const { brain, client } = createBrain();
    (client as MockLLMClient).queue({ text: 'Respuesta contextual' });
    const completeStream = vi.spyOn(client, 'completeStream');

    await brain.speak('employee-1', {
      turnContext: { speakerId: 'agent-2', text: 'Necesito soporte ahora' },
    });

    expect(completeStream).toHaveBeenCalledTimes(1);
    expect(completeStream).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{
          role: 'user',
          content: expect.stringContaining(
            '[Otro agente (agent-2) acaba de decir: "Necesito soporte ahora"]\n\n',
          ),
        }],
      }),
    );
  });

  it('does not increase cost for a second speak inside the per-agent cooldown', async () => {
    let now = 1_000;
    const { brain, client, tracker } = createBrain({ nowMs: () => now });
    (client as MockLLMClient).queue({ text: 'Primer sync' });
    (client as MockLLMClient).queue({ text: 'Segundo sync' });

    await brain.speak('employee-1');
    const costAfterFirstSpeak = tracker.getSessionCost();
    await brain.speak('employee-2');

    expect(costAfterFirstSpeak).toBeGreaterThan(0);
    expect(tracker.getSessionCost()).toBe(costAfterFirstSpeak);

    now += ceoPretender.triggers.cooldownMsAfterSpeak;
    await brain.speak('employee-3');
    expect(tracker.getSessionCost()).toBeGreaterThan(costAfterFirstSpeak);
  });

  it('uses canned fallback without calling completeStream when session cap is zero', async () => {
    const { agent, brain, client } = createBrain({ capUSD: 0 });
    const completeStream = vi.spyOn(client, 'completeStream');

    await brain.speak('employee-1');

    expect(completeStream).not.toHaveBeenCalled();
    expectFallbackBubble(agent);
  });

  it('speak() respeta maxTokens override del context', async () => {
    const { brain, client } = createBrain();
    (client as MockLLMClient).queue({ text: 'Override aplicado' });
    const completeStream = vi.spyOn(client, 'completeStream');

    await brain.speak('employee-1', { maxTokens: 60 });

    expect(completeStream).toHaveBeenCalledTimes(1);
    expect(completeStream).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 60 }),
    );
  });

  it('speak() default maxTokens=100 si no se pasa override', async () => {
    const { brain, client } = createBrain();
    (client as MockLLMClient).queue({ text: 'Default aplicado' });
    const completeStream = vi.spyOn(client, 'completeStream');

    await brain.speak('employee-1');

    expect(completeStream).toHaveBeenCalledTimes(1);
    expect(completeStream).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 100 }),
    );
  });

  it('uses canned fallback when the global queue acquire times out', async () => {
    vi.useFakeTimers();
    const queue = getGlobalQueue();
    const release = await queue.acquire();
    const { agent, brain, client } = createBrain();
    const completeStream = vi.spyOn(client, 'completeStream');

    const pendingSpeak = brain.speak('employee-1');
    await vi.advanceTimersByTimeAsync(2_000);
    await pendingSpeak;

    release();
    expect(completeStream).not.toHaveBeenCalled();
    expectFallbackBubble(agent);
  });

  it('keeps independent cooldowns for separate AgentBrain instances', async () => {
    let now = 1_000;
    const first = createBrain({ agentId: 'agent-1', nowMs: () => now });
    const second = createBrain({ agentId: 'agent-2', nowMs: () => now });
    (first.client as MockLLMClient).queue({ text: 'Primer agente' });
    (second.client as MockLLMClient).queue({ text: 'Segundo agente' });

    await first.brain.speak('employee-1');
    await second.brain.speak('employee-1');

    expect(first.tracker.getSessionCost()).toBeGreaterThan(0);
    expect(second.tracker.getSessionCost()).toBeGreaterThan(0);
    expect(first.memory.episodes).toHaveLength(1);
    expect(second.memory.episodes).toHaveLength(1);

    now += 1;
    await first.brain.speak('employee-2');
    expect(first.memory.episodes).toHaveLength(1);
  });

  it('grows memory episodes with each successful speak after cooldown', async () => {
    let now = 1_000;
    const { brain, client, memory } = createBrain({ nowMs: () => now });
    (client as MockLLMClient).queue({ text: 'Primera respuesta' });
    (client as MockLLMClient).queue({ text: 'Segunda respuesta' });

    await brain.speak('employee-1');
    now += ceoPretender.triggers.cooldownMsAfterSpeak;
    await brain.speak('employee-2');

    expect(memory.episodes).toHaveLength(2);
    expect(memory.episodes.map(episode => episode.participants[0])).toEqual([
      'employee-1',
      'employee-2',
    ]);
  });

  it('increases tracker session cost after each successful speak', async () => {
    let now = 1_000;
    const { brain, client, tracker } = createBrain({ nowMs: () => now });
    (client as MockLLMClient).queue({ text: 'Primera respuesta' });
    (client as MockLLMClient).queue({ text: 'Segunda respuesta' });

    await brain.speak('employee-1');
    const firstCost = tracker.getSessionCost();
    now += ceoPretender.triggers.cooldownMsAfterSpeak;
    await brain.speak('employee-2');

    expect(firstCost).toBeGreaterThan(0);
    expect(tracker.getSessionCost()).toBeGreaterThan(firstCost);
  });

  it('R3 fix: streaming crea bubble una sola vez y muta handle.fullText incrementalmente', async () => {
    const { agent, brain, client } = createBrain({ agentId: 'ceo-1' });
    (client as MockLLMClient).queue({ text: 'Una dos' });

    await brain.speak('employee-1');

    expect(mockBubble).toHaveBeenCalledTimes(1);
    expect(mockBubble.mock.calls[0]?.[0]).toBe(agent);
    // Texto final acumulado en handle (NO en mockBubble.calls).
    expect(lastBubbleHandle?.fullText).toBe('Una dos ');
    // close() seteó timeRevealed + autoClose proporcional.
    expect(lastBubbleHandle?.timeRevealed).not.toBeNull();
    expect(lastBubbleHandle?.autoCloseAfter).toBe(getBubbleDurationMs('Una dos ') / 1000);
  });

  it('uses canned fallback when completeStream throws', async () => {
    const client: LLMClient = {
      complete: vi.fn(),
      completeStream: vi.fn(async function* () {
        throw new LLMError('STREAM_ERROR', 'boom');
      }),
    };
    const { agent, brain, memory, tracker } = createBrain({ client });

    await brain.speak('employee-1');

    expect(client.completeStream).toHaveBeenCalledTimes(1);
    expectFallbackBubble(agent);
    expect(memory.episodes).toHaveLength(0);
    expect(tracker.getSessionCost()).toBe(0);
  });

  it('uses MockLLMClient.on(pattern) responses through AgentBrain', async () => {
    const { brain, client, memory } = createBrain();
    (client as MockLLMClient).on(/employee-special/i, { text: 'Pattern matched' });

    await brain.speak('employee-special');

    // R3 fix: handle.fullText acumula texto final; mockBubble solo init call.
    expect(lastBubbleHandle?.fullText).toBe('Pattern matched ');
    expect(lastBubbleHandle?.autoCloseAfter).toBe(
      getBubbleDurationMs('Pattern matched ') / 1000,
    );
    expect(memory.episodes[0]?.summary).toBe('Pattern matched ');
  });
});

describe('AgentBrain.recordConversationEpisode', () => {
  it('recordConversationEpisode añade 1 episode + updateRelationship + save', () => {
    const { agent, brain, memory } = createBrain({ nowMs: () => 5_000 });

    brain.recordConversationEpisode(
      [agent.id, 'employee-1', 'employee-2'],
      'Conversacion multi-turn representativa',
      0.9,
      4,
    );

    expect(memory.episodes).toHaveLength(1);
    expect(memory.episodes[0]).toMatchObject({
      type: 'spoke_to',
      participants: ['employee-1', 'employee-2'],
      summary: 'Conversacion multi-turn representativa',
      importance: 0.9,
      t: 5,
    });
    expect(memory.relationships['employee-1']).toMatchObject({
      encounterCount: 1,
      lastInteractionT: 5,
    });
    expect(memory.relationships['employee-2']).toMatchObject({
      encounterCount: 1,
      lastInteractionT: 5,
    });
    expect(localStorage.getItem(memoryStorageKey(agent.id))).not.toBeNull();
  });

  it('recordConversationEpisode filtra self del participants', () => {
    const { agent, brain, memory } = createBrain();

    brain.recordConversationEpisode(
      [agent.id, 'employee-1'],
      'Resumen sin self en participants',
      0.8,
      2,
    );

    expect(memory.episodes).toHaveLength(1);
    expect(memory.episodes[0]!.participants).toEqual(['employee-1']);
    expect(memory.relationships[agent.id]).toBeUndefined();
  });
});

describe('AgentBrain memory wiring (importance + relationships + prune)', () => {
  it('primer encuentro registra importance >= 0.8 y actualiza relationship', async () => {
    let now = 1_000;
    const { brain, client, memory } = createBrain({ nowMs: () => now });
    (client as MockLLMClient).queue({ text: 'hola' });

    await brain.speak('employee-1');

    expect(memory.episodes).toHaveLength(1);
    expect(memory.episodes[0]!.importance).toBeGreaterThanOrEqual(0.8);
    expect(memory.relationships['employee-1']).toMatchObject({
      encounterCount: 1,
      lastInteractionT: 1.0,
    });
  });

  it('segundo encuentro mismo target tiene importance menor (sin first-encounter bonus)', async () => {
    let now = 1_000;
    const { brain, client, memory } = createBrain({ nowMs: () => now });
    (client as MockLLMClient).queue({ text: 'primer' });
    (client as MockLLMClient).queue({ text: 'segundo' });

    await brain.speak('employee-1');
    now += ceoPretender.triggers.cooldownMsAfterSpeak;
    await brain.speak('employee-1');

    expect(memory.episodes).toHaveLength(2);
    expect(memory.episodes[0]!.importance).toBeGreaterThanOrEqual(0.8);
    expect(memory.episodes[1]!.importance).toBeLessThan(0.8);
    expect(memory.relationships['employee-1']!.encounterCount).toBe(2);
  });

  it('pruneOldEpisodes se ejecuta tras cada speak (memoria respeta cap)', async () => {
    let now = 1_000;
    const { brain, client, memory } = createBrain({ nowMs: () => now });

    for (let i = 0; i < 60; i++) {
      (client as MockLLMClient).queue({ text: `linea ${i}` });
      await brain.speak(`employee-${i}`);
      now += ceoPretender.triggers.cooldownMsAfterSpeak;
    }

    expect(memory.episodes.length).toBeLessThanOrEqual(50);
  });
});

describe('AgentBrain.decide', () => {
  it("returns the MVP SAY stub with empty text", () => {
    const { brain } = createBrain();

    expect(brain.decide()).toEqual({ type: 'SAY', text: '' });
  });
});
