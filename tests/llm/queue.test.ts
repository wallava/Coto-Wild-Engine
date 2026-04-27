import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGlobalQueue, resetGlobalQueueForTests } from '../../src/llm/queue';
import { LLMError } from '../../src/llm/types';

afterEach(() => {
  resetGlobalQueueForTests();
  vi.useRealTimers();
});

describe('Global LLM queue', () => {
  it('acquire returns a release function', async () => {
    const queue = getGlobalQueue();

    const release = await queue.acquire();

    expect(release).toEqual(expect.any(Function));
    release();
  });

  it('allows one active holder and queues the second acquire', async () => {
    const queue = getGlobalQueue();
    const release = await queue.acquire();
    const pending = queue.acquire();

    expect(queue.isActive()).toBe(true);
    expect(queue.pendingCount()).toBe(1);

    release();
    const secondRelease = await pending;
    secondRelease();
  });

  it('resolves waiters in FIFO order', async () => {
    const queue = getGlobalQueue();
    const release = await queue.acquire();
    const order: string[] = [];
    const first = queue.acquire().then(nextRelease => {
      order.push('first');
      return nextRelease;
    });
    const second = queue.acquire().then(nextRelease => {
      order.push('second');
      return nextRelease;
    });

    release();
    const firstRelease = await first;
    firstRelease();
    const secondRelease = await second;
    secondRelease();

    expect(order).toEqual(['first', 'second']);
  });

  it('rejects queued acquire with QUEUE_TIMEOUT after timeoutMs', async () => {
    vi.useFakeTimers();
    const queue = getGlobalQueue();
    const release = await queue.acquire();
    const pending = queue.acquire(50);
    const assertion = expect(pending).rejects.toMatchObject({
      code: 'QUEUE_TIMEOUT',
    } satisfies Partial<LLMError>);

    await vi.advanceTimersByTimeAsync(50);

    await assertion;
    expect(queue.pendingCount()).toBe(0);
    release();
  });

  it('makes release idempotent so double release does not decrement twice', async () => {
    const queue = getGlobalQueue();
    const release = await queue.acquire();

    release();
    release();

    expect(queue.isActive()).toBe(false);
    const nextRelease = await queue.acquire();
    expect(queue.isActive()).toBe(true);
    nextRelease();
  });

  it('resetGlobalQueueForTests clears singleton state between tests', async () => {
    const queue = getGlobalQueue();
    await queue.acquire();
    void queue.acquire();
    expect(queue.pendingCount()).toBe(1);

    resetGlobalQueueForTests();
    const freshQueue = getGlobalQueue();

    expect(freshQueue.isActive()).toBe(false);
    expect(freshQueue.pendingCount()).toBe(0);
    const release = await freshQueue.acquire();
    release();
  });
});
