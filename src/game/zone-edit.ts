// Orquestador del modo "Editar celdas de zona".
//
// Mantiene el estado de edición y coordina raycasting + mutación de zonas.
// No importa UI: legacy inyecta callbacks para mostrar/ocultar el banner y
// reconstruir overlays sin romper la regla de capas game -> engine/utils.

import { getFloorCellFromEvent } from '../engine/raycaster';
import { getZones, setZoneCell } from '../engine/rooms';
import { canPaintZoneCell } from '../engine/zone-config';

type MouseEventLike = { clientX: number; clientY: number };
type ZoneEditDragMode = 'add' | 'remove';

type ZoneEditHooks = {
  onShowBanner: (zoneName: string) => void;
  onHideBanner: () => void;
  onAfterEdit: () => void;
  getCurrentZoneId?: () => string | null;
};

const _hooks: ZoneEditHooks = {
  onShowBanner: () => {},
  onHideBanner: () => {},
  onAfterEdit: () => {},
};

let zoneEditingId: string | null = null;
let zoneEditDragging = false;
let zoneEditDragMode: ZoneEditDragMode = 'add';

/** Inicializa callbacks hacia legacy sin acoplar game/ con ui/. */
export function initZoneEdit(hooks: ZoneEditHooks): void {
  _hooks.onShowBanner = hooks.onShowBanner;
  _hooks.onHideBanner = hooks.onHideBanner;
  _hooks.onAfterEdit = hooks.onAfterEdit;
  if (hooks.getCurrentZoneId) _hooks.getCurrentZoneId = hooks.getCurrentZoneId;
}

/** Arranca edición de celdas para una zona existente. */
export function startZoneEdit(zoneId: string): void {
  const zone = getZones().find((z) => z.id === zoneId);
  if (!zone) return;
  zoneEditingId = zoneId;
  zoneEditDragging = false;
  _hooks.onShowBanner(zone.name || 'Sin nombre');
}

/** Termina cualquier edición de zona activa. */
export function stopZoneEdit(): void {
  zoneEditingId = null;
  zoneEditDragging = false;
  _hooks.onHideBanner();
}

/** Devuelve si hay una zona activa en modo edición. */
export function isZoneEditing(): boolean {
  return getZoneEditingId() !== null;
}

/** Devuelve el id de zona activa, si existe. */
export function getZoneEditingId(): string | null {
  return zoneEditingId ?? _hooks.getCurrentZoneId?.() ?? null;
}

/** Devuelve si el mouse está en drag de edición de zona. */
export function isZoneEditDragging(): boolean {
  return zoneEditDragging;
}

/** Arranca drag continuo para agregar o quitar celdas. */
export function beginZoneEditDrag(mode: ZoneEditDragMode): void {
  zoneEditDragMode = mode;
  zoneEditDragging = true;
}

/** Termina drag continuo de edición de zona. */
export function endZoneEditDrag(): void {
  zoneEditDragging = false;
}

/** Aplica add/remove de celda según el drag mode actual. */
export function applyZoneEditAtEvent(event: MouseEventLike): void {
  const activeZoneId = getZoneEditingId();
  if (!activeZoneId) return;
  const cell = getFloorCellFromEvent(event);
  if (!cell) return;
  // Quitar siempre se permite: si cambia la regla de tamaño, una zona vieja
  // debe poder limpiarse aunque hoy esté en un componente demasiado chico.
  if (zoneEditDragMode === 'add' && !canPaintZoneCell(cell.cx, cell.cy)) {
    return;
  }
  const changed = setZoneCell(
    activeZoneId,
    cell.cx,
    cell.cy,
    zoneEditDragMode === 'add',
  );
  if (changed) _hooks.onAfterEdit();
}

/** Cursor recomendado para hover durante edición de zona. */
export function getZoneEditCursorAtEvent(event: MouseEventLike): 'crosshair' | 'not-allowed' {
  const cell = getFloorCellFromEvent(event);
  if (cell && !canPaintZoneCell(cell.cx, cell.cy)) return 'not-allowed';
  return 'crosshair';
}
