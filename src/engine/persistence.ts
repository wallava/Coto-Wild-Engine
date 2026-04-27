// Persistencia del mundo en localStorage. Extracción parcial (slice 1.4e).
//
// Por ahora viven acá las funciones puras (no dependen de scene/agents/etc):
//   - keys de storage
//   - getSlots / setSlots / deleteSlot / saveSlot
//   - isValidWorldData (type guard)
//   - migrateV1WorldData
//
// Quedan en legacy.ts (esperando que sus deps se extraigan):
//   - serializeWorld     (depende de agents singleton)
//   - applyWorldFromData (depende de applyWorld)
//   - saveToStorage / loadFromStorage / loadSlot / resetWorldToDefault
//   - markWorldChanged

import { GRID_H } from './state';
import { uid } from '../utils/id';
import { eventBus } from './event-bus';

// ── Storage keys ────────────────────────────────────────────────────
export const SLOT_CURRENT_KEY = 'cwe_current';
export const SLOT_LIST_KEY = 'cwe_slots';
export const STORAGE_KEY_V2 = 'cwe_world_v2';
export const STORAGE_KEY_V1 = 'cwe_world_v1';

// ── Tipos mínimos ──────────────────────────────────────────────────
export type WorldData = {
  wallN: unknown[][];
  wallW: unknown[][];
  props: unknown[];
  // Campos opcionales (no validados acá, llegan a applyWorld que tolera ausentes)
  wallNStyle?: unknown;
  wallWStyle?: unknown;
  floorColors?: unknown;
  wallNColors?: unknown;
  wallWColors?: unknown;
  roomMeta?: unknown;
  zones?: unknown;
  agents?: unknown;
};

export type Slot = {
  id: string;
  name: string;
  savedAt: number;
  world: WorldData;
};

// ── Validación ─────────────────────────────────────────────────────
export function isValidWorldData(data: unknown): data is WorldData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (!d['wallN'] || !d['wallW'] || !Array.isArray(d['props'])) return false;
  const wallN = d['wallN'] as unknown[];
  const wallW = d['wallW'] as unknown[];
  if (!Array.isArray(wallN) || !Array.isArray(wallW)) return false;
  if (wallN.length !== GRID_H + 1 || wallW.length !== GRID_H) return false;
  return true;
}

// ── Migración v1 → v2 ──────────────────────────────────────────────
// 'N' (cara sur) → 'S', 'W' (cara este) → 'E' en wall props.
export function migrateV1WorldData(data: WorldData): WorldData {
  for (const p of data.props as Array<Record<string, unknown>>) {
    if ((p['category'] || 'floor') !== 'wall') continue;
    if (p['side'] === 'N') p['side'] = 'S';
    else if (p['side'] === 'W') p['side'] = 'E';
  }
  return data;
}

// ── Slots con nombre ───────────────────────────────────────────────
export function getSlots(): Slot[] {
  try {
    const raw = localStorage.getItem(SLOT_LIST_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as Slot[]) : [];
  } catch {
    return [];
  }
}

export function setSlots(slots: Slot[]): void {
  try {
    localStorage.setItem(SLOT_LIST_KEY, JSON.stringify(slots));
  } catch (e) {
    console.error('[slots] save failed:', e);
  }
}

// saveSlot: requiere serializeWorld (todavía en legacy). Acepta el world ya
// serializado como argumento para evitar la dep. legacy llama:
//   saveSlot(name, serializeWorld())
export function saveSlot(name: string, world: WorldData): Slot | null {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const slots = getSlots();
  const existing = slots.find((s) => s.name === trimmed);
  let slot: Slot;
  if (existing) {
    existing.savedAt = Date.now();
    existing.world = world;
    slot = existing;
  } else {
    slot = { id: uid(), name: trimmed, savedAt: Date.now(), world };
    slots.push(slot);
  }
  setSlots(slots);
  eventBus.emit('slotSaved', { slot });
  return slot;
}

export function deleteSlot(id: string): void {
  const slots = getSlots().filter((s) => s.id !== id);
  setSlots(slots);
  eventBus.emit('slotDeleted', { id });
}
