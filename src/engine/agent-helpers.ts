// Helpers de agentes que no requieren mesh ni state runtime — pure utility
// functions sobre props + grid.

import { GRID_W, GRID_H } from './state';
import { isBlockedByProp, findPath } from './pathfinding';
import type { PropAny } from './world';

// Tipo mínimo del agente que necesitan estos helpers (path/target/waiting).
type AgentTargetable = {
  cx: number;
  cy: number;
  path: [number, number][];
  target: [number, number] | null;
  waiting: number;
};

// Asigna un destino al agente. Calcula path A* y lo setea, cancelando la
// pausa actual. Devuelve true si se asignó (path no vacío y destino != celda).
export function assignAgentTarget(
  agent: AgentTargetable | null | undefined,
  gx: number,
  gy: number,
): boolean {
  if (!agent) return false;
  if (gx === agent.cx && gy === agent.cy) return false;
  const path = findPath(agent.cx, agent.cy, gx, gy);
  if (path && path.length > 0) {
    agent.path = path;
    agent.target = [gx, gy];
    agent.waiting = 0;
    return true;
  }
  return false;
}

// Setea opacidad del mesh del agente (sprite). Marca transparent y needsUpdate.
export function setAgentMeshOpacity(
  agent: { mesh?: { material?: { opacity: number; transparent: boolean; needsUpdate: boolean } } },
  opacity: number,
): void {
  if (!agent.mesh || !agent.mesh.material) return;
  agent.mesh.material.opacity = opacity;
  agent.mesh.material.transparent = opacity < 1;
  agent.mesh.material.needsUpdate = true;
}

// El más cercano (Manhattan) de una lista de props desde (fromCx, fromCy).
// La distancia se mide al centro del prop (considera w/d).
export function pickNearestProp(
  propsList: PropAny[],
  fromCx: number,
  fromCy: number,
): PropAny | null {
  let best: PropAny | null = null;
  let bestDist = Infinity;
  for (const p of propsList) {
    const w = (p['w'] as number) ?? 1;
    const d = (p['d'] as number) ?? 1;
    const cx = (p['cx'] as number) + w / 2;
    const cy = (p['cy'] as number) + d / 2;
    const dist = Math.abs(cx - fromCx) + Math.abs(cy - fromCy);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}

// Celda walkable de un set de celdas (típicamente las de una zona),
// ordenada por distancia Manhattan a (fromCx, fromCy). null si todas
// están bloqueadas por props.
export function pickCellInZone(
  zoneCells: { cx: number; cy: number }[],
  fromCx: number,
  fromCy: number,
): { cx: number; cy: number } | null {
  const walkable = zoneCells
    .filter((c) => !isBlockedByProp(c.cx, c.cy))
    .map((c) => ({ cx: c.cx, cy: c.cy, d: Math.abs(c.cx - fromCx) + Math.abs(c.cy - fromCy) }))
    .sort((a, b) => a.d - b.d);
  if (walkable.length === 0) return null;
  const w = walkable[0]!;
  return { cx: w.cx, cy: w.cy };
}

// Celda walkable adyacente al perímetro cardinal del prop, ordenada por
// distancia Manhattan a (fromCx, fromCy). null si todas están bloqueadas
// o fuera del grid.
export function findWalkableAdjacentToProp(
  prop: PropAny,
  fromCx: number,
  fromCy: number,
): { cx: number; cy: number } | null {
  const px = prop['cx'] as number;
  const py = prop['cy'] as number;
  const w = (prop['w'] as number) ?? 1;
  const d = (prop['d'] as number) ?? 1;
  const candidates: { cx: number; cy: number }[] = [];
  for (let dx = 0; dx < w; dx++) {
    candidates.push({ cx: px + dx, cy: py - 1 });
    candidates.push({ cx: px + dx, cy: py + d });
  }
  for (let dy = 0; dy < d; dy++) {
    candidates.push({ cx: px - 1, cy: py + dy });
    candidates.push({ cx: px + w, cy: py + dy });
  }
  const walkable = candidates.filter(
    (c) => c.cx >= 0 && c.cx < GRID_W && c.cy >= 0 && c.cy < GRID_H && !isBlockedByProp(c.cx, c.cy),
  );
  if (walkable.length === 0) return null;
  walkable.sort((a, b) => {
    const da = Math.abs(a.cx - fromCx) + Math.abs(a.cy - fromCy);
    const db = Math.abs(b.cx - fromCx) + Math.abs(b.cy - fromCy);
    return da - db;
  });
  return walkable[0]!;
}
