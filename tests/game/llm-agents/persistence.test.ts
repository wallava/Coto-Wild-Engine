import { describe, expect, it } from 'vitest';
import { CURRENT_MEMORY_VERSION, createEmptyMemory } from '../../../src/game/llm-agents/memory';
import {
  listSavedAgentIds,
  loadAgentMemory,
  memoryStorageKey,
  migrateAgentMemory,
  saveAgentMemory,
} from '../../../src/game/llm-agents/persistence';

function makeLocalStorageStub() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
  };
}

describe('agent memory persistence', () => {
  it('save + load round-trip', () => {
    const storage = makeLocalStorageStub();
    const memory = createEmptyMemory('mike');

    saveAgentMemory(memory, storage);

    expect(loadAgentMemory('mike', storage)).toEqual(memory);
  });

  it('load null si key no existe', () => {
    const storage = makeLocalStorageStub();

    expect(loadAgentMemory('nonexistent', storage)).toBeNull();
  });

  it('cuarentena cuando schema falla', () => {
    const storage = makeLocalStorageStub();

    storage.setItem(memoryStorageKey('mike'), JSON.stringify({ agentId: 'mike' }));

    expect(loadAgentMemory('mike', storage)).toBeNull();
    expect(listSavedAgentIds(storage)).toEqual(['mike']);

    const quarantineKeys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
      (key) => key?.startsWith('cwe_quarantine_agent_memory_mike_'),
    );
    expect(quarantineKeys).toHaveLength(1);
  });

  it('raw original preservado tras cuarentena fail', () => {
    const storage = makeLocalStorageStub();
    const raw = JSON.stringify({ agentId: 'mike' });

    storage.setItem(memoryStorageKey('mike'), raw);
    loadAgentMemory('mike', storage);

    const quarantineKey = Array.from({ length: storage.length }, (_, i) => storage.key(i)).find(
      (key) => key?.startsWith('cwe_quarantine_agent_memory_mike_'),
    );
    expect(quarantineKey).toBeTruthy();
    expect(storage.getItem(quarantineKey!)).toBe(raw);
  });

  it('listSavedAgentIds enumera correctamente', () => {
    const storage = makeLocalStorageStub();

    saveAgentMemory(createEmptyMemory('mike'), storage);
    saveAgentMemory(createEmptyMemory('cris'), storage);

    expect(listSavedAgentIds(storage)).toEqual(['cris', 'mike']);
  });

  it('migrateAgentMemory con version missing asume v1 y migra', () => {
    const raw = {
      agentId: 'mike',
      episodes: [],
      facts: [],
      relationships: {},
    };

    expect(migrateAgentMemory(raw)).toEqual({
      ...raw,
      version: CURRENT_MEMORY_VERSION,
    });
  });
});
