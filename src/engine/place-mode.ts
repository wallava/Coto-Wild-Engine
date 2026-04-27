// Modo "colocar mueble del catálogo": ghost wireframe que sigue al cursor
// según el tipo (floor → snap a celda, wall → snap a cara N/S/W/E,
// door → snap a segmento de pared con flecha de apertura). R rota,
// Esc cancela, click izq aplica.
//
// State interno: el módulo es la fuente de verdad. Hooks en init() para
// banner DOM (legacy) + post-place effects (agents.path reset + buildScene).

import * as THREE from 'three';
import {
  CELL,
  halfT,
  centerX,
  centerZ,
  PROP_PAD,
  WALL_THICK,
  DOOR_OPENING_H,
} from './state';
import { getScene } from './scene-graph';
import {
  canPlaceProp,
  getFloorStackBase,
  pushProp,
  props,
  type PropAny,
} from './world';
import {
  getCellFromEvent,
  getWorldPointFromEvent,
} from './raycaster';
import {
  findNearestPlaceableWallFace,
  findNearestWallSegment,
  getCandidateWallSlots,
} from './wall-queries';
import { markWorldChanged } from './persistence';

const GHOST_VALID_COLOR = 0x80ff80;
const GHOST_INVALID_COLOR = 0xff6060;
const GHOST_OPACITY = 0.55;
const GHOST_RENDER_ORDER = 998;
const ARROW_RENDER_ORDER = 999;
const ARROW_COLOR = 0xffd060;
const ARROW_OPACITY = 0.85;
const ARROW_DIST = 24;
const ARROW_RADIUS = 7;
const ARROW_HEIGHT = 18;
const ARROW_Y_OFFSET = 8;
const FLOOR_GHOST_LIFT = 6;
const STACK_DEFAULT_BASE_H = 28;
const WALL_GHOST_INSET = 28;
const WALL_GHOST_DEPTH = 4;
const WALL_GHOST_GAP = 2;

type PlaceModeHooks = {
  onPlaced: (prop: PropAny) => void;
  onShowBanner: (name: string) => void;
  onHideBanner: () => void;
};

let _hooks: PlaceModeHooks = {
  onPlaced: () => {},
  onShowBanner: () => {},
  onHideBanner: () => {},
};

let active = false;
let template: PropAny | null = null;
let ghost: THREE.Mesh | null = null;
let arrow: THREE.Mesh | null = null;
let valid = false;
let cellCx = 0;
let cellCy = 0;
let side: 'N' | 'S' | 'W' | 'E' = 'N';

export function initPlaceMode(hooks: PlaceModeHooks): void {
  _hooks = hooks;
}

export function isPlaceModeActive(): boolean {
  return active;
}

function disposeGhost(): void {
  if (!ghost) return;
  const scene = getScene();
  if (scene) scene.remove(ghost);
  ghost.geometry.dispose();
  (ghost.material as THREE.Material).dispose();
  ghost = null;
}

function clearDoorArrow(): void {
  if (!arrow) return;
  const scene = getScene();
  if (scene) scene.remove(arrow);
  arrow.traverse((o) => {
    const obj = o as THREE.Mesh;
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) (obj.material as THREE.Material).dispose();
  });
  arrow = null;
}

function updateDoorArrow(): void {
  clearDoorArrow();
  if (!active || !template || (template['category'] as string || 'floor') !== 'door') return;
  if (!ghost) return;
  const cone = new THREE.ConeGeometry(ARROW_RADIUS, ARROW_HEIGHT, 4);
  if (side === 'S') cone.rotateX(Math.PI / 2);
  else if (side === 'N') cone.rotateX(-Math.PI / 2);
  else if (side === 'E') cone.rotateZ(-Math.PI / 2);
  else if (side === 'W') cone.rotateZ(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: ARROW_COLOR,
    transparent: true,
    opacity: ARROW_OPACITY,
    depthTest: false,
  });
  arrow = new THREE.Mesh(cone, mat);
  arrow.renderOrder = ARROW_RENDER_ORDER;
  let dx = 0;
  let dz = 0;
  if (side === 'N') dz = -1;
  else if (side === 'S') dz = 1;
  else if (side === 'W') dx = -1;
  else if (side === 'E') dx = 1;
  const gp = ghost.position;
  arrow.position.set(gp.x + dx * ARROW_DIST, gp.y + ARROW_Y_OFFSET, gp.z + dz * ARROW_DIST);
  const scene = getScene();
  if (scene) scene.add(arrow);
}

