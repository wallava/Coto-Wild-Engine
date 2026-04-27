// Wireframe amarillo alrededor de un prop seleccionado. Renderorder alto
// (999) + depthTest:false para verse encima de todo.
//
// 3 variantes según category:
//   - 'wall' (cuadro): bbox del cuadro físico (usa getWallPropBounds)
//   - 'door': marco del segmento de pared completo (incluye dintel + hueco)
//   - 'floor'/'rug'/'stack': bbox del mueble en el grid; stack se levanta
//     a la altura del floor base.
//
// El estado `selectedProp` vive en legacy. Acá solo manejamos el render.

import * as THREE from 'three';
import { CELL, halfT, centerX, centerZ, DOOR_OPENING_H } from './state';
import { getScene } from './scene-graph';
import { getWallPropBounds } from './wall-queries';
import { getFloorStackBase, type PropAny } from './world';

let _highlightMesh: THREE.LineSegments | null = null;

export function clearSelectionHighlight(): void {
  if (!_highlightMesh) return;
  const scene = getScene();
  if (scene) scene.remove(_highlightMesh);
  _highlightMesh.geometry.dispose();
  (_highlightMesh.material as THREE.Material).dispose();
  _highlightMesh = null;
}

function makeHighlightMesh(w: number, h: number, d: number): THREE.LineSegments {
  const geo = new THREE.BoxGeometry(w, h, d);
  const edges = new THREE.EdgesGeometry(geo);
  const mat = new THREE.LineBasicMaterial({ color: 0xffff00, depthTest: false });
  const mesh = new THREE.LineSegments(edges, mat);
  mesh.renderOrder = 999;
  return mesh;
}

export function showSelectionHighlight(prop: PropAny | null): void {
  clearSelectionHighlight();
  if (!prop) return;
  const scene = getScene();
  if (!scene) return;
  const cat = (prop['category'] as string) || 'floor';

  if (cat === 'wall') {
    const b = getWallPropBounds(prop);
    if (!b) return;
    const PAD = 3;
    const w = (b.xmax - b.xmin) + PAD * 2;
    const h = (b.zmax - b.zmin) + PAD * 2;
    const d = (b.ymax - b.ymin) + PAD * 2;
    _highlightMesh = makeHighlightMesh(w, h, d);
    _highlightMesh.position.set(
      (b.xmin + b.xmax) / 2 - centerX,
      (b.zmin + b.zmax) / 2,
      (b.ymin + b.ymax) / 2 - centerZ,
    );
    scene.add(_highlightMesh);
    return;
  }

  if (cat === 'door') {
    const isHoriz = prop['side'] === 'N' || prop['side'] === 'S';
    const cx = prop['cx'] as number;
    const cy = prop['cy'] as number;
    let xmin: number, xmax: number, ymin: number, ymax: number;
    if (isHoriz) {
      xmin = cx * CELL;
      xmax = (cx + 1) * CELL;
      ymin = cy * CELL - halfT;
      ymax = cy * CELL + halfT;
    } else {
      xmin = cx * CELL - halfT;
      xmax = cx * CELL + halfT;
      ymin = cy * CELL;
      ymax = (cy + 1) * CELL;
    }
    const PAD = 3;
    const w = (xmax - xmin) + PAD * 2;
    const d = (ymax - ymin) + PAD * 2;
    const h = DOOR_OPENING_H + PAD * 2;
    _highlightMesh = makeHighlightMesh(w, h, d);
    _highlightMesh.position.set(
      (xmin + xmax) / 2 - centerX,
      DOOR_OPENING_H / 2,
      (ymin + ymax) / 2 - centerZ,
    );
    scene.add(_highlightMesh);
    return;
  }

  // floor / rug / stack
  const cx = prop['cx'] as number;
  const cy = prop['cy'] as number;
  const pw = prop['w'] as number;
  const pd = prop['d'] as number;
  const ph = prop['h'] as number;
  const w = pw * CELL;
  const d = pd * CELL;
  const h = ph + 6;
  _highlightMesh = makeHighlightMesh(w, h, d);
  // Stack: levantar el highlight a la altura del floor base
  let yCenter = h / 2 - 3;
  if (cat === 'stack') {
    const base = getFloorStackBase(cx, cy);
    const baseH = base ? (base['h'] as number) : 28;
    yCenter = baseH + h / 2 - 3;
  }
  _highlightMesh.position.set(
    (cx + pw / 2) * CELL - centerX,
    yCenter,
    (cy + pd / 2) * CELL - centerZ,
  );
  scene.add(_highlightMesh);
}
