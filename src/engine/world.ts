// Estado mutable del mundo: grid de paredes/colores + lista de props.
// Singletons compartidos por toda la app via import.
//
// Tipos permisivos por ahora (slice 1.4c) — los esquemas estrictos
// llegarán en slice de Zod (Fase 3 del roadmap).

import { uid } from '../utils/id';
import { eventBus } from './event-bus';
import { GRID_W, GRID_H } from './state';
import { hasWallN, hasWallW, getDoorOnWallN, getDoorOnWallW } from './wall-queries';
import { isAgentAt } from './agents-state';

export type WallStyle = 'solid' | 'window' | 'door';

// Forma del grid. Campos opcionales = se asignan en applyWorld.
export type WorldGridShape = {
  wallN: boolean[][];
  wallW: boolean[][];
  wallNStyle?: WallStyle[][];
  wallWStyle?: WallStyle[][];
  // Pintura: null por celda = "usar paleta default"
  floorColors?: (number | null)[][];
  wallNColors?: unknown[][];
  wallWColors?: unknown[][];
  // Habitaciones cerradas (metadata) y zonas abiertas (cells manuales)
  roomMeta?: unknown[];
  zones?: unknown[];
};

export const worldGrid: WorldGridShape = {
  wallN: [],
  wallW: [],
};

// Cada prop es un objeto ad-hoc con shape variable según category. Tipado
// estricto se difiere a fase de schemas.
export type PropAny = Record<string, unknown> & { id?: string };

export const props: PropAny[] = [];

// ── Wrappers de mutación de props ─────────────────────────────────
// Centralizan asignación de ID y emisión de eventos. Usar SIEMPRE estos en
// vez de props.push / props.splice directos, salvo en bulk loaders
// (applyWorld) o cleanup pre-render (migrateLoadedProps) donde emitir prop
// por prop generaría ruido.
export function pushProp(propData: PropAny): PropAny {
  const p: PropAny = { ...propData };
  if (!p.id) p.id = uid();
  props.push(p);
  eventBus.emit('propPlaced', { prop: p });
  return p;
}

export function removePropAt(idx: number): PropAny | null {
  if (idx < 0 || idx >= props.length) return null;
  const [removed] = props.splice(idx, 1);
  eventBus.emit('propDeleted', { prop: removed });
  return removed ?? null;
}

export function removePropRef(prop: PropAny): PropAny | null {
  const idx = props.indexOf(prop);
  if (idx === -1) return null;
  return removePropAt(idx);
}

// Devuelve el primer prop que ocupa la celda (cx, cy). Considera w/d para
// muebles multi-celda. null si la celda está libre de props.
export function findPropAt(cx: number, cy: number): PropAny | null {
  for (const p of props) {
    const px = p['cx'] as number;
    const py = p['cy'] as number;
    const w = (p['w'] as number) ?? 1;
    const d = (p['d'] as number) ?? 1;
    if (cx >= px && cx < px + w && cy >= py && cy < py + d) return p;
  }
  return null;
}

// Si la celda (cx, cy) está cubierta por un floor prop stackable, devuelve
// ese prop. Sirve para saber a qué altura posar un objeto stack y para
// validar que la celda admite stacks.
export function getFloorStackBase(cx: number, cy: number): PropAny | null {
  for (const other of props) {
    const cat = (other['category'] as string) || 'floor';
    if (cat !== 'floor') continue;
    if (!other['stackable']) continue;
    const ox = other['cx'] as number;
    const oy = other['cy'] as number;
    const w = (other['w'] as number) ?? 1;
    const d = (other['d'] as number) ?? 1;
    if (cx >= ox && cx < ox + w && cy >= oy && cy < oy + d) {
      return other;
    }
  }
  return null;
}

