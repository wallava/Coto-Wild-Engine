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
