// Builders de geometría de paredes — uno por estilo × orientación.
// Cada helper construye la geometría de UNA celda (o run de celdas) de
// pared del estilo dado y la mete en la scene via scene-graph helpers.
//
// Llamados desde el bucle de buildScene() del legacy.

import * as THREE from 'three';
import {
  CELL,
  halfT,
  PALETTE,
  WIN_HALF_SILL_H,
  WIN_HALF_GLASS_H,
  DOOR_OPENING_H,
  centerX,
  centerZ,
} from './state';
import { worldGrid, type PropAny } from './world';
import { isCorner } from './wall-queries';
import { mkBox, makeGlassMesh } from './three-primitives';
import { makeDoorPanelMesh } from './door-panels';
import { addToScene, registerDoorPivot } from './scene-graph';

type FaceColor = { N?: number; S?: number; E?: number; W?: number };

function paintForWallN(cx: number, cy: number): FaceColor | null {
  const row = (worldGrid.wallNColors as FaceColor[][] | undefined)?.[cy];
  return (row && row[cx]) || null;
}

function paintForWallW(cx: number, cy: number): FaceColor | null {
  const row = (worldGrid.wallWColors as FaceColor[][] | undefined)?.[cy];
  return (row && row[cx]) || null;
}

function colorsWallN(paint: FaceColor | null) {
  return {
    top: PALETTE.wallN.top,
    right: PALETTE.wallN.right,
    left: PALETTE.wallN.left,
    // +Z = cara sur (visible desde cy). -Z = cara norte (visible desde cy-1).
    pzColor: paint && paint.S !== undefined ? paint.S : PALETTE.wallN.left,
    nzColor: paint && paint.N !== undefined ? paint.N : PALETTE.wallN.left,
  };
}

function colorsWallW(paint: FaceColor | null) {
  return {
    top: PALETTE.wallW.top,
    right: PALETTE.wallW.right,
    left: PALETTE.wallW.left,
    // +X = cara este (visible desde cx). -X = cara oeste (visible desde cx-1).
    pxColor: paint && paint.E !== undefined ? paint.E : PALETTE.wallW.right,
    nxColor: paint && paint.W !== undefined ? paint.W : PALETTE.wallW.right,
  };
}

// ── Solid walls ────────────────────────────────────────────────────
export function buildSolidWallN(cx: number, cy: number, h: number): void {
  const shrinkW = isCorner(cx, cy) ? halfT : 0;
  const shrinkE = isCorner(cx + 1, cy) ? halfT : 0;
  const xmin = cx * CELL + shrinkW;
  const xmax = (cx + 1) * CELL - shrinkE;
  const ymin = cy * CELL - halfT;
  const ymax = cy * CELL + halfT;
  const mesh = mkBox(xmin, ymin, 0, xmax, ymax, h, colorsWallN(paintForWallN(cx, cy)));
  if (mesh) {
    mesh.userData['wallFace'] = { type: 'wallN', cx, cy };
    addToScene(mesh);
  }
}

export function buildSolidWallW(cx: number, cy: number, h: number): void {
  const shrinkN = isCorner(cx, cy) ? halfT : 0;
  const shrinkS = isCorner(cx, cy + 1) ? halfT : 0;
  const xmin = cx * CELL - halfT;
  const xmax = cx * CELL + halfT;
  const ymin = cy * CELL + shrinkN;
  const ymax = (cy + 1) * CELL - shrinkS;
  const mesh = mkBox(xmin, ymin, 0, xmax, ymax, h, colorsWallW(paintForWallW(cx, cy)));
  if (mesh) {
    mesh.userData['wallFace'] = { type: 'wallW', cx, cy };
    addToScene(mesh);
  }
}

