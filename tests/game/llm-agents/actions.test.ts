import { describe, it, expect, vi } from 'vitest';
import {
  applyAgentAction,
  applySayAction,
  applyEmoteAction,
  applyLookAtAction,
} from '../../../src/game/llm-agents/actions';
import type {
  ActionContext,
  AgentFacing,
  AgentLike,
  ShowSpeechBubbleFn,
} from '../../../src/game/llm-agents/actions';
import { getBubbleDurationMs } from '../../../src/game/llm-agents/bubble-duration';

function makeAgent(id = 'agent-1'): AgentLike {
  return { id };
}

function makeCtx(overrides: Partial<ActionContext> = {}): ActionContext & {
  showSpeechBubble: ReturnType<typeof vi.fn>;
  setFacing: ReturnType<typeof vi.fn>;
  getAgentPositionX: ReturnType<typeof vi.fn>;
} {
  const showSpeechBubble = vi.fn();
  const setFacing = vi.fn();
  const getAgentPositionX = vi.fn();
  return {
    showSpeechBubble: showSpeechBubble as unknown as ShowSpeechBubbleFn,
    setFacing: setFacing as unknown as (a: AgentLike, d: AgentFacing) => void,
    getAgentPositionX: getAgentPositionX as unknown as (id: string) => number | null,
    ...overrides,
  } as never;
}

describe('applySayAction', () => {
  it('invoca showSpeechBubble con texto + autoCloseAfter proporcional', () => {
    const agent = makeAgent();
    const ctx = makeCtx();
    applySayAction(agent, 'hola mundo', ctx);
    expect(ctx.showSpeechBubble).toHaveBeenCalledOnce();
    expect(ctx.showSpeechBubble).toHaveBeenCalledWith(agent, 'hola mundo', {
      autoCloseAfter: getBubbleDurationMs('hola mundo') / 1000,
    });
  });
});

describe('applyEmoteAction', () => {
  it('invoca showSpeechBubble con emote + autoCloseAfter 2.0s', () => {
    const agent = makeAgent();
    const ctx = makeCtx();
    applyEmoteAction(agent, '🤔', ctx);
    expect(ctx.showSpeechBubble).toHaveBeenCalledOnce();
    expect(ctx.showSpeechBubble).toHaveBeenCalledWith(agent, '🤔', {
      autoCloseAfter: 2.0,
    });
  });

  it('preserva strings multi-char (palabra corta como emote)', () => {
    const agent = makeAgent();
    const ctx = makeCtx();
    applyEmoteAction(agent, 'meh', ctx);
    expect(ctx.showSpeechBubble).toHaveBeenCalledWith(agent, 'meh', {
      autoCloseAfter: 2.0,
    });
  });
});

describe('applyLookAtAction', () => {
  it('target a la derecha (targetX > agentX) → setFacing left (convención legacy)', () => {
    const agent = makeAgent('a1');
    const ctx = makeCtx();
    ctx.getAgentPositionX.mockImplementation((id: string) => (id === 'a1' ? 100 : 200));
    applyLookAtAction(agent, 'a2', ctx);
    expect(ctx.setFacing).toHaveBeenCalledOnce();
    expect(ctx.setFacing).toHaveBeenCalledWith(agent, 'left');
  });

  it('target a la izquierda (targetX < agentX) → setFacing right', () => {
    const agent = makeAgent('a1');
    const ctx = makeCtx();
    ctx.getAgentPositionX.mockImplementation((id: string) => (id === 'a1' ? 200 : 50));
    applyLookAtAction(agent, 'a2', ctx);
    expect(ctx.setFacing).toHaveBeenCalledWith(agent, 'right');
  });

  it('misma X (dx < threshold) → no flip', () => {
    const agent = makeAgent('a1');
    const ctx = makeCtx();
    ctx.getAgentPositionX.mockImplementation(() => 100);
    applyLookAtAction(agent, 'a2', ctx);
    expect(ctx.setFacing).not.toHaveBeenCalled();
  });

  it('graceful: setFacing ausente → console.warn, no throw', () => {
    const agent = makeAgent();
    const ctx: ActionContext = {
      showSpeechBubble: vi.fn() as unknown as ShowSpeechBubbleFn,
      // sin setFacing ni getAgentPositionX
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    applyLookAtAction(agent, 'a2', ctx);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]![0]).toContain('LOOK_AT no wired');
    warnSpy.mockRestore();
  });

  it('graceful: getAgentPositionX devuelve null → console.warn, no setFacing', () => {
    const agent = makeAgent();
    const ctx = makeCtx();
    ctx.getAgentPositionX.mockReturnValue(null);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    applyLookAtAction(agent, 'a2', ctx);
    expect(ctx.setFacing).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

describe('applyAgentAction dispatcher', () => {
  it('SAY → applySayAction (autoClose proporcional)', () => {
    const agent = makeAgent();
    const ctx = makeCtx();
    applyAgentAction(agent, { type: 'SAY', text: 'hola' }, ctx);
    expect(ctx.showSpeechBubble).toHaveBeenCalledWith(agent, 'hola', {
      autoCloseAfter: getBubbleDurationMs('hola') / 1000,
    });
  });

  it('EMOTE → applyEmoteAction (autoClose 2.0)', () => {
    const agent = makeAgent();
    const ctx = makeCtx();
    applyAgentAction(agent, { type: 'EMOTE', emote: '😅' }, ctx);
    expect(ctx.showSpeechBubble).toHaveBeenCalledWith(agent, '😅', { autoCloseAfter: 2.0 });
  });

  it('LOOK_AT → applyLookAtAction (setFacing según posiciones)', () => {
    const agent = makeAgent('a1');
    const ctx = makeCtx();
    ctx.getAgentPositionX.mockImplementation((id: string) => (id === 'a1' ? 0 : 100));
    applyAgentAction(agent, { type: 'LOOK_AT', target: 'a2' }, ctx);
    expect(ctx.setFacing).toHaveBeenCalledWith(agent, 'left');
  });

  it('WALK_TO sigue siendo stub (console.warn, sin bubble)', () => {
    const agent = makeAgent();
    const ctx = makeCtx();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    applyAgentAction(agent, { type: 'WALK_TO', target: 'kitchen' }, ctx);
    expect(ctx.showSpeechBubble).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]![0]).toContain('WALK_TO');
    warnSpy.mockRestore();
  });
});
