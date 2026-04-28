import type { LLMClient, SessionCostTracker, GlobalLLMQueue } from '../../llm/types';
import type { Personality } from './personality';
import type { AgentMemory } from './memory';
import type { AgentLike, ShowSpeechBubbleFn } from './actions';
import type { TriggerEvent } from './triggers';
import { TriggerSystem, type TriggerOpts } from './triggers';
import { AgentBrain } from './brain';
import { isLLMEnabled } from '../../llm/factory';
import { loadOrCreateAgentMemory } from './persistence';

export type AgentRuntimeOpts = {
  listActiveAgentIds(): string[];
  getAgentCell(agentId: string): { cx: number; cy: number } | null;
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
      const speaker = event.type === 'social_encounter' ? event.speaker : event.agent;
      const target = event.type === 'social_encounter' ? event.target : '';
      const personality = opts.personalityFor(speaker);
      if (!personality) continue;

      const brain = getOrCreateBrain(speaker, personality);
      if (!brain) continue;

      const context =
        event.type === 'social_encounter'
          ? { situationLines: ['Te encontrás con ' + event.target] }
          : { situationLines: ['Tu necesidad ' + event.need + ' está en ' + event.level] };

      void brain.speak(target, context);
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
