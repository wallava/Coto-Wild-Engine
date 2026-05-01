import { describe, it, expect, vi } from 'vitest';
import {
  buildConversationSummary,
  computeConversationImportance,
  startConversation,
  type ParticipantAgent,
  type StartConversationOpts,
} from '../../../src/game/llm-agents/conversation';
import type { AgentBrain } from '../../../src/game/llm-agents/brain';

type TestAgent = ParticipantAgent & {
  _x: number;
  _cx: number;
  _cy: number;
};

function makeAgent({
  id,
  cx,
  cy,
  x,
  path,
  target,
  waiting,
}: {
  id: string;
  cx: number;
  cy: number;
  x: number;
  path?: unknown[];
  target?: unknown;
  waiting?: number;
}): TestAgent {
  return {
    id,
    talking: false,
    activeConversationId: null,
    path: path ?? [],
    target: target ?? null,
    waiting: waiting ?? 0,
    _x: x,
    _cx: cx,
    _cy: cy,
  };
}

function makeMockBrain(): AgentBrain {
  return {
    speak: vi.fn(async () => ({ ok: true, text: 'mock turn', cost: 0.001 })),
    recordConversationEpisode: vi.fn(),
  } as unknown as AgentBrain;
}

function makeBaseOpts({
  participants,
  brains,
  overrides = {},
}: {
  participants: TestAgent[];
  brains: Map<string, AgentBrain>;
  overrides?: Partial<StartConversationOpts>;
}): StartConversationOpts {
  return {
    participants,
    brainFor: (id) => brains.get(id) ?? null,
    getAgentCell: (id) => {
      const agent = participants.find((p) => p.id === id);
      return agent ? { cx: agent._cx, cy: agent._cy } : null;
    },
    getAgentPositionX: (id) => {
      const agent = participants.find((p) => p.id === id);
      return agent ? agent._x : null;
    },
    setFacing: vi.fn(),
    markPairCooldown: vi.fn(),
    log: vi.fn(),
    sleep: () => Promise.resolve(),
    nowMs: () => 1000,
    newConversationId: () => 'test-conv-1',
    totalTurns: 2,
    ...overrides,
  };
}

function makePair(): {
  a: TestAgent;
  b: TestAgent;
  aBrain: AgentBrain;
  bBrain: AgentBrain;
  brains: Map<string, AgentBrain>;
} {
  const a = makeAgent({ id: 'a', cx: 0, cy: 0, x: 0 });
  const b = makeAgent({ id: 'b', cx: 1, cy: 0, x: 1 });
  const aBrain = makeMockBrain();
  const bBrain = makeMockBrain();
  const brains = new Map<string, AgentBrain>([
    ['a', aBrain],
    ['b', bBrain],
  ]);
  return { a, b, aBrain, bBrain, brains };
}