// ¿Se puede colocar el prop en (newCx, newCy)? Reglas según category:
//   - stack: requiere floor.stackable abajo + 1 stack por celda max.
//   - wall (cuadro): pared existe + cara con cuarto del lado correspondiente
//     + no coexiste con puerta + no otro cuadro en misma cara exacta.
//   - door: pared sólida (no ventana) + no coexiste con cuadros ni otra puerta.
//   - floor/rug: dentro de grid + no overlap mismas categorías + (floor) no
//     pisa agentes + multi-cell no atraviesa pared interior.
export function canPlaceProp(prop: PropAny, newCx: number, newCy: number): boolean {
  const cat = (prop['category'] as string) || 'floor';

  if (cat === 'stack') {
    if (newCx < 0 || newCx >= GRID_W || newCy < 0 || newCy >= GRID_H) return false;
    if (!getFloorStackBase(newCx, newCy)) return false;
    for (const p of props) {
      if (p === prop) continue;
      if (((p['category'] as string) || 'floor') !== 'stack') continue;
      if (p['cx'] === newCx && p['cy'] === newCy) return false;
    }
    return true;
  }

  if (cat === 'wall') {
    const s = prop['side'];
    if (s === 'N' || s === 'S') {
      if (newCx < 0 || newCx >= GRID_W) return false;
      if (newCy < 0 || newCy > GRID_H) return false;
      if (!hasWallN(newCx, newCy)) return false;
      if (s === 'N' && newCy <= 0) return false;
      if (s === 'S' && newCy >= GRID_H) return false;
      if (getDoorOnWallN(newCx, newCy)) return false;
    } else if (s === 'E' || s === 'W') {
      if (newCx < 0 || newCx > GRID_W) return false;
      if (newCy < 0 || newCy >= GRID_H) return false;
      if (!hasWallW(newCx, newCy)) return false;
      if (s === 'W' && newCx <= 0) return false;
      if (s === 'E' && newCx >= GRID_W) return false;
      if (getDoorOnWallW(newCx, newCy)) return false;
    } else {
      return false;
    }
    for (const p of props) {
      if (p === prop) continue;
      if (((p['category'] as string) || 'floor') !== 'wall') continue;
      if (p['side'] === prop['side'] && p['cx'] === newCx && p['cy'] === newCy) return false;
    }
    return true;
  }

  if (cat === 'door') {
    const s = prop['side'];
    if (s === 'N' || s === 'S') {
      if (newCx < 0 || newCx >= GRID_W) return false;
      if (newCy < 0 || newCy > GRID_H) return false;
      if (!hasWallN(newCx, newCy)) return false;
      const wallNStyle = worldGrid.wallNStyle as string[][] | undefined;
      if (wallNStyle && wallNStyle[newCy]?.[newCx] !== 'solid') return false;
      for (const p of props) {
        if (p === prop) continue;
        const pcat = (p['category'] as string) || 'floor';
        if ((pcat === 'wall' || pcat === 'door')
            && p['cx'] === newCx && p['cy'] === newCy
            && (p['side'] === 'N' || p['side'] === 'S')) return false;
      }
    } else if (s === 'E' || s === 'W') {
      if (newCx < 0 || newCx > GRID_W) return false;
      if (newCy < 0 || newCy >= GRID_H) return false;
      if (!hasWallW(newCx, newCy)) return false;
      const wallWStyle = worldGrid.wallWStyle as string[][] | undefined;
      if (wallWStyle && wallWStyle[newCy]?.[newCx] !== 'solid') return false;
      for (const p of props) {
        if (p === prop) continue;
        const pcat = (p['category'] as string) || 'floor';
        if ((pcat === 'wall' || pcat === 'door')
            && p['cx'] === newCx && p['cy'] === newCy
            && (p['side'] === 'W' || p['side'] === 'E')) return false;
      }
    } else {
      return false;
    }
    return true;
  }

  // floor / rug
  const pw = (prop['w'] as number) ?? 1;
  const pd = (prop['d'] as number) ?? 1;
  if (newCx < 0 || newCy < 0) return false;
  if (newCx + pw > GRID_W || newCy + pd > GRID_H) return false;
  for (const p of props) {
    if (p === prop) continue;
    const pcat = (p['category'] as string) || 'floor';
    if (pcat !== cat) continue;
    const px = p['cx'] as number;
    const py = p['cy'] as number;
    const opw = (p['w'] as number) ?? 1;
    const opd = (p['d'] as number) ?? 1;
    if (newCx < px + opw && newCx + pw > px &&
        newCy < py + opd && newCy + pd > py) return false;
  }
  if (cat === 'floor') {
    for (let dy = 0; dy < pd; dy++) {
      for (let dx = 0; dx < pw; dx++) {
        if (isAgentAt(newCx + dx, newCy + dy)) return false;
      }
    }
  }
  if (pw === 2 && hasWallW(newCx + 1, newCy)) return false;
  if (pd === 2 && hasWallN(newCx, newCy + 1)) return false;
  return true;
}

