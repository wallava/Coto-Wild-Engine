/**
 * Duración del bubble proporcional al texto. Pieza pura testeable.
 * Pattern: base + chars * step, clampado entre min y max.
 */

export const BUBBLE_BASE_MS = 2000;
export const BUBBLE_PER_CHAR_MS = 50;
export const BUBBLE_MIN_MS = 2000;
export const BUBBLE_MAX_MS = 8000;

/**
 * Duración del bubble en milisegundos.
 * 0 chars → 2000ms (clamp min).
 * 50 chars → 4500ms.
 * 500 chars → 8000ms (clamp max).
 */
export function getBubbleDurationMs(text: string): number {
  const charCount = text.length;
  const raw = BUBBLE_BASE_MS + charCount * BUBBLE_PER_CHAR_MS;
  return Math.max(BUBBLE_MIN_MS, Math.min(BUBBLE_MAX_MS, raw));
}
