/**
 * Acciones que un agente LLM puede ejecutar en el juego.
 * Implementados: SAY, EMOTE. WALK_TO / LOOK_AT siguen como stubs (Fase 5.1).
 */

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

const SAY_AUTOCLOSE_SEC = 3.0;
const EMOTE_AUTOCLOSE_SEC = 2.0;

/**
 * Aplica una acción de agente al objeto de agente dado.
 * SAY: showSpeechBubble con autoCloseAfter=3.0s.
 * EMOTE: showSpeechBubble con autoCloseAfter=2.0s (reacción más corta que diálogo).
 * WALK_TO / LOOK_AT: console.warn — pendientes Fase 5.1 (B-3/B-4).
 */
export function applyAgentAction(
  agent: AgentLike,
  action: AgentAction,
  showSpeechBubble: ShowSpeechBubbleFn,
): void {
  switch (action.type) {
    case 'SAY':
      applySayAction(agent, action.text, showSpeechBubble);
      return;
    case 'EMOTE':
      applyEmoteAction(agent, action.emote, showSpeechBubble);
      return;
    case 'WALK_TO':
      console.warn(
        `[agent-action] WALK_TO no implementado (Fase 5.1 B-4). agent=${agent.id} target=${action.target}`,
      );
      return;
    case 'LOOK_AT':
      console.warn(
        `[agent-action] LOOK_AT no implementado (Fase 5.1 B-2). agent=${agent.id} target=${action.target}`,
      );
      return;
  }
}

/**
 * Muestra el texto del agente como speech bubble.
 * autoCloseAfter: 3.0s por defecto (legacy showSpeechBubble lo acepta como ms o s según impl).
 */
export function applySayAction(
  agent: AgentLike,
  text: string,
  showSpeechBubble: ShowSpeechBubbleFn,
): void {
  showSpeechBubble(agent, text, { autoCloseAfter: SAY_AUTOCLOSE_SEC });
}

/**
 * Muestra un emote (emoji o palabra corta) sobre el agente. Reúsa el speech
 * bubble con autoClose más corto (2.0s) para diferenciar reacción de diálogo.
 * @param agent agente que ejecuta el emote.
 * @param emote string del emote (típicamente 1-3 caracteres / emoji).
 * @param showSpeechBubble fn inyectada que renderiza la burbuja.
 */
export function applyEmoteAction(
  agent: AgentLike,
  emote: string,
  showSpeechBubble: ShowSpeechBubbleFn,
): void {
  showSpeechBubble(agent, emote, { autoCloseAfter: EMOTE_AUTOCLOSE_SEC });
}
