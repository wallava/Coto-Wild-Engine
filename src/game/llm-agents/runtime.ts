import type { LLMClient, SessionCostTracker, GlobalLLMQueue } from '../../llm/types';
import type { Personality } from './personality';
import type { AgentMemory } from './memory';
import type { AgentLike, ShowSpeechBubbleFn } from './actions';
import type { TriggerEvent } from './triggers';
import { TriggerSystem, type TriggerOpts } from './triggers';
import { AgentBrain } from './brain';
import { isLLMEnabled } from '../../llm/factory';
import { loadOrCreateAgentMemory } from './persistence';
import { startConversation } from './conversation';
import { setAgentFacing } from '../../engine/agent-chassis';

export type AgentRuntimeOpts = {
  listActiveAgentIds(): string[];
  getAgentCell(agentId: string): { cx: number; cy: number } | null;
  getAgentPositionX(agentId: string): number | null;
  personalityFor(agentId: string): Personality | null;
  memoryFor?(agentId: string): AgentMemory;
  agentRef(agentId: string): AgentLike | null;
  getAgentNeed?(agentId: string, kind: string): number | null;
  client: LLMClient;
  tracker: SessionCostTracker;
  queue: GlobalLLMQueue;
  showSpeechBubble: ShowSpeechBubbleFn;
  nowMs?: () => number;
  tickIntervalMs?: number;
  onCallEnd?: (info: { agentId: string; ok: boolean; durationMs: number; cost: number; reason?: string }) => void;
};

export type AgentRuntimeHandle = {
  tick(): Promise<void>;
  stop(): void;
};

export function setupAgentRuntime(opts: AgentRuntimeOpts): AgentRuntimeHandle {
  const triggerOpts: TriggerOpts = {
    listActiveAgentIds: opts.listActiveAgentIds,
    getAgentCell: opts.getAgentCell,
    nowMs: opts.nowMs ?? Date.now,
  };

  if (opts.getAgentNeed) {
    triggerOpts.getAgentNeed = opts.getAgentNeed;
  }

  const triggers = new TriggerSystem(triggerOpts);
  const brains = new Map<string, AgentBrain>();

  const getOrCreateBrain = (agentId: string, personality: Personality): AgentBrain | null => {
    const existing = brains.get(agentId);
    if (existing) return existing;

    const agent = opts.agentRef(agentId);
    if (!agent) return null;

    const memory = opts.memoryFor?.(agentId) ?? loadOrCreateAgentMemory(agentId);
    const brainOpts = {
      agent,
      personality,
      memory,
      client: opts.client,
      tracker: opts.tracker,
      queue: opts.queue,
      showSpeechBubble: opts.showSpeechBubble,
    };

    const brain = new AgentBrain({
      ...brainOpts,
      ...(opts.nowMs ? { nowMs: opts.nowMs } : {}),
      ...(opts.onCallEnd
        ? { onCallEnd: (info: { ok: boolean; durationMs: number; cost: number; reason?: string }) => opts.onCallEnd?.({ agentId, ...info }) }
        : {}),
    });
    brains.set(agentId, brain);
    return brain;
  };

  const tick = async (): Promise<void> => {
    if (!isLLMEnabled()) return;

    const events: TriggerEvent[] = triggers.tick();
    for (const event of events) {
      if (event.type === 'social_encounter') {
        const speakerAgent = opts.agentRef(event.speaker) as any;
        const targetAgent = opts.agentRef(event.target) as any;
        if (!speakerAgent || !targetAgent) continue;

        // Defensa secundaria CONTRATO 1: chequear locks ANTES de invocar.
        if (speakerAgent.talking || targetAgent.talking) continue;
        if (speakerAgent.activeConversationId !== null || targetAgent.activeConversationId !== null) continue;

        const speakerPersonality = opts.personalityFor(event.speaker);
        const targetPersonality = opts.personalityFor(event.target);
        if (!speakerPersonality || !targetPersonality) continue;
        if (!getOrCreateBrain(event.speaker, speakerPersonality)) continue;
        if (!getOrCreateBrain(event.target, targetPersonality)) continue;

        void startConversation({
          participants: [speakerAgent, targetAgent],
          brainFor: (id: string) => brains.get(id) ?? null,
          getAgentCell: opts.getAgentCell,
          getAgentPositionX: opts.getAgentPositionX,
          setFacing: (a: any, dir: 'left' | 'right') => setAgentFacing(a, dir),
          markPairCooldown: (idA: string, idB: string, ms: number) => triggers.setPairCooldown(idA, idB, ms),
          log: (tag: string, data?: unknown) => console.log(tag, data),
          ...(opts.nowMs ? { nowMs: opts.nowMs } : {}),
        }).catch((err) => {
          console.warn('[CONVERSATION-FIRE-AND-FORGET-ERROR]', err);
        });
        continue;
      }

      if (event.type === 'crisis') {
        const speaker = event.agent;
        const personality = opts.personalityFor(speaker);
        if (!personality) continue;
        const brain = getOrCreateBrain(speaker, personality);
        if (!brain) continue;
        void brain.speak('', { situationLines: ['Tu necesidad ' + event.need + ' está en ' + event.level] });
        continue;
      }
    }
  };

  const intervalId = setInterval(() => {
    void tick();
  }, opts.tickIntervalMs ?? 1000);

  return {
    tick,
    stop(): void {
      clearInterval(intervalId);
    },
  };
}
