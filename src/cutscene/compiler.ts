/**
 * Compiler DSL → Cutscene runtime.
 *
 * Pipeline:
 *   1. Validar AST contra CutsceneAstSchema (defensivo).
 *   2. Resolver agentes iniciales: ast.agents[].location → cell vía opts.zonePositions.
 *   3. Emitir move kf inicial t=0 por cada agent (sin esto, agentes que solo
 *      speak/anima caen a (0,0) en spawnCutsceneAgents).
 *   4. Por cada AST scene:
 *      a. Calcular tStart = sum(prev durations).
 *      b. Crear runtime Scene con id nuevo + escenaRootId.
 *      c. Resolver subjects → AgentPos.
 *      d. Aplicar shotType + camera move → CameraKf(s).
 *      e. Group actions por t. Para cada grupo:
 *         - Snapshot pre-mutación del world.
 *         - Compilar todas las actions del grupo contra el snapshot.
 *         - Apply mutations post-grupo (resolvedTarget de walks).
 *   5. Construir runtime Cutscene + validar.
 *   6. finalTransition aplicado al último CameraKf.
 *
 * Acciones del mismo `t` se resuelven contra snapshot pre-grupo: dos walks
 * mutuos no dependen del orden textual.
 */

import type { CutsceneAst, ActionAst, SceneAst as SceneAstT } from './schema-ast';
import { CutsceneAstSchema } from './schema-ast';
import type { Cutscene, CameraKf, AgentKf, Scene as RuntimeScene } from './schema';
import { CutsceneSchema } from './schema';
import { newSceneId } from './scenes';
import { cellToWorld, worldToCell } from '../engine/coords';
import * as shots from './shots';
import * as moves from './camera-moves';
import * as actions from './actions';
import type { AgentPos } from './shots';

export type CompileOpts = {
  /** Map zone-id → cell donde se ubica. R3 inline-manual, R4 catálogo real. */
  zonePositions?: Map<string, { cx: number; cy: number }>;
};

export type CompileCutsceneResult =
  | { ok: true; cutscene: Cutscene; warnings: string[] }
  | { ok: false; errors: string[] };

const AST_SHOT_TO_HANDLER: Record<string, string> = {
  wide_establishing: 'wideEstablishing',
  medium_shot: 'mediumShot',
  close_up: 'closeUp',
  two_shot: 'twoShot',
  over_the_shoulder: 'overTheShoulder',
};

function resolveInitialAgents(
  ast: CutsceneAst,
  opts: CompileOpts | undefined,
  warnings: string[],
): Map<string, AgentPos> {
  const result = new Map<string, AgentPos>();
  const zoneMap = opts?.zonePositions ?? new Map();
  for (const a of ast.agents) {
    const cell = zoneMap.get(a.location);
    if (cell) {
      result.set(a.id, { id: a.id, ...cellToWorld(cell.cx, cell.cy) });
    } else {
      warnings.push(`compiler: location '${a.location}' de agent '${a.id}' no resuelta. Usando (0,0).`);
      result.set(a.id, { id: a.id, x: 0, y: 0, z: 0 });
    }
  }
  return result;
}

function emitInitialMoveKfs(
  agents: Map<string, AgentPos>,
  firstSceneId: string,
): Map<string, AgentKf[]> {
  const tracks = new Map<string, AgentKf[]>();
  for (const [id, pos] of agents) {
    const { cx, cy } = worldToCell(pos);
    tracks.set(id, [{ t: 0, sceneId: firstSceneId, type: 'move', cx, cy }]);
  }
  return tracks;
}

function applyShot(
  shotType: string,
  subjects: AgentPos[],
  lens: number | undefined,
  warnings: string[],
): { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; lens: number } | null {
  const opts = lens !== undefined ? { lens } : undefined;
  const handler = AST_SHOT_TO_HANDLER[shotType];
  if (!handler) {
    warnings.push(`compiler: shotType desconocido '${shotType}'`);
    return null;
  }
  if (handler === 'wideEstablishing') return shots.wideEstablishing(subjects, opts);
  if (handler === 'mediumShot') {
    if (subjects.length < 1) { warnings.push(`compiler: mediumShot requiere 1 subject`); return null; }
    return shots.mediumShot(subjects[0]!, opts);
  }
  if (handler === 'closeUp') {
    if (subjects.length < 1) { warnings.push(`compiler: closeUp requiere 1 subject`); return null; }
    return shots.closeUp(subjects[0]!, opts);
  }
  if (handler === 'twoShot') return shots.twoShot(subjects, opts);
  if (handler === 'overTheShoulder') {
    if (subjects.length < 2) { warnings.push(`compiler: overTheShoulder requiere 2 subjects`); return null; }
    return shots.overTheShoulder(subjects[0]!, subjects[1]!, opts);
  }
  return null;
}

