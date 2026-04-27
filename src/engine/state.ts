// State + tipos centrales del mundo. Valores espejo del monolito.
// Slice 1.3: solo constantes inmutables. Mutables (worldGrid, props, agents)
// se extraen en slices siguientes cuando se parta legacy.ts por sección.

// ── Geometría del grid ──────────────────────────────────────────────
export const GRID_W = 6;
export const GRID_H = 6;
export const CELL = 70;

// Centrado del mundo en el origen three (derivadas)
export const centerX = (GRID_W * CELL) / 2;
export const centerZ = (GRID_H * CELL) / 2;

// ── Walls ──────────────────────────────────────────────────────────
export const WALL_THICK = 12;
export const halfT = WALL_THICK / 2;
export const WALL_H_UP = 110;
export const WALL_H_DOWN = 12;

// ── Puertas y ventanas ─────────────────────────────────────────────
// DOOR_OPENING_H: altura libre desde el piso por donde pasa el agente.
// El dintel arriba va de DOOR_OPENING_H a WALL_H.
export const DOOR_OPENING_H = 70;

// Ventana pequeña: bloque sólido abajo (sill), vidrio en el medio,
// bloque sólido arriba hasta WALL_H.
export const WIN_HALF_SILL_H = 30;
export const WIN_HALF_GLASS_H = 50;

// Door panel (caja vertical delgada del swing).
export const DOOR_PANEL_THICK = 4;

// Animación de apertura: openness se interpola hacia target con velocidad
// fija. 4.0 = full open en 0.25s.
export const DOOR_OPEN_SPEED = 4.0;
export const DOOR_DETECT_RADIUS = CELL * 1.0;

// ── Props padding ──────────────────────────────────────────────────
export const PROP_PAD = 6;
export const RUG_PAD = 4;
export const WALL_PROP_DEPTH = 4;
export const WALL_PROP_PAD = 14;

// ── Zonas ──────────────────────────────────────────────────────────
export const DEFAULT_MIN_CELLS_FOR_ZONES = 4;

// ── Paleta visual (números hex de Three.js) ────────────────────────
export type WallSidePalette = { top: number; right: number; left: number };

export const PALETTE = {
  bg: 0x2b2018,
  floor: 0xc6bca2,
  wallN: { top: 0xd4c090, right: 0xb89868, left: 0x988458 } as WallSidePalette,
  wallW: { top: 0xc8b482, right: 0xd4c090, left: 0xa89870 } as WallSidePalette,
  post: { top: 0xd4c090, right: 0xb29670, left: 0x9a8458 } as WallSidePalette,
  edge: 0x2a1810,
  glass: { top: 0xa8d0e0, right: 0xa8d0e0, left: 0xa8d0e0 } as WallSidePalette,
} as const;

// ── Tipos del mundo (para slices futuros) ──────────────────────────
export type WallStyle = 'solid' | 'window' | 'door';
export type WallMode = 'up' | 'down';

export type Cell = { cx: number; cy: number };

export type WorldGrid = {
  wallN: boolean[][];
  wallW: boolean[][];
  wallNStyle: WallStyle[][];
  wallWStyle: WallStyle[][];
  wallNColor: (number | null)[][];
  wallWColor: (number | null)[][];
  floorColor: (number | null)[][];
};

export type Prop = {
  id: string;
  type: string;
  cx: number;
  cy: number;
  rotation: number;
  category: string;
  w?: number;
  d?: number;
  h?: number;
  side?: 'N' | 'S' | 'E' | 'W';
  top?: number;
  meta?: Record<string, unknown>;
};
