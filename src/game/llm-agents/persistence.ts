import type { AgentMemory } from './memory';
import { AgentMemorySchema, createEmptyMemory, CURRENT_MEMORY_VERSION } from './memory';

const MEMORY_KEY_PREFIX = 'cwe_agent_memory_';
const QUARANTINE_KEY_PREFIX = 'cwe_quarantine_agent_memory_';

type MemoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function getDefaultStorage(): MemoryStorage | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

export function memoryStorageKey(agentId: string): string {
  return `${MEMORY_KEY_PREFIX}${agentId}`;
}

export function saveAgentMemory(memory: AgentMemory, storage = getDefaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(memoryStorageKey(memory.agentId), JSON.stringify(memory));
  } catch (e) {
    console.warn('[agent-memory/save] failed:', e);
  }
}

/**
 * Carga AgentMemory de localStorage. Si validate falla:
 * - Cuarentena el raw en `cwe_quarantine_agent_memory_${agentId}_${timestamp}`.
 * - Retorna null (caller usa createEmptyMemory).
 *
 * Si no hay nada en localStorage, retorna null silenciosamente.
 */
export function loadAgentMemory(agentId: string, storage = getDefaultStorage()): AgentMemory | null {
  if (!storage) return null;
  const raw = storage.getItem(memoryStorageKey(agentId));
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(`[agent-memory/load] JSON parse failed for ${agentId}:`, e);
    return null;
  }

  // Migrate placeholder.
  const migrated = migrateAgentMemory(parsed);

  const validation = AgentMemorySchema.safeParse(migrated);
  if (validation.success) {
    return validation.data;
  }

  // Cuarentena: preserva raw.
  try {
    const quarantineKey = `${QUARANTINE_KEY_PREFIX}${agentId}_${Date.now()}`;
    storage.setItem(quarantineKey, raw);
    console.warn(`[agent-memory/load] memoria de ${agentId} inválida. Cuarentena en ${quarantineKey}.`);
  } catch (e) {
    console.error('[agent-memory/load] cuarentena falló:', e);
  }
  console.warn(`[agent-memory/load] issues:`, validation.error.issues.map((i) => `${i.path.join('.')} :: ${i.message}`).join(' || '));
  return null;
}

/**
 * Migration placeholder. Por ahora identidad. Cuando agregue v2:
 * if (raw.version === undefined || raw.version === 1) → migrate to v2.
 */
export function migrateAgentMemory(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const obj = raw as Record<string, unknown>;
  // Si falta version: asumir v1 (legacy pre-versionado).
  if (obj.version === undefined) {
    obj.version = CURRENT_MEMORY_VERSION;
  }
  return obj;
}

export function deleteAgentMemory(agentId: string, storage = getDefaultStorage()): void {
  if (!storage) return;
  storage.removeItem(memoryStorageKey(agentId));
}

/**
 * Lista agentIds con memoria persistida. Scan localStorage por prefix.
 */
export function listSavedAgentIds(storage = getDefaultStorage()): string[] {
  if (!storage) return [];
  const ids: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(MEMORY_KEY_PREFIX)) {
      ids.push(key.slice(MEMORY_KEY_PREFIX.length));
    }
  }
  return ids.sort();
}

/**
 * Convenience: load o crea empty.
 */
export function loadOrCreateAgentMemory(agentId: string, storage = getDefaultStorage()): AgentMemory {
  return loadAgentMemory(agentId, storage) ?? createEmptyMemory(agentId);
}