describe('startConversation', () => {
  it('happy path 2 turns alternates speakers, records both brains, and cleans locks', async () => {
    const { a, b, aBrain, bBrain, brains } = makePair();
    const opts = makeBaseOpts({ participants: [a, b], brains });

    await startConversation(opts);

    expect(aBrain.speak).toHaveBeenCalledTimes(1);
    expect(aBrain.speak).toHaveBeenCalledWith('b', expect.objectContaining({
      skipMemoryWrite: true,
    }));
    expect(bBrain.speak).toHaveBeenCalledTimes(1);
    expect(bBrain.speak).toHaveBeenCalledWith('a', expect.objectContaining({
      skipMemoryWrite: true,
      turnContext: { speakerId: 'a', text: 'mock turn' },
    }));
    expect(vi.mocked(aBrain.speak).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(bBrain.speak).mock.invocationCallOrder[0]!,
    );
    expect(aBrain.recordConversationEpisode).toHaveBeenCalledTimes(1);
    expect(bBrain.recordConversationEpisode).toHaveBeenCalledTimes(1);
    expect(aBrain.recordConversationEpisode).toHaveBeenCalledWith(
      ['a', 'b'],
      'a: mock turn | b: mock turn',
      expect.any(Number),
      2,
    );
    expect(a.talking).toBe(false);
    expect(b.talking).toBe(false);
    expect(a.activeConversationId).toBeNull();
    expect(b.activeConversationId).toBeNull();
  });

  it('R2 fix: post-lock limpia path/target/waiting; finally setea waiting=1.5', async () => {
    const a = makeAgent({ id: 'a', cx: 0, cy: 0, x: 0, path: [[5,5],[6,6]], target: [6,6], waiting: 3 });
    const b = makeAgent({ id: 'b', cx: 1, cy: 0, x: 1, path: [[7,7]], target: [7,7], waiting: 2 });
    const aBrain = makeMockBrain();
    const bBrain = makeMockBrain();
    const brains = new Map<string, AgentBrain>([['a', aBrain], ['b', bBrain]]);

    // Captura state durante speak (post-lock, pre-finally).
    let aMidPath: unknown = 'unset';
    let aMidWaiting: unknown = 'unset';
    let bMidPath: unknown = 'unset';
    vi.mocked(aBrain.speak).mockImplementationOnce(async () => {
      aMidPath = a.path;
      aMidWaiting = a.waiting;
      bMidPath = b.path;
      return { ok: true, text: 'mock turn', cost: 0.001 };
    });
    const opts = makeBaseOpts({ participants: [a, b], brains });

    await startConversation(opts);

    // Durante turn 1: path/target/waiting limpios.
    expect(aMidPath).toEqual([]);
    expect(aMidWaiting).toBe(0);
    expect(bMidPath).toEqual([]);
    // Post-finally: waiting=1.5 ambos.
    expect(a.waiting).toBe(1.5);
    expect(b.waiting).toBe(1.5);
    expect(a.path).toEqual([]);
    expect(a.target).toBeNull();
  });

  it('R2 fix: si conversación rejected por lock, NO toca path/target/waiting', async () => {
    const a = makeAgent({ id: 'a', cx: 0, cy: 0, x: 0, path: [[5,5]], target: [5,5], waiting: 4 });
    const b = makeAgent({ id: 'b', cx: 1, cy: 0, x: 1 });
    a.talking = true;   // fuerza lock-rejected
    const brains = new Map<string, AgentBrain>([['a', makeMockBrain()], ['b', makeMockBrain()]]);
    const opts = makeBaseOpts({ participants: [a, b], brains });

    await startConversation(opts);

    expect(a.path).toEqual([[5,5]]);
    expect(a.target).toEqual([5,5]);
    expect(a.waiting).toBe(4);
  });

  it('happy path 4 turns alternates a, b, a, b', async () => {
    const { a, b, aBrain, bBrain, brains } = makePair();
    const opts = makeBaseOpts({
      participants: [a, b],
      brains,
      overrides: { totalTurns: 4 },
    });

    await startConversation(opts);

    expect(aBrain.speak).toHaveBeenCalledTimes(2);
    expect(bBrain.speak).toHaveBeenCalledTimes(2);
    const aCalls = vi.mocked(aBrain.speak).mock.invocationCallOrder;
    const bCalls = vi.mocked(bBrain.speak).mock.invocationCallOrder;
    expect(aCalls[0]).toBeLessThan(bCalls[0]!);
    expect(bCalls[0]).toBeLessThan(aCalls[1]!);
    expect(aCalls[1]).toBeLessThan(bCalls[1]!);
  });

  it('rejects early when an agent is already talking', async () => {
    const { a, b, aBrain, bBrain, brains } = makePair();
    a.talking = true;
    const log = vi.fn();
    const opts = makeBaseOpts({ participants: [a, b], brains, overrides: { log } });

    await startConversation(opts);

    expect(log).toHaveBeenCalledWith('[CONVERSATION-LOCK-REJECTED]', {
      aId: 'a',
      bId: 'b',
    });
    expect(aBrain.speak).not.toHaveBeenCalled();
    expect(bBrain.speak).not.toHaveBeenCalled();
  });

  it('rejects early when an agent already has activeConversationId', async () => {
    const { a, b, aBrain, bBrain, brains } = makePair();
    a.activeConversationId = 'other';
    const log = vi.fn();
    const opts = makeBaseOpts({ participants: [a, b], brains, overrides: { log } });

    await startConversation(opts);

    expect(log).toHaveBeenCalledWith('[CONVERSATION-LOCK-REJECTED]', {
      aId: 'a',
      bId: 'b',
    });
    expect(aBrain.speak).not.toHaveBeenCalled();
    expect(bBrain.speak).not.toHaveBeenCalled();
  });

  it('is idempotent under simultaneous calls for the same pair', async () => {
    const { a, b, aBrain, bBrain, brains } = makePair();
    const opts = makeBaseOpts({ participants: [a, b], brains });

    await Promise.all(Array.from({ length: 10 }, () => startConversation(opts)));

    expect(aBrain.speak).toHaveBeenCalledTimes(1);
    expect(bBrain.speak).toHaveBeenCalledTimes(1);
    expect(vi.mocked(aBrain.speak).mock.calls.length + vi.mocked(bBrain.speak).mock.calls.length).toBe(2);
  });

  it('logs LLM errors on turn 1, cleans up, applies normal cooldown, and records one turn', async () => {
    const { a, b, aBrain, bBrain, brains } = makePair();
    vi.mocked(bBrain.speak).mockRejectedValueOnce(new Error('boom'));
    const log = vi.fn();
    const markPairCooldown = vi.fn();
    const opts = makeBaseOpts({
      participants: [a, b],
      brains,
      overrides: { log, markPairCooldown },
    });

    await startConversation(opts);

    expect(log).toHaveBeenCalledWith('[CONVERSATION-LLM-ERROR]', expect.objectContaining({
      speakerId: 'b',
      turn: 1,
      error: 'Error: boom',
    }));
    expect(a.talking).toBe(false);
    expect(b.talking).toBe(false);
    expect(markPairCooldown).toHaveBeenCalledWith('a', 'b', 60_000);
    expect(aBrain.recordConversationEpisode).toHaveBeenCalledWith(
      ['a', 'b'],
      'a: mock turn',
      expect.any(Number),
      1,
    );
    expect(bBrain.recordConversationEpisode).toHaveBeenCalledWith(
      ['a', 'b'],
      'a: mock turn',
      expect.any(Number),
      1,
    );
  });

  it('uses 10s cooldown and skips memory when turn 0 throws', async () => {
    const { a, b, aBrain, bBrain, brains } = makePair();
    vi.mocked(aBrain.speak).mockRejectedValueOnce(new Error('first turn failed'));
    const markPairCooldown = vi.fn();
    const opts = makeBaseOpts({
      participants: [a, b],
      brains,
      overrides: { markPairCooldown },
    });

    await startConversation(opts);

    expect(markPairCooldown).toHaveBeenCalledWith('a', 'b', 10_000);
    expect(aBrain.recordConversationEpisode).not.toHaveBeenCalled();
    expect(bBrain.recordConversationEpisode).not.toHaveBeenCalled();
  });

  it('interrupts when agents stop being adjacent after turn 0 and records one turn', async () => {
    const { a, b, aBrain, bBrain, brains } = makePair();
    vi.mocked(aBrain.speak).mockImplementationOnce(async () => {
      b._cx = 10;
      return { ok: true, text: 'mock turn', cost: 0.001 };
    });
    const log = vi.fn();
    const opts = makeBaseOpts({ participants: [a, b], brains, overrides: { log } });

    await startConversation(opts);

    expect(log).toHaveBeenCalledWith('[CONVERSATION-INTERRUPTED]', expect.objectContaining({
      reason: 'not-adjacent',
      turn: 1,
    }));
    expect(aBrain.speak).toHaveBeenCalledTimes(1);
    expect(bBrain.speak).not.toHaveBeenCalled();
    expect(aBrain.recordConversationEpisode).toHaveBeenCalledWith(
      ['a', 'b'],
      'a: mock turn',
      expect.any(Number),
      1,
    );
  });

  it('interrupts when an agent despawns mid-conversation and cleans up', async () => {
    const { a, b, aBrain, bBrain, brains } = makePair();
    let despawnB = false;
    vi.mocked(aBrain.speak).mockImplementationOnce(async () => {
      despawnB = true;
      return { ok: true, text: 'mock turn', cost: 0.001 };
    });
    const log = vi.fn();
    const opts = makeBaseOpts({
      participants: [a, b],
      brains,
      overrides: {
        log,
        getAgentCell: (id) => {
          if (id === 'b' && despawnB) return null;
          const agent = [a, b].find((p) => p.id === id);
          return agent ? { cx: agent._cx, cy: agent._cy } : null;
        },
      },
    });

    await startConversation(opts);

    expect(log).toHaveBeenCalledWith('[CONVERSATION-INTERRUPTED]', expect.objectContaining({
      reason: 'agent-despawned',
      turn: 1,
    }));
    expect(a.talking).toBe(false);
    expect(b.talking).toBe(false);
    expect(a.activeConversationId).toBeNull();
    expect(b.activeConversationId).toBeNull();
    expect(bBrain.speak).not.toHaveBeenCalled();
  });

  it('breaks when brainFor returns null for the next speaker mid-conversation and cleans up', async () => {
    const { a, b, aBrain, bBrain, brains } = makePair();
    let removeBBrain = false;
    vi.mocked(aBrain.speak).mockImplementationOnce(async () => {
      removeBBrain = true;
      return { ok: true, text: 'mock turn', cost: 0.001 };
    });
    const log = vi.fn();
    const opts = makeBaseOpts({
      participants: [a, b],
      brains,
      overrides: {
        log,
        brainFor: (id) => (id === 'b' && removeBBrain ? null : brains.get(id) ?? null),
      },
    });

    await startConversation(opts);

    expect(log).toHaveBeenCalledWith('[CONVERSATION-NO-BRAIN]', expect.objectContaining({
      speakerId: 'b',
      turn: 1,
    }));
    expect(a.talking).toBe(false);
    expect(b.talking).toBe(false);
    expect(a.activeConversationId).toBeNull();
    expect(b.activeConversationId).toBeNull();
    expect(bBrain.speak).not.toHaveBeenCalled();
  });

  it('cleanup does not clear an activeConversationId changed by another conversation', async () => {
    const { a, b, aBrain, brains } = makePair();
    vi.mocked(aBrain.speak).mockImplementationOnce(async () => {
      a.activeConversationId = 'OTHER';
      return { ok: true, text: '', cost: 0.001 };
    });
    const opts = makeBaseOpts({ participants: [a, b], brains });

    await startConversation(opts);

    expect(a.activeConversationId).toBe('OTHER');
    expect(b.activeConversationId).toBeNull();
  });

  it('breaks on empty text and does not record a conversation episode', async () => {
    const { a, b, aBrain, bBrain, brains } = makePair();
    vi.mocked(aBrain.speak).mockResolvedValueOnce({ ok: true, text: '', cost: 0.001 });
    const opts = makeBaseOpts({ participants: [a, b], brains });

    await startConversation(opts);

    expect(aBrain.speak).toHaveBeenCalledTimes(1);
    expect(bBrain.speak).not.toHaveBeenCalled();
    expect(aBrain.recordConversationEpisode).not.toHaveBeenCalled();
    expect(bBrain.recordConversationEpisode).not.toHaveBeenCalled();
  });

  it('throws for non-pair participant counts', async () => {
    const { a, b, brains } = makePair();
    const c = makeAgent({ id: 'c', cx: 2, cy: 0, x: 2 });

    await expect(startConversation(makeBaseOpts({
      participants: [a],
      brains,
    }))).rejects.toThrow('solo pares soportados, recibido: 1');
    await expect(startConversation(makeBaseOpts({
      participants: [a, b, c],
      brains,
    }))).rejects.toThrow('solo pares soportados, recibido: 3');
  });
});

describe('computeConversationImportance', () => {
  it('returns 0 for no turns, scores small conversations, and clamps large ones', () => {
    expect(computeConversationImportance([])).toBe(0);

    const medium = computeConversationImportance([
      { speakerId: 'a', text: 'x'.repeat(30) },
      { speakerId: 'b', text: 'y'.repeat(30) },
    ]);
    expect(medium).toBeGreaterThan(0);
    expect(medium).toBeLessThan(1);

    const large = computeConversationImportance(
      Array.from({ length: 10 }, (_, i) => ({
        speakerId: i % 2 === 0 ? 'a' : 'b',
        text: 'z'.repeat(500),
      })),
    );
    expect(large).toBe(1);
  });
});

describe('buildConversationSummary', () => {
  it('joins turns and truncates long summaries at 240 chars', () => {
    expect(buildConversationSummary([
      { speakerId: 'a', text: 'hola' },
      { speakerId: 'b', text: 'che' },
    ])).toBe('a: hola | b: che');

    const summary = buildConversationSummary([
      { speakerId: 'a', text: 'x'.repeat(260) },
    ]);
    expect(summary).toHaveLength(240);
    expect(summary).toBe(`a: ${'x'.repeat(237)}`);
  });
});