// Devuelve los stack props que están encima del floor stackable dado, cada
// uno con su offset relativo (dx, dy) para mover juntos manteniendo posición.
export type StackedProp = { prop: PropAny; dx: number; dy: number };

export function getStacksOnFloor(floorProp: PropAny | null): StackedProp[] {
  const out: StackedProp[] = [];
  if (!floorProp || ((floorProp['category'] as string) || 'floor') !== 'floor') return out;
  if (!floorProp['stackable']) return out;
  const fx = floorProp['cx'] as number;
  const fy = floorProp['cy'] as number;
  const w = (floorProp['w'] as number) ?? 1;
  const d = (floorProp['d'] as number) ?? 1;
  for (const p of props) {
    if (((p['category'] as string) || 'floor') !== 'stack') continue;
    const px = p['cx'] as number;
    const py = p['cy'] as number;
    if (px >= fx && px < fx + w && py >= fy && py < fy + d) {
      out.push({ prop: p, dx: px - fx, dy: py - fy });
    }
  }
  return out;
}

// ── Helpers de creación de grids ──────────────────────────────────
export function makeDefaultStyleGrid(rows: number, cols: number): WallStyle[][] {
  return [...Array(rows)].map(() => Array(cols).fill('solid' as WallStyle));
}

export function makeNullColorGrid(rows: number, cols: number): (number | null)[][] {
  return [...Array(rows)].map(() => Array(cols).fill(null));
}

// Carga datos persistidos al worldGrid + props singleton. Mutaciones bulk
// (sin emitir prop por prop). NO toca agents NI emite worldLoaded — eso lo
// hace el caller, que también restaura agents y dispara el evento.
//
// `pickColor` se pasa por callback para evitar ciclo con engine/rooms (pickRoomColor
// vive ahí y rooms importa de world.ts).
export type WorldLoadInput = {
  wallN: boolean[][];
  wallW: boolean[][];
  wallNStyle?: WallStyle[][];
  wallWStyle?: WallStyle[][];
  floorColors?: (number | null)[][];
  wallNColors?: (number | null)[][];
  wallWColors?: (number | null)[][];
  roomMeta?: Array<Record<string, unknown>>;
  rooms?: Array<Record<string, unknown>>;
  zones?: Array<Record<string, unknown>>;
  props: Array<Record<string, unknown>>;
};

export function loadWorldData(
  w: WorldLoadInput,
  pickColor: () => number,
): void {
  worldGrid.wallN = w.wallN;
  worldGrid.wallW = w.wallW;
  worldGrid.wallNStyle = w.wallNStyle ?? makeDefaultStyleGrid(GRID_H + 1, GRID_W);
  worldGrid.wallWStyle = w.wallWStyle ?? makeDefaultStyleGrid(GRID_H, GRID_W + 1);
  worldGrid.floorColors = w.floorColors ?? makeNullColorGrid(GRID_H, GRID_W);
  worldGrid.wallNColors = w.wallNColors ?? makeNullColorGrid(GRID_H + 1, GRID_W);
  worldGrid.wallWColors = w.wallWColors ?? makeNullColorGrid(GRID_H, GRID_W + 1);
  // roomMeta: forma actual (post v1.06) o migración de `rooms` v1.06
  if (Array.isArray(w.roomMeta)) {
    worldGrid.roomMeta = w.roomMeta.map((m) => ({ ...m }));
  } else if (Array.isArray(w.rooms)) {
    worldGrid.roomMeta = w.rooms
      .filter((r) => r['source'] !== 'manual' && Array.isArray(r['cells']) && (r['cells'] as unknown[]).length > 0)
      .map((r) => {
        const cells = r['cells'] as Array<{ cx: number; cy: number }>;
        let anchor = cells[0]!;
        for (const c of cells) {
          if (c.cy < anchor.cy || (c.cy === anchor.cy && c.cx < anchor.cx)) anchor = c;
        }
        return {
          id: r['id'],
          name: r['name'] || '',
          kind: r['kind'] || null,
          color: typeof r['color'] === 'number' ? r['color'] : pickColor(),
          anchorCx: anchor.cx,
          anchorCy: anchor.cy,
        };
      });
  } else {
    worldGrid.roomMeta = [];
  }
  // zones: forma actual o migración desde `rooms` con source='manual'
  if (Array.isArray(w.zones)) {
    worldGrid.zones = w.zones.map((z) => ({
      ...z,
      cells: ((z['cells'] as Array<{ cx: number; cy: number }>) ?? []).map((c) => ({ cx: c.cx, cy: c.cy })),
    }));
  } else if (Array.isArray(w.rooms)) {
    worldGrid.zones = w.rooms
      .filter((r) => r['source'] === 'manual')
      .map((r) => ({
        id: r['id'],
        name: r['name'] || '',
        kind: r['kind'] || null,
        color: typeof r['color'] === 'number' ? r['color'] : pickColor(),
        cells: ((r['cells'] as Array<{ cx: number; cy: number }>) ?? []).map((c) => ({ cx: c.cx, cy: c.cy })),
      }));
  } else {
    worldGrid.zones = [];
  }
  props.length = 0;
  for (const p of w.props) {
    const cp: PropAny = { ...p };
    if (!cp['id']) cp['id'] = uid();
    props.push(cp);
  }
}

