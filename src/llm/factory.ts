import type { LLMClient } from './types';
import { AnthropicClient } from './anthropic-client';
import { LLM_STORAGE_KEYS } from './storage-keys';

let _cached: { apiKey: string; client: LLMClient } | null = null;

/**
 * Devuelve cliente LLM si hay API key cargada, sino null.
 * Cachea por API key. Si la key cambia, devuelve nuevo cliente.
 */
export function getLLMClient(): LLMClient | null {
  const key = readApiKey();
  if (!key) return null;
  if (_cached && _cached.apiKey === key) return _cached.client;
  const client = new AnthropicClient({ apiKey: key });
  _cached = { apiKey: key, client };
  return client;
}

/** Persiste API key y invalida cache. */
export function setApiKey(apiKey: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LLM_STORAGE_KEYS.apiKey, apiKey);
  }
  _cached = null;
}

/** Borra API key + invalida cache. */
export function clearApiKey(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LLM_STORAGE_KEYS.apiKey);
  }
  _cached = null;
}

function readApiKey(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const v = localStorage.getItem(LLM_STORAGE_KEYS.apiKey);
  return v && v.trim() !== '' ? v.trim() : null;
}

/** Verdadero si LLM enabled (key presente + killswitch off). */
export function isLLMEnabled(): boolean {
  if (loadKillSwitchFromStorage()) return false;
  return readApiKey() !== null;
}

export function loadKillSwitchFromStorage(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(LLM_STORAGE_KEYS.killswitch) === 'on';
}

export function loadSessionCapFromStorage(): number {
  if (typeof localStorage === 'undefined') return 0.50;
  const raw = localStorage.getItem(LLM_STORAGE_KEYS.sessionCap);
  if (!raw) return 0.50;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0.50;
}

/**
 * Strip API key de cualquier error message antes de loguear.
 * Patterns:
 *   1. /sk-ant-api\d{2}-[A-Za-z0-9_-]{20,}/g -> <API_KEY>
 *   2. Si hay key actual cargada, replace exacto de esa substring.
 *
 * Devuelve {message, code?} sin exponer la key. NUNCA expone stack raw.
 */
export function sanitizeError(err: unknown): { message: string; code?: string } {
  const generic = (msg: string): string => {
    let safe = msg;
    safe = safe.replace(/sk-ant-api\d{2}-[A-Za-z0-9_-]{20,}/g, '<API_KEY>');
    const currentKey = readApiKey();
    if (currentKey) {
      const escaped = currentKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      safe = safe.replace(new RegExp(escaped, 'g'), '<API_KEY>');
    }
    return safe;
  };
  if (err instanceof Error) {
    const result: { message: string; code?: string } = {
      message: generic(err.message),
    };
    if ('code' in err && typeof (err as any).code === 'string') {
      result.code = (err as any).code;
    }
    return result;
  }
  return { message: generic(String(err)) };
}
