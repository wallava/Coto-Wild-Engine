import { describe, expect, it, vi } from 'vitest';
import { MockLLMClient } from '../../src/llm/mock-client';
import { LLMError, type CompletionOpts, type StreamChunk } from '../../src/llm/types';

const baseOpts: CompletionOpts = {
  model: 'haiku-4-5',
  system: [],
  messages: [{ role: 'user', content: 'hello' }],
  maxTokens: 32,
};

async function collectStream(client: MockLLMClient, opts: CompletionOpts): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of client.completeStream(opts)) {
    chunks.push(chunk);
  }
  return chunks;
}

describe('MockLLMClient', () => {
  it('consumes queued responses in FIFO order', async () => {
    const client = new MockLLMClient();
    client.queue({ text: 'first' });
    client.queue({ text: 'second' });

    await expect(client.complete(baseOpts)).resolves.toMatchObject({ text: 'first' });
    await expect(client.complete(baseOpts)).resolves.toMatchObject({ text: 'second' });
  });

  it('matches registered pattern responses', async () => {
    const client = new MockLLMClient();
    client.on(/weather/i, { text: 'sunny' });

    const result = await client.complete({
      ...baseOpts,
      messages: [{ role: 'user', content: 'What is the weather?' }],
    });

    expect(result.text).toBe('sunny');
  });

  it('throws when queue is empty and no registered pattern matches', async () => {
    const client = new MockLLMClient();

    await expect(client.complete(baseOpts)).rejects.toMatchObject({
      code: 'STREAM_ERROR',
    } satisfies Partial<LLMError>);
  });

  it('simulates streaming by emitting text word by word', async () => {
    const client = new MockLLMClient();
    client.queue({ text: 'one two three' });

    const chunks = await collectStream(client, baseOpts);

    expect(chunks.filter(chunk => chunk.type === 'text')).toEqual([
      { type: 'text', delta: 'one ' },
      { type: 'text', delta: 'two ' },
      { type: 'text', delta: 'three ' },
    ]);
    expect(chunks.at(-1)?.type).toBe('done');
  });

  it('maps AbortSignal during delayed streaming to ABORTED', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const client = new MockLLMClient();
    client.queue({ text: 'one two', streamDelayMs: 100 });
    const iterator = client.completeStream({ ...baseOpts, abortSignal: controller.signal })[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { type: 'text', delta: 'one ' },
    });
    const pending = iterator.next();
    const assertion = expect(pending).rejects.toMatchObject({
      code: 'ABORTED',
    } satisfies Partial<LLMError>);
    controller.abort();
    await vi.runOnlyPendingTimersAsync();

    await assertion;
    vi.useRealTimers();
  });

  it('calculates costUSD from mocked usage', async () => {
    const client = new MockLLMClient();
    client.queue({
      text: 'priced',
      usage: {
        inputTokens: 1_000,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      },
    });

    const result = await client.complete(baseOpts);

    expect(result.costUSD).toBeCloseTo(0.0015);
  });
});
