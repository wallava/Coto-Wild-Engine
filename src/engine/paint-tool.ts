// Orquestador runtime del modo Pintar.
//
// Este módulo mantiene el state propio de pintura (color, drag y caches) y
// coordina raycasting, mutación del world, preview y callbacks hacia legacy.
// La mutación real vive en paint.ts y el render de overlays en paint-preview.ts.

import {
  setPaintColorGetter,
  setFloorTileColor,
  setWallFaceColor,
  floodFillFloor as engineFloodFillFloor,
  floodFillRoomWalls as engineFloodFillRoomWalls,
} from './paint';
import { computeFloodFillFloor, computeFloodFillRoomFaces, type RoomFace } from './rooms';
import { getAdjacentCell } from './wall-queries';
import {
  getFloorOrWallFaceFromEvent,
  type PaintTarget,
} from './raycaster';
import {
  clearPaintPreview,
  addPaintPreviewTile as engineAddPaintPreviewTile,
  addPaintPreviewWallFace as engineAddPaintPreviewWallFace,
} from './paint-preview';
import { wallHeightForN, wallHeightForW } from './wall-mode';

const DEFAULT_PAINT_COLOR = 0xc6bca2;

type Mode = 'play' | 'edit' | 'build' | 'paint' | string;
type MouseEventLike = { clientX: number; clientY: number; shiftKey?: boolean };
type WallSide = 'N' | 'S' | 'E' | 'W';
type WallType = 'wallN' | 'wallW';
type PaintWallFace = { type: WallType; cx: number; cy: number; side: WallSide };

type PaintToolHooks = {
  onAfterPaint: () => void;
  onSyncUI: (color: number | null) => void;
  getMode: () => Mode;
  getPaintShiftHeld: () => boolean;
  getLastMouseEvent: () => MouseEventLike | null;
  getIsLeftDown: () => boolean;
};

const _hooks: PaintToolHooks = {
  onAfterPaint: () => {},
  onSyncUI: () => {},
  getMode: () => 'play',
  getPaintShiftHeld: () => false,
  getLastMouseEvent: () => null,
  getIsLeftDown: () => false,
};

let paintColor: number | null = DEFAULT_PAINT_COLOR;
let paintDragging = false;
let paintLastKey: string | null = null;
let paintPreviewKey: string | null = null;

/** Inicializa callbacks hacia legacy y conecta paint.ts con el color actual. */
export function initPaintTool(hooks: PaintToolHooks): void {
  _hooks.onAfterPaint = hooks.onAfterPaint;
  _hooks.onSyncUI = hooks.onSyncUI;
  _hooks.getMode = hooks.getMode;
  _hooks.getPaintShiftHeld = hooks.getPaintShiftHeld;
  _hooks.getLastMouseEvent = hooks.getLastMouseEvent;
  _hooks.getIsLeftDown = hooks.getIsLeftDown;
  setPaintColorGetter(() => paintColor);
}

/** Devuelve si el mouse está en drag de pintura continua. */
export function isPaintDragging(): boolean {
  return paintDragging;
}

/** Arranca drag de pintura continua y resetea el cache de último target. */
export function beginPaintDrag(): void {
  paintLastKey = null;
  paintDragging = true;
}

/** Termina drag de pintura continua y resetea el cache de último target. */
export function endPaintDrag(): void {
  paintDragging = false;
  paintLastKey = null;
}

/** Invalida el cache de preview para forzar redraw en el próximo update. */
export function invalidatePaintPreview(): void {
  paintPreviewKey = null;
}

/** Pinta una tile de piso y dispara el callback de render/persistencia. */
export function paintFloorTile(cx: number, cy: number): void {
  setFloorTileColor(cx, cy);
  _hooks.onAfterPaint();
}

/** Pinta una cara de pared y dispara el callback de render/persistencia. */
export function paintWallFace(face: PaintWallFace | null): void {
  if (!face) return;
  setWallFaceColor(face.type, face.cx, face.cy, face.side);
  _hooks.onAfterPaint();
}

