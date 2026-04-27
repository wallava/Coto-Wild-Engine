// Raycaster compartido + helpers de hit testing al piso/celdas/world point.
//
// El renderer canvas + camera vienen vía getters callbacks porque viven en
// legacy hasta extraer el setup THREE base.

import * as THREE from 'three';
import { GRID_W, GRID_H, CELL, centerX, centerZ } from './state';
import { getSceneObjects } from './scene-graph';

const _raycaster = new THREE.Raycaster();
const _mouseVec = new THREE.Vector2();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

let _canvasGetter: () => HTMLCanvasElement | null = () => null;
let _cameraGetter: () => THREE.Camera | null = () => null;

export function setCanvasGetter(getter: () => HTMLCanvasElement | null): void {
  _canvasGetter = getter;
}

export function setCameraGetter(getter: () => THREE.Camera | null): void {
  _cameraGetter = getter;
}

export function getRaycaster(): THREE.Raycaster {
  return _raycaster;
}

// Setea el raycaster desde un MouseEvent: convierte clientX/Y a NDC + cámara.
export function setRaycasterFromEvent(event: { clientX: number; clientY: number }): void {
  const canvas = _canvasGetter();
  const camera = _cameraGetter();
  if (!canvas || !camera) return;
  const rect = canvas.getBoundingClientRect();
  _mouseVec.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  _mouseVec.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  _raycaster.setFromCamera(_mouseVec, camera);
}

// Intersecta el ray con el plano del piso. Devuelve { x, z } en world coords
// SIN centrar (sumado centerX/Z), o null si el ray no cruza el plano.
export function getWorldPointFromEvent(
  event: { clientX: number; clientY: number },
): { x: number; z: number } | null {
  setRaycasterFromEvent(event);
  const point = new THREE.Vector3();
  if (!_raycaster.ray.intersectPlane(_groundPlane, point)) return null;
  return { x: point.x + centerX, z: point.z + centerZ };
}

// Intersecta con el plano del piso y devuelve la celda (cx, cy). null si
// fuera del grid.
export function getCellFromEvent(
  event: { clientX: number; clientY: number },
): { cx: number; cy: number } | null {
  setRaycasterFromEvent(event);
  const point = new THREE.Vector3();
  if (!_raycaster.ray.intersectPlane(_groundPlane, point)) return null;
  const cx = Math.floor((point.x + centerX) / CELL);
  const cy = Math.floor((point.z + centerZ) / CELL);
  if (cx < 0 || cx >= GRID_W || cy < 0 || cy >= GRID_H) return null;
  return { cx, cy };
}

// Raycast contra meshes de tiles del piso (sceneObjects con userData.floorTile).
// Más preciso que getCellFromEvent cuando hay paredes/muebles que ocultan
// proyección al plano.
export function getFloorCellFromEvent(
  event: { clientX: number; clientY: number },
): { cx: number; cy: number } | null {
  setRaycasterFromEvent(event);
  const targets = getSceneObjects().filter(
    (o) => (o as THREE.Mesh).isMesh && o.userData['floorTile'],
  );
  const hits = _raycaster.intersectObjects(targets, false);
  if (hits.length === 0) return null;
  const ft = hits[0]!.object.userData['floorTile'] as { cx: number; cy: number };
  return { ...ft };
}

// Raycast contra TODOS los sceneObjects, devuelve el primer prop encontrado
// (mesh.userData.prop) o null.
export function getPropFromEvent(event: { clientX: number; clientY: number }): unknown {
  setRaycasterFromEvent(event);
  const intersects = _raycaster.intersectObjects(getSceneObjects(), false);
  for (const hit of intersects) {
    const prop = hit.object.userData?.['prop'];
    if (prop) return prop;
  }
  return null;
}
