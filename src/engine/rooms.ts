// Detección de habitaciones cerradas (autodetectadas por flood-fill) +
// queries sobre zonas abiertas. Engine puro, sin gameplay.
//
// DOS sistemas:
//   1. HABITACIONES CERRADAS — detectadas por flood-fill. Cells dinámicas.
//      Solo se persiste metadata (anchor, name, kind, color). Si se rompe
//      una pared, se fusionan; si se cierra, aparece habitación nueva.
//   2. ZONAS ABIERTAS — pintadas por el usuario sobre el piso. Cells
//      persistidas. Independientes de paredes, no se solapan entre zonas.
//
// `kind` (catálogo) y `requirements` viven en el game (game/catalog.ts).
// Acá solo provee infraestructura genérica de detección y queries.

import { GRID_W, GRID_H } from './state';
import { worldGrid, props, type PropAny } from './world';
import { eventBus } from './event-bus';
import { uid } from '../utils/id';
import {
  hasWallN,
  hasWallW,
  blocksSpillN,
  blocksSpillW,
  getDoorOnWallN,
  getDoorOnWallW,
} from './wall-queries';

// ── Tipos ──────────────────────────────────────────────────────────
export type Cell = { cx: number; cy: number };

export type RoomMeta = {
  id: string;
  name: string;
  kind: string | null;
  color: number;
  anchorCx: number;
  anchorCy: number;
};

export type Room = RoomMeta & {
  cells: Cell[];
  hasDoor: boolean;
};

export type Zone = {
  id: string;
  name: string;
  kind: string | null;
  color: number;
  cells: Cell[];
};

export type RoomFace = {
  type: 'wallN' | 'wallW';
  cx: number;
  cy: number;
  side: 'N' | 'S' | 'E' | 'W';
};

export type ZoneAtResult =
  | { type: 'room'; zone: Room }
  | { type: 'zone'; zone: Zone };

// ── Color palette (rotativa) ───────────────────────────────────────
const ROOM_COLOR_PALETTE = [
  0x90b8d8, 0xc090c8, 0xd8a878, 0x88c098, 0xd0a0a0,
  0xa0a8d0, 0xc8c080, 0x80b8b8, 0xd8a8c8, 0xa0c878,
];
let _roomColorIdx = 0;
export function pickRoomColor(): number {
  const c = ROOM_COLOR_PALETTE[_roomColorIdx % ROOM_COLOR_PALETTE.length]!;
  _roomColorIdx++;
  return c;
}

// ── Flood-fill helpers ─────────────────────────────────────────────
// Devuelve set de celdas alcanzables desde (startCx, startCy) sin atravesar
// paredes (puertas SÍ separan — usa blocksSpill).
export function computeFloodFillFloor(startCx: number, startCy: number): Cell[] {
  const visited = new Set<string>();
  const out: Cell[] = [];
  const stack: [number, number][] = [[startCx, startCy]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cx >= GRID_W || cy < 0 || cy >= GRID_H) continue;
    const k = `${cx},${cy}`;
    if (visited.has(k)) continue;
    visited.add(k);
    out.push({ cx, cy });
    if (!blocksSpillN(cx, cy)) stack.push([cx, cy - 1]);
    if (!blocksSpillN(cx, cy + 1)) stack.push([cx, cy + 1]);
    if (!blocksSpillW(cx, cy)) stack.push([cx - 1, cy]);
    if (!blocksSpillW(cx + 1, cy)) stack.push([cx + 1, cy]);
  }
  return out;
}

// Como computeFloodFillFloor pero devuelve las CARAS internas de paredes
// que rodean la habitación (útil para shift+click painting).
export function computeFloodFillRoomFaces(startCx: number, startCy: number): RoomFace[] {
  const visited = new Set<string>();
  const out: RoomFace[] = [];
  const stack: [number, number][] = [[startCx, startCy]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cx >= GRID_W || cy < 0 || cy >= GRID_H) continue;
    const k = `${cx},${cy}`;
    if (visited.has(k)) continue;
    visited.add(k);
    if (hasWallN(cx, cy)) out.push({ type: 'wallN', cx, cy, side: 'S' });
    if (hasWallN(cx, cy + 1)) out.push({ type: 'wallN', cx, cy: cy + 1, side: 'N' });
    if (hasWallW(cx, cy)) out.push({ type: 'wallW', cx, cy, side: 'E' });
    if (hasWallW(cx + 1, cy)) out.push({ type: 'wallW', cx: cx + 1, cy, side: 'W' });
    if (!blocksSpillN(cx, cy)) stack.push([cx, cy - 1]);
    if (!blocksSpillN(cx, cy + 1)) stack.push([cx, cy + 1]);
    if (!blocksSpillW(cx, cy)) stack.push([cx - 1, cy]);
    if (!blocksSpillW(cx + 1, cy)) stack.push([cx + 1, cy]);
  }
  return out;
}

