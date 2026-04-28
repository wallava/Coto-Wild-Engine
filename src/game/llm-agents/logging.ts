/**
 * logging.ts
 * Logging estructurado de calls LLM para llm-agents.
 * Ring buffer in-memory de últimos 20 registros.
 * METADATA ONLY — nunca loguear texto generado, prompts, memoria ni user messages.
 */

import type { LLMModel } from '../../llm/types';

export type LLMCallLog = {
  agentId: string;
  target: string;
  model: LLMModel;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cacheHit: boolean;
  latencyMs: number;
  costUSD: number;
  errorCode?: string;
  timestamp: number;
};

const MAX_LOGS = 20;
const _logs: LLMCallLog[] = [];

/** Registra una call LLM. Sólo metadata — sin texto generado ni prompts. */
export function logCall(entry: Omit<LLMCallLog, 'timestamp'>): void {
  const fullEntry: LLMCallLog = { ...entry, timestamp: Date.now() };
  _logs.push(fullEntry);
  if (_logs.length > MAX_LOGS) _logs.shift();
  console.log('[llm-call]', {
    agentId: fullEntry.agentId,
    target: fullEntry.target,
    model: fullEntry.model,
    cacheHit: fullEntry.cacheHit,
    tokens: {
      in: fullEntry.inputTokens,
      out: fullEntry.outputTokens,
      cacheR: fullEntry.cacheReadTokens,
      cacheW: fullEntry.cacheCreationTokens,
    },
    latencyMs: fullEntry.latencyMs,
    costUSD: fullEntry.costUSD.toFixed(6),
    error: fullEntry.errorCode,
  });
}

/** Devuelve copia de los últimos MAX_LOGS registros (más reciente al final). */
export function getRecentCallLogs(): readonly LLMCallLog[] {
  return _logs.slice();
}

/** Limpia el ring buffer (útil para tests). */
export function clearCallLogs(): void {
  _logs.length = 0;
}
