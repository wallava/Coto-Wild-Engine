/**
 * Modelo serializable base del editor/runtime de cutscenes.
 * Este archivo no conoce DOM, Three.js ni ceState: solo tipos y caminatas
 * sobre keyframes para que las operaciones compartidas no dupliquen loops.
 */

export type SceneId = string | null;

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type Scene = {
  id: string;
  tStart: number;
  tEnd: number;
  name: string;
  inheritState?: boolean;
  escenaRootId?: string;
};

export type SceneView = Scene & {
  idx: number;
  duration: number;
  sceneNum: number;
  planoNum: number;
  displayName: string;
};

export type BaseKf = {
  t: number;
  sceneId?: SceneId;
  type?: string;
};

export type CameraKf = BaseKf & {
  type?: 'camera';
  position?: Vec3 | null;
  target?: Vec3 | null;
  lens?: number;
  projection?: 'orto' | 'perspective' | string;
  roll?: number;
  cut?: boolean;
  transition?: string;
  transitionDuration?: number;
};

export type WallKf = BaseKf & {
  hiddenIds?: string[];
};

export type FxTarget =
  | { kind: 'agent'; id: string }
  | { kind: 'cell'; cx: number; cy: number }
  | { kind: string; [key: string]: unknown };

export type FxKf = BaseKf & {
  target?: FxTarget | null;
  fx?: string;
  duration?: number;
};

export type FxEntity = {
  id: string;
  kind: string;
  duration?: number;
  keyframes: FxKf[];
};

export type AgentKf = BaseKf & {
  type: 'move' | 'speak' | 'animation' | string;
  cx?: number;
  cy?: number;
  text?: string;
  preset?: string;
  duration?: number;
};

export type AgentTrack = {
  agentId: string;
  keyframes: AgentKf[];
  lastTriggeredT?: number;
};

export type CutsceneAgent = {
  id: string;
  emoji?: string;
  voiceIdx?: number;
};

export type Cutscene = {
  duration: number;
  scenes?: Scene[];
  sceneNames?: Record<string, string>;
  camera: {
    keyframes: CameraKf[];
    povActive?: boolean;
    parentAgentId?: string | null;
    gizmoProjection?: 'orto' | 'perspective' | string;
  };
  walls: {
    keyframes: WallKf[];
  };
  fx: {
    entities?: FxEntity[];
  };
  tracks: AgentTrack[];
  agents: CutsceneAgent[];
};

export type CutsceneKf = CameraKf | WallKf | FxKf | AgentKf;

export type CutsceneKfOwner =
  | {
      kf: CameraKf;
      ownerKind: 'camera';
      ownerId: 'camera';
    }
  | {
      kf: WallKf;
      ownerKind: 'walls';
      ownerId: 'walls';
    }
  | {
      kf: FxKf;
      ownerKind: 'fx';
      ownerId: string;
      fxEntityIdx: number;
    }
  | {
      kf: AgentKf;
      ownerKind: 'agent';
      ownerId: string;
      trackIdx: number;
    };

/**
 * Recorre todos los keyframes de una cutscene con metadata del dueño.
 */
export function forEachCutsceneKf(
  cutscene: Cutscene,
  fn: (ctx: CutsceneKfOwner) => void,
): void {
  for (const kf of cutscene.camera.keyframes || []) {
    fn({ kf, ownerKind: 'camera', ownerId: 'camera' });
  }

  for (const kf of cutscene.walls.keyframes || []) {
    fn({ kf, ownerKind: 'walls', ownerId: 'walls' });
  }

  const fxEntities = cutscene.fx.entities || [];
  for (let fxEntityIdx = 0; fxEntityIdx < fxEntities.length; fxEntityIdx++) {
    const ent = fxEntities[fxEntityIdx];
    if (!ent) continue;
    for (const kf of ent.keyframes || []) {
      fn({ kf, ownerKind: 'fx', ownerId: ent.id, fxEntityIdx });
    }
  }

  for (let trackIdx = 0; trackIdx < cutscene.tracks.length; trackIdx++) {
    const track = cutscene.tracks[trackIdx];
    if (!track) continue;
    for (const kf of track.keyframes || []) {
      fn({ kf, ownerKind: 'agent', ownerId: track.agentId, trackIdx });
    }
  }
}