// ── Detección de habitaciones ──────────────────────────────────────
// Detecta todos los componentes conexos del grid y devuelve sus celdas.
export function computeAllRooms(): { cells: Cell[]; anchorCx: number; anchorCy: number }[] {
  const visited = new Set<string>();
  const rooms: { cells: Cell[]; anchorCx: number; anchorCy: number }[] = [];
  for (let cy = 0; cy < GRID_H; cy++) {
    for (let cx = 0; cx < GRID_W; cx++) {
      const k = `${cx},${cy}`;
      if (visited.has(k)) continue;
      const cells = computeFloodFillFloor(cx, cy);
      for (const c of cells) visited.add(`${c.cx},${c.cy}`);
      let anchor = cells[0]!;
      for (const c of cells) {
        if (c.cy < anchor.cy || (c.cy === anchor.cy && c.cx < anchor.cx)) anchor = c;
      }
      rooms.push({ cells, anchorCx: anchor.cx, anchorCy: anchor.cy });
    }
  }
  return rooms;
}

// Reconcilia metadata con la detección actual. Conserva nombre + kind + color
// de habitaciones cuya anchor previa cae dentro de una nueva. Habitaciones
// nuevas heredan color autoasignado y nombre vacío. Cuando dos se fusionan,
// gana la primera detectada (greedy estable).
export function reconcileRoomMeta(): void {
  const detected = computeAllRooms();
  const oldMeta = (worldGrid.roomMeta as RoomMeta[] | undefined) ?? [];
  const usedOldIds = new Set<string>();
  const newMeta: RoomMeta[] = [];
  for (const room of detected) {
    const cellSet = new Set(room.cells.map((c) => `${c.cx},${c.cy}`));
    const prev = oldMeta.find((m) =>
      !usedOldIds.has(m.id) && cellSet.has(`${m.anchorCx},${m.anchorCy}`),
    );
    if (prev) {
      usedOldIds.add(prev.id);
      newMeta.push({
        id: prev.id,
        anchorCx: room.anchorCx,
        anchorCy: room.anchorCy,
        name: prev.name || '',
        kind: prev.kind ?? null,
        color: typeof prev.color === 'number' ? prev.color : pickRoomColor(),
      });
    } else {
      newMeta.push({
        id: uid(),
        anchorCx: room.anchorCx,
        anchorCy: room.anchorCy,
        name: '',
        kind: null,
        color: pickRoomColor(),
      });
    }
  }
  worldGrid.roomMeta = newMeta;
  eventBus.emit('roomsChanged', { count: newMeta.length });
}

// Devuelve habitaciones cerradas con cells + metadata + hasDoor. Sincroniza
// worldGrid.roomMeta MUTANDO los objetos in-place — no recrea refs nuevas,
// así el panel UI puede mantener punteros estables a cada meta (los handlers
// editan `entity.name = X` y eso queda persistido).
export function getRooms(): Room[] {
  const detected = computeAllRooms();
  if (!worldGrid.roomMeta) worldGrid.roomMeta = [];
  const oldMeta = worldGrid.roomMeta as RoomMeta[];
  const usedIds = new Set<string>();
  const ordered: RoomMeta[] = [];
  for (const room of detected) {
    const cellSet = new Set(room.cells.map((c) => `${c.cx},${c.cy}`));
    let m = oldMeta.find((om) =>
      !usedIds.has(om.id) && cellSet.has(`${om.anchorCx},${om.anchorCy}`),
    );
    if (m) {
      usedIds.add(m.id);
      m.anchorCx = room.anchorCx;
      m.anchorCy = room.anchorCy;
    } else {
      m = {
        id: uid(),
        name: '',
        kind: null,
        color: pickRoomColor(),
        anchorCx: room.anchorCx,
        anchorCy: room.anchorCy,
      };
      usedIds.add(m.id);
    }
    ordered.push(m);
  }
  oldMeta.length = 0;
  for (const m of ordered) oldMeta.push(m);
  return detected.map((room, i) => {
    const meta = ordered[i]!;
    const r: Room = {
      ...meta,
      cells: room.cells,
      anchorCx: room.anchorCx,
      anchorCy: room.anchorCy,
      hasDoor: false,
    };
    r.hasDoor = computeRoomHasDoor(r);
    return r;
  });
}

