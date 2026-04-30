/**
 * Acciones que un agente LLM puede ejecutar en el juego.
 * Implementados: SAY, EMOTE, LOOK_AT. WALK_TO sigue como stub (Fase 5.1 B-4).
 */

import { getBubbleDurationMs } from './bubble-duration';

export type AgentAction =
  | { type: 'SAY'; text: string }
  | { type: 'WALK_TO'; target: string }
  | { type: 'LOOK_AT'; target: string }
  | { type: 'EMOTE'; emote: string };

export type AgentLike = {
  id: string;
  [key: string]: unknown; // mesh, etc — duck-type
};

export type ShowSpeechBubbleFn = (
  agent: AgentLike,
  text: string,
  opts?: { autoCloseAfter?: number },
) => void;

export type AgentFacing = 'left' | 'right';

/**
 * Contexto de inyección para handlers de acciones. showSpeechBubble es
 * obligatorio (SAY y EMOTE lo usan). setFacing y getAgentPositionX son
 * opcionales por ahora — si faltan, LOOK_AT cae a console.warn graceful.
 */
export type ActionContext = {
  showSpeechBubble: ShowSpeechBubbleFn;
  setFacing?: (agent: AgentLike, direction: AgentFacing) => void;
  getAgentPositionX?: (agentId: string) => number | null;
};

const EMOTE_AUTOCLOSE_SEC = 2.0;
const LOOK_AT_X_THRESHOLD = 0.001;

/**
 * Aplica una acción de agente al objeto de agente dado.
 * SAY: showSpeechBubble con duración proporcional al texto (2-8s).
 * EMOTE: showSpeechBubble con autoCloseAfter=2.0s (reacción más corta que diálogo).
 * LOOK_AT: setFacing según posición relativa al target (convención legacy
 *          dx > 0 → 'left'; ver legacy.ts:4393).
 * WALK_TO: console.warn — pendiente Fase 5.1 B-4.
 */
export function applyAgentAction(
  agent: AgentLike,
  action: AgentAction,
  ctx: ActionContext,
): void {
  switch (action.type) {
    case 'SAY':
      applySayAction(agent, action.text, ctx);
      return;
    case 'EMOTE':
      applyEmoteAction(agent, action.emote, ctx);
      return;
    case 'LOOK_AT':
      applyLookAtAction(agent, action.target, ctx);
      return;
    case 'WALK_TO':
      console.warn(
        `[agent-action] WALK_TO no implementado (Fase 5.1 B-4). agent=${agent.id} target=${action.target}`,
      );
      return;
  }
}

/**
 * Muestra el texto del agente como speech bubble.
 * autoCloseAfter: duración proporcional al texto, clampada entre 2s y 8s.
 */
export function applySayAction(
  agent: AgentLike,
  text: string,
  ctx: ActionContext,
): void {
  ctx.showSpeechBubble(agent, text, {
    autoCloseAfter: getBubbleDurationMs(text) / 1000,
  });
}

/**
 * Muestra un emote (emoji o palabra corta) sobre el agente. Reúsa el speech
 * bubble con autoClose más corto (2.0s) para diferenciar reacción de diálogo.
 * @param agent agente que ejecuta el emote.
 * @param emote string del emote (típicamente 1-3 caracteres / emoji).
 * @param ctx contexto con showSpeechBubble inyectado.
 */
export function applyEmoteAction(
  agent: AgentLike,
  emote: string,
  ctx: ActionContext,
): void {
  ctx.showSpeechBubble(agent, emote, { autoCloseAfter: EMOTE_AUTOCLOSE_SEC });
}

/**
 * Orienta al agente hacia el target comparando posiciones X.
 * Convención legacy (legacy.ts:4393): dx > 0 → 'left'.
 *
 * Si setFacing o getAgentPositionX no están en ctx, o las posiciones no
 * resuelven, fallback a console.warn (no rompe el flujo).
 *
 * @param agent agente que orienta su mirada.
 * @param targetId id del target (otro agente, zona, etc.).
 * @param ctx contexto con setFacing + getAgentPositionX inyectados.
 */
export function applyLookAtAction(
  agent: AgentLike,
  targetId: string,
  ctx: ActionContext,
): void {
  if (!ctx.setFacing || !ctx.getAgentPositionX) {
    console.warn(
      `[agent-action] LOOK_AT no wired (falta setFacing o getAgentPositionX). agent=${agent.id} target=${targetId}`,
    );
    return;
  }
  const agentX = ctx.getAgentPositionX(agent.id);
  const targetX = ctx.getAgentPositionX(targetId);
  if (agentX === null || targetX === null) {
    console.warn(
      `[agent-action] LOOK_AT sin posición resoluble. agent=${agent.id} target=${targetId} agentX=${agentX} targetX=${targetX}`,
    );
    return;
  }
  const dx = targetX - agentX;
  if (Math.abs(dx) < LOOK_AT_X_THRESHOLD) return; // Misma X, no flip.
  const direction: AgentFacing = dx > 0 ? 'left' : 'right';
  ctx.setFacing(agent, direction);
}
