// Sistema de necesidades del agente. 4 needs decaen con el tiempo
// (0=crítico, 100=lleno). Cada una se restaura en zonas específicas
// (ZONE_RESTORES). Cuando una need baja del threshold, el agente busca
// autónomamente una zona apropiada.
//
// Working: cuando un agente trabaja en una estación funcional, restore
// pasivo se multiplica por WORKING_RESTORE_MULT durante WORKING_DURATION.

export const NEED_TYPES = ['focus', 'hunger', 'social', 'bathroom'] as const;
export type NeedType = (typeof NEED_TYPES)[number];

// Decay por segundo. Valores bajos para que el ciclo dure varios minutos
// (sino los agentes están constantemente en pánico).
export const NEED_DECAY: Record<NeedType, number> = {
  focus:    0.6,   // ~165s para vaciar (2.7 min)
  hunger:   0.4,   // ~250s
  social:   0.5,   // ~200s
  bathroom: 0.7,   // ~143s (más urgente)
};

export const NEED_THRESHOLD_CRITICAL = 30;     // bajo esto: aparece overlay + busca zona
export const NEED_THRESHOLD_OK = 75;            // sobre esto: overlay desaparece

// Restauración pasiva (estando en la zona): rate por segundo. Las keys son
// kind de zona (ROOM_KINDS). Las inner keys son NeedType.
export const ZONE_RESTORES: Record<string, Partial<Record<NeedType, number>>> = {
  kitchen:  { hunger: 14 },
  bathroom: { bathroom: 22 },
  lounge:   { focus: 9, social: 4 },
  social:   { social: 14 },
  creative: { focus: 7 },
  meeting:  { social: 6 },
  outdoor:  { focus: 4, social: 2 },
  office:   {},                           // se trabaja, no descansa
  storage:  {},
  lobby:    {},
};

// Multiplier extra cuando el agente está "working" en una estación funcional
export const WORKING_RESTORE_MULT = 2.5;
// Duración default de una sesión working (segundos)
export const WORKING_DURATION = 8;

// Indicador visual de need crítica (sprite arriba del agente).
export const NEED_EMOJI: Record<NeedType, string> = {
  focus:    '💤',
  hunger:   '🍔',
  social:   '💬',
  bathroom: '🚽',
};

// Emoji que aparece sobre la cabeza durante working, según kind de zona.
export const WORKING_EMOJI: Record<string, string> = {
  office:   '💼',
  meeting:  '🗣️',
  kitchen:  '🍳',
  lounge:   '😌',
  bathroom: '🚿',
  creative: '🎨',
  social:   '🍻',
  outdoor:  '🌳',
  storage:  '📦',
  lobby:    '👋',
};

// ── Queries de necesidades del agente ─────────────────────────────
import { getRooms, getZones, getZoneAt, type Room, type Zone } from '../engine/rooms';
import { eventBus } from '../engine/event-bus';
import { ensureAgentStatus, clearAgentStatus } from '../engine/agent-status';
import { checkZoneRequirements } from './zone-catalog';

type AgentWithNeeds = {
  needs: Record<string, number>;
};

// Need más crítica del agente (menor valor). Devuelve { need, value } o
// null si todas están sobre threshold OK.
export function getAgentMostCriticalNeed(
  agent: AgentWithNeeds,
): { need: NeedType; value: number } | null {
  let worst: NeedType | null = null;
  let worstVal: number = NEED_THRESHOLD_CRITICAL;
  for (const k of NEED_TYPES) {
    const v = agent.needs[k];
    if (v !== undefined && v < worstVal) {
      worstVal = v;
      worst = k;
    }
  }
  return worst ? { need: worst, value: worstVal } : null;
}

// Busca una zona que restaure la need dada y cumpla sus requisitos.
// Devuelve la más cercana (Manhattan al anchor cell) al agente, o null.
export type ZoneCandidate =
  | { type: 'room'; zone: Room }
  | { type: 'zone'; zone: Zone };

