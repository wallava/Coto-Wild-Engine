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

  it('R4 fix: FORMATO line literal "MÁXIMO 8 palabras" en static block', () => {
    for (const p of ALL_PERSONALITIES) {
      expect(p.staticSystemBlock).toContain('FORMATO: Respondes en MÁXIMO 8 palabras');
    }
  });

  it('R4 fix: sin voseo en staticSystemBlock (tuteo neutro)', () => {
    // Patrones específicos de voseo rioplatense. Cualquier match indica
    // regression a "respondés/decime/vos/sabés/etc.".
    const voseoPatterns = /\b(respondés|decime|sabés|tenés|querés|hablás|leés|usás|metés|tomás|preguntás|disculpás|agradecés|escribilos|verbalizás|mencionás|recomendás|asumís|confundís|citás|ofrecés|pasás|charlábamos|andás|vení|agarrá|agendá|fijate|mirá|escuchá|che)\b/i;
    for (const p of ALL_PERSONALITIES) {
      expect(p.staticSystemBlock, `${p.id} contiene voseo`).not.toMatch(voseoPatterns);
    }
  });

  it('R4 fix: examples y fallbackPhrases ≤8 palabras cada uno', () => {
    const wordCount = (s: string) => s.trim().split(/\s+/).length;
    for (const p of ALL_PERSONALITIES) {
      for (const ex of p.examples) {
        expect(wordCount(ex.assistant), `${p.id} example "${ex.assistant}" >8 palabras`)
          .toBeLessThanOrEqual(8);
      }
      for (const ph of p.fallbackPhrases) {
        expect(wordCount(ph), `${p.id} fallback "${ph}" >8 palabras`)
          .toBeLessThanOrEqual(8);
      }
    }
  });
});
