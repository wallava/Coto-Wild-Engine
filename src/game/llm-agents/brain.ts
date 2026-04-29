/**
 * AgentBrain — punto de entrada para que un agente hable vía LLM.
 *
 * speak() pipeline:
 *   1. Verificar caps (kill switch, per-agent rate limit, session cost).
 *   2. acquire del GlobalLLMQueue (timeout 2s).
 *   3. Construir SystemBlock[] + user message.
 *   4. completeStream con AbortController + timeouts.
 *   5. Bubble streaming word-by-word.
 *   6. Si error/timeout/abort → fallback canned phrase.
 *   7. Si OK → trackCall + addEpisode + persistir memoria.
 *   8. release queue.
 *
 * decide() es STUB MVP: siempre retorna {type:'SAY', text:''}. La decisión
 * con action catalog completo viene post-Fase 5.
 *
 * NOTA lifecycle: lastSpeakT vive en la instance. Si AgentBrain se recrea
 * seguido (ej. al re-spawnear un agent), el rate limit per-agent puede
 * eludirse. Aceptable MVP — si problema real, persistir lastSpeakT en
 * AgentMemory.
 */

import type { LLMClient, GlobalLLMQueue, SessionCostTracker } from '../../llm/types';
import { LLMError } from '../../llm/types';
import type { Personality } from './personality';
import { buildSystemBlocks, getFallbackPhrase, buildUserMessage } from './personality';
import type { AgentMemory } from './memory';
import { addEpisode, computeEpisodeImportance, pruneOldEpisodes, updateRelationship } from './memory';
import { saveAgentMemory } from './persistence';
import { isLLMEnabled, getEffectiveModel } from '../../llm/factory';
import type { AgentAction, AgentLike, ShowSpeechBubbleFn } from './actions';
import { applySayAction } from './actions';
import { showStreamingBubble } from './streaming-ui';

const DEFAULT_MAX_TOKENS = 100;
const QUEUE_ACQUIRE_TIMEOUT_MS = 2000;
const ESTIMATED_INPUT_TOKEN_DIVISOR = 4;   // chars / 4 ≈ tokens (sobreestima conservador)

export type AgentBrainOpts = {
  agent: AgentLike;
  personality: Personality;
  memory: AgentMemory;
  client: LLMClient;
  tracker: SessionCostTracker;
  queue: GlobalLLMQueue;
  showSpeechBubble: ShowSpeechBubbleFn;
  /** Lee tiempo (ms epoch). Inyectable para tests con fake timers. */
  nowMs?: () => number;
  /** Callback al terminar (ok/error). Útil para logging structured. */
  onCallEnd?: (info: { ok: boolean; durationMs: number; cost: number; reason?: string }) => void;
};

export type SpeakContext = {
  situationLines?: string[];
};

export class AgentBrain {
  private lastSpeakT = 0;
  private readonly opts: AgentBrainOpts;

  constructor(opts: AgentBrainOpts) {
    this.opts = opts;
  }

  private now(): number {
    return (this.opts.nowMs ?? Date.now)();
  }

  /**
   * Habla con `target`. Si fallback se aplica, muestra canned phrase en bubble.
   */
  async speak(target: string, context: SpeakContext = {}): Promise<void> {
    const startedAt = this.now();
    const { agent, personality, client, tracker, queue, showSpeechBubble, onCallEnd } = this.opts;

    const fallback = (reason: string): void => {
      const phrase = getFallbackPhrase(personality);
      applySayAction(agent, phrase, showSpeechBubble);
      this.lastSpeakT = this.now();
      onCallEnd?.({ ok: false, durationMs: this.now() - startedAt, cost: 0, reason });
    };

    // 1. Kill switch.
    if (!isLLMEnabled()) {
      fallback('llm_disabled');
      return;
    }

    // 2. Per-agent rate limit.
    const cooldown = personality.triggers.cooldownMsAfterSpeak;
    if (this.lastSpeakT > 0 && this.now() - this.lastSpeakT < cooldown) {
      fallback('agent_cooldown');
      return;
    }

    // 3. Session cap pre-call. Resolvemos modelo efectivo (override > personality).
    const effectiveModel = getEffectiveModel(personality.model);
    const estInputTokens = Math.ceil(personality.staticSystemBlock.length / ESTIMATED_INPUT_TOKEN_DIVISOR);
    if (!tracker.canAffordEstimatedCall(effectiveModel, estInputTokens, DEFAULT_MAX_TOKENS)) {
      fallback('session_cap');
      return;
    }

    // 4. Acquire queue.
    let release: (() => void) | null = null;
    try {
      release = await queue.acquire(QUEUE_ACQUIRE_TIMEOUT_MS);
    } catch (err) {
      if (err instanceof LLMError && err.code === 'QUEUE_TIMEOUT') {
        fallback('queue_timeout');
        return;
      }
      fallback('queue_error');
      return;
    }

    // 5. Build prompt + streaming.
    const abortController = new AbortController();
    const bubble = showStreamingBubble(agent, showSpeechBubble, {
      onUserAbort: () => abortController.abort(),
    });

    const system = buildSystemBlocks(personality, { dynamicLines: context.situationLines ?? [] });
    const userMessage = buildUserMessage(target, context);

    let cost = 0;

    try {
      const stream = client.completeStream({
        model: effectiveModel,
        system,
        messages: [{ role: 'user', content: userMessage }],
        maxTokens: DEFAULT_MAX_TOKENS,
        abortSignal: abortController.signal,
        cacheTTLHint: '5m',
      });

      for await (const chunk of stream) {
        if (chunk.type === 'text') {
          bubble.append(chunk.delta);
        } else if (chunk.type === 'done') {
          tracker.trackCall(chunk.result.usage, effectiveModel, '5m');
          cost = chunk.result.costUSD;
        }
      }

      bubble.close();

      // 6. Memory: importance heurístico + addEpisode + relationship + prune + save.
      const memory = this.opts.memory;
      const summary = bubble.getText().slice(0, 200);
      const participants = [target];
      const prevRel = memory.relationships[target];
      const isFirstEncounter = !prevRel || prevRel.encounterCount === 0;
      const importance = computeEpisodeImportance({
        isFirstEncounter,
        summary,
        participantCount: participants.length,
      });
      const tSeconds = this.now() / 1000;
      addEpisode(memory, {
        t: tSeconds,
        type: 'spoke_to',
        participants,
        summary,
        importance,
      });
      updateRelationship(memory, target, {
        lastInteractionT: tSeconds,
        encounterCount: (prevRel?.encounterCount ?? 0) + 1,
      });
      pruneOldEpisodes(memory);
      saveAgentMemory(memory);

      this.lastSpeakT = this.now();
      onCallEnd?.({ ok: true, durationMs: this.now() - startedAt, cost });
    } catch (err) {
      bubble.abort();
      const reason = err instanceof LLMError ? err.code : 'unknown_error';
      fallback(reason);
    } finally {
      release?.();
    }
  }

  /**
   * STUB MVP. Siempre retorna SAY con text vacío. La decisión real con
   * action catalog completo viene post-Fase 5.
   */
  decide(): AgentAction {
    return { type: 'SAY', text: '' };
  }
}
