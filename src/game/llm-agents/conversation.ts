/**
 * Conversation orchestrator. Coordina conversación multi-turn entre dos
 * agentes adyacentes:
 *
 * - CONTRATO 1: lock check al inicio (rechaza si alguno está en talking
 *   o tiene activeConversationId). Idempotente: triggers que disparan
 *   múltiples veces sobre el mismo par no crean conversaciones duplicadas.
 * - CONTRATO 2: try/finally al nivel orchestrator. Cleanup garantizado:
 *   restaurar talking=false + activeConversationId=null SOLO si el id
 *   en el agente coincide con esta conversación (no pisa otra posterior).
 * - CONTRATO 4: política de errores LLM. speak() throw → log + break.
 *   Cooldown 10s si fail en turn 0, 60s normal.
 * - CONTRATO 5: re-verifica adyacencia cada turn. Si cell null o no
 *   adyacentes: break con cleanup.
 * - CONTRATO 6: cooldown solo si conversationStarted (try entró).
 * - CONTRATO 7: async no bloqueante. Caller invoca con
 *   void startConversation(...).catch(...). Game loop sigue corriendo.
 *
 * NO soporta cutscenes mid-conversation (cutscenes ya tienen _csAgent
 * skip propio en stations/needs). NO soporta grupos 3+ en Fase 5.1
 * (throw si participants.length !== 2). API extensible para Fase 5.2.
 */

import type { AgentBrain, SpeakResult } from './brain';
import type { AgentLike, AgentFacing } from './actions';
import { areAgentsAdjacent, type CellPos } from './adjacency';
import { getBubbleDurationMs } from './bubble-duration';

const DEFAULT_TURN_MIN = 2;
const DEFAULT_TURN_RANGE = 3; // 2-4 turns inclusive
const COOLDOWN_FAIL_TURN0_MS = 10_000;
const COOLDOWN_NORMAL_MS = 60_000;
// Padding entre turns (post-bubble close). Subido a 2000ms en R3 fix:
// el typewriter del bubble (cps=30) tarda en revelar texto + fade ~0.3s.
// 500ms causaba overlap visual entre turn N y N+1.
const TURN_END_PADDING_MS = 2000;
const TURN_MAX_TOKENS = 60;
const FACING_DX_THRESHOLD = 0.001;
const POST_CONVERSATION_WAITING_S = 1.5;

export type ParticipantAgent = AgentLike & {
  talking: boolean;
  activeConversationId: string | null;
  /** Path pendiente del agente. Se limpia al iniciar conversación para
   * evitar que retome walk al cerrar (ver fix Fase 5.1 R2). */
  path?: unknown[];
  target?: unknown;
  /** Pausa en segundos antes que updateAgents retome pickRandomDestination. */
  waiting?: number;
};

export type ConversationLogFn = (tag: string, data?: unknown) => void;

export type StartConversationOpts = {
  /** Exactamente 2 agentes en Fase 5.1. */
  participants: ParticipantAgent[];
  /** Default: random 2-4. */
  totalTurns?: number;
  brainFor: (agentId: string) => AgentBrain | null;
  getAgentCell: (agentId: string) => CellPos | null;
  getAgentPositionX: (agentId: string) => number | null;
  setFacing: (agent: AgentLike, dir: AgentFacing) => void;
  /** Aplica cooldown post-conversación al par. */
  markPairCooldown: (a: string, b: string, ms: number) => void;
  /** Remueve bubble del agente antes de cada turn (R3 fix overlap).
   * Wired desde engine/speech.removeAgentBubble vía main.ts. Optional:
   * tests pueden no pasarlo. */
  removeAgentBubble?: (agent: AgentLike) => void;
  log?: ConversationLogFn;
  /** Inyectable para tests con fake timers. */
  sleep?: (ms: number) => Promise<void>;
  nowMs?: () => number;
  /** Genera id único de conversación. Inyectable para tests deterministas. */
  newConversationId?: () => string;
};

const defaultSleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function pickTotalTurns(): number {
  return DEFAULT_TURN_MIN + Math.floor(Math.random() * DEFAULT_TURN_RANGE);
}

/**
 * Convención legacy (B-2 LOOK_AT, actions.ts:130): dx > 0 → 'left'.
 */
