// Pintura de tiles del piso + caras de pared. Mutación pura sobre worldGrid
// + emit eventBus. NO toca scene — caller debe llamar buildScene() después
// (o renderizar incremental cuando se separe).
//
// `paintColor` viene vía getter callback. setFloorTileColor / setWallFaceColor
// usan el color actual al momento de la llamada. Si paintColor === null,
// borra el color de esa celda/cara (vuelve al default de la paleta).

import { GRID_W, GRID_H } from './state';
import { worldGrid } from './world';
import { eventBus } from './event-bus';
import { computeFloodFillFloor, computeFloodFillRoomFaces } from './rooms';

let _paintColorGetter: () => number | null = () => 0xc6bca2;

export function setPaintColorGetter(getter: () => number | null): void {
  _paintColorGetter = getter;
}

type WallSide = 'N' | 'S' | 'E' | 'W';
type FaceColor = Partial<Record<WallSide, number>>;

export function setFloorTileColor(cx: number, cy: number): void {
  if (cx < 0 || cx >= GRID_W || cy < 0 || cy >= GRID_H) return;
  if (!worldGrid.floorColors) return;
  const color = _paintColorGetter();
  worldGrid.floorColors[cy]![cx] = color;
  eventBus.emit('paintApplied', { kind: 'floor', cx, cy, color });
}

export function setWallFaceColor(
  type: 'wallN' | 'wallW',
  cx: number,
  cy: number,
  side: WallSide,
): void {
  const grid = type === 'wallN'
    ? (worldGrid.wallNColors as (FaceColor | null)[][] | undefined)
    : (worldGrid.wallWColors as (FaceColor | null)[][] | undefined);
  if (!grid) return;
  const row = grid[cy];
  if (!row) return;
  const color = _paintColorGetter();
  let entry = row[cx];
  if (color === null) {
    if (entry) {
      delete entry[side];
      if (Object.keys(entry).length === 0) row[cx] = null;
    }
  } else {
    if (!entry) {
      entry = {};
      row[cx] = entry;
    }
    entry[side] = color;
  }
  eventBus.emit('paintApplied', { kind: 'wall', type, cx, cy, side, color });
}

// ── Flood fill (Shift+click) ───────────────────────────────────────
// Aplica setFloorTileColor / setWallFaceColor en batch (sin render
// per-celda). El caller debe llamar buildScene() + markWorldChanged()
// después.

// Pinta todas las tiles alcanzables desde (startCx, startCy) sin atravesar
// paredes (= el conjunto de celdas de la habitación encerrada).
export function floodFillFloor(startCx: number, startCy: number): void {
  for (const c of computeFloodFillFloor(startCx, startCy)) {
    setFloorTileColor(c.cx, c.cy);
  }
}

// Flood fill de la habitación (set de celdas alcanzables desde la celda
// contigua a la cara clickeada), después pinta las caras de todas las
// paredes que la rodean. Efecto Sims: pintar una pared interior en una
// habitación cerrada pinta toda esa habitación; si está abierta, escapa.
export function floodFillRoomWalls(startCx: number, startCy: number): void {
  for (const f of computeFloodFillRoomFaces(startCx, startCy)) {
    setWallFaceColor(f.type, f.cx, f.cy, f.side);
  }
}
