// Lógica "ir a trabajar a una estación": handleAgentLanded decide qué hacer
// cuando un agente termina su salto/aterrizaje en una celda. startWorkingState
// es el helper único que setea agent.working (con duration + elapsed) y emite
// el evento 'agentReachedStation'.

import { eventBus } from '../engine/event-bus';
import { getZoneAt } from '../engine/rooms';
import { showAgentThought } from '../engine/thought-bubbles';
import {
  pickNearestProp,
  findWalkableAdjacentToProp,
  assignAgentTarget,
  pickCellInZone,
} from '../engine/agent-helpers';
import { findPath } from '../engine/pathfinding';
import { GRID_W, GRID_H } from '../engine/state';
import type { PropAny } from '../engine/world';
import { setAgentFacing, syncAgentMesh } from '../engine/agent-chassis';
import { ROOM_REQUIREMENTS, checkZoneRequirements } from './zone-catalog';
import { WORKING_DURATION, getAgentMostCriticalNeed, findZoneForNeed } from './needs';

const RANDOM_DESTINATION_MAX_ATTEMPTS = 30;
const IDLE_PAUSE_MIN_S = 0.3;
const IDLE_PAUSE_RANGE_S = 1.2;
const RETRY_PATH_DELAY_S = 1;
const FACING_DEADBAND = 0.01;

const CONFUSED_THOUGHT_DURATION_S = 2.5;

type AgentForStation = {
  cx: number;
  cy: number;
  px: number;
  py: number;
  spriteH: number;
  path: [number, number][];
  target: [number, number] | null;
  waiting: number;
  working: { prop: PropAny | null; zoneKind: string; duration: number; elapsed: number } | null;
  _stationProp?: PropAny | null;
  _stationZoneKind?: string | null;
};

// Setea agent.working con duración default + emite 'agentReachedStation'.
export function startWorkingState(
  agent: AgentForStation,
  prop: PropAny | null,
  zoneKind: string,
): void {
  agent.working = {
    prop,
    zoneKind,
    duration: WORKING_DURATION,
    elapsed: 0,
  };
  eventBus.emit('agentReachedStation', { agent, prop, zoneKind });
}

// Decide qué hacer cuando el agente termina de aterrizar en una celda:
// - Sin zona o zona no funcional → confused
// - Zona sin requisitos → working en sitio
// - Zona con requisitos → caminar al prop más cercano del primer kind requerido
//   (si ya está adyacente, working directo)
export function handleAgentLanded(agent: AgentForStation): void {
  const zoneInfo = getZoneAt(agent.cx, agent.cy);
  if (!zoneInfo) {
    showAgentThought(agent, 'confused', CONFUSED_THOUGHT_DURATION_S);
    return;
  }
  const check = checkZoneRequirements(zoneInfo.zone);
  if (!check.ok) {
    showAgentThought(agent, 'confused', CONFUSED_THOUGHT_DURATION_S);
    return;
  }
  const reqs = ROOM_REQUIREMENTS[zoneInfo.zone.kind!] ?? [];
  if (reqs.length === 0) {
    startWorkingState(agent, null, zoneInfo.zone.kind!);
    return;
  }
  const firstKind = reqs[0]!.kind;
  const propsOfKind = check.satisfiedBy[firstKind] ?? [];
  if (propsOfKind.length === 0) return;
  const nearest = pickNearestProp(propsOfKind, agent.cx, agent.cy);
  if (!nearest) return;
  const target = findWalkableAdjacentToProp(nearest, agent.cx, agent.cy);
  if (!target) return;
  if (target.cx === agent.cx && target.cy === agent.cy) {
    startWorkingState(agent, nearest, zoneInfo.zone.kind!);
    return;
  }
  if (assignAgentTarget(agent, target.cx, target.cy)) {
    agent._stationProp = nearest;
    agent._stationZoneKind = zoneInfo.zone.kind!;
  } else {
    startWorkingState(agent, nearest, zoneInfo.zone.kind!);
  }
}

