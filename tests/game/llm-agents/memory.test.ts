import { describe, expect, it } from 'vitest';
import {
  AgentMemorySchema,
  CURRENT_MEMORY_VERSION,
  addEpisode,
  addFact,
  createEmptyMemory,
  pruneOldEpisodes,
  updateRelationship,
} from '../../../src/game/llm-agents/memory';

describe('createEmptyMemory', () => {
  it('memoria vacía con version actual', () => {
    const m = createEmptyMemory('mike');

    expect(m.version).toBe(CURRENT_MEMORY_VERSION);
    expect(m.agentId).toBe('mike');
    expect(m.episodes).toEqual([]);
    expect(m.facts).toEqual([]);
    expect(m.relationships).toEqual({});
  });
});

describe('addEpisode', () => {
  it('agrega episode con id generado', () => {
    const m = createEmptyMemory('mike');
    const ep = addEpisode(m, {
      t: 1.0,
      type: 'spoke_to',
      participants: ['cris'],
      summary: 'hola',
      importance: 0.5,
    });

    expect(ep.id).toBeTruthy();
    expect(m.episodes).toHaveLength(1);
  });

  it('importance preservado', () => {
    const m = createEmptyMemory('mike');
    const ep = addEpisode(m, {
      t: 1.0,
      type: 'spoke_to',
      participants: [],
      summary: '',
      importance: 0.8,
    });

    expect(ep.importance).toBe(0.8);
  });
});

describe('addFact + updateRelationship', () => {
  it('addFact agrega con id', () => {
    const m = createEmptyMemory('mike');

    addFact(m, { t: 1, text: 'fact 1', importance: 0.5 });

    expect(m.facts).toHaveLength(1);
    expect(m.facts[0]?.id).toBeTruthy();
  });

  it('updateRelationship merge correcto', () => {
    const m = createEmptyMemory('mike');

    updateRelationship(m, 'cris', {
      affinity: 0.7,
      lastInteractionT: 5,
      encounterCount: 1,
    });
    expect(m.relationships.cris?.affinity).toBe(0.7);

    updateRelationship(m, 'cris', { affinity: 0.8 });
    expect(m.relationships.cris?.affinity).toBe(0.8);
    expect(m.relationships.cris?.encounterCount).toBe(1);
  });
});

describe('pruneOldEpisodes', () => {
  it('preserva recientes Y importantes (test crítico)', () => {
    const m = createEmptyMemory('mike');

    addEpisode(m, { t: 1, type: 'spoke_to', participants: [], summary: 'A', importance: 0.9 });
    addEpisode(m, { t: 2, type: 'spoke_to', participants: [], summary: 'B', importance: 0.1 });
    addEpisode(m, { t: 3, type: 'spoke_to', participants: [], summary: 'C', importance: 0.2 });
    addEpisode(m, { t: 4, type: 'spoke_to', participants: [], summary: 'D', importance: 0.1 });

    pruneOldEpisodes(m, { keepRecent: 2, keepImportant: 1, maxTotal: 3 });

    const summaries = m.episodes.map((e) => e.summary).sort();
    expect(summaries).toEqual(['A', 'C', 'D']);
  });

  it('trim cuando union excede maxTotal por importance asc', () => {
    const m = createEmptyMemory('mike');

    addEpisode(m, { t: 1, type: 'spoke_to', participants: [], summary: 'A', importance: 0.9 });
    addEpisode(m, { t: 2, type: 'spoke_to', participants: [], summary: 'B', importance: 0.5 });
    addEpisode(m, { t: 3, type: 'spoke_to', participants: [], summary: 'C', importance: 0.1 });

    pruneOldEpisodes(m, { keepRecent: 3, keepImportant: 3, maxTotal: 2 });

    expect(m.episodes).toHaveLength(2);
    expect(m.episodes.map((e) => e.summary)).not.toContain('C');
  });

  it('no-op si no hay episodes', () => {
    const m = createEmptyMemory('mike');

    pruneOldEpisodes(m, { keepRecent: 5, keepImportant: 5, maxTotal: 10 });

    expect(m.episodes).toEqual([]);
  });
});

describe('AgentMemorySchema', () => {
  it('valida memoria válida', () => {
    const m = createEmptyMemory('mike');

    expect(AgentMemorySchema.safeParse(m).success).toBe(true);
  });

  it('rechaza importance fuera de rango 0-1', () => {
    const m = createEmptyMemory('mike');

    addEpisode(m, { t: 1, type: 'spoke_to', participants: [], summary: '', importance: 0.5 });
    m.episodes[0]!.importance = 1.5;

    expect(AgentMemorySchema.safeParse(m).success).toBe(false);
  });
});
