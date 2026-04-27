/**
 * Helpers de runtime de cutscenes.
 *
 * Limitado a side-effects sobre `THREE.PerspectiveCamera` cinemática y queries
 * de estado (locked / controlled). El body principal de `ceUpdate` (orden
 * per-frame: walls → agentes → cámara interp → fx → fade) queda en legacy.ts
 * hasta que pueda extraerse preservando el orden exacto (Codex review previa
 * marcó este split como NO-low-risk).
 */

import type * as THREE from 'three';
import type { FxInstance } from './fx';

/** Cache para evitar `updateProjectionMatrix()` redundantes (causaba flicker). */
export type CinematicCameraCache = {
  posX: number; posY: number; posZ: number;
  tgtX: number; tgtY: number; tgtZ: number;
  roll: number; lens: number; aspect: number;
};

export function createCinematicCameraCache(): CinematicCameraCache {
  return {
    posX: NaN, posY: NaN, posZ: NaN,
    tgtX: NaN, tgtY: NaN, tgtZ: NaN,
    roll: NaN, lens: NaN, aspect: NaN,
  };
}

type Vec3 = { x: number; y: number; z: number };

/**
 * Aplica pose+lens+roll+aspect a la cámara cinemática solo si algo cambió.
 * Retorna `true` si efectivamente actualizó la cámara, `false` si fue no-op.
 */
export function applyPoseToCinematicCamera(
  camera: THREE.PerspectiveCamera,
  viewW: number,
  viewH: number,
  cache: CinematicCameraCache,
  pos: Vec3,
  tgt: Vec3,
  roll: number,
  lens: number,
): boolean {
  const aspect = viewW / viewH;
  const same = (
    pos.x === cache.posX && pos.y === cache.posY && pos.z === cache.posZ &&
    tgt.x === cache.tgtX && tgt.y === cache.tgtY && tgt.z === cache.tgtZ &&
    roll === cache.roll && lens === cache.lens && aspect === cache.aspect
  );
  if (same) return false;
  cache.posX = pos.x; cache.posY = pos.y; cache.posZ = pos.z;
  cache.tgtX = tgt.x; cache.tgtY = tgt.y; cache.tgtZ = tgt.z;
  cache.roll = roll; cache.lens = lens; cache.aspect = aspect;
  const fx = tgt.x - pos.x, fy = tgt.y - pos.y, fz = tgt.z - pos.z;
  const flen = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
  const fxn = fx / flen, fyn = fy / flen, fzn = fz / flen;
  const cR = Math.cos(roll), sR = Math.sin(roll);
  const dot = fyn;
  const upX = (fzn) * sR + fxn * dot * (1 - cR);
  const upY = cR + fyn * dot * (1 - cR);
  const upZ = (-fxn) * sR + fzn * dot * (1 - cR);
  camera.up.set(upX, upY, upZ);
  camera.position.set(pos.x, pos.y, pos.z);
  camera.lookAt(tgt.x, tgt.y, tgt.z);
  const fovDeg = 2 * Math.atan(36 / (2 * lens)) * 180 / Math.PI;
  camera.fov = fovDeg;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  return true;
}

/**
 * Cámara real está bloqueada cuando el editor está abierto Y el POV
 * cinemático está activo. updateOrtho/updateAgents lo respetan.
 */
export function isCameraLocked(editorOpen: boolean, povActive: boolean): boolean {
  return editorOpen && povActive;
}

/**
 * Mientras el editor está abierto, NINGÚN agente toma decisiones autónomas.
 * Si el usuario los dragea, ese drag tiene prioridad. Si hay playback,
 * `ceUpdate` los maneja. Si no, quedan donde estén.
 */
export function isCutsceneControlled(editorOpen: boolean): boolean {
  return editorOpen;
}

type GizmoCamera = {
  povActive?: boolean;
  keyframes?: Array<{ position?: any; target?: any }>;
  gizmoPosition?: any;
  gizmoTarget?: any;
  gizmoRoll?: number;
  gizmoLens?: number;
};

/**
 * POV early gizmo apply: cuando POV está activo y NO hay aplicación de kfs
 * (o no hay keyframes), aplica la pose del gizmo a la cámara cinemática.
 * Permite que WASD/QE/RF afecten el render sin recomputar walls/agentes/fx
 * cada frame (que causaba flicker).
 *
 * Equivalencia con legacy:4275-4290 — no cambiar la condición
 * `useGizmoPose || kfs.length === 0`.
 *
 * No envuelve try/catch: el caller (legacy) lo hace para no cortar el
 * resto del frame en caso de error.
 */
