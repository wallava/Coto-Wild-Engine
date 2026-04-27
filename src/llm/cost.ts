import type { LLMModel, Usage } from './types';
import { MODEL_PRICING } from './models';

type CacheTTLHint = '5m' | '1h' | 'mixed' | 'none';

const perMillion = (tokens: number, usdPerMTok: number): number => (
  (tokens * usdPerMTok) / 1_000_000
);

export function actualCostUSD(
  model: LLMModel,
  usage: Usage,
  ttlHint?: CacheTTLHint,
): number {
  const pricing = MODEL_PRICING[model];
  const splitCacheCreationTokens =
    (usage.cacheCreation5mTokens ?? 0) + (usage.cacheCreation1hTokens ?? 0);
  const unsplitCacheCreationTokens = Math.max(
    0,
    usage.cacheCreationTokens - splitCacheCreationTokens,
  );

  let cacheWrite5mTokens = usage.cacheCreation5mTokens ?? 0;
  let cacheWrite1hTokens = usage.cacheCreation1hTokens ?? 0;

  if (unsplitCacheCreationTokens > 0) {
    if (ttlHint === '1h') {
      cacheWrite1hTokens += unsplitCacheCreationTokens;
    } else {
      cacheWrite5mTokens += unsplitCacheCreationTokens;
    }
  }

  return (
    perMillion(usage.inputTokens, pricing.inputPerMTok) +
    perMillion(usage.outputTokens, pricing.outputPerMTok) +
    perMillion(usage.cacheReadTokens, pricing.cacheReadPerMTok) +
    perMillion(cacheWrite5mTokens, pricing.cacheWrite5mPerMTok) +
    perMillion(cacheWrite1hTokens, pricing.cacheWrite1hPerMTok)
  );
}

export function estimateCostUSD(
  model: LLMModel,
  estInputTokens: number,
  maxOutputTokens: number,
): number {
  const pricing = MODEL_PRICING[model];
  return (
    perMillion(estInputTokens, pricing.inputPerMTok) +
    perMillion(maxOutputTokens, pricing.outputPerMTok)
  );
}
