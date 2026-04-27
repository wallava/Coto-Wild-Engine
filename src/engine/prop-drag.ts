// Drag de muebles: ghost wireframe verde/rojo que sigue al cursor mientras
// se mueve un prop seleccionado. Soporta floor/rug/stack (snap por celda),
// wall props (snap a cara N/S/W/E) y doors (snap a segmento de pared).
//
// State interno: prop arrastrado + ghost mesh + última celda/side. Otros
// módulos consultan via getters. Hooks de commit (cuando se suelta sobre
// celda válida) y cancel se inyectan en init.

import * as THREE from 'three';
import {
  CELL,
  halfT,
  centerX,
  centerZ,
  PROP_PAD,
  WALL_PROP_DEPTH,
  WALL_PROP_PAD,
  WALL_THICK,
  DOOR_OPENING_H,
} from './state';
import { getScene, setPropMeshOpacity } from './scene-graph';
import { canPlaceProp, getFloorStackBase, type PropAny } from './world';

const GHOST_VALID_COLOR = 0x80ff80;
const GHOST_INVALID_COLOR = 0xff6060;
const GHOST_OPACITY = 0.55;
const GHOST_RENDER_ORDER = 998;
const PROP_DRAG_OPACITY = 0.32;
const FLOOR_GHOST_LIFT = 12;
const STACK_DEFAULT_BASE_H = 28;

export type WallTarget = { cx: number; cy: number; side: 'N' | 'S' | 'W' | 'E' };
export type FloorTarget = { cx: number; cy: number };
export type DragTarget = WallTarget | FloorTarget | null;

type PropDragHooks = {
  onCommit: (prop: PropAny, target: WallTarget | FloorTarget) => void;
  onCancel: (prop: PropAny) => void;
};

let _hooks: PropDragHooks = {
  onCommit: () => {},
  onCancel: () => {},
};

let dragged: PropAny | null = null;
let ghost: THREE.Mesh | null = null;
let valid = false;
let originalCx = 0;
let originalCy = 0;
let originalW = 0;
let originalD = 0;
let originalSide: 'N' | 'S' | 'W' | 'E' | null = null;
let lastSide: 'N' | 'S' | 'W' | 'E' | null = null;
let lastCx = 0;
let lastCy = 0;

export function initPropDrag(hooks: PropDragHooks): void {
  _hooks = hooks;
}

export function isPropDragging(): boolean {
  return dragged !== null;
}

export function getDraggedProp(): PropAny | null {
  return dragged;
}

export function getPropDragGhost(): THREE.Mesh | null {
  return ghost;
}

export function getDragLastCx(): number { return lastCx; }
export function getDragLastCy(): number { return lastCy; }
export function getDragLastSide(): 'N' | 'S' | 'W' | 'E' | null { return lastSide; }
export function setDragLastSide(side: 'N' | 'S' | 'W' | 'E'): void { lastSide = side; }
export function getDragOriginalDims(): { w: number; d: number } { return { w: originalW, d: originalD }; }

function disposeGhost(): void {
  if (!ghost) return;
  const scene = getScene();
  if (scene) scene.remove(ghost);
  ghost.geometry.dispose();
  (ghost.material as THREE.Material).dispose();
  ghost = null;
}

