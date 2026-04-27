// Render translúcido de habitaciones cerradas + zonas abiertas.
// Se muestra sólo cuando el panel "🏠 Habitaciones" está abierto. Cada
// habitación tinta sus celdas con su color, opacidad baja para no tapar
// lo que hay debajo. Tras cualquier rebuild de escena se reconstruye si
// está activo.
//
// Layer order: rooms cerradas debajo (renderOrder 95), zonas abiertas
// encima (96) — necesario porque comparten celdas.
//
// `zoneEditingId` viene vía getter callback (legacy lo mantiene mientras
// el cutscene editor no esté extraído). Si la zona está siendo editada,
// su highlight es más fuerte.

import * as THREE from 'three';
import { CELL, centerX, centerZ } from './state';
import { getRooms, getZones } from './rooms';
import { getScene } from './scene-graph';

const _meshes: THREE.Mesh[] = [];
let _active = false;
let _zoneEditingIdGetter: () => string | null = () => null;

export function setZoneEditingIdGetter(getter: () => string | null): void {
  _zoneEditingIdGetter = getter;
}

export function isRoomsOverlayActive(): boolean {
  return _active;
}

export function setRoomsOverlayActive(v: boolean): void {
  _active = !!v;
}

export function clearRoomsOverlay(): void {
  const scene = getScene();
  if (!scene) return;
  for (const m of _meshes) {
    scene.remove(m);
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  }
  _meshes.length = 0;
}

function addRoomOverlayTile(
  cx: number,
  cy: number,
  color: number,
  opacity: number,
  renderOrder: number,
): void {
  const scene = getScene();
  if (!scene) return;
  const geo = new THREE.PlaneGeometry(CELL - 4, CELL - 4);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(
    (cx + 0.5) * CELL - centerX,
    0.7,
    (cy + 0.5) * CELL - centerZ,
  );
  m.renderOrder = renderOrder;
  scene.add(m);
  _meshes.push(m);
}

export function buildRoomsOverlay(): void {
  clearRoomsOverlay();
  if (!_active) return;
  const editingId = _zoneEditingIdGetter();
  // Capa 1: habitaciones cerradas (autodetectadas)
  const rooms = getRooms();
  for (const room of rooms) {
    for (const cell of room.cells) {
      addRoomOverlayTile(cell.cx, cell.cy, room.color, 0.32, 95);
    }
  }
  // Capa 2: zonas abiertas (manuales). RenderOrder mayor para que se vean
  // encima de la habitación cerrada en las celdas que comparten.
  const zones = getZones();
  for (const zone of zones) {
    for (const cell of zone.cells) {
      const isEditing = editingId === zone.id;
      addRoomOverlayTile(cell.cx, cell.cy, zone.color, isEditing ? 0.55 : 0.42, 96);
    }
  }
}
