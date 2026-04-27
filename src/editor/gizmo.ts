/**
 * Wrappers del gizmo de cámara cinemática para el editor de cutscenes.
 * Mapea ceState.cutscene.camera ↔ renderCameraGizmoPose del engine.
 */

import { renderCameraGizmoPose } from '../engine/camera-gizmo';

type Vec3 = { x: number; y: number; z: number };

type CutsceneCamera = {
  gizmoPosition?: Vec3;
  gizmoTarget?: Vec3;
  gizmoLens?: number;
  gizmoRoll?: number;
  gizmoProjection?: 'perspective' | 'orthographic';
  keyframes?: Array<{ position?: Vec3; target?: Vec3; t: number }>;
};

const DEFAULT_POS: Vec3 = { x: 0, y: 200, z: 300 };
const DEFAULT_TGT: Vec3 = { x: 0, y: 0, z: 0 };

/**
 * Re-renderiza pose actual del gizmo (frustum + handles + path de keyframes).
 * No-op si el módulo recibe `false` en `gizmoExists` (gizmo aún no creado).
 */
export function updateGizmoPose(camera: CutsceneCamera | null | undefined, gizmoExists: boolean): void {
  if (!gizmoExists || !camera) return;
  const pos = camera.gizmoPosition || DEFAULT_POS;
  const tgt = camera.gizmoTarget || DEFAULT_TGT;
  const lens = camera.gizmoLens || 50;
  const roll = camera.gizmoRoll || 0;
  const allKfs = ((camera.keyframes || []).filter(k => k.position && k.target))
    .slice()
    .sort((a, b) => a.t - b.t);
  renderCameraGizmoPose(
    { position: pos, target: tgt, lens, roll },
    allKfs.map(k => k.position as Vec3),
  );
}

/**
 * Resetea pose del gizmo a default cómodo mirando al centro.
 * Muta el objeto camera. No re-renderiza (caller debe llamar updateGizmoPose).
 */
export function resetGizmoPose(camera: CutsceneCamera): void {
  camera.gizmoPosition = { x: 200, y: 250, z: 300 };
  camera.gizmoTarget = { x: 0, y: 30, z: 0 };
  camera.gizmoLens = 50;
  camera.gizmoProjection = 'perspective';
  camera.gizmoRoll = 0;
}