// Una habitación "tiene puerta" si alguna de sus celdas tiene un vecino
// (fuera del set de la habitación) conectado por un segmento de pared con
// door prop. Si la habitación no tiene puerta, está aislada.
export function computeRoomHasDoor(room: { cells: Cell[] }): boolean {
  if (!room.cells || room.cells.length === 0) return false;
  const cellSet = new Set(room.cells.map((c) => `${c.cx},${c.cy}`));
  for (const c of room.cells) {
    if (!cellSet.has(`${c.cx},${c.cy - 1}`) && getDoorOnWallN(c.cx, c.cy)) return true;
    if (!cellSet.has(`${c.cx},${c.cy + 1}`) && getDoorOnWallN(c.cx, c.cy + 1)) return true;
    if (!cellSet.has(`${c.cx - 1},${c.cy}`) && getDoorOnWallW(c.cx, c.cy)) return true;
    if (!cellSet.has(`${c.cx + 1},${c.cy}`) && getDoorOnWallW(c.cx + 1, c.cy)) return true;
  }
  return false;
}

// ── Props en cells ────────────────────────────────────────────────
// Devuelve los props ubicados en cualquiera de las celdas dadas. Excluye
// wall y door (estructura, no equipamiento).
export function propsInCells(cells: Cell[]): PropAny[] {
  if (!cells || cells.length === 0) return [];
  const cellSet = new Set(cells.map((c) => `${c.cx},${c.cy}`));
  const out: PropAny[] = [];
  for (const p of props) {
    const cat = (p['category'] as string | undefined) ?? 'floor';
    if (cat === 'wall' || cat === 'door') continue;
    const w = (p['w'] as number | undefined) ?? 1;
    const d = (p['d'] as number | undefined) ?? 1;
    const px = p['cx'] as number;
    const py = p['cy'] as number;
    let intersects = false;
    for (let dy = 0; dy < d && !intersects; dy++) {
      for (let dx = 0; dx < w && !intersects; dx++) {
        if (cellSet.has(`${px + dx},${py + dy}`)) intersects = true;
      }
    }
    if (intersects) out.push(p);
  }
  return out;
}

// ── Zonas abiertas ────────────────────────────────────────────────
export function getZones(): Zone[] {
  const raw = (worldGrid.zones as Zone[] | undefined) ?? [];
  return raw.map((z) => ({
    ...z,
    cells: z.cells.map((c) => ({ cx: c.cx, cy: c.cy })),
  }));
}

// Devuelve la PRIMERA zona (cerrada o abierta) que contiene la celda dada.
// Si la celda está en habitación cerrada Y zona abierta, prioriza la cerrada.
export function getZoneAt(cx: number, cy: number): ZoneAtResult | null {
  const rooms = getRooms();
  for (const r of rooms) {
    if (r.cells.some((c) => c.cx === cx && c.cy === cy)) {
      return { type: 'room', zone: r };
    }
  }
  const zones = getZones();
  for (const z of zones) {
    if (z.cells.some((c) => c.cx === cx && c.cy === cy)) {
      return { type: 'zone', zone: z };
    }
  }
  return null;
}

// ── Mutación de zonas abiertas ─────────────────────────────────────
// markWorldChanged viene vía callback porque vive en legacy hasta que se
// extraiga la persistencia full.

let _onZonesChanged: () => void = () => {};

export function setOnZonesChanged(cb: () => void): void {
  _onZonesChanged = cb;
}

export function createZone(): Zone {
  const zone: Zone = {
    id: uid(),
    name: '',
    kind: null,
    color: pickRoomColor(),
    cells: [],
  };
  if (!Array.isArray(worldGrid.zones)) worldGrid.zones = [];
  (worldGrid.zones as Zone[]).push(zone);
  eventBus.emit('zonesChanged', { reason: 'create', zoneId: zone.id });
  _onZonesChanged();
  return zone;
}

export function deleteZone(zoneId: string): void {
  if (!Array.isArray(worldGrid.zones)) return;
  const zones = worldGrid.zones as Zone[];
  const idx = zones.findIndex((z) => z.id === zoneId);
  if (idx === -1) return;
  zones.splice(idx, 1);
  eventBus.emit('zonesChanged', { reason: 'delete', zoneId });
  _onZonesChanged();
}

// Si presence=true y la celda está en otra zona, se transfiere (no hay
// solapamiento entre zonas).
export function setZoneCell(zoneId: string, cx: number, cy: number, presence: boolean): boolean {
  const zones = (worldGrid.zones as Zone[] | undefined) ?? [];
  const zone = zones.find((z) => z.id === zoneId);
  if (!zone) return false;
  const idx = zone.cells.findIndex((c) => c.cx === cx && c.cy === cy);
  if (presence) {
    if (idx !== -1) return false;
    // Quitar de otras zonas
    for (const other of zones) {
      if (other.id === zoneId) continue;
      const oIdx = other.cells.findIndex((c) => c.cx === cx && c.cy === cy);
      if (oIdx !== -1) other.cells.splice(oIdx, 1);
    }
    zone.cells.push({ cx, cy });
  } else {
    if (idx === -1) return false;
    zone.cells.splice(idx, 1);
  }
  eventBus.emit('zonesChanged', { reason: 'edit', zoneId });
  _onZonesChanged();
  return true;
}
