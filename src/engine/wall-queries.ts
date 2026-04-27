// Queries puros sobre el grid de paredes y props door.
// Sin scene, sin DOM. Solo lee worldGrid + props.
//
// 3 niveles de bloqueo:
//   hasWallN/W       → hay segmento físico (incluye sólido, ventanal, ventanita).
//   blocksSpillN/W   → bloquea spill (flood fill pintura, auto-detección de
//                      habitaciones). Todo segmento físico bloquea, incluyendo
//                      paredes con puerta-prop encima (la puerta separa).
//   blocksPathN/W    → bloquea paso de agentes (pathfinding). Todo segmento
//                      físico EXCEPTO si tiene puerta-prop encima (los agentes
//                      pasan por puertas).

import {
  GRID_W,
  GRID_H,
  CELL,
  halfT,
  WALL_PROP_PAD,
  WALL_PROP_DEPTH,
} from './state';
import { worldGrid, props, type PropAny } from './world';

// ── Wall existence ─────────────────────────────────────────────────
export function hasWallN(cx: number, cy: number): boolean {
  if (cy < 0 || cy > GRID_H || cx < 0 || cx >= GRID_W) return false;
  return !!worldGrid.wallN[cy]?.[cx];
}

export function hasWallW(cx: number, cy: number): boolean {
  if (cx < 0 || cx > GRID_W || cy < 0 || cy >= GRID_H) return false;
  return !!worldGrid.wallW[cy]?.[cx];
}

// ── Door prop helpers ──────────────────────────────────────────────
// Las puertas son props con categoría 'door'. Una puerta ocupa AMBAS caras
// de un segmento de pared (no se permite cuadro+puerta en la misma cara).
//   door.side = 'N'|'S' → en wallN[cy][cx], abre hacia ese side.
//   door.side = 'W'|'E' → en wallW[cy][cx].
export function getDoorOnWallN(cx: number, cy: number): PropAny | null {
  for (const p of props) {
    if (p['category'] !== 'door') continue;
    if (p['cx'] !== cx || p['cy'] !== cy) continue;
    if (p['side'] === 'N' || p['side'] === 'S') return p;
  }
  return null;
}

export function getDoorOnWallW(cx: number, cy: number): PropAny | null {
  for (const p of props) {
    if (p['category'] !== 'door') continue;
    if (p['cx'] !== cx || p['cy'] !== cy) continue;
    if (p['side'] === 'W' || p['side'] === 'E') return p;
  }
  return null;
}

// ── Blocking queries ───────────────────────────────────────────────
export function blocksSpillN(cx: number, cy: number): boolean {
  return hasWallN(cx, cy);
}

export function blocksSpillW(cx: number, cy: number): boolean {
  return hasWallW(cx, cy);
}

export function blocksPathN(cx: number, cy: number): boolean {
  if (!hasWallN(cx, cy)) return false;
  if (getDoorOnWallN(cx, cy)) return false;
  return true;
}

export function blocksPathW(cx: number, cy: number): boolean {
  if (!hasWallW(cx, cy)) return false;
  if (getDoorOnWallW(cx, cy)) return false;
  return true;
}

// Aliases legacy: blocksWallN/W usaban el style 'door' viejo. Tras la
// migración v1→v2 no debería haber wallStyle === 'door', así que blocks*Path
// devuelve lo correcto. Mantengo nombres por compat de callers existentes.
export function blocksWallN(cx: number, cy: number): boolean {
  return blocksPathN(cx, cy);
}

export function blocksWallW(cx: number, cy: number): boolean {
  return blocksPathW(cx, cy);
}

// ── Corner detection ───────────────────────────────────────────────
// Un punto del grid es esquina si tiene al menos 1 wall N adyacente y
// 1 wall W adyacente. Posts visuales se renderizan en corners.
export function isCorner(cx: number, cy: number): boolean {
  let hasN = false;
  let hasW = false;
  if (cx > 0 && hasWallN(cx - 1, cy)) hasN = true;
  if (cx < GRID_W && hasWallN(cx, cy)) hasN = true;
  if (cy > 0 && hasWallW(cx, cy - 1)) hasW = true;
  if (cy < GRID_H && hasWallW(cx, cy)) hasW = true;
  return hasN && hasW;
}

// Verdadero si TODAS las paredes que llegan a este corner son ventanas.
// Se usa para renderizar el post como vidrio (o no renderizarlo) en esos
// casos, evitando una "viga" sólida en medio de un ventanal continuo.
export function isAllWindowCorner(cx: number, cy: number): boolean {
  let hasAny = false;
  let allWindow = true;
  const wallNStyle = worldGrid.wallNStyle as string[][] | undefined;
  const wallWStyle = worldGrid.wallWStyle as string[][] | undefined;
  if (cx > 0 && hasWallN(cx - 1, cy)) {
    hasAny = true;
    if (wallNStyle && wallNStyle[cy]?.[cx - 1] !== 'window') allWindow = false;
  }
  if (cx < GRID_W && hasWallN(cx, cy)) {
    hasAny = true;
    if (wallNStyle && wallNStyle[cy]?.[cx] !== 'window') allWindow = false;
  }
  if (cy > 0 && hasWallW(cx, cy - 1)) {
    hasAny = true;
    if (wallWStyle && wallWStyle[cy - 1]?.[cx] !== 'window') allWindow = false;
  }
  if (cy < GRID_H && hasWallW(cx, cy)) {
    hasAny = true;
    if (wallWStyle && wallWStyle[cy]?.[cx] !== 'window') allWindow = false;
  }
  return hasAny && allWindow;
}

