import { describe, it, expect, vi } from 'vitest';
import {
  applyAgentAction,
  applySayAction,
  applyEmoteAction,
} from '../../../src/game/llm-agents/actions';
import type { AgentLike, ShowSpeechBubbleFn } from '../../../src/game/llm-agents/actions';

function makeAgent(): AgentLike {
  return { id: 'agent-1' };
}

describe('applySayAction', () => {
  it('invoca showSpeechBubble con texto + autoCloseAfter 3.0s', () => {
    const agent = makeAgent();
    const fn = vi.fn() as unknown as ShowSpeechBubbleFn;
    applySayAction(agent, 'hola mundo', fn);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith(agent, 'hola mundo', { autoCloseAfter: 3.0 });
  });
});

describe('applyEmoteAction', () => {
  it('invoca showSpeechBubble con emote + autoCloseAfter 2.0s', () => {
    const agent = makeAgent();
    const fn = vi.fn() as unknown as ShowSpeechBubbleFn;
    applyEmoteAction(agent, '🤔', fn);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith(agent, '🤔', { autoCloseAfter: 2.0 });
  });

  it('preserva strings multi-char (palabra corta como emote)', () => {
    const agent = makeAgent();
    const fn = vi.fn() as unknown as ShowSpeechBubbleFn;
    applyEmoteAction(agent, 'meh', fn);
    expect(fn).toHaveBeenCalledWith(agent, 'meh', { autoCloseAfter: 2.0 });
  });
});

describe('applyAgentAction dispatcher', () => {
  it('SAY → applySayAction (autoClose 3.0)', () => {
    const agent = makeAgent();
    const fn = vi.fn() as unknown as ShowSpeechBubbleFn;
    applyAgentAction(agent, { type: 'SAY', text: 'hola' }, fn);
    expect(fn).toHaveBeenCalledWith(agent, 'hola', { autoCloseAfter: 3.0 });
  });

  it('EMOTE → applyEmoteAction (autoClose 2.0)', () => {
    const agent = makeAgent();
    const fn = vi.fn() as unknown as ShowSpeechBubbleFn;
    applyAgentAction(agent, { type: 'EMOTE', emote: '😅' }, fn);
    expect(fn).toHaveBeenCalledWith(agent, '😅', { autoCloseAfter: 2.0 });
  });

  it('WALK_TO sigue siendo stub (console.warn, sin bubble)', () => {
    const agent = makeAgent();
    const fn = vi.fn() as unknown as ShowSpeechBubbleFn;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    applyAgentAction(agent, { type: 'WALK_TO', target: 'kitchen' }, fn);
    expect(fn).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]![0]).toContain('WALK_TO');
    warnSpy.mockRestore();
  });

  it('LOOK_AT sigue siendo stub (console.warn, sin bubble)', () => {
    const agent = makeAgent();
    const fn = vi.fn() as unknown as ShowSpeechBubbleFn;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    applyAgentAction(agent, { type: 'LOOK_AT', target: 'agent-2' }, fn);
    expect(fn).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]![0]).toContain('LOOK_AT');
    warnSpy.mockRestore();
  });
});
