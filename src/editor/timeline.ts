/**
 * Helpers de timeline del editor de cutscenes.
 * Conversión tiempo↔pixel, formato, render de regla y indicadores.
 * El render de tracks queda en legacy hasta extraer multi-sel y scene-drag.
 */

const TIMELINE_LABEL_W = 110;

export type TimelineViewport = {
  /** Duración total de la cutscene en segundos. */
  duration: number;
  /** Zoom (1 = ajuste a viewport). */
  zoom: number;
  /** Scroll horizontal en pixeles del viewport virtual. */
  scrollX: number;
};

/** Formatea segundos como `MM:SS.t`. */
export function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const tenth = Math.floor((t * 10) % 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenth}`;
}

/** Ancho real del área de tracks (excluyendo label de 110px). */
export function trackAreaWidth(tracksRoot: HTMLElement, timelineRoot: HTMLElement): number {
  const tl = tracksRoot.querySelector('.ce-track-area') as HTMLElement | null;
  if (tl) return tl.getBoundingClientRect().width;
  return Math.max(100, timelineRoot.clientWidth - TIMELINE_LABEL_W);
}

/** Ancho del ruler (= timeline.clientWidth - label fijo). */
export function rulerWidth(timelineRoot: HTMLElement): number {
  return Math.max(100, timelineRoot.clientWidth - TIMELINE_LABEL_W);
}

/**
 * Convierte segundos a pixeles relativos al viewport visible.
 * El ancho virtual total = w * zoom; restamos scrollX al final.
 */
export function timeToPixel(t: number, w: number, viewport: TimelineViewport): number {
  const totalW = w * (viewport.zoom || 1);
  const px = (t / viewport.duration) * totalW;
  return px - (viewport.scrollX || 0);
}

/** Inversa de timeToPixel — clampeada a [0, duration]. */
export function pixelToTime(px: number, w: number, viewport: TimelineViewport): number {
  const totalW = w * (viewport.zoom || 1);
  const realPx = px + (viewport.scrollX || 0);
  return Math.max(0, Math.min(viewport.duration, (realPx / totalW) * viewport.duration));
}

/** Devuelve scrollX clampeado al rango válido [0, totalW - w]. */
export function clampScroll(w: number, viewport: TimelineViewport): number {
  const totalW = w * (viewport.zoom || 1);
  const maxScroll = Math.max(0, totalW - w);
  return Math.max(0, Math.min(maxScroll, viewport.scrollX || 0));
}

/** Actualiza texto del indicador de zoom (no-op si elemento no existe). */
export function updateZoomIndicator(zoom: number): void {
  const ind = document.getElementById('ce-zoom-indicator');
  if (!ind) return;
  const pct = Math.round((zoom || 1) * 100);
  ind.textContent = '🔍 ' + pct + '%';
}

/**
 * Posiciona el playhead en pixeles absolutos (relativos a left=0 del timeline).
 * Reduce opacity si está fuera del viewport scrolleado.
 */
export function updatePlayheadPosition(
  playheadEl: HTMLElement,
  playhead: number,
  timelineRoot: HTMLElement,
  viewport: TimelineViewport,
): void {
  const w = rulerWidth(timelineRoot);
  const pxRel = timeToPixel(playhead, w, viewport);
  playheadEl.style.left = `${TIMELINE_LABEL_W + pxRel}px`;
  if (pxRel < -10 || pxRel > w + 10) {
    playheadEl.style.opacity = '0.25';
  } else {
    playheadEl.style.opacity = '';
  }
}

/**
 * Renderiza el ruler con marcas adaptadas al zoom.
 * Limpia y re-popula el contenedor recibido.
 */
export function renderRuler(
  rulerRoot: HTMLElement,
  timelineRoot: HTMLElement,
  viewport: TimelineViewport,
): void {
  updateZoomIndicator(viewport.zoom);
  const w = rulerWidth(timelineRoot);
  rulerRoot.innerHTML = '';
  rulerRoot.style.paddingLeft = `${TIMELINE_LABEL_W}px`;

  const z = viewport.zoom || 1;
  let minorStep = 1;
  let majorStep = 5;
  if (z >= 4) { minorStep = 0.25; majorStep = 1; }
  else if (z >= 2) { minorStep = 0.5; majorStep = 2; }
  else if (z < 0.5) { minorStep = 2; majorStep = 10; }

  const dur = viewport.duration;
  for (let s = 0; s <= dur + 0.001; s += minorStep) {
    const sRounded = Math.round(s * 1000) / 1000;
    const isMajor = (Math.abs(sRounded % majorStep) < 0.01)
      || (Math.abs((sRounded % majorStep) - majorStep) < 0.01);
    const px = TIMELINE_LABEL_W + timeToPixel(sRounded, w, viewport);
    if (px < TIMELINE_LABEL_W - 20 || px > TIMELINE_LABEL_W + w + 20) continue;
    const mark = document.createElement('div');
    mark.className = isMajor ? 'ce-ruler-mark' : 'ce-ruler-mark minor';
    mark.style.left = `${px}px`;
    rulerRoot.appendChild(mark);
    if (isMajor) {
      const lbl = document.createElement('div');
      lbl.className = 'ce-ruler-label';
      lbl.style.left = `${px}px`;
      lbl.textContent = formatTime(sRounded);
      rulerRoot.appendChild(lbl);
    }
  }
}
