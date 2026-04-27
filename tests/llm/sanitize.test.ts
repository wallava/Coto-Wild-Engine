import { describe, expect, it } from 'vitest';
import { sanitizeWorldString, wrapWorldContext } from '../../src/llm/sanitize';

describe('sanitizeWorldString', () => {
  it('escapes backticks to apostrophes', () => {
    expect(sanitizeWorldString('say `hello`')).toBe("say 'hello'");
  });

  it('converts double quotes to single quotes', () => {
    expect(sanitizeWorldString('say "hello"')).toBe("say 'hello'");
  });

  it('converts newlines to spaces', () => {
    expect(sanitizeWorldString('one\ntwo\r\nthree\rfour')).toBe('one two three four');
  });

  it('truncates over the length limit with ellipsis', () => {
    expect(sanitizeWorldString('abcdefghij', 8)).toBe('abcde...');
  });

  it('escapes literal world_context tags', () => {
    expect(sanitizeWorldString('<world_context>x</world_context>')).toBe(
      '&lt;world_context&gt;x&lt;/world_context&gt;',
    );
  });

  it('wrapWorldContext wraps content in world context tags', () => {
    expect(wrapWorldContext('safe content')).toBe(
      '<world_context>\nsafe content\n</world_context>',
    );
  });
});
