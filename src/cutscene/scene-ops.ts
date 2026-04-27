/**
 * Operaciones de drag/snap/resize sobre planos (scenes) de cutscene.
 *
 * Snap mágnetico al borde de planos vecinos, push fluido cuando se invade,
 * y resolución de solapes en mouseup. Funciones puras que reciben el
 * cutscene como parámetro y devuelven el nuevo state — el render queda
 * en el caller.
 */

import {
  shiftKeyframesBySceneId,
  warpKeyframesBySceneId,
  reassignKfsByOwnerToTarget,
} from './keyframes';
import type { Cutscene, Scene } from './model';

export const SCENE_SNAP_THRESHOLD = 0.4;
export const SCENE_SNAP_BREAKAWAY = 0.15;

/**
 * Snap del borde inicial al borde de un vecino (kind='start' = pegar a tEnd
 * de vecino) o snap del borde final (kind='end' = pegar tStart de vecino).
 * Si el target ya invade un vecino (push activo), no aplica snap — empuje
 * fluido 1-a-1 con el cursor.
 */
export function applySnapToStart(
  scenes: Scene[],
  snapEnabled: boolean,
  cutsceneDuration: number,
  targetStart: number,
  duration: number,
  excludeId: string,
): number {
  const others = scenes.filter(s => s.id !== excludeId);
  let tStart = targetStart;
  const tEnd = tStart + duration;
  const isPushing = others.some(sc =>
    tEnd > sc.tStart + 0.001 && tStart < sc.tEnd - 0.001);
  if (snapEnabled && !isPushing) {
    let bestSnap: { kind: 'start' | 'end'; target: number } | null = null;
    let bestDist = SCENE_SNAP_THRESHOLD;
    for (const sc of others) {
      const dEnd = Math.abs(tEnd - sc.tStart);
      if (dEnd < bestDist) { bestSnap = { kind: 'end', target: sc.tStart }; bestDist = dEnd; }
      const dStart = Math.abs(tStart - sc.tEnd);
      if (dStart < bestDist) { bestSnap = { kind: 'start', target: sc.tEnd }; bestDist = dStart; }
    }
    if (Math.abs(tStart) < bestDist) bestSnap = { kind: 'start', target: 0 };
    if (bestSnap) {
      if (bestSnap.kind === 'start') tStart = bestSnap.target;
      else tStart = bestSnap.target - duration;
    }
  }
  return Math.max(0, Math.min(cutsceneDuration - duration, tStart));
}

/** Snap del borde final (resize-right) al borde inicial de vecinos. */
export function applySnapToEnd(
  scenes: Scene[],
  snapEnabled: boolean,
  cutsceneDuration: number,
  tStart: number,
  targetEnd: number,
  excludeId: string,
): number {
  const others = scenes.filter(s => s.id !== excludeId);
  let tEnd = targetEnd;
  const isPushing = others.some(sc =>
    tEnd > sc.tStart + 0.001 && tStart < sc.tEnd - 0.001);
  if (snapEnabled && !isPushing) {
    let best: number | null = null;
    let bestDist = SCENE_SNAP_THRESHOLD;
    for (const sc of others) {
      const d = Math.abs(tEnd - sc.tStart);
      if (d < bestDist) { best = sc.tStart; bestDist = d; }
    }
    if (best !== null) tEnd = best;
  }
  return Math.max(tStart + 0.2, Math.min(cutsceneDuration, tEnd));
}

/** Snap del borde inicial (resize-left) al borde final de vecinos. */
export function applySnapToStartResize(
  scenes: Scene[],
  snapEnabled: boolean,
  targetStart: number,
  tEnd: number,
  excludeId: string,
): number {
  const others = scenes.filter(s => s.id !== excludeId);
  let tStart = targetStart;
  const isPushing = others.some(sc =>
    tEnd > sc.tStart + 0.001 && tStart < sc.tEnd - 0.001);
  if (snapEnabled && !isPushing) {
    let best: number | null = null;
    let bestDist = SCENE_SNAP_THRESHOLD;
    for (const sc of others) {
      const d = Math.abs(tStart - sc.tEnd);
      if (d < bestDist) { best = sc.tEnd; bestDist = d; }
    }
    if (best !== null) tStart = best;
  }
  return Math.max(0, Math.min(tEnd - 0.2, tStart));
}

/**
 * Resuelve solapes después de un move/resize: acorta vecinos invadidos.
 * Si un vecino queda completamente cubierto, se elimina del modelo Y sus
 * kfs se reasignan al plano invasor (no se pierden).
 *
 * Muta `cutscene.scenes` y los arrays de keyframes vía `reassignKfsByOwnerToTarget`.
 */
