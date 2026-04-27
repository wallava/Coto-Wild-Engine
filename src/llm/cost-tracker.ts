import { actualCostUSD, estimateCostUSD } from './cost';
import type { CompletionOpts, LLMModel, SessionCostTracker, Usage } from './types';

type CacheTTLHint = NonNullable<CompletionOpts['cacheTTLHint']>;

export const DEFAULT_CAP_USD = 0.50;
export const EPSILON = 1e-9;

export type SessionCostTrackerOpts = {
  capUSD?: number;
};

function assertValidCap(capUSD: number): void {
  if (!Number.isFinite(capUSD) || capUSD < 0) {
    throw new RangeError('capUSD must be a finite non-negative number');
  }
}

export class SessionCostTrackerImpl implements SessionCostTracker {
  private sessionCostUSD = 0;
  private capUSD: number;

  constructor(opts: SessionCostTrackerOpts = {}) {
    const capUSD = opts.capUSD ?? DEFAULT_CAP_USD;
    assertValidCap(capUSD);
    this.capUSD = capUSD;
  }

  trackCall(usage: Usage, model: LLMModel, ttlHint?: CacheTTLHint): void {
    this.sessionCostUSD += actualCostUSD(model, usage, ttlHint);
  }

  getSessionCost(): number {
    return this.sessionCostUSD;
  }

  canAffordEstimatedCall(
    model: LLMModel,
    estInputTokens: number,
    maxOutputTokens: number,
  ): boolean {
    const estimatedCostUSD = estimateCostUSD(model, estInputTokens, maxOutputTokens);
    return this.sessionCostUSD + estimatedCostUSD <= this.capUSD + EPSILON;
  }

  isOverCap(): boolean {
    return this.sessionCostUSD > this.capUSD + EPSILON;
  }

  reset(): void {
    this.sessionCostUSD = 0;
  }

  setCap(capUSD: number): void {
    assertValidCap(capUSD);
    this.capUSD = capUSD;
  }
}

export function createSessionCostTracker(
  opts: SessionCostTrackerOpts = {},
): SessionCostTracker {
  return new SessionCostTrackerImpl(opts);
}
