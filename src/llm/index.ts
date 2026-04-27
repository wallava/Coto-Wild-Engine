/**
 * API pública de la capa LLM. Todo lo que importa fuera de src/llm/ debe
 * pasar por este barrel.
 *
 * Round 0 — solo tipos + mappings. Implementaciones (anthropic-client,
 * mock-client, cost, queue, sanitize) vienen en R1.
 */

export type {
  LLMModel,
  SystemBlock,
  SystemBlockCacheTTL,
  Message,
  CompletionOpts,
  Usage,
  StopReason,
  CompletionResult,
  StreamChunk,
  LLMClient,
  LLMErrorCode,
  SessionCostTracker,
  GlobalLLMQueue,
} from './types';

export { LLMError } from './types';

export {
  MODEL_API_IDS,
  MODEL_PRICING,
  MODEL_MIN_CACHEABLE_TOKENS,
  recommendCacheTTL,
} from './models';
