import { describe, it, expect, beforeEach } from 'vitest';
import { getLLMClient, setApiKey, clearApiKey, isLLMEnabled, sanitizeError } from '../../src/llm/factory';
import { LLM_STORAGE_KEYS } from '../../src/llm/storage-keys';

function installLocalStorage(): void {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => {
        store.delete(key);
      },
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    },
  });
}

beforeEach(() => {
  installLocalStorage();
  localStorage.clear();
});

describe('factory.getLLMClient', () => {
  it('null si no hay API key', () => {
    expect(getLLMClient()).toBeNull();
  });

  it('retorna AnthropicClient si hay key', () => {
    setApiKey('sk-ant-api01-XXX...');
    expect(getLLMClient()).not.toBeNull();
  });

  it('cachea por API key (mismo cliente entre llamadas)', () => {
    setApiKey('sk-ant-api01-keyA');
    const c1 = getLLMClient();
    const c2 = getLLMClient();
    expect(c1).toBe(c2);
  });

  it('invalida cache al cambiar API key', () => {
    setApiKey('sk-ant-api01-keyA');
    const c1 = getLLMClient();
    setApiKey('sk-ant-api01-keyB');
    const c2 = getLLMClient();
    expect(c1).not.toBe(c2);
  });

  it('clearApiKey invalida cache + remueve de localStorage', () => {
    setApiKey('sk-ant-api01-keyA');
    expect(getLLMClient()).not.toBeNull();
    clearApiKey();
    expect(getLLMClient()).toBeNull();
    expect(localStorage.getItem(LLM_STORAGE_KEYS.apiKey)).toBeNull();
  });
});

describe('factory.isLLMEnabled', () => {
  it('false sin key', () => {
    expect(isLLMEnabled()).toBe(false);
  });

  it('true con key + killswitch off', () => {
    setApiKey('sk-ant-api01-keyA');
    expect(isLLMEnabled()).toBe(true);
  });

  it('false con killswitch on', () => {
    setApiKey('sk-ant-api01-keyA');
    localStorage.setItem(LLM_STORAGE_KEYS.killswitch, 'on');
    expect(isLLMEnabled()).toBe(false);
  });
});

describe('factory.sanitizeError', () => {
  it('reemplaza pattern sk-ant-apiNN- por <API_KEY>', () => {
    const err = new Error('Auth failed: sk-ant-api01-2RPtZjOKy2DFpr2MtDdAdFVa6oICeTl');
    const r = sanitizeError(err);
    expect(r.message).not.toContain('2RPtZjOKy2DFpr2MtDdAdFVa6oICeTl');
    expect(r.message).toContain('<API_KEY>');
  });

  it('reemplaza key actual cargada de localStorage', () => {
    const myKey = 'custom-key-xyz-abc123';
    setApiKey(myKey);
    const err = new Error(`Header x-api-key: ${myKey}`);
    const r = sanitizeError(err);
    expect(r.message).not.toContain(myKey);
    expect(r.message).toContain('<API_KEY>');
  });

  it('preserva otros campos (code) si presentes', () => {
    const err = new Error('boom');
    (err as { code?: string }).code = 'KEY_INVALID';
    const r = sanitizeError(err);
    expect(r.code).toBe('KEY_INVALID');
  });
});
