import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnthropicClient } from '../../src/llm/anthropic-client';
import { MODEL_API_IDS } from '../../src/llm/models';
import { LLMError, type CompletionOpts, type StreamChunk } from '../../src/llm/types';

const baseOpts: CompletionOpts = {
  model: 'haiku-4-5',
  system: [{ text: 'You are concise.' }],
  messages: [{ role: 'user', content: 'Hello' }],
  maxTokens: 64,
  temperature: 0.2,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function mockFetchOnce(response: Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  }));
}

function sse(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

async function collectStream(client: AnthropicClient, opts: CompletionOpts): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of client.completeStream(opts)) {
    chunks.push(chunk);
  }
  return chunks;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('AnthropicClient', () => {
  it('sends required Anthropic headers', async () => {
    const fetchMock = mockFetchOnce(jsonResponse({
      content: [{ type: 'text', text: 'ok' }],
      usage: {},
    }));
    const client = new AnthropicClient({ apiKey: 'test-key' });

    await client.complete(baseOpts);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({
      'x-api-key': 'test-key',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    });
  });

  it('maps internal model alias to Anthropic API id', async () => {
    const fetchMock = mockFetchOnce(jsonResponse({
      content: [{ type: 'text', text: 'ok' }],
      usage: {},
    }));
    const client = new AnthropicClient({ apiKey: 'test-key' });

    await client.complete(baseOpts);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { model: string };
    expect(body.model).toBe(MODEL_API_IDS['haiku-4-5']);
  });

  it('returns text, usage, stop reason, and cost for JSON completions', async () => {
    mockFetchOnce(jsonResponse({
      content: [
        { type: 'text', text: 'hello ' },
        { type: 'text', text: 'world' },
      ],
      stop_reason: 'max_tokens',
      usage: { input_tokens: 1_000, output_tokens: 100 },
    }));
    const client = new AnthropicClient({ apiKey: 'test-key' });

    const result = await client.complete(baseOpts);

    expect(result.text).toBe('hello world');
    expect(result.stopReason).toBe('max_tokens');
    expect(result.usage).toEqual({
      inputTokens: 1_000,
      outputTokens: 100,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    });
    expect(result.costUSD).toBeCloseTo(0.0015);
  });

  it('maps 401 responses to KEY_INVALID', async () => {
    mockFetchOnce(jsonResponse({ error: 'bad key' }, 401));
    const client = new AnthropicClient({ apiKey: 'bad-key' });

    await expect(client.complete(baseOpts)).rejects.toMatchObject({
      name: 'LLMError',
      code: 'KEY_INVALID',
      httpStatus: 401,
    } satisfies Partial<LLMError>);
  });

  it('maps exhausted 429 retries to RATE_LIMIT', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'rate limited' }, 429))
      .mockResolvedValueOnce(jsonResponse({ error: 'rate limited' }, 429));
    vi.stubGlobal('fetch', fetchMock);
    const client = new AnthropicClient({
      apiKey: 'test-key',
      retryConfig: { maxAttempts: 2, baseDelayMs: 10 },
    });

    const promise = client.complete(baseOpts);
    const assertion = expect(promise).rejects.toMatchObject({
      code: 'RATE_LIMIT',
      httpStatus: 429,
    } satisfies Partial<LLMError>);
    await vi.advanceTimersByTimeAsync(10);

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps exhausted 5xx retries to HTTP_ERROR', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'server error' }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: 'server error' }, 503));
    vi.stubGlobal('fetch', fetchMock);
    const client = new AnthropicClient({
      apiKey: 'test-key',
      retryConfig: { maxAttempts: 2, baseDelayMs: 10 },
    });

    const promise = client.complete(baseOpts);
    const assertion = expect(promise).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      httpStatus: 503,
    } satisfies Partial<LLMError>);
    await vi.advanceTimersByTimeAsync(10);

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('parses SSE message_start, content_block_delta, and message_stop events', async () => {
    mockFetchOnce(streamResponse([
      sse({ type: 'message_start', message: { usage: { input_tokens: 10 } } }),
      sse({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'hel' } }),
      sse({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } }),
      sse({ type: 'message_delta', usage: { output_tokens: 2 }, delta: { stop_reason: 'end_turn' } }),
      sse({ type: 'message_stop' }),
    ]));
    const client = new AnthropicClient({ apiKey: 'test-key' });

    const chunks = await collectStream(client, baseOpts);

    expect(chunks).toEqual([
      { type: 'text', delta: 'hel' },
      { type: 'text', delta: 'lo' },
      {
        type: 'usage',
        usage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0 },
      },
      {
        type: 'done',
        result: {
          text: 'hello',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0 },
          costUSD: 0.00002,
        },
      },
    ]);
  });

  it('maps SSE error events to STREAM_ERROR', async () => {
    mockFetchOnce(streamResponse([
      sse({ type: 'error', error: { type: 'overloaded_error' } }),
    ]));
    const client = new AnthropicClient({ apiKey: 'test-key' });

    await expect(collectStream(client, baseOpts)).rejects.toMatchObject({
      code: 'STREAM_ERROR',
    } satisfies Partial<LLMError>);
  });

  it('maps aborts before streaming starts to ABORTED', async () => {
    const controller = new AbortController();
    controller.abort();
    mockFetchOnce(streamResponse([]));
    const client = new AnthropicClient({ apiKey: 'test-key' });

    await expect(collectStream(client, { ...baseOpts, abortSignal: controller.signal }))
      .rejects.toMatchObject({ code: 'ABORTED' } satisfies Partial<LLMError>);
  });

  it('maps AbortSignal mid-stream to ABORTED', async () => {
    mockFetchOnce(streamResponse([
      sse({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'first' } }),
      sse({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'second' } }),
      sse({ type: 'message_stop' }),
    ]));
    const controller = new AbortController();
    const client = new AnthropicClient({ apiKey: 'test-key' });
    const iterator = client.completeStream({ ...baseOpts, abortSignal: controller.signal })[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { type: 'text', delta: 'first' },
    });
    controller.abort();

    await expect(iterator.next()).rejects.toMatchObject({
      code: 'ABORTED',
    } satisfies Partial<LLMError>);
  });

  it('maps system block cache_control ttl for ephemeral 5m and 1h blocks', async () => {
    const fetchMock = mockFetchOnce(jsonResponse({
      content: [{ type: 'text', text: 'ok' }],
      usage: {},
    }));
    const client = new AnthropicClient({ apiKey: 'test-key' });

    await client.complete({
      ...baseOpts,
      system: [
        { text: 'uncached' },
        { text: 'short cache', cache: '5m' },
        { text: 'long cache', cache: '1h' },
      ],
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { system: unknown[] };
    expect(body.system).toEqual([
      { type: 'text', text: 'uncached' },
      { type: 'text', text: 'short cache', cache_control: { type: 'ephemeral', ttl: '5m' } },
      { type: 'text', text: 'long cache', cache_control: { type: 'ephemeral', ttl: '1h' } },
    ]);
  });

  it('includes stream flag and request messages in the Anthropic body', async () => {
    const fetchMock = mockFetchOnce(streamResponse([sse({ type: 'message_stop' })]));
    const client = new AnthropicClient({ apiKey: 'test-key' });

    await collectStream(client, baseOpts);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      stream: boolean;
      messages: CompletionOpts['messages'];
      max_tokens: number;
      temperature?: number;
    };
    expect(body.stream).toBe(true);
    expect(body.messages).toEqual(baseOpts.messages);
    expect(body.max_tokens).toBe(baseOpts.maxTokens);
    expect(body.temperature).toBe(baseOpts.temperature);
  });
});