// Dado un wallFace y side (cara), devuelve la celda adyacente del lado
// donde está la habitación que esa cara mira hacia. Usado por flood-fill
// de pintura: pintar la cara S de wallN[cy][cx] floodea el cuarto al sur
// (que es la celda (cx, cy)).
export function getAdjacentCell(
  _type: 'wallN' | 'wallW',
  cx: number,
  cy: number,
  side: 'N' | 'S' | 'E' | 'W',
): { cx: number; cy: number } {
  if (side === 'S') return { cx, cy };
  if (side === 'N') return { cx, cy: cy - 1 };
  if (side === 'E') return { cx, cy };
  // 'W'
  return { cx: cx - 1, cy };
}

// ── Wall prop slots ────────────────────────────────────────────────
// Devuelve todos los slots posibles para colgar wall props (cuadros).
// Por cada pared existente, hay HASTA 2 slots (una por cara).
//   side='N' = mira al norte (cuarto al norte)
//   side='S' = mira al sur (cuarto al sur)
//   side='W' = mira al oeste
//   side='E' = mira al este
export type WallSlot = {
  side: 'N' | 'S' | 'E' | 'W';
  cx: number;
  cy: number;
};

// Calcula el bounding box (xmin..xmax, ymin..ymax, zmin..zmax) de un wall
// prop (cuadro) según su side+cx+cy+zOffset+h. Devuelve null si side es
// inválido, así el caller puede skipearlo sin generar BoxGeometry con NaN.
export type WallPropBounds = {
  xmin: number; xmax: number;
  ymin: number; ymax: number;
  zmin: number; zmax: number;
};

export function getWallPropBounds(p: PropAny): WallPropBounds | null {
  const cx = p['cx'] as number;
  const cy = p['cy'] as number;
  let xmin: number, xmax: number, ymin: number, ymax: number;
  if (p['side'] === 'S') {
    xmin = cx * CELL + WALL_PROP_PAD;
    xmax = (cx + 1) * CELL - WALL_PROP_PAD;
    ymin = cy * CELL + halfT;
    ymax = ymin + WALL_PROP_DEPTH;
  } else if (p['side'] === 'N') {
    xmin = cx * CELL + WALL_PROP_PAD;
    xmax = (cx + 1) * CELL - WALL_PROP_PAD;
    ymax = cy * CELL - halfT;
    ymin = ymax - WALL_PROP_DEPTH;
  } else if (p['side'] === 'E') {
    xmin = cx * CELL + halfT;
    xmax = xmin + WALL_PROP_DEPTH;
    ymin = cy * CELL + WALL_PROP_PAD;
    ymax = (cy + 1) * CELL - WALL_PROP_PAD;
  } else if (p['side'] === 'W') {
    xmax = cx * CELL - halfT;
    xmin = xmax - WALL_PROP_DEPTH;
    ymin = cy * CELL + WALL_PROP_PAD;
    ymax = (cy + 1) * CELL - WALL_PROP_PAD;
  } else {
    return null;
  }
  const zOffsetRaw = p['zOffset'];
  const zOffset = typeof zOffsetRaw === 'number' && !isNaN(zOffsetRaw) ? zOffsetRaw : 50;
  const phRaw = p['h'];
  const ph = typeof phRaw === 'number' && !isNaN(phRaw) ? phRaw : 24;
  if (!isFinite(xmin) || !isFinite(xmax) || !isFinite(ymin) || !isFinite(ymax)) return null;
  return { xmin, xmax, ymin, ymax, zmin: zOffset, zmax: zOffset + ph };
}

export function getCandidateWallSlots(): WallSlot[] {
  const c: WallSlot[] = [];
  for (let cy = 0; cy <= GRID_H; cy++) {
    for (let cx = 0; cx < GRID_W; cx++) {
      if (!worldGrid.wallN[cy]?.[cx]) continue;
      if (cy > 0) c.push({ side: 'N', cx, cy });
      if (cy < GRID_H) c.push({ side: 'S', cx, cy });
    }
  }
  for (let cy = 0; cy < GRID_H; cy++) {
    for (let cx = 0; cx <= GRID_W; cx++) {
      if (!worldGrid.wallW[cy]?.[cx]) continue;
      if (cx > 0) c.push({ side: 'W', cx, cy });
      if (cx < GRID_W) c.push({ side: 'E', cx, cy });
    }
  }
  return c;
}