// ── Window halves (sill + glass + lintel) ──────────────────────────
// Soporta runs de celdas adyacentes para evitar solape de vidrios. Cada
// celda dentro del run sigue siendo pintable individualmente. Si la pared
// es muy baja (cutaway zócalo), cae a sólido normal por celda.
export function buildWindowHalfRunN(cx: number, endCx: number, cy: number, h: number): void {
  if (h < WIN_HALF_SILL_H + WIN_HALF_GLASS_H + 10) {
    for (let i = cx; i < endCx; i++) buildSolidWallN(i, cy, h);
    return;
  }
  const shrinkW = isCorner(cx, cy) ? halfT : 0;
  const shrinkE = isCorner(endCx, cy) ? halfT : 0;
  const xmin = cx * CELL + shrinkW;
  const xmax = endCx * CELL - shrinkE;
  const ymin = cy * CELL - halfT;
  const ymax = cy * CELL + halfT;
  for (let i = cx; i < endCx; i++) {
    const sw = i === cx ? shrinkW : 0;
    const se = i === endCx - 1 ? shrinkE : 0;
    const cellXmin = i * CELL + sw;
    const cellXmax = (i + 1) * CELL - se;
    const colors = colorsWallN(paintForWallN(i, cy));
    const sill = mkBox(cellXmin, ymin, 0, cellXmax, ymax, WIN_HALF_SILL_H, colors);
    if (sill) {
      sill.userData['wallFace'] = { type: 'wallN', cx: i, cy };
      addToScene(sill);
    }
    const lintel = mkBox(
      cellXmin, ymin, WIN_HALF_SILL_H + WIN_HALF_GLASS_H,
      cellXmax, ymax, h, colors,
    );
    if (lintel) {
      lintel.userData['wallFace'] = { type: 'wallN', cx: i, cy };
      addToScene(lintel);
    }
  }
  // Glass: una sola caja larga (esto es lo que evita el solape).
  const glass = mkBox(
    xmin, ymin, WIN_HALF_SILL_H,
    xmax, ymax, WIN_HALF_SILL_H + WIN_HALF_GLASS_H,
    PALETTE.glass,
  );
  if (glass) {
    makeGlassMesh(glass);
    glass.userData['wallFace'] = { type: 'wallN', cx, cy };
    glass.userData['isGlass'] = true;
    addToScene(glass);
  }
}

export function buildWindowHalfRunW(cx: number, cy: number, endCy: number, h: number): void {
  if (h < WIN_HALF_SILL_H + WIN_HALF_GLASS_H + 10) {
    for (let j = cy; j < endCy; j++) buildSolidWallW(cx, j, h);
    return;
  }
  const shrinkN = isCorner(cx, cy) ? halfT : 0;
  const shrinkS = isCorner(cx, endCy) ? halfT : 0;
  const xmin = cx * CELL - halfT;
  const xmax = cx * CELL + halfT;
  const ymin = cy * CELL + shrinkN;
  const ymax = endCy * CELL - shrinkS;
  for (let j = cy; j < endCy; j++) {
    const sn = j === cy ? shrinkN : 0;
    const ss = j === endCy - 1 ? shrinkS : 0;
    const cellYmin = j * CELL + sn;
    const cellYmax = (j + 1) * CELL - ss;
    const colors = colorsWallW(paintForWallW(cx, j));
    const sill = mkBox(xmin, cellYmin, 0, xmax, cellYmax, WIN_HALF_SILL_H, colors);
    if (sill) {
      sill.userData['wallFace'] = { type: 'wallW', cx, cy: j };
      addToScene(sill);
    }
    const lintel = mkBox(
      xmin, cellYmin, WIN_HALF_SILL_H + WIN_HALF_GLASS_H,
      xmax, cellYmax, h, colors,
    );
    if (lintel) {
      lintel.userData['wallFace'] = { type: 'wallW', cx, cy: j };
      addToScene(lintel);
    }
  }
  const glass = mkBox(
    xmin, ymin, WIN_HALF_SILL_H,
    xmax, ymax, WIN_HALF_SILL_H + WIN_HALF_GLASS_H,
    PALETTE.glass,
  );
  if (glass) {
    makeGlassMesh(glass);
    glass.userData['wallFace'] = { type: 'wallW', cx, cy };
    glass.userData['isGlass'] = true;
    addToScene(glass);
  }
}

// ── Door panels ────────────────────────────────────────────────────
export function addDoorPanelN(
  _cx: number, _cy: number,
  door: PropAny,
  xmin: number, xmax: number, ymin: number, ymax: number,
): void {
  const panelWidth = (xmax - xmin) - 4;
  const panelHeight = DOOR_OPENING_H - 4;
  const panel = makeDoorPanelMesh(panelWidth, panelHeight, door['kind'] as string, 'X');
  // Coords LOCALES del pivot. El pivot está en el borde xmin (bisagra),
  // plano zMid, y=0 (piso). El panel se extiende desde la bisagra hacia +X.
  panel.position.set(panelWidth / 2, panelHeight / 2, 0);
  panel.userData['prop'] = door;
  panel.userData['doorPanel'] = { propId: door['id'] };
  const pivot = new THREE.Object3D();
  const zMid = (ymin + ymax) / 2;
  pivot.position.set((xmin + 2) - centerX, 0, zMid - centerZ);
  pivot.add(panel);
  const openness = (door['openness'] as number) || 0;
  // side='N' → abre hacia -Z. side='S' → abre hacia +Z.
  const direction = door['side'] === 'N' ? -1 : 1;
  pivot.rotation.y = direction * openness * (Math.PI / 2);
  pivot.userData['doorPanel'] = { propId: door['id'] };
  pivot.userData['doorDirection'] = direction;
  addToScene(pivot);
  // raycast hits el panel; clearScene lo dispone también
  addToScene(panel);
  registerDoorPivot(door['id'] as string, pivot);
}

