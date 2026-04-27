/**
 * Transformaciones y reasignaciones de keyframes de cutscene.
 * Estas funciones operan sobre el modelo recibido por parámetro y no leen
 * estado global. Las operaciones `shift`/`warp` mutan tiempos y reordenan
 * los arrays dueños para preservar la semántica del editor legacy.
 */

import type { BaseKf, Cutscene, Scene } from './model';
import { forEachCutsceneKf } from './model';

const KEYFRAME_EPSILON = 0.001;

function sortCutsceneKeyframes(cutscene: Cutscene): void {
  cutscene.camera.keyframes.sort((a, b) => a.t - b.t);
  cutscene.walls.keyframes.sort((a, b) => a.t - b.t);

  for (const ent of cutscene.fx.entities || []) {
    ent.keyframes.sort((a, b) => a.t - b.t);
  }

  for (const track of cutscene.tracks || []) {
    track.keyframes.sort((a, b) => a.t - b.t);
  }
}

/** Mueve todos los kfs vinculados a `sceneId`, incluidos los dormidos. */
export function shiftKeyframesBySceneId(
  cutscene: Cutscene,
  sceneId: string | null | undefined,
  dt: number,
): void {
  if (!sceneId || Math.abs(dt) < KEYFRAME_EPSILON) return;

  forEachCutsceneKf(cutscene, ({ kf }) => {
    if (kf.sceneId === sceneId) kf.t += dt;
  });
  sortCutsceneKeyframes(cutscene);
}

/** Remapea tiempos de todos los kfs vinculados a `sceneId`. */
export function warpKeyframesBySceneId(
  cutscene: Cutscene,
  sceneId: string | null | undefined,
  oldStart: number,
  oldEnd: number,
  newStart: number,
  newEnd: number,
): void {
  const oldDur = oldEnd - oldStart;
  if (oldDur < KEYFRAME_EPSILON || !sceneId) return;

  const factor = (newEnd - newStart) / oldDur;
  const remap = (t: number): number => newStart + (t - oldStart) * factor;

  forEachCutsceneKf(cutscene, ({ kf }) => {
    if (kf.sceneId === sceneId) kf.t = remap(kf.t);
  });
  sortCutsceneKeyframes(cutscene);
}

/** Mueve kfs cuyo tiempo cae en el rango temporal indicado. */
export function shiftKeyframesInRange(
  cutscene: Cutscene,
  tA: number,
  tB: number,
  dt: number,
  inclusiveStart: boolean,
  inclusiveEnd: boolean,
): void {
  const inRange = (t: number): boolean => {
    const afterStart = inclusiveStart ? t >= tA - KEYFRAME_EPSILON : t > tA + KEYFRAME_EPSILON;
    const beforeEnd = inclusiveEnd ? t <= tB + KEYFRAME_EPSILON : t < tB - KEYFRAME_EPSILON;
    return afterStart && beforeEnd;
  };

  forEachCutsceneKf(cutscene, ({ kf }) => {
    if (inRange(kf.t)) kf.t += dt;
  });
  sortCutsceneKeyframes(cutscene);
}

/** Remapea kfs cuyo tiempo cae en `[oldStart, oldEnd]`. */
export function warpKeyframesInRange(
  cutscene: Cutscene,
  oldStart: number,
  oldEnd: number,
  newStart: number,
  newEnd: number,
): void {
  const oldDur = oldEnd - oldStart;
  if (oldDur < KEYFRAME_EPSILON) return;

  const factor = (newEnd - newStart) / oldDur;
  const remap = (t: number): number => newStart + (t - oldStart) * factor;
  const inRange = (t: number): boolean => t >= oldStart - KEYFRAME_EPSILON && t <= oldEnd + KEYFRAME_EPSILON;

  forEachCutsceneKf(cutscene, ({ kf }) => {
    if (inRange(kf.t)) kf.t = remap(kf.t);
  });
  sortCutsceneKeyframes(cutscene);
}

/** Filtra kfs que pertenecen al plano y siguen dentro de su rango actual. */
export function filterKfsToScene<Kf extends BaseKf>(
  kfs: readonly Kf[],
  scene: Scene | null,
): Kf[] {
  if (!scene) return [];

  return kfs.filter((kf) => {
    if (kf.sceneId !== undefined && kf.sceneId !== null) {
      if (kf.sceneId !== scene.id) return false;
      return kf.t >= scene.tStart - KEYFRAME_EPSILON && kf.t < scene.tEnd + KEYFRAME_EPSILON;
    }
    return kf.t >= scene.tStart - KEYFRAME_EPSILON && kf.t < scene.tEnd - KEYFRAME_EPSILON;
  });
}

/** Asigna `sceneId` a un kf según el plano precomputado que contiene su tiempo. */
export function assignSceneIdToKf<Kf extends BaseKf>(
  kf: Kf,
  scenes: readonly Scene[],
): Kf {
  const scene = scenes.find((candidate) => kf.t >= candidate.tStart && kf.t < candidate.tEnd);
  kf.sceneId = scene ? scene.id : null;
  return kf;
}

/** Reasigna a `newSceneId` todos los kfs cuyo tiempo cae en `[tA, tB)`. */
export function reassignKfsByTime(
  cutscene: Cutscene,
  tA: number,
  tB: number,
  newSceneId: string | null,
): void {
  const inRange = (t: number): boolean => t >= tA - KEYFRAME_EPSILON && t < tB - KEYFRAME_EPSILON;

  forEachCutsceneKf(cutscene, ({ kf }) => {
    if (inRange(kf.t)) kf.sceneId = newSceneId;
  });
}

/** Reasigna todos los kfs cuyo `sceneId` apunta a `oldId`. */
export function reassignKfsByOwnerToTarget(
  cutscene: Cutscene,
  oldId: string | null,
  newId: string | null,
): void {
  forEachCutsceneKf(cutscene, ({ kf }) => {
    if (kf.sceneId === oldId) kf.sceneId = newId;
  });
}
