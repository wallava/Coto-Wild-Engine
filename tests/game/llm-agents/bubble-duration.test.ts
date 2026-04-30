import { describe, expect, it } from 'vitest';
import {
  BUBBLE_BASE_MS,
  BUBBLE_MAX_MS,
  BUBBLE_MIN_MS,
  BUBBLE_PER_CHAR_MS,
  getBubbleDurationMs,
} from '../../../src/game/llm-agents/bubble-duration';

describe('getBubbleDurationMs', () => {
  it('0 chars retorna BUBBLE_MIN_MS (2000)', () => {
    expect(getBubbleDurationMs('')).toBe(BUBBLE_MIN_MS);
  });

  it('5 chars retorna 2250 (no clampea, raw=2250)', () => {
    expect(getBubbleDurationMs('12345')).toBe(2250);
  });

  it('50 chars retorna 4500', () => {
    expect(getBubbleDurationMs('x'.repeat(50))).toBe(4500);
  });

  it('500 chars retorna BUBBLE_MAX_MS (8000), clamp max', () => {
    expect(getBubbleDurationMs('x'.repeat(500))).toBe(BUBBLE_MAX_MS);
  });

  it('10000 chars retorna 8000 (clamp max)', () => {
    expect(getBubbleDurationMs('x'.repeat(10000))).toBe(8000);
  });

  it('constantes exportadas tienen valores esperados', () => {
    expect(BUBBLE_BASE_MS).toBe(2000);
    expect(BUBBLE_PER_CHAR_MS).toBe(50);
    expect(BUBBLE_MIN_MS).toBe(2000);
    expect(BUBBLE_MAX_MS).toBe(8000);
  });
});
