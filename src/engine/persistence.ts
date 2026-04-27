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

import type { z } from 'zod';
import { GRID_H } from './state';
import { uid } from '../utils/id';
import { eventBus } from './event-bus';
import { worldGrid, props } from './world';
import { WorldSchema, type World as WorldValidated } from './schema';
import { loadAndMigrateWorld } from './migrations';

// agents son globales en legacy hasta que se extraiga el chassis. Acá
// recibimos via getter callback para que serializeWorld pueda incluirlos.
type AgentSerializable = {
  id: string;
  cx: number;
  cy: number;
  emoji?: unknown;
  voiceIdx?: number;
  needs?: Record<string, number>;
  heldItem?: unknown;
};

let _getAgents: () => AgentSerializable[] = () => [];

export function setAgentsGetter(getter: () => AgentSerializable[]): void {
  _getAgents = getter;
}

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

// ── Validación estricta (API nueva) ────────────────────────────────
// `validateWorld` complementa el guard laxo `isValidWorldData` con shape
// estricto + check de dimensiones. NO reemplaza el guard legacy: callers
// existentes (loadFromStorage, applySlot) siguen usando isValidWorldData
// para tolerar worlds del monolito que aún no pasaron por migrate.
//
// Para callers nuevos (R4 migrations integradas) usar validateWorld.

export type BadDimensionsError = { code: 'BAD_DIMENSIONS'; message: string };

export type WorldValidationResult =
  | { ok: true; world: WorldValidated }
  | { ok: false; error: z.ZodError | BadDimensionsError };

