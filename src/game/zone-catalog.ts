// Catálogo de tipos de zona (kinds) + requisitos para que una zona sea
// "funcional" (que pueda restaurar needs de un agente).
//
// Las zonas de juego incluyen tanto habitaciones cerradas (autodetectadas
// por el engine) como zonas abiertas (pintadas a mano). El kind define
// semántica de gameplay: qué needs restaura + qué props requiere.
//
// `checkZoneRequirements` es genérica respecto a la lista de requisitos —
// vive acá porque el catálogo (ROOM_REQUIREMENTS) le da significado.

import { propsInCells, type Zone, type Room } from '../engine/rooms';
import type { PropAny } from '../engine/world';

export type RoomKind = {
  id: string;
  label: string;
};

export type ZoneRequirement = {
  kind: string;
  count: number;
};

// 10 kinds canónicos de AGENTS.INC.
export const ROOM_KINDS: RoomKind[] = [
  { id: 'office',   label: 'Oficina' },
  { id: 'meeting',  label: 'Sala de juntas' },
  { id: 'kitchen',  label: 'Cocina' },
  { id: 'lounge',   label: 'Lounge' },
  { id: 'bathroom', label: 'Baño' },
  { id: 'storage',  label: 'Depósito' },
  { id: 'lobby',    label: 'Recepción' },
  { id: 'creative', label: 'Espacio creativo' },
  { id: 'social',   label: 'Espacio social' },
  { id: 'outdoor',  label: 'Exterior' },
];

// Requisitos por kind. Usa kinds genéricos: 'table' cubre todas las mesas,
// 'chair' todas las sillas. Editás libremente — el juego respeta los nuevos
// requisitos. Kinds sin requisitos (bathroom, outdoor) son siempre funcionales.
export const ROOM_REQUIREMENTS: Record<string, ZoneRequirement[]> = {
  office:   [{ kind: 'table', count: 1 }, { kind: 'chair', count: 1 }, { kind: 'laptop', count: 1 }],
  meeting:  [{ kind: 'table', count: 1 }, { kind: 'chair', count: 4 }],
  kitchen:  [{ kind: 'table', count: 1 }, { kind: 'coffee', count: 1 }],
  lounge:   [{ kind: 'sofa', count: 1 }, { kind: 'table', count: 1 }],
  bathroom: [],
  storage:  [{ kind: 'box', count: 1 }],
  lobby:    [{ kind: 'sofa', count: 1 }, { kind: 'plant', count: 1 }],
  creative: [{ kind: 'table', count: 1 }, { kind: 'chair', count: 2 }, { kind: 'lamp', count: 1 }],
  social:   [{ kind: 'sofa', count: 1 }, { kind: 'chair', count: 2 }],
  outdoor:  [],
};

// ── Check de requisitos ───────────────────────────────────────────
type ZoneLike = { kind?: string | null; cells: { cx: number; cy: number }[] };

export type CheckResult = {
  ok: boolean;
  missing: { kind: string; needed: number; have: number }[];
  satisfiedBy: Record<string, PropAny[]>;
  hasKind: boolean;
};

// Si la zona no tiene kind asignado, ok=false (zona sin propósito definido).
// Si el kind no tiene requisitos (bathroom, outdoor), ok=true.
// Si tiene requisitos, ok=true sólo si TODOS están cubiertos por props en cells.
export function checkZoneRequirements(zone: ZoneLike | Zone | Room | null | undefined): CheckResult {
  const result: CheckResult = { ok: false, missing: [], satisfiedBy: {}, hasKind: false };
  if (!zone) return result;
  const kind = zone.kind;
  if (!kind) return result;
  result.hasKind = true;
  const reqs = ROOM_REQUIREMENTS[kind] ?? [];
  if (reqs.length === 0) {
    result.ok = true;
    return result;
  }
  const propsHere = propsInCells(zone.cells);
  let allMet = true;
  for (const req of reqs) {
    const matches = propsHere.filter((p) => ((p['kind'] as string) || '') === req.kind);
    result.satisfiedBy[req.kind] = matches;
    if (matches.length < req.count) {
      result.missing.push({ kind: req.kind, needed: req.count, have: matches.length });
      allMet = false;
    }
  }
  result.ok = allMet;
  return result;
}
