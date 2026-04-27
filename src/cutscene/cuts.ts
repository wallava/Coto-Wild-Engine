/**
 * Operación de inserción de cut (tijera) en una cutscene.
 *
 * Divide un plano en dos al tiempo `t`:
 * - Plano original se acorta a [tStart, t].
 * - Plano nuevo cubre [t, tEnd] heredando la escena raíz (continuidad narrativa).
 * - Inserta kf de cámara en t con `cut: true` y pose interpolada (no rompe continuidad).
 * - Reasigna kfs cuyo t cae en la mitad derecha al plano nuevo.
 * - Para tracks de agente con movimiento que cruza el cut: inserta kfs en t-0.001
 *   (cierra el plano A) y t (arranca el plano B) con celda interpolada.
 * - Para walls: si hay estado previo, inserta snapshot en t en el plano nuevo.
 */

import type { Cutscene } from './model';
import { newSceneId } from './scenes';
import { reassignKfsByTime } from './keyframes';
import { interpCameraPose } from './camera';

type CameraPose = {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  roll: number;
  lens: number;
};

type SceneAtFn = (t: number) => { id: string; tStart: number; tEnd: number; name?: string; escenaRootId?: string } | null | undefined;

/**
 * Inserta un cut en `t` dentro del plano que lo contiene.
 * Retorna `false` si t cae en gap o muy cerca del borde de un plano (<0.1s).
 *
 * Pre: caller ya hizo snapshot de undo y `ensureScenesInModel`. Esta función
 * sólo muta el modelo.
 */
export function insertCutAt(
  cutscene: Cutscene,
  t: number,
  sceneAt: SceneAtFn,
): boolean {
  const sc = sceneAt(t);
  if (!sc) return false;
  if (t - sc.tStart < 0.1 || sc.tEnd - t < 0.1) return false;

  const cam = cutscene.camera;
  const interp: CameraPose | null = interpCameraPose(cam.keyframes || [], t) as CameraPose | null;
  const camKfs = cam.keyframes || [];
  const existing = camKfs.find(k => Math.abs(k.t - t) < 0.05);
  if (!existing && interp) {
    camKfs.push({
      t, type: 'camera',
      position: { ...interp.position },
      target: { ...interp.target },
      roll: interp.roll,
      lens: interp.lens,
      projection: cam.gizmoProjection || 'perspective',
      cut: true,
      transition: 'none',
      transitionDuration: 0.5,
    } as any);
    camKfs.sort((a, b) => a.t - b.t);
  } else if (existing) {
    (existing as any).cut = true;
  }

  const oldEnd = sc.tEnd;
  const realSc = (cutscene.scenes || []).find(s => s.id === sc.id);
  if (!realSc) return false;

  realSc.tEnd = t;
  const newScene = {
    id: newSceneId(),
    tStart: t,
    tEnd: oldEnd,
    name: '',
    inheritState: true,
    escenaRootId: realSc.escenaRootId || realSc.id,
  };
  (cutscene.scenes || []).push(newScene);

  reassignKfsByTime(cutscene, t, oldEnd, newScene.id);

  // El kf de cámara recién insertado en t (cut) pertenece al plano nuevo
  const cutKf = (cam.keyframes || []).find(k => Math.abs(k.t - t) < 0.05);
  if (cutKf) (cutKf as any).sceneId = newScene.id;

  // Para cada track: si hay movimiento que cruza el cut, insertar par de kfs
  for (const tr of (cutscene.tracks || [])) {
    const moveKfs = (tr.keyframes || [])
      .filter(k => (k as any).type === 'move')
      .sort((a, b) => a.t - b.t);
    let prev: any = null;
    let next: any = null;
    for (const k of moveKfs) {
      if (k.t < t - 0.05) prev = k;
      else if (k.t > t + 0.05 && !next) next = k;
    }
    if (prev && next && prev.sceneId === sc.id && next.sceneId === newScene.id) {
      const lerp = (next.t === prev.t) ? 0 : (t - prev.t) / (next.t - prev.t);
      const cx = Math.round(prev.cx + (next.cx - prev.cx) * lerp);
      const cy = Math.round(prev.cy + (next.cy - prev.cy) * lerp);
      tr.keyframes.push({ t: t - 0.001, type: 'move', cx, cy, sceneId: sc.id } as any);
      tr.keyframes.push({ t: t, type: 'move', cx, cy, sceneId: newScene.id } as any);
      tr.keyframes.sort((a, b) => a.t - b.t);
    }
  }

  // Walls: si hay estado previo, insertar snapshot en t (plano nuevo)
  const wallsKfs = cutscene.walls?.keyframes || [];
  const sortedW = wallsKfs.slice().sort((a, b) => a.t - b.t);
  let prevW: any = null;
  for (const k of sortedW) {
    const sceneId = (k as any).sceneId;
    if (k.t <= t + 0.001 && (sceneId === sc.id || sceneId === newScene.id)) prevW = k;
    else if (k.t > t) break;
  }
  if (prevW) {
    const hasInB = sortedW.some(k => Math.abs(k.t - t) < 0.05 && (k as any).sceneId === newScene.id);
    if (!hasInB) {
      wallsKfs.push({
        t,
        hiddenIds: [...(prevW.hiddenIds || [])],
        sceneId: newScene.id,
      } as any);
      wallsKfs.sort((a, b) => a.t - b.t);
    }
  }

  return true;
}