function makeGhostMesh(gw: number, gh: number, gd: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(gw, gh, gd);
  const mat = new THREE.MeshBasicMaterial({
    color: GHOST_VALID_COLOR,
    transparent: true,
    opacity: GHOST_OPACITY,
    depthTest: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = GHOST_RENDER_ORDER;
  return m;
}

function ghostDimsForCategory(prop: PropAny, side: 'N' | 'S' | 'W' | 'E' | null): { gw: number; gh: number; gd: number } {
  const cat = (prop['category'] as string) || 'floor';
  const h = prop['h'] as number;
  if (cat === 'wall') {
    const isHorizontal = side === 'N' || side === 'S';
    const gw = isHorizontal ? CELL - WALL_PROP_PAD * 2 : WALL_PROP_DEPTH;
    const gd = isHorizontal ? WALL_PROP_DEPTH : CELL - WALL_PROP_PAD * 2;
    return { gw, gh: h, gd };
  }
  if (cat === 'door') {
    const isHorizontal = side === 'N' || side === 'S';
    const gw = isHorizontal ? CELL - 8 : WALL_THICK + 2;
    const gd = isHorizontal ? WALL_THICK + 2 : CELL - 8;
    return { gw, gh: DOOR_OPENING_H, gd };
  }
  if (cat === 'rug') {
    return { gw: (prop['w'] as number) * CELL - 8, gh: h, gd: (prop['d'] as number) * CELL - 8 };
  }
  return {
    gw: (prop['w'] as number) * CELL - PROP_PAD * 2,
    gh: h,
    gd: (prop['d'] as number) * CELL - PROP_PAD * 2,
  };
}

export function startPropDrag(prop: PropAny): void {
  dragged = prop;
  const cat = (prop['category'] as string) || 'floor';
  originalCx = prop['cx'] as number;
  originalCy = prop['cy'] as number;
  if (cat === 'wall' || cat === 'door') {
    originalSide = prop['side'] as 'N' | 'S' | 'W' | 'E';
    lastSide = originalSide;
  } else {
    originalW = prop['w'] as number;
    originalD = prop['d'] as number;
  }
  lastCx = originalCx;
  lastCy = originalCy;
  setPropMeshOpacity(prop, PROP_DRAG_OPACITY);
  const dims = ghostDimsForCategory(prop, lastSide);
  ghost = makeGhostMesh(dims.gw, dims.gh, dims.gd);
  const scene = getScene();
  if (scene) scene.add(ghost);
  if (cat === 'wall' || cat === 'door') {
    updatePropDragGhost(originalCx, originalCy, originalSide!);
  } else {
    updatePropDragGhost(originalCx, originalCy);
  }
}

function recreateGhostIfOrientChanged(
  newSide: 'N' | 'S' | 'W' | 'E',
  buildDims: () => { gw: number; gh: number; gd: number },
): void {
  const newOrient = newSide === 'N' || newSide === 'S' ? 'h' : 'v';
  const oldOrient = lastSide === 'N' || lastSide === 'S' ? 'h' : 'v';
  if (newOrient === oldOrient) return;
  disposeGhost();
  const d = buildDims();
  ghost = makeGhostMesh(d.gw, d.gh, d.gd);
  const scene = getScene();
  if (scene) scene.add(ghost);
}

export function updatePropDragGhost(cx: number, cy: number, side?: 'N' | 'S' | 'W' | 'E'): void {
  if (!ghost || !dragged) return;
  const cat = (dragged['category'] as string) || 'floor';
  lastCx = cx;
  lastCy = cy;
  if (cat === 'wall' && side) {
    recreateGhostIfOrientChanged(side, () => ghostDimsForCategory(dragged!, side));
    lastSide = side;
    valid = canPlaceProp({ ...dragged, side, cx, cy }, cx, cy);
    (ghost.material as THREE.MeshBasicMaterial).color.setHex(valid ? GHOST_VALID_COLOR : GHOST_INVALID_COLOR);
    let gx: number, gz: number;
    if (side === 'N') {
      gx = (cx + 0.5) * CELL;
      gz = cy * CELL + halfT + WALL_PROP_DEPTH / 2;
    } else if (side === 'S') {
      gx = (cx + 0.5) * CELL;
      gz = cy * CELL - halfT - WALL_PROP_DEPTH / 2;
    } else if (side === 'W') {
      gx = cx * CELL + halfT + WALL_PROP_DEPTH / 2;
      gz = (cy + 0.5) * CELL;
    } else {
      gx = cx * CELL - halfT - WALL_PROP_DEPTH / 2;
      gz = (cy + 0.5) * CELL;
    }
    const gy = (dragged['zOffset'] as number) + (dragged['h'] as number) / 2;
    ghost.position.set(gx - centerX, gy, gz - centerZ);
    return;
  }
  if (cat === 'door' && side) {
    recreateGhostIfOrientChanged(side, () => ghostDimsForCategory(dragged!, side));
    lastSide = side;
    valid = canPlaceProp({ ...dragged, side, cx, cy }, cx, cy);
    (ghost.material as THREE.MeshBasicMaterial).color.setHex(valid ? GHOST_VALID_COLOR : GHOST_INVALID_COLOR);
    let gx: number, gz: number;
    if (side === 'N' || side === 'S') {
      gx = (cx + 0.5) * CELL;
      gz = cy * CELL;
    } else {
      gx = cx * CELL;
      gz = (cy + 0.5) * CELL;
    }
    const gy = DOOR_OPENING_H / 2;
    ghost.position.set(gx - centerX, gy, gz - centerZ);
    return;
  }
  // floor / rug / stack
  valid = canPlaceProp(dragged, cx, cy);
  (ghost.material as THREE.MeshBasicMaterial).color.setHex(valid ? GHOST_VALID_COLOR : GHOST_INVALID_COLOR);
  let baseY: number;
  if (cat === 'stack') {
    const base = getFloorStackBase(cx, cy);
    baseY = (base ? (base['h'] as number) : STACK_DEFAULT_BASE_H) + (dragged['h'] as number) / 2;
  } else {
    baseY = (dragged['h'] as number) / 2 + FLOOR_GHOST_LIFT;
  }
  ghost.position.set(
    (cx + (dragged['w'] as number) / 2) * CELL - centerX,
    baseY,
    (cy + (dragged['d'] as number) / 2) * CELL - centerZ,
  );
}

// Recrea el ghost completo (después de rotar floor/rug). Mantiene la celda
// actual (lastCx/lastCy). Usado por rotateProp cuando el agente está dragging.
export function rebuildGhostForCurrentProp(): void {
  if (!dragged) return;
  disposeGhost();
  const dims = ghostDimsForCategory(dragged, lastSide);
  ghost = makeGhostMesh(dims.gw, dims.gh, dims.gd);
  const scene = getScene();
  if (scene) scene.add(ghost);
  updatePropDragGhost(lastCx, lastCy);
}

export function endPropDrag(target: WallTarget | FloorTarget | null): void {
  if (!dragged) return;
  const prop = dragged;
  const cat = (prop['category'] as string) || 'floor';
  const applied = !!(target && valid);
  if (applied) {
    dragged = null;
    _hooks.onCommit(prop, target!);
  } else {
    if (cat !== 'wall' && cat !== 'door') {
      if (prop['w'] !== originalW || prop['d'] !== originalD) {
        prop['w'] = originalW;
        prop['d'] = originalD;
      }
    }
    setPropMeshOpacity(prop, 1.0);
    dragged = null;
    _hooks.onCancel(prop);
  }
  disposeGhost();
  valid = false;
}
