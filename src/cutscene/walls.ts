/**
 * Evaluación pura del estado de visibilidad de paredes/props en cutscene.
 * Solo calcula el snapshot efectivo; la aplicación visual a meshes queda en
 * legacy/editor para no mezclar modelo con Three.js ni DOM.
 */

import type { Cutscene, SceneView } from './model';
import { lastKfWithInheritance } from './inheritance';
import { filterKfsToScene } from './keyframes';

export type WallState = {
  hiddenIds: Set<string>;
};

const WALL_EPSILON = 0.000001;

function sceneAtFromView(scenes: readonly SceneView[], t: number): SceneView | null {
  for (const scene of scenes) {
    if (t >= scene.tStart && t < scene.tEnd) return scene;
  }
  return null;
}

/** Devuelve el snapshot efectivo de walls en `t`. */
export function computeWallStateAt(
  cutscene: Cutscene,
  t: number,
  scenes: readonly SceneView[],
): WallState {
  const scene = sceneAtFromView(scenes, t);
  if (!scene) return { hiddenIds: new Set() };

  const allKfs = cutscene.walls.keyframes || [];
  const inScene = filterKfsToScene(allKfs, scene).filter((kf) => kf.t <= t + WALL_EPSILON);

  if (inScene.length > 0) {
    let best = inScene[0];
    for (const kf of inScene) {
      if (!best || kf.t > best.t) best = kf;
    }
    return { hiddenIds: new Set(best?.hiddenIds || []) };
  }

  const inherited = lastKfWithInheritance(allKfs, scene, t, [...scenes]);
  if (inherited) return { hiddenIds: new Set(inherited.hiddenIds || []) };

  return { hiddenIds: new Set() };
}
