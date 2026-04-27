/**
 * Interpolación pura de cámara de cutscene.
 * Recibe los keyframes por parámetro y no conoce editor, DOM ni ceState.
 */

import type { CameraKf, Vec3 } from './model';

export type CameraPose = {
  position: Vec3;
  target: Vec3;
  roll: number;
  lens: number;
};

function cloneVec3(vec: Vec3): Vec3 {
  return { x: vec.x, y: vec.y, z: vec.z };
}

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerpNumber(a.x, b.x, t),
    y: lerpNumber(a.y, b.y, t),
    z: lerpNumber(a.z, b.z, t),
  };
}

/** Devuelve la pose interpolada en `t`, o null si no hay kfs completos. */
export function interpCameraPose(cameraKfs: readonly CameraKf[], t: number): CameraPose | null {
  const kfs = cameraKfs
    .filter((kf): kf is CameraKf & { position: Vec3; target: Vec3 } => Boolean(kf.position && kf.target))
    .slice()
    .sort((a, b) => a.t - b.t);

  if (kfs.length === 0) return null;

  let prev: (CameraKf & { position: Vec3; target: Vec3 }) | null = null;
  let next: (CameraKf & { position: Vec3; target: Vec3 }) | null = null;

  for (const kf of kfs) {
    if (kf.t <= t) prev = kf;
    else {
      next = kf;
      break;
    }
  }

  if (prev && next && !next.cut) {
    const amount = next.t === prev.t ? 0 : (t - prev.t) / (next.t - prev.t);
    return {
      position: lerpVec3(prev.position, next.position, amount),
      target: lerpVec3(prev.target, next.target, amount),
      roll: lerpNumber(prev.roll || 0, next.roll || 0, amount),
      lens: lerpNumber(prev.lens || 50, next.lens || 50, amount),
    };
  }

  if (prev) {
    return {
      position: cloneVec3(prev.position),
      target: cloneVec3(prev.target),
      roll: prev.roll || 0,
      lens: prev.lens || 50,
    };
  }

  if (next) {
    return {
      position: cloneVec3(next.position),
      target: cloneVec3(next.target),
      roll: next.roll || 0,
      lens: next.lens || 50,
    };
  }

  return null;
}
