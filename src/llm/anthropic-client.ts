import {
  type LLMClient,
  type CompletionOpts,
  type CompletionResult,
  type StreamChunk,
  type Usage,
  type StopReason,
  LLMError,
  type LLMErrorCode,
} from './types';
import { MODEL_API_IDS } from './models';
import { actualCostUSD } from './cost';

export type LLMClientOptions = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number, signal?: AbortSignal) => Promise<void>;
  retryConfig?: { maxAttempts: number; baseDelayMs: number };
};

type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
};

type AnthropicMessageResponse = {
  content?: Array<{ type?: string; text?: string }>;
  stop_reason?: string | null;
  usage?: AnthropicUsage;
};

type AnthropicStreamEvent = {
  type?: string;
  message?: {
    usage?: AnthropicUsage;
  };
  delta?: {
    type?: string;
    text?: string;
    stop_reason?: string | null;
  };
  usage?: AnthropicUsage;
  error?: unknown;
};

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_RETRY_CONFIG = { maxAttempts: 3, baseDelayMs: 1000 };
const DEFAULT_FIRST_TOKEN_TIMEOUT_MS = 8000;
const DEFAULT_TOTAL_TIMEOUT_MS = 20000;

const defaultSleep = (ms: number, signal?: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new LLMError('ABORTED', 'aborted'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new LLMError('ABORTED', 'aborted'));
    }, { once: true });
  });
};

