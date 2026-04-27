import { describe, expect, it } from 'vitest';
import {
  PersonalitySchema,
  buildSystemBlocks,
  buildUserMessage,
  getFallbackPhrase,
} from '../../../src/game/llm-agents/personality';
import { ceoPretender } from '../../../src/game/llm-agents/personalities/ceo-pretender';

describe('buildSystemBlocks', () => {
  it('sin dynamicLines: 1 block con cache=5m', () => {
    const blocks = buildSystemBlocks(ceoPretender);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.cache).toBe('5m');
    expect(blocks[0]?.text).toBe(ceoPretender.staticSystemBlock);
  });

  it('con dynamicLines: 2 blocks, segundo cache=none + wrapped en world_context', () => {
    const blocks = buildSystemBlocks(ceoPretender, {
      dynamicLines: ['Mike está en cocina-1'],
    });

    expect(blocks).toHaveLength(2);
    expect(blocks[1]?.cache).toBe('none');
    expect(blocks[1]?.text).toContain('<world_context>');
    expect(blocks[1]?.text).toContain('</world_context>');
  });

  it('dynamicLines vacío: 1 block (no agrega segundo)', () => {
    const blocks = buildSystemBlocks(ceoPretender, { dynamicLines: [] });

    expect(blocks).toHaveLength(1);
  });
});

describe('getFallbackPhrase', () => {
  it('devuelve string del array de fallbacks', () => {
    const phrase = getFallbackPhrase(ceoPretender);

    expect(ceoPretender.fallbackPhrases).toContain(phrase);
  });
});

describe('buildUserMessage', () => {
  it('incluye target sanitizado', () => {
    const msg = buildUserMessage('Tomi');

    expect(msg).toContain('Tomi');
  });

  it('con situationLines: incluye world_context wrap', () => {
    const msg = buildUserMessage('Tomi', { situationLines: ['Es de mañana.'] });

    expect(msg).toContain('<world_context>');
  });
});

describe('PersonalitySchema', () => {
  it('valida ceoPretender', () => {
    expect(PersonalitySchema.safeParse(ceoPretender).success).toBe(true);
  });

  it('rechaza fallbackPhrases con menos de 5', () => {
    const bad = { ...ceoPretender, fallbackPhrases: ['1', '2'] };

    expect(PersonalitySchema.safeParse(bad).success).toBe(false);
  });
});
