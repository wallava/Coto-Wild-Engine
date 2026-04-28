/**
 * Acciones que un agente LLM puede ejecutar en el juego.
 * MVP: solo SAY tiene handler. WALK_TO / LOOK_AT / EMOTE = stubs post-MVP.
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

/**
 * Aplica una acción de agente al objeto de agente dado.
 * SAY: invoca showSpeechBubble con autoCloseAfter=3.0s por defecto.
 * Otros tipos: console.warn — handler stub (post-MVP).
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
    case 'WALK_TO':
      console.warn(
        `[agent-action] WALK_TO no implementado (MVP). agent=${agent.id} target=${action.target}`,
      );
      return;
    case 'LOOK_AT':
      console.warn(
        `[agent-action] LOOK_AT no implementado (MVP). agent=${agent.id} target=${action.target}`,
      );
      return;
    case 'EMOTE':
      console.warn(
        `[agent-action] EMOTE no implementado (MVP). agent=${agent.id} emote=${action.emote}`,
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
  showSpeechBubble(agent, text, { autoCloseAfter: 3.0 });
}
