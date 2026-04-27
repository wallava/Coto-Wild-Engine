/**
 * Contrato canónico de la capa LLM. Tipos compartidos entre cliente real,
 * mock, cost tracking, queue y consumers.
 *
 * Reglas críticas:
 * - System prompts son `SystemBlock[]`, no string. Cada bloque indica
 *   cacheabilidad. Default `cache: 'none'` — el caller decide.
 * - Usar `recommendCacheTTL(model, estimatedTokens)` (utility a aparte) para
 *   sugerir cache TTL según mínimos del modelo (Haiku 4.5 requiere 4096+
 *   tokens; Sonnet 4.6 requiere 2048+).
 * - Errores normalizados a `LLMError` con `code` discriminado.
 * - Cliente NUNCA pasa el alias interno (`'haiku-4-5'`) a la API. Mapea
 *   con `MODEL_API_IDS` de `models.ts`.
 */

// ── Modelos ──────────────────────────────────────────────────────────

export type LLMModel = 'haiku-4-5' | 'sonnet-4-6';

// ── System blocks (prompt caching) ──────────────────────────────────

export type SystemBlockCacheTTL = 'none' | '5m' | '1h';

export type SystemBlock = {
  text: string;
  /** Default 'none'. Caller decide. */
  cache?: SystemBlockCacheTTL;
};

// ── Mensajes ─────────────────────────────────────────────────────────

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

// ── Completion ───────────────────────────────────────────────────────

export type CompletionOpts = {
  model: LLMModel;
  /** Array de bloques. NO string. */
  system: SystemBlock[];
  messages: Message[];
  maxTokens: number;
  temperature?: number;
  abortSignal?: AbortSignal;
  /** Default 8000. */
  firstTokenTimeoutMs?: number;
  /** Default 20000. */
  totalTimeoutMs?: number;
  /**
   * Hint para cost tracking auditable cuando hay TTLs mixtos.
   * Si null/undefined: derivado de `system[*].cache`.
   */
  cacheTTLHint?: '5m' | '1h' | 'mixed' | 'none';
};

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  /** Total cache_read_input_tokens. */
  cacheReadTokens: number;
  /** Total cache_creation_input_tokens (suma 5m + 1h si están separados). */
  cacheCreationTokens: number;
  /** Desglose 5m (Anthropic API responde `ephemeral_5m_input_tokens`). */
  cacheCreation5mTokens?: number;
  /** Desglose 1h (Anthropic API responde `ephemeral_1h_input_tokens`). */
  cacheCreation1hTokens?: number;
};

/**
 * Razones conocidas. `(string & {})` permite valores futuros (ej. 'tool_use')
 * sin romper el adapter. El consumer debe manejar default case.
 */
export type StopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'stop_sequence'
  | 'aborted'
  | (string & {});

export type CompletionResult = {
  text: string;
  stopReason: StopReason;
  usage: Usage;
  costUSD: number;
};

// ── Streaming ────────────────────────────────────────────────────────

export type StreamChunk =
  | { type: 'text'; delta: string }
  | { type: 'usage'; usage: Usage }
  | { type: 'done'; result: CompletionResult };

// ── Cliente ──────────────────────────────────────────────────────────

export interface LLMClient {
  complete(opts: CompletionOpts): Promise<CompletionResult>;
  /**
   * Streaming. Errores mid-stream se throw como `LLMError`.
   * No emiten chunk type='error'.
   */
  completeStream(opts: CompletionOpts): AsyncIterable<StreamChunk>;
}

// ── Errores ──────────────────────────────────────────────────────────

export type LLMErrorCode =
  | 'ABORTED'
  | 'FIRST_TOKEN_TIMEOUT'
  | 'TOTAL_TIMEOUT'
  | 'QUEUE_TIMEOUT'
  | 'HTTP_ERROR'
  | 'RATE_LIMIT'
  | 'STREAM_ERROR'
  | 'KEY_INVALID'
  | 'CAP_EXCEEDED';

export class LLMError extends Error {
  code: LLMErrorCode;
  cause?: unknown;
  httpStatus?: number;
  constructor(code: LLMErrorCode, message: string, cause?: unknown, httpStatus?: number) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
    if (httpStatus !== undefined) this.httpStatus = httpStatus;
  }
}

// ── Cost tracking ────────────────────────────────────────────────────

export interface SessionCostTracker {
  trackCall(usage: Usage, model: LLMModel, ttlHint?: '5m' | '1h' | 'mixed' | 'none'): void;
  getSessionCost(): number;
  /** Pre-call check. true si la llamada cabe dentro del cap. */
  canAffordEstimatedCall(model: LLMModel, estInputTokens: number, maxOutputTokens: number): boolean;
  /** Post-state check. true si ya superamos el cap. */
  isOverCap(): boolean;
  reset(): void;
  setCap(capUSD: number): void;
}

// ── Global queue (semaphore) ────────────────────────────────────────

export interface GlobalLLMQueue {
  /**
   * Adquiere slot de ejecución. Si la cola está llena, espera.
   * Si `timeoutMs` expira mientras está en cola: rejecta con
   * `LLMError({ code: 'QUEUE_TIMEOUT' })`.
   * Retorna función `release()` que el caller debe llamar al terminar.
   */
  acquire(timeoutMs?: number): Promise<() => void>;
  isActive(): boolean;
  pendingCount(): number;
}
