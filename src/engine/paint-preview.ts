// Render del overlay de preview de pintura en modo Pintar (sin click).
// Tiles translúcidos sobre piso o caras de pared con el color que se
// pintaría. Caller mantiene la lógica de cuándo mostrar/ocultar.
//
// previewColor: el color (hex number) del preview. null = "limpiar"
// (vuelve al default), se renderiza en blanco.

import * as THREE from 'three';
import { CELL, halfT, centerX, centerZ } from './state';
import { addToScene, getScene } from './scene-graph';

const _meshes: THREE.Mesh[] = [];

export function clearPaintPreview(): void {
  const scene = getScene();
  if (!scene) return;
  for (const m of _meshes) {
    scene.remove(m);
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  }
  _meshes.length = 0;
}

function previewHex(color: number | null): number {
  // null = modo limpiar, preview en blanco
  return color !== null ? color : 0xffffff;
}

export function addPaintPreviewTile(cx: number, cy: number, color: number | null): void {
  const geo = new THREE.PlaneGeometry(CELL - 2, CELL - 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: previewHex(color),
    transparent: true,
    opacity: 0.55,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set((cx + 0.5) * CELL - centerX, 0.6, (cy + 0.5) * CELL - centerZ);
  m.renderOrder = 100;
  // No usamos addToScene porque NO debe trackearse en sceneObjects (clearScene
  // no debe disponer estos meshes — los disponemos manualmente en
  // clearPaintPreview).
  const scene = getScene();
  if (!scene) return;
  scene.add(m);
  _meshes.push(m);
}

export function addPaintPreviewWallFace(
  type: 'wallN' | 'wallW',
  cx: number,
  cy: number,
  side: 'N' | 'S' | 'E' | 'W',
  wallH: number,
  color: number | null,
): void {
  const w = CELL - 4;
  const h = Math.max(wallH - 4, 4);
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({
    color: previewHex(color),
    transparent: true,
    opacity: 0.55,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  let posX: number;
  const posY = h / 2;
  let posZ: number;
  if (type === 'wallN') {
    posX = (cx + 0.5) * CELL;
    posZ = cy * CELL + (side === 'S' ? halfT + 0.6 : -halfT - 0.6);
  } else {
    posZ = (cy + 0.5) * CELL;
    posX = cx * CELL + (side === 'E' ? halfT + 0.6 : -halfT - 0.6);
    // Plano default está en X-Y (normal +Z). Para wallW necesitamos Y-Z (normal X).
    geo.rotateY(Math.PI / 2);
  }
  m.position.set(posX - centerX, posY, posZ - centerZ);
  m.renderOrder = 100;
  const scene = getScene();
  if (!scene) {
    // unused param explicitly silenced
    void addToScene;
    return;
  }
  scene.add(m);
  _meshes.push(m);
}
