import type { AgentLike, ShowSpeechBubbleFn, SpeechBubbleHandle } from './actions';
import { getBubbleDurationMs } from './bubble-duration';

export type StreamingBubbleController = {
  /** Append delta text. Updates bubble visible. */
  append(delta: string): void;
  /** Finaliza bubble (lo deja como speech bubble normal con auto-close). */
  close(): void;
  /** Cancela el stream (caller responde con fallback canned). */
  abort(): void;
  /** Texto acumulado actual. */
  getText(): string;
};

export type StreamingBubbleOptions = {
  /** Callback invocado cuando el usuario click en bubble (abort manual). */
  onUserAbort?: () => void;
  /** autoCloseAfter pasado a showSpeechBubble. Default: getBubbleDurationMs(text)/1000. */
  autoCloseAfter?: number;
  /** Lee tiempo (segundos). Inyectable para tests. Default: performance.now()/1000. */
  nowSec?: () => number;
};

const STREAMING_AUTOCLOSE_OPEN = 999;
// Placeholder no-vacío. engine/speech.showSpeechBubble rechaza text==='' con
// `if (!agent || !text) return null`, así que pasamos un espacio único pa
// crear el bubble. fullText luego se muta al texto real del stream.
const STREAMING_INITIAL_PLACEHOLDER = ' ';

/**
 * Crea un bubble de streaming asociado al agente. A diferencia del approach
 * legacy (re-llamar showSpeechBubble por cada delta — provocaba typewriter
 * restart y bubbles huérfanos), retiene la handle del primer call y muta
 * `fullText`/`autoCloseAfter`/`timeRevealed` directamente. close() solo
 * actualiza autoClose para que el timer de fade arranque.
 */
export function showStreamingBubble(
  agent: AgentLike,
  showSpeechBubble: ShowSpeechBubbleFn,
  opts: StreamingBubbleOptions = {},
): StreamingBubbleController {
  let acc = '';
  let aborted = false;
  let closed = false;
  let handle: SpeechBubbleHandle = null;
  const nowSec = opts.nowSec ?? (() => performance.now() / 1000);

  const ensureHandle = (): void => {
    if (handle || aborted) return;
    try {
      // Crear con placeholder. Subsequent mutaciones de fullText evitan
      // que showSpeechBubble se vuelva a llamar (causaba typewriter restart).
      handle = showSpeechBubble(agent, STREAMING_INITIAL_PLACEHOLDER, {
        autoCloseAfter: STREAMING_AUTOCLOSE_OPEN,
      });
    } catch (err) {
      console.warn('[streaming-ui] create failed:', err);
    }
  };

  return {
    append(delta: string): void {
      if (aborted || closed) return;
      acc += delta;
      ensureHandle();
      if (handle) {
        try {
          handle.fullText = acc;
        } catch (err) {
          console.warn('[streaming-ui] mutate fullText failed:', err);
        }
      }
    },
    close(): void {
      if (closed) return;
      // ensureHandle ANTES de marcar closed (close-without-append crea
      // bubble vacío para que el caller pueda mutar autoClose final).
      ensureHandle();
      closed = true;
      if (handle) {
        // Mutar autoClose final + timeRevealed=now garantiza que el fade
        // arranque inmediato sin esperar a que el typewriter alcance.
        try {
          handle.autoCloseAfter = opts.autoCloseAfter ?? getBubbleDurationMs(acc) / 1000;
          handle.timeRevealed = nowSec();
        } catch (err) {
          console.warn('[streaming-ui] close mutation failed:', err);
        }
      }
    },
    abort(): void {
      if (aborted) return;
      aborted = true;
      if (opts.onUserAbort) opts.onUserAbort();
    },
    getText(): string {
      return acc;
    },
  };
}