function orientToPartner(
  agent: ParticipantAgent,
  partner: ParticipantAgent,
  setFacing: StartConversationOpts['setFacing'],
  getAgentPositionX: StartConversationOpts['getAgentPositionX'],
): void {
  const myX = getAgentPositionX(agent.id);
  const partnerX = getAgentPositionX(partner.id);
  if (myX === null || partnerX === null) return;
  const dx = partnerX - myX;
  if (Math.abs(dx) < FACING_DX_THRESHOLD) return;
  setFacing(agent, dx > 0 ? 'left' : 'right');
}

/**
 * Importance 0-1 de la conversación. Base 0.5 + bonus por turns + chars.
 * Range típico: 2 turns/60 chars → ~0.61. 4 turns/200 chars → ~0.85.
 */
export function computeConversationImportance(
  turns: { speakerId: string; text: string }[],
): number {
  if (turns.length === 0) return 0;
  const totalChars = turns.reduce((s, t) => s + t.text.length, 0);
  const turnsBonus = Math.min(0.2, Math.max(0, (turns.length - 1) * 0.05));
  const charsBonus = Math.min(0.3, totalChars / 1000);
  return Math.min(1, Math.max(0, 0.5 + turnsBonus + charsBonus));
}

/**
 * Resumen estructurado de la conversación. "<speaker>: <text> | ...".
 * Limitado a 240 chars (cap conservador para no saturar memoria).
 */
export function buildConversationSummary(
  turns: { speakerId: string; text: string }[],
): string {
  const joined = turns.map((t) => `${t.speakerId}: ${t.text}`).join(' | ');
  return joined.length > 240 ? joined.slice(0, 240) : joined;
}

/**
 * Inicia una conversación entre dos agentes adyacentes. Async no
 * bloqueante: caller debería invocar con
 * `void startConversation(...).catch(err => log(err))` y NO await.
 */