function ghostDimsForTemplate(): { gw: number; gh: number; gd: number } {
  const t = template!;
  const cat = (t['category'] as string) || 'floor';
  const h = t['h'] as number;
  if (cat === 'wall') {
    const isHoriz = side === 'N' || side === 'S';
    const gw = isHoriz ? CELL - WALL_GHOST_INSET : WALL_GHOST_DEPTH;
    const gd = isHoriz ? WALL_GHOST_DEPTH : CELL - WALL_GHOST_INSET;
    return { gw, gh: h, gd };
  }
  if (cat === 'door') {
    const isHoriz = side === 'N' || side === 'S';
    const gw = isHoriz ? CELL - 8 : WALL_THICK + 2;
    const gd = isHoriz ? WALL_THICK + 2 : CELL - 8;
    return { gw, gh: DOOR_OPENING_H, gd };
  }
  if (cat === 'rug') {
    return { gw: (t['w'] as number) * CELL - 8, gh: h, gd: (t['d'] as number) * CELL - 8 };
  }
  if (cat === 'stack') {
    return { gw: CELL - WALL_GHOST_INSET, gh: h, gd: CELL - WALL_GHOST_INSET };
  }
  return {
    gw: (t['w'] as number) * CELL - PROP_PAD * 2,
    gh: h,
    gd: (t['d'] as number) * CELL - PROP_PAD * 2,
  };
}

export function rebuildPlaceGhost(): void {
  disposeGhost();
  if (!template) return;
  const dims = ghostDimsForTemplate();
  const geo = new THREE.BoxGeometry(dims.gw, dims.gh, dims.gd);
  const mat = new THREE.MeshBasicMaterial({
    color: GHOST_VALID_COLOR,
    transparent: true,
    opacity: GHOST_OPACITY,
    depthTest: false,
  });
  ghost = new THREE.Mesh(geo, mat);
  ghost.renderOrder = GHOST_RENDER_ORDER;
  const scene = getScene();
  if (scene) scene.add(ghost);
}

export function enterPlaceMode(tmpl: PropAny): void {
  exitPlaceMode();
  active = true;
  template = { ...tmpl };
  side = 'N';
  rebuildPlaceGhost();
  const name = (tmpl['name'] as string) || (tmpl['category'] as string) || 'mueble';
  _hooks.onShowBanner(name);
}

export function exitPlaceMode(): void {
  disposeGhost();
  clearDoorArrow();
  active = false;
  template = null;
  valid = false;
  _hooks.onHideBanner();
}

function setGhostColor(isValid: boolean): void {
  if (!ghost) return;
  (ghost.material as THREE.MeshBasicMaterial).color.setHex(
    isValid ? GHOST_VALID_COLOR : GHOST_INVALID_COLOR,
  );
}