export class AnthropicClient implements LLMClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number, signal?: AbortSignal) => Promise<void>;
  private readonly retryConfig: { maxAttempts: number; baseDelayMs: number };

  constructor(private opts: LLMClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
    this.sleepImpl = opts.sleepImpl ?? defaultSleep;
    this.retryConfig = opts.retryConfig ?? DEFAULT_RETRY_CONFIG;
  }

  async complete(opts: CompletionOpts): Promise<CompletionResult> {
    const response = await this.requestWithRetry(opts, false);
    const data = await parseJsonResponse<AnthropicMessageResponse>(response);
    const usage = mapUsage(data.usage);
    const text = extractText(data);
    const stopReason = (data.stop_reason ?? 'end_turn') as StopReason;

    return {
      text,
      stopReason,
      usage,
      costUSD: actualCostUSD(opts.model, usage, opts.cacheTTLHint),
    };
  }

  async *completeStream(opts: CompletionOpts): AsyncGenerator<StreamChunk> {
    const response = await this.requestOnce(opts, true);
    if (!response.body) {
      throw new LLMError('STREAM_ERROR', 'stream response body missing');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const startedAt = Date.now();
    let firstTextReceived = false;
    let buffer = '';
    let text = '';
    let stopReason: StopReason = 'end_turn';
    let usage = mapUsage();
    const firstTokenDeadline = startedAt + (opts.firstTokenTimeoutMs ?? DEFAULT_FIRST_TOKEN_TIMEOUT_MS);

    try {
      while (true) {
        this.throwIfAborted(opts.abortSignal);
        this.throwIfTimedOut(startedAt, opts.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS);

        const firstTokenTimeoutMs = firstTextReceived
          ? undefined
          : firstTokenDeadline - Date.now();
        if (firstTokenTimeoutMs !== undefined && firstTokenTimeoutMs <= 0) {
          throw new LLMError('FIRST_TOKEN_TIMEOUT', 'first token timeout');
        }

        const read = await this.readWithTimeout(
          reader,
          opts.abortSignal,
          timeoutLeft(startedAt, opts.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS),
          firstTokenTimeoutMs,
        );

        if (read.done) break;

        buffer += decoder.decode(read.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const event = parseSseDataLine(line);
          if (!event) continue;

          if (event.type === 'message_start') {
            usage = mergeUsage(usage, event.message?.usage);
          } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            const delta = event.delta.text ?? '';
            firstTextReceived = true;
            text += delta;
            yield { type: 'text', delta };
          } else if (event.type === 'message_delta') {
            usage = mergeUsage(usage, event.usage);
            if (event.delta?.stop_reason) {
              stopReason = event.delta.stop_reason as StopReason;
            }
          } else if (event.type === 'message_stop') {
            const result = {
              text,
              stopReason,
              usage,
              costUSD: actualCostUSD(opts.model, usage, opts.cacheTTLHint),
            };
            yield { type: 'usage', usage };
            yield { type: 'done', result };
            return;
          } else if (event.type === 'error') {
            throw new LLMError('STREAM_ERROR', 'stream error', event.error);
          }
        }
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw normalizeStreamError(error);
    } finally {
      reader.releaseLock();
    }

    const result = {
      text,
      stopReason,
      usage,
      costUSD: actualCostUSD(opts.model, usage, opts.cacheTTLHint),
    };
    yield { type: 'usage', usage };
    yield { type: 'done', result };
  }

  private async requestWithRetry(opts: CompletionOpts, stream: boolean): Promise<Response> {
    let lastStatus: number | undefined;
    const attempts = Math.max(1, this.retryConfig.maxAttempts);

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await this.requestOnce(opts, stream);
        if (response.ok) return response;

        lastStatus = response.status;
        if (!isRetryableStatus(response.status) || attempt >= attempts) {
          throw errorForStatus(response.status);
        }
      } catch (error) {
        if (error instanceof LLMError) throw error;
        if (isAbortError(error) || opts.abortSignal?.aborted) {
          throw new LLMError('ABORTED', 'aborted', error);
        }
        if (attempt >= attempts) {
          throw new LLMError('HTTP_ERROR', 'network error', error);
        }
      }

      await this.sleepImpl(this.retryConfig.baseDelayMs * (2 ** (attempt - 1)), opts.abortSignal)
        .catch((error: unknown) => {
          if (error instanceof LLMError) throw error;
          if (isAbortError(error) || opts.abortSignal?.aborted) {
            throw new LLMError('ABORTED', 'aborted', error);
          }
          throw error;
        });
    }

    throw errorForStatus(lastStatus);
  }

  private async requestOnce(opts: CompletionOpts, stream: boolean): Promise<Response> {
    this.throwIfAborted(opts.abortSignal);

    let response: Response;
    try {
      const requestInit: RequestInit = {
        method: 'POST',
        headers: {
          'x-api-key': this.opts.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(buildBody(opts, stream)),
      };
      if (opts.abortSignal) {
        requestInit.signal = opts.abortSignal;
      }

      response = await this.fetchImpl(ANTHROPIC_MESSAGES_URL, {
        ...requestInit,
      });
    } catch (error) {
      if (isAbortError(error) || opts.abortSignal?.aborted) {
        throw new LLMError('ABORTED', 'aborted', error);
      }
      throw new LLMError('HTTP_ERROR', 'network error', error);
    }

    if (!response.ok && stream) {
      throw errorForStatus(response.status);
    }

    return response;
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw new LLMError('ABORTED', 'aborted');
  }

  private throwIfTimedOut(startedAt: number, timeoutMs: number): void {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new LLMError('TOTAL_TIMEOUT', 'total stream timeout');
    }
  }

  private async readWithTimeout(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal: AbortSignal | undefined,
    totalTimeoutMs: number,
    firstTokenTimeoutMs: number | undefined,
  ): Promise<ReadableStreamReadResult<Uint8Array>> {
    return await raceWithTimeouts(reader.read(), signal, totalTimeoutMs, firstTokenTimeoutMs);
  }
}

function buildBody(opts: CompletionOpts, stream: boolean): unknown {
  return {
    model: MODEL_API_IDS[opts.model],
    max_tokens: opts.maxTokens,
    system: opts.system.map((block) => {
      if (!block.cache || block.cache === 'none') {
        return { type: 'text', text: block.text };
      }
      return {
        type: 'text',
        text: block.text,
        cache_control: {
          type: 'ephemeral',
          ttl: block.cache === '1h' ? '1h' : '5m',
        },
      };
    }),
    messages: opts.messages,
    temperature: opts.temperature,
    stream,
  };
}

