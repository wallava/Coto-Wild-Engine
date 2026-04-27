/**
 * schema-ast.ts
 *
 * Zod schema del AST del DSL de cutscenes.
 * Este es el contrato canónico del AST — no del runtime Cutscene.
 * Todos los objetos son .strict() para detectar renombres del parser.
 * NO importa ./parser.ts — es independiente.
 */

import { z } from 'zod';

export const ShotKindSchema = z.enum([
  'wide_establishing',
  'medium_shot',
  'close_up',
  'two_shot',
  'over_the_shoulder',
]);

export const CameraMoveKindSchema = z.enum(['dolly_in', 'pull_out', 'pan', 'push_in']);

export const ActionVerbSchema = z.enum(['camina_a', 'mira_a', 'dice', 'anima', 'espera']);

export const CameraMoveAstSchema = z
  .object({
    kind: CameraMoveKindSchema,
    args: z.record(z.string(), z.union([z.string(), z.number()])),
  })
  .strict();

export const CameraDirectiveAstSchema = z
  .object({
    shotType: ShotKindSchema,
    subjects: z.array(z.string()),
    lens: z.number().optional(),
    move: CameraMoveAstSchema.optional(),
  })
  .strict();

export const ActionAstSchema = z
  .object({
    line: z.number(),
    time: z.number().nonnegative(),
    actor: z.string().min(1, 'ActionAst.actor requerido'),
    verb: ActionVerbSchema,
    args: z.array(z.string()),
    raw: z.string(),
  })
  .strict();

export const SceneAstSchema = z
  .object({
    title: z.string(),
    duration: z.number().positive(),
    camera: CameraDirectiveAstSchema,
    actions: z.array(ActionAstSchema),
  })
  .strict();

export const AgentAstSchema = z
  .object({
    id: z.string().min(1, 'AgentAst.id requerido'),
    location: z.string().min(1, 'AgentAst.location requerido'),
  })
  .strict();

export const FinalTransitionSchema = z.enum(['cut', 'fade']);

export const CutsceneAstSchema = z
  .object({
    title: z.string(),
    duration: z.number().positive(),
    agents: z.array(AgentAstSchema),
    scenes: z.array(SceneAstSchema),
    finalTransition: FinalTransitionSchema.optional(),
  })
  .strict();

// Tipos inferidos via z.infer<> — fuente de verdad para el resto del sistema
export type ShotKind = z.infer<typeof ShotKindSchema>;
export type CameraMoveAst = z.infer<typeof CameraMoveAstSchema>;
export type CameraDirectiveAst = z.infer<typeof CameraDirectiveAstSchema>;
export type ActionAst = z.infer<typeof ActionAstSchema>;
export type SceneAst = z.infer<typeof SceneAstSchema>;
export type AgentAst = z.infer<typeof AgentAstSchema>;
export type CutsceneAst = z.infer<typeof CutsceneAstSchema>;
