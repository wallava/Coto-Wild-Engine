import { describe, it, expect, vi } from 'vitest';
import { showStreamingBubble } from '../../../src/game/llm-agents/streaming-ui';
import { getBubbleDurationMs } from '../../../src/game/llm-agents/bubble-duration';
import type { AgentLike, ShowSpeechBubbleFn } from '../../../src/game/llm-agents/actions';

type BubbleStub = { fullText: string; autoCloseAfter: number | null; timeRevealed: number | null };

function setup() {
  let handle: BubbleStub | null = null;
  const showSpeechBubble = vi.fn(((_agent: unknown, text: string, opts?: { autoCloseAfter?: number }) => {
    handle = {
      fullText: text,
      autoCloseAfter: opts?.autoCloseAfter ?? null,
      timeRevealed: null,
    };
    return handle;
  }) as ShowSpeechBubbleFn);
  const agent: AgentLike = { id: 'a1' };
  return { agent, showSpeechBubble, getHandle: () => handle };
}

describe('showStreamingBubble — R3 fix close-no-rebuild', () => {
  it('crea bubble UNA sola vez aunque haya múltiples appends', () => {
    const { agent, showSpeechBubble, getHandle } = setup();
    const ctrl = showStreamingBubble(agent, showSpeechBubble);
    ctrl.append('Hola ');
    ctrl.append('mundo ');
    ctrl.append('caveman.');
    expect(showSpeechBubble).toHaveBeenCalledTimes(1);
    expect(showSpeechBubble).toHaveBeenCalledWith(agent, ' ', { autoCloseAfter: 999 });
    expect(getHandle()?.fullText).toBe('Hola mundo caveman.');
  });

  it('close() NO re-llama showSpeechBubble (no typewriter restart)', () => {
    const { agent, showSpeechBubble, getHandle } = setup();
    const ctrl = showStreamingBubble(agent, showSpeechBubble, { nowSec: () => 42 });
    ctrl.append('Una dos');
    ctrl.close();
    expect(showSpeechBubble).toHaveBeenCalledTimes(1);
    // close mutó autoCloseAfter al final + timeRevealed=42.
    expect(getHandle()?.autoCloseAfter).toBe(getBubbleDurationMs('Una dos') / 1000);
    expect(getHandle()?.timeRevealed).toBe(42);
  });

  it('close sin appends previos: crea bubble vacío y mutación final aplica', () => {
    const { agent, showSpeechBubble, getHandle } = setup();
    const ctrl = showStreamingBubble(agent, showSpeechBubble, { nowSec: () => 7 });
    ctrl.close();
    expect(showSpeechBubble).toHaveBeenCalledTimes(1);
    // Sin appends previos: handle creado con placeholder ' ' (no mutado).
    expect(getHandle()?.fullText).toBe(' ');
    expect(getHandle()?.autoCloseAfter).toBe(getBubbleDurationMs('') / 1000);
    expect(getHandle()?.timeRevealed).toBe(7);
  });

  it('abort() previene mutaciones posteriores', () => {
    const { agent, showSpeechBubble, getHandle } = setup();
    const onUserAbort = vi.fn();
    const ctrl = showStreamingBubble(agent, showSpeechBubble, { onUserAbort });
    ctrl.append('Inicio.');
    const before = getHandle()?.fullText;
    ctrl.abort();
    ctrl.append(' MORE');
    ctrl.close();
    expect(onUserAbort).toHaveBeenCalledTimes(1);
    expect(getHandle()?.fullText).toBe(before);   // no mutó
  });

  it('autoCloseAfter override: usa opts.autoCloseAfter en close', () => {
    const { agent, showSpeechBubble, getHandle } = setup();
    const ctrl = showStreamingBubble(agent, showSpeechBubble, { autoCloseAfter: 99 });
    ctrl.append('x');
    ctrl.close();
    expect(getHandle()?.autoCloseAfter).toBe(99);
  });
});