export async function startConversation(opts: StartConversationOpts): Promise<void> {
  const { participants } = opts;
  if (participants.length !== 2) {
    throw new Error(
      `Fase 5.1: solo pares soportados, recibido: ${participants.length}`,
    );
  }
  const a = participants[0]!;
  const b = participants[1]!;
  const log: ConversationLogFn = opts.log ?? (() => {});
  const sleep = opts.sleep ?? defaultSleep;
  const newId = opts.newConversationId ?? defaultConversationId;

  // CONTRATO 1: lock check
  if (
    a.talking ||
    b.talking ||
    a.activeConversationId !== null ||
    b.activeConversationId !== null
  ) {
    log('[CONVERSATION-LOCK-REJECTED]', { aId: a.id, bId: b.id });
    return;
  }

  const conversationId = newId();
  const totalTurns = opts.totalTurns ?? pickTotalTurns();
  let conversationStarted = false;
  let lastTurn: { speakerId: string; text: string } | null = null;
  const allTurns: { speakerId: string; text: string }[] = [];
  let turnsCompleted = 0;

  try {
    // Asignar locks ANTES de cualquier await para idempotencia atómica.
    a.talking = true;
    a.activeConversationId = conversationId;
    b.talking = true;
    b.activeConversationId = conversationId;
    // Limpiar movimiento pendiente: si el agente tenía path/target asignados
    // por pickRandomDestination, al cerrar la conversación retomaría walk
    // inmediato. Resetear acá garantiza pausa real durante turns.
    a.path = [];
    a.target = null;
    a.waiting = 0;
    b.path = [];
    b.target = null;
    b.waiting = 0;

    // Orientación mutua (no requiere await).
    orientToPartner(a, b, opts.setFacing, opts.getAgentPositionX);
    orientToPartner(b, a, opts.setFacing, opts.getAgentPositionX);

    log('[CONVERSATION-STARTED]', {
      conversationId,
      aId: a.id,
      bId: b.id,
      totalTurns,
    });
    conversationStarted = true;

    for (let n = 0; n < totalTurns; n++) {
      const speakerIdx = n % 2;
      const speaker = participants[speakerIdx]!;
      const listener = participants[1 - speakerIdx]!;

      // CONTRATO 5: re-verificar adjacency cada turn.
      const sCell = opts.getAgentCell(speaker.id);
      const lCell = opts.getAgentCell(listener.id);
      if (sCell === null || lCell === null) {
        log('[CONVERSATION-INTERRUPTED]', {
          conversationId,
          reason: 'agent-despawned',
          turn: n,
        });
        break;
      }
      if (!areAgentsAdjacent(sCell, lCell)) {
        log('[CONVERSATION-INTERRUPTED]', {
          conversationId,
          reason: 'not-adjacent',
          turn: n,
        });
        break;
      }

      const brain = opts.brainFor(speaker.id);
      if (brain === null) {
        log('[CONVERSATION-NO-BRAIN]', {
          conversationId,
          speakerId: speaker.id,
          turn: n,
        });
        break;
      }

      // R3 fix overlap: remover bubble del listener (que fue speaker en
      // turn n-1) antes que el speaker actual cree la suya. Evita 2
      // bubbles simultáneas de agentes distintos.
      if (opts.removeAgentBubble) {
        try {
          opts.removeAgentBubble(listener);
        } catch (err) {
          log('[CONVERSATION-REMOVE-BUBBLE-ERROR]', {
            conversationId,
            listenerId: listener.id,
            error: String(err),
          });
        }
      }

      let result: SpeakResult;
      try {
        result = await brain.speak(listener.id, {
          situationLines: [
            `Estás en una conversación cara a cara con ${listener.id}.`,
          ],
          maxTokens: TURN_MAX_TOKENS,
          turnContext: lastTurn ?? undefined,
          skipMemoryWrite: true,
        });
      } catch (err) {
        // CONTRATO 4: error LLM throw → log + break.
        log('[CONVERSATION-LLM-ERROR]', {
          conversationId,
          speakerId: speaker.id,
          turn: n,
          error: String(err),
        });
        break;
      }

      if (!result.ok || result.text.length === 0) {
        log('[CONVERSATION-LLM-EMPTY]', {
          conversationId,
          turn: n,
          ok: result.ok,
          reason: result.reason,
        });
        break;
      }

      lastTurn = { speakerId: speaker.id, text: result.text };
      allTurns.push(lastTurn);
      turnsCompleted++;

      const durationMs = getBubbleDurationMs(result.text);
      await sleep(durationMs + TURN_END_PADDING_MS);
    }
  } finally {
    // CONTRATO 2: cleanup garantizado, validando conversationId match.
    for (const p of participants) {
      if (p.activeConversationId === conversationId) {
        p.talking = false;
        p.activeConversationId = null;
        // Pausa breve post-talk evita re-walk inmediato (R2 fix). Solo
        // si esta conversación es dueña del lock (no pisa otra).
        p.waiting = POST_CONVERSATION_WAITING_S;
      }
    }

    // CONTRATO 6: cooldown SOLO si conversationStarted.
    if (conversationStarted) {
      const cooldownMs =
        turnsCompleted === 0 ? COOLDOWN_FAIL_TURN0_MS : COOLDOWN_NORMAL_MS;
      try {
        opts.markPairCooldown(a.id, b.id, cooldownMs);
      } catch (err) {
        log('[CONVERSATION-COOLDOWN-ERROR]', {
          conversationId,
          error: String(err),
        });
      }
    }

    // Memoria solo con texto real (CONTRATO 4).
    if (allTurns.length > 0) {
      const summary = buildConversationSummary(allTurns);
      const importance = computeConversationImportance(allTurns);
      const participantIds = participants.map((p) => p.id);
      for (const p of participants) {
        const brain = opts.brainFor(p.id);
        if (brain === null) continue;
        try {
          brain.recordConversationEpisode(
            participantIds,
            summary,
            importance,
            allTurns.length,
          );
        } catch (err) {
          log('[CONVERSATION-MEMORY-ERROR]', {
            conversationId,
            agentId: p.id,
            error: String(err),
          });
        }
      }
    }

    log('[CONVERSATION-ENDED]', {
      conversationId,
      turnsCompleted,
      totalTurns,
    });
  }
}

function defaultConversationId(): string {
  // 6 chars base36 — mismo patrón que utils/id.ts. Inline para evitar
  // dependencia circular con módulos que importan conversation.
  return Math.random().toString(36).slice(2, 8);
}
