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

import { GRID_W, GRID_H } from './state';
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