export function findZoneForNeed(
  need: NeedType,
  fromCx: number,
  fromCy: number,
): ZoneCandidate | null {
  const candidates: ZoneCandidate[] = [];
  for (const r of getRooms()) {
    if (!r.kind) continue;
    const restores = ZONE_RESTORES[r.kind] ?? {};
    if (!(need in restores)) continue;
    if (!checkZoneRequirements(r).ok) continue;
    candidates.push({ type: 'room', zone: r });
  }
  for (const z of getZones()) {
    if (!z.kind) continue;
    const restores = ZONE_RESTORES[z.kind] ?? {};
    if (!(need in restores)) continue;
    if (!checkZoneRequirements(z).ok) continue;
    candidates.push({ type: 'zone', zone: z });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const anchorA = a.zone.cells[0] ?? { cx: 0, cy: 0 };
    const anchorB = b.zone.cells[0] ?? { cx: 0, cy: 0 };
    const da = Math.abs(anchorA.cx - fromCx) + Math.abs(anchorA.cy - fromCy);
    const db = Math.abs(anchorB.cx - fromCx) + Math.abs(anchorB.cy - fromCy);
    return da - db;
  });
  return candidates[0]!;
}

// Tipo runtime del agente para updateAgentNeeds. Subset de los campos del
// agente legacy (cx/cy + needs + working + statusEmoji/Mesh + flags).
type AgentForNeeds = {
  cx: number;
  cy: number;
  needs: Record<string, number>;
  working: { elapsed: number; duration: number; prop: unknown; zoneKind: string } | null;
  statusEmoji?: string | null;
  statusMesh?: import('three').Sprite | null;
  _csAgent?: boolean;
  talking?: boolean;
};

// Tick del sistema needs. Decae, restaura según zona, avanza working timer y
// ajusta el emoji de status (con histeresis). `skipAgent` se usa para excluir
// al agente actualmente arrastrado por el usuario (queda congelado).
export function updateAgentNeeds(
  agents: AgentForNeeds[],
  dt: number,
  skipAgent?: AgentForNeeds | null,
): void {
  for (const agent of agents) {
    if (skipAgent && agent === skipAgent) continue;
    if (agent._csAgent) {
      clearAgentStatus(agent);
      continue;
    }
    if (agent.talking) continue;
    // 1) Decay
    for (const k of NEED_TYPES) {
      const cur = agent.needs[k] ?? 100;
      agent.needs[k] = Math.max(0, cur - NEED_DECAY[k] * dt);
    }
    // 2) Restore basado en zona actual
    const zoneInfo = getZoneAt(agent.cx, agent.cy);
    if (zoneInfo && zoneInfo.zone.kind) {
      const restores = ZONE_RESTORES[zoneInfo.zone.kind] ?? {};
      const mult = agent.working ? WORKING_RESTORE_MULT : 1;
      for (const need in restores) {
        const cur = agent.needs[need] ?? 0;
        const inc = (restores[need as NeedType] ?? 0) * mult * dt;
        agent.needs[need] = Math.min(100, cur + inc);
      }
    }
    // 3) Working timer
    if (agent.working) {
      agent.working.elapsed += dt;
      if (agent.working.elapsed >= agent.working.duration) {
        const prop = agent.working.prop;
        const zoneKind = agent.working.zoneKind;
        agent.working = null;
        eventBus.emit('agentFinishedStation', { agent, prop, zoneKind });
      }
    }
    // 4) Status overlay (working emoji prevalece sobre needs)
    if (agent.working) {
      const wEmoji = WORKING_EMOJI[agent.working.zoneKind] ?? '⚙️';
      ensureAgentStatus(agent, wEmoji);
      continue;
    }
    let critical: NeedType | null = null;
    let lowest = NEED_THRESHOLD_CRITICAL;
    for (const k of NEED_TYPES) {
      const v = agent.needs[k] ?? 100;
      if (v < lowest) { lowest = v; critical = k; }
    }
    const targetEmoji = critical ? NEED_EMOJI[critical] : null;
    // Histeresis: no quitar el overlay hasta que la need supere THRESHOLD_OK
    if (agent.statusEmoji && critical === null) {
      const recoveringNeed = (Object.keys(NEED_EMOJI) as NeedType[]).find(
        (k) => NEED_EMOJI[k] === agent.statusEmoji,
      );
      if (recoveringNeed && (agent.needs[recoveringNeed] ?? 100) < NEED_THRESHOLD_OK) {
        continue;
      }
    }
    ensureAgentStatus(agent, targetEmoji);
  }
}