export function applyPovEarlyGizmoPose(
  camera: GizmoCamera | null | undefined,
  applyKfs: boolean,
  gizmoDrag: boolean,
  applyToCamera: (pos: any, tgt: any, roll: number, lens: number) => void,
): void {
  if (!camera || !camera.povActive) return;
  const useGizmoPose = !applyKfs && !gizmoDrag;
  const kfs = (camera.keyframes || []).filter(k => k.position && k.target);
  if (useGizmoPose || kfs.length === 0) {
    applyToCamera(
      camera.gizmoPosition,
      camera.gizmoTarget,
      camera.gizmoRoll || 0,
      camera.gizmoLens || 50,
    );
  }
}

type FxEntity = {
  id: string;
  kind?: string;
  duration?: number;
  keyframes?: Array<{ t: number; target?: any }>;
};

type FxTarget = any;

/**
 * Evalúa el estado de FX en un frame: spawn los activos en el plano actual,
 * actualiza su posición/progress, y despawn los que dejaron de estar activos.
 *
 * Cada plano es isla: solo activamos FX cuyos kfs caen en el plano actual
 * (vía `filterKfsToScene`).
 *
 * No envuelve try/catch: el caller (legacy) lo hace para preservar el orden
 * de evaluación per-frame en caso de error.
 *
 * Orden vs camera interp: este helper debe ejecutarse DESPUÉS del bloque
 * de cámara cinemática y ANTES del fade overlay (legacy:4503-4553).
 */
export function evaluateFxOnFrame(
  fxEntities: FxEntity[] | null | undefined,
  currentScene: any,
  playhead: number,
  activeFxInstances: Map<string, FxInstance>,
  filterKfsToScene: (kfs: any[], scene: any) => any[],
  fxPresets: Record<string, { duration: number }>,
  spawnFn: (kf: { fx: string }) => FxInstance | null,
  despawnFn: (inst: FxInstance) => void,
  updateFn: (kf: { fx: string; target: FxTarget; duration: number }, inst: FxInstance, progress: number) => void,
  interpolateTarget: (t1: FxTarget, t2: FxTarget, lerp: number) => FxTarget,
): void {
  const entities = fxEntities ?? [];
  const activeIds = new Set<string>();
  for (const ent of entities) {
    if (!ent.keyframes || ent.keyframes.length === 0) continue;
    const kfsInScene = filterKfsToScene(ent.keyframes, currentScene);
    if (kfsInScene.length === 0) continue;
    const dur = ent.duration || fxPresets[ent.kind || 'smoke']?.duration || 3.0;
    const firstT = kfsInScene[0]!.t;
    const lastT = kfsInScene[kfsInScene.length - 1]!.t;
    const endT = lastT + dur;
    if (playhead >= firstT && playhead < endT) {
      activeIds.add(ent.id);
      let inst: FxInstance | null | undefined = activeFxInstances.get(ent.id);
      if (!inst) {
        inst = spawnFn({ fx: ent.kind || 'smoke' });
        if (inst) activeFxInstances.set(ent.id, inst);
      }
      if (inst) {
        let prev: any = null;
        let next: any = null;
        for (let i = 0; i < kfsInScene.length; i++) {
          if (kfsInScene[i].t <= playhead) prev = kfsInScene[i];
          else { next = kfsInScene[i]; break; }
        }
        let target: FxTarget = null;
        if (prev && next) {
          const lerp = (next.t === prev.t) ? 0 : (playhead - prev.t) / (next.t - prev.t);
          target = interpolateTarget(prev.target, next.target, lerp);
        } else if (prev) target = prev.target;
        else if (next) target = next.target;
        const totalDur = endT - firstT;
        const progress = totalDur > 0 ? (playhead - firstT) / totalDur : 0;
        updateFn({ fx: ent.kind || 'smoke', target, duration: totalDur }, inst, progress);
      }
    }
  }
  for (const [id, inst] of activeFxInstances.entries()) {
    if (!activeIds.has(id)) {
      despawnFn(inst);
      activeFxInstances.delete(id);
    }
  }
}

type CamFadeKf = { t: number; cut?: boolean; transition?: string; transitionDuration?: number };

/**
 * Calcula la opacidad del overlay de fade entre cuts. Pura.
 *
 * Si POV no está activo, devuelve 0 (sin fade en el editor sin POV — no
 * oscurece la vista). Si está activo, busca kfs con `cut: true` +
 * `transition: 'fade'` y devuelve el opacity máximo según distancia al
 * playhead (1 = pleno fade, 0 = fuera de rango).
 */
export function computeFadeOpacity(
  camKeyframes: CamFadeKf[] | null | undefined,
  playhead: number,
  povActive: boolean,
): number {
  if (!povActive) return 0;
  let opacity = 0;
  for (const kf of camKeyframes || []) {
    if (kf.cut && kf.transition === 'fade') {
      const fadeRange = (kf.transitionDuration && kf.transitionDuration > 0) ? kf.transitionDuration : 0.5;
      const dist = Math.abs(kf.t - playhead);
      if (dist < fadeRange) {
        const a = 1 - (dist / fadeRange);
        if (a > opacity) opacity = a;
      }
    }
  }
  return opacity;
}
