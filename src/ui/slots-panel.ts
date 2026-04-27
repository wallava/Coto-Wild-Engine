// Panel "💾 Slots" — listado de mundos guardados con cargar/borrar +
// guardar nuevo con nombre. Listeners delegados al div padre.
//
// loadSlot vive en legacy (depende de applyWorldFromData no extraído todavía).
// saveSlot vive en src/engine/persistence.ts pero su wrapper toma `name` y
// llama serializeWorld en legacy. Inject pattern para ambos.

import { getSlots, deleteSlot } from '../engine/persistence';
import { eventBus } from '../engine/event-bus';
import { showConfirm } from './modals';
import { escapeHtml } from '../utils/escape-html';
import { formatRelTime } from '../utils/format';

let _onLoadSlot: (id: string) => boolean = () => false;
let _onSaveSlot: (name: string) => void = () => {};

export function setOnLoadSlot(cb: (id: string) => boolean): void {
  _onLoadSlot = cb;
}

export function setOnSaveSlot(cb: (name: string) => void): void {
  _onSaveSlot = cb;
}

export function renderSlotsList(): void {
  const list = document.getElementById('slots-list')!;
  const slots = getSlots().sort((a, b) => b.savedAt - a.savedAt);
  if (slots.length === 0) {
    list.innerHTML = '<div class="slots-empty">No hay mundos guardados.</div>';
    return;
  }
  list.innerHTML = '';
  for (const s of slots) {
    const propsCount = Array.isArray((s.world as { props?: unknown[] }).props)
      ? (s.world as { props: unknown[] }).props.length
      : 0;
    const card = document.createElement('div');
    card.className = 'slot-card';
    card.innerHTML = `
      <div class="slot-card-row">
        <span class="slot-name">${escapeHtml(s.name)}</span>
      </div>
      <div class="slot-card-row">
        <span class="slot-date">${escapeHtml(formatRelTime(s.savedAt))} · ${propsCount} muebles</span>
        <span style="flex:1"></span>
        <button class="slot-load" data-id="${s.id}">Cargar</button>
        <button class="slot-delete" data-id="${s.id}" title="Borrar slot">🗑️</button>
      </div>
    `;
    list.appendChild(card);
  }
}

export function initSlotsPanel(): void {
  // Event delegation: un solo handler en el padre captura clicks en cualquier
  // botón dinámico de slot. Más robusto que addEventListener per-button.
  document.getElementById('slots-list')!.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const loadBtn = target.closest('.slot-load') as HTMLButtonElement | null;
    if (loadBtn) {
      const id = loadBtn.dataset['id']!;
      const slot = getSlots().find((s) => s.id === id);
      if (!slot) return;
      showConfirm(
        `Cargar "${slot.name}"? Tu mundo actual se reemplaza (se autoguarda como current).`,
        () => {
          if (_onLoadSlot(id)) console.log('[slots] loaded:', slot.name);
        },
      );
      return;
    }
    const delBtn = target.closest('.slot-delete') as HTMLButtonElement | null;
    if (delBtn) {
      const id = delBtn.dataset['id']!;
      const slot = getSlots().find((s) => s.id === id);
      if (!slot) return;
      showConfirm(`Borrar slot "${slot.name}"?`, () => {
        deleteSlot(id);
        renderSlotsList();
      });
      return;
    }
  });

  document.getElementById('btn-slots')!.addEventListener('click', () => {
    const panel = document.getElementById('slots-panel')!;
    const willOpen = !panel.classList.contains('open');
    panel.classList.toggle('open', willOpen);
    if (willOpen) renderSlotsList();
  });

  document.getElementById('slot-save-btn')!.addEventListener('click', () => {
    const input = document.getElementById('slot-name-input') as HTMLInputElement;
    const name = input.value.trim();
    if (!name) return;
    const existing = getSlots().find((s) => s.name === name);
    const doSave = () => {
      _onSaveSlot(name);
      input.value = '';
      renderSlotsList();
    };
    if (existing) {
      showConfirm(`Ya existe "${name}". ¿Sobreescribir?`, doSave);
    } else {
      doSave();
    }
  });

  document.getElementById('slot-name-input')!.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (document.getElementById('slot-save-btn') as HTMLButtonElement).click();
    }
  });

  // Refrescar lista cuando se guarda/borra un slot por código
  eventBus.on('slotSaved', () => {
    if (document.getElementById('slots-panel')!.classList.contains('open')) renderSlotsList();
  });
  eventBus.on('slotDeleted', () => {
    if (document.getElementById('slots-panel')!.classList.contains('open')) renderSlotsList();
  });
}
