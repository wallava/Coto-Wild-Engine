// Panel "🏠 Habitaciones" — listado de habitaciones cerradas (autodetectadas)
// y zonas abiertas (manuales) con edición inline de nombre/color/kind +
// crear/borrar zonas + activar modo "editar celdas".
//
// `markWorldChanged`, `startZoneEdit`/`stopZoneEdit`, `minCellsForZones`
// vienen vía init opts porque viven en legacy hasta extraer persistence
// + zone-edit modal full.

import {
  getRooms,
  getZones,
  createZone,
  deleteZone,
  type RoomMeta,
  type Zone,
} from '../engine/rooms';
import { worldGrid } from '../engine/world';
import { ROOM_KINDS } from '../game/zone-catalog';
import {
  buildRoomsOverlay,
  setRoomsOverlayActive,
} from '../engine/rooms-overlay';
import { eventBus } from '../engine/event-bus';
import { escapeHtml } from '../utils/escape-html';
import { showConfirm } from './modals';

type InitOpts = {
  onMarkWorldChanged: () => void;
  getZoneEditingId: () => string | null;
  onStartZoneEdit: (zoneId: string) => void;
  onStopZoneEdit: () => void;
  getMinCellsForZones: () => number;
  onSetMinCellsForZones: (n: number | string) => void;
};

let _opts: InitOpts | null = null;

export function renderRoomsList(): void {
  if (!_opts) return;
  const list = document.getElementById('rooms-list')!;
  const rooms = getRooms();
  const zones = getZones();
  const editingId = _opts.getZoneEditingId();
  let html = '';

  // ── Habitaciones cerradas (autodetectadas) ──
  html += '<div class="rooms-section-title">🔒 Habitaciones cerradas</div>';
  if (rooms.length === 0) {
    html += '<div class="slots-empty">Construí paredes para cerrar un espacio.</div>';
  } else {
    for (const room of rooms) {
      const colorHex = '#' + room.color.toString(16).padStart(6, '0');
      const kindOptions = ['<option value="">— sin categoría —</option>']
        .concat(
          ROOM_KINDS.map(
            (k) =>
              `<option value="${k.id}"${k.id === room.kind ? ' selected' : ''}>${escapeHtml(k.label)}</option>`,
          ),
        )
        .join('');
      const doorTag = room.hasDoor
        ? '<span class="room-door-tag has-door">🚪 con puerta</span>'
        : '<span class="room-door-tag no-door">🚷 sin puerta</span>';
      html += `
        <div class="room-card">
          <div class="room-card-row">
            <input type="color" class="room-color-input" data-id="r:${room.id}" value="${colorHex}" title="Color">
            <input type="text" class="room-name-input" data-id="r:${room.id}" placeholder="Sin nombre..." value="${escapeHtml(room.name || '')}" maxlength="30">
          </div>
          <div class="room-card-row">
            <select class="room-kind-select" data-id="r:${room.id}">${kindOptions}</select>
            ${doorTag}
            <span class="room-cells-tag">${room.cells.length}c</span>
          </div>
        </div>
      `;
    }
  }

  // ── Zonas abiertas (manuales) ──
  html += '<div class="rooms-section-title">🔓 Zonas abiertas</div>';
  if (zones.length === 0) {
    html += '<div class="slots-empty">No hay zonas todavía.</div>';
  } else {
    for (const zone of zones) {
      const colorHex = '#' + zone.color.toString(16).padStart(6, '0');
      const kindOptions = ['<option value="">— sin categoría —</option>']
        .concat(
          ROOM_KINDS.map(
            (k) =>
              `<option value="${k.id}"${k.id === zone.kind ? ' selected' : ''}>${escapeHtml(k.label)}</option>`,
          ),
        )
        .join('');
      const editing = editingId === zone.id;
      html += `
        <div class="room-card">
          <div class="room-card-row">
            <input type="color" class="room-color-input" data-id="z:${zone.id}" value="${colorHex}" title="Color">
            <input type="text" class="room-name-input" data-id="z:${zone.id}" placeholder="Sin nombre..." value="${escapeHtml(zone.name || '')}" maxlength="30">
            <button class="room-delete" data-id="z:${zone.id}" title="Borrar zona">🗑️</button>
          </div>
          <div class="room-card-row">
            <select class="room-kind-select" data-id="z:${zone.id}">${kindOptions}</select>
            <button class="room-edit-cells${editing ? ' editing' : ''}" data-id="z:${zone.id}">
              ${editing ? '⏹️ Editando' : '✏️ Celdas'}
            </button>
            <span class="room-cells-tag">${zone.cells.length}c</span>
          </div>
        </div>
      `;
    }
  }

  html += `
    <div class="rooms-actions">
      <button id="btn-zone-new">+ Nueva zona</button>
    </div>
  `;
  list.innerHTML = html;
}

