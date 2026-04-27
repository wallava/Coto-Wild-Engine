// Wall drag preview overlays: cajas translúcidas sobre cada wall del path.
// Verde = construir nueva. Amarillo = convertir tipo. Rojo = borrar.
//
// `buildWallStyle` (legacy) se pasa como param a showWallPreview porque
// maneja el modo "convert" (si pared existe pero el style buscado es
// distinto del actual).

import * as THREE from 'three';
import { CELL, halfT, centerX, centerZ, WALL_H_UP } from './state';
import { worldGrid } from './world';
import { getScene } from './scene-graph';
import { getNearestEdgeFromPoint, type EdgeRef } from './wall-queries';

const _previewMeshes: THREE.Mesh[] = [];
let _hoverMesh: THREE.Mesh | null = null;

function makeWallPreviewBox(wall: EdgeRef, color: number, opacity: number): THREE.Mesh {
  let xmin: number, xmax: number, ymin: number, ymax: number;
  if (wall.type === 'wallN') {
    xmin = wall.cx * CELL;
    xmax = (wall.cx + 1) * CELL;
    ymin = wall.cy * CELL - halfT;
    ymax = wall.cy * CELL + halfT;
  } else {
    xmin = wall.cx * CELL - halfT;
    xmax = wall.cx * CELL + halfT;
    ymin = wall.cy * CELL;
    ymax = (wall.cy + 1) * CELL;
  }
  const w = xmax - xmin;
  const d = ymax - ymin;
  const h = WALL_H_UP;
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 990;
  mesh.position.set(
    (xmin + xmax) / 2 - centerX,
    h / 2,
    (ymin + ymax) / 2 - centerZ,
  );
  return mesh;
}

export function clearWallPreviews(): void {
  const scene = getScene();
  if (!scene) return;
  for (const m of _previewMeshes) {
    scene.remove(m);
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  }
  _previewMeshes.length = 0;
}

export function clearWallHover(): void {
  if (!_hoverMesh) return;
  const scene = getScene();
  if (scene) scene.remove(_hoverMesh);
  _hoverMesh.geometry.dispose();
  (_hoverMesh.material as THREE.Material).dispose();
  _hoverMesh = null;
}

export function showWallPreview(
  path: EdgeRef[],
  isErase: boolean,
  isInvalid: boolean,
  buildWallStyle: string,
): void {
  clearWallPreviews();
  const scene = getScene();
  if (!scene) return;
  const colorBuild = 0x60ff60;
  const colorConvert = 0xffd060;
  const colorErase = 0xff6060;
  const colorInvalid = 0xff2020;
  const opacity = isInvalid ? 0.4 : 0.55;
  for (const w of path) {
    const exists = w.type === 'wallN'
      ? !!worldGrid.wallN[w.cy]?.[w.cx]
      : !!worldGrid.wallW[w.cy]?.[w.cx];
    let color: number;
    if (isInvalid) {
      color = colorInvalid;
    } else if (isErase) {
      if (!exists) continue;
      color = colorErase;
    } else {
      if (exists) {
        const styleArr = w.type === 'wallN'
          ? (worldGrid.wallNStyle as string[][] | undefined)
          : (worldGrid.wallWStyle as string[][] | undefined);
        const currentStyle = styleArr?.[w.cy]?.[w.cx];
        if (currentStyle === buildWallStyle) continue;
        color = colorConvert;
      } else {
        color = colorBuild;
      }
    }
    const m = makeWallPreviewBox(w, color, opacity);
    scene.add(m);
    _previewMeshes.push(m);
  }
}

export function showWallHover(p: { x: number; z: number } | null): void {
  clearWallHover();
  const scene = getScene();
  if (!scene) return;
  const e = getNearestEdgeFromPoint(p);
  if (!e) return;
  _hoverMesh = makeWallPreviewBox(e, 0xffff60, 0.4);
  scene.add(_hoverMesh);
}
