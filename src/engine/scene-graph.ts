// Singleton del scene graph: scene + tracking arrays para limpieza.
//
// El owner (legacy/main) crea las refs y las pasa a initSceneGraph(). El
// módulo NO crea la scene — solo guarda referencias para que módulos engine
// puedan agregar/limpiar meshes sin tener que recibir scene en cada función.
//
// `sceneObjects` se trackea para clearScene (dispose geometría + materiales
// + edges). `doorPivotsById` mapea door.id → Object3D pivot para que la
// animación de apertura encuentre el pivot a rotar sin barrer sceneObjects.

import * as THREE from 'three';

let _scene: THREE.Scene | null = null;
let _sceneObjects: THREE.Object3D[] = [];
let _doorPivotsById: Map<string, THREE.Object3D> = new Map();

export function initSceneGraph(opts: {
  scene: THREE.Scene;
  sceneObjects: THREE.Object3D[];
  doorPivotsById: Map<string, THREE.Object3D>;
}): void {
  _scene = opts.scene;
  _sceneObjects = opts.sceneObjects;
  _doorPivotsById = opts.doorPivotsById;
}

export function getScene(): THREE.Scene | null {
  return _scene;
}

export function getSceneObjects(): THREE.Object3D[] {
  return _sceneObjects;
}

export function getDoorPivots(): Map<string, THREE.Object3D> {
  return _doorPivotsById;
}

// Wrapper común: scene.add + push a sceneObjects (tracking para clearScene).
export function addToScene(obj: THREE.Object3D): void {
  if (!_scene) return;
  _scene.add(obj);
  _sceneObjects.push(obj);
}

// Registra el pivot de una puerta para que updateDoorAnimations lo encuentre
// por id sin barrer sceneObjects.
export function registerDoorPivot(id: string, pivot: THREE.Object3D): void {
  _doorPivotsById.set(id, pivot);
}

// Dispose total: remove + dispose geo/mat/edges de cada object trackeado,
// vacía el array, limpia el mapa de door pivots.
export function clearScene(): void {
  if (!_scene) return;
  for (const obj of _sceneObjects) {
    _scene.remove(obj);
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
      else mesh.material.dispose();
    }
    const edges = obj.userData?.['edges'] as THREE.LineSegments | undefined;
    if (edges) {
      edges.geometry.dispose();
      (edges.material as THREE.Material).dispose();
    }
  }
  _sceneObjects.length = 0;
  _doorPivotsById.clear();
}