function applyMove(
  moveKind: string,
  subject: AgentPos | null,
  args: Record<string, string | number>,
  warnings: string[],
) {
  if (moveKind === 'pan') return moves.pan(args);
  if (!subject) {
    warnings.push(`compiler: move '${moveKind}' requiere subject`);
    return null;
  }
  if (moveKind === 'dolly_in') return moves.dollyIn(subject, args);
  if (moveKind === 'pull_out') return moves.pullOut(subject, args);
  if (moveKind === 'push_in') return moves.pushIn(subject, args);
  warnings.push(`compiler: moveKind desconocido '${moveKind}'`);
  return null;
}

function dispatchAction(
  action: ActionAst,
  tAbs: number,
  sceneId: string,
  worldSnapshot: { agents: Map<string, AgentPos>; zones: Map<string, AgentPos> },
): { kfs: AgentKf[]; warnings: string[]; resolvedTarget?: AgentPos; actorId: string } {
  switch (action.verb) {
    case 'camina_a': {
      const target = action.args[0] ?? '';
      const r = actions.compileWalkAction(action.actor, target, tAbs, sceneId, worldSnapshot);
      return { ...r, actorId: action.actor };
    }
    case 'mira_a': {
      const target = action.args[0] ?? '';
      const r = actions.compileMiraAction(action.actor, target, tAbs, sceneId, worldSnapshot);
      return { ...r, actorId: action.actor };
    }
    case 'dice': {
      const text = action.args.join(' ');
      const r = actions.compileSpeakAction(action.actor, text, tAbs, sceneId);
      return { ...r, actorId: action.actor };
    }
    case 'anima': {
      const preset = action.args[0] ?? 'idle';
      const dur = action.args[1] !== undefined ? Number(action.args[1]) : undefined;
      const r = actions.compileAnimaAction(action.actor, preset, tAbs, sceneId, dur);
      return { ...r, actorId: action.actor };
    }
    case 'espera': {
      const dur = action.args[0] !== undefined ? Number(action.args[0]) : 0;
      const r = actions.compileEsperaAction(action.actor, dur, tAbs, sceneId);
      return { ...r, actorId: action.actor };
    }
  }
}

function processScene(
  astScene: SceneAstT,
  sceneIdx: number,
  tStart: number,
  worldAgents: Map<string, AgentPos>,
  worldZones: Map<string, AgentPos>,
  cameraKfs: CameraKf[],
  tracks: Map<string, AgentKf[]>,
  warnings: string[],
): RuntimeScene {
  const sceneId = newSceneId();
  const tEnd = tStart + astScene.duration;
  const escenaRootId = sceneId;
  const inheritState = sceneIdx > 0;
  const runtimeScene: RuntimeScene = {
    id: sceneId,
    tStart,
    tEnd,
    name: astScene.title,
    inheritState,
    escenaRootId,
  };

  // Resolver subjects de la cámara contra estado pre-scene.
  const subjects: AgentPos[] = [];
  for (const subjId of astScene.camera.subjects) {
    const pos = worldAgents.get(subjId) ?? worldZones.get(subjId);
    if (pos) subjects.push(pos);
    else warnings.push(`compiler: camera subject '${subjId}' no resuelto en scene '${astScene.title}'`);
  }

  // Aplicar shotType.
  const shot = applyShot(astScene.camera.shotType, subjects, astScene.camera.lens, warnings);

  if (astScene.camera.move) {
    const moveSubject = subjects[0] ?? null;
    const movePair = applyMove(astScene.camera.move.kind, moveSubject, astScene.camera.move.args, warnings);
    if (movePair) {
      const startKf: CameraKf = {
        t: tStart,
        sceneId,
        type: 'camera',
        position: movePair.start.position,
        target: movePair.start.target,
        lens: movePair.start.lens,
        roll: 0,
        cut: inheritState ? false : false,   // primer kf de cualquier scene NO es cut (cuts marca discontinuidad)
      };
      const endKf: CameraKf = {
        t: tEnd,
        sceneId,
        type: 'camera',
        position: movePair.end.position,
        target: movePair.end.target,
        lens: movePair.end.lens,
        roll: 0,
        cut: false,
      };
      // Marcar cut entre scenes consecutivas en el primer kf de la nueva scene.
      if (sceneIdx > 0) startKf.cut = true;
      cameraKfs.push(startKf, endKf);
    } else if (shot) {
      // Fallback: solo shot.
      const kf: CameraKf = {
        t: tStart, sceneId, type: 'camera',
        position: shot.position, target: shot.target, lens: shot.lens,
        roll: 0, cut: sceneIdx > 0,
      };
      cameraKfs.push(kf);
    }
  } else if (shot) {
    const kf: CameraKf = {
      t: tStart, sceneId, type: 'camera',
      position: shot.position, target: shot.target, lens: shot.lens,
      roll: 0, cut: sceneIdx > 0,
    };
    cameraKfs.push(kf);
  }

  // Procesar actions agrupadas por t (snapshot pre-grupo).
  const sortedActions = astScene.actions.slice().sort((a, b) => a.time - b.time);
  let i = 0;
  while (i < sortedActions.length) {
    const groupT = sortedActions[i]!.time;
    const group: ActionAst[] = [];
    while (i < sortedActions.length && sortedActions[i]!.time === groupT) {
      group.push(sortedActions[i]!);
      i++;
    }
    const tAbs = tStart + groupT;
    // Snapshot pre-grupo.
    const snapshot = {
      agents: new Map(worldAgents),
      zones: new Map(worldZones),
    };
    const pendingMutations: { actorId: string; pos: AgentPos }[] = [];
    for (const action of group) {
      const result = dispatchAction(action, tAbs, sceneId, snapshot);
      warnings.push(...result.warnings);
      if (result.kfs.length > 0) {
        const track = tracks.get(action.actor) ?? [];
        track.push(...result.kfs);
        tracks.set(action.actor, track);
      }
      if (result.resolvedTarget) {
        pendingMutations.push({ actorId: action.actor, pos: { ...result.resolvedTarget, id: action.actor } });
      }
    }
    // Apply mutations post-grupo.
    for (const mut of pendingMutations) {
      worldAgents.set(mut.actorId, mut.pos);
    }
  }

  return runtimeScene;
}

