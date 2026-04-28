import type { AgentLike, ShowSpeechBubbleFn } from './actions';

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
  /** autoCloseAfter pasado a showSpeechBubble. Default 3.0s. */
  autoCloseAfter?: number;
};

export function showStreamingBubble(
  agent: AgentLike,
  showSpeechBubble: ShowSpeechBubbleFn,
  opts: StreamingBubbleOptions = {},
): StreamingBubbleController {
  let acc = '';
  let aborted = false;
  let closed = false;

  const update = (text: string): void => {
    if (aborted || closed) return;
    try {
      // Estrategia: re-llamar showSpeechBubble con texto acumulado.
      // El juego puede (o no) actualizar el bubble existente. Si no funciona
      // visualmente, fallback "show on done" via close().
      showSpeechBubble(agent, text, { autoCloseAfter: 999 });   // mantener abierto durante stream
    } catch (err) {
      // ignorar errores de DOM update durante stream — close mostrará texto final
      console.warn('[streaming-ui] update failed, will show on close:', err);
    }
  };

  return {
    append(delta: string): void {
      if (aborted || closed) return;
      acc += delta;
      update(acc);
    },
    close(): void {
      if (closed) return;
      closed = true;
      // Mostrar texto final con autoCloseAfter normal.
      try {
        showSpeechBubble(agent, acc, { autoCloseAfter: opts.autoCloseAfter ?? 3.0 });
      } catch (err) {
        console.warn('[streaming-ui] final show failed:', err);
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
