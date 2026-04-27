/**
 * Modelo de planos de cutscene.
 * Las funciones `compute*`/`sceneAt` son puras; las funciones `ensure*` y
 * `migrate*` normalizan el modelo legacy de forma explícita.
 */

import type { Cutscene, Scene, SceneView } from './model';
import { forEachCutsceneKf } from './model';

const SCENE_EPSILON = 0.001;

/** Crea un id de plano compatible con el formato legacy. */
export function newSceneId(): string {
  return 'sc_' + Math.random().toString(36).slice(2, 8);
}

/** Asegura invariantes mínimas del arreglo `scenes` sin migrar keyframes. */
export function ensureSceneConsistency(cutscene: Cutscene): void {
  if (!cutscene.scenes) cutscene.scenes = [];
  if (cutscene.scenes.length === 0) {
    cutscene.scenes.push({
      id: newSceneId(),
      tStart: 0,
      tEnd: cutscene.duration,
      name: '',
      inheritState: false,
    });
  }

  const sorted = cutscene.scenes.slice().sort((a, b) => a.tStart - b.tStart);

  for (let i = 0; i < sorted.length; i++) {
    const scene = sorted[i];
    if (!scene) continue;
    if (scene.inheritState === undefined) scene.inheritState = i > 0;
  }

  const first = sorted[0];
  if (first && first.inheritState) {
    first.inheritState = false;
    first.escenaRootId = first.id;
  }

  let currentRoot: string | null = null;
  for (const scene of sorted) {
    if (!scene.inheritState) {
      currentRoot = scene.id;
      if (scene.escenaRootId !== scene.id) scene.escenaRootId = scene.id;
    } else if (!scene.escenaRootId) {
      scene.escenaRootId = currentRoot || scene.id;
    }
  }
}

/** Devuelve la vista ordenada/enriquecida de planos sin mutar el modelo. */
export function computeSceneView(cutscene: Cutscene): SceneView[] {
  const sorted = (cutscene.scenes || []).slice().sort((a, b) => a.tStart - b.tStart);
  const rootToSceneNum = new Map<string, number>();
  let nextSceneNum = 0;

  for (const scene of sorted) {
    const root = scene.escenaRootId || scene.id;
    if (!rootToSceneNum.has(root)) {
      nextSceneNum++;
      rootToSceneNum.set(root, nextSceneNum);
    }
  }

  const planoCounter = new Map<string, number>();
  return sorted.map((scene, idx) => {
    const root = scene.escenaRootId || scene.id;
    const sceneNum = rootToSceneNum.get(root) ?? 0;
    const planoNum = (planoCounter.get(root) || 0) + 1;
    planoCounter.set(root, planoNum);

    return {
      ...scene,
      idx,
      duration: scene.tEnd - scene.tStart,
      sceneNum,
      planoNum,
      displayName: scene.name && scene.name.trim() ? scene.name : `Plano ${planoNum}`,
    };
  });
}

/** Busca el plano activo en `t`, o null si el playhead cae en un gap. */
export function sceneAt(cutscene: Cutscene, t: number): SceneView | null {
  const scenes = computeSceneView(cutscene);
  for (const scene of scenes) {
    if (t >= scene.tStart && t < scene.tEnd) return scene;
  }
  return null;
}

/**
 * Migra cutscenes viejas sin `scenes`, usando los cuts de cámara como fuente.
 */
export function ensureScenesInModel(cutscene: Cutscene): void {
  if (!cutscene.scenes || cutscene.scenes.length === 0) {
    const dur = cutscene.duration;
    const cutTimes = [0];
    for (const kf of cutscene.camera.keyframes || []) {
      if (kf.cut && kf.t > 0.001 && kf.t < dur - 0.001) {
        if (!cutTimes.some((t) => Math.abs(t - kf.t) < 0.05)) cutTimes.push(kf.t);
      }
    }
    cutTimes.sort((a, b) => a - b);

    const scenes: Scene[] = [];
    const namesMap = cutscene.sceneNames || {};
    for (let i = 0; i < cutTimes.length; i++) {
      const tStart = cutTimes[i];
      if (tStart === undefined) continue;
      const tEnd = i < cutTimes.length - 1 ? cutTimes[i + 1] : dur;
      if (tEnd === undefined) continue;
      const nameKey = tStart.toFixed(2);
      scenes.push({
        id: newSceneId(),
        tStart,
        tEnd,
        name: namesMap[nameKey] || '',
        inheritState: i > 0,
      });
    }

    if (scenes.length === 0) {
      scenes.push({ id: newSceneId(), tStart: 0, tEnd: dur, name: '', inheritState: false });
    }
    cutscene.scenes = scenes;
  }

  ensureSceneConsistency(cutscene);
  migrateKfsToScenes(cutscene);
}

/** Asigna `sceneId` faltante a keyframes legacy según el plano que contiene su `t`. */
export function migrateKfsToScenes(cutscene: Cutscene): void {
  const ownerOf = (time: number): string | null => {
    const scene = (cutscene.scenes || []).find(
      (candidate) =>
        time >= candidate.tStart - SCENE_EPSILON &&
        time < candidate.tEnd - SCENE_EPSILON,
    );
    return scene ? scene.id : null;
  };

  forEachCutsceneKf(cutscene, ({ kf }) => {
    if (kf.sceneId === undefined) kf.sceneId = ownerOf(kf.t);
  });
}
