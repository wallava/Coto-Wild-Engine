// Wall build mode estilo Sims: drag sobre el piso construye o elimina una
// línea continua de paredes (siempre recta H o V, axis-locked tras un
// threshold de movimiento). Si la primera pared del path ya existe → modo
// erase. Si no → modo build con buildStyle actual ('solid'/'window').
//
// State interno: isDragging + start/last/axis/offAxis + buildStyle. Otros
// módulos consultan via getters. applyWallPath dispara hook onApplied que
// resetea paths de agentes + rebuilds (orquestado por legacy).

import { CELL, GRID_W, GRID_H } from './state';
import { worldGrid, props, removePropAt } from './world';
import { getNearestEdgeFromPoint, type EdgeRef } from './wall-queries';
import { showWallPreview as renderWallPreview, clearWallPreviews } from './wall-preview-render';
import { eventBus } from './event-bus';
import { markWorldChanged } from './persistence';

const SINGLE_EDGE_THRESHOLD = CELL * 0.3;
const AXIS_LOCK_THRESHOLD = CELL * 0.5;

type WorldPoint = { x: number; z: number };
type WallStyle = string;

type WallBuildHooks = {
  // Llamado tras applyWallPath con changed > 0. Legacy hace: resetea agent
  // paths, lastCamQuadrant = '', buildScene, reselectProp, markWorldChanged.
  // El módulo igual dispara markWorldChanged y eventBus 'wallChanged' por arista.
  onApplied: (info: { changed: number; isErase: boolean; converted: number }) => void;
};

let _hooks: WallBuildHooks = {
  onApplied: () => {},
};

let isDragging = false;
let dragStart: WorldPoint | null = null;
let dragLast: WorldPoint | null = null;
let dragAxis: 'h' | 'v' | null = null;
let dragOffAxis = false;
let buildStyle: WallStyle = 'solid';

export function initWallBuild(hooks: WallBuildHooks): void {
  _hooks = hooks;
}

export function isWallBuildDragging(): boolean { return isDragging; }
export function getWallDragStart(): WorldPoint | null { return dragStart; }
export function getWallDragLast(): WorldPoint | null { return dragLast; }
export function getWallDragOffAxis(): boolean { return dragOffAxis; }
export function getBuildWallStyle(): WallStyle { return buildStyle; }
export function setBuildWallStyle(style: WallStyle): void { buildStyle = style; }

// Inicia el drag desde la coordenada world. mouseup → applyWallPath o cancel.
export function beginWallDrag(start: WorldPoint): void {
  isDragging = true;
  dragStart = start;
  dragLast = start;
  dragAxis = null;
  dragOffAxis = false;
}

// Actualiza la coordenada actual del cursor + intenta lockear axis.
export function updateWallDrag(end: WorldPoint): void {
  dragLast = end;
  tryLockAxis(dragStart, end);
}

// Calcula el path de paredes según start, end y axis fijado.
// Si no hay axis y delta es chico → single edge más cercano al start.
// Si axis está fijado → mantiene esa dirección y setea dragOffAxis si el
// cursor se desvía más por el eje contrario.
export function computeWallPath(
  start: WorldPoint | null,
  end: WorldPoint | null,
): EdgeRef[] {
  if (!start || !end) return [];
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const absDx = Math.abs(dx);
  const absDz = Math.abs(dz);
  if (!dragAxis && absDx < SINGLE_EDGE_THRESHOLD && absDz < SINGLE_EDGE_THRESHOLD) {
    const e = getNearestEdgeFromPoint(start);
    dragOffAxis = false;
    return e ? [e] : [];
  }
  const axis: 'h' | 'v' = dragAxis ?? (absDx >= absDz ? 'h' : 'v');
  if (axis === 'h') {
    dragOffAxis = absDz > absDx;
  } else {
    dragOffAxis = absDx > absDz;
  }
  if (axis === 'h') {
    const cy = Math.max(0, Math.min(GRID_H, Math.round(start.z / CELL)));
    const cxs = Math.floor(start.x / CELL);
    const cxe = Math.floor(end.x / CELL);
    const cxMin = Math.max(0, Math.min(cxs, cxe));
    const cxMax = Math.min(GRID_W - 1, Math.max(cxs, cxe));
    const result: EdgeRef[] = [];
    for (let cx = cxMin; cx <= cxMax; cx++) result.push({ type: 'wallN', cx, cy });
    return result;
  }
  const cx = Math.max(0, Math.min(GRID_W, Math.round(start.x / CELL)));
  const czs = Math.floor(start.z / CELL);
  const cze = Math.floor(end.z / CELL);
  const cyMin = Math.max(0, Math.min(czs, cze));
  const cyMax = Math.min(GRID_H - 1, Math.max(czs, cze));
  const result: EdgeRef[] = [];
  for (let cy = cyMin; cy <= cyMax; cy++) result.push({ type: 'wallW', cx, cy });
  return result;
}