function mapUsage(usage?: AnthropicUsage): Usage {
  const cacheCreation5mTokens = usage?.cache_creation?.ephemeral_5m_input_tokens;
  const cacheCreation1hTokens = usage?.cache_creation?.ephemeral_1h_input_tokens;
  const cacheCreationTokens =
    usage?.cache_creation_input_tokens ??
    ((cacheCreation5mTokens ?? 0) + (cacheCreation1hTokens ?? 0));

  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheCreationTokens,
    ...(cacheCreation5mTokens !== undefined ? { cacheCreation5mTokens } : {}),
    ...(cacheCreation1hTokens !== undefined ? { cacheCreation1hTokens } : {}),
  };
}

function mergeUsage(current: Usage, incoming?: AnthropicUsage): Usage {
  if (!incoming) return current;
  const next = mapUsage(incoming);
  return {
    inputTokens: next.inputTokens || current.inputTokens,
    outputTokens: next.outputTokens || current.outputTokens,
    cacheReadTokens: next.cacheReadTokens || current.cacheReadTokens,
    cacheCreationTokens: next.cacheCreationTokens || current.cacheCreationTokens,
    ...(next.cacheCreation5mTokens !== undefined
      ? { cacheCreation5mTokens: next.cacheCreation5mTokens }
      : current.cacheCreation5mTokens !== undefined
        ? { cacheCreation5mTokens: current.cacheCreation5mTokens }
        : {}),
    ...(next.cacheCreation1hTokens !== undefined
      ? { cacheCreation1hTokens: next.cacheCreation1hTokens }
      : current.cacheCreation1hTokens !== undefined
        ? { cacheCreation1hTokens: current.cacheCreation1hTokens }
        : {}),
  };
}

function extractText(data: AnthropicMessageResponse): string {
  return data.content
    ?.filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('') ?? '';
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch (error) {
    throw new LLMError('HTTP_ERROR', 'invalid json response', error, response.status);
  }
}

function parseSseDataLine(line: string): AnthropicStreamEvent | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return undefined;

  const data = trimmed.slice('data:'.length).trim();
  if (!data || data === '[DONE]') return undefined;

  try {
    return JSON.parse(data) as AnthropicStreamEvent;
  } catch (error) {
    throw new LLMError('STREAM_ERROR', 'invalid stream json', error);
  }
}

function raceWithTimeouts<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  totalTimeoutMs: number,
  firstTokenTimeoutMs: number | undefined,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new LLMError('ABORTED', 'aborted'));
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const cleanup = () => {
      for (const timer of timers) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new LLMError('ABORTED', 'aborted'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });

    timers.push(setTimeout(() => {
      cleanup();
      reject(new LLMError('TOTAL_TIMEOUT', 'total stream timeout'));
    }, totalTimeoutMs));

    if (firstTokenTimeoutMs !== undefined) {
      timers.push(setTimeout(() => {
        cleanup();
        reject(new LLMError('FIRST_TOKEN_TIMEOUT', 'first token timeout'));
      }, firstTokenTimeoutMs));
    }

    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}

function timeoutLeft(startedAt: number, timeoutMs: number): number {
  return Math.max(1, timeoutMs - (Date.now() - startedAt));
}

function normalizeStreamError(error: unknown): LLMError {
  if (error instanceof LLMError) return error;
  if (isAbortError(error)) return new LLMError('ABORTED', 'aborted', error);
  return new LLMError('STREAM_ERROR', 'stream error', error);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function errorForStatus(status?: number): LLMError {
  if (status === 401) return new LLMError('KEY_INVALID', 'invalid api key', undefined, 401);
  if (status === 429) return new LLMError('RATE_LIMIT', 'rate limited', undefined, 429);
  return new LLMError(errorCodeForStatus(status), 'http error', undefined, status);
}

function errorCodeForStatus(status?: number): LLMErrorCode {
  if (status === 429) return 'RATE_LIMIT';
  return 'HTTP_ERROR';
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