/** Pinta el target bajo el mouse, evitando repetir el mismo target en drag. */
export function paintAtEvent(event: MouseEventLike): void {
  const target = getFloorOrWallFaceFromEvent(event);
  if (!target) return;
  if (target.kind === 'floor') {
    const key = `f:${target.cx},${target.cy}`;
    if (key === paintLastKey) return;
    paintLastKey = key;
    paintFloorTile(target.cx, target.cy);
    return;
  }
  const key = `w:${target.type},${target.cx},${target.cy},${target.side}`;
  if (key === paintLastKey) return;
  paintLastKey = key;
  paintWallFace(target);
}

/** Aplica flood fill de piso y dispara un solo callback de render/persistencia. */
export function floodFillFloor(startCx: number, startCy: number): void {
  engineFloodFillFloor(startCx, startCy);
  _hooks.onAfterPaint();
}

/** Aplica flood fill de paredes y dispara un solo callback de render/persistencia. */
export function floodFillRoomWalls(startCx: number, startCy: number): void {
  engineFloodFillRoomWalls(startCx, startCy);
  _hooks.onAfterPaint();
}

/** Resuelve el target bajo el mouse y aplica flood fill según piso o pared. */
export function floodFillAtEvent(event: MouseEventLike): void {
  const target = getFloorOrWallFaceFromEvent(event);
  if (!target) return;
  if (target.kind === 'floor') {
    floodFillFloor(target.cx, target.cy);
    return;
  }
  const start = getAdjacentCell(target.type, target.cx, target.cy, target.side);
  floodFillRoomWalls(start.cx, start.cy);
}

/** Agrega preview de una tile usando el color actual del tool. */
export function addPaintPreviewTile(cx: number, cy: number): void {
  engineAddPaintPreviewTile(cx, cy, paintColor);
}

/** Agrega preview de una cara de pared usando wall-mode y color actual. */
export function addPaintPreviewWallFace(
  type: WallType,
  cx: number,
  cy: number,
  side: WallSide,
): void {
  const wallH = type === 'wallN' ? wallHeightForN(cy) : wallHeightForW(cx);
  engineAddPaintPreviewWallFace(type, cx, cy, side, wallH, paintColor);
}

/** Actualiza el overlay de preview bajo el cursor, incluyendo Shift+hover. */
export function updatePaintPreview(event: MouseEventLike | null): void {
  if (_hooks.getMode() !== 'paint' || paintDragging || _hooks.getIsLeftDown()) {
    clearPaintPreview();
    return;
  }
  if (!event) {
    clearPaintPreview();
    return;
  }
  const hit = getFloorOrWallFaceFromEvent(event);
  if (!hit) {
    clearPaintPreview();
    return;
  }
  const shift = _hooks.getPaintShiftHeld();
  const target = { ...hit, shift, color: paintColor };
  const newKey = JSON.stringify(target);
  if (newKey === paintPreviewKey) return;
  paintPreviewKey = newKey;
  clearPaintPreview();
  renderPaintPreview(hit, shift);
}

/** Cambia color, sincroniza UI y refresca preview si aplica. */
export function setPaintColor(color: number | null): void {
  paintColor = color;
  _hooks.onSyncUI(color);
  if (_hooks.getMode() === 'paint' && !paintDragging && !_hooks.getIsLeftDown()) {
    const lastMouseEvent = _hooks.getLastMouseEvent();
    if (lastMouseEvent) {
      invalidatePaintPreview();
      updatePaintPreview(lastMouseEvent);
    }
  }
}

function renderPaintPreview(target: PaintTarget, shift: boolean): void {
  if (target.kind === 'floor') {
    if (shift) {
      for (const cell of computeFloodFillFloor(target.cx, target.cy)) {
        addPaintPreviewTile(cell.cx, cell.cy);
      }
      return;
    }
    addPaintPreviewTile(target.cx, target.cy);
    return;
  }

  if (shift) {
    const start = getAdjacentCell(target.type, target.cx, target.cy, target.side);
    for (const face of computeFloodFillRoomFaces(start.cx, start.cy)) {
      addPaintPreviewWallFaceFromRoomFace(face);
    }
    return;
  }
  addPaintPreviewWallFace(target.type, target.cx, target.cy, target.side);
}

function addPaintPreviewWallFaceFromRoomFace(face: RoomFace): void {
  addPaintPreviewWallFace(face.type, face.cx, face.cy, face.side);
}