// data-id usa prefijo "r:" para roomMeta y "z:" para zones para distinguir.
function findRoomOrZone(prefixedId: string | undefined): RoomMeta | Zone | null {
  if (!prefixedId) return null;
  const colon = prefixedId.indexOf(':');
  if (colon === -1) return null;
  const kind = prefixedId.slice(0, colon);
  const id = prefixedId.slice(colon + 1);
  if (kind === 'r') {
    const meta = (worldGrid.roomMeta as RoomMeta[] | undefined)?.find((m) => m.id === id);
    return meta ?? null;
  }
  if (kind === 'z') {
    const zone = (worldGrid.zones as Zone[] | undefined)?.find((z) => z.id === id);
    return zone ?? null;
  }
  return null;
}

export function initRoomsPanel(opts: InitOpts): void {
  _opts = opts;
  const roomsList = document.getElementById('rooms-list')!;

  roomsList.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    const entity = findRoomOrZone(target.dataset['id']);
    if (!entity) return;
    if (target.classList.contains('room-name-input')) {
      entity.name = target.value;
      opts.onMarkWorldChanged();
      // Si estamos editando esta zona, actualizar el banner
      if (opts.getZoneEditingId() === entity.id) {
        document.getElementById('zone-edit-name')!.textContent = entity.name || 'Sin nombre';
      }
    } else if (target.classList.contains('room-color-input')) {
      const hex = target.value.replace('#', '');
      entity.color = parseInt(hex, 16);
      opts.onMarkWorldChanged();
      buildRoomsOverlay();
    }
  });

  roomsList.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;
    const entity = findRoomOrZone(target.dataset['id']);
    if (!entity) return;
    if (target.classList.contains('room-kind-select')) {
      entity.kind = target.value || null;
      opts.onMarkWorldChanged();
    }
  });

  roomsList.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const newBtn = target.closest('#btn-zone-new');
    if (newBtn) {
      const zone = createZone();
      renderRoomsList();
      buildRoomsOverlay();
      // Foco al input de nombre de la nueva zona
      setTimeout(() => {
        const input = roomsList.querySelector(
          `.room-name-input[data-id="z:${zone.id}"]`,
        ) as HTMLInputElement | null;
        if (input) input.focus();
      }, 0);
      return;
    }
    const editBtn = target.closest('.room-edit-cells') as HTMLButtonElement | null;
    if (editBtn) {
      const fullId = editBtn.dataset['id']!;
      const id = fullId.split(':')[1]!;
      // Toggle: si ya estamos editando esta zona, terminar
      if (opts.getZoneEditingId() === id) opts.onStopZoneEdit();
      else opts.onStartZoneEdit(id);
      renderRoomsList();
      return;
    }
    const delBtn = target.closest('.room-delete') as HTMLButtonElement | null;
    if (delBtn) {
      const fullId = delBtn.dataset['id']!;
      const colon = fullId.indexOf(':');
      const kind = fullId.slice(0, colon);
      const id = fullId.slice(colon + 1);
      if (kind !== 'z') return;
      const zone = (worldGrid.zones as Zone[] | undefined)?.find((z) => z.id === id);
      if (!zone) return;
      const label = zone.name ? `"${zone.name}"` : 'esta zona';
      showConfirm(`Borrar ${label}?`, () => {
        if (opts.getZoneEditingId() === id) opts.onStopZoneEdit();
        deleteZone(id);
        renderRoomsList();
        buildRoomsOverlay();
      });
      return;
    }
  });

  // Banner de editar zona — botón Terminar
  document.getElementById('zone-edit-done')!.addEventListener('click', () => {
    opts.onStopZoneEdit();
    renderRoomsList();
  });

  document.getElementById('btn-rooms')!.addEventListener('click', () => {
    const panel = document.getElementById('rooms-panel')!;
    const willOpen = !panel.classList.contains('open');
    panel.classList.toggle('open', willOpen);
    setRoomsOverlayActive(willOpen);
    buildRoomsOverlay();
    if (willOpen) {
      (document.getElementById('min-cells-input') as HTMLInputElement).value = String(
        opts.getMinCellsForZones(),
      );
      renderRoomsList();
    }
  });

  document.getElementById('min-cells-input')!.addEventListener('input', (e) => {
    opts.onSetMinCellsForZones((e.target as HTMLInputElement).value);
  });

  // Si las habitaciones cambian (por edit de paredes) y el panel está abierto:
  // re-render lista.
  eventBus.on('roomsChanged', () => {
    if (document.getElementById('rooms-panel')!.classList.contains('open')) {
      renderRoomsList();
    }
  });
}
