import type { LLMClient, LLMModel } from './types';
import { AnthropicClient } from './anthropic-client';
import { MODEL_API_IDS } from './models';
import { LLM_STORAGE_KEYS } from './storage-keys';

const VALID_MODELS = Object.keys(MODEL_API_IDS) as LLMModel[];

function isValidModel(value: string): value is LLMModel {
  return (VALID_MODELS as string[]).includes(value);
}

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
 * Lee el override global de modelo desde localStorage. Cuarentena: si el
 * valor no es un LLMModel válido, devuelve null + console.warn.
 * @returns el modelo override, o null si no hay override (= usar personality.model).
 */
export function loadModelOverrideFromStorage(): LLMModel | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(LLM_STORAGE_KEYS.modelOverride);
  if (!raw) return null;
  if (!isValidModel(raw)) {
    console.warn(
      `[llm/factory] modelOverride inválido en storage: "${raw}". Ignorado. ` +
      `Esperado: ${VALID_MODELS.join(' | ')}.`,
    );
    return null;
  }
  return raw;
}

/**
 * Persiste un override global de modelo. null borra el override.
 * @param model modelo a forzar, o null para usar personality.model en cada llamada.
 */
export function setModelOverride(model: LLMModel | null): void {
  if (typeof localStorage === 'undefined') return;
  if (model === null) {
    localStorage.removeItem(LLM_STORAGE_KEYS.modelOverride);
    return;
  }
  if (!isValidModel(model)) {
    throw new RangeError(`Modelo inválido: ${model}. Esperado: ${VALID_MODELS.join(' | ')}.`);
  }
  localStorage.setItem(LLM_STORAGE_KEYS.modelOverride, model);
}

/**
 * Resuelve el modelo efectivo para una llamada: override global > personality.model.
 * @param personalityModel default declarado por la personalidad.
 * @returns modelo a usar en la llamada.
 */
export function getEffectiveModel(personalityModel: LLMModel): LLMModel {
  return loadModelOverrideFromStorage() ?? personalityModel;
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
