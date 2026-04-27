// Render del piso del grid: una tile por celda con su color de pintura
// (worldGrid.floorColors) o color default de la paleta. Cada tile lleva
// userData.floorTile = { cx, cy } para raycast/picking.
//
// `gridHelper` global del engine se renderiza como wireframe (visible
// según strokes flag).

import * as THREE from 'three';
import { GRID_W, GRID_H, CELL, centerX, centerZ, PALETTE } from './state';
import { worldGrid } from './world';
import { addToScene } from './scene-graph';
import { getStrokesEnabled } from './three-primitives';

export function buildFloor(): void {
  for (let cy = 0; cy < GRID_H; cy++) {
    for (let cx = 0; cx < GRID_W; cx++) {
      const row = worldGrid.floorColors?.[cy];
      const cellColor = row && row[cx] !== null ? row[cx] : null;
      const tileColor = cellColor ?? PALETTE.floor;
      const tileGeo = new THREE.PlaneGeometry(CELL, CELL);
      tileGeo.rotateX(-Math.PI / 2);
      const tileMat = new THREE.MeshBasicMaterial({
        color: tileColor as number,
        side: THREE.DoubleSide,
      });
      const tile = new THREE.Mesh(tileGeo, tileMat);
      tile.position.set(
        (cx + 0.5) * CELL - centerX,
        -0.05,
        (cy + 0.5) * CELL - centerZ,
      );
      tile.userData['floorTile'] = { cx, cy };
      addToScene(tile);
    }
  }

  // Grid wireframe (visible según flag strokes)
  const gridHelper = new THREE.GridHelper(GRID_W * CELL, GRID_W, 0x9a8c70, 0x9a8c70);
  gridHelper.position.y = 0.1;
  gridHelper.visible = getStrokesEnabled();
  addToScene(gridHelper);
}