// Elige el próximo destino del agente:
//   1) Si tiene need crítica, busca zona apropiada y camina al cell más cercano.
//   2) Fallback: random walk (hasta MAX_ATTEMPTS celdas alcanzables).
// Devuelve true si asignó un path. Si el agente está working, devuelve false sin tocar.
export function pickRandomDestination(
  agent: AgentForStation & { needs: Record<string, number> },
): boolean {
  if (agent.working) return false;
  const crit = getAgentMostCriticalNeed(agent);
  if (crit) {
    const zoneInfo = findZoneForNeed(crit.need, agent.cx, agent.cy);
    if (zoneInfo) {
      const cell = pickCellInZone(zoneInfo.zone.cells, agent.cx, agent.cy);
      if (cell) {
        const path = findPath(agent.cx, agent.cy, cell.cx, cell.cy);
        if (path && path.length > 0) {
          agent.path = path;
          agent.target = [cell.cx, cell.cy];
          return true;
        }
      }
    }
  }
  let attempts = 0;
  while (attempts++ < RANDOM_DESTINATION_MAX_ATTEMPTS) {
    const gx = Math.floor(Math.random() * GRID_W);
    const gy = Math.floor(Math.random() * GRID_H);
    if (gx === agent.cx && gy === agent.cy) continue;
    const path = findPath(agent.cx, agent.cy, gx, gy);
    if (path && path.length > 0) {
      agent.path = path;
      agent.target = [gx, gy];
      return true;
    }
  }
  return false;
}

// Tipo runtime del agente para updateAgents (subset extendido).
type AgentForUpdate = AgentForStation & {
  hopFreq: number;
  hopTime: number;
  hopping: boolean;
  speed: number;
  needs: Record<string, number>;
  talking: boolean;
  activeConversationId?: string | null;
};

type UpdateAgentsOpts = {
  skipAgent?: AgentForUpdate | null;
  isCutsceneControlled?: (agent: AgentForUpdate) => boolean;
};

// Tick del loop de agentes: prioridades en orden son drag (skip), cutscene
// (skip), talking (parar y syncar), working (hop lento), waiting (idle), sin
// path (pickRandomDestination), o moviéndose por el path. Emite agentMoved
// al pasar a una nueva celda.
export function updateAgents(
  agents: AgentForUpdate[],
  dt: number,
  opts: UpdateAgentsOpts = {},
): void {
  const skip = opts.skipAgent ?? null;
  const isCsControlled = opts.isCutsceneControlled;
  for (const agent of agents) {
    if (skip && agent === skip) continue;
    if (isCsControlled && isCsControlled(agent)) continue;
    if (agent.talking) {
      agent.hopping = false;
      syncAgentMesh(agent as never);
      continue;
    }
    if (agent.working) {
      agent.hopping = true;
      agent.hopTime += dt * agent.hopFreq * 0.5 * Math.PI;
      syncAgentMesh(agent as never);
      continue;
    }
    if (agent.waiting > 0) {
      agent.waiting -= dt;
      agent.hopping = false;
      syncAgentMesh(agent as never);
      continue;
    }
    if (!agent.path || agent.path.length === 0) {
      if (!pickRandomDestination(agent)) {
        agent.waiting = RETRY_PATH_DELAY_S;
        continue;
      }
    }
    agent.hopping = true;
    agent.hopTime += dt * agent.hopFreq * Math.PI;
    const [nx, ny] = agent.path[0]!;
    const targetPx = nx + 0.5;
    const targetPy = ny + 0.5;
    const dx = targetPx - agent.px;
    const dy = targetPy - agent.py;
    if (Math.abs(dx) > FACING_DEADBAND) {
      setAgentFacing(agent as never, dx > 0 ? 'left' : 'right');
    }
    const dist = Math.sqrt(dx * dx + dy * dy);
    const move = agent.speed * dt;
    if (move >= dist) {
      agent.px = targetPx;
      agent.py = targetPy;
      const fromCx = agent.cx;
      const fromCy = agent.cy;
      agent.cx = nx;
      agent.cy = ny;
      if (fromCx !== nx || fromCy !== ny) {
        eventBus.emit('agentMoved', {
          agent,
          from: { cx: fromCx, cy: fromCy },
          to: { cx: nx, cy: ny },
        });
      }
      agent.path.shift();
      if (agent.path.length === 0) {
        agent.waiting = IDLE_PAUSE_MIN_S + Math.random() * IDLE_PAUSE_RANGE_S;
      }
    } else {
      agent.px += (dx / dist) * move;
      agent.py += (dy / dist) * move;
    }
    syncAgentMesh(agent as never);
  }
}
