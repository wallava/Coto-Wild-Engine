/**
 * Schemas Zod del modelo de cutscene: scenes, keyframes (camera/walls/fx/agent),
 * tracks, agents, container Cutscene. Usados para validation on-load y
 * migrations.
 *
 * `passthrough()` en kfs preserva campos legacy (no aborta carga).
 * Migration vendrá en R4 para limpiar campos rotos / regenerar sceneId.
 *
 * `SceneSchema` es schema **canonico post-edición** — durante drag, scenes
 * pueden tener `tEnd === tStart` transitorio. Validar solo cutscenes
 * persistidas.
 */

import { z } from 'zod';

// ── Primitivos ───────────────────────────────────────────────────────

export const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const SceneIdSchema = z.string().nullable().optional();

// ── Scene ────────────────────────────────────────────────────────────

export const SceneSchema = z
  .object({
    id: z.string().min(1, 'Scene.id requerido'),
    tStart: z.number().nonnegative(),
    tEnd: z.number(),
    name: z.string(),
    inheritState: z.boolean().optional(),
    escenaRootId: z.string().optional(),
  })
  .passthrough()
  .refine((s) => s.tEnd > s.tStart, {
    message: 'Scene.tEnd debe ser > tStart (post-edición canónica)',
  });

// ── Keyframes base ───────────────────────────────────────────────────

const BaseKfShape = {
  t: z.number().nonnegative(),
  sceneId: SceneIdSchema,
  type: z.string().optional(),
};

// ── Camera ───────────────────────────────────────────────────────────

export const CameraKfSchema = z
  .object({
    ...BaseKfShape,
    type: z.literal('camera').optional(),
    position: Vec3Schema.nullable().optional(),
    target: Vec3Schema.nullable().optional(),
    lens: z.number().optional(),
    projection: z.string().optional(),
    roll: z.number().optional(),
    cut: z.boolean().optional(),
    transition: z.string().optional(),
    transitionDuration: z.number().optional(),
  })
  .passthrough();

// ── Walls ────────────────────────────────────────────────────────────

export const WallsKfSchema = z
  .object({
    ...BaseKfShape,
    hiddenIds: z.array(z.string()).optional(),
  })
  .passthrough();

// ── FX target / kf / entity ──────────────────────────────────────────

const FxAgentTargetSchema = z.object({
  kind: z.literal('agent'),
  id: z.string().min(1, 'FxTarget(agent).id requerido'),
});

const FxCellTargetSchema = z.object({
  kind: z.literal('cell'),
  cx: z.number(),
  cy: z.number(),
});

// Catch-all: kinds nuevos no listados. Excluye `agent` y `cell` incompletos
// para evitar que un target malformado pase por la rama genérica.
const FxGenericTargetSchema = z
  .object({ kind: z.string() })
  .passthrough()
  .refine((v) => v.kind !== 'agent' && v.kind !== 'cell', {
    message: 'Usar FxAgentTarget o FxCellTarget para kind agent/cell',
  });

export const FxTargetSchema = z.union([
  FxAgentTargetSchema,
  FxCellTargetSchema,
  FxGenericTargetSchema,
]);

export const FxKfSchema = z
  .object({
    ...BaseKfShape,
    target: FxTargetSchema.nullable().optional(),
    fx: z.string().optional(),
    duration: z.number().optional(),
  })
  .passthrough();

export const FxEntitySchema = z
  .object({
    id: z.string().min(1, 'FxEntity.id requerido'),
    kind: z.string(),
    duration: z.number().optional(),
    keyframes: z.array(FxKfSchema),
  })
  .passthrough();

// ── Agent track / kf ─────────────────────────────────────────────────

// `type` es string libre (`move`, `speak`, `animation`, o futuros). Validar
// payload por type queda al runtime — el schema solo garantiza shape
// mínimo + presencia de `type`. Migration de R4 manejará kfs legacy sin
// type.
export const AgentKfSchema = z
  .object({
    ...BaseKfShape,
    type: z.string().min(1, 'AgentKf.type requerido'),
    cx: z.number().optional(),
    cy: z.number().optional(),
    text: z.string().optional(),
    preset: z.string().optional(),
    duration: z.number().optional(),
  })
  .passthrough();

export const AgentTrackSchema = z
  .object({
    agentId: z.string().min(1, 'AgentTrack.agentId requerido'),
    keyframes: z.array(AgentKfSchema),
    lastTriggeredT: z.number().optional(),
  })
  .passthrough();

// ── Cutscene container ──────────────────────────────────────────────

export const CutsceneAgentSchema = z
  .object({
    id: z.string().min(1, 'CutsceneAgent.id requerido'),
    // emoji puede ser string o array de strings (multi-glyph) — paridad world AgentSchema.
    emoji: z.union([z.string(), z.array(z.string())]).optional(),
    voiceIdx: z.number().optional(),
  })
  .passthrough();

export const CutsceneSchema = z
  .object({
    duration: z.number().positive('Cutscene.duration debe ser > 0'),
    scenes: z.array(SceneSchema).optional(),
    sceneNames: z.record(z.string(), z.string()).optional(),
    camera: z
      .object({
        keyframes: z.array(CameraKfSchema),
        povActive: z.boolean().optional(),
        parentAgentId: z.string().nullable().optional(),
        gizmoProjection: z.string().optional(),
      })
      .passthrough(),
    walls: z
      .object({
        keyframes: z.array(WallsKfSchema),
      })
      .passthrough(),
    fx: z
      .object({
        entities: z.array(FxEntitySchema).optional(),
      })
      .passthrough(),
    tracks: z.array(AgentTrackSchema),
    agents: z.array(CutsceneAgentSchema),
  })
  .passthrough();

// ── Tipos exportados vía z.infer<> ─────────────────────────────────

export type Vec3 = z.infer<typeof Vec3Schema>;
export type Scene = z.infer<typeof SceneSchema>;
export type CameraKf = z.infer<typeof CameraKfSchema>;
export type WallsKf = z.infer<typeof WallsKfSchema>;
export type FxTarget = z.infer<typeof FxTargetSchema>;
export type FxKf = z.infer<typeof FxKfSchema>;
export type FxEntity = z.infer<typeof FxEntitySchema>;
export type AgentKf = z.infer<typeof AgentKfSchema>;
export type AgentTrack = z.infer<typeof AgentTrackSchema>;
export type CutsceneAgent = z.infer<typeof CutsceneAgentSchema>;
export type Cutscene = z.infer<typeof CutsceneSchema>;
