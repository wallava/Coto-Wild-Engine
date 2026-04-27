import type { AgentKf } from './schema';
import type { AgentPos } from './shots';
import { CELL } from '../engine/state';

export type WorldStateAtT = { agents: Map<string, AgentPos>; zones: Map<string, AgentPos>; };
export type ActionResult = { kfs: AgentKf[]; warnings: string[]; resolvedTarget?: AgentPos; };

function worldToCell(pos: AgentPos): { cx: number; cy: number } { return { cx: Math.round(pos.x / CELL), cy: Math.round(pos.z / CELL) }; }
function resolveRef(ref: string, world: WorldStateAtT): AgentPos | undefined { return world.agents.get(ref) ?? world.zones.get(ref); }

export function compileWalkAction(actorId: string, targetRef: string, t: number, sceneId: string, world: WorldStateAtT): ActionResult {
  void actorId;
  const target = resolveRef(targetRef, world);
  if (!target) return { kfs: [], warnings: [`Unable to resolve target ref: ${targetRef}`] };
  const { cx, cy } = worldToCell(target);
  const kf: AgentKf = { t, sceneId, type: 'move', cx, cy };
  return { kfs: [kf], warnings: [], resolvedTarget: target };
}

export function compileSpeakAction(actorId: string, text: string, t: number, sceneId: string): ActionResult {
  void actorId;
  const kf: AgentKf = { t, sceneId, type: 'speak', text };
  return { kfs: [kf], warnings: [] };
}

export function compileMiraAction(actorId: string, targetRef: string, t: number, sceneId: string, world: WorldStateAtT): ActionResult {
  void actorId;
  const target = resolveRef(targetRef, world);
  if (!target) return { kfs: [], warnings: [`Unable to resolve target ref: ${targetRef}`] };
  const kf: AgentKf = { t, sceneId, type: 'animation', preset: 'mira', duration: 1.0 };
  (kf as any).targetId = targetRef;
  return { kfs: [kf], warnings: [] };
}

export function compileAnimaAction(actorId: string, preset: string, t: number, sceneId: string, duration?: number): ActionResult {
  void actorId;
  const kf: AgentKf = { t, sceneId, type: 'animation', preset, duration: duration ?? 1.0 };
  return { kfs: [kf], warnings: [] };
}

export function compileEsperaAction(actorId: string, durationSeconds: number, t: number, sceneId: string): ActionResult {
  void actorId;
  void durationSeconds;
  void t;
  void sceneId;
  return { kfs: [], warnings: [] };
}