export function compileCutscene(ast: CutsceneAst, opts?: CompileOpts): CompileCutsceneResult {
  // 1. Validar AST.
  const astValidation = CutsceneAstSchema.safeParse(ast);
  if (!astValidation.success) {
    return {
      ok: false,
      errors: astValidation.error.issues.map((i) => `AST inválido: ${i.path.join('.')} ${i.message}`),
    };
  }

  const warnings: string[] = [];

  // 2. Resolver agentes iniciales.
  const worldAgents = resolveInitialAgents(ast, opts, warnings);
  const worldZones = new Map<string, AgentPos>();
  if (opts?.zonePositions) {
    for (const [zid, cell] of opts.zonePositions) {
      worldZones.set(zid, { id: zid, ...cellToWorld(cell.cx, cell.cy) });
    }
  }

  // 3. Setup runtime containers.
  const cameraKfs: CameraKf[] = [];
  const runtimeScenes: RuntimeScene[] = [];

  // 4. Procesar scenes en orden.
  const tracks = emitInitialMoveKfs(worldAgents, '__placeholder__');   // sceneId real se asigna abajo
  let tStart = 0;
  for (let i = 0; i < ast.scenes.length; i++) {
    const astScene = ast.scenes[i]!;
    const runtimeScene = processScene(
      astScene, i, tStart, worldAgents, worldZones, cameraKfs, tracks, warnings,
    );
    runtimeScenes.push(runtimeScene);
    if (i === 0) {
      // Reasignar sceneId del kf init t=0 a la primera scene.
      for (const [, kfs] of tracks) {
        for (const kf of kfs) {
          if (kf.t === 0 && kf.sceneId === '__placeholder__') {
            kf.sceneId = runtimeScene.id;
          }
        }
      }
    }
    tStart += astScene.duration;
  }

  // 5. Validación de duración.
  if (Math.abs(tStart - ast.duration) > 0.01) {
    warnings.push(`compiler: suma de scene durations (${tStart}s) != ast.duration (${ast.duration}s)`);
  }

  // 6. finalTransition al último CameraKf si aplica.
  if (ast.finalTransition && cameraKfs.length > 0) {
    const lastKf = cameraKfs[cameraKfs.length - 1]!;
    lastKf.transition = ast.finalTransition;
    lastKf.transitionDuration = 0.5;
  }

  // 7. Ensamblar runtime Cutscene.
  const cutscene = {
    duration: ast.duration,
    scenes: runtimeScenes,
    camera: { keyframes: cameraKfs.sort((a, b) => a.t - b.t), parentAgentId: null },
    walls: { keyframes: [] },
    fx: { entities: [] },
    tracks: Array.from(tracks.entries()).map(([agentId, kfs]) => ({
      agentId,
      keyframes: kfs.sort((a, b) => a.t - b.t),
    })),
    agents: ast.agents.map((a) => ({ id: a.id })),
  };

  // 8. Validar contra CutsceneSchema.
  const validation = CutsceneSchema.safeParse(cutscene);
  if (!validation.success) {
    return {
      ok: false,
      errors: validation.error.issues.map((i) => `Cutscene runtime inválido: ${i.path.join('.')} ${i.message}`),
    };
  }

  return { ok: true, cutscene: validation.data, warnings };
}
