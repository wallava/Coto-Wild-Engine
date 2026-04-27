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
} from '../engine/agent-helpers';
import type { PropAny } from '../engine/world';
import { ROOM_REQUIREMENTS, checkZoneRequirements } from './zone-catalog';
import { WORKING_DURATION } from './needs';

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
