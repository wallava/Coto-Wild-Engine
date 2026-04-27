// Estado mutable del mundo: grid de paredes/colores + lista de props.
// Singletons compartidos por toda la app via import.
//
// Tipos permisivos por ahora (slice 1.4c) — los esquemas estrictos
// llegarán en slice de Zod (Fase 3 del roadmap).

import { uid } from '../utils/id';
import { eventBus } from './event-bus';
import { GRID_W, GRID_H } from './state';

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

// ── Helpers de creación de grids ──────────────────────────────────
export function makeDefaultStyleGrid(rows: number, cols: number): WallStyle[][] {
  return [...Array(rows)].map(() => Array(cols).fill('solid' as WallStyle));
}

export function makeNullColorGrid(rows: number, cols: number): (number | null)[][] {
  return [...Array(rows)].map(() => Array(cols).fill(null));
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