export function resolveSceneOverlaps(cutscene: Cutscene, movedSceneId: string): void {
  const all = cutscene.scenes || [];
  const moved = all.find(s => s.id === movedSceneId);
  if (!moved) return;
  for (let i = all.length - 1; i >= 0; i--) {
    const sc = all[i]!;
    if (sc.id === movedSceneId) continue;
    const overlap = Math.min(moved.tEnd, sc.tEnd) - Math.max(moved.tStart, sc.tStart);
    if (overlap <= 0.001) continue;
    const scDur = sc.tEnd - sc.tStart;
    if (overlap >= scDur - 0.05) {
      reassignKfsByOwnerToTarget(cutscene, sc.id, moved.id);
      all.splice(i, 1);
      continue;
    }
    if (moved.tStart > sc.tStart && moved.tStart < sc.tEnd) {
      sc.tEnd = moved.tStart;
    } else if (moved.tEnd > sc.tStart && moved.tEnd < sc.tEnd) {
      sc.tStart = moved.tEnd;
    } else if (moved.tStart >= sc.tStart && moved.tEnd <= sc.tEnd) {
      const dStart = moved.tStart - sc.tStart;
      const dEnd = sc.tEnd - moved.tEnd;
      if (dStart <= dEnd) sc.tStart = moved.tEnd;
      else sc.tEnd = moved.tStart;
    }
    if (sc.tEnd - sc.tStart < 0.15) {
      reassignKfsByOwnerToTarget(cutscene, sc.id, moved.id);
      all.splice(i, 1);
    }
  }
}

export type MoveSceneResult = { changed: boolean };

/**
 * Mueve un plano por `dt` aplicando snap. Muta el cutscene y los keyframes
 * vinculados (vía `shiftKeyframesBySceneId`). NO resuelve solapes — eso
 * queda para el mouseup. Retorna `{changed}` para que el caller decida si
 * re-renderizar.
 */
export function moveSceneByDt(
  cutscene: Cutscene,
  sceneId: string,
  dt: number,
  snapEnabled: boolean,
): MoveSceneResult {
  const realSc = (cutscene.scenes || []).find(s => s.id === sceneId);
  if (!realSc) return { changed: false };
  const dur = realSc.tEnd - realSc.tStart;
  const target = realSc.tStart + dt;
  const newStart = applySnapToStart(
    cutscene.scenes || [],
    snapEnabled,
    cutscene.duration,
    target,
    dur,
    realSc.id,
  );
  const realDt = newStart - realSc.tStart;
  if (Math.abs(realDt) < 0.001) return { changed: false };
  shiftKeyframesBySceneId(cutscene, realSc.id, realDt);
  realSc.tStart = newStart;
  realSc.tEnd = newStart + dur;
  return { changed: true };
}

export type ResizeMode = 'warp' | 'shift';

/** Redimensiona el borde derecho de un plano por `dt`. */
export function resizeSceneRight(
  cutscene: Cutscene,
  sceneId: string,
  dt: number,
  mode: ResizeMode,
  snapEnabled: boolean,
): MoveSceneResult {
  const realSc = (cutscene.scenes || []).find(s => s.id === sceneId);
  if (!realSc) return { changed: false };
  const oldEnd = realSc.tEnd;
  const target = oldEnd + dt;
  const newEnd = applySnapToEnd(
    cutscene.scenes || [],
    snapEnabled,
    cutscene.duration,
    realSc.tStart,
    target,
    realSc.id,
  );
  const realDt = newEnd - oldEnd;
  if (Math.abs(realDt) < 0.001) return { changed: false };
  if (mode === 'warp') {
    warpKeyframesBySceneId(cutscene, realSc.id, realSc.tStart, oldEnd, realSc.tStart, newEnd);
  }
  realSc.tEnd = newEnd;
  return { changed: true };
}

/** Redimensiona el borde izquierdo de un plano por `dt`. */
export function resizeSceneLeft(
  cutscene: Cutscene,
  sceneId: string,
  dt: number,
  mode: ResizeMode,
  snapEnabled: boolean,
): MoveSceneResult {
  const realSc = (cutscene.scenes || []).find(s => s.id === sceneId);
  if (!realSc) return { changed: false };
  const oldStart = realSc.tStart;
  const target = oldStart + dt;
  const newStart = applySnapToStartResize(
    cutscene.scenes || [],
    snapEnabled,
    target,
    realSc.tEnd,
    realSc.id,
  );
  const realDt = newStart - oldStart;
  if (Math.abs(realDt) < 0.001) return { changed: false };
  if (mode === 'warp') {
    warpKeyframesBySceneId(cutscene, realSc.id, oldStart, realSc.tEnd, newStart, realSc.tEnd);
  }
  realSc.tStart = newStart;
  return { changed: true };
}
