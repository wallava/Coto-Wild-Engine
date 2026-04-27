// State minimal del array de agents singleton. Hasta extraer el chassis
// completo (spawnAgent + render + needs), agents vive en legacy y le
// damos acceso vía getter a otros módulos engine que necesitan leer
// posiciones.

type AgentLike = {
  cx: number;
  cy: number;
};

let _getAgents: () => AgentLike[] = () => [];

export function setAgentsGetter(getter: () => AgentLike[]): void {
  _getAgents = getter;
}

export function getAgents(): AgentLike[] {
  return _getAgents();
}

// ¿Algún agente está exactamente en (cx, cy)?
export function isAgentAt(cx: number, cy: number): boolean {
  return _getAgents().some((a) => a.cx === cx && a.cy === cy);
}