export function addDoorPanelW(
  _cx: number, _cy: number,
  door: PropAny,
  xmin: number, xmax: number, ymin: number, ymax: number,
): void {
  const panelLength = (ymax - ymin) - 4;
  const panelHeight = DOOR_OPENING_H - 4;
  const panel = makeDoorPanelMesh(panelLength, panelHeight, door['kind'] as string, 'Z');
  // Pivot en el borde ymin (bisagra norte), plano xMid, y=0. El panel se
  // extiende desde la bisagra hacia +Z.
  panel.position.set(0, panelHeight / 2, panelLength / 2);
  panel.userData['prop'] = door;
  panel.userData['doorPanel'] = { propId: door['id'] };
  const pivot = new THREE.Object3D();
  const xMid = (xmin + xmax) / 2;
  pivot.position.set(xMid - centerX, 0, (ymin + 2) - centerZ);
  pivot.add(panel);
  const openness = (door['openness'] as number) || 0;
  // side='W' → abre hacia -X. side='E' → abre hacia +X.
  const direction = door['side'] === 'W' ? -1 : 1;
  pivot.rotation.y = direction * openness * (Math.PI / 2);
  pivot.userData['doorPanel'] = { propId: door['id'] };
  pivot.userData['doorDirection'] = direction;
  addToScene(pivot);
  addToScene(panel);
  registerDoorPivot(door['id'] as string, pivot);
}

// ── Solid walls con door overlay ──────────────────────────────────
// Pared sólida con puerta encima: dintel arriba, abajo libre, panel
// rotatorio dentro del hueco.
export function buildSolidWallNWithDoor(
  cx: number, cy: number, h: number, doorProp: PropAny,
): void {
  if (h < DOOR_OPENING_H + 15) {
    // Cutaway zócalo: render como sólido (no hay espacio para puerta visual)
    buildSolidWallN(cx, cy, h);
    return;
  }
  const shrinkW = isCorner(cx, cy) ? halfT : 0;
  const shrinkE = isCorner(cx + 1, cy) ? halfT : 0;
  const xmin = cx * CELL + shrinkW;
  const xmax = (cx + 1) * CELL - shrinkE;
  const ymin = cy * CELL - halfT;
  const ymax = cy * CELL + halfT;
  const colors = colorsWallN(paintForWallN(cx, cy));
  const lintel = mkBox(xmin, ymin, DOOR_OPENING_H, xmax, ymax, h, colors);
  if (lintel) {
    lintel.userData['wallFace'] = { type: 'wallN', cx, cy };
    addToScene(lintel);
  }
  addDoorPanelN(cx, cy, doorProp, xmin, xmax, ymin, ymax);
}

export function buildSolidWallWWithDoor(
  cx: number, cy: number, h: number, doorProp: PropAny,
): void {
  if (h < DOOR_OPENING_H + 15) {
    buildSolidWallW(cx, cy, h);
    return;
  }
  const shrinkN = isCorner(cx, cy) ? halfT : 0;
  const shrinkS = isCorner(cx, cy + 1) ? halfT : 0;
  const xmin = cx * CELL - halfT;
  const xmax = cx * CELL + halfT;
  const ymin = cy * CELL + shrinkN;
  const ymax = (cy + 1) * CELL - shrinkS;
  const colors = colorsWallW(paintForWallW(cx, cy));
  const lintel = mkBox(xmin, ymin, DOOR_OPENING_H, xmax, ymax, h, colors);
  if (lintel) {
    lintel.userData['wallFace'] = { type: 'wallW', cx, cy };
    addToScene(lintel);
  }
  addDoorPanelW(cx, cy, doorProp, xmin, xmax, ymin, ymax);
}