// Setea el axis fijado si todavía no lo está y el delta cruza el threshold.
function tryLockAxis(start: WorldPoint | null, end: WorldPoint | null): void {
  if (dragAxis) return;
  if (!start || !end) return;
  const dx = Math.abs(end.x - start.x);
  const dz = Math.abs(end.z - start.z);
  if (dx > AXIS_LOCK_THRESHOLD || dz > AXIS_LOCK_THRESHOLD) {
    dragAxis = dx >= dz ? 'h' : 'v';
  }
}

// Re-renderiza el preview translúcido sobre las paredes del path.
// Pasa el buildStyle actual para distinguir build/erase/convert.
export function showWallBuildPreview(path: EdgeRef[], isInvalid: boolean): void {
  const isErase = buildStyle === 'erase';
  renderWallPreview(path, isErase, isInvalid, buildStyle);
}

// Aplica el path: erase remueve paredes + wall props anclados; build crea
// con buildStyle actual; convert cambia solo el style. Emite wallChanged
// por cada arista afectada y hook onApplied al final si hubo cambios.
//
// `onSelectedPropRemoved` se llama si un wall prop seleccionado fue removido
// durante erase (legacy hace selectProp(null)).
export function applyWallPath(
  path: EdgeRef[],
  onSelectedPropRemoved?: (removedProp: unknown) => void,
): void {
  if (!path.length) return;
  const isErase = buildStyle === 'erase';
  let changed = 0;
  let removedWallProps = 0;
  let converted = 0;
  for (const w of path) {
    const exists = w.type === 'wallN'
      ? !!worldGrid.wallN[w.cy]?.[w.cx]
      : !!worldGrid.wallW[w.cy]?.[w.cx];
    if (isErase) {
      if (exists) {
        if (w.type === 'wallN') worldGrid.wallN[w.cy]![w.cx] = false;
        else worldGrid.wallW[w.cy]![w.cx] = false;
        const validSides = w.type === 'wallN' ? ['N', 'S'] : ['W', 'E'];
        for (let i = props.length - 1; i >= 0; i--) {
          const p = props[i]!;
          if ((p['category'] || 'floor') !== 'wall') continue;
          if (p['cx'] !== w.cx || p['cy'] !== w.cy) continue;
          if (!validSides.includes(p['side'] as string)) continue;
          if (onSelectedPropRemoved) onSelectedPropRemoved(p);
          removePropAt(i);
          removedWallProps++;
        }
        eventBus.emit('wallChanged', {
          type: w.type, cx: w.cx, cy: w.cy, exists: false, style: null,
        });
        changed++;
      }
    } else if (!exists) {
      let blocked = false;
      if (w.type === 'wallN') {
        for (const p of props) {
          if ((p['category'] || 'floor') === 'wall') continue;
          if (p['d'] === 2 && p['cx'] === w.cx && p['cy'] === w.cy - 1) { blocked = true; break; }
        }
        if (!blocked) {
          worldGrid.wallN[w.cy]![w.cx] = true;
          (worldGrid.wallNStyle as WallStyle[][])[w.cy]![w.cx] = buildStyle as never;
          eventBus.emit('wallChanged', {
            type: 'wallN', cx: w.cx, cy: w.cy, exists: true, style: buildStyle,
          });
          changed++;
        }
      } else {
        for (const p of props) {
          if ((p['category'] || 'floor') === 'wall') continue;
          if (p['w'] === 2 && p['cy'] === w.cy && p['cx'] === w.cx - 1) { blocked = true; break; }
        }
        if (!blocked) {
          worldGrid.wallW[w.cy]![w.cx] = true;
          (worldGrid.wallWStyle as WallStyle[][])[w.cy]![w.cx] = buildStyle as never;
          eventBus.emit('wallChanged', {
            type: 'wallW', cx: w.cx, cy: w.cy, exists: true, style: buildStyle,
          });
          changed++;
        }
      }
    } else {
      const styleArr = w.type === 'wallN'
        ? (worldGrid.wallNStyle as WallStyle[][] | undefined)
        : (worldGrid.wallWStyle as WallStyle[][] | undefined);
      const currentStyle = styleArr?.[w.cy]?.[w.cx];
      if (currentStyle !== buildStyle) {
        if (w.type === 'wallN') (worldGrid.wallNStyle as WallStyle[][])[w.cy]![w.cx] = buildStyle as never;
        else (worldGrid.wallWStyle as WallStyle[][])[w.cy]![w.cx] = buildStyle as never;
        eventBus.emit('wallChanged', {
          type: w.type, cx: w.cx, cy: w.cy, exists: true, style: buildStyle,
        });
        changed++;
        converted++;
      }
    }
  }
  if (changed > 0) {
    markWorldChanged();
    _hooks.onApplied({ changed, isErase, converted });
  }
}

export function cancelWallDrag(): void {
  isDragging = false;
  dragStart = null;
  dragLast = null;
  dragAxis = null;
  dragOffAxis = false;
  clearWallPreviews();
}

// Termina el drag: resetea state pero NO llama applyWallPath. Usar después
// de aplicar (legacy hace applyWallPath + cleanup separado).
export function endWallDrag(): void {
  isDragging = false;
  dragStart = null;
  dragLast = null;
  dragAxis = null;
  dragOffAxis = false;
  clearWallPreviews();
}
