import { describe, expect, it } from 'vitest';
import { actualCostUSD, estimateCostUSD } from '../../src/llm/cost';
import { EPSILON, SessionCostTrackerImpl } from '../../src/llm/cost-tracker';
import type { Usage } from '../../src/llm/types';

const zeroUsage: Usage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
};

describe('LLM costs', () => {
  it('estimates worst-case Haiku cost for 1K input tokens and 100 output tokens', () => {
    expect(estimateCostUSD('haiku-4-5', 1_000, 100)).toBeCloseTo(0.0015);
  });

  it('calculates actual cost without cache from input and output tokens', () => {
    expect(actualCostUSD('haiku-4-5', {
      ...zeroUsage,
      inputTokens: 2_000,
      outputTokens: 300,
    })).toBeCloseTo(0.0035);
  });

  it('calculates cache read cost when cacheReadTokens is present', () => {
    expect(actualCostUSD('haiku-4-5', {
      ...zeroUsage,
      cacheReadTokens: 1_000,
    })).toBeCloseTo(0.0001);
  });

  it('calculates separate 5m and 1h cache creation prices', () => {
    expect(actualCostUSD('haiku-4-5', {
      ...zeroUsage,
      cacheCreationTokens: 2_000,
      cacheCreation5mTokens: 1_000,
      cacheCreation1hTokens: 1_000,
    })).toBeCloseTo(0.00325);
  });

  it('uses the 5m price for unsplit cacheCreationTokens when ttlHint is 5m', () => {
    expect(actualCostUSD('haiku-4-5', {
      ...zeroUsage,
      cacheCreationTokens: 1_000,
    }, '5m')).toBeCloseTo(0.00125);
  });

  it('uses the 1h price for unsplit cacheCreationTokens when ttlHint is 1h', () => {
    expect(actualCostUSD('haiku-4-5', {
      ...zeroUsage,
      cacheCreationTokens: 1_000,
    }, '1h')).toBeCloseTo(0.002);
  });

  it('SessionCostTrackerImpl trackCall accumulates actual cost', () => {
    const tracker = new SessionCostTrackerImpl();

    tracker.trackCall({ ...zeroUsage, inputTokens: 1_000 }, 'haiku-4-5');
    tracker.trackCall({ ...zeroUsage, outputTokens: 100 }, 'haiku-4-5');

    expect(tracker.getSessionCost()).toBeCloseTo(0.0015);
  });

  it('canAffordEstimatedCall blocks when estimated call exceeds the cap', () => {
    const tracker = new SessionCostTrackerImpl({ capUSD: 0.001 });

    expect(tracker.canAffordEstimatedCall('haiku-4-5', 1_000, 100)).toBe(false);
  });

  it('canAffordEstimatedCall allows calls within cap including epsilon', () => {
    const tracker = new SessionCostTrackerImpl({ capUSD: 0.0015 - (EPSILON / 2) });

    expect(tracker.canAffordEstimatedCall('haiku-4-5', 1_000, 100)).toBe(true);
  });

  it('isOverCap detects overshoot beyond epsilon', () => {
    const tracker = new SessionCostTrackerImpl({ capUSD: 0.001 });

    tracker.trackCall({ ...zeroUsage, inputTokens: 1_001 }, 'haiku-4-5');

    expect(tracker.isOverCap()).toBe(true);
  });

  it('reset returns accumulated session cost to zero', () => {
    const tracker = new SessionCostTrackerImpl();
    tracker.trackCall({ ...zeroUsage, inputTokens: 1_000 }, 'haiku-4-5');

    tracker.reset();

    expect(tracker.getSessionCost()).toBe(0);
  });

  it('setCap changes the affordability limit', () => {
    const tracker = new SessionCostTrackerImpl({ capUSD: 0.001 });

    tracker.setCap(0.002);

    expect(tracker.canAffordEstimatedCall('haiku-4-5', 1_000, 100)).toBe(true);
  });
});
