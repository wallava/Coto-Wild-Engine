/**
 * Schemas Zod del world model: walls, props, agents, rooms, zones.
 * Usados para validation on-load y migrations.
 *
 * `unknown[][]` en wallN/wallW + `unknown` en prop top/right/left por
 * decisión: el shape concreto de wall segments y prop face data es
 * legacy ad-hoc — diferimos su tipado a una fase posterior.
 *
 * Validación de dimensiones (`wallN.length === GRID_H + 1`) NO va en
 * el schema — vive en la integración (R3).
 */

import { z } from 'zod';

const Vec2CellSchema = z.object({
  cx: z.number(),
  cy: z.number(),
});

export const RoomMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string().nullable(),
  color: z.number(),
  anchorCx: z.number(),
  anchorCy: z.number(),
}).passthrough();

export const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string().nullable(),
  color: z.number(),
  cells: z.array(Vec2CellSchema),
}).passthrough();

// h/top/right/left son requeridos para floor props pero opcionales para
// door/wall/ceiling: door props (game/migrations.ts:95) solo tienen
// {id, category, cx, cy, side, kind}. Validar shape mínimo + dejar
// runtime tolerar ausencia (mismo comportamiento del monolito).
export const PropSchema = z.object({
  id: z.string(),
  cx: z.number(),
  cy: z.number(),
  h: z.number().optional(),
  top: z.unknown().optional(),
  right: z.unknown().optional(),
  left: z.unknown().optional(),
  category: z.string(),     // 'floor' | 'wall' | 'door' | 'ceiling' | otros
  w: z.number().optional(),
  d: z.number().optional(),
  side: z.enum(['N', 'S', 'E', 'W']).optional(),
  zOffset: z.number().optional(),
  stackable: z.boolean().optional(),
  kind: z.string().optional(),
  name: z.string().optional(),
}).passthrough();

// emoji puede ser string o array de strings (multi-glyph composition).
// El monolito persiste lo que el agent tenga sin normalizar.
export const AgentSchema = z.object({
  id: z.string().min(1, 'Agent.id requerido'),
  cx: z.number(),
  cy: z.number(),
  emoji: z.union([z.string(), z.array(z.string())]).optional(),
  voiceIdx: z.number().optional(),
  needs: z.record(z.string(), z.number()).optional(),
  heldItem: z.unknown().nullable().optional(),
}).passthrough();

export const WorldSchema = z.object({
  wallN: z.array(z.array(z.unknown())),
  wallW: z.array(z.array(z.unknown())),
  wallNStyle: z.unknown().optional(),
  wallWStyle: z.unknown().optional(),
  floorColors: z.unknown().optional(),
  wallNColors: z.unknown().optional(),
  wallWColors: z.unknown().optional(),
  roomMeta: z.array(RoomMetaSchema).optional(),
  zones: z.array(ZoneSchema).optional(),
  props: z.array(PropSchema),
  agents: z.array(AgentSchema).optional(),
}).passthrough();

// Tipos exportados vía z.infer<>
export type RoomMeta = z.infer<typeof RoomMetaSchema>;
export type Zone = z.infer<typeof ZoneSchema>;
export type Prop = z.infer<typeof PropSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type World = z.infer<typeof WorldSchema>;
