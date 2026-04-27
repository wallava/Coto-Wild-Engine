import type {
  CompletionOpts,
  CompletionResult,
  LLMClient,
  LLMModel,
  StreamChunk,
  Usage,
} from './types';
import { LLMError } from './types';
import { actualCostUSD } from './cost';

export type ScriptedResponse = {
  matchPattern?: RegExp;
  text: string;
  usage?: Partial<Usage>;
  streamDelayMs?: number;
};

export type MockClientOptions = {
  defaultModel?: LLMModel;
  sleepImpl?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

const DEFAULT_USAGE: Usage = {
  inputTokens: 10,
  outputTokens: 5,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
};

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new LLMError('ABORTED', 'MockLLMClient: aborted'));
  }

  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;

    const onAbort = (): void => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      reject(new LLMError('ABORTED', 'MockLLMClient: aborted'));
    };

    timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class MockLLMClient implements LLMClient {
  private readonly defaultModel: LLMModel;
  private readonly sleepImpl: (ms: number, signal?: AbortSignal) => Promise<void>;
  private readonly queuedResponses: ScriptedResponse[] = [];
  private readonly registeredResponses: ScriptedResponse[] = [];

  constructor(opts?: MockClientOptions) {
    this.defaultModel = opts?.defaultModel ?? 'haiku-4-5';
    this.sleepImpl = opts?.sleepImpl ?? defaultSleep;
  }

  queue(response: ScriptedResponse): void {
    this.queuedResponses.push(response);
  }

  on(matchPattern: RegExp, response: Omit<ScriptedResponse, 'matchPattern'>): void {
    this.registeredResponses.push({ ...response, matchPattern });
  }

  async complete(opts: CompletionOpts): Promise<CompletionResult> {
    const scripted = this.nextResponse(opts);
    return this.buildResult(opts.model ?? this.defaultModel, scripted);
  }

  async *completeStream(opts: CompletionOpts): AsyncGenerator<StreamChunk> {
    const scripted = this.nextResponse(opts);
    const result = this.buildResult(opts.model ?? this.defaultModel, scripted);
    const words = scripted.text.trim().length === 0 ? [] : scripted.text.trim().split(/\s+/);
    const delayMs = scripted.streamDelayMs ?? 0;

    for (let index = 0; index < words.length; index += 1) {
      this.throwIfAborted(opts.abortSignal);
      yield { type: 'text', delta: `${words[index]} ` };

      if (index < words.length - 1) {
        await this.sleepImpl(delayMs, opts.abortSignal);
      }
    }

    this.throwIfAborted(opts.abortSignal);
    yield { type: 'usage', usage: result.usage };
    yield { type: 'done', result };
  }

  private nextResponse(opts: CompletionOpts): ScriptedResponse {
    const input = opts.messages.at(-1)?.content ?? '';
    const registeredMatch = this.registeredResponses.find((response) => {
      if (!response.matchPattern) return false;
      response.matchPattern.lastIndex = 0;
      return response.matchPattern.test(input);
    });

    if (registeredMatch) return registeredMatch;

    const queuedResponse = this.queuedResponses.shift();
    if (queuedResponse) return queuedResponse;

    throw new LLMError(
      'STREAM_ERROR',
      `MockLLMClient: no scripted response for input: ${input}`,
    );
  }

  private buildResult(model: LLMModel, response: ScriptedResponse): CompletionResult {
    const usage: Usage = {
      ...DEFAULT_USAGE,
      ...response.usage,
    };

    return {
      text: response.text,
      stopReason: 'end_turn',
      usage,
      costUSD: actualCostUSD(model, usage),
    };
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new LLMError('ABORTED', 'MockLLMClient: aborted');
    }
  }
}
