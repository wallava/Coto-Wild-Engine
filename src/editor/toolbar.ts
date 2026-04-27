/**
 * Helpers de toolbar del editor de cutscenes.
 * Sync de UI (botones, selects, time display) sin lógica de modelo.
 *
 * `updateToolbarFields` queda en legacy hasta extraer lifecycle (Wave I) —
 * tiene acoplamiento DOM cruzado con `selectedKf` + `activeElement` +
 * presets que no vale la pena parametrizar todavía.
 */

import { formatTime } from './timeline';

/** Agentes spawneados por la cutscene activa llevan flag `_csAgent`. */
export function isCutsceneAgent(agent: { _csAgent?: boolean } | null | undefined): boolean {
  return !!(agent && agent._csAgent);
}

/** Sincroniza estilo del botón snap-to-scene-edges según estado. */
export function syncSnapBtn(snapEnabled: boolean): void {
  const btn = document.getElementById('ce-snap-toggle');
  if (!btn) return;
  if (snapEnabled) {
    btn.style.background = 'rgba(120, 170, 255, 0.55)';
    btn.style.color = '#fff';
    btn.style.borderColor = 'rgba(120, 170, 255, 0.85)';
  } else {
    btn.style.background = 'rgba(120, 170, 255, 0.06)';
    btn.style.color = 'rgba(180, 210, 255, 0.55)';
    btn.style.borderColor = 'rgba(120, 170, 255, 0.20)';
  }
}

/** Sync slider + preset + label del lens de la cámara cinematográfica. */
export function syncLensUI(gizmoLens: number): void {
  const lens = Math.round(gizmoLens || 50);
  const preset = document.getElementById('ce-cam-lens-preset') as HTMLSelectElement | null;
  const slider = document.getElementById('ce-cam-lens-slider') as HTMLInputElement | null;
  const valueLabel = document.getElementById('ce-cam-lens-value');
  if (!preset || !slider || !valueLabel) return;
  slider.value = String(lens);
  valueLabel.textContent = lens + 'mm';
  const presetVals = ['24', '35', '50', '85', '135'];
  preset.value = presetVals.includes(String(lens)) ? String(lens) : 'custom';
}

/** Botón play/pause: emoji + clase CSS según estado. */
export function updatePlayButton(playBtn: HTMLElement, playing: boolean): void {
  if (playing) {
    playBtn.textContent = '⏸';
    playBtn.classList.add('playing');
  } else {
    playBtn.textContent = '▶';
    playBtn.classList.remove('playing');
  }
}

/** Botón delete: oculto/disabled cuando no hay selección. */
export function updateDeleteBtn(deleteBtn: HTMLButtonElement, hasSelection: boolean): void {
  if (hasSelection) {
    deleteBtn.style.display = '';
    deleteBtn.disabled = false;
  } else {
    deleteBtn.style.display = 'none';
    deleteBtn.disabled = true;
  }
}

/** Refresca display de tiempo current/total formateado. */
export function updateTimeDisplay(
  currentEl: HTMLElement,
  totalEl: HTMLElement,
  playhead: number,
  duration: number,
): void {
  currentEl.textContent = formatTime(playhead);
  totalEl.textContent = formatTime(duration);
}

type AgentLike = { id: string; emoji?: string };

