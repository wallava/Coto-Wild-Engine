/**
 * Lifecycle del editor de cutscenes: spawn/despawn de agentes, init/restore
 * de gizmo de cámara cinemática.
 *
 * `ceOpen`/`ceClose` se quedan en legacy como orchestrators porque coordinan
 * demasiados subsistemas (FX, walls, render, toolbar, POV, fade, undo) que
 * todavía están atados a closure refs. Acá viven los pedazos puros y
 * portables.
 */

import * as THREE from 'three';

type AgentLike = {
  id: string;
  mesh?: THREE.Object3D | null;
  statusMesh?: THREE.Object3D | null;
  path?: any[];
  target?: any;
  _csAgent?: boolean;
  _cutsceneAnim?: any;
};

type CutsceneAgent = {
  id: string;
  emoji?: string;
  voiceIdx?: number;
  needs?: any;
};

type Vec3 = { x: number; y: number; z: number };

type CameraState = {
  gizmoPosition?: Vec3;
  gizmoTarget?: Vec3;
  gizmoLens?: number;
  gizmoRoll?: number;
  gizmoProjection?: 'perspective' | 'orthographic';
  keyframes?: Array<{ position?: Vec3; target?: Vec3; roll?: number; lens?: number; projection?: 'perspective' | 'orthographic' }>;
};

const DEFAULT_GIZMO_POS: Vec3 = { x: 200, y: 250, z: 300 };
const DEFAULT_GIZMO_TGT: Vec3 = { x: 0, y: 30, z: 0 };

/**
 * Backup de los agentes del mundo y limpieza de meshes del scene.
 * Vacía el array `agents` (mutación in-place) y devuelve la lista snapshot.
 */
export function backupAndRemoveWorldAgents(
  agents: AgentLike[],
  scene: THREE.Scene,
): AgentLike[] {
  const backup = agents.slice();
  for (const a of agents) {
    if (a.mesh) scene.remove(a.mesh);
    if (a.statusMesh) scene.remove(a.statusMesh);
  }
  agents.length = 0;
  return backup;
}

/**
 * Restaura agentes del mundo desde backup. Repuebla `agents`, re-agrega
 * meshes al scene y limpia path/target (los agentes vuelven a IA libre).
 */
export function restoreWorldAgents(
  agents: AgentLike[],
  scene: THREE.Scene,
  backup: AgentLike[] | null,
): void {
  if (!backup) return;
  for (const a of backup) {
    agents.push(a);
    if (a.mesh) scene.add(a.mesh);
    if (a.statusMesh) scene.add(a.statusMesh);
    a.path = [];
    a.target = null;
  }
}

/**
 * Remueve todos los agentes activos del scene y vacía el array. Para
 * cleanup en ceClose antes de restore.
 */
export function despawnAllAgentsFromScene(
  agents: AgentLike[],
  scene: THREE.Scene,
): void {
  for (const a of agents) {
    if (a.mesh) scene.remove(a.mesh);
    if (a.statusMesh) scene.remove(a.statusMesh);
  }
  agents.length = 0;
}

type CutsceneTrack = {
  agentId: string;
  keyframes: Array<{ type: string; cx?: number; cy?: number }>;
};

/**
 * Spawn de los agentes propios de la cutscene. Posición inicial inferida
 * del primer kf de move en su track. Marca cada agente nuevo con
 * `_csAgent=true` para que `isCutsceneAgent()` los distinga del mundo.
 */
export function spawnCutsceneAgents(
  cutsceneAgents: CutsceneAgent[] | null | undefined,
  tracks: CutsceneTrack[],
  spawnAgent: (cx: number, cy: number, opts: any) => AgentLike | null,
): void {
  if (!Array.isArray(cutsceneAgents)) return;
  for (const csa of cutsceneAgents) {
    let cx = 0;
    let cy = 0;
    const tr = tracks.find(t => t.agentId === csa.id);
    if (tr) {
      const moveKf = tr.keyframes.find(k => k.type === 'move');
      if (moveKf && moveKf.cx !== undefined && moveKf.cy !== undefined) {
        cx = moveKf.cx;
        cy = moveKf.cy;
      }
    }
    const a = spawnAgent(cx, cy, {
      id: csa.id,
      emoji: csa.emoji,
      voiceIdx: csa.voiceIdx,
      needs: csa.needs,
      csAgent: true,
    });
    if (a) a._csAgent = true;
  }
}

/**
 * Inicializa pose del gizmo si no está seteada. Prioriza el primer kf
 * con position+target, si no usa defaults.
 * Garantiza que `gizmoRoll` esté definido (default 0).
 */
export function initCameraGizmoState(camera: CameraState): void {
  if (!camera.gizmoPosition || !camera.gizmoTarget) {
    const firstNewKf = (camera.keyframes || []).find(k => k.position && k.target);
    if (firstNewKf && firstNewKf.position && firstNewKf.target) {
      camera.gizmoPosition = { ...firstNewKf.position };
      camera.gizmoTarget = { ...firstNewKf.target };
      camera.gizmoRoll = firstNewKf.roll || 0;
      camera.gizmoLens = firstNewKf.lens || 50;
      camera.gizmoProjection = firstNewKf.projection || 'perspective';
    } else {
      camera.gizmoPosition = { ...DEFAULT_GIZMO_POS };
      camera.gizmoTarget = { ...DEFAULT_GIZMO_TGT };
      camera.gizmoRoll = 0;
      camera.gizmoLens = 50;
      camera.gizmoProjection = 'perspective';
    }
  }
  if (camera.gizmoRoll === undefined) camera.gizmoRoll = 0;
}

/**
 * Limpia _cutsceneAnim cache de cada agente. Se llama en ceClose y al pausar
 * playback para evitar estados de animación stale.
 */
export function clearCutsceneAnimCache(
  agents: AgentLike[],
  resetAgentAnim: (a: AgentLike) => void,
): void {
  for (const a of agents) {
    if (a._cutsceneAnim) {
      resetAgentAnim(a);
      a._cutsceneAnim = null;
    }
  }
}
