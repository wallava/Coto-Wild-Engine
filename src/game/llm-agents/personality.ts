import { z } from 'zod';
import type { SystemBlock, LLMModel } from '../../llm/types';
import { wrapWorldContext, sanitizeWorldString } from '../../llm/sanitize';

export type PersonalityExample = { user: string; assistant: string };

export type PersonalityTriggers = {
  socialEncounterEnabled: boolean;
  crisisNeedThreshold: number;
  cooldownMsAfterSpeak: number;
};

export type Personality = {
  id: string;
  name: string;
  emoji: string;
  voiceIdx: number;
  model: LLMModel;
  staticSystemBlock: string;
  speakStyle: string;
  examples: PersonalityExample[];
  fallbackPhrases: string[];
  triggers: PersonalityTriggers;
};

export const PersonalityExampleSchema = z.object({
  user: z.string(),
  assistant: z.string(),
});

export const PersonalityTriggersSchema = z.object({
  socialEncounterEnabled: z.boolean(),
  crisisNeedThreshold: z.number().nonnegative(),
  cooldownMsAfterSpeak: z.number().nonnegative(),
});

export const PersonalitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  emoji: z.string().min(1),
  voiceIdx: z.number().int().nonnegative(),
  model: z.enum(['haiku-4-5', 'sonnet-4-6']),
  staticSystemBlock: z.string().min(50, 'Personality.staticSystemBlock muy corto'),
  speakStyle: z.string(),
  examples: z.array(PersonalityExampleSchema),
  fallbackPhrases: z.array(z.string()).min(5, 'Mínimo 5 fallbackPhrases'),
  triggers: PersonalityTriggersSchema,
});

export type BuildSystemBlocksContext = {
  /** Líneas dinámicas que van envueltas en <world_context>. */
  dynamicLines?: string[];
};

/**
 * Construye SystemBlock[] para CompletionOpts.
 * - Block[0]: personality.staticSystemBlock con cache='5m' (estable).
 * - Block[1] (opcional): contexto dinámico envuelto en wrapWorldContext, cache='none'.
 */
export function buildSystemBlocks(
  personality: Personality,
  context: BuildSystemBlocksContext = {},
): SystemBlock[] {
  const blocks: SystemBlock[] = [
    { text: personality.staticSystemBlock, cache: '5m' },
  ];
  const lines = context.dynamicLines ?? [];
  if (lines.length > 0) {
    const sanitized = lines.map((l) => sanitizeWorldString(l, 200)).join('\n');
    blocks.push({
      text: wrapWorldContext(sanitized),
      cache: 'none',
    });
  }
  return blocks;
}

/** Random pick de fallbackPhrases. */
export function getFallbackPhrase(personality: Personality): string {
  const phrases = personality.fallbackPhrases;
  if (phrases.length === 0) return '...';
  const idx = Math.floor(Math.random() * phrases.length);
  return phrases[idx]!;
}

/**
 * Construye el primer user message para un encuentro.
 * Incluye target + context envuelto en <world_context>.
 */
export function buildUserMessage(
  target: string,
  context: { situationLines?: string[] } = {},
): string {
  const lines = context.situationLines ?? [];
  const sanitized = lines.map((l) => sanitizeWorldString(l, 200)).join('\n');
  const wrapped = sanitized.length > 0 ? wrapWorldContext(sanitized) + '\n\n' : '';
  return `${wrapped}Te encontrás con ${sanitizeWorldString(target, 50)}. Decí algo breve, en tu estilo.`;
}