export function updatePlaceGhost(event: MouseEvent | PointerEvent): void {
  if (!active || !ghost || !template) return;
  const cat = (template['category'] as string) || 'floor';

  if (cat === 'wall') {
    const wp = getWorldPointFromEvent(event);
    if (!wp) return;
    const face = findNearestPlaceableWallFace(wp);
    if (!face) {
      valid = false;
      setGhostColor(false);
      return;
    }
    const wasHoriz = side === 'N' || side === 'S';
    const isHoriz = face.side === 'N' || face.side === 'S';
    side = face.side;
    if (wasHoriz !== isHoriz) rebuildPlaceGhost();
    cellCx = face.cx;
    cellCy = face.cy;
    valid = canPlaceProp({ ...template, side, cx: cellCx, cy: cellCy }, cellCx, cellCy);
    setGhostColor(valid);
    let gx: number, gz: number;
    if (side === 'S') {
      gx = (cellCx + 0.5) * CELL;
      gz = cellCy * CELL + halfT + WALL_GHOST_GAP;
    } else if (side === 'N') {
      gx = (cellCx + 0.5) * CELL;
      gz = cellCy * CELL - halfT - WALL_GHOST_GAP;
    } else if (side === 'E') {
      gx = cellCx * CELL + halfT + WALL_GHOST_GAP;
      gz = (cellCy + 0.5) * CELL;
    } else {
      gx = cellCx * CELL - halfT - WALL_GHOST_GAP;
      gz = (cellCy + 0.5) * CELL;
    }
    const gy = (template['zOffset'] as number) + (template['h'] as number) / 2;
    ghost.position.set(gx - centerX, gy, gz - centerZ);
    return;
  }

  if (cat === 'door') {
    const wp = getWorldPointFromEvent(event);
    if (!wp) return;
    const seg = findNearestWallSegment(wp);
    if (!seg) {
      valid = false;
      setGhostColor(false);
      clearDoorArrow();
      return;
    }
    const axisIsHoriz = seg.type === 'wallN';
    const sideIsHoriz = side === 'N' || side === 'S';
    if (axisIsHoriz !== sideIsHoriz) {
      side = axisIsHoriz ? 'S' : 'E';
      rebuildPlaceGhost();
    }
    cellCx = seg.cx;
    cellCy = seg.cy;
    valid = canPlaceProp({ ...template, side, cx: cellCx, cy: cellCy }, cellCx, cellCy);
    setGhostColor(valid);
    let gx: number, gz: number;
    if (seg.type === 'wallN') {
      gx = (seg.cx + 0.5) * CELL;
      gz = seg.cy * CELL;
    } else {
      gx = seg.cx * CELL;
      gz = (seg.cy + 0.5) * CELL;
    }
    const gy = DOOR_OPENING_H / 2;
    ghost.position.set(gx - centerX, gy, gz - centerZ);
    updateDoorArrow();
    return;
  }

  // floor / rug / stack
  const cell = getCellFromEvent(event);
  if (!cell) return;
  cellCx = cell.cx;
  cellCy = cell.cy;
  valid = canPlaceProp({ ...template, cx: cellCx, cy: cellCy }, cellCx, cellCy);
  setGhostColor(valid);
  let baseY: number;
  if (cat === 'stack') {
    const base = getFloorStackBase(cellCx, cellCy);
    baseY = (base ? (base['h'] as number) : STACK_DEFAULT_BASE_H) + (template['h'] as number) / 2;
  } else if (cat === 'rug') {
    baseY = (template['h'] as number) / 2;
  } else {
    baseY = (template['h'] as number) / 2 + FLOOR_GHOST_LIFT;
  }
  ghost.position.set(
    (cellCx + (template['w'] as number) / 2) * CELL - centerX,
    baseY,
    (cellCy + (template['d'] as number) / 2) * CELL - centerZ,
  );
}

// Aplica el template a la escena. Llama hook onPlaced (que dispara
// agents.path reset + buildScene en legacy). Sale de placeMode.
export function applyPlace(): boolean {
  if (!active || !valid || !template) return false;
  const cat = (template['category'] as string) || 'floor';
  let placed: PropAny;
  if (cat === 'wall' || cat === 'door') {
    placed = pushProp({ ...template, side, cx: cellCx, cy: cellCy });
  } else {
    placed = pushProp({ ...template, cx: cellCx, cy: cellCy });
  }
  _hooks.onPlaced(placed);
  markWorldChanged();
  exitPlaceMode();
  return true;
}

// R: para wall, no aplica (side viene del cursor). Para door, cycle
// dentro del axis (N↔S, W↔E). Para floor/rug, swap w↔d.
export function rotatePlaceTemplate(): void {
  if (!active || !template) return;
  const cat = (template['category'] as string) || 'floor';
  if (cat === 'wall') return;
  if (cat === 'door') {
    if (side === 'N') side = 'S';
    else if (side === 'S') side = 'N';
    else if (side === 'W') side = 'E';
    else if (side === 'E') side = 'W';
    updateDoorArrow();
    return;
  }
  if (template['w'] === template['d']) return;
  const tw = template['w'];
  template['w'] = template['d'];
  template['d'] = tw;
  rebuildPlaceGhost();
}

// Spawn directo de un wall prop en una cara aleatoria libre. NO pasa por
// placeMode — usado desde el catálogo cuando seleccionás un cuadro.
// onPlaced se invoca igual (buildScene + markWorldChanged en legacy).
export function spawnWallPropFromTemplate(tmpl: PropAny): boolean {
  const candidates = getCandidateWallSlots();
  const free = candidates.filter((c) => {
    for (const p of props) {
      if ((p['category'] as string || 'floor') !== 'wall') continue;
      if (p['side'] === c.side && p['cx'] === c.cx && p['cy'] === c.cy) return false;
    }
    return true;
  });
  if (free.length === 0) return false;
  const slot = free[Math.floor(Math.random() * free.length)]!;
  const placed = pushProp({ category: 'wall', side: slot.side, cx: slot.cx, cy: slot.cy, ...tmpl });
  _hooks.onPlaced(placed);
  markWorldChanged();
  return true;
}
