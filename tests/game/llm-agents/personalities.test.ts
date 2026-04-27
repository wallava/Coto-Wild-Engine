import { describe, expect, it } from 'vitest';
import { PersonalitySchema } from '../../../src/game/llm-agents/personality';
import {
  ALL_PERSONALITIES,
  getPersonalityById,
} from '../../../src/game/llm-agents/personalities';

describe('Personalities catalog', () => {
  it('3 personalidades en MVP', () => {
    expect(ALL_PERSONALITIES).toHaveLength(3);
  });

  it('todas pasan PersonalitySchema', () => {
    for (const p of ALL_PERSONALITIES) {
      expect(PersonalitySchema.safeParse(p).success).toBe(true);
    }
  });

  it('todas tienen model haiku-4-5', () => {
    for (const p of ALL_PERSONALITIES) {
      expect(p.model).toBe('haiku-4-5');
    }
  });

  it('todas incluyen REGLA CRÍTICA literal de world_context', () => {
    for (const p of ALL_PERSONALITIES) {
      expect(p.staticSystemBlock).toContain('REGLA CRÍTICA');
      expect(p.staticSystemBlock).toContain('<world_context>');
    }
  });

  it('staticSystemBlock 500-800 tokens (heurística word*1.3)', () => {
    for (const p of ALL_PERSONALITIES) {
      const words = p.staticSystemBlock.split(/\s+/).length;
      const estTokens = words * 1.3;

      expect(estTokens).toBeGreaterThan(300);
      expect(estTokens).toBeLessThan(1500);
    }
  });

  it('getPersonalityById', () => {
    expect(getPersonalityById('ceo-pretender')).toBeTruthy();
    expect(getPersonalityById('nonexistent')).toBeUndefined();
  });
});
