import type { GlobalLLMQueue } from './types';
import { LLMError } from './types';

const MAX_CONCURRENT = 1;

class GlobalLLMQueueImpl implements GlobalLLMQueue {
  private active = 0;
  private waiters: Array<{
    resolve: (release: () => void) => void;
    reject: (err: Error) => void;
    timeoutId?: ReturnType<typeof setTimeout>;
  }> = [];

  acquire(timeoutMs?: number): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const makeRelease = (): (() => void) => {
        let released = false;
        return () => {
          if (released) return;
          released = true;
          this.active = Math.max(0, this.active - 1);
          const next = this.waiters.shift();
          if (next) {
            if (next.timeoutId) clearTimeout(next.timeoutId);
            this.active++;
            next.resolve(makeRelease());
          }
        };
      };

      if (this.active < MAX_CONCURRENT) {
        this.active++;
        resolve(makeRelease());
        return;
      }

      const waiter: {
        resolve: (release: () => void) => void;
        reject: (err: Error) => void;
        timeoutId?: ReturnType<typeof setTimeout>;
      } = { resolve, reject };

      if (typeof timeoutMs === 'number' && timeoutMs > 0) {
        waiter.timeoutId = setTimeout(() => {
          const idx = this.waiters.indexOf(waiter);
          if (idx >= 0) this.waiters.splice(idx, 1);
          reject(new LLMError('QUEUE_TIMEOUT', `acquire timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }
      this.waiters.push(waiter);
    });
  }

  isActive(): boolean {
    return this.active >= MAX_CONCURRENT;
  }

  pendingCount(): number {
    return this.waiters.length;
  }
}

let _instance: GlobalLLMQueue | null = null;

/** Devuelve la instancia singleton de la cola global LLM. */
export function getGlobalQueue(): GlobalLLMQueue {
  if (!_instance) _instance = new GlobalLLMQueueImpl();
  return _instance;
}

/** Solo para tests: resetea el singleton. */
export function resetGlobalQueueForTests(): void {
  _instance = null;
}