/** Re-popula select de agente. Marca `selectedAgentId` como seleccionado si existe. */
export function refreshAgentSelect(
  selectEl: HTMLSelectElement,
  agents: AgentLike[],
  selectedAgentId: string | null | undefined,
): void {
  selectEl.innerHTML = '';
  if (agents.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '— sin agentes —';
    selectEl.appendChild(opt);
    return;
  }
  for (const agent of agents) {
    const opt = document.createElement('option');
    opt.value = agent.id;
    opt.textContent = `${agent.emoji || ''} ${String(agent.id).slice(-3)}`;
    if (agent.id === selectedAgentId) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

/** Re-popula select de parent (camera) con opción "sin parent" + lista de agentes. */
export function refreshParentSelect(
  selectEl: HTMLSelectElement,
  agents: AgentLike[],
  currentParentAgentId: string | null | undefined,
): void {
  selectEl.innerHTML = '';
  const optNone = document.createElement('option');
  optNone.value = '';
  optNone.textContent = '— sin parent —';
  selectEl.appendChild(optNone);
  for (const agent of agents) {
    const opt = document.createElement('option');
    opt.value = agent.id;
    opt.textContent = `${agent.emoji || ''} ${String(agent.id).slice(-3)}`;
    selectEl.appendChild(opt);
  }
  selectEl.value = currentParentAgentId || '';
}

export type ToolbarVisibilityRefs = {
  ceTextInput: HTMLElement;
  ceAnimSelect: HTMLElement;
  ceDurationInput: HTMLElement;
  ceDurationLabel: HTMLElement;
  ceParentSelect: HTMLElement;
  ceParentLabel: HTMLElement;
  ceCutLabel: HTMLElement;
  ceTransSelect: HTMLElement;
  ceTransDurInput: HTMLElement;
  ceFxSelect: HTMLElement;
  cePinLabel: HTMLElement;
};

export type ToolbarActiveType = 'speak' | 'animation' | 'camera' | 'walls' | 'fx' | 'move' | string;

/**
 * Aplica visibilidad CSS a los inputs del toolbar según `activeType`.
 * `showTrans` y `transNone` se calculan en el caller (dependen de selectedKf).
 *
 * Side effects: estilos de display de los refs + body class `cs-walls-mode`
 * + `setCameraGizmoVisible(...)` callback + visibilidad de botones globales
 * por id (`ce-new-fx`, `ce-walls-roof`, `ce-walls-restore`, `ce-cam-reset`,
 * `ce-cam-lens-group`).
 */
export function applyToolbarVisibility(
  refs: ToolbarVisibilityRefs,
  activeType: ToolbarActiveType,
  showTrans: boolean,
  transIsNone: boolean,
  editorOpen: boolean,
  setCameraGizmoVisible: (visible: boolean) => void,
): void {
  refs.ceTextInput.style.display     = (activeType === 'speak') ? '' : 'none';
  refs.ceAnimSelect.style.display    = (activeType === 'animation') ? '' : 'none';
  refs.ceDurationInput.style.display = (activeType === 'animation' || activeType === 'fx') ? '' : 'none';
  refs.ceDurationLabel.style.display = (activeType === 'animation' || activeType === 'fx') ? '' : 'none';
  refs.ceParentSelect.style.display  = (activeType === 'camera') ? '' : 'none';
  refs.ceParentLabel.style.display   = (activeType === 'camera') ? '' : 'none';
  refs.ceCutLabel.style.display      = (activeType === 'camera') ? '' : 'none';
  refs.ceTransSelect.style.display   = showTrans ? '' : 'none';
  refs.ceTransDurInput.style.display = (showTrans && !transIsNone) ? '' : 'none';
  refs.ceFxSelect.style.display      = (activeType === 'fx') ? '' : 'none';
  refs.cePinLabel.style.display      = (activeType === 'fx') ? '' : 'none';

  const ceNewFxBtn = document.getElementById('ce-new-fx');
  if (ceNewFxBtn) ceNewFxBtn.style.display = (activeType === 'fx') ? '' : 'none';
  const ceWallsRoofBtn = document.getElementById('ce-walls-roof');
  const ceWallsRestoreBtn = document.getElementById('ce-walls-restore');
  if (ceWallsRoofBtn) ceWallsRoofBtn.style.display = (activeType === 'walls') ? '' : 'none';
  if (ceWallsRestoreBtn) ceWallsRestoreBtn.style.display = (activeType === 'walls') ? '' : 'none';

  if (activeType === 'walls') {
    document.body.classList.add('cs-walls-mode');
  } else {
    document.body.classList.remove('cs-walls-mode');
  }

  setCameraGizmoVisible(activeType === 'camera' && editorOpen);

  const ceCamResetBtn = document.getElementById('ce-cam-reset');
  if (ceCamResetBtn) ceCamResetBtn.style.display = (activeType === 'camera') ? '' : 'none';
  const ceCamLensGroup = document.getElementById('ce-cam-lens-group');
  if (ceCamLensGroup) ceCamLensGroup.style.display = (activeType === 'camera') ? 'inline-flex' : 'none';
}