export function validateWorld(raw: unknown): WorldValidationResult {
  const parsed = WorldSchema.safeParse(raw);
  if (!parsed.success) {
    const summary = parsed.error.issues
      .map((i) => `${i.path.join('.')} :: ${i.code} :: ${i.message}`)
      .join(' || ');
    console.warn(`[world/validate] schema mismatch: ${summary}`);
    return { ok: false, error: parsed.error };
  }
  const w = parsed.data;
  if (w.wallN.length !== GRID_H + 1 || w.wallW.length !== GRID_H) {
    const message = `wallN.length=${w.wallN.length} (esperado ${GRID_H + 1}), wallW.length=${w.wallW.length} (esperado ${GRID_H})`;
    console.warn('[world/validate] bad dimensions', message);
    return { ok: false, error: { code: 'BAD_DIMENSIONS', message } };
  }
  return { ok: true, world: w };
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

// Serializa worldGrid + props + agents a un objeto plano (idempotente).
// agents viene del getter callback (legacy hasta extraer agent chassis).
type ZoneShape = { id: string; name: string; kind: string | null; color: number; cells: { cx: number; cy: number }[] };
type RoomMetaShape = { id: string; name: string; kind: string | null; color: number; anchorCx: number; anchorCy: number };

export function serializeWorld(): WorldData {
  return {
    wallN: worldGrid.wallN as unknown[][],
    wallW: worldGrid.wallW as unknown[][],
    wallNStyle: worldGrid.wallNStyle,
    wallWStyle: worldGrid.wallWStyle,
    floorColors: worldGrid.floorColors,
    wallNColors: worldGrid.wallNColors,
    wallWColors: worldGrid.wallWColors,
    roomMeta: ((worldGrid.roomMeta as RoomMetaShape[] | undefined) ?? []).map((m) => ({ ...m })),
    zones: ((worldGrid.zones as ZoneShape[] | undefined) ?? []).map((z) => ({
      id: z.id,
      name: z.name,
      kind: z.kind,
      color: z.color,
      cells: z.cells.map((c) => ({ cx: c.cx, cy: c.cy })),
    })),
    props: props.map((p) => {
      const out: Record<string, unknown> = {
        id: p['id'],
        cx: p['cx'],
        cy: p['cy'],
        h: p['h'],
        top: p['top'],
        right: p['right'],
        left: p['left'],
        category: (p['category'] as string) || 'floor',
      };
      if (p['w'] !== undefined) out['w'] = p['w'];
      if (p['d'] !== undefined) out['d'] = p['d'];
      if (p['side'] !== undefined) out['side'] = p['side'];
      if (p['zOffset'] !== undefined) out['zOffset'] = p['zOffset'];
      if (p['stackable']) out['stackable'] = true;
      if (p['kind'] !== undefined) out['kind'] = p['kind'];
      if (p['name'] !== undefined) out['name'] = p['name'];
      return out;
    }),
    agents: _getAgents().map((a) => ({
      id: a.id,
      cx: a.cx,
      cy: a.cy,
      emoji: a.emoji,
      voiceIdx: a.voiceIdx,
      needs: a.needs ? { ...a.needs } : undefined,
      heldItem: a.heldItem ?? null,
    })),
  };
}

// Serializa + escribe en cwe_current. Dispara worldSaved.
export function saveToStorage(): void {
  try {
    localStorage.setItem(SLOT_CURRENT_KEY, JSON.stringify(serializeWorld()));
    eventBus.emit('worldSaved', {});
  } catch (e) {
    console.error('[save] failed:', e);
  }
}

// Debounce de save: marca cambio, guarda 400ms después. Cualquier llamada
// dentro de la ventana resetea el timer (= solo se guarda al estar 400ms
// sin más mutaciones).
let _saveTimer: number | null = null;
export function markWorldChanged(): void {
  if (_saveTimer !== null) clearTimeout(_saveTimer);
  _saveTimer = window.setTimeout(saveToStorage, 400);
}

// applyWorldFromData vive en legacy hasta que applyWorld se extraiga.
// Recibimos via callback para que loadFromStorage pueda invocarlo.
let _applyWorldFromData: (data: WorldData, source: string) => void = () => {};

export function setApplyWorldFromDataCallback(
  cb: (data: WorldData, source: string) => void,
): void {
  _applyWorldFromData = cb;
}

// Intenta cargar el mundo: primero cwe_current, después migrar v2 → current,
// después v1 → current con migración de side. Devuelve true si encontró
// algo. false → caller debe usar defaultWorld.
//
// Pipeline por slot:
//   1. JSON.parse del raw.
//   2. validateWorld estricto (schema + dim check).
//      - Si pasa: applyWorldFromData.
//      - Si falla: loadAndMigrateWorld (clone + migrate + re-validate).
//          - Si pasa: applyWorldFromData con la versión migrada + saveToStorage
//            para persistir la migración (evita re-migrate en próximas cargas).
//          - Si falla: log estructurado + saltar al próximo slot.
function tryLoadSlot(rawString: string, source: string): boolean {
  let data: unknown;
  try {
    data = JSON.parse(rawString);
  } catch (e) {
    console.error(`[load ${source}] JSON parse failed:`, e);
    return false;
  }

  // 1. Validate as-is.
  const direct = validateWorld(data);
  if (direct.ok) {
    _applyWorldFromData(direct.world as unknown as WorldData, 'storage');
    const propCount = Array.isArray(direct.world.props) ? direct.world.props.length : 0;
    console.log(`[load ${source}] restored: ${propCount} muebles`);
    return true;
  }

  // 2. Failed. Clone + migrate + revalidate.
  const migrated = loadAndMigrateWorld(data);
  if (migrated.ok) {
    _applyWorldFromData(migrated.world as unknown as WorldData, 'storage');
    saveToStorage();   // persiste versión migrada en SLOT_CURRENT_KEY
    const propCount = Array.isArray(migrated.world.props) ? migrated.world.props.length : 0;
    console.warn(`[load ${source}] migrado y revalidado: ${propCount} muebles ✅`);
    return true;
  }

  // 3. Sigue fallando después de migrate. Cuarentena el raw para preservar
  // tu data: el caller legacy normalmente aplica defaultWorld + saveToStorage
  // → eso pisa cwe_current. La cuarentena guarda el raw rechazado en una
  // key separada para que puedas inspeccionarlo / restaurarlo manualmente.
  try {
    const quarantineKey = `cwe_quarantine_${source}_${Date.now()}`;
    localStorage.setItem(quarantineKey, rawString);
    console.error(`[load ${source}] world inválido. Raw guardado en localStorage.${quarantineKey} para revisión.`);
  } catch (e) {
    console.error(`[load ${source}] cuarentena del raw falló:`, e);
  }
  if ('issues' in migrated.error) {
    const summary = migrated.error.issues
      .map((i) => `${i.path.join('.')} :: ${i.code} :: ${i.message}`)
      .join(' || ');
    console.error(`[load ${source}] world inválido después de migrate: ${summary}`);
  } else {
    console.error(`[load ${source}] world inválido después de migrate`, migrated.error);
  }
  return false;
}

export function loadFromStorage(): boolean {
  // 1. Intentar current.
  try {
    const raw = localStorage.getItem(SLOT_CURRENT_KEY);
    if (raw && tryLoadSlot(raw, 'current')) return true;
  } catch (e) {
    console.error('[load current] failed:', e);
  }
  // 2. Migrar v2 → current.
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    if (raw && tryLoadSlot(raw, 'v2')) {
      localStorage.removeItem(STORAGE_KEY_V2);
      return true;
    }
  } catch (e) {
    console.error('[load v2 migration] failed:', e);
  }
  // 3. Migrar v1 → current.
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V1);
    if (raw && tryLoadSlot(raw, 'v1')) {
      localStorage.removeItem(STORAGE_KEY_V1);
      return true;
    }
  } catch (e) {
    console.error('[load v1 migration] failed:', e);
  }
  return false;
}
