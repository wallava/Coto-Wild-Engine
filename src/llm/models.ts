/**
 * Mapping alias interno → ID oficial de la API + pricing real.
 * El cliente NUNCA pasa el alias a la API. Siempre usa MODEL_API_IDS[alias].
 */

import type { LLMModel } from './types';

export const MODEL_API_IDS: Record<LLMModel, string> = {
  'haiku-4-5': 'claude-haiku-4-5-20251001',
  'sonnet-4-6': 'claude-sonnet-4-6',
};

/**
 * Pricing en USD por millón de tokens.
 *
 * Precios verificados abril 2026:
 * - Haiku 4.5: $1/$5 base, $0.10 cache hit, $1.25 cache write 5m, $2.00 cache write 1h.
 * - Sonnet 4.6: $3/$15 base, $0.30 cache hit, $3.75 cache write 5m, $6.00 cache write 1h.
 *
 * Cache hit cost = 10% del input base.
 * Cache write 5m = 1.25x input base.
 * Cache write 1h = 2.00x input base.
 */
export const MODEL_PRICING: Record<LLMModel, {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWrite5mPerMTok: number;
  cacheWrite1hPerMTok: number;
}> = {
  'haiku-4-5': {
    inputPerMTok: 1.00,
    outputPerMTok: 5.00,
    cacheReadPerMTok: 0.10,
    cacheWrite5mPerMTok: 1.25,
    cacheWrite1hPerMTok: 2.00,
  },
  'sonnet-4-6': {
    inputPerMTok: 3.00,
    outputPerMTok: 15.00,
    cacheReadPerMTok: 0.30,
    cacheWrite5mPerMTok: 3.75,
    cacheWrite1hPerMTok: 6.00,
  },
};

/**
 * Tokens mínimos para que prompt caching sea efectivo.
 * Anthropic rechaza cache_control si el bloque es menor.
 *
 * - Haiku 4.5: 4096 tokens.
 * - Sonnet 4.6: 2048 tokens.
 * - (Sonnet 4.5 / Sonnet 4 / Opus 4.x: 1024 tokens, no usados acá.)
 */
export const MODEL_MIN_CACHEABLE_TOKENS: Record<LLMModel, number> = {
  'haiku-4-5': 4096,
  'sonnet-4-6': 2048,
};

/**
 * Sugiere TTL óptimo para un bloque dado modelo + estimación de tokens.
 * Si el bloque está bajo el mínimo del modelo, devuelve 'none' (caching
 * no aplicable).
 */
export function recommendCacheTTL(
  model: LLMModel,
  estimatedTokens: number,
): 'none' | '5m' | '1h' {
  const min = MODEL_MIN_CACHEABLE_TOKENS[model];
  if (estimatedTokens < min) return 'none';
  // Default '5m' para encuentros frecuentes. '1h' solo para contenido muy estable
  // (system prompts de personalidades en sesión larga, ej.).
  return '5m';
}
