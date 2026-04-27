/**
 * Helpers puros de continuidad entre planos y visibilidad de keyframes.
 * Reciben siempre la cutscene o la vista de planos por parámetro para no
 * depender de ceState ni recalcular escenas con side effects.
 */

import type { BaseKf, Cutscene, Scene, SceneView } from './model';
import { computeSceneView } from './scenes';

const SCENE_EPSILON = 0.001;

/** Devuelve el plano enriquecido equivalente cuando la llamada recibe `Scene`. */
function findSceneView(scene: Scene, scenes: SceneView[]): SceneView {
  return scenes.find((candidate) => candidate.id === scene.id) || {
    ...scene,
    idx: -1,
    duration: scene.tEnd - scene.tStart,
    sceneNum: 0,
    planoNum: 0,
    displayName: scene.name && scene.name.trim() ? scene.name : 'Plano',
  };
}

/**
 * Cadena de continuidad: plano actual y padres anteriores con mismo `escenaRootId`.
 */
export function inheritanceChain(cutscene: Cutscene, scene: Scene | null): SceneView[] {
  if (!scene) return [];
  const all = computeSceneView(cutscene);
  const current = findSceneView(scene, all);
  const chain = [current];
  if (!scene.inheritState) return chain;

  const root = scene.escenaRootId || scene.id;
  const sameScene = all
    .filter(
      (candidate) =>
        candidate.id !== scene.id &&
        candidate.tStart < scene.tStart &&
        (candidate.escenaRootId || candidate.id) === root,
    )
    .sort((a, b) => b.tStart - a.tStart);

  for (const candidate of sameScene) chain.push(candidate);
  return chain;
}

function inheritanceChainFromScenes(scene: Scene, scenes: SceneView[]): SceneView[] {
  const current = findSceneView(scene, scenes);
  const chain = [current];
  if (!scene.inheritState) return chain;

  const root = scene.escenaRootId || scene.id;
  const sameScene = scenes
    .filter(
      (candidate) =>
        candidate.id !== scene.id &&
        candidate.tStart < scene.tStart &&
        (candidate.escenaRootId || candidate.id) === root,
    )
    .sort((a, b) => b.tStart - a.tStart);

  for (const candidate of sameScene) chain.push(candidate);
  return chain;
}

/**
 * Último keyframe efectivo para `scene`, incluyendo continuidad desde padres.
 */
export function lastKfWithInheritance<Kf extends BaseKf>(
  kfs: readonly Kf[] | null | undefined,
  scene: Scene | null,
  playhead: number,
  scenes: SceneView[],
): Kf | null {
  if (!scene) return null;
  const chain = inheritanceChainFromScenes(scene, scenes);
  const chainIds = new Set(chain.map((candidate) => candidate.id));
  const candidates = (kfs || []).filter((kf) => {
    if (kf.sceneId === undefined || kf.sceneId === null) {
      return (
        chain.some((candidate) => kf.t >= candidate.tStart && kf.t < candidate.tEnd) &&
        kf.t <= playhead + SCENE_EPSILON
      );
    }
    return chainIds.has(kf.sceneId) && kf.t <= playhead + SCENE_EPSILON;
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.t - b.t);
  return candidates[candidates.length - 1] || null;
}

/**
 * Un kf es visible si su plano existe y su `t` sigue dentro del rango actual.
 */
export function kfIsVisible(kf: BaseKf, scenes: readonly Scene[]): boolean {
  if (kf.sceneId === undefined || kf.sceneId === null) return true;
  const scene = scenes.find((candidate) => candidate.id === kf.sceneId);
  if (!scene) return false;
  return kf.t >= scene.tStart - SCENE_EPSILON && kf.t < scene.tEnd + SCENE_EPSILON;
}