// ── Mundo por defecto ─────────────────────────────────────────────
// Layout inicial: 6×6 con muros exteriores, división horizontal en cy=3
// (hueco en cx=2) y vertical en cx=3 (hueco en cy=1). Props demo distribuidos.
export function defaultWorld(): {
  wallN: boolean[][];
  wallW: boolean[][];
  wallNStyle: WallStyle[][];
  wallWStyle: WallStyle[][];
  floorColors: (number | null)[][];
  wallNColors: (number | null)[][];
  wallWColors: (number | null)[][];
  props: PropAny[];
} {
  const wallN = [...Array(GRID_H + 1)].map(() => Array(GRID_W).fill(false));
  const wallW = [...Array(GRID_H)].map(() => Array(GRID_W + 1).fill(false));
  const wallNStyle = makeDefaultStyleGrid(GRID_H + 1, GRID_W);
  const wallWStyle = makeDefaultStyleGrid(GRID_H, GRID_W + 1);
  // exteriores
  for (let x = 0; x < GRID_W; x++) wallN[0]![x] = true;
  for (let x = 0; x < GRID_W; x++) wallN[GRID_H]![x] = true;
  for (let y = 0; y < GRID_H; y++) wallW[y]![0] = true;
  for (let y = 0; y < GRID_H; y++) wallW[y]![GRID_W] = true;
  // interior horizontal cy=3 con hueco en cx=2
  for (let x = 0; x < GRID_W; x++) {
    if (x === 2) continue;
    wallN[3]![x] = true;
  }
  // interior vertical cx=3 con hueco en cy=1
  for (let y = 0; y < GRID_H; y++) {
    if (y === 1) continue;
    wallW[y]![3] = true;
  }
  const initProps: PropAny[] = [
    { cx: 5, cy: 2, w: 1, d: 1, h: 60, category: 'floor', top: 0x705030, right: 0x503010, left: 0x301000 },
    { cx: 1, cy: 4, w: 2, d: 1, h: 28, category: 'floor', stackable: true, top: 0x705030, right: 0x503010, left: 0x301000 },
    { cx: 4, cy: 1, w: 2, d: 1, h: 28, category: 'floor', stackable: true, top: 0x705030, right: 0x503010, left: 0x301000 },
    { cx: 3, cy: 5, w: 2, d: 1, h: 24, category: 'floor', top: 0xa84838, right: 0x782818, left: 0x481008 },
    { cx: 2, cy: 1, w: 1, d: 1, h: 16, category: 'floor', stackable: true, top: 0x4878a0, right: 0x285878, left: 0x183858 },
    { cx: 0, cy: 5, w: 1, d: 1, h: 12, category: 'floor', top: 0xa89070, right: 0x787050, left: 0x584030 },
    // Demo stack: laptop sobre la mesa larga superior
    { cx: 4, cy: 1, w: 1, d: 1, h: 4, category: 'stack', top: 0x404448, right: 0x282c30, left: 0x181c20 },
  ];
  return {
    wallN,
    wallW,
    wallNStyle,
    wallWStyle,
    floorColors: makeNullColorGrid(GRID_H, GRID_W),
    wallNColors: makeNullColorGrid(GRID_H + 1, GRID_W),
    wallWColors: makeNullColorGrid(GRID_H, GRID_W + 1),
    props: initProps,
  };
}
