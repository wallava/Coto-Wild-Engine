/**
 * Helpers DOM para POV controls + scrubbing del editor de cutscenes.
 *
 * `cePreviewMode` (orchestrator que muta state + DOM + invoca callbacks)
 * queda en legacy — Codex review previa lo descartó como over-injectado.
 * Acá viven solo los helpers DOM + utilidad de scrub.
 */

export const POV_ASPECTS: Record<string, number> = {
  full: 0,
  '16:9': 16 / 9,
  cinema: 2.39,
};

let _povControlsTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Muestra el overlay de POV controls. Auto-hide tras 2.5s.
 * Uso: cualquier mousemove durante POV-mode + activar preview.
 */
export function showPovControls(): void {
  const el = document.getElementById('pov-controls');
  if (!el) return;
  el.classList.add('visible');
  if (_povControlsTimeout) clearTimeout(_povControlsTimeout);
  _povControlsTimeout = setTimeout(() => {
    el.classList.remove('visible');
    _povControlsTimeout = null;
  }, 2500);
}

/** Oculta el overlay y limpia el timeout pendiente. */
export function hidePovControls(): void {
  const el = document.getElementById('pov-controls');
  if (el) el.classList.remove('visible');
  if (_povControlsTimeout) {
    clearTimeout(_povControlsTimeout);
    _povControlsTimeout = null;
  }
}

/**
 * Sync periódico del time + play button + progress fill del overlay POV.
 * No-op si `pov-mode` no está activo. `duration === 0` produce NaN%
 * (paridad legacy — legacy:5012-5014 también lo hace).
 */
export function updatePovOverlayTime(
  playhead: number,
  duration: number,
  playing: boolean,
  formatTime: (t: number) => string,
): void {
  if (!document.body.classList.contains('pov-mode')) return;
  const el = document.getElementById('pov-time');
  if (el) el.textContent = `${formatTime(playhead)} / ${formatTime(duration)}`;
  const playBtn = document.getElementById('pov-play');
  if (playBtn) playBtn.textContent = playing ? '⏸' : '▶';
  const fill = document.getElementById('pov-progress-fill');
  if (fill) {
    const pct = Math.max(0, Math.min(100, (playhead / duration) * 100));
    fill.style.width = `${pct}%`;
  }
}

/**
 * Calcula y aplica las barras negras del frame POV según aspect ratio.
 * Sin POV activo o aspect=full → quita la clase `active`.
 */
export function updatePovFrame(
  camera: { povActive?: boolean } | null | undefined,
  povAspect: string | null | undefined,
): void {
  const frame = document.getElementById('pov-frame');
  if (!frame) return;
  const aspectKey = povAspect || 'full';
  const aspect = POV_ASPECTS[aspectKey] || 0;
  if (!camera || !camera.povActive || aspect === 0) {
    frame.classList.remove('active');
    return;
  }
  frame.classList.add('active');
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const targetH = vw / aspect;
  const barH = Math.max(0, (vh - targetH) / 2);
  frame.style.setProperty('--pov-bar-h', `${barH}px`);
}

const TIMELINE_LABEL_W = 110;

/**
 * Convierte un evento de mouse (clientX) a tiempo del playhead y lo aplica
 * vía callback. El caller debe pasar `rulerWidth` y `pixelToTime` ya
 * resueltos para evitar dependencia con `editor/timeline.ts`.
 */
export function scrubFromEvent(
  timelineEl: HTMLElement,
  clientX: number,
  rulerWidth: number,
  pixelToTime: (px: number, w: number) => number,
  setPlayhead: (t: number) => void,
): void {
  const rect = timelineEl.getBoundingClientRect();
  const x = clientX - rect.left - TIMELINE_LABEL_W;
  const t = pixelToTime(x, rulerWidth);
  setPlayhead(t);
}
