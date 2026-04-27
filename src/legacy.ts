// @ts-nocheck
// Slice 1.2: bulk del monolito convertido a módulo ES.
// Imports CDN reemplazados por imports de paquetes npm pinneados a misma versión:
//   - three@0.128.0 (era CDN cdnjs r128)
//   - tone@14.8.49 (era CDN cdnjs 14.8.49)
// Se exponen en window para callbacks/strings/eval que esperen globals.
// Próximas slices: tipar, partir en módulos, separar engine/game.

import * as THREE from 'three';
import * as Tone from 'tone';
import { uid } from './utils/id';
import {
  DOOR_OPENING_H,
  WIN_HALF_SILL_H,
  WIN_HALF_GLASS_H,
  DOOR_PANEL_THICK,
  // DOOR_OPEN_SPEED + DOOR_DETECT_RADIUS no se usan — door anim eliminada
} from './engine/state';
import { eventBus } from './engine/event-bus';
import {
  worldGrid,
  props,
  pushProp,
  removePropAt,
  removePropRef,
  defaultWorld,
  findPropAt,
  getFloorStackBase,
  getStacksOnFloor,
  canPlaceProp,
  loadWorldData,
} from './engine/world';
import {
  SLOT_CURRENT_KEY,
  SLOT_LIST_KEY,
  STORAGE_KEY_V2,
  STORAGE_KEY_V1,
  isValidWorldData,
  migrateV1WorldData,
  getSlots,
  setSlots,
  deleteSlot,
  saveSlot as persistSaveSlot,
  serializeWorld as engineSerializeWorld,
  setAgentsGetter as setPersistenceAgentsGetter,
  saveToStorage as engineSaveToStorage,
  loadFromStorage as engineLoadFromStorage,
  setApplyWorldFromDataCallback,
  markWorldChanged as engineMarkWorldChanged,
} from './engine/persistence';
import {
  initThoughtBubbles,
  showAgentThought,
  updateThoughtBubbles,
} from './engine/thought-bubbles';
import { updateLandingAnims } from './engine/landing-anim';
import {
  buildCameraGizmo as engineBuildCameraGizmo,
  renderCameraGizmoPose,
  setCameraGizmoVisible,
} from './engine/camera-gizmo';
import {
  loadAllSavedCutscenes,
  writeAllSavedCutscenes,
} from './cutscene/persistence';
import {
  hasWallN,
  hasWallW,
  getDoorOnWallN,
  getDoorOnWallW,
  blocksSpillN,
  blocksSpillW,
  blocksPathN,
  blocksPathW,
  blocksWallN,
  blocksWallW,
  isCorner,
  isAllWindowCorner,
  getCandidateWallSlots,
  getAdjacentCell,
  getWallPropBounds,
  getNearestEdgeFromPoint,
  findNearestPlaceableWallFace,
  findNearestWallSegment,
  pathFirstExists,
  pathBlocksOnFurniture,
} from './engine/wall-queries';
import { mkBox, makeGlassMesh, setStrokesGetter } from './engine/three-primitives';
import { DOOR_TEMPLATES, doorTpl, makeDoorPanelMesh } from './engine/door-panels';
import {
  initSceneGraph,
  addToScene,
  registerDoorPivot,
  clearScene as engineClearScene,
  setPropMeshOpacity,
} from './engine/scene-graph';
import {
  showSelectionHighlight,
  clearSelectionHighlight,
} from './engine/selection-highlight';
import {
  clearWallPreviews,
  clearWallHover,
  showWallPreview as engineShowWallPreview,
  showWallHover,
} from './engine/wall-preview-render';
import {
  getRaycaster,
  setRaycasterFromEvent,
  getCellFromEvent,
  getFloorCellFromEvent,
  getWorldPointFromEvent,
  getPropFromEvent,
  getFloorOrWallFaceFromEvent,
  setCanvasGetter,
  setCameraGetter,
} from './engine/raycaster';
import {
  buildSolidWallN,
  buildSolidWallW,
  buildWindowHalfRunN,
  buildWindowHalfRunW,
  buildSolidWallNWithDoor,
  buildSolidWallWWithDoor,
  addDoorPanelN,
  addDoorPanelW,
} from './engine/walls-render';
import {
  pickRoomColor,
  computeFloodFillFloor,
  computeFloodFillRoomFaces,
  computeAllRooms,
  reconcileRoomMeta,
  getRooms,
  computeRoomHasDoor,
  propsInCells,
  getZones,
  createZone,
  deleteZone,
  setZoneCell,
  setOnZonesChanged,
} from './engine/rooms';
import { VOICE_PRESETS, hashStringToInt, pickVoiceIdx } from './engine/voices';
import { escapeHtml } from './utils/escape-html';
import {
  initSpeechSystem,
  showSpeechBubble,
  showDialoguePanel,
  isDialoguePanelActive,
  updateSpeechBubbles,
  updateDialoguePanel,
} from './engine/speech';
import {
  PROP_TEMPLATES,
  WALL_PROP_TEMPLATES,
  DOOR_PROP_TEMPLATES,
} from './game/prop-catalog';
import { migrateLoadedProps } from './game/migrations';
import {
  AGENT_KITS,
  BRAIN_FONT_SIZE,
  ITEM_DEFAULT_SIZE,
  ITEM_SIZES,
  getItemSize,
} from './game/agent-kits';
import {
  ROOM_KINDS,
  ROOM_REQUIREMENTS,
  checkZoneRequirements,
} from './game/zone-catalog';
import {
  NEED_TYPES,
  NEED_DECAY,
  NEED_THRESHOLD_CRITICAL,
  NEED_THRESHOLD_OK,
  ZONE_RESTORES,
  WORKING_RESTORE_MULT,
  WORKING_DURATION,
  NEED_EMOJI,
  WORKING_EMOJI,
  getAgentMostCriticalNeed,
  findZoneForNeed,
  updateAgentNeeds as updateAgentNeedsImpl,
} from './game/needs';
import {
  startWorkingState,
  handleAgentLanded,
  pickRandomDestination,
  updateAgents as updateAgentsImpl,
} from './game/stations';
import {
  buildRoomsOverlay,
  clearRoomsOverlay,
  isRoomsOverlayActive,
  setRoomsOverlayActive,
  setZoneEditingIdGetter,
} from './engine/rooms-overlay';
import { showConfirm, showPrompt, showToast, initModals } from './ui/modals';
import {
  buildCatalog,
  openCatalog,
  closeCatalog,
  toggleCatalog,
  setOnPlaceTemplate,
} from './ui/catalog-panel';
import {
  initSlotsPanel,
  renderSlotsList,
  setOnLoadSlot,
  setOnSaveSlot,
} from './ui/slots-panel';
import { initRoomsPanel, renderRoomsList } from './ui/rooms-panel';
import { showZoneEditBanner, hideZoneEditBanner } from './ui/zone-edit-banner';
import { initPaintPanel, syncPaintUI, setOnColorChange as setOnPaintColorChange } from './ui/paint-panel';
import { buildFloor } from './engine/floor-render';
import { isBlockedByProp, neighbors, findPath } from './engine/pathfinding';
import {
  isAgentAt,
  setAgentsGetter as setAgentsStateGetter,
} from './engine/agents-state';
import {
  pickNearestProp,
  findWalkableAdjacentToProp,
  pickCellInZone,
  assignAgentTarget,
  setAgentMeshOpacity,
} from './engine/agent-helpers';
import { clearAgentStatus, updateAgentStatusPositions } from './engine/agent-status';
import {
  initAgentChassis,
  spawnAgent as spawnAgentImpl,
  createAgentMesh,
  setAgentFacing as setAgentFacingImpl,
  syncAgentMesh as syncAgentMeshImpl,
} from './engine/agent-chassis';
import {
  initAgentDrag,
  startAgentDrag,
  updateAgentDragGhost,
  updateAgentDragPhysics,
  endAgentDrag,
  isAgentDragging,
  getDraggedAgent,
  getDragGhost,
} from './engine/agent-drag';
import {
  initAgentSelection,
  selectAgent,
  clearAgentSelection,
  getAgentFromEvent,
  getSelectedAgent,
  getAgentHighlight,
} from './engine/agent-selection';
import {
  getMinCellsForZones,
  setMinCellsForZones,
  canPaintZoneCell,
} from './engine/zone-config';
import {
  wallHeightForN as engineWallHeightForN,
  wallHeightForW as engineWallHeightForW,
  setWallModeGetter,
  setWallHGetter,
  setCameraThetaGetter,
} from './engine/wall-mode';
import {
  setFloorTileColor,
  setWallFaceColor,
  setPaintColorGetter,
  floodFillFloor as engineFloodFillFloor,
  floodFillRoomWalls as engineFloodFillRoomWalls,
} from './engine/paint';
import {
  clearPaintPreview,
  addPaintPreviewTile as engineAddPaintPreviewTile,
  addPaintPreviewWallFace as engineAddPaintPreviewWallFace,
} from './engine/paint-preview';
import { formatRelTime } from './utils/format';
// engine/door-anim revertido — door animation in legacy hasta resolver bug

(window as any).THREE = THREE;
(window as any).Tone = Tone;

(function(){
  // Global error handler para diagnosticar fallas silenciosas en mobile/iOS Safari
  window.addEventListener('error', (e) => {
    console.error('[GLOBAL ERROR]', e.message, 'at', e.filename + ':' + e.lineno + ':' + e.colno, e.error && e.error.stack);
  });
  // ══════════════════════════════════════════════════════════════
  //  WORLD MODEL — idéntico al SVG: worldGrid de wallN/wallW + props
  // ══════════════════════════════════════════════════════════════
  const GRID_W = 6, GRID_H = 6, CELL = 70;
  const WALL_THICK = 12;            // grueso real, no hay bug de painter
  const halfT = WALL_THICK / 2;
  const PROP_PAD = 6;
  const RUG_PAD = 4;
  const WALL_PROP_DEPTH = 4;        // espesor saliente del cuadro respecto a pared
  const WALL_PROP_PAD = 14;         // padding lateral del cuadro dentro de la celda
  const WALL_H_UP = 110;
  const WALL_H_DOWN = 12;
  let WALL_H = WALL_H_UP;
  let wallMode = 'up';
  setWallModeGetter(() => wallMode);   // engine/wall-mode lee desde acá
  setWallHGetter(() => WALL_H);
  let showStrokes = true;
  setStrokesGetter(() => showStrokes);   // engine/three-primitives lee desde acá

  // ══════════════════════════════════════════════════════════════
  //  CONFIG TWEAKABLE — variables ajustables en vivo
  // ══════════════════════════════════════════════════════════════
  // Mínimo de celdas que tiene que tener un componente conexo (área cerrada
  // por paredes, o área abierta del piso) para que se permita pintar zonas
  // adentro. Habitaciones más chicas que esto no admiten zonas — no tiene
  // sentido sub-dividir un closet o un baño. Editable también en vivo desde
  // el panel 🏠 Habitaciones; se persiste en localStorage.
  // DEFAULT_MIN_CELLS_FOR_ZONES + minCellsForZones state + setMinCellsForZones
  // ahora en src/engine/zone-config.ts.

  // ── Paleta visual (warm cream, similar al SVG original) ──
  const PALETTE = {
    bg:    0x2b2018,                                                   // background warm dark
    floor: 0xc6bca2,                                                   // cream/beige claro
    wallN: { top: 0xd4c090, right: 0xb89868, left: 0x988458 },         // pared horizontal
    wallW: { top: 0xc8b482, right: 0xd4c090, left: 0xa89870 },         // pared vertical
    post:  { top: 0xd4c090, right: 0xb29670, left: 0x9a8458 },         // posts: top idéntico a wallN para que no aparezca franja oscura en el plano superior
    edge:  0x2a1810,                                                   // contorno de cajas
    glass: { top: 0xa8d0e0, right: 0xa8d0e0, left: 0xa8d0e0 },         // ventanal vidrio
  };

  // worldGrid + props ahora viven en src/world.ts (importados al top del módulo).

  // ══════════════════════════════════════════════════════════════
  //  IDs estables (A.1) + Event bus (A.2)
  // ══════════════════════════════════════════════════════════════
  // uid(): genera IDs cortos base36 de 6 chars. Suficiente para no colisionar
  // dentro de un mundo (~2.1B combinaciones). No es un UUID real — para nuestro
  // caso (props/agents/rooms/zonas en un solo save) alcanza y es legible al
  // debugear.
  // uid() ahora vive en src/utils/id.ts (importado al top del módulo).

  // eventBus: pub/sub mínimo. Sin frameworks. Cualquier sistema (gameplay,
  // cutscenes, UI, debug) se suscribe a eventos y nadie acopla con nadie.
  // Eventos del motor que se emiten hoy:
  //   propPlaced    {prop}            mueble/cuadro creado
  //   propDeleted   {prop}            mueble/cuadro eliminado
  //   propMoved     {prop, from, to}  mueble movido (drag o reposición)
  //   agentSpawned  {agent}
  //   agentMoved    {agent, from, to} agente cambió de celda (no por sub-paso)
  //   wallChanged   {type, cx, cy, exists, style}
  //   paintApplied  {kind, cx, cy, side?, color}
  //   worldLoaded   {source}          'storage' | 'default' | 'reset'
  //   worldSaved    {}
  // Listeners no se persisten — son in-memory y se setean al inicio.
  // Para debug: en consola corré `window.__cweDebugEvents = true` para loguear todo.
  // eventBus ahora vive en src/event-bus.ts (importado al top del módulo).

  // Wrappers de mutación: centralizan asignación de IDs y emisión de eventos.
  // Usar SIEMPRE estos en vez de props.push / props.splice directos, salvo en
  // bulk loaders (applyWorld) o cleanup pre-render (migrateLoadedProps) donde
  // emitir prop por prop generaría ruido.
  // pushProp/removePropAt/removePropRef ahora viven en src/world.ts.

  // defaultWorld + makeDefaultStyleGrid + makeNullColorGrid ahora viven en src/world.ts.

  function applyWorld(w, source = 'storage') {
    // Carga geometría/props/zones via engine. Agents se restauran abajo (deps a scene+spawnAgent legacy).
    loadWorldData(w, pickRoomColor);
    // Restaurar agentes con sus IDs. Si scene/spawnAgent todavía no están listos
    // (primer applyWorld del boot, antes de declarar `scene`), diferimos: guardamos
    // la data en window._pendingAgentsRestore y la consumimos al final del IIFE.
    if (Array.isArray(w.agents)) {
      const sceneReady = (window._gameSceneReady === true);
      if (!sceneReady) {
        window._pendingAgentsRestore = w.agents.map(a => ({ ...a }));
      } else {
        // Clear visual de agentes actuales
        for (const a of agents) {
          if (a.mesh) scene.remove(a.mesh);
          if (a.statusMesh) scene.remove(a.statusMesh);
        }
        agents.length = 0;
        for (const ad of w.agents) {
          spawnAgent(ad.cx, ad.cy, {
            id: ad.id, emoji: ad.emoji,
            voiceIdx: ad.voiceIdx, needs: ad.needs,
            heldItem: ad.heldItem,
          });
        }
      }
    }
    eventBus.emit('worldLoaded', { source, propsCount: props.length });
  }

  // migrateLoadedProps ahora en src/game/migrations.ts (importada al top).

  // ── Persistencia: slots múltiples ──
  // Hay un slot "current" (cwe_current) que se autoguarda con cada cambio.
  // Slots con nombre se guardan en cwe_slots como un array de
  // { id, name, savedAt, world }. El usuario los gestiona desde el panel
  // 💾 Slots: cargar uno reemplaza el current; guardar empuja el current al
  // slot con el nombre dado (sobreescribe si ya existe).
  //
  // Migración: cwe_world_v2 → cwe_current (transparente), cwe_world_v1 →
  // cwe_current con migración de side de wall props ('N'→'S', 'W'→'E').
  // SLOT_CURRENT_KEY / SLOT_LIST_KEY / STORAGE_KEY_V2 / STORAGE_KEY_V1 ahora en src/persistence.ts.

  // serializeWorld ahora vive en src/engine/persistence.ts.
  // Wrapper para no cambiar callsites existentes.
  const serializeWorld = engineSerializeWorld;

  // isValidWorldData + migrateV1WorldData ahora viven en src/persistence.ts.

  function applyWorldFromData(data, source) {
    applyWorld({
      wallN: data.wallN, wallW: data.wallW,
      wallNStyle: data.wallNStyle, wallWStyle: data.wallWStyle,
      floorColors: data.floorColors,
      wallNColors: data.wallNColors,
      wallWColors: data.wallWColors,
      props: data.props,
      // roomMeta + zones se persisten también — sin esto, los nombres y kinds
      // de habitaciones/zonas se perdían al recargar.
      roomMeta: data.roomMeta,
      zones: data.zones,
    }, source);
  }
  // engine/persistence loadFromStorage llama applyWorldFromData via callback.
  setApplyWorldFromDataCallback(applyWorldFromData);

  // saveToStorage ahora en src/engine/persistence.ts.
  const saveToStorage = engineSaveToStorage;

  // loadFromStorage ahora en src/engine/persistence.ts. Usa el callback
  // setApplyWorldFromDataCallback wireado arriba.
  const loadFromStorage = engineLoadFromStorage;

  // getSlots / setSlots ahora en src/persistence.ts.
  // saveSlot: wrapper que serializa el world acá (depende de `agents` que sigue en legacy)
  // y delega al saveSlot extraído.
  function saveSlot(name) {
    return persistSaveSlot(name, serializeWorld());
  }
  function loadSlot(id) {
    const slots = getSlots();
    const slot = slots.find(s => s.id === id);
    if (!slot || !isValidWorldData(slot.world)) return false;
    // Deep clone para no mutar el slot guardado al editar el current
    applyWorldFromData(JSON.parse(JSON.stringify(slot.world)), 'slot');
    saveToStorage();   // pasa a ser el current
    if (typeof migrateLoadedProps === 'function') migrateLoadedProps();
    if (typeof selectProp === 'function') selectProp(null);
    for (const a of agents) { a.path = []; a.target = null; }
    if (typeof buildScene === 'function') buildScene();
    return true;
  }
  // deleteSlot ahora en src/persistence.ts.

  // markWorldChanged ahora en src/engine/persistence.ts.
  const markWorldChanged = engineMarkWorldChanged;
  setOnZonesChanged(markWorldChanged);   // engine/rooms dispara markWorldChanged al mutar zonas

  function resetWorldToDefault() {
    localStorage.removeItem(SLOT_CURRENT_KEY);
    localStorage.removeItem(STORAGE_KEY_V2);
    localStorage.removeItem(STORAGE_KEY_V1);
    applyWorld(defaultWorld(), 'reset');
    if (typeof selectProp === 'function') selectProp(null);
    if (draggedProp) {
      if (dragGhost) {
        scene.remove(dragGhost);
        dragGhost.geometry.dispose();
        dragGhost.material.dispose();
        dragGhost = null;
      }
      draggedProp = null;
    }
    for (const a of agents) { a.path = []; a.target = null; }
    lastCamQuadrant = '';
    if (typeof buildScene === 'function') buildScene();
    console.log('[reset] world restored to default');
  }

  // Carga inicial: intenta restaurar de localStorage; si no hay, usa default.
  if (!loadFromStorage()) applyWorld(defaultWorld(), 'default');

  // Constantes de doors/windows ahora en src/engine/state.ts.
  // hasWallN/W, getDoorOnWallN/W, blocksSpillN/W, blocksPathN/W, blocksWallN/W,
  // isCorner ahora en src/engine/wall-queries.ts (importadas al top del módulo).

  // isAllWindowCorner ahora en src/engine/wall-queries.ts.


  // Ahora que los templates están definidos, migrar/limpiar los props cargados
  // (rellenar `stackable` en mesas pre-v0.94 y descartar stacks huérfanos).
  migrateLoadedProps();

  // getCandidateWallSlots ahora en src/engine/wall-queries.ts.

  // isAgentAt ahora en src/engine/agents-state.ts.

  function spawnRandomProp() {
    // 25% de probabilidad: intentar wall prop (cuadro). Si no hay paredes
    // disponibles, cae al spawn floor/rug normal.
    if (Math.random() < 0.25 && WALL_PROP_TEMPLATES.length > 0) {
      const candidates = getCandidateWallSlots();
      const free = candidates.filter(c => {
        for (const p of props) {
          if ((p.category || 'floor') !== 'wall') continue;
          if (p.side === c.side && p.cx === c.cx && p.cy === c.cy) return false;
        }
        return true;
      });
      if (free.length > 0) {
        const slot = free[Math.floor(Math.random() * free.length)];
        const tmpl = WALL_PROP_TEMPLATES[Math.floor(Math.random() * WALL_PROP_TEMPLATES.length)];
        pushProp({ category: 'wall', side: slot.side, cx: slot.cx, cy: slot.cy, ...tmpl });
        buildScene();
        markWorldChanged();
        return true;
      }
    }
    // Spawn floor / rug / stack
    let attempts = 0;
    while (attempts++ < 50) {
      const tmpl = PROP_TEMPLATES[Math.floor(Math.random() * PROP_TEMPLATES.length)];
      const cx = Math.floor(Math.random() * (GRID_W - tmpl.w + 1));
      const cy = Math.floor(Math.random() * (GRID_H - tmpl.d + 1));
      const cat = tmpl.category || 'floor';
      // Stack: requiere floor stackable abajo, sino sería huérfano
      if (cat === 'stack' && !getFloorStackBase(cx, cy)) continue;
      // Solapamiento contra props de la MISMA categoría
      let overlap = false;
      for (const p of props) {
        if ((p.category || 'floor') !== cat) continue;
        if (cx < p.cx + p.w && cx + tmpl.w > p.cx &&
            cy < p.cy + p.d && cy + tmpl.d > p.cy) { overlap = true; break; }
      }
      if (overlap) continue;
      // Solo floor: no pisar agentes
      if (cat === 'floor') {
        let blocked = false;
        for (let dy = 0; dy < tmpl.d && !blocked; dy++) {
          for (let dx = 0; dx < tmpl.w && !blocked; dx++) {
            if (isAgentAt(cx + dx, cy + dy)) blocked = true;
          }
        }
        if (blocked) continue;
      }
      // Multi-cell no atraviesa paredes interiores
      if (tmpl.w === 2 && hasWallW(cx + 1, cy)) continue;
      if (tmpl.d === 2 && hasWallN(cx, cy + 1)) continue;
      pushProp({ cx, cy, ...tmpl });
      for (const a of agents) { a.path = []; a.target = null; }
      buildScene();
      markWorldChanged();
      return true;
    }
    return false;
  }

  function removeLastProp() {
    if (props.length === 0) return;
    const removed = props.pop();
    eventBus.emit('propDeleted', { prop: removed });
    if (selectedProp === removed) selectProp(null);
    for (const a of agents) { a.path = []; a.target = null; }
    buildScene();
    markWorldChanged();
  }

  // ══════════════════════════════════════════════════════════════
  //  EDITOR — drag-to-move muebles, click para seleccionar, R para rotar
  // ══════════════════════════════════════════════════════════════
  // Modos exclusivos:
  //   'play'  → cámara y agentes; click no edita nada
  //   'edit'  → mover/rotar/borrar muebles
  //   'build' → construir/eliminar paredes con drag tipo Sims
  let mode = 'play';
  let selectedProp = null;
  // highlightMesh ahora vive en src/engine/selection-highlight.ts.
  let draggedProp = null;
  let dragGhost = null;
  let dragValid = false;
  let dragOriginalCx = 0, dragOriginalCy = 0;
  let dragOriginalW = 0, dragOriginalD = 0;     // para revertir si se cancela tras rotar
  let dragOriginalSide = null;                   // para wall props
  let dragLastSide = null;
  let dragLastCx = 0, dragLastCy = 0;            // celda actual del cursor (ghost)

  // findPropAt ahora en src/engine/world.ts.

  // Highlight render ahora en src/engine/selection-highlight.ts.
  // selectProp se queda acá: setea selectedProp + delega al engine.
  function selectProp(prop) {
    selectedProp = prop;
    showSelectionHighlight(prop);
  }

  // getFloorStackBase ahora en src/engine/world.ts.

  // canPlaceProp ahora en src/engine/world.ts.

  // getStacksOnFloor ahora en src/engine/world.ts.

  function moveProp(prop, newCx, newCy) {
    if (!canPlaceProp(prop, newCx, newCy)) return false;
    const fromCx = prop.cx, fromCy = prop.cy;
    // Si es floor stackable, llevarse los stacks que estaban encima
    const cat = prop.category || 'floor';
    const ridingStacks = (cat === 'floor' && prop.stackable)
      ? getStacksOnFloor(prop) : [];
    prop.cx = newCx;
    prop.cy = newCy;
    // Aplicar el mismo delta a los stacks que viajaban encima
    const stackMoves = [];
    for (const s of ridingStacks) {
      stackMoves.push({ prop: s.prop, from: { cx: s.prop.cx, cy: s.prop.cy } });
      s.prop.cx = newCx + s.dx;
      s.prop.cy = newCy + s.dy;
    }
    eventBus.emit('propMoved', {
      prop, from: { cx: fromCx, cy: fromCy }, to: { cx: newCx, cy: newCy },
    });
    for (const sm of stackMoves) {
      eventBus.emit('propMoved', {
        prop: sm.prop, from: sm.from, to: { cx: sm.prop.cx, cy: sm.prop.cy },
      });
    }
    for (const a of agents) { a.path = []; a.target = null; }
    buildScene();
    selectProp(prop);
    markWorldChanged();
    return true;
  }

  function deletePropSelected() {
    if (!selectedProp) return;
    const target = selectedProp;
    // Si es floor stackable, borrar también los stacks que tenía encima
    const cat = target.category || 'floor';
    if (cat === 'floor' && target.stackable) {
      const w = target.w || 1, d = target.d || 1;
      for (let i = props.length - 1; i >= 0; i--) {
        const p = props[i];
        if ((p.category || 'floor') !== 'stack') continue;
        if (p.cx >= target.cx && p.cx < target.cx + w &&
            p.cy >= target.cy && p.cy < target.cy + d) {
          removePropAt(i);
        }
      }
    }
    const idx = props.indexOf(target);
    if (idx === -1) return;
    removePropAt(idx);
    selectProp(null);
    for (const a of agents) { a.path = []; a.target = null; }
    buildScene();
    markWorldChanged();
  }

  // ── Wall Tool (Build mode estilo Sims) ──
  // Drag sobre el piso construye o elimina una línea continua de paredes.
  // La línea es siempre recta horizontal o vertical (la que predomine).
  // Mientras dragueás se muestra una preview; al soltar se aplica.
  // Si la primera pared del path ya existe → modo erase. Si no → modo build.
  let isWallDragging = false;
  let buildWallStyle = 'solid';   // 'solid' | 'window' — qué tipo de pared construir

  // ── Pintura ──
  // paintColor: número (0xRRGGBB) o null. null = "limpiar" (volver al default).
  let paintColor = 0xc6bca2;
  setPaintColorGetter(() => paintColor);   // engine/paint lee desde acá
  let paintDragging = false;     // mouse down + arrastra para pintar continuo
  let paintLastKey = null;       // cache del último target pintado (evita repetir buildScene)

  // paintFloorTile + paintWallFace ahora son wrappers thin sobre
  // setFloorTileColor + setWallFaceColor del engine + render + save.
  function paintFloorTile(cx, cy) {
    setFloorTileColor(cx, cy);
    buildScene();
    markWorldChanged();
  }
  function paintWallFace(face) {
    if (!face) return;
    const type = (face.side === 'N' || face.side === 'S') ? 'wallN' : 'wallW';
    setWallFaceColor(type, face.cx, face.cy, face.side);
    buildScene();
    markWorldChanged();
  }

  // setFloorTileColor + setWallFaceColor ahora en src/engine/paint.ts.

  // Raycast directo contra paredes y tiles del piso. El primer hit decide
  // qué se pinta (no proyectamos al piso porque eso falla cuando hay paredes
  // altas, muebles, o cuadros que se interponen visualmente).
  function paintAtEvent(event) {
    const target = getFloorOrWallFaceFromEvent(event);
    if (!target) return;
    if (target.kind === 'floor') {
      const key = `f:${target.cx},${target.cy}`;
      if (key === paintLastKey) return;
      paintLastKey = key;
      paintFloorTile(target.cx, target.cy);
    } else {
      const key = `w:${target.type},${target.cx},${target.cy},${target.side}`;
      if (key === paintLastKey) return;
      paintLastKey = key;
      paintWallFace({ type: target.type, cx: target.cx, cy: target.cy, side: target.side });
    }
  }

  // ── Flood fill (Shift+click) ──
  // computeFloodFillFloor + computeFloodFillRoomFaces ahora viven en src/engine/rooms.ts.

  // ══════════════════════════════════════════════════════════════
  //  HABITACIONES CERRADAS (A.4) + ZONAS ABIERTAS (A.5)
  // ══════════════════════════════════════════════════════════════
  // DOS sistemas separados, ambos visibles juntos en el mismo panel:
  //
  // 1. HABITACIONES CERRADAS (worldGrid.roomMeta + cells dinámicas).
  //    Detectadas por flood fill — todo componente conexo cerrado por paredes
  //    es una habitación. Sus celdas se RECOMPUTAN dinámicamente cada vez
  //    que cambian las paredes. Si rompés una pared entre dos, se fusionan.
  //    Solo se persiste metadata (id, name, kind, color, anchorCx/Cy);
  //    el anchor cell sirve para mantener nombre+kind cuando cambian paredes.
  //
  // 2. ZONAS ABIERTAS (worldGrid.zones, cells persistidas).
  //    El usuario las pinta sobre el piso con el modo "Editar celdas".
  //    Independientes de paredes — pueden vivir dentro de una habitación,
  //    sobre piso abierto, atravesar paredes. Las celdas se persisten.
  //    Una zona NO se solapa con otra zona (al pintar una celda, si pertenece
  //    a otra zona, se transfiere). Pero sí puede solapar con habitaciones
  //    cerradas (son capas distintas).
  // ROOM_COLOR_PALETTE + pickRoomColor + computeAllRooms + reconcileRoomMeta
  // + getRooms + computeRoomHasDoor ahora viven en src/engine/rooms.ts.


  // getZoneAt + getZones + createZone + deleteZone + setZoneCell ahora en src/engine/rooms.ts.

  // floodFillFloor + floodFillRoomWalls ahora en src/engine/paint.ts.
  // Wrappers locales agregan render + markWorldChanged.
  function floodFillFloor(startCx, startCy) {
    engineFloodFillFloor(startCx, startCy);
    buildScene();
    markWorldChanged();
  }
  function floodFillRoomWalls(startCx, startCy) {
    engineFloodFillRoomWalls(startCx, startCy);
    buildScene();
    markWorldChanged();
  }

  // getAdjacentCell ahora en src/engine/wall-queries.ts.

  // ── Sistema de preview de pintura (overlays translúcidos) ──
  // Cuando el usuario hover sobre piso o pared en modo Pintar (sin click),
  // se muestra un overlay del color paintColor sobre lo que se pintaría.
  // Si tiene shift, el preview cubre toda la habitación / pared continua.
  // paintPreviewMeshes ahora vive en src/engine/paint-preview.ts.
  let paintPreviewKey = null;
  let paintShiftHeld = false;
  let lastMouseEvent = null;

  // Render del preview ahora en src/engine/paint-preview.ts. Wrappers locales
  // pasan el color actual + wallH calculada (deps a wallMode/theta siguen
  // en legacy). Mantienen paintPreviewKey para evitar rebuilds innecesarios.
  function addPaintPreviewTile(cx, cy) {
    engineAddPaintPreviewTile(cx, cy, paintColor);
  }
  function addPaintPreviewWallFace(type, cx, cy, side) {
    const wallH = (type === 'wallN') ? wallHeightForN(cy) : wallHeightForW(cx);
    engineAddPaintPreviewWallFace(type, cx, cy, side, wallH, paintColor);
  }

  // wallHeightForN/W ahora en src/engine/wall-mode.ts. Aliases locales.
  const wallHeightForN = engineWallHeightForN;
  const wallHeightForW = engineWallHeightForW;

  function updatePaintPreview(event) {
    if (mode !== 'paint' || paintDragging || leftDown) {
      clearPaintPreview();
      return;
    }
    if (!event) { clearPaintPreview(); return; }
    const hit = getFloorOrWallFaceFromEvent(event);
    if (!hit) { clearPaintPreview(); return; }
    const shift = paintShiftHeld;
    const target = { ...hit, shift, color: paintColor };
    const newKey = JSON.stringify(target);
    if (newKey === paintPreviewKey) return;
    paintPreviewKey = newKey;
    clearPaintPreview();
    paintPreviewKey = newKey;
    if (target.kind === 'floor') {
      if (shift) {
        for (const c of computeFloodFillFloor(target.cx, target.cy)) addPaintPreviewTile(c.cx, c.cy);
      } else {
        addPaintPreviewTile(target.cx, target.cy);
      }
    } else {
      if (shift) {
        const start = getAdjacentCell(target.type, target.cx, target.cy, target.side);
        for (const f of computeFloodFillRoomFaces(start.cx, start.cy)) {
          addPaintPreviewWallFace(f.type, f.cx, f.cy, f.side);
        }
      } else {
        addPaintPreviewWallFace(target.type, target.cx, target.cy, target.side);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  ROOMS OVERLAY — overlay translúcido por habitación
  // ══════════════════════════════════════════════════════════════
  // Se muestra sólo cuando el panel "🏠 Habitaciones" está abierto. Cada
  // habitación tinta sus celdas con su color asignado, opacidad baja para no
  // tapar lo que hay debajo. Tras cualquier rebuild de escena se vuelve a
  // construir si está activo.
  // ROOMS OVERLAY: roomsOverlayMeshes/Active + clearRoomsOverlay +
  // buildRoomsOverlay + addRoomOverlayTile ahora en src/engine/rooms-overlay.ts.

  // Estado del modo "Editar celdas de zona". Cuando es no-null, el cursor en
  // el piso pinta/borra celdas en esa zona específica con drag.
  let zoneEditingId = null;
  let zoneEditDragging = false;
  let zoneEditDragMode = 'add';   // 'add' | 'remove'
  setZoneEditingIdGetter(() => zoneEditingId);   // overlay lee desde acá

  // ── Modo "Editar celdas de zona" ──
  function startZoneEdit(zoneId) {
    const zone = (worldGrid.zones || []).find(z => z.id === zoneId);
    if (!zone) return;
    zoneEditingId = zoneId;
    zoneEditDragging = false;
    // Asegurar overlay visible aunque el panel se cierre durante la edición
    setRoomsOverlayActive(true);
    buildRoomsOverlay();
    showZoneEditBanner(zone.name || 'Sin nombre');
  }
  function stopZoneEdit() {
    zoneEditingId = null;
    zoneEditDragging = false;
    hideZoneEditBanner();
    buildRoomsOverlay();
    renderer.domElement.style.cursor = '';
  }
  // showZoneEditBanner + hideZoneEditBanner ahora en src/ui/zone-edit-banner.ts.
  // getFloorCellFromEvent ahora en src/engine/raycaster.ts.
  // Aplica add/remove de celda según drag mode
  function applyZoneEditAtEvent(event) {
    if (!zoneEditingId) return;
    const cell = getFloorCellFromEvent(event);
    if (!cell) return;
    // Guard: solo permite agregar zona si la celda está en una habitación
    // (componente conexo) suficientemente grande. Quitar siempre se permite,
    // por si la regla cambió y dejaron zonas en habitaciones chicas.
    if (zoneEditDragMode === 'add' && !canPaintZoneCell(cell.cx, cell.cy)) {
      return;
    }
    setZoneCell(zoneEditingId, cell.cx, cell.cy, zoneEditDragMode === 'add');
  }

  // canPaintZoneCell ahora en src/engine/zone-config.ts.
  function floodFillAtEvent(event) {
    const target = getFloorOrWallFaceFromEvent(event);
    if (!target) return;
    if (target.kind === 'floor') {
      floodFillFloor(target.cx, target.cy);
    } else {
      // Determinar la celda adyacente a esa cara (la que está "del lado pintado")
      const start = getAdjacentCell(target.type, target.cx, target.cy, target.side);
      floodFillRoomWalls(start.cx, start.cy);
    }
  }
  let wallDragStart = null;   // {x, z} en world abs (sin centrar)
  let wallDragLast = null;
  let wallDragAxis = null;    // 'h' (horizontal/wallN) | 'v' (vertical/wallW) | null hasta primer movimiento
  let wallDragOffAxis = false; // cursor se desvió del eje fijado → mostrar rojo, no construir
  // wallPreviewMeshes + wallHoverMesh ahora en src/engine/wall-preview-render.ts.

  // getWorldPointFromEvent ahora en src/engine/raycaster.ts.

  // getNearestEdgeFromPoint ahora en src/engine/wall-queries.ts.

  // findNearestPlaceableWallFace + findNearestWallSegment ahora en src/engine/wall-queries.ts.

  // Calcula el path actual de paredes según start, end y axis fijado.
  // Si wallDragAxis === null y el delta total es muy chico, devuelve solo
  // la arista más cercana al start (single wall preview).
  // Si axis está fijado, mantiene esa dirección y setea wallDragOffAxis
  // si el cursor se desvía más por el eje contrario.
  function computeWallPath(start, end) {
    if (!start || !end) return [];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const absDx = Math.abs(dx);
    const absDz = Math.abs(dz);
    // Si todavía no hay axis fijado y el delta es chico, devolver single edge
    if (!wallDragAxis && absDx < CELL * 0.3 && absDz < CELL * 0.3) {
      const e = getNearestEdgeFromPoint(start);
      wallDragOffAxis = false;
      return e ? [e] : [];
    }

    // Determinar / usar el axis fijado
    let axis = wallDragAxis;
    if (!axis) {
      axis = (absDx >= absDz) ? 'h' : 'v';
    }

    // Detectar off-axis: si cursor se desvió MÁS por el eje contrario
    if (axis === 'h') {
      wallDragOffAxis = absDz > absDx;
    } else {
      wallDragOffAxis = absDx > absDz;
    }

    if (axis === 'h') {
      // Línea de wallN. cy fijo: el más cercano a la coordenada z del START.
      const cy = Math.max(0, Math.min(GRID_H, Math.round(start.z / CELL)));
      const cxs = Math.floor(start.x / CELL);
      const cxe = Math.floor(end.x / CELL);
      const cxMin = Math.max(0, Math.min(cxs, cxe));
      const cxMax = Math.min(GRID_W - 1, Math.max(cxs, cxe));
      const result = [];
      for (let cx = cxMin; cx <= cxMax; cx++) result.push({ type: 'wallN', cx, cy });
      return result;
    } else {
      // Línea de wallW. cx fijo: el más cercano a x del START.
      const cx = Math.max(0, Math.min(GRID_W, Math.round(start.x / CELL)));
      const czs = Math.floor(start.z / CELL);
      const cze = Math.floor(end.z / CELL);
      const cyMin = Math.max(0, Math.min(czs, cze));
      const cyMax = Math.min(GRID_H - 1, Math.max(czs, cze));
      const result = [];
      for (let cy = cyMin; cy <= cyMax; cy++) result.push({ type: 'wallW', cx, cy });
      return result;
    }
  }

  // Setea el axis fijado si todavía no lo está y el delta cruza un threshold.
  function tryLockAxis(start, end) {
    if (wallDragAxis) return;
    if (!start || !end) return;
    const dx = Math.abs(end.x - start.x);
    const dz = Math.abs(end.z - start.z);
    const THRESHOLD = CELL * 0.5;
    if (dx > THRESHOLD || dz > THRESHOLD) {
      wallDragAxis = (dx >= dz) ? 'h' : 'v';
    }
  }

  // makeWallPreviewBox + clearWallPreviews + clearWallHover + showWallHover
  // ahora en src/engine/wall-preview-render.ts. Wrapper local de showWallPreview
  // pasa buildWallStyle (que sigue en legacy).
  function showWallPreview(path, isErase, isInvalid) {
    engineShowWallPreview(path, isErase, isInvalid, buildWallStyle);
  }

  function applyWallPath(path) {
    if (!path.length) return;
    const isErase = (buildWallStyle === 'erase');
    let changed = 0;
    let removedWallProps = 0;
    let converted = 0;
    for (const w of path) {
      const exists = w.type === 'wallN' ? worldGrid.wallN[w.cy][w.cx] : worldGrid.wallW[w.cy][w.cx];
      if (isErase) {
        if (exists) {
          if (w.type === 'wallN') worldGrid.wallN[w.cy][w.cx] = false;
          else worldGrid.wallW[w.cy][w.cx] = false;
          // Eliminar wall props anclados a esta pared (cualquier cara)
          const validSides = w.type === 'wallN' ? ['N', 'S'] : ['W', 'E'];
          for (let i = props.length - 1; i >= 0; i--) {
            const p = props[i];
            if ((p.category || 'floor') !== 'wall') continue;
            if (p.cx !== w.cx || p.cy !== w.cy) continue;
            if (!validSides.includes(p.side)) continue;
            if (selectedProp === p) selectProp(null);
            removePropAt(i);
            removedWallProps++;
          }
          eventBus.emit('wallChanged', {
            type: w.type, cx: w.cx, cy: w.cy, exists: false, style: null,
          });
          changed++;
        }
      } else if (!exists) {
        // Construir nueva pared con el style actual
        let blocked = false;
        if (w.type === 'wallN') {
          for (const p of props) {
            if ((p.category || 'floor') === 'wall') continue;
            if (p.d === 2 && p.cx === w.cx && p.cy === w.cy - 1) { blocked = true; break; }
          }
          if (!blocked) {
            worldGrid.wallN[w.cy][w.cx] = true;
            worldGrid.wallNStyle[w.cy][w.cx] = buildWallStyle;
            eventBus.emit('wallChanged', {
              type: 'wallN', cx: w.cx, cy: w.cy, exists: true, style: buildWallStyle,
            });
            changed++;
          }
        } else {
          for (const p of props) {
            if ((p.category || 'floor') === 'wall') continue;
            if (p.w === 2 && p.cy === w.cy && p.cx === w.cx - 1) { blocked = true; break; }
          }
          if (!blocked) {
            worldGrid.wallW[w.cy][w.cx] = true;
            worldGrid.wallWStyle[w.cy][w.cx] = buildWallStyle;
            eventBus.emit('wallChanged', {
              type: 'wallW', cx: w.cx, cy: w.cy, exists: true, style: buildWallStyle,
            });
            changed++;
          }
        }
      } else {
        // Existe: convertir style si es distinto al actual
        const currentStyle = w.type === 'wallN'
          ? worldGrid.wallNStyle[w.cy][w.cx]
          : worldGrid.wallWStyle[w.cy][w.cx];
        if (currentStyle !== buildWallStyle) {
          if (w.type === 'wallN') worldGrid.wallNStyle[w.cy][w.cx] = buildWallStyle;
          else worldGrid.wallWStyle[w.cy][w.cx] = buildWallStyle;
          eventBus.emit('wallChanged', {
            type: w.type, cx: w.cx, cy: w.cy, exists: true, style: buildWallStyle,
          });
          changed++;
          converted++;
        }
      }
    }
    if (changed > 0) {
      for (const a of agents) { a.path = []; a.target = null; }
      lastCamQuadrant = '';
      buildScene();
      if (selectedProp) selectProp(selectedProp);
      markWorldChanged();
    }
    const action = isErase ? 'erase' : (converted > 0 ? 'convert' : 'build');
    console.log('[walls]', action, '— affected:', changed,
                removedWallProps > 0 ? `(+ ${removedWallProps} wall props caídos)` : '');
  }

  function cancelWallDrag() {
    isWallDragging = false;
    wallDragStart = null;
    wallDragLast = null;
    wallDragAxis = null;
    wallDragOffAxis = false;
    clearWallPreviews();
  }

  // Rotar mueble 90° (swap w↔d). Reglas:
  // 1. Si está siendo draggeado, la celda base es la del ghost (cursor),
  //    no la posición original. Solo cambia w/d, no toca cx/cy ni rebuilds.
  // 2. Si NO está draggeado: probar (cx,cy) actual, si no las 4 adyacentes
  //    sin atravesar pared, si no, no rotar.
  function rotateProp(prop) {
    if (!prop) return false;
    if ((prop.category || 'floor') === 'wall') return false;  // wall props no rotan
    if ((prop.category || 'floor') === 'door') {
      // Doors: R flipea side dentro del axis (N↔S o W↔E). Solo aplica durante
      // drag (modifica dragLastSide para que el próximo updateDragGhost lo vea).
      const isDragging = (draggedProp === prop);
      if (!isDragging) return false;
      let newSide;
      if (dragLastSide === 'N') newSide = 'S';
      else if (dragLastSide === 'S') newSide = 'N';
      else if (dragLastSide === 'W') newSide = 'E';
      else if (dragLastSide === 'E') newSide = 'W';
      else return false;
      dragLastSide = newSide;
      // Refrescar ghost con el nuevo side en la celda actual
      updateDragGhost(dragLastCx, dragLastCy, newSide);
      return true;
    }
    if (prop.w === prop.d) return false;
    const newW = prop.d;
    const newD = prop.w;
    const tempProp = { ...prop, w: newW, d: newD };

    const isDragging = (draggedProp === prop);
    if (isDragging) {
      // Durante drag, la rotación SIEMPRE se aplica al ghost.
      // No validamos nada acá: el color del ghost (verde/rojo) ya muestra
      // si la celda actual es válida para soltar. El usuario puede rotar
      // libremente y luego mover el cursor a una celda donde sí entra.
      prop.w = newW;
      prop.d = newD;
      if (dragGhost) {
        scene.remove(dragGhost);
        dragGhost.geometry.dispose();
        dragGhost.material.dispose();
      }
      const w = prop.w * CELL - PROP_PAD * 2;
      const d = prop.d * CELL - PROP_PAD * 2;
      const h = prop.h;
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x80ff80, transparent: true, opacity: 0.55, depthTest: false
      });
      dragGhost = new THREE.Mesh(geo, mat);
      dragGhost.renderOrder = 998;
      scene.add(dragGhost);
      updateDragGhost(dragLastCx, dragLastCy);
      return true;
    }

    // Caso no-dragging: rotar en (cx,cy) o en adyacentes sin cruzar pared
    let chosen = null;
    if (canPlaceProp(tempProp, prop.cx, prop.cy)) {
      chosen = { cx: prop.cx, cy: prop.cy };
    } else {
      const dirs = [
        { dx:  1, dy: 0, blocked: hasWallW(prop.cx + prop.w,     prop.cy) },
        { dx: -1, dy: 0, blocked: hasWallW(prop.cx,              prop.cy) },
        { dx:  0, dy: 1, blocked: hasWallN(prop.cx, prop.cy + prop.d) },
        { dx:  0, dy:-1, blocked: hasWallN(prop.cx, prop.cy)              },
      ];
      for (const d of dirs) {
        if (d.blocked) continue;
        const ncx = prop.cx + d.dx;
        const ncy = prop.cy + d.dy;
        if (canPlaceProp(tempProp, ncx, ncy)) { chosen = { cx: ncx, cy: ncy }; break; }
      }
    }
    if (!chosen) {
      console.log('[rotate] cancelado: no entra sin atravesar pared');
      return false;
    }
    prop.w = newW;
    prop.d = newD;
    prop.cx = chosen.cx;
    prop.cy = chosen.cy;
    for (const a of agents) { a.path = []; a.target = null; }
    buildScene();
    selectProp(prop);
    markWorldChanged();
    return true;
  }

  // getWallPropBounds ahora en src/engine/wall-queries.ts.

  // setPropMeshOpacity ahora en src/engine/scene-graph.ts.

  // ── Drag ghost (preview semi-transparente que sigue al cursor) ──
  function startDrag(prop) {
    draggedProp = prop;
    const cat = prop.category || 'floor';
    dragOriginalCx = prop.cx;
    dragOriginalCy = prop.cy;
    if (cat === 'wall' || cat === 'door') {
      dragOriginalSide = prop.side;
      dragLastSide = prop.side;
    } else {
      dragOriginalW = prop.w;
      dragOriginalD = prop.d;
    }
    dragLastCx = prop.cx;
    dragLastCy = prop.cy;
    clearSelectionHighlight();
    selectedProp = prop;
    setPropMeshOpacity(prop, 0.32);
    // Crear ghost con dimensiones según categoría
    let gw, gh, gd;
    if (cat === 'wall') {
      const isHorizontal = (prop.side === 'N' || prop.side === 'S');
      if (isHorizontal) { gw = CELL - WALL_PROP_PAD * 2; gd = WALL_PROP_DEPTH; }
      else              { gw = WALL_PROP_DEPTH;          gd = CELL - WALL_PROP_PAD * 2; }
      gh = prop.h;
    } else if (cat === 'door') {
      const isHorizontal = (prop.side === 'N' || prop.side === 'S');
      if (isHorizontal) { gw = CELL - 8; gd = WALL_THICK + 2; }
      else              { gw = WALL_THICK + 2; gd = CELL - 8; }
      gh = DOOR_OPENING_H;
    } else if (cat === 'rug') {
      gw = prop.w * CELL - 8;
      gd = prop.d * CELL - 8;
      gh = prop.h;
    } else {
      gw = prop.w * CELL - PROP_PAD * 2;
      gd = prop.d * CELL - PROP_PAD * 2;
      gh = prop.h;
    }
    const geo = new THREE.BoxGeometry(gw, gh, gd);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x80ff80, transparent: true, opacity: 0.55, depthTest: false
    });
    dragGhost = new THREE.Mesh(geo, mat);
    dragGhost.renderOrder = 998;
    scene.add(dragGhost);
    if (cat === 'wall' || cat === 'door') updateDragGhost(prop.cx, prop.cy, prop.side);
    else                                  updateDragGhost(prop.cx, prop.cy);
  }

  function updateDragGhost(cx, cy, side) {
    if (!dragGhost || !draggedProp) return;
    const cat = draggedProp.category || 'floor';
    dragLastCx = cx;
    dragLastCy = cy;
    if (cat === 'wall') {
      // Recrear ghost si cambió la orientación (h: N/S, v: W/E)
      const newOrient = (side === 'N' || side === 'S') ? 'h' : 'v';
      const oldOrient = (dragLastSide === 'N' || dragLastSide === 'S') ? 'h' : 'v';
      if (newOrient !== oldOrient) {
        scene.remove(dragGhost);
        dragGhost.geometry.dispose();
        dragGhost.material.dispose();
        let gw, gd;
        if (newOrient === 'h') { gw = CELL - WALL_PROP_PAD * 2; gd = WALL_PROP_DEPTH; }
        else                    { gw = WALL_PROP_DEPTH;          gd = CELL - WALL_PROP_PAD * 2; }
        const gh = draggedProp.h;
        const geo = new THREE.BoxGeometry(gw, gh, gd);
        const mat = new THREE.MeshBasicMaterial({
          color: 0x80ff80, transparent: true, opacity: 0.55, depthTest: false
        });
        dragGhost = new THREE.Mesh(geo, mat);
        dragGhost.renderOrder = 998;
        scene.add(dragGhost);
      }
      dragLastSide = side;
      dragValid = canPlaceProp({ ...draggedProp, side, cx, cy }, cx, cy);
      dragGhost.material.color.setHex(dragValid ? 0x80ff80 : 0xff6060);
      // Posicionar ghost según la cara
      let gx, gz;
      if (side === 'N') {
        gx = (cx + 0.5) * CELL;
        gz = cy * CELL + halfT + WALL_PROP_DEPTH / 2;
      } else if (side === 'S') {
        gx = (cx + 0.5) * CELL;
        gz = cy * CELL - halfT - WALL_PROP_DEPTH / 2;
      } else if (side === 'W') {
        gx = cx * CELL + halfT + WALL_PROP_DEPTH / 2;
        gz = (cy + 0.5) * CELL;
      } else {  // 'E'
        gx = cx * CELL - halfT - WALL_PROP_DEPTH / 2;
        gz = (cy + 0.5) * CELL;
      }
      const gy = draggedProp.zOffset + draggedProp.h / 2;
      dragGhost.position.set(gx - centerX, gy, gz - centerZ);
      return;
    }
    if (cat === 'door') {
      // Recrear ghost si cambió la orientación (h: N/S, v: W/E)
      const newOrient = (side === 'N' || side === 'S') ? 'h' : 'v';
      const oldOrient = (dragLastSide === 'N' || dragLastSide === 'S') ? 'h' : 'v';
      if (newOrient !== oldOrient) {
        scene.remove(dragGhost);
        dragGhost.geometry.dispose();
        dragGhost.material.dispose();
        let gw, gd;
        if (newOrient === 'h') { gw = CELL - 8; gd = WALL_THICK + 2; }
        else                    { gw = WALL_THICK + 2; gd = CELL - 8; }
        const gh = DOOR_OPENING_H;
        const geo = new THREE.BoxGeometry(gw, gh, gd);
        const mat = new THREE.MeshBasicMaterial({
          color: 0x80ff80, transparent: true, opacity: 0.55, depthTest: false
        });
        dragGhost = new THREE.Mesh(geo, mat);
        dragGhost.renderOrder = 998;
        scene.add(dragGhost);
      }
      dragLastSide = side;
      dragValid = canPlaceProp({ ...draggedProp, side, cx, cy }, cx, cy);
      dragGhost.material.color.setHex(dragValid ? 0x80ff80 : 0xff6060);
      // Ghost CENTRADO en el segmento
      let gx, gz;
      if (side === 'N' || side === 'S') {
        gx = (cx + 0.5) * CELL;
        gz = cy * CELL;
      } else {
        gx = cx * CELL;
        gz = (cy + 0.5) * CELL;
      }
      const gy = DOOR_OPENING_H / 2;
      dragGhost.position.set(gx - centerX, gy, gz - centerZ);
      return;
    }
    // floor / rug / stack
    dragValid = canPlaceProp(draggedProp, cx, cy);
    dragGhost.material.color.setHex(dragValid ? 0x80ff80 : 0xff6060);
    let baseY;
    if (cat === 'stack') {
      const base = getFloorStackBase(cx, cy);
      baseY = (base ? base.h : 28) + draggedProp.h / 2;
    } else {
      baseY = draggedProp.h / 2 + 12;
    }
    dragGhost.position.set(
      (cx + draggedProp.w / 2) * CELL - centerX,
      baseY,
      (cy + draggedProp.d / 2) * CELL - centerZ
    );
  }

  function endDrag(target) {
    if (!draggedProp) return;
    const prop = draggedProp;
    const cat = prop.category || 'floor';
    let applied = false;
    if (cat === 'wall' || cat === 'door') {
      // target = { cx, cy, side } o null
      if (target && dragValid) {
        draggedProp = null;
        prop.cx = target.cx;
        prop.cy = target.cy;
        prop.side = target.side;
        for (const a of agents) { a.path = []; a.target = null; }
        buildScene();
        selectProp(prop);
        markWorldChanged();
        applied = true;
      }
    } else {
      // target = { cx, cy } o null
      if (target && dragValid) {
        draggedProp = null;
        moveProp(prop, target.cx, target.cy);
        applied = true;
      }
    }
    if (!applied) {
      // Cancelar: revertir orientación si rotamos durante drag (solo floor/rug)
      if (cat !== 'wall' && cat !== 'door') {
        if (prop.w !== dragOriginalW || prop.d !== dragOriginalD) {
          prop.w = dragOriginalW;
          prop.d = dragOriginalD;
        }
      }
      setPropMeshOpacity(prop, 1.0);
      draggedProp = null;
      selectProp(prop);
    }
    if (dragGhost) {
      scene.remove(dragGhost);
      dragGhost.geometry.dispose();
      dragGhost.material.dispose();
      dragGhost = null;
    }
    dragValid = false;
  }

  // ══════════════════════════════════════════════════════════════
  //  PLACE MODE — colocar mueble del catálogo con ghost
  // ══════════════════════════════════════════════════════════════
  // Cuando seleccionás un template del catálogo, entrás a placeMode:
  // un ghost del mueble sigue al cursor, click izq lo coloca, R rota,
  // Esc cancela. Al colocar, salimos del placeMode automáticamente.
  let placeMode = false;
  let placeTemplate = null;     // copia del template (para rotar sin afectar el catálogo)
  let placeGhost = null;
  let placeValid = false;
  let placeCx = 0, placeCy = 0;

  function enterPlaceMode(tmpl) {
    exitPlaceMode();
    placeMode = true;
    placeTemplate = { ...tmpl };
    placeSide = 'N';   // default; updatePlaceGhost lo corrige al primer movimiento
    rebuildPlaceGhost();
    const banner = document.getElementById('place-banner');
    const nameEl = document.getElementById('place-name');
    nameEl.textContent = tmpl.name || (tmpl.category || 'mueble');
    banner.classList.add('open');
  }

  function exitPlaceMode() {
    if (placeGhost) {
      scene.remove(placeGhost);
      placeGhost.geometry.dispose();
      placeGhost.material.dispose();
      placeGhost = null;
    }
    clearDoorArrow();
    placeMode = false;
    placeTemplate = null;
    placeValid = false;
    document.getElementById('place-banner').classList.remove('open');
  }

  // ── Flecha de dirección de apertura para puertas ──
  let placeArrow = null;
  function clearDoorArrow() {
    if (!placeArrow) return;
    scene.remove(placeArrow);
    placeArrow.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    placeArrow = null;
  }
  function updateDoorArrow() {
    clearDoorArrow();
    if (!placeMode || !placeTemplate || (placeTemplate.category || 'floor') !== 'door') return;
    if (!placeGhost) return;
    // Cono apuntando en dirección de placeSide
    const cone = new THREE.ConeGeometry(7, 18, 4);
    // Default cone apunta hacia +Y. Lo orientamos según side.
    if (placeSide === 'S')      cone.rotateX(Math.PI / 2);
    else if (placeSide === 'N') cone.rotateX(-Math.PI / 2);
    else if (placeSide === 'E') cone.rotateZ(-Math.PI / 2);
    else if (placeSide === 'W') cone.rotateZ(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd060, transparent: true, opacity: 0.85, depthTest: false,
    });
    placeArrow = new THREE.Mesh(cone, mat);
    placeArrow.renderOrder = 999;
    // Posicionar al lado del ghost en la dirección de side
    const dist = 24;
    let dx = 0, dz = 0;
    if (placeSide === 'N') dz = -1;
    else if (placeSide === 'S') dz = 1;
    else if (placeSide === 'W') dx = -1;
    else if (placeSide === 'E') dx = 1;
    const gp = placeGhost.position;
    placeArrow.position.set(gp.x + dx * dist, gp.y + 8, gp.z + dz * dist);
    scene.add(placeArrow);
  }

  // Estado adicional para wall props en placeMode
  let placeSide = 'N';   // 'N' o 'W' cuando placing wall

  function rebuildPlaceGhost() {
    if (placeGhost) {
      scene.remove(placeGhost);
      placeGhost.geometry.dispose();
      placeGhost.material.dispose();
      placeGhost = null;
    }
    if (!placeTemplate) return;
    const cat = placeTemplate.category || 'floor';
    let gw, gh, gd;
    if (cat === 'wall') {
      // El cuadro está orientado según el side actual: N/S = horizontal, W/E = vertical
      const isHoriz = (placeSide === 'N' || placeSide === 'S');
      if (isHoriz) { gw = CELL - 28; gd = 4; }
      else         { gw = 4;          gd = CELL - 28; }
      gh = placeTemplate.h;
    } else if (cat === 'door') {
      // Puerta: orientada según el axis del wall (N/S = horizontal, W/E = vertical).
      // Ghost = caja del tamaño del marco completo (no solo el panel).
      const isHoriz = (placeSide === 'N' || placeSide === 'S');
      if (isHoriz) { gw = CELL - 8; gd = WALL_THICK + 2; }
      else         { gw = WALL_THICK + 2; gd = CELL - 8; }
      gh = DOOR_OPENING_H;
    } else if (cat === 'rug') {
      gw = placeTemplate.w * CELL - 8;
      gd = placeTemplate.d * CELL - 8;
      gh = placeTemplate.h;
    } else if (cat === 'stack') {
      gw = CELL - 28;
      gd = CELL - 28;
      gh = placeTemplate.h;
    } else {
      gw = placeTemplate.w * CELL - PROP_PAD * 2;
      gd = placeTemplate.d * CELL - PROP_PAD * 2;
      gh = placeTemplate.h;
    }
    const geo = new THREE.BoxGeometry(gw, gh, gd);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x80ff80, transparent: true, opacity: 0.55, depthTest: false
    });
    placeGhost = new THREE.Mesh(geo, mat);
    placeGhost.renderOrder = 998;
    scene.add(placeGhost);
  }

  function updatePlaceGhost(event) {
    if (!placeMode || !placeGhost) return;
    const cat = placeTemplate.category || 'floor';

    if (cat === 'wall') {
      // Wall: encontrar la cara de pared placeable más cercana al cursor.
      // findNearestPlaceableWallFace ya filtra caras inexistentes y caras
      // sin habitación adyacente, así que el side devuelto SIEMPRE es válido
      // geométricamente. El placeValid solo dependerá de si ya hay otro cuadro
      // en esa misma cara (canPlaceProp).
      const wp = getWorldPointFromEvent(event);
      if (!wp) return;
      const face = findNearestPlaceableWallFace(wp);
      if (!face) {
        placeValid = false;
        placeGhost.material.color.setHex(0xff6060);
        return;
      }
      const newSide = face.side;
      // Recrear ghost solo si cambia la orientación (H ↔ V)
      const wasHoriz = (placeSide === 'N' || placeSide === 'S');
      const isHoriz  = (newSide === 'N' || newSide === 'S');
      placeSide = newSide;
      if (wasHoriz !== isHoriz) rebuildPlaceGhost();

      placeCx = face.cx;
      placeCy = face.cy;
      placeValid = canPlaceProp(
        { ...placeTemplate, side: placeSide, cx: placeCx, cy: placeCy },
        placeCx, placeCy
      );
      placeGhost.material.color.setHex(placeValid ? 0x80ff80 : 0xff6060);
      // Posicionar ghost adherido a la cara correcta
      let gx, gz;
      if (placeSide === 'S') {
        gx = (placeCx + 0.5) * CELL;
        gz = placeCy * CELL + halfT + 2;
      } else if (placeSide === 'N') {
        gx = (placeCx + 0.5) * CELL;
        gz = placeCy * CELL - halfT - 2;
      } else if (placeSide === 'E') {
        gx = placeCx * CELL + halfT + 2;
        gz = (placeCy + 0.5) * CELL;
      } else {  // 'W'
        gx = placeCx * CELL - halfT - 2;
        gz = (placeCy + 0.5) * CELL;
      }
      const gy = placeTemplate.zOffset + placeTemplate.h / 2;
      placeGhost.position.set(gx - centerX, gy, gz - centerZ);
      return;
    }

    if (cat === 'door') {
      // Door: el cursor decide en qué SEGMENTO (qué wall) va. El usuario decide
      // el SIDE (dirección de apertura) con R.
      const wp = getWorldPointFromEvent(event);
      if (!wp) return;
      const seg = findNearestWallSegment(wp);
      if (!seg) {
        placeValid = false;
        placeGhost.material.color.setHex(0xff6060);
        clearDoorArrow();
        return;
      }
      const axisIsHoriz = (seg.type === 'wallN');
      const sideIsHoriz = (placeSide === 'N' || placeSide === 'S');
      if (axisIsHoriz !== sideIsHoriz) {
        // Si el axis del segmento no coincide con el side actual, flipear a un
        // default del axis nuevo
        placeSide = axisIsHoriz ? 'S' : 'E';
        rebuildPlaceGhost();
      }
      placeCx = seg.cx;
      placeCy = seg.cy;
      placeValid = canPlaceProp(
        { ...placeTemplate, side: placeSide, cx: placeCx, cy: placeCy },
        placeCx, placeCy
      );
      placeGhost.material.color.setHex(placeValid ? 0x80ff80 : 0xff6060);
      // Ghost CENTRADO en el segmento (la puerta ocupa ambas caras)
      let gx, gz;
      if (seg.type === 'wallN') {
        gx = (seg.cx + 0.5) * CELL;
        gz = seg.cy * CELL;
      } else {
        gx = seg.cx * CELL;
        gz = (seg.cy + 0.5) * CELL;
      }
      const gy = DOOR_OPENING_H / 2;
      placeGhost.position.set(gx - centerX, gy, gz - centerZ);
      updateDoorArrow();
      return;
    }

    // Floor/rug: snap a celda
    const cell = getCellFromEvent(event);
    if (!cell) return;
    placeCx = cell.cx;
    placeCy = cell.cy;
    placeValid = canPlaceProp(
      { ...placeTemplate, cx: placeCx, cy: placeCy },
      placeCx, placeCy
    );
    placeGhost.material.color.setHex(placeValid ? 0x80ff80 : 0xff6060);
    // Altura del ghost: floor/rug se posa en el piso, stack se posa sobre el floor base
    let baseY;
    if (cat === 'stack') {
      const base = getFloorStackBase(placeCx, placeCy);
      baseY = (base ? base.h : 28) + placeTemplate.h / 2;
    } else if (cat === 'rug') {
      baseY = placeTemplate.h / 2;
    } else {
      baseY = placeTemplate.h / 2 + 6;
    }
    placeGhost.position.set(
      (placeCx + placeTemplate.w / 2) * CELL - centerX,
      baseY,
      (placeCy + placeTemplate.d / 2) * CELL - centerZ
    );
  }

  function applyPlace() {
    if (!placeMode || !placeValid) return false;
    const cat = placeTemplate.category || 'floor';
    if (cat === 'wall' || cat === 'door') {
      pushProp({ ...placeTemplate, side: placeSide, cx: placeCx, cy: placeCy });
    } else {
      pushProp({ ...placeTemplate, cx: placeCx, cy: placeCy });
    }
    for (const a of agents) { a.path = []; a.target = null; }
    buildScene();
    markWorldChanged();
    exitPlaceMode();
    return true;
  }

  function rotatePlaceTemplate() {
    if (!placeMode || !placeTemplate) return;
    const cat = placeTemplate.category || 'floor';
    // Wall: R no aplica (el side viene del cursor)
    if (cat === 'wall') return;
    if (cat === 'door') {
      // Cycle within axis: N↔S o W↔E. La dirección de apertura se invierte.
      if (placeSide === 'N') placeSide = 'S';
      else if (placeSide === 'S') placeSide = 'N';
      else if (placeSide === 'W') placeSide = 'E';
      else if (placeSide === 'E') placeSide = 'W';
      updateDoorArrow();
      return;
    }
    if (placeTemplate.w === placeTemplate.d) return;
    const tw = placeTemplate.w;
    placeTemplate.w = placeTemplate.d;
    placeTemplate.d = tw;
    rebuildPlaceGhost();
  }

  // Wall props: spawn directo en una cara aleatoria libre (cualquiera de
  // las 4 caras posibles entre todas las paredes existentes).
  function spawnWallPropFromTemplate(tmpl) {
    const candidates = getCandidateWallSlots();
    const free = candidates.filter(c => {
      for (const p of props) {
        if ((p.category || 'floor') !== 'wall') continue;
        if (p.side === c.side && p.cx === c.cx && p.cy === c.cy) return false;
      }
      return true;
    });
    if (free.length === 0) {
      console.log('[catalog] no hay caras libres para colgar', tmpl.name);
      return false;
    }
    const slot = free[Math.floor(Math.random() * free.length)];
    pushProp({ category: 'wall', side: slot.side, cx: slot.cx, cy: slot.cy, ...tmpl });
    buildScene();
    markWorldChanged();
    return true;
  }

  // ══════════════════════════════════════════════════════════════
  //  CATÁLOGO — panel con cards de templates seleccionables
  // ══════════════════════════════════════════════════════════════
  // buildCatalog + openCatalog + closeCatalog + toggleCatalog ahora en src/ui/catalog-panel.ts.
  // Wireado a enterPlaceMode al final del IIFE (cuando enterPlaceMode esté declarado).
  setOnPlaceTemplate((tmpl) => enterPlaceMode(tmpl));

  // Raycaster + helpers ahora en src/engine/raycaster.ts.
  // Wire de canvas + camera (legacy mantiene refs locales).
  setCanvasGetter(() => renderer.domElement);
  setCameraGetter(() => camera);
  // Alias local para callsites que leen _raycaster directamente.
  const _raycaster = getRaycaster();

  // getPropFromEvent ahora en src/engine/raycaster.ts.

  function trySpawnAgent() {
    let attempts = 0;
    while (attempts++ < 30) {
      const cx = Math.floor(Math.random() * GRID_W);
      const cy = Math.floor(Math.random() * GRID_H);
      if (isAgentAt(cx, cy)) continue;
      if (isBlockedByProp(cx, cy)) continue;
      spawnAgent(cx, cy);
      return true;
    }
    return false;
  }

  // ══════════════════════════════════════════════════════════════
  //  AGENTS — pathfinding A* sobre el grid + walking continuo
  // ══════════════════════════════════════════════════════════════
  const agents = [];
  setPersistenceAgentsGetter(() => agents);   // engine/persistence lee desde acá
  setAgentsStateGetter(() => agents);   // engine/agents-state también
  let paused = false;


  // AGENT_KITS + BRAIN_FONT_SIZE + ITEM_DEFAULT_SIZE + ITEM_SIZES + getItemSize
  // ahora viven en src/game/agent-kits.ts.

  // createAgentTexture ahora en src/engine/agent-texture.ts.

  // VOICE_PRESETS / hashStringToInt / pickVoiceIdx ahora viven en src/voices.ts.

  // spawnAgent + createAgentMesh + setAgentFacing + syncAgentMesh ahora viven
  // en src/engine/agent-chassis.ts. Wrappers acá inyectan el array `agents`
  // (singleton legacy hasta extraer) y actualizan el contador en el sidebar.
  function spawnAgent(cx, cy, opts) {
    const agent = spawnAgentImpl(agents, cx, cy, opts);
    document.getElementById('agent-count').textContent =
      `${agents.length} agente${agents.length === 1 ? '' : 's'}`;
    return agent;
  }
  const setAgentFacing = setAgentFacingImpl;
  const syncAgentMesh = syncAgentMeshImpl;

  // ── Selección de agente ──
  // Toda la lógica vive en src/engine/agent-selection.ts.
  initAgentSelection(() => agents);

  // ── Drag de agentes (estilo Tomodachi) ──
  // Toda la lógica state + physics vive en src/engine/agent-drag.ts.
  // Wire de hooks: el módulo necesita leer agents + saber qué hacer al
  // landing (handleAgentLanded) y al iniciar drag (clear de selection).
  initAgentDrag({
    getAgents: () => agents,
    onClearSelection: () => clearAgentSelection(),
    onLanded: (agent) => handleAgentLanded(agent),
  });
  // Wire del chassis: necesita los getters de drag (ghost) + selección
  // (highlight) para sincronizar facing + posición desde sus helpers.
  initAgentChassis({
    getDraggedAgent,
    getAgentDragGhost: getDragGhost,
    getSelectedAgent,
    getAgentHighlight,
    pickRandomKit: () => AGENT_KITS[Math.floor(Math.random() * AGENT_KITS.length)],
  });

  // setAgentMeshOpacity ahora en src/engine/agent-helpers.ts.

  // handleAgentLanded + startWorkingState ahora en src/game/stations.ts.
  // pickNearestProp + findWalkableAdjacentToProp ahora en src/engine/agent-helpers.ts.

  // assignAgentTarget ahora en src/engine/agent-helpers.ts.

  // pickRandomDestination ahora en src/game/stations.ts.

  // updateAgents ahora en src/game/stations.ts. Wrapper inyecta el agente
  // arrastrado (skip) y la callback de cutscene-control desde window.
  function updateAgents(dt) {
    updateAgentsImpl(agents, dt, {
      skipAgent: getDraggedAgent(),
      isCutsceneControlled: typeof window._isCutsceneControlled === 'function'
        ? window._isCutsceneControlled
        : undefined,
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  THREE.JS SETUP
  // ══════════════════════════════════════════════════════════════
  // Convención coords: mi mundo (x=este, y=sur, z=arriba)
  //                  → three (X=este, Y=arriba, Z=sur)
  //   mi (x, y, z) → three (x, z, y).
  // Cámara en (+X, +Y, +Z) = SE-arriba, mira al NW-abajo.
  // Visible: cara +X (este = "right iso"), +Y (top), +Z (sur = "left iso").

  const container = document.getElementById('canvas-container');
  let viewW = container.clientWidth;
  let viewH = container.clientHeight;

  const scene = new THREE.Scene();
  window._gameSceneReady = true;
  scene.background = new THREE.Color(PALETTE.bg);
  initThoughtBubbles(scene);
  initSpeechSystem({ scene, getAgents: () => agents });
  // initSceneGraph se invoca después de declarar sceneObjects + doorPivotsById
  // (ver más abajo). const en TDZ no se puede acceder antes de su declaración.

  const frustumSize = 700;
  const camera = new THREE.OrthographicCamera(
    -frustumSize * (viewW/viewH) / 2, frustumSize * (viewW/viewH) / 2,
    frustumSize / 2, -frustumSize / 2,
    -3000, 3000
  );

  // Cámara cinemática perspectiva — usada solo durante POV de cutscenes.
  // FOV inicial corresponde a 50mm en sensor 36mm. Se actualiza con kf.lens.
  const cinematicCamera = new THREE.PerspectiveCamera(
    /* fov */ 39.6, viewW / viewH, /* near */ 1, /* far */ 6000
  );

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(viewW, viewH);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Centrar el mundo en el origen
  const centerX = GRID_W * CELL / 2;
  const centerZ = GRID_H * CELL / 2;

  // mkBox + makeGlassMesh ahora viven en src/engine/three-primitives.ts.

  const sceneObjects = [];
  // Map door.id → pivot Object3D, repoblado cada buildScene. Lo usa
  // updateDoorAnimations para encontrar el pivot a rotar sin barrer sceneObjects.
  const doorPivotsById = new Map();
  // Wire del scene-graph singleton del engine ahora que las refs están listas.
  initSceneGraph({ scene, sceneObjects, doorPivotsById });

  // ══════════════════════════════════════════════════════════════
  //  TECHO (roof) — toggle global con detalles arriba (terraza) y abajo (cielorraso)
  // ══════════════════════════════════════════════════════════════
  let roofVisible = false;
  const roofObjects = [];   // los meshes del techo, separados de sceneObjects
  const ROOF_THICKNESS = 6;

  // Cache de texturas (se generan una vez y se reutilizan).
  let _roofTopTextures = null;   // array de variantes: baldosa, claraboya, ducto, planta
  let _roofBottomTextures = null; // array de variantes: panel, lámpara, viga
  let _roofSideMaterial = null;

  function ceilingTextureVariant(variant) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    // Fondo: hormigón gris-cálido con manchas
    const grad = g.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#8a8478');
    grad.addColorStop(0.5, '#7d776b');
    grad.addColorStop(1, '#6e695f');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    // Manchas de hormigón (irregularidades)
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * 256, y = Math.random() * 256;
      const r = 8 + Math.random() * 20;
      g.fillStyle = `rgba(${50 + Math.random() * 30},${45 + Math.random() * 25},${40 + Math.random() * 20},${0.10 + Math.random() * 0.18})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // Highlight superior izquierdo (luz)
    const hlGrad = g.createRadialGradient(50, 50, 5, 50, 50, 200);
    hlGrad.addColorStop(0, 'rgba(255,250,230,0.18)');
    hlGrad.addColorStop(1, 'rgba(255,250,230,0)');
    g.fillStyle = hlGrad;
    g.fillRect(0, 0, 256, 256);
    // Líneas de baldosa (4 cuadrantes) — más prominentes
    g.strokeStyle = 'rgba(30,25,18,0.55)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(128, 0); g.lineTo(128, 256);
    g.moveTo(0, 128); g.lineTo(256, 128);
    g.stroke();
    // Bisel de baldosas (sombra interior)
    g.strokeStyle = 'rgba(255,250,230,0.15)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(126, 0); g.lineTo(126, 256);
    g.moveTo(0, 126); g.lineTo(256, 126);
    g.stroke();
    // Borde exterior
    g.strokeStyle = 'rgba(30,25,18,0.4)';
    g.lineWidth = 4;
    g.strokeRect(2, 2, 252, 252);
    if (variant === 'skylight') {
      // Claraboya: vidrio iluminado con marcos
      const cx = 128, cy = 128, r = 60;
      // Sombra alrededor del vidrio
      g.fillStyle = 'rgba(20,15,10,0.45)';
      g.fillRect(cx - r - 6, cy - r - 6, (r + 6) * 2, (r + 6) * 2);
      // Marco
      g.fillStyle = '#3a3530';
      g.fillRect(cx - r - 3, cy - r - 3, (r + 3) * 2, (r + 3) * 2);
      // Vidrio (gradient cielo)
      const sky = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      sky.addColorStop(0, '#b8d8ee');
      sky.addColorStop(0.6, '#88b8d8');
      sky.addColorStop(1, '#5890b8');
      g.fillStyle = sky;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
      // Cruceta
      g.strokeStyle = '#2a2520';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(cx, cy - r); g.lineTo(cx, cy + r);
      g.moveTo(cx - r, cy); g.lineTo(cx + r, cy);
      g.stroke();
      // Reflejo brillante
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.moveTo(cx - r + 8, cy - r + 8);
      g.lineTo(cx - r + 40, cy - r + 8);
      g.lineTo(cx - r + 14, cy - r + 30);
      g.closePath();
      g.fill();
    } else if (variant === 'duct') {
      // Ducto AC: dos barras paralelas
      g.fillStyle = '#8a857a';
      g.fillRect(30, 88, 196, 30);
      g.fillRect(30, 138, 196, 30);
      g.strokeStyle = 'rgba(20,15,10,0.7)';
      g.lineWidth = 2;
      g.strokeRect(30, 88, 196, 30);
      g.strokeRect(30, 138, 196, 30);
      // Sombras inferiores
      g.fillStyle = 'rgba(20,15,10,0.35)';
      g.fillRect(30, 116, 196, 4);
      g.fillRect(30, 166, 196, 4);
      // Highlights
      g.fillStyle = 'rgba(255,250,230,0.25)';
      g.fillRect(34, 90, 188, 3);
      g.fillRect(34, 140, 188, 3);
      // Tornillos
      g.fillStyle = 'rgba(20,15,10,0.85)';
      for (const [x, y] of [[40, 95], [216, 95], [40, 110], [216, 110], [40, 145], [216, 145], [40, 160], [216, 160]]) {
        g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
      }
    } else if (variant === 'plant') {
      // Maceta más grande con planta frondosa
      g.fillStyle = '#7a5538';
      g.fillRect(96, 168, 64, 56);
      g.strokeStyle = 'rgba(30,20,10,0.75)';
      g.lineWidth = 2;
      g.strokeRect(96, 168, 64, 56);
      // Tierra
      g.fillStyle = '#3a2818';
      g.fillRect(100, 168, 56, 8);
      // Hojas (varias capas)
      const leaves = [
        [128, 130, 38, '#3a6a22'],
        [100, 118, 30, '#4e8030'],
        [156, 122, 32, '#3a6a22'],
        [114, 96, 28, '#5e9038'],
        [142, 94, 26, '#4e8030'],
        [128, 76, 24, '#6ea050'],
      ];
      for (const [lx, ly, lr, lc] of leaves) {
        g.fillStyle = lc;
        g.beginPath(); g.arc(lx, ly, lr, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(20,40,15,0.55)';
        g.lineWidth = 2;
        g.beginPath(); g.arc(lx, ly, lr, 0, Math.PI * 2); g.stroke();
      }
    } else if (variant === 'antenna') {
      // Antena estructural más definida
      // Base
      g.fillStyle = '#5a5048';
      g.fillRect(112, 130, 32, 28);
      g.strokeStyle = 'rgba(20,15,10,0.8)';
      g.lineWidth = 2;
      g.strokeRect(112, 130, 32, 28);
      // Mástil
      g.strokeStyle = '#7a7268';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(128, 130); g.lineTo(128, 30);
      g.stroke();
      g.strokeStyle = '#3a3530';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(126, 130); g.lineTo(126, 30);
      g.stroke();
      // Crucetas
      for (const [yc, w] of [[60, 24], [78, 30], [96, 36]]) {
        g.strokeStyle = '#7a7268';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(128 - w, yc); g.lineTo(128 + w, yc);
        g.stroke();
      }
      // Luz roja en el tope
      g.fillStyle = '#e84030';
      g.beginPath(); g.arc(128, 28, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,200,180,0.6)';
      g.beginPath(); g.arc(128, 28, 8, 0, Math.PI * 2); g.fill();
    } else if (variant === 'solar') {
      // Panel solar
      g.fillStyle = '#1a1a2a';
      g.fillRect(40, 60, 176, 136);
      g.strokeStyle = 'rgba(80,80,100,0.9)';
      g.lineWidth = 3;
      g.strokeRect(40, 60, 176, 136);
      // Grid de celdas solares
      g.strokeStyle = 'rgba(60,80,140,0.7)';
      g.lineWidth = 1.5;
      for (let i = 1; i < 8; i++) {
        g.beginPath();
        g.moveTo(40 + i * 22, 60); g.lineTo(40 + i * 22, 196);
        g.stroke();
      }
      for (let i = 1; i < 6; i++) {
        g.beginPath();
        g.moveTo(40, 60 + i * 22.6); g.lineTo(216, 60 + i * 22.6);
        g.stroke();
      }
      // Reflejo
      const refl = g.createLinearGradient(40, 60, 216, 196);
      refl.addColorStop(0, 'rgba(180,200,255,0.25)');
      refl.addColorStop(0.5, 'rgba(180,200,255,0.05)');
      refl.addColorStop(1, 'rgba(180,200,255,0.2)');
      g.fillStyle = refl;
      g.fillRect(40, 60, 176, 136);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  function ceilingBottomVariant(variant) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    // Fondo: panel acústico crema
    const grad = g.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#f0e8d8');
    grad.addColorStop(1, '#dcd2bc');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    // Textura de panel acústico (puntos)
    for (let y = 8; y < 256; y += 6) {
      for (let x = 8; x < 256; x += 6) {
        g.fillStyle = `rgba(140,125,100,${0.15 + Math.random() * 0.10})`;
        g.beginPath(); g.arc(x, y, 0.8, 0, Math.PI * 2); g.fill();
      }
    }
    // Grid de paneles acústicos (4x4)
    g.strokeStyle = 'rgba(120,105,80,0.75)';
    g.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const p = (i / 4) * 256;
      g.beginPath();
      g.moveTo(p, 0); g.lineTo(p, 256);
      g.moveTo(0, p); g.lineTo(256, p);
      g.stroke();
    }
    // Bisel de paneles (highlight)
    g.strokeStyle = 'rgba(255,250,230,0.4)';
    g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const p = (i / 4) * 256 + 1.5;
      g.beginPath();
      g.moveTo(p, 0); g.lineTo(p, 256);
      g.moveTo(0, p); g.lineTo(256, p);
      g.stroke();
    }
    if (variant === 'lamp') {
      // Lámpara con halo grande
      const cx = 128, cy = 128;
      const halo = g.createRadialGradient(cx, cy, 5, cx, cy, 130);
      halo.addColorStop(0, 'rgba(255,238,170,0.75)');
      halo.addColorStop(0.4, 'rgba(255,225,140,0.35)');
      halo.addColorStop(1, 'rgba(255,225,140,0)');
      g.fillStyle = halo;
      g.fillRect(0, 0, 256, 256);
      // Aro exterior
      g.strokeStyle = 'rgba(60,50,35,0.92)';
      g.lineWidth = 5;
      g.beginPath(); g.arc(cx, cy, 44, 0, Math.PI * 2); g.stroke();
      // Aro interior
      g.strokeStyle = 'rgba(40,32,22,0.85)';
      g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, 38, 0, Math.PI * 2); g.stroke();
      // Bombilla
      const bulb = g.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 36);
      bulb.addColorStop(0, '#ffffff');
      bulb.addColorStop(0.3, '#fff2c8');
      bulb.addColorStop(0.7, '#f0d878');
      bulb.addColorStop(1, '#c89840');
      g.fillStyle = bulb;
      g.beginPath(); g.arc(cx, cy, 36, 0, Math.PI * 2); g.fill();
      // Reflejo brillante
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.arc(cx - 12, cy - 14, 6, 0, Math.PI * 2); g.fill();
    } else if (variant === 'beam') {
      // Viga estructural cruzando
      // Sombra
      g.fillStyle = 'rgba(20,15,10,0.4)';
      g.fillRect(0, 100, 256, 60);
      // Viga
      const beam = g.createLinearGradient(0, 102, 0, 158);
      beam.addColorStop(0, '#a08868');
      beam.addColorStop(0.5, '#8c7050');
      beam.addColorStop(1, '#705638');
      g.fillStyle = beam;
      g.fillRect(0, 104, 256, 50);
      // Líneas de madera
      g.strokeStyle = 'rgba(50,35,20,0.5)';
      g.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const yy = 108 + i * 9;
        g.beginPath();
        for (let x = 0; x <= 256; x += 4) {
          const off = Math.sin((x + i * 30) / 18) * 1.5;
          if (x === 0) g.moveTo(x, yy + off);
          else g.lineTo(x, yy + off);
        }
        g.stroke();
      }
      // Borde superior brillante
      g.fillStyle = 'rgba(255,235,200,0.3)';
      g.fillRect(0, 104, 256, 2);
      // Borde inferior oscuro
      g.fillStyle = 'rgba(20,15,10,0.5)';
      g.fillRect(0, 152, 256, 2);
      // Tornillos en los extremos
      for (const [x, y] of [[20, 116], [20, 142], [236, 116], [236, 142]]) {
        g.fillStyle = '#1a1208';
        g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,235,200,0.4)';
        g.beginPath(); g.arc(x - 1, y - 1, 1.2, 0, Math.PI * 2); g.fill();
      }
    } else if (variant === 'vent') {
      // Rejilla de ventilación grande
      g.fillStyle = 'rgba(20,15,10,0.5)';
      g.fillRect(70, 70, 116, 116);
      g.fillStyle = '#a8a098';
      g.fillRect(74, 74, 108, 108);
      g.strokeStyle = 'rgba(30,22,12,0.85)';
      g.lineWidth = 3;
      g.strokeRect(74, 74, 108, 108);
      // Líneas verticales
      g.strokeStyle = 'rgba(30,22,12,0.7)';
      g.lineWidth = 2;
      for (let i = 1; i < 12; i++) {
        g.beginPath();
        g.moveTo(74 + i * 9, 80); g.lineTo(74 + i * 9, 176);
        g.stroke();
      }
      // Sombra interior superior
      g.fillStyle = 'rgba(20,15,10,0.35)';
      g.fillRect(74, 74, 108, 6);
      // Tornillos en esquinas
      for (const [x, y] of [[82, 82], [174, 82], [82, 174], [174, 174]]) {
        g.fillStyle = '#1a1208';
        g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
      }
    } else if (variant === 'speaker') {
      // Altavoz/intercom
      const cx = 128, cy = 128;
      g.fillStyle = '#5a5048';
      g.beginPath(); g.arc(cx, cy, 38, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(20,15,10,0.85)';
      g.lineWidth = 3;
      g.beginPath(); g.arc(cx, cy, 38, 0, Math.PI * 2); g.stroke();
      // Cono interior
      g.fillStyle = '#2a2520';
      g.beginPath(); g.arc(cx, cy, 28, 0, Math.PI * 2); g.fill();
      // Centro
      g.fillStyle = '#4a4238';
      g.beginPath(); g.arc(cx, cy, 8, 0, Math.PI * 2); g.fill();
      // Textura de rejilla circular (puntos)
      g.fillStyle = 'rgba(20,15,10,0.7)';
      for (let r = 14; r < 28; r += 4) {
        const dots = Math.floor(r * 0.7);
        for (let i = 0; i < dots; i++) {
          const a = (i / dots) * Math.PI * 2;
          g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.2, 0, Math.PI * 2); g.fill();
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  function ensureRoofTextures() {
    if (_roofTopTextures) return;
    _roofTopTextures = [
      ceilingTextureVariant('plain'),
      ceilingTextureVariant('plain'),
      ceilingTextureVariant('plain'),     // 3× plain (común)
      ceilingTextureVariant('skylight'),
      ceilingTextureVariant('duct'),
      ceilingTextureVariant('plant'),
      ceilingTextureVariant('antenna'),
      ceilingTextureVariant('solar'),
    ];
    _roofBottomTextures = [
      ceilingBottomVariant('plain'),
      ceilingBottomVariant('plain'),       // 2× plain
      ceilingBottomVariant('lamp'),
      ceilingBottomVariant('lamp'),        // 2× lamp
      ceilingBottomVariant('beam'),
      ceilingBottomVariant('vent'),
      ceilingBottomVariant('speaker'),
    ];
    _roofSideMaterial = new THREE.MeshBasicMaterial({ color: 0x5e4e38 });
  }

  function clearRoof() {
    for (const m of roofObjects) {
      scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      // Materiales: NO disposear las texturas cacheadas, solo el array de mats
    }
    roofObjects.length = 0;
  }

  function buildRoof() {
    try {
      clearRoof();
      if (!roofVisible) return;
      // El techo solo tiene sentido con paredes Up (paredes a altura completa).
      // En modo Down/Cutaway las paredes se reducen y el techo flotaría o caería.
      if (wallMode !== 'up') return;
      ensureRoofTextures();
      // Estrategia: calcular el bounding box de TODAS las paredes existentes (N + W).
      // Cubrimos cada celda dentro de ese bbox con techo. Esto resulta en una
      // "terraza" continua sobre toda la oficina (incluyendo divisiones internas).
      let minCx = Infinity, maxCx = -Infinity, minCy = Infinity, maxCy = -Infinity;
      let hasAnyWall = false;
      for (let cy = 0; cy <= GRID_H; cy++) {
        for (let cx = 0; cx < GRID_W; cx++) {
          if (worldGrid.wallN[cy] && worldGrid.wallN[cy][cx]) {
            hasAnyWall = true;
            // wallN[cy][cx] separa cy-1 de cy: afecta ambos lados
            if (cy - 1 >= 0) {
              if (cx < minCx) minCx = cx;
              if (cx > maxCx) maxCx = cx;
              if (cy - 1 < minCy) minCy = cy - 1;
              if (cy - 1 > maxCy) maxCy = cy - 1;
            }
            if (cy < GRID_H) {
              if (cx < minCx) minCx = cx;
              if (cx > maxCx) maxCx = cx;
              if (cy < minCy) minCy = cy;
              if (cy > maxCy) maxCy = cy;
            }
          }
        }
      }
      for (let cy = 0; cy < GRID_H; cy++) {
        for (let cx = 0; cx <= GRID_W; cx++) {
          if (worldGrid.wallW[cy] && worldGrid.wallW[cy][cx]) {
            hasAnyWall = true;
            if (cx - 1 >= 0) {
              if (cx - 1 < minCx) minCx = cx - 1;
              if (cx - 1 > maxCx) maxCx = cx - 1;
              if (cy < minCy) minCy = cy;
              if (cy > maxCy) maxCy = cy;
            }
            if (cx < GRID_W) {
              if (cx < minCx) minCx = cx;
              if (cx > maxCx) maxCx = cx;
              if (cy < minCy) minCy = cy;
              if (cy > maxCy) maxCy = cy;
            }
          }
        }
      }
      if (!hasAnyWall) return;
      // Construir un mesh por celda dentro del bbox
      for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cx = minCx; cx <= maxCx; cx++) {
          const geo = new THREE.BoxGeometry(CELL, ROOF_THICKNESS, CELL);
          const seedTop = Math.abs(cx * 7919 + cy * 524287) % _roofTopTextures.length;
          const seedBot = Math.abs(cx * 9973 + cy * 196613) % _roofBottomTextures.length;
          const topTex = _roofTopTextures[seedTop];
          const botTex = _roofBottomTextures[seedBot];
          const mats = [
            _roofSideMaterial, _roofSideMaterial,
            new THREE.MeshBasicMaterial({ map: topTex }),
            new THREE.MeshBasicMaterial({ map: botTex }),
            _roofSideMaterial, _roofSideMaterial,
          ];
          const mesh = new THREE.Mesh(geo, mats);
          mesh.userData.roofMesh = true;
          mesh.position.set(
            (cx + 0.5) * CELL - centerX,
            WALL_H_UP + ROOF_THICKNESS / 2,
            (cy + 0.5) * CELL - centerZ
          );
          scene.add(mesh);
          roofObjects.push(mesh);
        }
      }
    } catch (err) {
      console.error('[buildRoof] error:', err);
    }
  }

  function setRoofVisible(v) {
    try {
      roofVisible = !!v;
      const btn = document.getElementById('btn-roof');
      if (btn) btn.textContent = roofVisible ? '🏠 Techo: On' : '🏠 Techo: Off';
      console.log('[roof] setRoofVisible →', roofVisible);
      buildRoof();
      console.log('[roof] roofObjects.length =', roofObjects.length);
    } catch (err) {
      console.error('[setRoofVisible] error:', err);
    }
  }


  // ══════════════════════════════════════════════════════════════
  //  CAMERA GIZMO — render extraído a src/engine/camera-gizmo.ts.
  //  Acá quedan wrappers que mapean ceState ↔ pose del engine, hasta que
  //  el cutscene editor se extraiga a src/editor/.
  // ══════════════════════════════════════════════════════════════
  let cameraGizmo: any = null;   // ref al singleton del engine, asignada en buildCameraGizmo

  function buildCameraGizmo() {
    if (cameraGizmo) return;
    cameraGizmo = engineBuildCameraGizmo(scene);
  }

  function updateCameraGizmo() {
    if (!cameraGizmo) return;
    const cam = ceState.cutscene && ceState.cutscene.camera;
    if (!cam) return;
    const pos = cam.gizmoPosition || { x: 0, y: 200, z: 300 };
    const tgt = cam.gizmoTarget   || { x: 0, y: 0,   z: 0   };
    const lens = cam.gizmoLens || 50;
    const roll = cam.gizmoRoll || 0;
    const allKfs = ((cam.keyframes || []).filter(k => k.position && k.target))
      .slice().sort((a, b) => a.t - b.t);
    renderCameraGizmoPose(
      { position: pos, target: tgt, lens, roll },
      allKfs.map(k => k.position),
    );
  }

  // setCameraGizmoVisible viene del import directo (no shim).

  // Reset: cámara cinemática vuelve a una pose default cómoda mirando al centro.
  function ceResetCameraGizmo() {
    const cam = ceState.cutscene.camera;
    cam.gizmoPosition = { x: 200, y: 250, z: 300 };
    cam.gizmoTarget   = { x: 0,   y: 30,  z: 0   };
    cam.gizmoLens     = 50;
    cam.gizmoProjection = 'perspective';
    cam.gizmoRoll     = 0;   // radianes — rotación sobre eje de mira (barrel roll)
    updateCameraGizmo();
    if (typeof ceSyncLensUI === 'function') ceSyncLensUI();
  }

  // Setea el lens (mm) + auto-record kf en playhead actual.
  // Si el usuario está editando una pose y cambia el lens, el kf en playhead refleja ambos.
  function ceSetCameraLens(lensMm, opts) {
    const cam = ceState.cutscene.camera;
    cam.gizmoLens = Math.max(8, Math.min(400, lensMm));
    updateCameraGizmo();   // redibuja frustum con el FOV nuevo
    if (opts && opts.skipRecord) return;
    // Auto-record kf en playhead actual (igual que drag de ejes)
    const t = ceState.playhead;
    const existing = cam.keyframes.find(k => Math.abs(k.t - t) < 0.05);
    if (existing) {
      existing.lens = cam.gizmoLens;
    } else {
      const newKf = {
        t, type: 'camera',
        position: { ...cam.gizmoPosition },
        target: { ...cam.gizmoTarget },
        roll: cam.gizmoRoll || 0,
        lens: cam.gizmoLens,
        projection: cam.gizmoProjection || 'perspective',
        cut: false, transition: 'none', transitionDuration: 0.5,
      };
      if (typeof ceAssignSceneIdToKf === 'function') ceAssignSceneIdToKf(newKf);
      cam.keyframes.push(newKf);
      cam.keyframes.sort((a, b) => a.t - b.t);
    }
    if (typeof ceRenderTracks === 'function') ceRenderTracks();
  }

  // Sincroniza la UI del lens (preset select + slider + valor) con el state actual
  function ceSyncLensUI() {
    const cam = ceState.cutscene.camera;
    const lens = Math.round(cam.gizmoLens || 50);
    const preset = document.getElementById('ce-cam-lens-preset');
    const slider = document.getElementById('ce-cam-lens-slider');
    const valueLabel = document.getElementById('ce-cam-lens-value');
    if (!preset || !slider || !valueLabel) return;
    slider.value = lens;
    valueLabel.textContent = lens + 'mm';
    // Si el lens coincide con un preset, marcar; si no, "custom"
    const presetVals = ['24', '35', '50', '85', '135'];
    if (presetVals.includes(String(lens))) {
      preset.value = String(lens);
    } else {
      preset.value = 'custom';
    }
  }

  // clearScene ahora vive en src/engine/scene-graph.ts. Wrapper local para no
  // tocar callsites:
  const clearScene = engineClearScene;

  // ══════════════════════════════════════════════════════════════
  //  WALL BUILDERS — uno por estilo × orientación
  // ══════════════════════════════════════════════════════════════
  // Cada helper construye la geometría de UNA celda de pared del estilo dado.
  // Se llaman desde el bucle de buildScene().


  // Ventana pequeña: sólido bajo (sill) + vidrio medio + sólido alto (lintel).
  // Soporta runs de celdas adyacentes (cx..endCx) para evitar el solape de
  // vidrios entre celdas. Cada celda dentro del run sigue siendo pintable
  // como cara individual (mesh.userData.wallFace por celda).
  // Si la pared es muy baja (cutaway zócalo), cae a sólido normal por celda.


  // DOOR_TEMPLATES + doorTpl ahora en src/engine/door-panels.ts.

  // Pared sólida con puerta encima: dintel arriba (igual que el style door
  // viejo), abajo libre, y un panel rotatorio dentro del hueco.


  // DOOR_PANEL_THICK ahora en src/engine/state.ts.

  // makeDoorPanelMesh ahora en src/engine/door-panels.ts.



  function buildScene() {
    clearScene();

    // Floor + gridHelper ahora en src/engine/floor-render.ts.
    buildFloor();

    // ── Walls N ──
    // Cutaway dinámico: se reduce a zócalo la pared "del frente" según
    // dónde esté la cámara en el plano horizontal (theta).
    const camAtSouth = Math.cos(theta) > 0;   // cámara en mitad sur del mundo
    const camAtEast  = Math.sin(theta) > 0;   // cámara en mitad este

    function wNH(cy) {
      if (wallMode !== 'cutaway') return WALL_H;
      const front = camAtSouth ? (cy > 0) : (cy < GRID_H);
      return front ? WALL_H_DOWN : WALL_H;
    }
    function wWH(cx) {
      if (wallMode !== 'cutaway') return WALL_H;
      const front = camAtEast ? (cx > 0) : (cx < GRID_W);
      return front ? WALL_H_DOWN : WALL_H;
    }

    // Walls N: paredes sólidas se renderizan celda por celda. Ventanas
    // adyacentes con misma altura se agrupan en una sola caja larga (run)
    // para evitar caras laterales internas y líneas que rompen el ventanal.
    // El run se rompe en corners intermedios (donde hay un post estructural).
    for (let cy = 0; cy <= GRID_H; cy++) {
      let cx = 0;
      while (cx < GRID_W) {
        if (!hasWallN(cx, cy)) { cx++; continue; }
        const h = wNH(cy);
        const style = worldGrid.wallNStyle[cy][cx];
        if (style === 'window') {
          // Ventanal piso-a-techo, soporta runs.
          let endCx = cx + 1;
          while (endCx < GRID_W) {
            if (!hasWallN(endCx, cy)) break;
            if (worldGrid.wallNStyle[cy][endCx] !== 'window') break;
            if (wNH(cy) !== h) break;
            if (isCorner(endCx, cy)) break;
            endCx++;
          }
          const shrinkW = isCorner(cx, cy) ? halfT : 0;
          const shrinkE = isCorner(endCx, cy) ? halfT : 0;
          const xmin = cx * CELL + shrinkW;
          const xmax = endCx * CELL - shrinkE;
          const ymin = cy * CELL - halfT;
          const ymax = cy * CELL + halfT;
          const mesh = mkBox(xmin, ymin, 0, xmax, ymax, h, PALETTE.glass);
          if (mesh) {
            makeGlassMesh(mesh);
            mesh.userData.wallFace = { type: 'wallN', cx, cy };
            mesh.userData.isGlass = true;
            scene.add(mesh); sceneObjects.push(mesh);
          }
          cx = endCx;
        } else if (style === 'window-half') {
          // Ventanita: igual que ventanal, soporta runs adyacentes para evitar
          // el solape visual del vidrio entre celdas.
          let endCx = cx + 1;
          while (endCx < GRID_W) {
            if (!hasWallN(endCx, cy)) break;
            if (worldGrid.wallNStyle[cy][endCx] !== 'window-half') break;
            if (wNH(cy) !== h) break;
            if (isCorner(endCx, cy)) break;
            endCx++;
          }
          buildWindowHalfRunN(cx, endCx, cy, h);
          cx = endCx;
        } else {
          // Pared sólida (incluye estilos no reconocidos como fallback).
          // Si tiene una puerta como prop, render con hueco + panel.
          const door = getDoorOnWallN(cx, cy);
          if (door) {
            buildSolidWallNWithDoor(cx, cy, h, door);
          } else {
            buildSolidWallN(cx, cy, h);
          }
          cx++;
        }
      }
    }

    // Walls W: mismo principio que N pero iterando por columnas (cx fijo, cy variando).
    for (let cx = 0; cx <= GRID_W; cx++) {
      let cy = 0;
      while (cy < GRID_H) {
        if (!hasWallW(cx, cy)) { cy++; continue; }
        const h = wWH(cx);
        const style = worldGrid.wallWStyle[cy][cx];
        if (style === 'window') {
          let endCy = cy + 1;
          while (endCy < GRID_H) {
            if (!hasWallW(cx, endCy)) break;
            if (worldGrid.wallWStyle[endCy][cx] !== 'window') break;
            if (wWH(cx) !== h) break;
            if (isCorner(cx, endCy)) break;
            endCy++;
          }
          const shrinkN = isCorner(cx, cy) ? halfT : 0;
          const shrinkS = isCorner(cx, endCy) ? halfT : 0;
          const xmin = cx * CELL - halfT;
          const xmax = cx * CELL + halfT;
          const ymin = cy * CELL + shrinkN;
          const ymax = endCy * CELL - shrinkS;
          const mesh = mkBox(xmin, ymin, 0, xmax, ymax, h, PALETTE.glass);
          if (mesh) {
            makeGlassMesh(mesh);
            mesh.userData.wallFace = { type: 'wallW', cx, cy };
            mesh.userData.isGlass = true;
            scene.add(mesh); sceneObjects.push(mesh);
          }
          cy = endCy;
        } else if (style === 'window-half') {
          let endCy = cy + 1;
          while (endCy < GRID_H) {
            if (!hasWallW(cx, endCy)) break;
            if (worldGrid.wallWStyle[endCy][cx] !== 'window-half') break;
            if (wWH(cx) !== h) break;
            if (isCorner(cx, endCy)) break;
            endCy++;
          }
          buildWindowHalfRunW(cx, cy, endCy, h);
          cy = endCy;
        } else {
          const door = getDoorOnWallW(cx, cy);
          if (door) {
            buildSolidWallWWithDoor(cx, cy, h, door);
          } else {
            buildSolidWallW(cx, cy, h);
          }
          cy++;
        }
      }
    }

    // ── Corner posts ──
    // El post toma la altura máxima de las paredes que confluyen, así
    // donde una pared "alta del fondo" se une con un zócalo, el post sube.
    // Si todas las paredes incidentes son ventanas, el post se renderiza
    // como vidrio para no romper la continuidad visual del ventanal.
    // Cuando hay paredes pintadas alrededor, las 4 caras laterales del post
    // heredan ese color para mantener continuidad visual.
    function inheritedPostColors(cx, cy) {
      const wnL = (cx > 0)        ? worldGrid.wallNColors[cy][cx - 1] : null;
      const wnR = (cx < GRID_W)   ? worldGrid.wallNColors[cy][cx]     : null;
      const wwT = (cy > 0)        ? worldGrid.wallWColors[cy - 1][cx] : null;
      const wwB = (cy < GRID_H)   ? worldGrid.wallWColors[cy][cx]     : null;
      // Cara +Z (sur) del post hereda de las caras S de wallN incidentes
      const pz = (wnL && wnL.S !== undefined) ? wnL.S
               : (wnR && wnR.S !== undefined) ? wnR.S
               : PALETTE.post.left;
      const nz = (wnL && wnL.N !== undefined) ? wnL.N
               : (wnR && wnR.N !== undefined) ? wnR.N
               : PALETTE.post.left;
      const px = (wwT && wwT.E !== undefined) ? wwT.E
               : (wwB && wwB.E !== undefined) ? wwB.E
               : PALETTE.post.right;
      const nx = (wwT && wwT.W !== undefined) ? wwT.W
               : (wwB && wwB.W !== undefined) ? wwB.W
               : PALETTE.post.right;
      return { pzColor: pz, nzColor: nz, pxColor: px, nxColor: nx };
    }
    for (let cy = 0; cy <= GRID_H; cy++) {
      for (let cx = 0; cx <= GRID_W; cx++) {
        if (!isCorner(cx, cy)) continue;
        let postH = 0;
        if (cx > 0 && hasWallN(cx-1, cy)) postH = Math.max(postH, wNH(cy));
        if (cx < GRID_W && hasWallN(cx, cy)) postH = Math.max(postH, wNH(cy));
        if (cy > 0 && hasWallW(cx, cy-1)) postH = Math.max(postH, wWH(cx));
        if (cy < GRID_H && hasWallW(cx, cy)) postH = Math.max(postH, wWH(cx));
        const xmin = cx * CELL - halfT;
        const xmax = cx * CELL + halfT;
        const ymin = cy * CELL - halfT;
        const ymax = cy * CELL + halfT;
        const allWin = isAllWindowCorner(cx, cy);
        let colors;
        if (allWin) {
          colors = PALETTE.glass;
        } else {
          // Mezcla base post + caras heredadas (override de pz/nz/px/nx)
          colors = { ...PALETTE.post, ...inheritedPostColors(cx, cy) };
        }
        // En all-window: ocultar caras laterales del post para que no contribuyan
        // a la opacidad acumulada con los runs de wallN/wallW adyacentes.
        const hide = allWin ? ['+x', '-x', '+z', '-z'] : null;
        const mesh = mkBox(xmin, ymin, 0, xmax, ymax, postH, colors, hide);
        if (mesh) {
          if (allWin) {
            makeGlassMesh(mesh);
            // Edges también invisibles para no marcar el contorno del post entre vidrios
            if (mesh.userData.edges) mesh.userData.edges.visible = false;
          }
          scene.add(mesh); sceneObjects.push(mesh);
        }
      }
    }

    // ── Props ──
    for (const p of props) {
      const cat = p.category || 'floor';
      let mesh;
      if (cat === 'rug') {
        // Alfombra: caja muy chata casi pegada al piso
        const xmin = p.cx * CELL + RUG_PAD;
        const xmax = (p.cx + p.w) * CELL - RUG_PAD;
        const ymin = p.cy * CELL + RUG_PAD;
        const ymax = (p.cy + p.d) * CELL - RUG_PAD;
        mesh = mkBox(xmin, ymin, 0, xmax, ymax, p.h, {
          top: p.top, right: p.right, left: p.left
        });
      } else if (cat === 'wall') {
        // Cuadro: caja angosta pegada a la cara correcta de la pared.
        const b = getWallPropBounds(p);
        if (!b) {
          console.warn('[render] wall prop con side/coords inválido, skip:', p);
          continue;
        }
        mesh = mkBox(b.xmin, b.ymin, b.zmin, b.xmax, b.ymax, b.zmax, {
          top: p.top, right: p.right, left: p.left
        });
      } else if (cat === 'stack') {
        // Stack: objeto sobre mesa. Se posa con zOffset = altura del floor base.
        const base = getFloorStackBase(p.cx, p.cy);
        if (!base) {
          console.warn('[render] stack sin floor base, skip:', p);
          continue;
        }
        const STACK_PAD = 14;   // un poco más chico que la mesa
        const xmin = p.cx * CELL + STACK_PAD;
        const xmax = (p.cx + 1) * CELL - STACK_PAD;
        const ymin = p.cy * CELL + STACK_PAD;
        const ymax = (p.cy + 1) * CELL - STACK_PAD;
        mesh = mkBox(xmin, ymin, base.h, xmax, ymax, base.h + p.h, {
          top: p.top, right: p.right, left: p.left
        });
      } else {
        // floor (default)
        const xmin = p.cx * CELL + PROP_PAD;
        const xmax = (p.cx + p.w) * CELL - PROP_PAD;
        const ymin = p.cy * CELL + PROP_PAD;
        const ymax = (p.cy + p.d) * CELL - PROP_PAD;
        mesh = mkBox(xmin, ymin, 0, xmax, ymax, p.h, {
          top: p.top, right: p.right, left: p.left
        });
      }
      if (!mesh) {
        console.warn('[render] mesh inválido para prop, skip:', p);
        continue;
      }
      mesh.userData.prop = p;
      scene.add(mesh);
      sceneObjects.push(mesh);
    }
    // Si hay drag activo, restaurar opacidad reducida del mueble agarrado.
    if (draggedProp) setPropMeshOpacity(draggedProp, 0.32);
    // Reconstruir techo (si estaba visible) después del rebuild de paredes
    if (roofVisible) buildRoof();
  }

  // ══════════════════════════════════════════════════════════════
  //  CAMERA — iso ortográfica con rotación manual
  // ══════════════════════════════════════════════════════════════
  let theta = Math.PI / 4;                       // azimuth (alrededor de Y)
  setCameraThetaGetter(() => theta);   // engine/wall-mode lee theta para cutaway
  let phi = Math.atan(1 / Math.sqrt(2));         // elevación, ~35.264° = iso real
  const dist = 1500;
  let camZoom = 1;
  // Pan offset (desplaza el target de la cámara — Shift + drag derecho)
  let panX = 0, panZ = 0;

  let lastCamQuadrant = '';

  function updateCamera() {
    camera.up.set(0, 1, 0);   // reset roll inducido por POV cinemático
    camera.position.x = panX + dist * Math.cos(phi) * Math.sin(theta);
    camera.position.y = dist * Math.sin(phi);
    camera.position.z = panZ + dist * Math.cos(phi) * Math.cos(theta);
    camera.lookAt(panX, 0, panZ);
    camera.zoom = camZoom;
    camera.updateProjectionMatrix();
    // Rebuild la escena solo si cruzamos cuadrante en modo cutaway
    const q = (Math.sin(theta) > 0 ? 'E' : 'W') + (Math.cos(theta) > 0 ? 'S' : 'N');
    if (wallMode === 'cutaway' && q !== lastCamQuadrant) {
      lastCamQuadrant = q;
      buildScene();
    } else {
      lastCamQuadrant = q;
    }
  }

  // ── Mouse ─────────────────────────────────────────────────────────────
  // CLICK IZQUIERDO (solo con Editor ON):
  //   - sobre un mueble, sin drag → seleccionarlo (queda fijo en el piso)
  //   - sobre un mueble, con drag → empieza a moverlo (ghost que sigue al cursor)
  //   - en el aire/celda libre, sin drag → deselecciona
  // CLICK DERECHO + drag (siempre, con o sin Editor):
  //   - rota la cámara (theta horizontal, phi vertical)
  // CLICK DERECHO sin drag → nada
  let leftDown = false;
  let rightDown = false;
  let downX = 0, downY = 0, downTime = 0, didMove = false;
  let isPropDrag = false;
  let prevMouseX = 0, prevMouseY = 0;

  // Bloquear menú contextual del navegador para usar right-click
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

  renderer.domElement.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    // Si hay un panel de diálogo abierto, bloquear interacción con el mundo
    // (drag de agentes, construir, pintar, seleccionar). El botón derecho
    // sigue disponible para rotar/inclinar cámara — útil durante cutscenes.
    if (isDialoguePanelActive() && e.button === 0) {
      e.preventDefault();
      return;
    }
    // Modo Camera: drag de los ejes RGB del gizmo o del target rectángulo
    const inCameraMode = ceState && ceState.open && (typeof ceTypeSelect !== 'undefined') && ceTypeSelect.value === 'camera';
    if (e.button === 0 && inCameraMode && cameraGizmo) {
      setRaycasterFromEvent(e);
      // Raycast contra ejes del gizmo + target marker + body
      const gizmoTargets = [];
      cameraGizmo.axes.forEach(axisGroup => {
        axisGroup.traverse(o => {
          if (o.userData && o.userData.gizmoAxis) gizmoTargets.push(o);
        });
      });
      gizmoTargets.push(cameraGizmo.targetMesh);
      gizmoTargets.push(cameraGizmo.body);
      const hits = _raycaster.intersectObjects(gizmoTargets, false);
      if (hits.length > 0) {
        const hit = hits[0].object;
        e.preventDefault(); e.stopPropagation();
        const wp = getWorldPointFromEvent(e);
        const cam = ceState.cutscene.camera;
        const baseDrag = {
          startMouseX: e.clientX, startMouseY: e.clientY,
          startPos: { ...cam.gizmoPosition },
          startTgt: { ...cam.gizmoTarget },
          startWp: wp ? { x: wp.x, z: wp.z } : null,
        };
        if (hit.userData.gizmoAxis === 'x') {
          ceState._gizmoDrag = { kind: 'axis-x', ...baseDrag };
        } else if (hit.userData.gizmoAxis === 'y') {
          ceState._gizmoDrag = { kind: 'axis-y', ...baseDrag };
        } else if (hit.userData.gizmoAxis === 'z') {
          ceState._gizmoDrag = { kind: 'axis-z', ...baseDrag };
        } else if (hit.userData.gizmoTarget) {
          ceState._gizmoDrag = { kind: 'target', ...baseDrag };
        } else if (hit.userData.gizmoBody) {
          ceState._gizmoDrag = { kind: 'body', ...baseDrag };
        }
        return;
      }
    }
    // Modo Walls: tipo=walls activo en cutscene editor + click → toggle visibilidad
    // del elemento clickeado y guarda kf en el playhead actual.
    // El techo NO se toca con click — solo con el botón "🏠 Toggle techo".
    const inWallsMode = ceState && ceState.open && (typeof ceTypeSelect !== 'undefined') && ceTypeSelect.value === 'walls';
    if (e.button === 0 && inWallsMode) {
      e.preventDefault(); e.stopPropagation();
      setRaycasterFromEvent(e);
      // Targets: walls (incluye puertas/ventanas/vidrios) + muebles
      const targets = sceneObjects.filter(o =>
        o.userData && (o.userData.wallFace || o.userData.prop || o.userData.doorPanel)
      );
      // Para que podamos clickear elementos ocultos y mostrarlos: forzar visible=true temporal
      const prevVisible = targets.map(m => m.visible);
      targets.forEach(m => m.visible = true);
      const hits = _raycaster.intersectObjects(targets, false);
      // Restaurar visibilidad real
      targets.forEach((m, i) => m.visible = prevVisible[i]);
      if (hits.length > 0) {
        const hit = hits[0].object;
        const id = ceIdFromMesh(hit);
        if (id && id !== 'ROOF') {
          ceToggleElementAtPlayhead(id);
        }
      }
      return;
    }
    // Modo nuevo-agente placement: click izquierdo crea el agente en la celda hovered
    if (e.button === 0 && ceState && ceState.addingAgent) {
      e.preventDefault(); e.stopPropagation();
      const wp = getWorldPointFromEvent(e);
      if (wp) {
        const cx = Math.max(0, Math.min(GRID_W - 1, Math.floor(wp.x / CELL)));
        const cy = Math.max(0, Math.min(GRID_H - 1, Math.floor(wp.z / CELL)));
        const newId = 'cs_' + uid();
        const emoji = AGENT_KITS[Math.floor(Math.random() * AGENT_KITS.length)];
        const voiceIdx = pickVoiceIdx(newId);
        // 1) Registrar en cutscene.agents (data persistida con la cutscene)
        ceState.cutscene.agents.push({ id: newId, emoji, voiceIdx });
        // 2) Spawn visual con flag csAgent (no toca el localStorage del mundo)
        const a = spawnAgent(cx, cy, { id: newId, emoji, voiceIdx, csAgent: true });
        // 3) Crear track con primer kf de move en t=playhead
        const spawnKf = { t: ceState.playhead, type: 'move', cx, cy };
        if (typeof ceAssignSceneIdToKf === 'function') ceAssignSceneIdToKf(spawnKf);
        ceState.cutscene.tracks.push({
          agentId: newId,
          keyframes: [spawnKf],
          lastTriggeredT: -1,
        });
        ceState.selectedAgentId = newId;
      }
      ceState.addingAgent = false;
      document.body.classList.remove('cs-adding-agent');
      ceRefreshAgentSelect();
      ceRenderTracks();
      ceState.applyOnce = true;
      return;
    }
    // Modo FX placement: click izquierdo coloca el FX en la celda hovered
    if (e.button === 0 && ceState && ceState.fxPlacing) {
      e.preventDefault(); e.stopPropagation();
      const wp = getWorldPointFromEvent(e);
      if (wp) {
        const cx = Math.max(0, Math.min(GRID_W - 1, Math.floor(wp.x / CELL)));
        const cy = Math.max(0, Math.min(GRID_H - 1, Math.floor(wp.z / CELL)));
        const placing = ceState.fxPlacing;
        const target = { kind: 'cell', cx, cy };
        if (placing.isNewEntity) {
          const fxKf = { t: placing.t, target };
          if (typeof ceAssignSceneIdToKf === 'function') ceAssignSceneIdToKf(fxKf);
          const newEnt = {
            id: ceFxNewId(), kind: placing.fxKind, duration: placing.duration,
            keyframes: [fxKf],
          };
          ceState.cutscene.fx.entities.push(newEnt);
          ceState.selectedFxEntityIdx = ceState.cutscene.fx.entities.length - 1;
        } else {
          const ent = ceState.cutscene.fx.entities[placing.entityIdx];
          if (ent) {
            const fxKf = { t: placing.t, target };
            if (typeof ceAssignSceneIdToKf === 'function') ceAssignSceneIdToKf(fxKf);
            ent.keyframes.push(fxKf);
            ent.keyframes.sort((a, b) => a.t - b.t);
          }
        }
        ceState.fxPlacing = null;
        document.body.classList.remove('fx-placing');
        ceRenderTracks();
        ceState.applyOnce = true;
      }
      return;
    }
    e.preventDefault();
    downX = e.clientX;
    downY = e.clientY;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
    downTime = performance.now();
    didMove = false;
    isPropDrag = false;

    if (e.button === 0) {
      leftDown = true;
      // Modo "Editar celdas de zona" intercepta todo (igual que placeMode)
      if (zoneEditingId !== null) {
        zoneEditDragMode = 'add';
        zoneEditDragging = true;
        applyZoneEditAtEvent(e);
        return;
      }
      // placeMode tiene prioridad sobre cualquier otro modo
      if (placeMode) {
        updatePlaceGhost(e);
        if (placeValid) applyPlace();
        return;
      }
      if (mode === 'edit') {
        const prop = getPropFromEvent(e);
        if (prop) {
          startDrag(prop);
          isPropDrag = true;
        }
      } else if (mode === 'build') {
        const wp = getWorldPointFromEvent(e);
        if (wp) {
          isWallDragging = true;
          wallDragStart = wp;
          wallDragLast = wp;
          wallDragAxis = null;
          wallDragOffAxis = false;
          clearWallHover();
          // Preview inicial: 1 sola pared (la más cercana)
          const path = computeWallPath(wp, wp);
          showWallPreview(path, buildWallStyle === 'erase', false);
        }
      } else if (mode === 'paint') {
        // Preview se borra; pintar de verdad
        clearPaintPreview();
        if (paintShiftHeld || e.shiftKey) {
          // Flood fill: pintar toda la habitación / todas las tiles continuas
          floodFillAtEvent(e);
        } else {
          // Single paint + habilitar drag continuo
          paintLastKey = null;
          paintAtEvent(e);
          paintDragging = true;
        }
      } else if (mode === 'play') {
        // Click sobre agente → arranca drag (Two Point Hospital style).
        // Mientras se arrastra, el cerebro flota siguiendo al cursor.
        // Al soltar en celda válida, el agente aterriza directo (sin caminar).
        const ag = getAgentFromEvent(e);
        if (ag) {
          startAgentDrag(ag);
          updateAgentDragGhost(e);
          return;
        }
        // Click sobre piso vacío: nada (en versiones anteriores mandaba al
        // agente seleccionado a esa celda). El usuario manipula directo con drag.
      }
    } else if (e.button === 2) {
      rightDown = true;
      // Click derecho durante edit zone = quitar celda
      if (zoneEditingId !== null) {
        zoneEditDragMode = 'remove';
        zoneEditDragging = true;
        applyZoneEditAtEvent(e);
        return;
      }
    }
  });

  window.addEventListener('mousemove', (e) => {
    lastMouseEvent = e;
    paintShiftHeld = e.shiftKey;
    // ── Gizmo drag de cámara (axis / body / target) ──
    if (ceState && ceState._gizmoDrag) {
      const drag = ceState._gizmoDrag;
      const cam = ceState.cutscene.camera;
      // Usar punto del mundo bajo cursor proyectado al plano del piso (Y=0).
      // Esto da movimiento estable en escala mundo, no en pixels.
      const wp = getWorldPointFromEvent(e);
      if (drag.kind === 'axis-x' || drag.kind === 'axis-z' || drag.kind === 'body') {
        // Movimiento horizontal en plano del piso. Target se mueve igual que
        // cámara → paneo lateral con la mira siempre apuntando al mismo offset.
        if (wp && drag.startWp) {
          let dx = wp.x - drag.startWp.x;
          let dz = wp.z - drag.startWp.z;
          // Constrain a un solo eje según drag.kind
          if (drag.kind === 'axis-x') dz = 0;
          if (drag.kind === 'axis-z') dx = 0;
          cam.gizmoPosition = {
            x: drag.startPos.x + dx,
            y: drag.startPos.y,
            z: drag.startPos.z + dz,
          };
          cam.gizmoTarget = {
            x: drag.startTgt.x + dx,
            y: drag.startTgt.y,
            z: drag.startTgt.z + dz,
          };
          updateCameraGizmo();
        }
      } else if (drag.kind === 'axis-y') {
        // Vertical: solo cámara sube/baja. Target queda fijo (efecto tilt natural).
        // Cuando subís la cámara con target abajo, automáticamente "mira hacia abajo".
        const dy = -(e.clientY - drag.startMouseY);   // arriba = subir
        const scale = 1.5 / (camZoom || 1);
        cam.gizmoPosition = {
          x: drag.startPos.x,
          y: Math.max(10, drag.startPos.y + dy * scale),
          z: drag.startPos.z,
        };
        // Target NO cambia — queremos efecto crane / boom up
        updateCameraGizmo();
      } else if (drag.kind === 'target') {
        // Solo target se mueve, en plano del piso. Cámara queda fija.
        // Esto cambia el ángulo de mira: pan / tilt panorámico.
        if (wp) {
          cam.gizmoTarget = {
            x: wp.x,
            y: drag.startTgt.y,
            z: wp.z,
          };
          updateCameraGizmo();
        }
      }
      e.preventDefault();
      return;
    }
    // placeMode: ghost sigue al cursor sin importar click
    if (placeMode) {
      updatePlaceGhost(e);
      return;
    }
    // Editor de celdas de zona: drag con click izq/der pinta o borra
    if (zoneEditingId !== null && zoneEditDragging) {
      applyZoneEditAtEvent(e);
      return;
    }
    // Hover sin drag durante zone edit: cursor varía si la celda está bloqueada
    if (zoneEditingId !== null && !zoneEditDragging && !leftDown && !rightDown) {
      const cell = getFloorCellFromEvent(e);
      if (cell && !canPaintZoneCell(cell.cx, cell.cy)) {
        renderer.domElement.style.cursor = 'not-allowed';
      } else {
        renderer.domElement.style.cursor = 'crosshair';
      }
    }
    // Preview de pintura en modo paint (sin click activo)
    if (mode === 'paint' && !leftDown && !paintDragging) {
      updatePaintPreview(e);
    }
    // Hover de pared en build mode (sin drag activo)
    if (mode === 'build' && !leftDown && !rightDown) {
      const wp = getWorldPointFromEvent(e);
      if (wp) showWallHover(wp);
      else clearWallHover();
    }
    if (!leftDown && !rightDown) return;
    const totalMove = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
    if (totalMove > 4) didMove = true;

    if (rightDown) {
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      if (typeof isCameraLocked === 'function' && isCameraLocked()) return;
      if (e.shiftKey) {
        // PAN: trasladar el target de la cámara en el plano horizontal
        const panSpeed = 1.6 / camZoom;
        panX -= (Math.cos(theta) * dx + Math.sin(theta) * dy) * panSpeed;
        panZ -= (-Math.sin(theta) * dx + Math.cos(theta) * dy) * panSpeed;
      } else {
        theta -= dx * 0.008;
        phi += dy * 0.008;
        phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, phi));
      }
      updateCamera();
    } else if (leftDown && isAgentDragging()) {
      updateAgentDragGhost(e);
    } else if (leftDown && isPropDrag) {
      const cat = draggedProp ? (draggedProp.category || 'floor') : 'floor';
      if (cat === 'wall') {
        const wp = getWorldPointFromEvent(e);
        if (wp) {
          const face = findNearestPlaceableWallFace(wp);
          if (face) updateDragGhost(face.cx, face.cy, face.side);
        }
      } else if (cat === 'door') {
        const wp = getWorldPointFromEvent(e);
        if (wp) {
          const seg = findNearestWallSegment(wp);
          if (seg) {
            // Mantener side actual si coincide con axis del segmento; si no, default al axis nuevo
            const axisIsHoriz = (seg.type === 'wallN');
            const sideIsHoriz = (dragLastSide === 'N' || dragLastSide === 'S');
            const side = (axisIsHoriz === sideIsHoriz) ? dragLastSide : (axisIsHoriz ? 'S' : 'E');
            updateDragGhost(seg.cx, seg.cy, side);
          }
        }
      } else {
        const cell = getCellFromEvent(e);
        if (cell) updateDragGhost(cell.cx, cell.cy);
      }
    } else if (leftDown && isWallDragging) {
      const wp = getWorldPointFromEvent(e);
      if (wp) {
        wallDragLast = wp;
        tryLockAxis(wallDragStart, wallDragLast);
        const path = computeWallPath(wallDragStart, wallDragLast);
        const isErase = (buildWallStyle === 'erase');
        const blockedFurn = pathBlocksOnFurniture(path, isErase);
        showWallPreview(path, isErase, wallDragOffAxis || blockedFurn);
      }
    } else if (leftDown && paintDragging) {
      paintAtEvent(e);
    }

    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
  });

  window.addEventListener('mouseup', (e) => {
    // Gizmo de cámara: terminar drag + auto-grabar kf en playhead actual
    if (ceState && ceState._gizmoDrag) {
      const drag = ceState._gizmoDrag;
      ceState._gizmoDrag = null;
      // Auto-record: solo si efectivamente cambió la pose
      const cam = ceState.cutscene.camera;
      const t = ceState.playhead;
      const existing = cam.keyframes.find(k => Math.abs(k.t - t) < 0.05);
      if (existing) {
        existing.position = { ...cam.gizmoPosition };
        existing.target = { ...cam.gizmoTarget };
        existing.roll = cam.gizmoRoll || 0;
        existing.lens = cam.gizmoLens || 50;
        existing.projection = cam.gizmoProjection || 'perspective';
      } else {
        const newKf = {
          t, type: 'camera',
          position: { ...cam.gizmoPosition },
          target: { ...cam.gizmoTarget },
          roll: cam.gizmoRoll || 0,
          lens: cam.gizmoLens || 50,
          projection: cam.gizmoProjection || 'perspective',
          cut: false, transition: 'none', transitionDuration: 0.5,
        };
        ceAssignSceneIdToKf(newKf);
        cam.keyframes.push(newKf);
        cam.keyframes.sort((a, b) => a.t - b.t);
      }
      ceRenderTracks();
      e.preventDefault();
      return;
    }
    if (e.button === 0 && leftDown) {
      leftDown = false;
      if (isAgentDragging()) {
        updateAgentDragGhost(e);
        endAgentDrag(true);
        return;
      }
      if (isPropDrag) {
        const cat = draggedProp ? (draggedProp.category || 'floor') : 'floor';
        let target = null;
        if (cat === 'wall') {
          const wp = getWorldPointFromEvent(e);
          if (wp) {
            const face = findNearestPlaceableWallFace(wp);
            if (face) target = { cx: face.cx, cy: face.cy, side: face.side };
          }
        } else if (cat === 'door') {
          const wp = getWorldPointFromEvent(e);
          if (wp) {
            const seg = findNearestWallSegment(wp);
            if (seg) {
              const axisIsHoriz = (seg.type === 'wallN');
              const sideIsHoriz = (dragLastSide === 'N' || dragLastSide === 'S');
              const side = (axisIsHoriz === sideIsHoriz) ? dragLastSide : (axisIsHoriz ? 'S' : 'E');
              target = { cx: seg.cx, cy: seg.cy, side };
            }
          }
        } else {
          target = getCellFromEvent(e);
        }
        endDrag(target);
        isPropDrag = false;
      } else if (isWallDragging) {
        const path = computeWallPath(wallDragStart, wallDragLast);
        const isErase = (buildWallStyle === 'erase');
        const blockedFurn = pathBlocksOnFurniture(path, isErase);
        if (!wallDragOffAxis && !blockedFurn) {
          applyWallPath(path);
        } else {
          const reason = wallDragOffAxis ? 'fuera de eje' : 'bloqueado por mueble';
          console.log('[walls] cancelado:', reason);
        }
        isWallDragging = false;
        wallDragStart = null;
        wallDragLast = null;
        wallDragAxis = null;
        wallDragOffAxis = false;
        clearWallPreviews();
      } else if (!didMove && performance.now() - downTime < 300) {
        if (mode === 'edit') {
          const prop = getPropFromEvent(e);
          if (prop) selectProp(prop);
          else selectProp(null);
        }
      }
      // Reset estado de pintura (independiente de los demás drags)
      if (paintDragging) {
        paintDragging = false;
        paintLastKey = null;
      }
      // Reset estado de zone edit
      if (zoneEditDragging) {
        zoneEditDragging = false;
      }
    } else if (e.button === 2 && rightDown) {
      rightDown = false;
      if (zoneEditDragging) {
        zoneEditDragging = false;
      }
    }
  });

  // ── Wheel zoom ──
  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (typeof isCameraLocked === 'function' && isCameraLocked()) return;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    camZoom *= delta;
    camZoom = Math.max(0.3, Math.min(4, camZoom));
    updateCamera();
  }, { passive: false });

  // ── Teclado: rotación fluida con , y . , R rota mueble, Delete borra ──
  let keyLeft = false, keyRight = false;
  const ROT_STEP = 0.04;     // saltito instantáneo al primer keydown
  const ROT_SPEED = 1.6;     // rad/segundo cuando se mantiene presionado

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
      paintShiftHeld = true;
      if (mode === 'paint' && !paintDragging && !leftDown && lastMouseEvent) {
        paintPreviewKey = null;
        updatePaintPreview(lastMouseEvent);
      }
    }
    if (e.key === ',' || e.key === '<') {
      if (typeof isCameraLocked === 'function' && isCameraLocked()) return;
      if (!e.repeat) { theta -= ROT_STEP; updateCamera(); }
      keyLeft = true;
    } else if (e.key === '.' || e.key === '>') {
      if (typeof isCameraLocked === 'function' && isCameraLocked()) return;
      if (!e.repeat) { theta += ROT_STEP; updateCamera(); }
      keyRight = true;
    } else if (e.key === 'r' || e.key === 'R') {
      // placeMode tiene prioridad: rotar el template del catálogo
      if (placeMode) {
        e.preventDefault();
        rotatePlaceTemplate();
      } else {
        // Rotar el mueble draggeado (prioridad) o el seleccionado
        const target = draggedProp || selectedProp;
        if (target) { e.preventDefault(); rotateProp(target); }
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedProp) { e.preventDefault(); deletePropSelected(); }
    } else if (e.key === 'Escape') {
      // placeMode tiene prioridad
      if (placeMode) {
        exitPlaceMode();
        return;
      }
      // Después: agent drag (Two Point Hospital style — Esc cancela el agarre)
      if (isAgentDragging()) {
        endAgentDrag(false);
        return;
      }
      // Después: zone edit mode
      if (zoneEditingId !== null) {
        stopZoneEdit();
        renderRoomsList();
        return;
      }
      selectProp(null);
      if (isWallDragging) cancelWallDrag();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === ',' || e.key === '<') keyLeft = false;
    else if (e.key === '.' || e.key === '>') keyRight = false;
    else if (e.key === 'Shift') {
      paintShiftHeld = false;
      if (mode === 'paint' && !paintDragging && !leftDown && lastMouseEvent) {
        paintPreviewKey = null;
        updatePaintPreview(lastMouseEvent);
      }
    }
  });

  // ══════════════════════════════════════════════════════════════
  //  BUTTONS
  // ══════════════════════════════════════════════════════════════
  document.getElementById('btn-strokes').addEventListener('click', (e) => {
    showStrokes = !showStrokes;
    e.target.textContent = showStrokes ? 'Strokes ON' : 'Strokes OFF';
    e.target.classList.toggle('active', showStrokes);
    for (const obj of sceneObjects) {
      if (obj.userData && obj.userData.edges) obj.userData.edges.visible = showStrokes;
      if (obj instanceof THREE.GridHelper) obj.visible = showStrokes;
    }
    for (const ag of agents) {
      if (ag.mesh && ag.mesh.userData.edges) ag.mesh.userData.edges.visible = showStrokes;
    }
  });

  document.getElementById('btn-add').addEventListener('click', () => {
    trySpawnAgent();
  });

  document.getElementById('btn-pause').addEventListener('click', (e) => {
    paused = !paused;
    e.target.textContent = paused ? 'Reanudar' : 'Pausa';
    e.target.classList.toggle('active', paused);
  });

  document.getElementById('btn-add-prop').addEventListener('click', () => {
    toggleCatalog();
  });

  document.getElementById('catalog-close').addEventListener('click', closeCatalog);
  document.getElementById('catalog-random').addEventListener('click', () => {
    closeCatalog();
    const ok = spawnRandomProp();
    console.log('[catalog random]', ok ? 'OK' : 'FAILED', 'total:', props.length);
  });

  document.getElementById('btn-rm-prop').addEventListener('click', () => {
    const before = props.length;
    removeLastProp();
    console.log('[- Mueble] removed, total:', props.length, '(was', before, ')');
  });

  document.getElementById('btn-mode').addEventListener('click', (e) => {
    // Ciclo: Jugar → Mover → Construir → Pintar → Jugar
    if (mode === 'play') mode = 'edit';
    else if (mode === 'edit') mode = 'build';
    else if (mode === 'build') mode = 'paint';
    else mode = 'play';
    e.target.textContent =
      mode === 'play'  ? 'Modo: Jugar' :
      mode === 'edit'  ? 'Modo: Mover' :
      mode === 'build' ? 'Modo: Construir' :
                         'Modo: Pintar';
    e.target.classList.toggle('active', mode !== 'play');
    // Limpiar estado de modos anteriores
    if (mode !== 'edit') {
      selectProp(null);
      if (draggedProp && dragGhost) {
        scene.remove(dragGhost);
        dragGhost.geometry.dispose();
        dragGhost.material.dispose();
        dragGhost = null;
        draggedProp = null;
      }
    }
    if (mode !== 'build') {
      cancelWallDrag();
      clearWallHover();
    }
    // Mostrar/ocultar panel de pintura
    document.getElementById('paint-panel').classList.toggle('open', mode === 'paint');
    if (mode !== 'paint') clearPaintPreview();
  });

  document.getElementById('btn-walls').addEventListener('click', (e) => {
    if (wallMode === 'up') {
      wallMode = 'down'; WALL_H = WALL_H_DOWN;
      e.target.textContent = 'Walls: Down';
    } else if (wallMode === 'down') {
      wallMode = 'cutaway'; WALL_H = WALL_H_UP;
      e.target.textContent = 'Walls: Cutaway';
    } else {
      wallMode = 'up'; WALL_H = WALL_H_UP;
      e.target.textContent = 'Walls: Up';
    }
    lastCamQuadrant = '';   // forzar re-cálculo de cuadrante
    buildScene();
  });
  document.getElementById('btn-roof').addEventListener('click', () => {
    setRoofVisible(!roofVisible);
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    theta = Math.PI / 4;
    phi = Math.atan(1 / Math.sqrt(2));
    camZoom = 1;
    updateCamera();
  });

  document.getElementById('btn-build-style').addEventListener('click', (e) => {
    // Ciclo: solid → window → window-half → erase → solid…
    // Las puertas ahora son objetos (categoría 'door') que se colocan desde
    // el catálogo, no un tipo de pared.
    const order = ['solid', 'window', 'window-half', 'erase'];
    const labels = {
      'solid':       'Tipo: Pared',
      'window':      'Tipo: Ventanal',
      'window-half': 'Tipo: Ventanita',
      'erase':       'Tipo: Borrar',
    };
    const idx = order.indexOf(buildWallStyle);
    buildWallStyle = order[(idx + 1) % order.length];
    e.target.textContent = labels[buildWallStyle];
    e.target.classList.toggle('active', buildWallStyle !== 'solid');
  });

  // Paint UI ahora vive en src/ui/paint-panel.ts. Acá queda el wrapper que
  // sincroniza paintColor + dispara refresh de preview (deps a mode/leftDown
  // que siguen en legacy).
  function setPaintColor(c) {
    paintColor = c;
    syncPaintUI(c);
    if (mode === 'paint' && !paintDragging && !leftDown && lastMouseEvent) {
      paintPreviewKey = null;
      updatePaintPreview(lastMouseEvent);
    }
  }
  setOnPaintColorChange((c) => setPaintColor(c));
  initPaintPanel();
  setPaintColor(0xc6bca2);   // estado inicial: el primer swatch (beige default)

  document.getElementById('btn-reset-world').addEventListener('click', () => {
    showConfirm('¿Borrar todo el mundo guardado y volver al estado inicial?', resetWorldToDefault);
  });

  // ── Custom confirm dialog ──
  // showConfirm/showPrompt/showToast ahora en src/ui/modals.ts (init más abajo).
  // formatRelTime ahora en src/utils/format.ts.
  initModals();

  // Slots panel ahora vive en src/ui/slots-panel.ts.
  // Wire de loadSlot + saveSlot (siguen en legacy hasta extraer applyWorld).
  setOnLoadSlot((id) => loadSlot(id));
  setOnSaveSlot((name) => saveSlot(name));
  initSlotsPanel();
  // ── Persistir agentes en localStorage cuando spawnan/se borran/cambian celda ──
  // saveToStorage directo (sin debounce) para que un refresh rápido no pierda
  // los IDs recién generados — las cutscenes guardadas dependen de ellos.
  // CRÍTICO: ignoramos los agents creados por la cutscene (_csAgent=true). Esos
  // viven solo dentro del modo cutscene y no deben tocar el localStorage del mundo.
  eventBus.on('agentSpawned', ({ agent }) => {
    if (agent && agent._csAgent) return;
    saveToStorage();
  });
  eventBus.on('agentDeleted', ({ agent }) => {
    if (agent && agent._csAgent) return;
    saveToStorage();
  });
  eventBus.on('agentMoved', ({ agent }) => {
    if (agent && agent._csAgent) return;
    if (!agent._lastSavedCx || agent._lastSavedCx !== agent.cx || agent._lastSavedCy !== agent.cy) {
      agent._lastSavedCx = agent.cx;
      agent._lastSavedCy = agent.cy;
      markWorldChanged();
    }
  });

  // Rooms panel ahora vive en src/ui/rooms-panel.ts.
  initRoomsPanel({
    onMarkWorldChanged: () => markWorldChanged(),
    getZoneEditingId: () => zoneEditingId,
    onStartZoneEdit: (id) => startZoneEdit(id),
    onStopZoneEdit: () => stopZoneEdit(),
    getMinCellsForZones: () => getMinCellsForZones(),
    onSetMinCellsForZones: (n) => setMinCellsForZones(n),
  });

  // ── Resize ──
  window.addEventListener('resize', () => {
    viewW = container.clientWidth;
    viewH = container.clientHeight;
    const aspect = viewW / viewH;
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.updateProjectionMatrix();
    cinematicCamera.aspect = aspect;
    cinematicCamera.updateProjectionMatrix();
    renderer.setSize(viewW, viewH);
  });

  // ══════════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════════
  // Habitaciones cerradas: reconcile inicial + auto-recompute en cambios de pared.
  // Las zonas abiertas no necesitan recompute (son persistidas).
  let _roomsRecalcTimer = null;
  function scheduleRoomsRecalc() {
    if (_roomsRecalcTimer) clearTimeout(_roomsRecalcTimer);
    _roomsRecalcTimer = setTimeout(() => {
      reconcileRoomMeta();
      buildRoomsOverlay();
    }, 50);
  }
  reconcileRoomMeta();
  eventBus.on('wallChanged', scheduleRoomsRecalc);
  eventBus.on('worldLoaded', () => {
    reconcileRoomMeta();
    buildRoomsOverlay();
  });
  eventBus.on('zonesChanged', (payload) => {
    if (document.getElementById('rooms-panel').classList.contains('open')) {
      buildRoomsOverlay();
      // Solo re-render lista si no es un edit (edit dispara muchos events;
      // refrescaríamos el DOM mid-drag y se rompe el foco). Solo refresh en
      // create/delete que cambian la estructura.
      if (payload && payload.reason !== 'edit') {
        renderRoomsList();
      } else {
        // En edit, solo actualizar el contador de celdas inline sin re-render
        const zone = (worldGrid.zones || []).find(z => z.id === payload.zoneId);
        if (zone) {
          const cards = document.querySelectorAll(`[data-id="z:${zone.id}"]`);
          for (const el of cards) {
            const card = el.closest('.room-card');
            if (!card) continue;
            const tag = card.querySelector('.room-cells-tag');
            if (tag) tag.textContent = `${zone.cells.length}c`;
          }
        }
      }
    }
  });

  buildScene();
  updateCamera();
  buildCatalog();

  // Consumir restauración de agentes diferida (si applyWorld corrió antes de
  // que scene existiera al boot inicial).
  if (window._pendingAgentsRestore && Array.isArray(window._pendingAgentsRestore)) {
    for (const a of agents) {
      if (a.mesh) scene.remove(a.mesh);
      if (a.statusMesh) scene.remove(a.statusMesh);
    }
    agents.length = 0;
    for (const ad of window._pendingAgentsRestore) {
      spawnAgent(ad.cx, ad.cy, {
        id: ad.id, emoji: ad.emoji,
        voiceIdx: ad.voiceIdx, needs: ad.needs,
        heldItem: ad.heldItem,
      });
    }
    delete window._pendingAgentsRestore;
  }

  // Spawn 3 agentes iniciales en celdas libres random — SOLO si no hay
  // agentes ya cargados desde el save (sino sobrescribiríamos a los persistidos
  // que las cutscenes guardadas referencian).
  if (agents.length === 0) {
    trySpawnAgent();
    trySpawnAgent();
    trySpawnAgent();
  }

  let lastTime = performance.now();

  // ══════════════════════════════════════════════════════════════
  //  THOUGHT BUBBLES (estilo Tomodachi Life — confusion, ideas, etc.)
  // ══════════════════════════════════════════════════════════════
  // Burbuja amarilla con scribble negro adentro, aparece sobre la cabeza
  // del agente unos segundos. Aparece con bounce-in, mantiene, fade-out.
  // THOUGHT BUBBLES: createScribbleTexture, THOUGHT_TEXTURES, activeThoughts,
  // showAgentThought, updateThoughtBubbles ahora viven en src/thought-bubbles.ts.
  // initThoughtBubbles(scene) se invoca arriba al crear la scene.

  // LANDING ANIMATION: startLandingAnim, updateLandingAnims ahora viven en src/landing-anim.ts.


  // ══════════════════════════════════════════════════════════════
  //  CUTSCENE EDITOR (Apple-style overlay, Premiere-like timeline)
  // ══════════════════════════════════════════════════════════════
  // Modelo: cutscene = { duration, tracks: [{ agentId, keyframes: [{t, type, cx, cy}] }] }
  // Engine: cada frame, mientras editor abierto, interpola posición de agentes
  // con track según el playhead. Agentes sin track quedan parados (snapshot
  // de su posición original al abrir el editor; restaurada al cerrar).
  const ceState = {
    cutscene: {
      duration: 30,
      tracks: [],
      camera: { keyframes: [], povActive: false, parentAgentId: null },
      fx: { entities: [] },
      agents: [],   // agentes propios de la cutscene: {id, emoji, voiceIdx}
      // Paredes/techo ocultables: keyframes ordenados por t. Cada uno guarda
      // un snapshot de qué walls están escondidas y si el techo está visible.
      // Entre kfs se mantiene el último estado (sin interpolar — toggle discreto).
      // Wall id format: 'N:cx,cy' o 'W:cx,cy'.
      walls: { keyframes: [] },   // [{t, hiddenIds: [...]}]   'ROOF' incluido en hiddenIds si techo oculto
      sceneNames: {},   // legacy
      scenes: [],       // [{id, tStart, tEnd, name}] — planos en el modelo
    },
    playhead: 0,
    playing: false,
    scrubbing: false,
    open: false,
    selectedAgentId: null,
    worldAgentsBackup: null,   // refs a los agentes del mundo (ocultados durante cutscene)
    addingAgent: false,        // placement mode para "+ Nuevo Agente"
    // Set computado del estado de paredes/techo en el playhead actual.
    // NUNCA se modifica directamente: se recomputa desde walls.keyframes.
    currentHiddenIds: new Set(),
    // Timeline zoom + pan: zoom=1 muestra duración entera; zoom=N muestra duración/N.
    // scrollX en pixels (0 = inicio, max = (duration_total_w - viewport_w))
    zoom: 1,
    scrollX: 0,
    // Modo tijera para cortar planos
    scissorsMode: false,
    // Snap entre planos al arrastrar/redimensionar (toggleable)
    snapEnabled: true,
    // Stack para undo (Cmd+Z) — snapshots JSON antes de cada acción discreta
    undoStack: [],
    redoStack: [],
    applyOnce: false,
    selectedKf: null,
    draggingKf: null,
    selectedKfIsCamera: false,
    selectedKfIsFx: false,
    selectedKfIsWalls: false,
    selectedFxEntityIdx: -1,
    // Selección múltiple (lasso): planos y kfs seleccionados como grupo
    multiSel: { scenes: [], kfs: [] },   // kfs: [{kind, trackIdx, fxEntityIdx, kfIdx}]
    lassoDrag: null,    // {startX, startY, currX, currY, started}
  };

  // Animaciones presets (efectos visuales temporales sobre el agente)
  const CE_ANIM_PRESETS = {
    wave:    { duration: 1.0,  label: '👋 Wave' },
    excited: { duration: 1.5,  label: '⚡ Excited' },
    idle:    { duration: 0.5,  label: '😴 Idle' },
    spin:    { duration: 1.2,  label: '🌀 Spin' },
  };
  function ceApplyAnimEffect(agent, preset, progress) {
    if (preset === 'wave') {
      agent.hopHeight = 18 + Math.sin(progress * Math.PI) * 30;
      agent.hopFreq = 5.5;
      agent.hopping = true;
      agent.hopTime += 0.12;
    } else if (preset === 'excited') {
      agent.hopHeight = 14;
      agent.hopFreq = 11;
      agent.hopping = true;
      agent.hopTime += 0.15;
    } else if (preset === 'idle') {
      agent.hopping = false;
    } else if (preset === 'spin') {
      const flipPeriod = 0.18;
      const idx = Math.floor(progress * (1.2 / flipPeriod));
      const dir = idx % 2 === 0 ? 'right' : 'left';
      if (typeof setAgentFacing === 'function' && agent.facing !== dir) {
        setAgentFacing(agent, dir);
      }
      agent.hopping = false;
    }
  }
  function ceResetAgentAnim(agent) {
    agent.hopHeight = 7;
    agent.hopFreq = 5.5;
  }

  // ══════════════════════════════════════════════════════════════
  //  FX KEYFRAMES — sprites de partículas + luz
  // ══════════════════════════════════════════════════════════════
  const FX_PRESETS = {
    smoke:  { duration: 3.0, color1: 'rgba(180,180,180,0.95)', color2: 'rgba(40,40,40,0)',    size: 90,  rise: 100, pulse: 0.20, count: 3 },
    fire:   { duration: 3.0, color1: 'rgba(255,220,80,1)',     color2: 'rgba(255,40,0,0)',     size: 110, rise: 50,  pulse: 0.55, count: 4 },
    sparks: { duration: 1.5, color1: 'rgba(255,255,200,1)',    color2: 'rgba(255,180,40,0)',   size: 60,  rise: 30,  pulse: 0.85, count: 6 },
    light:  { duration: 4.0, color1: 'rgba(255,240,180,1)',    color2: 'rgba(255,180,80,0)',   size: 200, rise: 0,   pulse: 0.20, count: 1, addLight: true },
  };

  const _fxTexCache = {};
  function makeFxTexture(kind) {
    if (_fxTexCache[kind]) return _fxTexCache[kind];
    const preset = FX_PRESETS[kind];
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 60);
    grad.addColorStop(0, preset.color1);
    grad.addColorStop(0.5, preset.color1.replace(/[0-9.]+\)$/, '0.65)'));
    grad.addColorStop(1, preset.color2);
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    if (kind === 'sparks' || kind === 'light') {
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = preset.color1;
      g.lineWidth = 3;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        g.beginPath();
        g.moveTo(64, 64);
        g.lineTo(64 + Math.cos(ang) * 56, 64 + Math.sin(ang) * 56);
        g.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    _fxTexCache[kind] = tex;
    return tex;
  }

  const _activeFxInstances = new Map();
  function spawnFxInstance(kf) {
    const preset = FX_PRESETS[kf.fx];
    if (!preset) return null;
    const tex = makeFxTexture(kf.fx);
    const sprites = [];
    for (let i = 0; i < preset.count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
        // NormalBlending — partículas se ven sobre cualquier fondo
      });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(preset.size, preset.size, 1);
      sp.position.y = -1000;     // off-screen hasta el primer update
      mat.opacity = 0.01;
      sp.userData = {
        offsetX: (Math.random() - 0.5) * 20,
        offsetZ: (Math.random() - 0.5) * 20,
        phase: Math.random() * Math.PI * 2,
        baseSize: preset.size,
      };
      scene.add(sp);
      sprites.push(sp);
    }
    let light = null;
    if (preset.addLight) {
      light = new THREE.PointLight(0xffd0a0, 1.5, 280, 2);
      scene.add(light);
    }
    return { sprites, light };
  }
  function despawnFxInstance(inst) {
    if (!inst) return;
    for (const sp of inst.sprites) {
      if (sp.material && sp.material.map) {/* no dispose tex (cached) */}
      if (sp.material) sp.material.dispose();
      scene.remove(sp);
    }
    if (inst.light) scene.remove(inst.light);
  }
  function updateFxInstance(kf, inst, progress) {
    const preset = FX_PRESETS[kf.fx];
    if (!preset || !inst) return;
    // Posición target
    let wx = 0, wz = 0, wy = 4;
    if (kf.target && kf.target.kind === 'agent') {
      const a = agents.find(x => x.id === kf.target.id);
      if (a) {
        wx = a.px * CELL - centerX;
        wz = a.py * CELL - centerZ;
        wy = 30;   // sobre el agente
      }
    } else if (kf.target && kf.target.kind === 'cell') {
      wx = (kf.target.cx + 0.5) * CELL - centerX;
      wz = (kf.target.cy + 0.5) * CELL - centerZ;
      wy = 4;
    }
    // Evolution
    const fadeIn  = Math.min(1, progress * 8);          // primeros 0-12.5%
    const fadeOut = Math.min(1, (1 - progress) * 4);    // últimos 25%
    const alpha = Math.max(0, Math.min(1, fadeIn * fadeOut));
    const elapsed = progress * preset.duration;
    for (let i = 0; i < inst.sprites.length; i++) {
      const sp = inst.sprites[i];
      const ud = sp.userData;
      const t = elapsed + ud.phase;
      const upY = wy + (preset.rise * progress) + Math.sin(t * 2.5) * 4;
      const sway = Math.sin(t * 1.7 + i) * 6;
      sp.position.set(wx + ud.offsetX + sway, upY + i * 14, wz + ud.offsetZ);
      const pulse = 1 + Math.sin(t * (kf.fx === 'fire' ? 7 : 3)) * preset.pulse;
      const flicker = (kf.fx === 'sparks') ? (0.5 + 0.5 * Math.sin(t * 18 + i)) : 1;
      sp.scale.set(ud.baseSize * pulse, ud.baseSize * pulse, 1);
      sp.material.opacity = alpha * flicker;
      sp.material.rotation = t * 0.4 * (i % 2 === 0 ? 1 : -1);
    }
    if (inst.light) {
      inst.light.position.set(wx, wy + 40, wz);
      inst.light.intensity = 1.5 + Math.sin(elapsed * 6) * 0.5;
      inst.light.intensity *= alpha;
    }
  }
  function ceClearAllFx() {
    for (const inst of _activeFxInstances.values()) despawnFxInstance(inst);
    _activeFxInstances.clear();
  }
  // ID generador para entidades FX
  function ceFxNewId() {
    return 'fx_' + Math.random().toString(36).slice(2, 8);
  }
  // Interpolación entre dos targets (cell-cell smooth, otros snap)
  function ceFxInterpolateTarget(t1, t2, lerp) {
    if (!t1) return t2;
    if (!t2) return t1;
    if (t1.kind === 'cell' && t2.kind === 'cell') {
      return {
        kind: 'cell',
        cx: t1.cx + (t2.cx - t1.cx) * lerp,
        cy: t1.cy + (t2.cy - t1.cy) * lerp,
      };
    }
    return lerp < 0.5 ? t1 : t2;
  }
  // Migra modelo viejo (fx.keyframes) → nuevo (fx.entities)
  function ceFxMigrateModel(cutscene) {
    if (!cutscene.fx) cutscene.fx = { entities: [] };
    if (cutscene.fx.keyframes && !cutscene.fx.entities) {
      cutscene.fx.entities = cutscene.fx.keyframes.map(kf => ({
        id: ceFxNewId(),
        kind: kf.fx || 'smoke',
        duration: kf.duration || 3.0,
        keyframes: [{ t: kf.t, target: kf.target }],
      }));
      delete cutscene.fx.keyframes;
    }
    if (!cutscene.fx.entities) cutscene.fx.entities = [];
  }

  const ceEditor = document.getElementById('cutscene-editor');
  const ceTimeline = document.getElementById('ce-timeline');
  const ceRuler = document.getElementById('ce-ruler');
  const ceTracks = document.getElementById('ce-tracks');
  const cePlayhead = document.getElementById('ce-playhead');
  const ceAgentSelect = document.getElementById('ce-agent-select');
  const ceTypeSelect = document.getElementById('ce-type-select');
  const ceTextInput = document.getElementById('ce-text-input');
  const ceAnimSelect = document.getElementById('ce-anim-select');
  const ceDurationInput = document.getElementById('ce-duration-input');
  const ceDurationLabel = document.getElementById('ce-duration-label');
  const ceParentSelect = document.getElementById('ce-parent-select');
  const ceParentLabel = document.getElementById('ce-parent-label');
  const ceCutCheckbox = document.getElementById('ce-cut-checkbox');
  const ceCutLabel = document.getElementById('ce-cut-label');
  const ceTransSelect = document.getElementById('ce-trans-select');
  const ceTransDurInput = document.getElementById('ce-trans-dur');
  const ceFxSelect = document.getElementById('ce-fx-select');
  const cePinCheckbox = document.getElementById('ce-pin-checkbox');
  const cePinLabel = document.getElementById('ce-pin-label');
  const cePovToggle = document.getElementById('ce-pov-toggle');
  const ceAspectSelect = document.getElementById('ce-aspect-select');
  const ceSavedSelect = document.getElementById('ce-saved-select');
  const ceSaveBtn = document.getElementById('ce-save-btn');
  const ceNewBtn = document.getElementById('ce-new-btn');
  const ceDeleteCsBtn = document.getElementById('ce-delete-cs-btn');
  const ceDeleteBtn = document.getElementById('ce-delete-kf');
  const cePlayBtn = document.getElementById('ce-play');
  const ceTimeCurrent = document.getElementById('ce-time-current');
  const ceTimeTotal = document.getElementById('ce-time-total');

  function ceUpdateToolbarFields() {
    let activeType = ceTypeSelect.value;
    let selectedKf = null;
    if (ceState.selectedKf) {
      if (ceState.selectedKfIsCamera) {
        selectedKf = ceState.cutscene.camera.keyframes[ceState.selectedKf.kfIdx];
        if (selectedKf) activeType = 'camera';
      } else {
        const tr = ceState.cutscene.tracks[ceState.selectedKf.trackIdx];
        selectedKf = tr && tr.keyframes[ceState.selectedKf.kfIdx];
        if (selectedKf) activeType = selectedKf.type;
      }
    }
    ceTextInput.style.display     = (activeType === 'speak') ? '' : 'none';
    ceAnimSelect.style.display    = (activeType === 'animation') ? '' : 'none';
    ceDurationInput.style.display = (activeType === 'animation' || activeType === 'fx') ? '' : 'none';
    ceDurationLabel.style.display = (activeType === 'animation' || activeType === 'fx') ? '' : 'none';
    ceParentSelect.style.display  = (activeType === 'camera') ? '' : 'none';
    ceParentLabel.style.display   = (activeType === 'camera') ? '' : 'none';
    ceCutLabel.style.display      = (activeType === 'camera') ? '' : 'none';
    // Transition select: visible cuando tipo=camera Y (cut está marcado o el kf seleccionado tiene cut)
    const showTrans = (activeType === 'camera') && (
      (selectedKf && selectedKf.cut) || (!selectedKf && ceCutCheckbox.checked)
    );
    ceTransSelect.style.display   = showTrans ? '' : 'none';
    // Trans duration: visible solo si la transición no es 'none'
    const transValue = showTrans
      ? (selectedKf ? (selectedKf.transition || 'none') : ceTransSelect.value)
      : 'none';
    ceTransDurInput.style.display = (showTrans && transValue !== 'none') ? '' : 'none';
    ceFxSelect.style.display      = (activeType === 'fx') ? '' : 'none';
    cePinLabel.style.display      = (activeType === 'fx') ? '' : 'none';
    const ceNewFxBtn = document.getElementById('ce-new-fx');
    if (ceNewFxBtn) ceNewFxBtn.style.display = (activeType === 'fx') ? '' : 'none';
    // Walls UI: solo botón de techo + body class para activar cursor crosshair
    const ceWallsRoofBtn = document.getElementById('ce-walls-roof');
    const ceWallsRestoreBtn = document.getElementById('ce-walls-restore');
    if (ceWallsRoofBtn) ceWallsRoofBtn.style.display = (activeType === 'walls') ? '' : 'none';
    if (ceWallsRestoreBtn) ceWallsRestoreBtn.style.display = (activeType === 'walls') ? '' : 'none';
    if (activeType === 'walls') {
      document.body.classList.add('cs-walls-mode');
    } else {
      document.body.classList.remove('cs-walls-mode');
    }
    // Mostrar gizmo cámara solo cuando type=camera
    if (typeof setCameraGizmoVisible === 'function') {
      setCameraGizmoVisible(activeType === 'camera' && ceState.open);
    }
    const ceCamResetBtn = document.getElementById('ce-cam-reset');
    if (ceCamResetBtn) ceCamResetBtn.style.display = (activeType === 'camera') ? '' : 'none';
    const ceCamLensGroup = document.getElementById('ce-cam-lens-group');
    if (ceCamLensGroup) ceCamLensGroup.style.display = (activeType === 'camera') ? 'inline-flex' : 'none';
    if (activeType === 'camera') ceRefreshParentSelect();
    if (selectedKf) {
      if (selectedKf.type === 'speak' && document.activeElement !== ceTextInput) {
        ceTextInput.value = selectedKf.text || '';
      }
      if (selectedKf.type === 'animation') {
        if (document.activeElement !== ceAnimSelect) ceAnimSelect.value = selectedKf.preset || 'wave';
        if (document.activeElement !== ceDurationInput) {
          ceDurationInput.value = (selectedKf.duration ?? CE_ANIM_PRESETS[selectedKf.preset || 'wave'].duration).toFixed(1);
        }
      }
      if (selectedKf.type === 'camera' && document.activeElement !== ceCutCheckbox) {
        ceCutCheckbox.checked = !!selectedKf.cut;
      }
      if (selectedKf.type === 'camera' && document.activeElement !== ceTransSelect) {
        ceTransSelect.value = selectedKf.transition || 'none';
      }
      if (selectedKf.type === 'camera' && document.activeElement !== ceTransDurInput) {
        ceTransDurInput.value = (selectedKf.transitionDuration || 0.5).toFixed(1);
      }
      if (selectedKf.type === 'fx') {
        if (document.activeElement !== ceFxSelect) ceFxSelect.value = selectedKf.fx || 'smoke';
        if (document.activeElement !== ceDurationInput) {
          ceDurationInput.value = (selectedKf.duration ?? FX_PRESETS[selectedKf.fx || 'smoke'].duration).toFixed(1);
        }
        if (document.activeElement !== cePinCheckbox) {
          cePinCheckbox.checked = !!(selectedKf.target && selectedKf.target.kind === 'cell');
        }
      }
    } else if (activeType === 'camera' && document.activeElement !== ceCutCheckbox) {
      ceCutCheckbox.checked = false;
    }
  }

  function ceRefreshParentSelect() {
    const cur = ceState.cutscene.camera.parentAgentId || '';
    ceParentSelect.innerHTML = '';
    const optNone = document.createElement('option');
    optNone.value = ''; optNone.textContent = '— sin parent —';
    ceParentSelect.appendChild(optNone);
    for (const agent of agents) {
      const opt = document.createElement('option');
      opt.value = agent.id;
      opt.textContent = `${agent.emoji || ''} ${String(agent.id).slice(-3)}`;
      ceParentSelect.appendChild(opt);
    }
    ceParentSelect.value = cur;
  }
  ceParentSelect.addEventListener('change', () => {
    ceState.cutscene.camera.parentAgentId = ceParentSelect.value || null;
    ceState.applyOnce = true;
  });
  ceCutCheckbox.addEventListener('change', () => {
    if (!ceState.selectedKf || !ceState.selectedKfIsCamera) {
      // UX: al marcar cut sin kf seleccionado, default trans a 'fade'
      if (ceCutCheckbox.checked && ceTransSelect.value === 'none') {
        ceTransSelect.value = 'fade';
      }
      ceUpdateToolbarFields();
      return;
    }
    const kf = ceState.cutscene.camera.keyframes[ceState.selectedKf.kfIdx];
    if (kf) {
      kf.cut = ceCutCheckbox.checked;
      // UX: si activás cut y la trans era 'none', default a 'fade'
      if (kf.cut && (!kf.transition || kf.transition === 'none')) {
        kf.transition = 'fade';
        if (!kf.transitionDuration) kf.transitionDuration = 0.5;
      }
      ceRenderTracks();
      ceUpdateToolbarFields();
      ceState.applyOnce = true;
    }
  });
  ceTransSelect.addEventListener('change', () => {
    if (ceState.selectedKf && ceState.selectedKfIsCamera) {
      const kf = ceState.cutscene.camera.keyframes[ceState.selectedKf.kfIdx];
      if (kf) { kf.transition = ceTransSelect.value; ceState.applyOnce = true; }
    }
    ceUpdateToolbarFields();
  });
  ceTransDurInput.addEventListener('input', () => {
    if (!ceState.selectedKf || !ceState.selectedKfIsCamera) return;
    const kf = ceState.cutscene.camera.keyframes[ceState.selectedKf.kfIdx];
    if (!kf) return;
    const v = parseFloat(ceTransDurInput.value);
    if (!isNaN(v) && v > 0) { kf.transitionDuration = v; ceState.applyOnce = true; }
  });
  ceFxSelect.addEventListener('change', () => {
    if (!ceState.selectedKf || !ceState.selectedKfIsFx) return;
    const kf = ceState.cutscene.fx.keyframes[ceState.selectedKf.kfIdx];
    if (kf) {
      kf.fx = ceFxSelect.value;
      // Despawn instance to re-spawn with new kind
      const inst = _activeFxInstances.get(kf);
      if (inst) { despawnFxInstance(inst); _activeFxInstances.delete(kf); }
      ceRenderTracks(); ceState.applyOnce = true;
    }
  });
  cePinCheckbox.addEventListener('change', () => {
    if (!ceState.selectedKf || !ceState.selectedKfIsFx) return;
    const kf = ceState.cutscene.fx.keyframes[ceState.selectedKf.kfIdx];
    if (!kf) return;
    if (cePinCheckbox.checked) {
      // Convertir a celda — usar la celda del agente actual o (3,3)
      const ag = ceState.selectedAgentId
        ? agents.find(a => a.id === ceState.selectedAgentId) : agents[0];
      if (ag) kf.target = { kind: 'cell', cx: ag.cx, cy: ag.cy };
      else    kf.target = { kind: 'cell', cx: 3, cy: 3 };
    } else {
      const ag = ceState.selectedAgentId
        ? agents.find(a => a.id === ceState.selectedAgentId) : agents[0];
      if (ag) kf.target = { kind: 'agent', id: ag.id };
    }
    ceRenderTracks(); ceState.applyOnce = true;
  });

  ceTypeSelect.addEventListener('change', () => {
    // UX: cuando seleccionás FX, default pin-floor=true (lo más común es ponerlo
    // en una celda específica) — y solo desmarcalo si querés que siga a un agente.
    if (ceTypeSelect.value === 'fx' && !cePinCheckbox.checked) {
      cePinCheckbox.checked = true;
    }
    ceUpdateToolbarFields();
  });
  ceUpdateToolbarFields();

  // Edición en vivo del kf seleccionado al cambiar inputs
  ceTextInput.addEventListener('input', () => {
    if (!ceState.selectedKf) return;
    const tr = ceState.cutscene.tracks[ceState.selectedKf.trackIdx];
    const kf = tr && tr.keyframes[ceState.selectedKf.kfIdx];
    if (kf && kf.type === 'speak') { kf.text = ceTextInput.value; ceRenderTracks(); }
  });
  ceAnimSelect.addEventListener('change', () => {
    if (!ceState.selectedKf) return;
    const tr = ceState.cutscene.tracks[ceState.selectedKf.trackIdx];
    const kf = tr && tr.keyframes[ceState.selectedKf.kfIdx];
    if (kf && kf.type === 'animation') { kf.preset = ceAnimSelect.value; ceRenderTracks(); }
  });
  ceDurationInput.addEventListener('input', () => {
    if (!ceState.selectedKf) return;
    const tr = ceState.cutscene.tracks[ceState.selectedKf.trackIdx];
    const kf = tr && tr.keyframes[ceState.selectedKf.kfIdx];
    if (kf && kf.type === 'animation') {
      const d = parseFloat(ceDurationInput.value);
      if (!isNaN(d) && d > 0) { kf.duration = d; ceRenderTracks(); }
    }
  });

  function ceFormatTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const tenth = Math.floor((t * 10) % 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenth}`;
  }
  function ceUpdateTimeDisplay() {
    ceTimeCurrent.textContent = ceFormatTime(ceState.playhead);
    ceTimeTotal.textContent = ceFormatTime(ceState.cutscene.duration);
  }
  function ceUpdatePlayButton() {
    if (ceState.playing) {
      cePlayBtn.textContent = '⏸';
      cePlayBtn.classList.add('playing');
    } else {
      cePlayBtn.textContent = '▶';
      cePlayBtn.classList.remove('playing');
    }
  }

  // Track-area width (excluyendo el label de 110px)
  function ceTrackAreaWidth() {
    const tl = ceTracks.querySelector('.ce-track-area');
    if (tl) return tl.getBoundingClientRect().width;
    // Fallback: timeline width minus label width
    return Math.max(100, ceTimeline.clientWidth - 110);
  }
  function ceRulerWidth() {
    return Math.max(100, ceTimeline.clientWidth - 110);
  }
  function ceTimeToPixel(t, w) {
    // w = viewport width (visible). El "ancho total" virtual es w * zoom.
    const totalW = w * (ceState.zoom || 1);
    const px = (t / ceState.cutscene.duration) * totalW;
    return px - (ceState.scrollX || 0);
  }
  function cePixelToTime(px, w) {
    const totalW = w * (ceState.zoom || 1);
    const realPx = px + (ceState.scrollX || 0);
    return Math.max(0, Math.min(ceState.cutscene.duration, (realPx / totalW) * ceState.cutscene.duration));
  }
  // Clamp scrollX para que no exceda los límites
  function ceClampScroll() {
    const w = ceRulerWidth();
    const totalW = w * (ceState.zoom || 1);
    const maxScroll = Math.max(0, totalW - w);
    ceState.scrollX = Math.max(0, Math.min(maxScroll, ceState.scrollX || 0));
  }

  // Sync indicador visual de zoom (text + click reset)
  function ceUpdateZoomIndicator() {
    const ind = document.getElementById('ce-zoom-indicator');
    if (!ind) return;
    const pct = Math.round((ceState.zoom || 1) * 100);
    ind.textContent = '🔍 ' + pct + '%';
  }

  function ceUpdatePlayheadPosition() {
    const labelW = 110;
    const w = ceRulerWidth();
    const pxRel = ceTimeToPixel(ceState.playhead, w);
    cePlayhead.style.left = `${labelW + pxRel}px`;
    // Ocultar visualmente si está fuera del viewport scrolleado
    if (pxRel < -10 || pxRel > w + 10) {
      cePlayhead.style.opacity = '0.25';
    } else {
      cePlayhead.style.opacity = '';
    }
  }

  function ceRenderRuler() {
    ceUpdateZoomIndicator();
    const w = ceRulerWidth();
    const labelW = 110;
    ceRuler.innerHTML = '';
    ceRuler.style.paddingLeft = `${labelW}px`;
    // Densidad de marcas según zoom: si zoom alto, mostrar marcas más finas.
    // Calculamos el step minor en seconds para que las marcas no se aglomeren.
    const z = ceState.zoom || 1;
    let minorStep = 1;     // 1s
    let majorStep = 5;     // 5s
    if (z >= 4)  { minorStep = 0.25; majorStep = 1; }
    else if (z >= 2) { minorStep = 0.5; majorStep = 2; }
    else if (z < 0.5) { minorStep = 2; majorStep = 10; }
    const dur = ceState.cutscene.duration;
    for (let s = 0; s <= dur + 0.001; s += minorStep) {
      const sRounded = Math.round(s * 1000) / 1000;
      const isMajor = (Math.abs(sRounded % majorStep) < 0.01) || (Math.abs((sRounded % majorStep) - majorStep) < 0.01);
      const px = labelW + ceTimeToPixel(sRounded, w);
      // Skip marcas fuera del viewport (optimización)
      if (px < labelW - 20 || px > labelW + w + 20) continue;
      const mark = document.createElement('div');
      mark.className = isMajor ? 'ce-ruler-mark' : 'ce-ruler-mark minor';
      mark.style.left = `${px}px`;
      ceRuler.appendChild(mark);
      if (isMajor) {
        const lbl = document.createElement('div');
        lbl.className = 'ce-ruler-label';
        lbl.style.left = `${px}px`;
        lbl.textContent = ceFormatTime(sRounded);
        ceRuler.appendChild(lbl);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  PLANOS (scenes / clips) — entidades en cutscene.scenes
  // ══════════════════════════════════════════════════════════════
  // Modelo: cutscene.scenes = [{ id, tStart, tEnd, name }]
  // - tStart < tEnd
  // - Pueden tener gaps entre planos (durante play, gap = pantalla negra)
  // - Pueden solaparse temporalmente (raro pero posible)
  // - Los kfs viven en el timeline absoluto. Caen en algún plano según su t.
  // - Si un kf cae fuera de cualquier plano (zona muerta) → no se reproduce.

  function ceNewSceneId() { return 'sc_' + Math.random().toString(36).slice(2, 8); }

  // Devuelve los planos ordenados por tStart. Si el modelo está vacío,
  // crea automáticamente un plano default cubriendo toda la duración
  // (defensa de último recurso para evitar pantalla negra total).
  function ceComputeScenes() {
    if (!ceState.cutscene.scenes) ceState.cutscene.scenes = [];
    if (ceState.cutscene.scenes.length === 0) {
      ceState.cutscene.scenes.push({
        id: ceNewSceneId(),
        tStart: 0,
        tEnd: ceState.cutscene.duration,
        name: '',
        inheritState: false,
      });
    }
    const sorted = ceState.cutscene.scenes
      .slice()
      .sort((a, b) => a.tStart - b.tStart);
    // ── Defensivo: el primer plano por tStart no puede heredar (no hay nada antes) ──
    if (sorted.length > 0 && sorted[0].inheritState) {
      sorted[0].inheritState = false;
      sorted[0].escenaRootId = sorted[0].id;
    }
    // ── Asegurar consistencia de escenaRootId ──
    // (defensivo: si algún plano lo perdió, regenerarlo)
    {
      let currentRoot = null;
      for (const sc of sorted) {
        if (!sc.inheritState) {
          currentRoot = sc.id;
          if (sc.escenaRootId !== sc.id) sc.escenaRootId = sc.id;
        } else if (!sc.escenaRootId) {
          sc.escenaRootId = currentRoot || sc.id;
        }
      }
    }
    // ── Asignar sceneNum (por escenaRootId, en orden de primera aparición temporal) ──
    const rootToSceneNum = new Map();
    let nextSceneNum = 0;
    for (const sc of sorted) {
      const root = sc.escenaRootId || sc.id;
      if (!rootToSceneNum.has(root)) {
        nextSceneNum++;
        rootToSceneNum.set(root, nextSceneNum);
      }
    }
    // ── Asignar planoNum dentro de cada escena (por orden temporal entre planos del mismo root) ──
    const planoCounter = new Map();
    return sorted.map((sc, i) => {
      const root = sc.escenaRootId || sc.id;
      const sceneNum = rootToSceneNum.get(root);
      const planoNum = (planoCounter.get(root) || 0) + 1;
      planoCounter.set(root, planoNum);
      return {
        ...sc,
        idx: i,
        duration: sc.tEnd - sc.tStart,
        sceneNum,
        planoNum,
        displayName: sc.name && sc.name.trim() ? sc.name : `Plano ${planoNum}`,
      };
    });
  }

  // Migración: si la cutscene no tiene scenes en el modelo, generarlas
  // desde los cuts del track de cámara (compatibilidad con cutscenes viejas).
  function ceEnsureScenesInModel() {
    if (!ceState.cutscene.scenes || ceState.cutscene.scenes.length === 0) {
      const cam = ceState.cutscene.camera;
      const dur = ceState.cutscene.duration;
      const cutTimes = [0];
      for (const kf of (cam.keyframes || [])) {
        if (kf.cut && kf.t > 0.001 && kf.t < dur - 0.001) {
          if (!cutTimes.some(t => Math.abs(t - kf.t) < 0.05)) cutTimes.push(kf.t);
        }
      }
      cutTimes.sort((a, b) => a - b);
      const scenes = [];
      const namesMap = (ceState.cutscene.sceneNames) || {};
      for (let i = 0; i < cutTimes.length; i++) {
        const tStart = cutTimes[i];
        const tEnd = (i < cutTimes.length - 1) ? cutTimes[i + 1] : dur;
        const nameKey = tStart.toFixed(2);
        scenes.push({
          id: ceNewSceneId(),
          tStart, tEnd,
          name: namesMap[nameKey] || '',
          inheritState: i > 0,
        });
      }
      if (scenes.length === 0) {
        scenes.push({ id: ceNewSceneId(), tStart: 0, tEnd: dur, name: '', inheritState: false });
      }
      ceState.cutscene.scenes = scenes;
    }
    // Asegurar que cada plano tenga inheritState (default true salvo el primero por tStart)
    {
      const sorted = (ceState.cutscene.scenes || []).slice().sort((a, b) => a.tStart - b.tStart);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].inheritState === undefined) sorted[i].inheritState = (i > 0);
      }
    }
    // ── escenaRootId: identifica el grupo "escena" de cada plano de manera estable ──
    // Inherit=false → este plano es root: escenaRootId = self.id.
    // Inherit=true → escenaRootId del plano anterior temporalmente (al momento de creación).
    // Una vez asignado, NO cambia al mover el plano (la escena es identidad estable,
    // no derivada del orden temporal actual).
    {
      const sorted = (ceState.cutscene.scenes || []).slice().sort((a, b) => a.tStart - b.tStart);
      let currentRoot = null;
      for (const sc of sorted) {
        if (!sc.inheritState) {
          currentRoot = sc.id;
          if (!sc.escenaRootId) sc.escenaRootId = sc.id;
        } else {
          if (!sc.escenaRootId) sc.escenaRootId = currentRoot || sc.id;
        }
        // Mantener consistencia: si inherit=false, root es siempre self
        if (!sc.inheritState && sc.escenaRootId !== sc.id) sc.escenaRootId = sc.id;
      }
    }
    ceMigrateKfsToScenes();
  }

  // Iterar todos los kfs (cámara, walls, fx, agentes) y asignarles sceneId
  // si no lo tienen (kfs viejos pre-modelo).
  function ceMigrateKfsToScenes() {
    const ownerOf = (t) => {
      const sc = (ceState.cutscene.scenes || []).find(s => t >= s.tStart - 0.001 && t < s.tEnd - 0.001);
      return sc ? sc.id : null;
    };
    const fix = (kf) => { if (kf.sceneId === undefined) kf.sceneId = ownerOf(kf.t); };
    const cam = ceState.cutscene.camera;
    if (cam && cam.keyframes) cam.keyframes.forEach(fix);
    if (ceState.cutscene.walls && ceState.cutscene.walls.keyframes) {
      ceState.cutscene.walls.keyframes.forEach(fix);
    }
    if (ceState.cutscene.fx && ceState.cutscene.fx.entities) {
      for (const ent of ceState.cutscene.fx.entities) {
        if (ent.keyframes) ent.keyframes.forEach(fix);
      }
    }
    for (const tr of (ceState.cutscene.tracks || [])) {
      if (tr.keyframes) tr.keyframes.forEach(fix);
    }
  }

  // Asigna sceneId a un kf según el plano que contiene su t (si lo hay).
  function ceAssignSceneIdToKf(kf) {
    const sc = ceSceneAt(kf.t);
    kf.sceneId = sc ? sc.id : null;
    return kf;
  }

  // Reasigna sceneId a kfs cuyo t cae en [tA, tB) (usado al dividir un plano
  // con tijera: la mitad derecha pasa al nuevo plano).
  function ceReassignKfsByTime(tA, tB, newSceneId) {
    const inR = (t) => t >= tA - 0.001 && t < tB - 0.001;
    const cam = ceState.cutscene.camera;
    if (cam && cam.keyframes) {
      for (const k of cam.keyframes) if (inR(k.t)) k.sceneId = newSceneId;
    }
    if (ceState.cutscene.walls && ceState.cutscene.walls.keyframes) {
      for (const k of ceState.cutscene.walls.keyframes) if (inR(k.t)) k.sceneId = newSceneId;
    }
    if (ceState.cutscene.fx && ceState.cutscene.fx.entities) {
      for (const ent of ceState.cutscene.fx.entities) {
        if (ent.keyframes) for (const k of ent.keyframes) if (inR(k.t)) k.sceneId = newSceneId;
      }
    }
    for (const tr of (ceState.cutscene.tracks || [])) {
      if (tr.keyframes) for (const k of tr.keyframes) if (inR(k.t)) k.sceneId = newSceneId;
    }
  }

  // Renombra plano por id
  function ceRenameScene(sceneId, newName) {
    const sc = (ceState.cutscene.scenes || []).find(s => s.id === sceneId);
    if (sc) sc.name = newName;
  }

  // Buscar el plano que contiene t (o null si t cae en gap).
  // Si hay solapamientos, devuelve el primero que contenga t (menor tStart).
  function ceSceneAt(t) {
    const scenes = ceComputeScenes();
    for (const sc of scenes) {
      if (t >= sc.tStart && t < sc.tEnd) return sc;
    }
    return null;
  }

  // Inserta un cut en t (corte tijera). Divide el plano que contiene t en 2
  // planos contiguos (sin gap inicial — el usuario después puede crear gap).
  // ── Popover de plano (rename + toggle inherit) ──
  let _ceScenePopover = null;
  function ceOpenScenePopover(scene, blockEl) {
    if (_ceScenePopover) { _ceScenePopover.remove(); _ceScenePopover = null; }
    const rect = blockEl.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'ce-scene-popover';
    pop.style.cssText =
      `position:fixed; z-index:1600; ` +
      `left:${rect.left}px; top:${rect.top - 90}px; ` +
      `background:rgba(28, 26, 28, 0.96); ` +
      `border:1px solid rgba(255,255,255,0.12); ` +
      `border-radius:10px; padding:10px 12px; ` +
      `box-shadow:0 8px 28px rgba(0,0,0,0.55); ` +
      `backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); ` +
      `display:flex; flex-direction:column; gap:8px; min-width:230px; ` +
      `font-size:11px; color:rgba(255,255,255,0.9); user-select:none;`;
    // Rename input
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex; align-items:center; gap:6px;';
    const nameLbl = document.createElement('span');
    nameLbl.textContent = 'Nombre:';
    nameLbl.style.cssText = 'opacity:0.65; font-size:10.5px;';
    const nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.value = scene.name || '';
    nameInp.placeholder = `Plano ${scene.planoNum || ''}`.trim();
    nameInp.style.cssText =
      'flex:1; background:rgba(255,255,255,0.06); ' +
      'border:0.5px solid rgba(255,255,255,0.18); border-radius:5px; ' +
      'color:#fff; padding:4px 7px; font-size:11px; font-family:inherit;';
    nameRow.appendChild(nameLbl);
    nameRow.appendChild(nameInp);
    pop.appendChild(nameRow);
    // Toggle inherit (no aplica al primer plano)
    const isFirst = (() => {
      const sorted = (ceState.cutscene.scenes || []).slice().sort((a, b) => a.tStart - b.tStart);
      return sorted[0] && sorted[0].id === scene.id;
    })();
    if (!isFirst) {
      const inhRow = document.createElement('label');
      inhRow.style.cssText = 'display:flex; align-items:center; gap:8px; cursor:pointer;';
      const inhCheck = document.createElement('input');
      inhCheck.type = 'checkbox';
      inhCheck.checked = scene.inheritState !== false;
      inhCheck.style.cssText = 'cursor:pointer;';
      const inhLbl = document.createElement('span');
      inhLbl.innerHTML = '🔁 Heredar estado del plano anterior <span style="opacity:0.55; font-size:10px;">(continuidad)</span>';
      inhRow.appendChild(inhCheck);
      inhRow.appendChild(inhLbl);
      pop.appendChild(inhRow);
      const inhHelp = document.createElement('div');
      inhHelp.style.cssText = 'font-size:10px; opacity:0.55; line-height:1.4;';
      inhHelp.textContent =
        'Activado: continúa la narrativa del plano anterior (agentes, walls, cámara). ' +
        'Desactivado: corte de escena — todo arranca fresh.';
      pop.appendChild(inhHelp);
      inhCheck.addEventListener('change', () => {
        ceSnapshot();
        const realSc = (ceState.cutscene.scenes || []).find(s => s.id === scene.id);
        if (realSc) {
          realSc.inheritState = inhCheck.checked;
          if (!inhCheck.checked) {
            // Pasa a corte de escena: este plano se vuelve su propia raíz.
            // Los planos posteriores que heredaban de él siguen heredando
            // (su escenaRootId queda igual = realSc.id), así que no hace falta
            // tocarlos.
            realSc.escenaRootId = realSc.id;
          } else {
            // Pasa a continuación: heredar la escena del plano inmediatamente
            // anterior (el más cercano por tStart hacia atrás).
            const sorted = (ceState.cutscene.scenes || []).slice()
              .sort((a, b) => a.tStart - b.tStart);
            const idx = sorted.findIndex(s => s.id === realSc.id);
            const prev = idx > 0 ? sorted[idx - 1] : null;
            realSc.escenaRootId = (prev && prev.escenaRootId) ? prev.escenaRootId
              : (prev ? prev.id : realSc.id);
          }
        }
        ceRenderTracks();
      });
    }
    nameInp.addEventListener('input', () => {
      const realSc = (ceState.cutscene.scenes || []).find(s => s.id === scene.id);
      if (realSc) realSc.name = nameInp.value;
      ceRenderTracks();
    });
    nameInp.addEventListener('blur', () => ceSnapshot());
    nameInp.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        if (_ceScenePopover) { _ceScenePopover.remove(); _ceScenePopover = null; }
      }
    });
    document.body.appendChild(pop);
    _ceScenePopover = pop;
    nameInp.focus();
    nameInp.select();
    // Cerrar al click afuera
    setTimeout(() => {
      const onOutside = (e) => {
        if (!pop.contains(e.target)) {
          pop.remove();
          _ceScenePopover = null;
          document.removeEventListener('mousedown', onOutside);
        }
      };
      document.addEventListener('mousedown', onOutside);
    }, 50);
  }

  // Clona un plano completo: el plano + TODOS los kfs vinculados (cámara,
  // walls, fx, tracks). Los kfs clonados van al mismo array con sceneId nuevo.
  // Por defecto el clon es "continuación de la misma escena" (inherit=true,
  // mismo escenaRootId que el origen). Si Pablo quiere otra escena, usa el
  // toggle del popover.
  // ── Multi-selección (lasso) helpers ──
  function ceMultiSelClear() {
    ceState.multiSel = { scenes: [], kfs: [] };
  }
  function ceMultiSelHasScene(sceneId) {
    return ceState.multiSel.scenes.includes(sceneId);
  }
  function ceMultiSelHasKf(kind, trackIdx, fxEntityIdx, kfIdx) {
    return ceState.multiSel.kfs.some(k =>
      k.kind === kind &&
      (k.trackIdx ?? -1) === (trackIdx ?? -1) &&
      (k.fxEntityIdx ?? -1) === (fxEntityIdx ?? -1) &&
      k.kfIdx === kfIdx);
  }
  function ceMultiSelCount() {
    return ceState.multiSel.scenes.length + ceState.multiSel.kfs.length;
  }
  // Resuelve cada entrada de multiSel.kfs a su array y kf real (puede ser null si fue eliminado)
  function ceMultiSelResolveKfs() {
    const out = [];
    for (const id of ceState.multiSel.kfs) {
      let arr = null;
      if (id.kind === 'camera') arr = ceState.cutscene.camera.keyframes;
      else if (id.kind === 'walls') arr = ceState.cutscene.walls && ceState.cutscene.walls.keyframes;
      else if (id.kind === 'fx') {
        const ent = ceState.cutscene.fx && ceState.cutscene.fx.entities[id.fxEntityIdx];
        arr = ent && ent.keyframes;
      } else if (id.kind === 'agent') {
        const tr = ceState.cutscene.tracks[id.trackIdx];
        arr = tr && tr.keyframes;
      }
      const kf = arr && arr[id.kfIdx];
      if (kf) out.push({ id, arr, kf });
    }
    return out;
  }

  // ── Group drag: arrastra todos los items multi-seleccionados juntos ──
  function ceStartGroupDrag(anchor, anchorKind, startX, alt) {
    const baseline = JSON.stringify(ceSerializeCutscene());
    let workScenes = ceState.multiSel.scenes.slice();
    let workKfs = ceState.multiSel.kfs.slice();
    let anchorScene = (anchorKind === 'scene') ? anchor : null;
    let anchorKf = (anchorKind === 'kf') ? anchor : null;
    if (alt) {
      // Clonar todo el grupo. Los planos clonan sus kfs vinculados;
      // mapeamos los ids viejos a los clones para mantener la selección.
      const newSceneIds = [];
      const idMap = new Map();
      for (const sceneId of workScenes) {
        const sc = (ceState.cutscene.scenes || []).find(s => s.id === sceneId);
        if (!sc) continue;
        const clone = ceCloneScene(sc, sc.tStart);
        newSceneIds.push(clone.id);
        idMap.set(sceneId, clone.id);
      }
      // Kfs sueltos (los que pertenecen a planos clonados ya están duplicados)
      const newKfs = [];
      for (const kfId of workKfs) {
        let arr = null;
        if (kfId.kind === 'camera') arr = ceState.cutscene.camera.keyframes;
        else if (kfId.kind === 'walls') arr = ceState.cutscene.walls.keyframes;
        else if (kfId.kind === 'fx') {
          const ent = ceState.cutscene.fx.entities[kfId.fxEntityIdx];
          arr = ent && ent.keyframes;
        } else if (kfId.kind === 'agent') {
          const tr = ceState.cutscene.tracks[kfId.trackIdx];
          arr = tr && tr.keyframes;
        }
        const orig = arr && arr[kfId.kfIdx];
        if (!orig) continue;
        if (orig.sceneId && idMap.has(orig.sceneId)) {
          // El plano padre fue clonado; el clon ya fue creado por ceCloneScene
          const newSceneId = idMap.get(orig.sceneId);
          let cloneIdx = -1;
          for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i].sceneId === newSceneId && Math.abs(arr[i].t - orig.t) < 0.0001) {
              cloneIdx = i; break;
            }
          }
          if (cloneIdx >= 0) newKfs.push({ ...kfId, kfIdx: cloneIdx });
        } else {
          // kf suelto: clonar en sitio
          const cloneKf = {
            ...orig,
            position: orig.position ? { ...orig.position } : orig.position,
            target: orig.target ? { ...orig.target } : orig.target,
            hiddenIds: orig.hiddenIds ? [...orig.hiddenIds] : orig.hiddenIds,
          };
          arr.push(cloneKf);
          newKfs.push({ ...kfId, kfIdx: arr.length - 1 });
        }
      }
      workScenes = newSceneIds;
      workKfs = newKfs;
      ceState.multiSel.scenes = newSceneIds;
      ceState.multiSel.kfs = newKfs;
      if (anchorKind === 'scene') anchorScene = idMap.get(anchor) || anchor;
    }
    const initial = {
      scenes: workScenes.map(id => {
        const sc = (ceState.cutscene.scenes || []).find(s => s.id === id);
        return { id, tStart: sc ? sc.tStart : 0 };
      }),
      // Guardamos referencias directas a los kfs (no índices), así sobrevive
      // a reordenaciones del array.
      kfs: workKfs.map(kfId => {
        let arr = null;
        if (kfId.kind === 'camera') arr = ceState.cutscene.camera.keyframes;
        else if (kfId.kind === 'walls') arr = ceState.cutscene.walls && ceState.cutscene.walls.keyframes;
        else if (kfId.kind === 'fx') {
          const ent = ceState.cutscene.fx.entities[kfId.fxEntityIdx];
          arr = ent && ent.keyframes;
        } else if (kfId.kind === 'agent') {
          const tr = ceState.cutscene.tracks[kfId.trackIdx];
          arr = tr && tr.keyframes;
        }
        const k = arr && arr[kfId.kfIdx];
        return { id: kfId, kfRef: k, t: k ? k.t : 0 };
      }).filter(x => x.kfRef),    // descartar kfs no encontrados
    };
    ceState.groupDrag = {
      startX,
      anchorKind, anchorScene, anchorKf,
      initial, baseline, moved: false,
      cloning: !!alt,
    };
    ceRenderTracks();
  }

  // Aplica delta dt a todos los items del grupo (relativo al estado inicial)
  function ceApplyGroupDrag(dt) {
    const gd = ceState.groupDrag;
    if (!gd) return;
    // Mover planos
    for (const initSc of gd.initial.scenes) {
      const sc = (ceState.cutscene.scenes || []).find(s => s.id === initSc.id);
      if (!sc) continue;
      const dur = sc.tEnd - sc.tStart;
      const targetStart = initSc.tStart + dt;
      const realDt = targetStart - sc.tStart;
      if (Math.abs(realDt) < 0.001) continue;
      ceShiftKeyframesBySceneId(sc.id, realDt);
      sc.tStart = targetStart;
      sc.tEnd = targetStart + dur;
    }
    // Mover kfs sueltos (los que NO pertenecen a planos del grupo - ya se movieron con el plano)
    const groupSceneIds = new Set(gd.initial.scenes.map(s => s.id));
    for (const initK of gd.initial.kfs) {
      if (!initK.kfRef) continue;
      if (initK.kfRef.sceneId && groupSceneIds.has(initK.kfRef.sceneId)) continue;
      initK.kfRef.t = initK.t + dt;
    }
  }

  // ── Lasso: caja visual + cálculo de items contenidos ──
  function ceUpdateLassoBox() {
    const ld = ceState.lassoDrag;
    if (!ld) return;
    let box = document.getElementById('ce-lasso-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'ce-lasso-box';
      box.style.cssText =
        'position:fixed; pointer-events:none; z-index:1500; ' +
        'background:rgba(120, 200, 255, 0.10); ' +
        'border:1px solid rgba(120, 200, 255, 0.85); ' +
        'border-radius:2px;';
      document.body.appendChild(box);
    }
    const x = Math.min(ld.startX, ld.currX);
    const y = Math.min(ld.startY, ld.currY);
    const w = Math.abs(ld.currX - ld.startX);
    const h = Math.abs(ld.currY - ld.startY);
    box.style.left = x + 'px';
    box.style.top = y + 'px';
    box.style.width = w + 'px';
    box.style.height = h + 'px';
  }
  // Recorre los .ce-scene-block y .ce-keyframe del DOM y los marca como
  // seleccionados si su getBoundingClientRect overlap con la caja.
  function ceComputeLassoSelection(x1, y1, x2, y2, additive) {
    const bx = Math.min(x1, x2), by = Math.min(y1, y2);
    const bx2 = Math.max(x1, x2), by2 = Math.max(y1, y2);
    function overlap(r) {
      return !(r.right < bx || r.left > bx2 || r.bottom < by || r.top > by2);
    }
    if (!additive) ceMultiSelClear();
    // Planos
    const blocks = ceTracks.querySelectorAll('.ce-scene-block');
    for (const b of blocks) {
      const r = b.getBoundingClientRect();
      if (overlap(r)) {
        const sceneId = b.dataset.sceneId;
        if (sceneId && !ceMultiSelHasScene(sceneId)) {
          ceState.multiSel.scenes.push(sceneId);
        }
      }
    }
    // Keyframes — identificamos el tipo por classList (más robusto que dataset)
    const kfs = ceTracks.querySelectorAll('.ce-keyframe');
    for (const kf of kfs) {
      const r = kf.getBoundingClientRect();
      if (!overlap(r)) continue;
      const cl = kf.classList;
      const kfIdx = parseInt(kf.dataset.kfIdx, 10);
      if (isNaN(kfIdx)) continue;
      let kind, trackIdx = -1, fxEntityIdx = -1;
      if (cl.contains('kf-camera')) {
        kind = 'camera';
      } else if (cl.contains('kf-walls')) {
        kind = 'walls';
      } else if (cl.contains('kf-fx')) {
        kind = 'fx';
        fxEntityIdx = parseInt(kf.dataset.fxEntityIdx, 10);
        if (isNaN(fxEntityIdx)) continue;
      } else {
        // Cualquier otra clase kf-* (kf-move, kf-speak, kf-animation) = agente
        kind = 'agent';
        trackIdx = parseInt(kf.dataset.trackIdx, 10);
        if (isNaN(trackIdx)) continue;
      }
      if (!ceMultiSelHasKf(kind, trackIdx, fxEntityIdx, kfIdx)) {
        ceState.multiSel.kfs.push({ kind, trackIdx, fxEntityIdx, kfIdx });
      }
    }
  }

  function ceCloneScene(scene, tStartNew = null) {
    const newId = ceNewSceneId();
    const dur = scene.tEnd - scene.tStart;
    const newTStart = (tStartNew !== null) ? tStartNew : scene.tStart;
    const newScene = {
      id: newId,
      tStart: newTStart,
      tEnd: newTStart + dur,
      name: scene.name || '',
      inheritState: true,
      escenaRootId: scene.escenaRootId || scene.id,
    };
    ceState.cutscene.scenes.push(newScene);
    const dt = newTStart - scene.tStart;
    // Cámara
    const cam = ceState.cutscene.camera;
    if (cam && cam.keyframes) {
      const src = cam.keyframes.filter(k => k.sceneId === scene.id);
      for (const k of src) {
        cam.keyframes.push({
          ...k,
          t: k.t + dt,
          sceneId: newId,
          position: k.position ? { ...k.position } : null,
          target: k.target ? { ...k.target } : null,
        });
      }
      cam.keyframes.sort((a, b) => a.t - b.t);
    }
    // Walls
    if (ceState.cutscene.walls && ceState.cutscene.walls.keyframes) {
      const src = ceState.cutscene.walls.keyframes.filter(k => k.sceneId === scene.id);
      for (const k of src) {
        ceState.cutscene.walls.keyframes.push({
          ...k,
          t: k.t + dt,
          sceneId: newId,
          hiddenIds: [...(k.hiddenIds || [])],
        });
      }
      ceState.cutscene.walls.keyframes.sort((a, b) => a.t - b.t);
    }
    // FX (cada entidad tiene sus kfs)
    if (ceState.cutscene.fx && ceState.cutscene.fx.entities) {
      for (const ent of ceState.cutscene.fx.entities) {
        const src = (ent.keyframes || []).filter(k => k.sceneId === scene.id);
        for (const k of src) {
          ent.keyframes.push({
            ...k,
            t: k.t + dt,
            sceneId: newId,
            target: k.target ? { ...k.target } : null,
          });
        }
        ent.keyframes.sort((a, b) => a.t - b.t);
      }
    }
    // Tracks de agentes
    for (const tr of (ceState.cutscene.tracks || [])) {
      const src = (tr.keyframes || []).filter(k => k.sceneId === scene.id);
      for (const k of src) {
        tr.keyframes.push({
          ...k,
          t: k.t + dt,
          sceneId: newId,
        });
      }
      tr.keyframes.sort((a, b) => a.t - b.t);
    }
    return newScene;
  }

  // Elimina un plano y todos sus kfs vinculados (usado para revertir un clone
  // cancelado donde el usuario soltó sin mover).
  function ceDeleteSceneAndKfs(sceneId) {
    const arr = ceState.cutscene.scenes || [];
    const idx = arr.findIndex(s => s.id === sceneId);
    if (idx < 0) return;
    arr.splice(idx, 1);
    const cam = ceState.cutscene.camera;
    if (cam && cam.keyframes) {
      cam.keyframes = cam.keyframes.filter(k => k.sceneId !== sceneId);
    }
    if (ceState.cutscene.walls && ceState.cutscene.walls.keyframes) {
      ceState.cutscene.walls.keyframes = ceState.cutscene.walls.keyframes.filter(k => k.sceneId !== sceneId);
    }
    if (ceState.cutscene.fx && ceState.cutscene.fx.entities) {
      for (const ent of ceState.cutscene.fx.entities) {
        if (ent.keyframes) ent.keyframes = ent.keyframes.filter(k => k.sceneId !== sceneId);
      }
    }
    for (const tr of (ceState.cutscene.tracks || [])) {
      if (tr.keyframes) tr.keyframes = tr.keyframes.filter(k => k.sceneId !== sceneId);
    }
  }

  function ceInsertCutAt(t) {
    ceEnsureScenesInModel();
    const sc = ceSceneAt(t);
    if (!sc) return false;          // t en gap, no hay plano para cortar
    if (t - sc.tStart < 0.1 || sc.tEnd - t < 0.1) return false;  // muy cerca de borde
    ceSnapshot();   // undo: snapshot antes del cut
    // Crear kf de cámara con pose interpolada en t (para no romper continuidad)
    const cam = ceState.cutscene.camera;
    const interp = ceInterpCameraPose(t);
    const existing = cam.keyframes.find(k => Math.abs(k.t - t) < 0.05);
    if (!existing && interp) {
      cam.keyframes.push({
        t, type: 'camera',
        position: { ...interp.position },
        target:   { ...interp.target },
        roll: interp.roll, lens: interp.lens,
        projection: cam.gizmoProjection || 'perspective',
        cut: true, transition: 'none', transitionDuration: 0.5,
      });
      cam.keyframes.sort((a, b) => a.t - b.t);
    } else if (existing) {
      existing.cut = true;
    }
    // Dividir el plano: el original se acorta a [tStart, t], se crea uno nuevo [t, tEnd]
    const oldEnd = sc.tEnd;
    const oldName = sc.name;
    const realSc = ceState.cutscene.scenes.find(s => s.id === sc.id);
    if (realSc) {
      realSc.tEnd = t;
      const newScene = {
        id: ceNewSceneId(),
        tStart: t,
        tEnd: oldEnd,
        name: '',
        inheritState: true,                       // tijera = continuación narrativa
        // El plano nuevo pertenece a la MISMA escena que el padre (identidad estable)
        escenaRootId: realSc.escenaRootId || realSc.id,
      };
      ceState.cutscene.scenes.push(newScene);
      // Reasignar kfs cuyo t cae en la mitad derecha al plano nuevo
      ceReassignKfsByTime(t, oldEnd, newScene.id);
      // El kf de cámara que insertamos en t (cut) pertenece al plano NUEVO
      const cutKf = (ceState.cutscene.camera.keyframes || []).find(k => Math.abs(k.t - t) < 0.05);
      if (cutKf) cutKf.sceneId = newScene.id;
      // Para cada track de agente: si tiene un kf de move ANTES de t (sceneId=A)
      // y otro DESPUÉS de t (sceneId=B), insertar un kf interp en t en cada
      // mitad para preservar la animación continua a través del cut.
      for (const tr of (ceState.cutscene.tracks || [])) {
        const moveKfs = (tr.keyframes || []).filter(k => k.type === 'move').sort((a, b) => a.t - b.t);
        let prev = null, next = null;
        for (const k of moveKfs) {
          if (k.t < t - 0.05) prev = k;
          else if (k.t > t + 0.05 && !next) next = k;
        }
        if (prev && next && prev.sceneId === sc.id && next.sceneId === newScene.id) {
          // Hay un movimiento que cruza el cut. Interpolar la celda.
          const lerp = (next.t === prev.t) ? 0 : (t - prev.t) / (next.t - prev.t);
          const cx = Math.round(prev.cx + (next.cx - prev.cx) * lerp);
          const cy = Math.round(prev.cy + (next.cy - prev.cy) * lerp);
          // kf en t-0.001 perteneciente al plano A (cierra animación)
          tr.keyframes.push({ t: t - 0.001, type: 'move', cx, cy, sceneId: sc.id });
          // kf en t perteneciente al plano B (arranca con misma posición)
          tr.keyframes.push({ t: t, type: 'move', cx, cy, sceneId: newScene.id });
          tr.keyframes.sort((a, b) => a.t - b.t);
        }
      }
      // Para walls: si hay un kf antes y otro después, insertar snapshot interp en t
      // (sólo en el plano B — el plano A se queda con su último kf antes del cut).
      const wallsKfs = (ceState.cutscene.walls && ceState.cutscene.walls.keyframes) || [];
      const sortedW = wallsKfs.slice().sort((a, b) => a.t - b.t);
      let prevW = null;
      for (const k of sortedW) {
        if (k.t <= t + 0.001 && (k.sceneId === sc.id || k.sceneId === newScene.id)) prevW = k;
        else if (k.t > t) break;
      }
      // Si hay estado previo Y el plano nuevo no tiene kf en t, insertarlo
      if (prevW) {
        const hasInB = sortedW.some(k => Math.abs(k.t - t) < 0.05 && k.sceneId === newScene.id);
        if (!hasInB) {
          wallsKfs.push({ t, hiddenIds: [...(prevW.hiddenIds || [])], sceneId: newScene.id });
          wallsKfs.sort((a, b) => a.t - b.t);
        }
      }
    }
    ceRenderTracks();
    return true;
  }

  // Helper: pose interpolada en t (para insertar cuts sin romper animación)
  function ceInterpCameraPose(t) {
    const cam = ceState.cutscene.camera;
    const kfs = (cam.keyframes || []).filter(k => k.position && k.target).sort((a, b) => a.t - b.t);
    if (kfs.length === 0) return null;
    let prev = null, next = null;
    for (let i = 0; i < kfs.length; i++) {
      if (kfs[i].t <= t) prev = kfs[i];
      else { next = kfs[i]; break; }
    }
    if (prev && next && !next.cut) {
      const lerp = (next.t === prev.t) ? 0 : (t - prev.t) / (next.t - prev.t);
      return {
        position: {
          x: prev.position.x + (next.position.x - prev.position.x) * lerp,
          y: prev.position.y + (next.position.y - prev.position.y) * lerp,
          z: prev.position.z + (next.position.z - prev.position.z) * lerp,
        },
        target: {
          x: prev.target.x + (next.target.x - prev.target.x) * lerp,
          y: prev.target.y + (next.target.y - prev.target.y) * lerp,
          z: prev.target.z + (next.target.z - prev.target.z) * lerp,
        },
        roll: (prev.roll || 0) + ((next.roll || 0) - (prev.roll || 0)) * lerp,
        lens: (prev.lens || 50) + ((next.lens || 50) - (prev.lens || 50)) * lerp,
      };
    }
    if (prev) return { position: { ...prev.position }, target: { ...prev.target }, roll: prev.roll || 0, lens: prev.lens || 50 };
    if (next) return { position: { ...next.position }, target: { ...next.target }, roll: next.roll || 0, lens: next.lens || 50 };
    return null;
  }

  // Mueve un plano: shift de tStart por dt. Mueve el cut que lo inicia
  // ── Snap helpers para drag/resize de planos ──
  // Snap suave: si el target está dentro de la zona magnética del borde de un
  // vecino (o de t=0), pega exacto. Si el usuario sigue empujando más allá de
  // esa zona, NO frena — invade al vecino y lo acorta (igual que DaVinci).
  // Los kfs nunca se borran: si el vecino se acorta, sus kfs quedan vinculados
  // a él por sceneId (no se ven mientras estén fuera del rango actual del plano).
  const SCENE_SNAP_THRESHOLD = 0.4;   // 0.4s = zona magnética
  const SCENE_SNAP_BREAKAWAY = 0.15;  // si target está MÁS lejos que esto del snap, rompe

  // Aplica snap si el target está cerca de un borde.
  function ceApplySnapToStart(targetStart, duration, excludeId) {
    const others = (ceState.cutscene.scenes || []).filter(s => s.id !== excludeId);
    let tStart = targetStart;
    const tEnd = tStart + duration;
    // Si el target ya invade algún vecino (push activo), NO aplicar snap.
    // El snap solo es para juntar planos antes de tocarlos. Una vez tocando,
    // dejamos que el push sea fluido (1-a-1 con el cursor).
    const isPushing = others.some(sc =>
      tEnd > sc.tStart + 0.001 && tStart < sc.tEnd - 0.001);
    if (ceState.snapEnabled && !isPushing) {
      let bestSnap = null;
      let bestDist = SCENE_SNAP_THRESHOLD;
      for (const sc of others) {
        const dEnd = Math.abs(tEnd - sc.tStart);
        if (dEnd < bestDist) { bestSnap = { kind: 'end', target: sc.tStart }; bestDist = dEnd; }
        const dStart = Math.abs(tStart - sc.tEnd);
        if (dStart < bestDist) { bestSnap = { kind: 'start', target: sc.tEnd }; bestDist = dStart; }
      }
      if (Math.abs(tStart) < bestDist) bestSnap = { kind: 'start', target: 0 };
      if (bestSnap) {
        if (bestSnap.kind === 'start') tStart = bestSnap.target;
        else tStart = bestSnap.target - duration;
      }
    }
    tStart = Math.max(0, Math.min(ceState.cutscene.duration - duration, tStart));
    return tStart;
  }
  function ceApplySnapToEnd(tStart, targetEnd, excludeId) {
    const others = (ceState.cutscene.scenes || []).filter(s => s.id !== excludeId);
    let tEnd = targetEnd;
    // Si target ya invade algún vecino, no snap (push fluido)
    const isPushing = others.some(sc =>
      tEnd > sc.tStart + 0.001 && tStart < sc.tEnd - 0.001);
    if (ceState.snapEnabled && !isPushing) {
      let best = null;
      let bestDist = SCENE_SNAP_THRESHOLD;
      for (const sc of others) {
        const d = Math.abs(tEnd - sc.tStart);
        if (d < bestDist) { best = sc.tStart; bestDist = d; }
      }
      if (best !== null) tEnd = best;
    }
    return Math.max(tStart + 0.2, Math.min(ceState.cutscene.duration, tEnd));
  }
  function ceApplySnapToStartResize(targetStart, tEnd, excludeId) {
    const others = (ceState.cutscene.scenes || []).filter(s => s.id !== excludeId);
    let tStart = targetStart;
    const isPushing = others.some(sc =>
      tEnd > sc.tStart + 0.001 && tStart < sc.tEnd - 0.001);
    if (ceState.snapEnabled && !isPushing) {
      let best = null;
      let bestDist = SCENE_SNAP_THRESHOLD;
      for (const sc of others) {
        const d = Math.abs(tStart - sc.tEnd);
        if (d < bestDist) { best = sc.tEnd; bestDist = d; }
      }
      if (best !== null) tStart = best;
    }
    return Math.max(0, Math.min(tEnd - 0.2, tStart));
  }

  // Resuelve solapes después de un move/resize: acorta vecinos invadidos.
  // Si un vecino es completamente cubierto, se elimina del modelo Y sus kfs
  // se reasignan al plano invasor (para que no queden huérfanos).
  // NUNCA borra keyframes, solo los reasigna.
  function ceResolveSceneOverlaps(movedSceneId) {
    const all = ceState.cutscene.scenes || [];
    const moved = all.find(s => s.id === movedSceneId);
    if (!moved) return;
    for (let i = all.length - 1; i >= 0; i--) {
      const sc = all[i];
      if (sc.id === movedSceneId) continue;
      const overlap = Math.min(moved.tEnd, sc.tEnd) - Math.max(moved.tStart, sc.tStart);
      if (overlap <= 0.001) continue;
      const scDur = sc.tEnd - sc.tStart;
      // Si moved cubre completamente a sc: eliminar sc Y reasignar sus kfs
      // al plano invasor (los kfs no se pierden, solo cambian de dueño).
      if (overlap >= scDur - 0.05) {
        ceReassignKfsByOwnerToTarget(sc.id, moved.id);
        all.splice(i, 1);
        continue;
      }
      // Acortar sc del lado invadido — sus kfs siguen siendo de sc (algunos
      // pueden quedar dormidos si t cae fuera del nuevo rango).
      if (moved.tStart > sc.tStart && moved.tStart < sc.tEnd) {
        sc.tEnd = moved.tStart;
      } else if (moved.tEnd > sc.tStart && moved.tEnd < sc.tEnd) {
        sc.tStart = moved.tEnd;
      } else if (moved.tStart >= sc.tStart && moved.tEnd <= sc.tEnd) {
        const dStart = moved.tStart - sc.tStart;
        const dEnd = sc.tEnd - moved.tEnd;
        if (dStart <= dEnd) sc.tStart = moved.tEnd;
        else sc.tEnd = moved.tStart;
      }
      if (sc.tEnd - sc.tStart < 0.15) {
        // Demasiado chico → absorber kfs y eliminar
        ceReassignKfsByOwnerToTarget(sc.id, moved.id);
        all.splice(i, 1);
      }
    }
  }

  // Reasigna todos los kfs cuyo sceneId === oldId al newId.
  function ceReassignKfsByOwnerToTarget(oldId, newId) {
    const cam = ceState.cutscene.camera;
    if (cam && cam.keyframes) {
      for (const k of cam.keyframes) if (k.sceneId === oldId) k.sceneId = newId;
    }
    if (ceState.cutscene.walls && ceState.cutscene.walls.keyframes) {
      for (const k of ceState.cutscene.walls.keyframes) if (k.sceneId === oldId) k.sceneId = newId;
    }
    if (ceState.cutscene.fx && ceState.cutscene.fx.entities) {
      for (const ent of ceState.cutscene.fx.entities) {
        if (ent.keyframes) for (const k of ent.keyframes) if (k.sceneId === oldId) k.sceneId = newId;
      }
    }
    for (const tr of (ceState.cutscene.tracks || [])) {
      if (tr.keyframes) for (const k of tr.keyframes) if (k.sceneId === oldId) k.sceneId = newId;
    }
  }

  // Mueve un plano: aplica snap suave al borde de vecinos. Si el usuario
  // sigue empujando más allá del snap, el vecino se acorta (push). Los kfs
  // nunca se borran — quedan vinculados al vecino por sceneId.
  function ceMoveScene(scene, dt) {
    const realSc = (ceState.cutscene.scenes || []).find(s => s.id === scene.id);
    if (!realSc) return;
    const dur = realSc.tEnd - realSc.tStart;
    const target = realSc.tStart + dt;
    const newStart = ceApplySnapToStart(target, dur, realSc.id);
    const realDt = newStart - realSc.tStart;
    if (Math.abs(realDt) < 0.001) return;
    ceShiftKeyframesBySceneId(realSc.id, realDt);
    realSc.tStart = newStart;
    realSc.tEnd = newStart + dur;
    // NOTA: NO llamamos ceResolveSceneOverlaps aquí. Durante drag los planos
    // pueden solaparse visualmente. El resolve definitivo se hace en mouseup.
    ceRenderTracks();
  }

  function ceResizeSceneRight(scene, dt, mode) {
    const realSc = (ceState.cutscene.scenes || []).find(s => s.id === scene.id);
    if (!realSc) return;
    const oldEnd = realSc.tEnd;
    const target = oldEnd + dt;
    const newEnd = ceApplySnapToEnd(realSc.tStart, target, realSc.id);
    const realDt = newEnd - oldEnd;
    if (Math.abs(realDt) < 0.001) return;
    if (mode === 'warp') {
      ceWarpKeyframesBySceneId(realSc.id, realSc.tStart, oldEnd, realSc.tStart, newEnd);
    }
    realSc.tEnd = newEnd;
    ceRenderTracks();
    ceRenderRuler();
  }

  function ceResizeSceneLeft(scene, dt, mode) {
    const realSc = (ceState.cutscene.scenes || []).find(s => s.id === scene.id);
    if (!realSc) return;
    const oldStart = realSc.tStart;
    const target = oldStart + dt;
    const newStart = ceApplySnapToStartResize(target, realSc.tEnd, realSc.id);
    const realDt = newStart - oldStart;
    if (Math.abs(realDt) < 0.001) return;
    if (mode === 'warp') {
      ceWarpKeyframesBySceneId(realSc.id, oldStart, realSc.tEnd, newStart, realSc.tEnd);
    }
    realSc.tStart = newStart;
    ceRenderTracks();
    ceRenderRuler();
  }

  // Shift kfs en rango [tA, tB) por dt. Toca camera, walls, fx, tracks de agentes.
  // Mueve TODOS los kfs vinculados a un sceneId por dt. Esto incluye los kfs
  // dormidos (fuera del rango actual del plano), para que cuando se extienda
  // el plano de nuevo vuelvan a aparecer en sus posiciones relativas.
  function ceShiftKeyframesBySceneId(sceneId, dt) {
    if (!sceneId || Math.abs(dt) < 0.001) return;
    const cam = ceState.cutscene.camera;
    if (cam && cam.keyframes) {
      for (const k of cam.keyframes) if (k.sceneId === sceneId) k.t += dt;
      cam.keyframes.sort((a, b) => a.t - b.t);
    }
    if (ceState.cutscene.walls && ceState.cutscene.walls.keyframes) {
      for (const k of ceState.cutscene.walls.keyframes) if (k.sceneId === sceneId) k.t += dt;
      ceState.cutscene.walls.keyframes.sort((a, b) => a.t - b.t);
    }
    if (ceState.cutscene.fx && ceState.cutscene.fx.entities) {
      for (const ent of ceState.cutscene.fx.entities) {
        if (ent.keyframes) {
          for (const k of ent.keyframes) if (k.sceneId === sceneId) k.t += dt;
          ent.keyframes.sort((a, b) => a.t - b.t);
        }
      }
    }
    for (const tr of (ceState.cutscene.tracks || [])) {
      if (tr.keyframes) {
        for (const k of tr.keyframes) if (k.sceneId === sceneId) k.t += dt;
        tr.keyframes.sort((a, b) => a.t - b.t);
      }
    }
  }

  // Time-warp solo para kfs vinculados a un sceneId. Mapea t en [oldStart, oldEnd]
  // a [newStart, newEnd]. No toca kfs de otros planos.
  function ceWarpKeyframesBySceneId(sceneId, oldStart, oldEnd, newStart, newEnd) {
    const oldDur = oldEnd - oldStart;
    const newDur = newEnd - newStart;
    if (oldDur < 0.001 || !sceneId) return;
    const factor = newDur / oldDur;
    const remap = (t) => newStart + (t - oldStart) * factor;
    const cam = ceState.cutscene.camera;
    if (cam && cam.keyframes) {
      for (const k of cam.keyframes) if (k.sceneId === sceneId) k.t = remap(k.t);
      cam.keyframes.sort((a, b) => a.t - b.t);
    }
    if (ceState.cutscene.walls && ceState.cutscene.walls.keyframes) {
      for (const k of ceState.cutscene.walls.keyframes) if (k.sceneId === sceneId) k.t = remap(k.t);
      ceState.cutscene.walls.keyframes.sort((a, b) => a.t - b.t);
    }
    if (ceState.cutscene.fx && ceState.cutscene.fx.entities) {
      for (const ent of ceState.cutscene.fx.entities) {
        if (ent.keyframes) {
          for (const k of ent.keyframes) if (k.sceneId === sceneId) k.t = remap(k.t);
          ent.keyframes.sort((a, b) => a.t - b.t);
        }
      }
    }
    for (const tr of (ceState.cutscene.tracks || [])) {
      if (tr.keyframes) {
        for (const k of tr.keyframes) if (k.sceneId === sceneId) k.t = remap(k.t);
        tr.keyframes.sort((a, b) => a.t - b.t);
      }
    }
  }

  // Legacy: kfs sin sceneId — usar rango temporal (compat).
  function ceShiftKeyframesInRange(tA, tB, dt, inclusiveStart, inclusiveEnd) {
    const inRange = (t) => {
      const a = inclusiveStart ? (t >= tA - 0.001) : (t > tA + 0.001);
      const b = inclusiveEnd   ? (t <= tB + 0.001) : (t < tB - 0.001);
      return a && b;
    };
    const cam = ceState.cutscene.camera;
    for (const kf of (cam.keyframes || [])) {
      if (inRange(kf.t)) kf.t += dt;
    }
    cam.keyframes.sort((a, b) => a.t - b.t);
    for (const kf of (ceState.cutscene.walls.keyframes || [])) {
      if (inRange(kf.t)) kf.t += dt;
    }
    ceState.cutscene.walls.keyframes.sort((a, b) => a.t - b.t);
    for (const ent of ((ceState.cutscene.fx && ceState.cutscene.fx.entities) || [])) {
      for (const kf of (ent.keyframes || [])) {
        if (inRange(kf.t)) kf.t += dt;
      }
      if (ent.keyframes) ent.keyframes.sort((a, b) => a.t - b.t);
    }
    for (const tr of (ceState.cutscene.tracks || [])) {
      for (const kf of (tr.keyframes || [])) {
        if (inRange(kf.t)) kf.t += dt;
      }
      if (tr.keyframes) tr.keyframes.sort((a, b) => a.t - b.t);
    }
  }

  // Time-warp: kfs en rango [oldStart, oldEnd] se mapean a [newStart, newEnd].
  function ceWarpKeyframesInRange(oldStart, oldEnd, newStart, newEnd) {
    const oldDur = oldEnd - oldStart;
    const newDur = newEnd - newStart;
    if (oldDur < 0.001) return;
    const factor = newDur / oldDur;
    const remap = (t) => newStart + (t - oldStart) * factor;
    const inRange = (t) => t >= oldStart - 0.001 && t <= oldEnd + 0.001;
    const cam = ceState.cutscene.camera;
    for (const kf of (cam.keyframes || [])) {
      if (inRange(kf.t)) kf.t = remap(kf.t);
    }
    cam.keyframes.sort((a, b) => a.t - b.t);
    for (const kf of (ceState.cutscene.walls.keyframes || [])) {
      if (inRange(kf.t)) kf.t = remap(kf.t);
    }
    ceState.cutscene.walls.keyframes.sort((a, b) => a.t - b.t);
    for (const ent of ((ceState.cutscene.fx && ceState.cutscene.fx.entities) || [])) {
      for (const kf of (ent.keyframes || [])) {
        if (inRange(kf.t)) kf.t = remap(kf.t);
      }
      if (ent.keyframes) ent.keyframes.sort((a, b) => a.t - b.t);
    }
    for (const tr of (ceState.cutscene.tracks || [])) {
      for (const kf of (tr.keyframes || [])) {
        if (inRange(kf.t)) kf.t = remap(kf.t);
      }
      if (tr.keyframes) tr.keyframes.sort((a, b) => a.t - b.t);
    }
  }

  // Un kf es "visible" en el timeline solo si su scene asignada existe Y su t
  // cae dentro del rango actual de esa scene. Si su scene fue eliminada o se
  // acortó dejándolo afuera, el kf existe en el array pero no se muestra
  // (queda dormido hasta que la scene se extienda o vuelva).
  function ceKfIsVisible(kf) {
    if (kf.sceneId === undefined || kf.sceneId === null) return true;   // legacy
    const sc = (ceState.cutscene.scenes || []).find(s => s.id === kf.sceneId);
    if (!sc) return false;
    return kf.t >= sc.tStart - 0.001 && kf.t < sc.tEnd + 0.001;
  }

  function ceRenderTracks() {
    ceTracks.innerHTML = '';
    const w = ceRulerWidth();
    // ── FILA DE PLANOS (arriba de todo) ──
    const scenes = ceComputeScenes();
    const scenesTrack = document.createElement('div');
    scenesTrack.className = 'ce-track ce-track-scenes';
    const scenesLabel = document.createElement('div');
    scenesLabel.className = 'ce-track-label';
    scenesLabel.textContent = '🎬 Planos';
    scenesLabel.style.color = 'rgba(220, 200, 240, 0.85)';
    const scenesArea = document.createElement('div');
    scenesArea.className = 'ce-track-area ce-scenes-area';
    scenesArea.dataset.trackKind = 'scenes';
    // Calcular escenas únicas (cada cambio de inherit=false marca una nueva)
    let lastSceneNum = 0;
    for (const sc of scenes) {
      const left = ceTimeToPixel(sc.tStart, w);
      const right = ceTimeToPixel(sc.tEnd, w);
      const blockW = right - left;
      if (right < -10 || left > w + 10) {
        lastSceneNum = sc.sceneNum;
        continue;
      }
      // ── Label "Escena N" cuando empieza una nueva escena ──
      if (sc.sceneNum !== lastSceneNum) {
        const sceneTag = document.createElement('div');
        sceneTag.style.cssText =
          `position:absolute; top:1px; left:${left}px; ` +
          `font-size:9.5px; color:rgba(255, 180, 110, 0.92); ` +
          `font-weight:700; letter-spacing:0.6px; ` +
          `padding:1px 6px; border-radius:8px; ` +
          `background:rgba(255, 130, 60, 0.18); ` +
          `border:0.5px solid rgba(255, 130, 60, 0.50); ` +
          `pointer-events:none; user-select:none; z-index:3; ` +
          `text-transform:uppercase; white-space:nowrap;`;
        sceneTag.textContent = `Escena ${sc.sceneNum}`;
        scenesArea.appendChild(sceneTag);
        lastSceneNum = sc.sceneNum;
      }
      const block = document.createElement('div');
      block.className = 'ce-scene-block';
      // Marca visual cuando este plano está siendo arrastrado
      if (ceSceneDragInfo && ceSceneDragInfo.scene && ceSceneDragInfo.scene.id === sc.id) {
        block.classList.add('dragging');
      }
      // Marca visual cuando este plano está en la selección múltiple
      if (ceMultiSelHasScene(sc.id)) {
        block.classList.add('multi-selected');
      }
      // Color alternante por escena (no por idx total) — todos los planos de
      // la misma escena comparten color
      const palette = [
        ['rgba(140, 110, 200, 0.30)', 'rgba(180, 150, 230, 0.65)'],
        ['rgba(110, 160, 200, 0.30)', 'rgba(150, 200, 230, 0.65)'],
        ['rgba(200, 140, 100, 0.30)', 'rgba(230, 180, 140, 0.65)'],
        ['rgba(120, 180, 130, 0.30)', 'rgba(160, 220, 170, 0.65)'],
      ];
      const [bg, border] = palette[(sc.sceneNum - 1) % palette.length];
      // Borde punteado si NO hereda (escena nueva). Sólido si continúa la anterior.
      const borderStyle = sc.inheritState ? 'solid' : 'dashed';
      const borderWidth = sc.inheritState ? '1px' : '2px';
      block.style.cssText = `position:absolute; top:16px; bottom:4px; ` +
        `left:${left}px; width:${Math.max(2, blockW)}px; ` +
        `background:${bg}; border:${borderWidth} ${borderStyle} ${border}; ` +
        `border-radius:6px; cursor:grab; ` +
        `display:flex; align-items:center; padding:0 8px; ` +
        `font-size:11px; color:rgba(255,255,255,0.9); ` +
        `font-weight:500; user-select:none; overflow:hidden;`;
      block.dataset.sceneIdx = sc.idx;
      block.dataset.sceneId = sc.id;
      block.dataset.sceneTStart = sc.tStart;
      block.dataset.sceneTEnd = sc.tEnd;
      const labelText = document.createElement('span');
      labelText.style.cssText = 'pointer-events:none; white-space:nowrap; ' +
        'overflow:hidden; text-overflow:ellipsis;';
      labelText.textContent = `${sc.displayName} · ${sc.duration.toFixed(1)}s`;
      block.appendChild(labelText);
      // Edges para resize en ambos lados (los planos pueden tener gaps libremente)
      const edgeL = document.createElement('div');
      edgeL.className = 'ce-scene-edge ce-scene-edge-l';
      edgeL.dataset.sceneIdx = sc.idx;
      edgeL.dataset.edge = 'left';
      edgeL.style.cssText = 'position:absolute; left:-3px; top:0; bottom:0; ' +
        'width:8px; cursor:ew-resize; z-index:2;';
      block.appendChild(edgeL);
      const edgeR = document.createElement('div');
      edgeR.className = 'ce-scene-edge ce-scene-edge-r';
      edgeR.dataset.sceneIdx = sc.idx;
      edgeR.dataset.edge = 'right';
      edgeR.style.cssText = 'position:absolute; right:-3px; top:0; bottom:0; ' +
        'width:8px; cursor:ew-resize; z-index:2;';
      block.appendChild(edgeR);
      scenesArea.appendChild(block);
    }
    scenesTrack.appendChild(scenesLabel);
    scenesTrack.appendChild(scenesArea);
    ceTracks.appendChild(scenesTrack);
    // ── Track de cámara: solo visible si hay kfs O si tipo=Camera está activo ──
    const cam = ceState.cutscene.camera;
    const showCamTrack = (cam.keyframes.length > 0) || (ceTypeSelect.value === 'camera');
    if (showCamTrack) {
      const camTrack = document.createElement('div');
      camTrack.className = 'ce-track ce-track-camera';
      const camLabel = document.createElement('div');
      camLabel.className = 'ce-track-label';
      let camTitle = '📷 Camera';
      if (cam.parentAgentId) {
        const pa = agents.find(a => a.id === cam.parentAgentId);
        if (pa) camTitle += ` ⇢ ${String(pa.id).slice(-3)}`;
      }
      camLabel.textContent = camTitle;
      const camArea = document.createElement('div');
      camArea.className = 'ce-track-area';
      camArea.dataset.trackKind = 'camera';
      for (let kfIdx = 0; kfIdx < cam.keyframes.length; kfIdx++) {
        const kf = cam.keyframes[kfIdx];
        if (!ceKfIsVisible(kf)) continue;   // kf dormido (su plano se acortó o desapareció)
        const kfEl = document.createElement('div');
        kfEl.className = 'ce-keyframe kf-camera' + (kf.cut ? ' kf-cut' : '');
        if (ceState.selectedKf
            && ceState.selectedKfIsCamera
            && ceState.selectedKf.kfIdx === kfIdx) {
          kfEl.classList.add('selected');
        }
        if (ceMultiSelHasKf('camera', -1, -1, kfIdx)) {
          kfEl.classList.add('multi-selected');
        }
        kfEl.style.left = `${ceTimeToPixel(kf.t, w)}px`;
        kfEl.dataset.trackKind = 'camera';
        kfEl.dataset.kfIdx = kfIdx;
        const summaryParts = [];
        if (kf.position) summaryParts.push(`pos(${kf.position.x.toFixed(0)},${kf.position.y.toFixed(0)},${kf.position.z.toFixed(0)})`);
        if (kf.target) summaryParts.push(`→(${kf.target.x.toFixed(0)},${kf.target.y.toFixed(0)},${kf.target.z.toFixed(0)})`);
        if (kf.lens) summaryParts.push(`${kf.lens}mm`);
        kfEl.title = `CAMERA${kf.cut ? ' ✂CUT' : ''} @ ${ceFormatTime(kf.t)}\n${summaryParts.join(' ')}\n(click selecciona, drag mueve, doble-click recaptura)`;
        camArea.appendChild(kfEl);
      }
      camTrack.appendChild(camLabel);
      camTrack.appendChild(camArea);
      ceTracks.appendChild(camTrack);
    }

    // ── Track de paredes: visible si hay kfs O si tipo=Walls está activo ──
    const wallsKfs = (ceState.cutscene.walls && ceState.cutscene.walls.keyframes) || [];
    const showWallsTrack = (wallsKfs.length > 0) || (ceTypeSelect.value === 'walls');
    if (showWallsTrack) {
      const wallsTrack = document.createElement('div');
      wallsTrack.className = 'ce-track ce-track-walls';
      const wallsLabel = document.createElement('div');
      wallsLabel.className = 'ce-track-label';
      wallsLabel.textContent = '🧱 Walls';
      const wallsArea = document.createElement('div');
      wallsArea.className = 'ce-track-area';
      wallsArea.dataset.trackKind = 'walls';
      for (let kfIdx = 0; kfIdx < wallsKfs.length; kfIdx++) {
        const kf = wallsKfs[kfIdx];
        if (!ceKfIsVisible(kf)) continue;
        const kfEl = document.createElement('div');
        kfEl.className = 'ce-keyframe kf-walls';
        if (ceState.selectedKf && ceState.selectedKfIsWalls && ceState.selectedKf.kfIdx === kfIdx) {
          kfEl.classList.add('selected');
        }
        if (ceMultiSelHasKf('walls', -1, -1, kfIdx)) {
          kfEl.classList.add('multi-selected');
        }
        kfEl.style.left = `${ceTimeToPixel(kf.t, w)}px`;
        kfEl.dataset.trackKind = 'walls';
        kfEl.dataset.kfIdx = kfIdx;
        const hiddenList = (kf.hiddenIds || []);
        const wallCount = hiddenList.filter(id => id.startsWith('N:') || id.startsWith('W:')).length;
        const propCount = hiddenList.filter(id => id.startsWith('P:')).length;
        const roofHidden = hiddenList.includes('ROOF');
        const parts = [];
        if (wallCount > 0) parts.push(wallCount + ' pared(es)');
        if (propCount > 0) parts.push(propCount + ' mueble(s)');
        if (roofHidden) parts.push('techo');
        const summary = parts.length > 0 ? parts.join(' + ') + ' ocultos' : 'todo visible';
        kfEl.title = `WALLS @ ${ceFormatTime(kf.t)}\n${summary}\n(click selecciona, drag mueve)`;
        wallsArea.appendChild(kfEl);
      }
      wallsTrack.appendChild(wallsLabel);
      wallsTrack.appendChild(wallsArea);
      ceTracks.appendChild(wallsTrack);
    }

    // ── Tracks de FX (uno por entidad) ──
    const fxTrackData = ceState.cutscene.fx;
    const fxEntities = (fxTrackData && fxTrackData.entities) || [];
    const showFxTrack = (fxEntities.length > 0) || (ceTypeSelect.value === 'fx');
    if (showFxTrack) {
      // Si no hay entidades pero tipo=fx, mostrar un track placeholder vacío
      if (fxEntities.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = 'ce-track ce-track-fx';
        const ph = document.createElement('div');
        ph.className = 'ce-track-label';
        ph.textContent = '🌀 FX';
        const phArea = document.createElement('div');
        phArea.className = 'ce-track-area';
        placeholder.appendChild(ph);
        placeholder.appendChild(phArea);
        ceTracks.appendChild(placeholder);
      }
      for (let entIdx = 0; entIdx < fxEntities.length; entIdx++) {
        const ent = fxEntities[entIdx];
        const fxTrack = document.createElement('div');
        fxTrack.className = 'ce-track ce-track-fx';
        if (ceState.selectedFxEntityIdx === entIdx) fxTrack.classList.add('selected');
        const fxLabel = document.createElement('div');
        fxLabel.className = 'ce-track-label';
        fxLabel.textContent = `🌀 ${ent.kind || 'fx'} #${(ent.id || '').slice(-3)}`;
        const fxArea = document.createElement('div');
        fxArea.className = 'ce-track-area';
        fxArea.dataset.trackKind = 'fx';
        fxArea.dataset.fxEntityIdx = entIdx;
        // Barra de duración total (desde primer kf hasta último kf + duration)
        if (ent.keyframes && ent.keyframes.length > 0) {
          const dur = ent.duration || FX_PRESETS[ent.kind || 'smoke']?.duration || 3.0;
          const firstT = ent.keyframes[0].t;
          const lastT = ent.keyframes[ent.keyframes.length - 1].t;
          const totalSpan = (lastT + dur) - firstT;
          const barEl = document.createElement('div');
          barEl.className = 'ce-fx-bar';
          barEl.style.left = `${ceTimeToPixel(firstT, w)}px`;
          barEl.style.width = `${ceTimeToPixel(totalSpan, w)}px`;
          fxArea.appendChild(barEl);
        }
        // Render kfs
        for (let kfIdx = 0; kfIdx < (ent.keyframes || []).length; kfIdx++) {
          const kf = ent.keyframes[kfIdx];
          if (!ceKfIsVisible(kf)) continue;
          const kfEl = document.createElement('div');
          kfEl.className = 'ce-keyframe kf-fx';
          if (ceState.selectedKf
              && ceState.selectedKfIsFx
              && ceState.selectedFxEntityIdx === entIdx
              && ceState.selectedKf.kfIdx === kfIdx) {
            kfEl.classList.add('selected');
          }
          if (ceMultiSelHasKf('fx', -1, entIdx, kfIdx)) {
            kfEl.classList.add('multi-selected');
          }
          kfEl.style.left = `${ceTimeToPixel(kf.t, w)}px`;
          kfEl.dataset.trackKind = 'fx';
          kfEl.dataset.fxEntityIdx = entIdx;
          kfEl.dataset.kfIdx = kfIdx;
          const targetDesc = (kf.target && kf.target.kind === 'cell')
            ? `cell(${kf.target.cx.toFixed ? kf.target.cx.toFixed(0) : kf.target.cx},${kf.target.cy.toFixed ? kf.target.cy.toFixed(0) : kf.target.cy})`
            : (kf.target && kf.target.kind === 'agent') ? `agent ${String(kf.target.id).slice(-3)}` : '?';
          kfEl.title = `FX ${ent.kind} @ ${ceFormatTime(kf.t)} → ${targetDesc}\n(click selecciona, drag mueve, doble-click reposiciona)`;
          fxArea.appendChild(kfEl);
        }
        fxTrack.appendChild(fxLabel);
        fxTrack.appendChild(fxArea);
        ceTracks.appendChild(fxTrack);
      }
    }

    // ── Tracks de agentes ──
    const visibleTracks = ceState.cutscene.tracks.filter(t =>
      t.keyframes.length > 0 || t.agentId === ceState.selectedAgentId
    );
    if (visibleTracks.length === 0 && cam.keyframes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ce-empty-state';
      empty.textContent = agents.length === 0
        ? 'No hay agentes en la escena. Spawneá uno con "+ Agente".'
        : 'Seleccioná un agente y "+ Keyframe" para empezar.';
      ceTracks.appendChild(empty);
      return;
    }
    for (let trackIdx = 0; trackIdx < ceState.cutscene.tracks.length; trackIdx++) {
      const track = ceState.cutscene.tracks[trackIdx];
      if (!visibleTracks.includes(track)) continue;
      const agent = agents.find(a => a.id === track.agentId);
      const trackEl = document.createElement('div');
      trackEl.className = 'ce-track';
      if (track.agentId === ceState.selectedAgentId) trackEl.classList.add('selected');
      const labelEl = document.createElement('div');
      labelEl.className = 'ce-track-label';
      labelEl.textContent = agent
        ? `${agent.emoji || ''} Agente ${String(agent.id).slice(-3)}`
        : '(agente borrado)';
      const areaEl = document.createElement('div');
      areaEl.className = 'ce-track-area';
      areaEl.dataset.agentId = track.agentId;
      areaEl.dataset.trackIdx = trackIdx;
      for (let kfIdx = 0; kfIdx < track.keyframes.length; kfIdx++) {
        const kf = track.keyframes[kfIdx];
        if (!ceKfIsVisible(kf)) continue;
        if (kf.type === 'animation') {
          const dur = kf.duration ?? CE_ANIM_PRESETS[kf.preset || 'wave']?.duration ?? 1.0;
          const barEl = document.createElement('div');
          barEl.className = 'ce-anim-bar';
          barEl.style.left = `${ceTimeToPixel(kf.t, w)}px`;
          barEl.style.width = `${ceTimeToPixel(dur, w)}px`;
          areaEl.appendChild(barEl);
        }
        const kfEl = document.createElement('div');
        kfEl.className = `ce-keyframe kf-${kf.type}`;
        if (ceState.selectedKf
            && !ceState.selectedKfIsCamera
            && ceState.selectedKf.trackIdx === trackIdx
            && ceState.selectedKf.kfIdx === kfIdx) {
          kfEl.classList.add('selected');
        }
        if (ceMultiSelHasKf('agent', trackIdx, -1, kfIdx)) {
          kfEl.classList.add('multi-selected');
        }
        kfEl.style.left = `${ceTimeToPixel(kf.t, w)}px`;
        kfEl.dataset.trackKind = 'agent';
        kfEl.dataset.trackIdx = trackIdx;
        kfEl.dataset.kfIdx = kfIdx;
        let summary = '';
        if (kf.type === 'move') summary = `(${kf.cx}, ${kf.cy})`;
        else if (kf.type === 'speak') summary = `"${(kf.text || '').slice(0, 28)}${(kf.text || '').length > 28 ? '…' : ''}"`;
        else if (kf.type === 'animation') summary = kf.preset || '';
        kfEl.title = `${kf.type.toUpperCase()} @ ${ceFormatTime(kf.t)}  ${summary}\n(click selecciona, drag mueve, doble-click edita)`;
        areaEl.appendChild(kfEl);
      }
      trackEl.appendChild(labelEl);
      trackEl.appendChild(areaEl);
      ceTracks.appendChild(trackEl);
    }
  }

  function ceRefreshAgentSelect() {
    ceAgentSelect.innerHTML = '';
    if (agents.length === 0) {
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = '— sin agentes —';
      ceAgentSelect.appendChild(opt);
      return;
    }
    for (const agent of agents) {
      const opt = document.createElement('option');
      opt.value = agent.id;
      opt.textContent = `${agent.emoji || ''} ${String(agent.id).slice(-3)}`;
      if (agent.id === ceState.selectedAgentId) opt.selected = true;
      ceAgentSelect.appendChild(opt);
    }
  }

  // Helper: verifica si un agent fue spawneado por la cutscene actual (vs ser
  // del mundo). El flag _csAgent se setea al crearlos en ceOpen / ceAddAgent.
  function ceIsCutsceneAgent(a) { return !!a._csAgent; }

  // ── Paredes/techo/muebles ocultables ──────────────────────────────────
  // ID format:
  //   'N:cx,cy'       wall norte
  //   'W:cx,cy'       wall oeste
  //   'P:propId'      mueble (prop) por su id estable
  //   'ROOF'          techo (todos los meshes de techo a la vez)
  function ceWallIdFromFace(face) {
    if (!face) return null;
    if (face.type === 'wallN') return 'N:' + face.cx + ',' + face.cy;
    if (face.type === 'wallW') return 'W:' + face.cx + ',' + face.cy;
    return null;
  }
  function ceIdFromMesh(obj) {
    if (!obj || !obj.userData) return null;
    if (obj.userData.wallFace) return ceWallIdFromFace(obj.userData.wallFace);
    if (obj.userData.prop) return 'P:' + obj.userData.prop.id;
    if (obj.userData.roofMesh) return 'ROOF';
    return null;
  }
  // Devuelve el snapshot efectivo en t: el último kf con t <= playhead, o vacío.
  // Un kf SIN match (no hay ningún kf con t <= playhead) → todo visible (vacío).
  // Filtra kfs que pertenecen al plano dado, vinculados por sceneId estable.
  // Además requiere que el t del kf esté dentro del rango ACTUAL del plano
  // (si el plano se acortó, los kfs que quedaron fuera se ocultan).
  // Si scene es null (gap), devuelve [].
  function ceFilterKfsToScene(kfs, scene) {
    if (!scene) return [];
    return kfs.filter(k => {
      if (k.sceneId !== undefined && k.sceneId !== null) {
        if (k.sceneId !== scene.id) return false;
        return k.t >= scene.tStart - 0.001 && k.t < scene.tEnd + 0.001;
      }
      return k.t >= scene.tStart - 0.001 && k.t < scene.tEnd - 0.001;
    });
  }

  // Cadena de continuidad: planos con MISMO escenaRootId que el actual,
  // anteriores temporalmente. La identidad de escena es estable: un plano que
  // pertenece a Escena 1 hereda solo de planos de Escena 1, aunque otros
  // planos de Escena 2 estén intercalados en el timeline.
  function ceInheritanceChain(scene) {
    if (!scene) return [];
    const all = ceComputeScenes();
    const chain = [scene];
    if (!scene.inheritState) return chain;   // escena root, no hereda
    const root = scene.escenaRootId || scene.id;
    // Planos anteriores con MISMO escenaRootId, ordenados de más reciente a más antiguo
    const sameScene = all
      .filter(s => s.id !== scene.id && s.tStart < scene.tStart && (s.escenaRootId || s.id) === root)
      .sort((a, b) => b.tStart - a.tStart);
    for (const sc of sameScene) chain.push(sc);
    return chain;
  }

  // Último kf efectivo (incl. herencia) cuyo t <= playhead.
  // Si no hay kfs en el plano actual, busca en planos anteriores de la cadena.
  function ceLastKfWithInheritance(kfs, scene, playhead) {
    if (!scene) return null;
    const chain = ceInheritanceChain(scene);
    const chainIds = new Set(chain.map(s => s.id));
    const candidates = (kfs || []).filter(k => {
      if (k.sceneId === undefined || k.sceneId === null) {
        return chain.some(s => k.t >= s.tStart && k.t < s.tEnd) && k.t <= playhead + 0.001;
      }
      return chainIds.has(k.sceneId) && k.t <= playhead + 0.001;
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.t - b.t);
    return candidates[candidates.length - 1];
  }

  function ceComputeWallStateAt(t) {
    const scene = ceSceneAt(t);
    if (!scene) return { hiddenIds: new Set() };
    const allKfs = (ceState.cutscene.walls && ceState.cutscene.walls.keyframes) || [];
    // 1) kfs del plano actual con t <= playhead
    const inScene = ceFilterKfsToScene(allKfs, scene).filter(k => k.t <= t + 1e-6);
    if (inScene.length > 0) {
      let best = null;
      for (const kf of inScene) if (!best || kf.t > best.t) best = kf;
      return { hiddenIds: new Set(best.hiddenIds || []) };
    }
    // 2) Si no hay, heredar de planos anteriores (si scene.inheritState=true)
    const inh = ceLastKfWithInheritance(allKfs, scene, t);
    if (inh) return { hiddenIds: new Set(inh.hiddenIds || []) };
    return { hiddenIds: new Set() };
  }
  // Aplica un set de hiddenIds al scene actual. Toca walls + props + roof meshes.
  // Cuando se oculta una pared con id 'N:cx,cy' o 'W:cx,cy' que tiene una puerta
  // en esa celda, también se oculta el panel + pivot de la puerta para que la
  // puerta entera desaparezca como un solo elemento.
  function ceApplyWallState(hiddenIds) {
    // Mapa de doorProps por celda+side para cross-link con walls
    const doorByCell = new Map();   // 'N:cx,cy' or 'W:cx,cy' → doorProp
    for (const p of props) {
      if (p.category !== 'door') continue;
      // side='N' → wallFace 'N:cx,cy'
      // side='S' → wallFace 'N:cx,cy+1'
      // side='W' → wallFace 'W:cx,cy'
      // side='E' → wallFace 'W:cx+1,cy'
      let key;
      if (p.side === 'N') key = 'N:' + p.cx + ',' + p.cy;
      else if (p.side === 'S') key = 'N:' + p.cx + ',' + (p.cy + 1);
      else if (p.side === 'W') key = 'W:' + p.cx + ',' + p.cy;
      else if (p.side === 'E') key = 'W:' + (p.cx + 1) + ',' + p.cy;
      if (key) doorByCell.set(key, p);
    }
    const hiddenDoorIds = new Set();
    for (const id of hiddenIds) {
      const door = doorByCell.get(id);
      if (door) hiddenDoorIds.add(door.id);
    }
    for (const obj of sceneObjects) {
      if (!obj.userData) continue;
      if (obj.userData.wallFace) {
        const id = ceWallIdFromFace(obj.userData.wallFace);
        obj.visible = !id || !hiddenIds.has(id);
      } else if (obj.userData.doorPanel) {
        // Panel + pivot de puerta — ocultar si su id está en hiddenIds explícito
        // (clic directo) O si la pared adyacente está oculta.
        const doorId = obj.userData.doorPanel.propId;
        const propIdKey = 'P:' + doorId;
        obj.visible = !hiddenIds.has(propIdKey) && !hiddenDoorIds.has(doorId);
      } else if (obj.userData.prop) {
        const id = 'P:' + obj.userData.prop.id;
        // Si el prop es una puerta, también afectado por hiddenDoorIds (cross-link)
        const isDoorProp = obj.userData.prop.category === 'door';
        obj.visible = !hiddenIds.has(id) && !(isDoorProp && hiddenDoorIds.has(obj.userData.prop.id));
      }
    }
    // Techo: si está oculto, ocultar todos los meshes
    const roofHidden = hiddenIds.has('ROOF');
    for (const m of roofObjects) {
      m.visible = !roofHidden;
    }
  }
  // Restaurar todo a visible (al cerrar editor o salir del modo)
  function ceRestoreAllWalls() {
    for (const obj of sceneObjects) {
      if (!obj.userData) continue;
      if (obj.userData.wallFace || obj.userData.prop || obj.userData.doorPanel) obj.visible = true;
    }
    for (const m of roofObjects) m.visible = true;
  }

  // Helper central: togglea la visibilidad de un elemento (pared/mueble/techo)
  // en el playhead actual. Si NO hay kf en el playhead, lo crea con un snapshot
  // del estado actual + este toggle aplicado. Si YA hay kf en el playhead, lo
  // actualiza. Refresca tracks + visual.
  function ceToggleElementAtPlayhead(elementId) {
    if (!elementId) return;
    const t = ceState.playhead;
    const wallsKfs = ceState.cutscene.walls.keyframes;
    // Estado actual antes del toggle
    const stateNow = ceComputeWallStateAt(t);
    const newSet = new Set(stateNow.hiddenIds);
    if (newSet.has(elementId)) newSet.delete(elementId);
    else newSet.add(elementId);
    // Buscar/crear kf en t
    const existing = wallsKfs.find(k => Math.abs(k.t - t) < 0.05);
    if (existing) {
      existing.hiddenIds = Array.from(newSet);
    } else {
      wallsKfs.push({ t, hiddenIds: Array.from(newSet) });
      wallsKfs.sort((a, b) => a.t - b.t);
    }
    // Sync currentHiddenIds + visual
    ceState.currentHiddenIds = newSet;
    ceApplyWallState(newSet);
    ceState.applyOnce = true;   // próximo frame re-aplicará por seguridad
    ceRenderTracks();
  }

  function ceOpen() {
    if (ceState.open) return;
    ceState.open = true;
    // ── Backup de agentes del mundo y removerlos del scene + del array ──
    // Los agentes del mundo no deben aparecer durante cutscenes. Solo los
    // que la cutscene tiene en su lista propia se renderizan.
    ceState.worldAgentsBackup = agents.slice();
    for (const a of agents) {
      if (a.mesh) scene.remove(a.mesh);
      if (a.statusMesh) scene.remove(a.statusMesh);
    }
    agents.length = 0;

    // ── Spawn de los agentes propios de la cutscene ──
    // Sus posiciones iniciales se infieren del primer kf de move en su track.
    if (Array.isArray(ceState.cutscene.agents)) {
      for (const csa of ceState.cutscene.agents) {
        // Posición inicial: primer kf de move en su track, o (0,0) si no tiene
        let cx = 0, cy = 0;
        const tr = ceState.cutscene.tracks.find(t => t.agentId === csa.id);
        if (tr) {
          const moveKf = tr.keyframes.find(k => k.type === 'move');
          if (moveKf) { cx = moveKf.cx; cy = moveKf.cy; }
        }
        const a = spawnAgent(cx, cy, {
          id: csa.id, emoji: csa.emoji,
          voiceIdx: csa.voiceIdx, needs: csa.needs,
          csAgent: true,
        });
        if (a) a._csAgent = true;
      }
    }

    if (!ceState.selectedAgentId && agents.length > 0) {
      ceState.selectedAgentId = agents[0].id;
    }
    // Aplicar estado inicial de paredes/techo según playhead=0
    const initialWalls = ceComputeWallStateAt(0);
    ceState.currentHiddenIds = new Set(initialWalls.hiddenIds);
    ceApplyWallState(ceState.currentHiddenIds);
    // ── Inicializar gizmo de cámara cinemática ──
    buildCameraGizmo();
    const cam = ceState.cutscene.camera;
    if (!cam.gizmoPosition || !cam.gizmoTarget) {
      // Si la cutscene cargada no tiene gizmo state, usar el del primer kf nuevo
      const firstNewKf = (cam.keyframes || []).find(k => k.position && k.target);
      if (firstNewKf) {
        cam.gizmoPosition = { ...firstNewKf.position };
        cam.gizmoTarget = { ...firstNewKf.target };
        cam.gizmoRoll = firstNewKf.roll || 0;
        cam.gizmoLens = firstNewKf.lens || 50;
        cam.gizmoProjection = firstNewKf.projection || 'perspective';
      } else {
        cam.gizmoPosition = { x: 200, y: 250, z: 300 };
        cam.gizmoTarget = { x: 0, y: 30, z: 0 };
        cam.gizmoRoll = 0;
        cam.gizmoLens = 50;
        cam.gizmoProjection = 'perspective';
      }
    }
    if (cam.gizmoRoll === undefined) cam.gizmoRoll = 0;
    updateCameraGizmo();
    setCameraGizmoVisible(ceTypeSelect.value === 'camera');
    if (typeof ceSyncLensUI === 'function') ceSyncLensUI();
    // Asegurar que el modelo de scenes exista (migra desde cuts si es viejo)
    ceEnsureScenesInModel();
    ceEditor.classList.add('open');
    ceRefreshAgentSelect();
    if (typeof ceRefreshSavedSelect === 'function') ceRefreshSavedSelect();
    ceRenderRuler();
    ceRenderTracks();
    ceUpdatePlayheadPosition();
    ceUpdateTimeDisplay();
    ceUpdatePlayButton();
    if (typeof ceSyncSnapBtn === 'function') ceSyncSnapBtn();
  }

  function ceClose() {
    if (!ceState.open) return;
    ceState.open = false;
    ceState.playing = false;
    // Limpiar stack de undo/redo (no debería sobrevivir cierre de editor)
    ceState.undoStack.length = 0;
    ceState.redoStack.length = 0;
    // Limpiar animaciones cinemáticas + restaurar props base
    for (const a of agents) {
      if (a._cutsceneAnim) {
        ceResetAgentAnim(a);
        a._cutsceneAnim = null;
      }
    }
    // Limpiar todos los FX activos
    if (typeof ceClearAllFx === 'function') ceClearAllFx();

    // ── Remover agentes propios de la cutscene ──
    for (const a of agents) {
      if (a.mesh) scene.remove(a.mesh);
      if (a.statusMesh) scene.remove(a.statusMesh);
    }
    agents.length = 0;

    // ── Restaurar agentes del mundo ──
    if (ceState.worldAgentsBackup) {
      for (const a of ceState.worldAgentsBackup) {
        agents.push(a);
        if (a.mesh) scene.add(a.mesh);
        if (a.statusMesh) scene.add(a.statusMesh);
        a.path = []; a.target = null;
      }
      ceState.worldAgentsBackup = null;
    }

    ceState.selectedKf = null;
    ceState.selectedKfIsCamera = false;
    ceState.selectedKfIsWalls = false;
    ceState.addingAgent = false;
    document.body.classList.remove('cs-adding-agent');
    document.body.classList.remove('cs-walls-mode');
    setCameraGizmoVisible(false);
    // Restaurar todas las paredes/techo al estado original
    ceRestoreAllWalls();
    ceUpdateDeleteBtn();
    if (ceState.cutscene.camera.povActive) {
      ceState.cutscene.camera.povActive = false;
      cePovToggle.classList.remove('active');
    }
    document.body.classList.remove('pov-mode');
    if (typeof updatePovFrame === 'function') updatePovFrame();
    const fadeOverlay = document.getElementById('cs-fade-overlay');
    if (fadeOverlay) fadeOverlay.style.opacity = '0';
    updateCamera();
    ceEditor.classList.remove('open');
    ceUpdatePlayButton();
  }

  function ceTogglePlay() {
    if (!ceState.open) return;
    ceState.playing = !ceState.playing;
    if (ceState.playing && ceState.playhead >= ceState.cutscene.duration - 0.05) {
      ceState.playhead = 0;
    }
    if (ceState.playing) {
      // Reset trigger state al iniciar play (kfs anteriores al playhead no se disparan)
      for (const tr of ceState.cutscene.tracks) {
        tr.lastTriggeredT = ceState.playhead - 0.001;
      }
    } else {
      // Al pausar, forzar un frame más de aplicación para sync visual.
      // Limpiar cualquier _cutsceneAnim cache viejo (defensivo, ya no usado).
      ceState.applyOnce = true;
      for (const a of agents) {
        if (a._cutsceneAnim) { a._cutsceneAnim = null; }
      }
    }
    ceUpdatePlayButton();
  }

  function ceAddKeyframe() {
    ceSnapshot();   // undo
    const t = ceState.playhead;
    const type = ceTypeSelect.value;
    if (type === 'walls') {
      // Snapshot del estado actual de currentHiddenIds en el playhead
      const t = ceState.playhead;
      const wallsKfs = ceState.cutscene.walls.keyframes;
      const newHiddenIds = Array.from(ceState.currentHiddenIds);
      const existing = wallsKfs.find(k => Math.abs(k.t - t) < 0.05);
      let kfIdx;
      if (existing) {
        existing.hiddenIds = newHiddenIds;
        kfIdx = wallsKfs.indexOf(existing);
      } else {
        const newKf = { t, hiddenIds: newHiddenIds };
        ceAssignSceneIdToKf(newKf);
        wallsKfs.push(newKf);
        wallsKfs.sort((a, b) => a.t - b.t);
        kfIdx = wallsKfs.indexOf(newKf);
      }
      ceState.selectedKf = { trackIdx: -1, kfIdx };
      ceState.selectedKfIsCamera = false;
      ceState.selectedKfIsFx = false;
      ceState.selectedKfIsWalls = true;
      ceUpdateDeleteBtn();
      ceRenderTracks();
      return;
    }
    if (type === 'camera') {
      // Modelo nuevo: position {x,y,z} + target {x,y,z} desde el gizmo de cámara cinemática.
      const isCut = !!ceCutCheckbox.checked;
      const trans = isCut ? (ceTransSelect.value || 'none') : 'none';
      const transDurRaw = parseFloat(ceTransDurInput.value);
      const transDur = (!isNaN(transDurRaw) && transDurRaw > 0) ? transDurRaw : 0.5;
      const cam = ceState.cutscene.camera;
      const gizmoPos = cam.gizmoPosition || { x: 0, y: 200, z: 300 };
      const gizmoTgt = cam.gizmoTarget   || { x: 0, y: 0,   z: 0   };
      const lens = cam.gizmoLens || 50;
      const projection = cam.gizmoProjection || 'perspective';
      const roll = cam.gizmoRoll || 0;
      const kf = {
        t, type: 'camera',
        position: { ...gizmoPos },
        target:   { ...gizmoTgt },
        roll, lens, projection,
        cut: isCut, transition: trans, transitionDuration: transDur,
      };
      ceAssignSceneIdToKf(kf);
      const existing = cam.keyframes.find(k => Math.abs(k.t - t) < 0.05);
      if (existing) {
        existing.position = kf.position;
        existing.target = kf.target;
        existing.roll = kf.roll;
        existing.lens = kf.lens;
        existing.projection = kf.projection;
        existing.cut = isCut;
        existing.transition = trans;
        existing.transitionDuration = transDur;
      } else {
        cam.keyframes.push(kf);
        cam.keyframes.sort((a, b) => a.t - b.t);
      }
      ceRenderTracks();
      return;
    }
    if (type === 'fx') {
      const fxKind = ceFxSelect.value || 'smoke';
      const dRaw = parseFloat(ceDurationInput.value);
      const dur = (!isNaN(dRaw) && dRaw > 0) ? dRaw : (FX_PRESETS[fxKind]?.duration || 3.0);
      const pinFloor = !!cePinCheckbox.checked;
      // Determinar si agregamos kf a entidad seleccionada o creamos una nueva
      const fxEntities = ceState.cutscene.fx.entities;
      const selectedEnt = (ceState.selectedFxEntityIdx >= 0 && ceState.selectedFxEntityIdx < fxEntities.length)
        ? fxEntities[ceState.selectedFxEntityIdx] : null;
      if (pinFloor) {
        // Modo placement: click en piso completa la creación/adición
        ceState.fxPlacing = {
          fxKind, duration: dur, t,
          isNewEntity: !selectedEnt,
          entityIdx: selectedEnt ? ceState.selectedFxEntityIdx : -1,
        };
        document.body.classList.add('fx-placing');
        // Hint dinámico
        const hint = document.getElementById('fx-placement-hint');
        if (hint) {
          hint.textContent = selectedEnt
            ? `📍 Click en el piso para mover ${selectedEnt.kind} #${(selectedEnt.id||'').slice(-3)} · Esc cancela`
            : `📍 Click en el piso para crear FX ${fxKind} · Esc cancela`;
        }
        return;
      }
      // Sigue al agente seleccionado
      const ag = ceState.selectedAgentId
        ? agents.find(a => a.id === ceState.selectedAgentId) : agents[0];
      let target;
      if (ag) target = { kind: 'agent', id: ag.id };
      else    target = { kind: 'cell', cx: 3, cy: 3 };
      if (selectedEnt) {
        // Agregar kf a entidad existente
        const fxKf = { t, target };
        ceAssignSceneIdToKf(fxKf);
        selectedEnt.keyframes.push(fxKf);
        selectedEnt.keyframes.sort((a, b) => a.t - b.t);
      } else {
        // Crear nueva entidad
        const fxKf = { t, target };
        ceAssignSceneIdToKf(fxKf);
        const newEnt = {
          id: ceFxNewId(), kind: fxKind, duration: dur,
          keyframes: [fxKf],
        };
        fxEntities.push(newEnt);
        ceState.selectedFxEntityIdx = fxEntities.length - 1;
      }
      ceRenderTracks();
      ceState.applyOnce = true;
      return;
    }
    if (!ceState.selectedAgentId) return;
    const agent = agents.find(a => a.id === ceState.selectedAgentId);
    if (!agent) return;
    let track = ceState.cutscene.tracks.find(tr => tr.agentId === agent.id);
    if (!track) {
      track = { agentId: agent.id, keyframes: [], lastTriggeredT: -1 };
      ceState.cutscene.tracks.push(track);
    }
    const kf = { t, type };
    if (type === 'move') {
      kf.cx = agent.cx; kf.cy = agent.cy;
    } else if (type === 'speak') {
      kf.text = (ceTextInput.value || 'Hola').trim();
    } else if (type === 'animation') {
      kf.preset = ceAnimSelect.value || 'wave';
      const d = parseFloat(ceDurationInput.value);
      kf.duration = (!isNaN(d) && d > 0) ? d : (CE_ANIM_PRESETS[kf.preset]?.duration || 1.0);
    }
    const existing = track.keyframes.find(k => k.type === type && Math.abs(k.t - t) < 0.05);
    if (existing) {
      Object.assign(existing, kf);
    } else {
      ceAssignSceneIdToKf(kf);
      track.keyframes.push(kf);
      track.keyframes.sort((a, b) => a.t - b.t);
    }
    ceRenderTracks();
  }

  function ceDeleteSelectedKeyframe() {
    if (!ceState.selectedKf) return;
    ceSnapshot();   // undo
    const { trackIdx, kfIdx } = ceState.selectedKf;
    if (ceState.selectedKfIsCamera) {
      ceState.cutscene.camera.keyframes.splice(kfIdx, 1);
    } else if (ceState.selectedKfIsFx) {
      const entIdx = ceState.selectedFxEntityIdx;
      const ent = ceState.cutscene.fx.entities[entIdx];
      if (ent) {
        ent.keyframes.splice(kfIdx, 1);
        // Si la entidad quedó sin kfs, borrar la entidad entera
        if (ent.keyframes.length === 0) {
          const inst = _activeFxInstances.get(ent.id);
          if (inst) { despawnFxInstance(inst); _activeFxInstances.delete(ent.id); }
          ceState.cutscene.fx.entities.splice(entIdx, 1);
          ceState.selectedFxEntityIdx = -1;
        }
      }
    } else if (ceState.selectedKfIsWalls) {
      ceState.cutscene.walls.keyframes.splice(kfIdx, 1);
    } else {
      const track = ceState.cutscene.tracks[trackIdx];
      if (!track) { ceState.selectedKf = null; return; }
      track.keyframes.splice(kfIdx, 1);
    }
    ceState.selectedKf = null;
    ceState.selectedKfIsCamera = false;
    ceState.selectedKfIsFx = false;
    ceState.selectedKfIsWalls = false;
    ceUpdateDeleteBtn();
    ceUpdateToolbarFields();
    ceRenderTracks();
    ceState.applyOnce = true;
  }

  function ceUpdateDeleteBtn() {
    if (ceState.selectedKf) {
      ceDeleteBtn.style.display = '';
      ceDeleteBtn.disabled = false;
    } else {
      ceDeleteBtn.style.display = 'none';
      ceDeleteBtn.disabled = true;
    }
  }

  function ceSetPlayhead(t) {
    ceState.playhead = Math.max(0, Math.min(ceState.cutscene.duration, t));
    ceState.applyOnce = true;
    // Reset triggers para que speak/animation no se disparen al scrubear
    for (const tr of ceState.cutscene.tracks) tr.lastTriggeredT = ceState.playhead;
    // Auto-scroll si el playhead sale del viewport (estilo Premiere Pro)
    const w = ceRulerWidth();
    const pxRel = ceTimeToPixel(ceState.playhead, w);
    if (pxRel < 0 || pxRel > w) {
      // Centrar el playhead en el viewport
      const totalW = w * (ceState.zoom || 1);
      const newPxAbs = (ceState.playhead / ceState.cutscene.duration) * totalW;
      ceState.scrollX = newPxAbs - w / 2;
      ceClampScroll();
      ceRenderRuler();
      ceRenderTracks();
    }
    ceUpdatePlayheadPosition();
    ceUpdateTimeDisplay();
  }

  // ── Engine de playback (llamado en animate loop) ──
  // Aplicar pose+lens+roll a cinematicCamera solo si algo cambió.
  // Esto evita updateProjectionMatrix() en loop infinito que causaba flicker visual.
  const _camCache = { posX: NaN, posY: NaN, posZ: NaN, tgtX: NaN, tgtY: NaN, tgtZ: NaN, roll: NaN, lens: NaN, aspect: NaN };
  function applyPoseToCinematicCamera(pos, tgt, roll, lens) {
    const aspect = viewW / viewH;
    const same = (
      pos.x === _camCache.posX && pos.y === _camCache.posY && pos.z === _camCache.posZ &&
      tgt.x === _camCache.tgtX && tgt.y === _camCache.tgtY && tgt.z === _camCache.tgtZ &&
      roll === _camCache.roll && lens === _camCache.lens && aspect === _camCache.aspect
    );
    if (same) return;   // nada cambió → no tocar la cámara
    _camCache.posX = pos.x; _camCache.posY = pos.y; _camCache.posZ = pos.z;
    _camCache.tgtX = tgt.x; _camCache.tgtY = tgt.y; _camCache.tgtZ = tgt.z;
    _camCache.roll = roll; _camCache.lens = lens; _camCache.aspect = aspect;
    const fx = tgt.x - pos.x, fy = tgt.y - pos.y, fz = tgt.z - pos.z;
    const flen = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
    const fxn = fx / flen, fyn = fy / flen, fzn = fz / flen;
    const cR = Math.cos(roll), sR = Math.sin(roll);
    const dot = fyn;
    const upX = (fzn) * sR + fxn * dot * (1 - cR);
    const upY = cR + fyn * dot * (1 - cR);
    const upZ = (-fxn) * sR + fzn * dot * (1 - cR);
    cinematicCamera.up.set(upX, upY, upZ);
    cinematicCamera.position.set(pos.x, pos.y, pos.z);
    cinematicCamera.lookAt(tgt.x, tgt.y, tgt.z);
    const fovDeg = 2 * Math.atan(36 / (2 * lens)) * 180 / Math.PI;
    cinematicCamera.fov = fovDeg;
    cinematicCamera.aspect = aspect;
    cinematicCamera.updateProjectionMatrix();
  }

  function ceUpdate(dt) {
    if (!ceState.open) return;
    if (typeof updatePovOverlayTime === 'function') updatePovOverlayTime();
    if (ceState.playing) {
      ceState.playhead += dt;
      if (ceState.playhead >= ceState.cutscene.duration) {
        ceState.playhead = ceState.cutscene.duration;
        ceState.playing = false;
        ceUpdatePlayButton();
      }
      ceUpdatePlayheadPosition();
      ceUpdateTimeDisplay();
    }
    const applyKfs = ceState.playing || ceState.scrubbing || ceState.applyOnce;
    ceState.applyOnce = false;
    // ── CÁMARA CINEMÁTICA ── corre independiente de applyKfs cuando POV
    // está activo. Permite que WASD/QE/RF afecten el render sin tener que
    // recomputar walls/agentes/fx cada frame (que causaba flicker).
    try {
      const cam = ceState.cutscene.camera;
      if (cam && cam.povActive) {
        // Sin animación activa o sin kfs: usar pose actual del gizmo (editada por user)
        const useGizmoPose = !applyKfs && !ceState._gizmoDrag;
        const kfs = ((cam.keyframes) || []).filter(k => k.position && k.target);
        if (useGizmoPose || kfs.length === 0) {
          applyPoseToCinematicCamera(
            cam.gizmoPosition, cam.gizmoTarget, cam.gizmoRoll || 0, cam.gizmoLens || 50
          );
        }
        // Si applyKfs (playing/scrubbing) → la pose interpolada se aplica abajo
        // (en el bloque grande de cámara cinemática).
      }
    } catch (err) {
      console.warn('[ceUpdate camera POV early] error:', err);
    }
    // ── Detectar si el playhead está en un GAP entre planos ──
    // Si está en gap: overlay negro a 100% (pantalla negra como editor de video).
    // Si está dentro de un plano: overlay opacity=0.
    // Aplicamos siempre (con o sin POV) — un gap durante orto también muestra negro.
    // Nota: la pantalla negra durante un GAP entre planos se pinta directamente
    // en el render loop (clearing del canvas a negro). No usamos overlay HTML.
    if (!applyKfs) return;
    // ── Aplicar estado de paredes/techo según playhead ──
    // Sin estado pendiente: la fuente de verdad son siempre los kfs.
    const ws = ceComputeWallStateAt(ceState.playhead);
    ceState.currentHiddenIds = new Set(ws.hiddenIds);
    ceApplyWallState(ws.hiddenIds);
    // Sync texto del botón de techo
    const roofBtn = document.getElementById('ce-walls-roof');
    if (roofBtn) {
      roofBtn.textContent = ws.hiddenIds.has('ROOF') ? '🏠 Techo: oculto' : '🏠 Toggle techo';
    }
    // Detectar plano actual (los kfs solo afectan dentro de su plano — cuts entre planos)
    const currentScene = ceSceneAt(ceState.playhead);
    for (const track of ceState.cutscene.tracks) {
      if (track.keyframes.length === 0) continue;
      const agent = agents.find(a => a.id === track.agentId);
      if (!agent) continue;
      if (agent === getDraggedAgent()) continue;

      // Filtrar kfs al plano actual.
      const kfsInScene = ceFilterKfsToScene(track.keyframes, currentScene);
      // Solo kfs de movimiento (states) heredan; speak/animation (events) no.
      const moveKfsAll = (track.keyframes || []).filter(k => k.type === 'move');
      const inheritedMoveKf = (kfsInScene.filter(k => k.type === 'move').length === 0)
        ? ceLastKfWithInheritance(moveKfsAll, currentScene, ceState.playhead)
        : null;
      // Si no tiene kfs en el plano actual NI hereda, ocultar
      if (kfsInScene.length === 0 && !inheritedMoveKf) {
        if (agent.mesh) agent.mesh.visible = false;
        continue;
      }
      if (agent.mesh) agent.mesh.visible = true;

      // ── Trigger SPEAK durante playing (no heredan, son eventos) ──
      if (ceState.playing) {
        const lastT = (track.lastTriggeredT === undefined) ? -1 : track.lastTriggeredT;
        for (const kf of kfsInScene) {
          if (kf.type === 'speak' && kf.t > lastT && kf.t <= ceState.playhead) {
            showSpeechBubble(agent, kf.text || '', { autoCloseAfter: 2.5 });
          }
        }
        track.lastTriggeredT = ceState.playhead;
      }

      // ── ANIMATION (eventos: solo del plano actual, no heredan) ──
      let activeAnim = null;
      for (const kf of kfsInScene) {
        if (kf.type !== 'animation') continue;
        const dur = kf.duration ?? CE_ANIM_PRESETS[kf.preset || 'wave']?.duration ?? 1.0;
        if (ceState.playhead >= kf.t && ceState.playhead < kf.t + dur) {
          if (!activeAnim || kf.t > activeAnim.t) activeAnim = kf;
        }
      }
      if (activeAnim) {
        const dur = activeAnim.duration ?? CE_ANIM_PRESETS[activeAnim.preset || 'wave']?.duration ?? 1.0;
        const progress = (ceState.playhead - activeAnim.t) / dur;
        ceApplyAnimEffect(agent, activeAnim.preset || 'wave', progress);
      } else {
        ceResetAgentAnim(agent);
      }

      // ── Posición: kfs de movimiento del plano actual (con herencia si no hay) ──
      const moveKfs = kfsInScene.filter(k => k.type === 'move');
      if (moveKfs.length === 0 && inheritedMoveKf) {
        // Posición heredada: agente quieto en la última posición conocida
        agent.px = inheritedMoveKf.cx + 0.5;
        agent.py = inheritedMoveKf.cy + 0.5;
        agent.cx = inheritedMoveKf.cx;
        agent.cy = inheritedMoveKf.cy;
        if (!activeAnim) agent.hopping = false;
        if (agent.mesh) syncAgentMesh(agent);
        continue;
      }
      if (moveKfs.length === 0) {
        if (agent.mesh) syncAgentMesh(agent);
        continue;
      }
      let prev = null, next = null;
      for (let i = 0; i < moveKfs.length; i++) {
        if (moveKfs[i].t <= ceState.playhead) prev = moveKfs[i];
        else { next = moveKfs[i]; break; }
      }
      // Si no hay prev en el plano actual pero hay heredado, usar como base
      if (!prev && inheritedMoveKf) prev = inheritedMoveKf;
      if (prev && next) {
        const lerp = (next.t === prev.t) ? 0 : (ceState.playhead - prev.t) / (next.t - prev.t);
        const px = prev.cx + (next.cx - prev.cx) * lerp + 0.5;
        const py = prev.cy + (next.cy - prev.cy) * lerp + 0.5;
        agent.px = px; agent.py = py;
        agent.cx = Math.round(px - 0.5);
        agent.cy = Math.round(py - 0.5);
        if (ceState.playing && (next.cx !== prev.cx || next.cy !== prev.cy)) {
          if (!activeAnim) {     // anim override hopping
            agent.hopping = true;
            agent.hopTime += dt * agent.hopFreq * Math.PI;
          }
          const dx = next.cx - prev.cx;
          if (Math.abs(dx) > 0.001 && typeof setAgentFacing === 'function') {
            setAgentFacing(agent, dx > 0 ? 'left' : 'right');
          }
        } else if (!activeAnim) {
          agent.hopping = false;
        }
      } else if (prev) {
        agent.px = prev.cx + 0.5; agent.py = prev.cy + 0.5;
        agent.cx = prev.cx; agent.cy = prev.cy;
        if (!activeAnim) agent.hopping = false;
      } else if (next) {
        agent.px = next.cx + 0.5; agent.py = next.cy + 0.5;
        agent.cx = next.cx; agent.cy = next.cy;
        if (!activeAnim) agent.hopping = false;
      }
      if (agent.mesh) syncAgentMesh(agent);
    }

    // ── CÁMARA CINEMÁTICA — interpolar pose desde kfs ──
    // Modelo: kf = {t, position:{x,y,z}, target:{x,y,z}, lens, projection, cut, transition}
    // Durante play/scrub, recomputamos la pose interpolada y la aplicamos:
    //   - Siempre al gizmo (para que veas el movimiento en el editor).
    //   - A la cámara real solo si POV activo.
    // Cuando NO play/scrub y NO drag de gizmo, el usuario es libre de manipular el gizmo.
    try {
      const cam = ceState.cutscene.camera;
      const allKfs = ((cam && cam.keyframes) || []).filter(k => k.position && k.target);
      // Filtrar a solo los kfs del plano actual
      const sceneAtPh = ceSceneAt(ceState.playhead);
      const kfs = ceFilterKfsToScene(allKfs, sceneAtPh);
      const isAnimating = (ceState.playing || ceState.scrubbing);
      const userDragging = !!(ceState && ceState._gizmoDrag);
      // Si no hay kfs en el plano actual pero podemos heredar, usar el último
      // kf accesible vía cadena de continuidad.
      let inheritedKf = null;
      if (kfs.length === 0 && sceneAtPh && isAnimating && !userDragging) {
        inheritedKf = ceLastKfWithInheritance(allKfs, sceneAtPh, ceState.playhead);
      }
      if ((kfs.length > 0 || inheritedKf) && isAnimating && !userDragging) {
        let prevK = null, nextK = null;
        if (kfs.length > 0) {
          for (let i = 0; i < kfs.length; i++) {
            if (kfs[i].t <= ceState.playhead) prevK = kfs[i];
            else { nextK = kfs[i]; break; }
          }
        }
        // Si no hay prevK en el plano actual, usar el heredado como base
        if (!prevK && inheritedKf) prevK = inheritedKf;
        let pos = null, tgt = null, roll = 0, lensInterp = 50;
        if (prevK && nextK) {
          if (nextK.cut) {
            pos = { ...prevK.position }; tgt = { ...prevK.target };
            roll = prevK.roll || 0;
            lensInterp = prevK.lens || 50;
          } else {
            const lerp = (nextK.t === prevK.t) ? 0 : (ceState.playhead - prevK.t) / (nextK.t - prevK.t);
            pos = {
              x: prevK.position.x + (nextK.position.x - prevK.position.x) * lerp,
              y: prevK.position.y + (nextK.position.y - prevK.position.y) * lerp,
              z: prevK.position.z + (nextK.position.z - prevK.position.z) * lerp,
            };
            tgt = {
              x: prevK.target.x + (nextK.target.x - prevK.target.x) * lerp,
              y: prevK.target.y + (nextK.target.y - prevK.target.y) * lerp,
              z: prevK.target.z + (nextK.target.z - prevK.target.z) * lerp,
            };
            roll = (prevK.roll || 0) + ((nextK.roll || 0) - (prevK.roll || 0)) * lerp;
            lensInterp = (prevK.lens || 50) + ((nextK.lens || 50) - (prevK.lens || 50)) * lerp;
          }
        } else if (prevK) {
          pos = { ...prevK.position }; tgt = { ...prevK.target };
          roll = prevK.roll || 0;
          lensInterp = prevK.lens || 50;
        } else if (nextK) {
          pos = { ...nextK.position }; tgt = { ...nextK.target };
          roll = nextK.roll || 0;
          lensInterp = nextK.lens || 50;
        }
        if (pos && tgt) {
          // Parent agent: target sigue al agente, position se traslada igual
          if (cam.parentAgentId) {
            const pa = agents.find(a => a.id === cam.parentAgentId);
            if (pa) {
              const ax = pa.px * CELL - centerX;
              const az = pa.py * CELL - centerZ;
              const dx = ax - tgt.x;
              const dz = az - tgt.z;
              tgt.x = ax; tgt.z = az;
              pos.x += dx; pos.z += dz;
            }
          }
          // Sync gizmo pose (visual del gizmo refleja el frame actual)
          cam.gizmoPosition = { ...pos };
          cam.gizmoTarget = { ...tgt };
          cam.gizmoRoll = roll;
          cam.gizmoLens = lensInterp;
          // Solo redibujar gizmo si está visible (POV oculta el gizmo)
          if (cameraGizmo && cameraGizmo.group.visible && typeof updateCameraGizmo === 'function') {
            updateCameraGizmo();
          }
          // Aplicar a cámara cinemática real solo en POV (incluyendo up vector con roll)
          if (cam.povActive) {
            applyPoseToCinematicCamera(pos, tgt, roll, lensInterp);
          }
        }
      } else if (cam && cam.povActive && cam.gizmoPosition && cam.gizmoTarget) {
        // POV sin animación activa — usar pose actual del gizmo (lo que el user editó)
        applyPoseToCinematicCamera(
          cam.gizmoPosition, cam.gizmoTarget, cam.gizmoRoll || 0, cam.gizmoLens || 50
        );
      }
    } catch (err) {
      console.warn('[ceUpdate camera] error:', err);
    }

    // ── FX KEYFRAMES (entidades movibles con sprite seguidor) ──
    // Cada plano es isla: solo activamos FX cuyos kfs caen en el plano actual.
    try {
      const fxEntities = ceState.cutscene.fx ? ceState.cutscene.fx.entities : [];
      const activeIds = new Set();
      for (const ent of fxEntities) {
        if (!ent.keyframes || ent.keyframes.length === 0) continue;
        // Filtrar kfs al plano actual
        const kfsInScene = ceFilterKfsToScene(ent.keyframes, currentScene);
        if (kfsInScene.length === 0) continue;
        const dur = ent.duration || FX_PRESETS[ent.kind || 'smoke']?.duration || 3.0;
        const firstT = kfsInScene[0].t;
        const lastT = kfsInScene[kfsInScene.length - 1].t;
        const endT = lastT + dur;
        const ph = ceState.playhead;
        if (ph >= firstT && ph < endT) {
          activeIds.add(ent.id);
          let inst = _activeFxInstances.get(ent.id);
          if (!inst) {
            inst = spawnFxInstance({ fx: ent.kind });
            if (inst) _activeFxInstances.set(ent.id, inst);
          }
          if (inst) {
            // Interpolar posición entre kfs DEL plano
            let prev = null, next = null;
            for (let i = 0; i < kfsInScene.length; i++) {
              if (kfsInScene[i].t <= ph) prev = kfsInScene[i];
              else { next = kfsInScene[i]; break; }
            }
            let target = null;
            if (prev && next) {
              const lerp = (next.t === prev.t) ? 0 : (ph - prev.t) / (next.t - prev.t);
              target = ceFxInterpolateTarget(prev.target, next.target, lerp);
            } else if (prev) target = prev.target;
            else if (next) target = next.target;
            const totalDur = endT - firstT;
            const progress = totalDur > 0 ? (ph - firstT) / totalDur : 0;
            updateFxInstance({ fx: ent.kind, target, duration: totalDur }, inst, progress);
          }
        }
      }
      // Despawn los que ya no están activos
      for (const [id, inst] of _activeFxInstances.entries()) {
        if (!activeIds.has(id)) {
          despawnFxInstance(inst);
          _activeFxInstances.delete(id);
        }
      }
    } catch (err) {
      console.warn('[ceUpdate fx] error:', err);
    }

    // ── Fade overlay para transiciones de cámara (solo en POV/Preview) ──
    try {
      const overlay = document.getElementById('cs-fade-overlay');
      if (overlay) {
        const cam = ceState.cutscene.camera;
        // En el editor (sin POV) no aplicamos fade para no oscurecer la vista
        if (!cam || !cam.povActive) {
          overlay.style.opacity = '0';
        } else {
          const camKfs = cam.keyframes || [];
          const ph = ceState.playhead;
          let opacity = 0;
          for (const kf of camKfs) {
            if (kf.cut && kf.transition === 'fade') {
              const fadeRange = (kf.transitionDuration && kf.transitionDuration > 0) ? kf.transitionDuration : 0.5;
              const dist = Math.abs(kf.t - ph);
              if (dist < fadeRange) {
                const a = 1 - (dist / fadeRange);
                if (a > opacity) opacity = a;
              }
            }
          }
          overlay.style.opacity = opacity.toFixed(3);
        }
      }
    } catch (err) {
      console.warn('[ceUpdate fade] error:', err);
    }
  }

  // ── Helper: cámara real bloqueada (POV cinemática activo) ──
  function isCameraLocked() {
    return ceState.open && ceState.cutscene.camera.povActive;
  }

  // Helper para que updateAgents skip agentes mientras el editor está abierto.
  // Mientras está abierto, NINGÚN agente toma decisiones autónomas. Si el
  // usuario los dragea, ese drag tiene prioridad. Si hay playback, ceUpdate
  // los maneja. Si no, quedan donde estén.
  function isCutsceneControlled(agent) {
    return ceState.open;
  }
  // Exponer para que updateAgents lo use
  window._isCutsceneControlled = isCutsceneControlled;

  // ── Listeners ──
  document.getElementById('btn-cutscene').addEventListener('click', ceOpen);
  document.getElementById('ce-close').addEventListener('click', ceClose);
  cePlayBtn.addEventListener('click', ceTogglePlay);
  document.getElementById('ce-rewind').addEventListener('click', () => ceSetPlayhead(0));
  document.getElementById('ce-end').addEventListener('click', () => ceSetPlayhead(ceState.cutscene.duration));
  document.getElementById('ce-step-back').addEventListener('click', () => ceSetPlayhead(ceState.playhead - 1));
  document.getElementById('ce-step-fwd').addEventListener('click', () => ceSetPlayhead(ceState.playhead + 1));
  document.getElementById('ce-add-kf').addEventListener('click', ceAddKeyframe);
  document.getElementById('ce-new-fx').addEventListener('click', () => {
    // Forzar creación de NUEVA entidad FX: deselecciona la actual y entra
    // en placement mode con el kind del dropdown.
    ceState.selectedFxEntityIdx = -1;
    if (ceTypeSelect.value !== 'fx') ceTypeSelect.value = 'fx';
    if (!cePinCheckbox.checked) cePinCheckbox.checked = true;
    ceUpdateToolbarFields();
    ceRenderTracks();
    ceAddKeyframe();
  });
  document.getElementById('ce-new-agent').addEventListener('click', () => {
    // Entra en placement mode para crear un agente propio de la cutscene.
    if (!ceState.open) return;
    ceState.addingAgent = true;
    document.body.classList.add('cs-adding-agent');
  });
  // Toggle techo: igual que click directo en otros elementos, crea/actualiza kf en playhead.
  document.getElementById('ce-walls-roof').addEventListener('click', () => {
    if (!ceState.open) return;
    if (!roofVisible) {
      // Activar el techo global primero, así existen meshes que togglear
      setRoofVisible(true);
    }
    ceToggleElementAtPlayhead('ROOF');
    const btn = document.getElementById('ce-walls-roof');
    btn.textContent = ceState.currentHiddenIds.has('ROOF') ? '🏠 Techo: oculto' : '🏠 Toggle techo';
  });
  // Restaurar todo: crea/actualiza kf en playhead con hiddenIds=[] (todo visible).
  // Útil para cambiar de plano sin tener que clickear cada elemento oculto.
  document.getElementById('ce-walls-restore').addEventListener('click', () => {
    if (!ceState.open) return;
    const t = ceState.playhead;
    const wallsKfs = ceState.cutscene.walls.keyframes;
    const existing = wallsKfs.find(k => Math.abs(k.t - t) < 0.05);
    if (existing) {
      existing.hiddenIds = [];
    } else {
      wallsKfs.push({ t, hiddenIds: [] });
      wallsKfs.sort((a, b) => a.t - b.t);
    }
    ceState.currentHiddenIds = new Set();
    ceApplyWallState(ceState.currentHiddenIds);
    ceState.applyOnce = true;
    const roofBtn = document.getElementById('ce-walls-roof');
    if (roofBtn) roofBtn.textContent = '🏠 Toggle techo';
    ceRenderTracks();
  });
  // Reset cámara cinemática: posición/target a una pose por default
  document.getElementById('ce-cam-reset').addEventListener('click', () => {
    if (!ceState.open) return;
    ceResetCameraGizmo();
  });
  // Click en indicador de zoom → reset
  document.getElementById('ce-zoom-indicator').addEventListener('click', () => {
    if (!ceState.open) return;
    ceState.zoom = 1;
    ceState.scrollX = 0;
    ceRenderRuler();
    ceRenderTracks();
    ceUpdatePlayheadPosition();
  });
  // Toggle modo tijera (la lógica de corte llega en próxima entrega)
  document.getElementById('ce-scissors').addEventListener('click', () => {
    if (!ceState.open) return;
    ceState.scissorsMode = !ceState.scissorsMode;
    const btn = document.getElementById('ce-scissors');
    if (ceState.scissorsMode) {
      btn.style.background = 'rgba(255, 220, 100, 0.55)';
      btn.style.color = '#fff';
      document.body.classList.add('cs-scissors-mode');
    } else {
      btn.style.background = 'rgba(220, 200, 100, 0.18)';
      btn.style.color = 'rgba(240, 220, 140, 1)';
      document.body.classList.remove('cs-scissors-mode');
    }
  });
  // Toggle del snap entre planos
  function ceSyncSnapBtn() {
    const btn = document.getElementById('ce-snap-toggle');
    if (!btn) return;
    if (ceState.snapEnabled) {
      btn.style.background = 'rgba(120, 170, 255, 0.55)';
      btn.style.color = '#fff';
      btn.style.borderColor = 'rgba(120, 170, 255, 0.85)';
    } else {
      btn.style.background = 'rgba(120, 170, 255, 0.06)';
      btn.style.color = 'rgba(180, 210, 255, 0.55)';
      btn.style.borderColor = 'rgba(120, 170, 255, 0.20)';
    }
  }
  document.getElementById('ce-snap-toggle').addEventListener('click', () => {
    if (!ceState.open) return;
    ceState.snapEnabled = !ceState.snapEnabled;
    ceSyncSnapBtn();
  });

  // Lens preset select
  document.getElementById('ce-cam-lens-preset').addEventListener('change', (ev) => {
    if (!ceState.open) return;
    const v = ev.target.value;
    if (v === 'custom') return;   // slider hace el trabajo
    ceSetCameraLens(parseInt(v, 10));
    ceSyncLensUI();
  });
  // Lens slider — drag continuo. Solo grabamos kf al soltar para no llenar.
  let _lensDragging = false;
  document.getElementById('ce-cam-lens-slider').addEventListener('input', (ev) => {
    if (!ceState.open) return;
    _lensDragging = true;
    const v = parseInt(ev.target.value, 10);
    // Update visual sin grabar kf en cada paso (skipRecord)
    ceSetCameraLens(v, { skipRecord: true });
    ceSyncLensUI();
  });
  document.getElementById('ce-cam-lens-slider').addEventListener('change', (ev) => {
    if (!ceState.open) return;
    // change dispara al soltar el slider — ahora sí grabamos kf con el valor final
    const v = parseInt(ev.target.value, 10);
    ceSetCameraLens(v);
    _lensDragging = false;
    ceSyncLensUI();
  });
  ceDeleteBtn.addEventListener('click', ceDeleteSelectedKeyframe);

  // ══════════════════════════════════════════════════════════════
  //  PERSISTENCIA DE CUTSCENES (localStorage)
  // ══════════════════════════════════════════════════════════════
  // CUTSCENES_STORAGE_KEY + load/write helpers ahora en src/cutscene/persistence.ts.
  // Aliases locales para no cambiar callsites:
  const ceLoadAllSaved = loadAllSavedCutscenes;
  const ceWriteAllSaved = writeAllSavedCutscenes;
  function ceRefreshSavedSelect() {
    const saved = ceLoadAllSaved();
    const names = Object.keys(saved).sort();
    const cur = ceState.cutsceneName || '';
    ceSavedSelect.innerHTML = '';
    const optNew = document.createElement('option');
    optNew.value = ''; optNew.textContent = '— sin guardar —';
    ceSavedSelect.appendChild(optNew);
    for (const name of names) {
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      ceSavedSelect.appendChild(opt);
    }
    ceSavedSelect.value = cur;
    // Botón delete activo solo si hay cutscene cargada
    ceDeleteCsBtn.disabled = !cur;
    ceDeleteCsBtn.style.opacity = cur ? '1' : '0.4';
  }
  function ceSerializeCutscene() {
    return JSON.parse(JSON.stringify({
      duration: ceState.cutscene.duration,
      tracks: ceState.cutscene.tracks.map(tr => ({
        agentId: tr.agentId,
        keyframes: tr.keyframes,
      })),
      camera: {
        keyframes: ceState.cutscene.camera.keyframes,
        parentAgentId: ceState.cutscene.camera.parentAgentId,
      },
      fx: {
        entities: (ceState.cutscene.fx && ceState.cutscene.fx.entities) ? ceState.cutscene.fx.entities : [],
      },
      walls: {
        keyframes: (ceState.cutscene.walls && ceState.cutscene.walls.keyframes) ? ceState.cutscene.walls.keyframes : [],
      },
      agents: ceState.cutscene.agents || [],
      sceneNames: ceState.cutscene.sceneNames || {},
      scenes: ceState.cutscene.scenes || [],
    }));
  }

  // ── Undo/redo: snapshots de la cutscene completa ──
  // ceSnapshot() ANTES de cada acción discreta (mover/resize plano, tijera,
  // borrar/agregar kf, etc). Cmd+Z restaura el último snapshot.
  // Stack limitado a 50.
  const CE_UNDO_MAX = 50;
  function ceSnapshot() {
    try {
      const snap = ceSerializeCutscene();
      ceState.undoStack.push(JSON.stringify(snap));
      if (ceState.undoStack.length > CE_UNDO_MAX) ceState.undoStack.shift();
      ceState.redoStack.length = 0;   // nueva acción → invalida redo
    } catch (err) { console.warn('[ceSnapshot] error:', err); }
  }
  function ceUndo() {
    if (!ceState.undoStack.length) return;
    try {
      const cur = JSON.stringify(ceSerializeCutscene());
      const prev = ceState.undoStack.pop();
      ceState.redoStack.push(cur);
      ceApplyCutsceneData(JSON.parse(prev));
    } catch (err) { console.warn('[ceUndo] error:', err); }
  }
  function ceRedo() {
    if (!ceState.redoStack.length) return;
    try {
      const cur = JSON.stringify(ceSerializeCutscene());
      const next = ceState.redoStack.pop();
      ceState.undoStack.push(cur);
      ceApplyCutsceneData(JSON.parse(next));
    } catch (err) { console.warn('[ceRedo] error:', err); }
  }

  function ceApplyCutsceneData(data) {
    if (!data) return;
    if (typeof ceClearAllFx === 'function') ceClearAllFx();
    // Si el editor está abierto, primero remover los agentes de la cutscene
    // anterior (van a ser reemplazados por los del data nuevo).
    if (ceState.open) {
      for (const a of agents.slice()) {
        if (a._csAgent) {
          if (a.mesh) scene.remove(a.mesh);
          if (a.statusMesh) scene.remove(a.statusMesh);
          const idx = agents.indexOf(a);
          if (idx >= 0) agents.splice(idx, 1);
        }
      }
    }
    ceState.cutscene.duration = data.duration || 30;
    ceState.cutscene.tracks = (data.tracks || []).map(tr => ({
      agentId: tr.agentId,
      keyframes: tr.keyframes || [],
      lastTriggeredT: -1,
    }));
    ceState.cutscene.camera = {
      // Solo mantener kfs con el modelo nuevo (position+target). Los viejos
      // (theta/phi/zoom) se descartan — Pablo confirmó este reset.
      keyframes: ((data.camera && data.camera.keyframes) || []).filter(k => k.position && k.target),
      povActive: false,
      parentAgentId: (data.camera && data.camera.parentAgentId) || null,
    };
    // Re-inicializar gizmo state desde el primer kf cargado, si existe.
    {
      const firstKf = ceState.cutscene.camera.keyframes[0];
      if (firstKf) {
        ceState.cutscene.camera.gizmoPosition = { ...firstKf.position };
        ceState.cutscene.camera.gizmoTarget = { ...firstKf.target };
        ceState.cutscene.camera.gizmoRoll = firstKf.roll || 0;
        ceState.cutscene.camera.gizmoLens = firstKf.lens || 50;
        ceState.cutscene.camera.gizmoProjection = firstKf.projection || 'perspective';
      } else {
        ceState.cutscene.camera.gizmoPosition = { x: 200, y: 250, z: 300 };
        ceState.cutscene.camera.gizmoTarget = { x: 0, y: 30, z: 0 };
        ceState.cutscene.camera.gizmoRoll = 0;
        ceState.cutscene.camera.gizmoLens = 50;
        ceState.cutscene.camera.gizmoProjection = 'perspective';
      }
      if (typeof updateCameraGizmo === 'function') updateCameraGizmo();
      if (typeof ceSyncLensUI === 'function') ceSyncLensUI();
    }
    ceState.cutscene.fx = data.fx || { entities: [] };
    ceState.cutscene.walls = data.walls || { keyframes: [] };
    ceState.cutscene.sceneNames = data.sceneNames || {};   // legacy (mapa nombre por tStart)
    ceState.cutscene.scenes = Array.isArray(data.scenes) ? data.scenes.slice() : [];
    ceState.cutscene.agents = Array.isArray(data.agents) ? data.agents.slice() : [];
    // Si el editor está abierto, spawnar los agentes recién cargados
    if (ceState.open) {
      for (const csa of ceState.cutscene.agents) {
        let cx = 0, cy = 0;
        const tr = ceState.cutscene.tracks.find(t => t.agentId === csa.id);
        if (tr) {
          const moveKf = tr.keyframes.find(k => k.type === 'move');
          if (moveKf) { cx = moveKf.cx; cy = moveKf.cy; }
        }
        const a = spawnAgent(cx, cy, {
          id: csa.id, emoji: csa.emoji,
          voiceIdx: csa.voiceIdx, needs: csa.needs,
          csAgent: true,
        });
      }
      if (!ceState.selectedAgentId && agents.length > 0) {
        ceState.selectedAgentId = agents[0].id;
      }
      ceRefreshAgentSelect();
    }
    // Migrar formato viejo si aplica
    ceFxMigrateModel(ceState.cutscene);
    ceState.selectedFxEntityIdx = -1;
    cePovToggle.classList.remove('active');
    if (typeof updatePovFrame === 'function') updatePovFrame();
    ceState.selectedKf = null;
    ceState.selectedKfIsCamera = false;
    ceState.selectedKfIsFx = false;
    ceState.selectedKfIsWalls = false;
    // Aplicar el estado de paredes en t=0 si el editor está abierto
    if (ceState.open) {
      const ws = ceComputeWallStateAt(0);
      ceState.currentHiddenIds = new Set(ws.hiddenIds);
      ceApplyWallState(ceState.currentHiddenIds);
    }
    // Asegurar que el modelo de scenes exista (migración desde cuts viejos
    // o creación de plano default si la cutscene es vieja/vacía)
    if (typeof ceEnsureScenesInModel === 'function') ceEnsureScenesInModel();
    ceUpdateDeleteBtn();
    ceSetPlayhead(0);
    ceRenderRuler();
    ceRenderTracks();
    ceUpdateTimeDisplay();
    ceUpdateToolbarFields();
  }
  function ceSaveCurrent() {
    const defaultName = ceState.cutsceneName || 'Cutscene ' + new Date().toLocaleTimeString().slice(0, 5);
    showPrompt('Nombre de la cutscene:', defaultName, (name) => {
      const trimmed = (name || '').trim();
      if (!trimmed) return;
      const saved = ceLoadAllSaved();
      saved[trimmed] = ceSerializeCutscene();
      ceWriteAllSaved(saved);
      ceState.cutsceneName = trimmed;
      ceRefreshSavedSelect();
    });
  }
  function ceLoadByName(name) {
    if (!name) return;
    const saved = ceLoadAllSaved();
    const data = saved[name];
    if (!data) return;
    ceApplyCutsceneData(data);
    ceState.cutsceneName = name;
    ceRefreshSavedSelect();
  }
  function ceNewCutscene() {
    const hasContent = ceState.cutscene.tracks.some(t => t.keyframes.length > 0)
      || ceState.cutscene.camera.keyframes.length > 0
      || (ceState.cutscene.fx && ceState.cutscene.fx.entities && ceState.cutscene.fx.entities.length > 0)
      || (ceState.cutscene.walls && ceState.cutscene.walls.keyframes && ceState.cutscene.walls.keyframes.length > 0)
      || (ceState.cutscene.agents && ceState.cutscene.agents.length > 0);
    const blank = { duration: 30, tracks: [], camera: { keyframes: [], parentAgentId: null }, fx: { entities: [] }, walls: { keyframes: [] }, agents: [], sceneNames: {}, scenes: [] };
    if (hasContent) {
      if (typeof showConfirm === 'function') {
        showConfirm('Empezar una cutscene nueva? Los cambios sin guardar se perderán.', () => {
          ceApplyCutsceneData(blank);
          ceState.cutsceneName = null;
          ceRefreshSavedSelect();
        });
        return;
      }
    }
    ceApplyCutsceneData(blank);
    ceState.cutsceneName = null;
    ceRefreshSavedSelect();
  }
  function ceDeleteCurrent() {
    const name = ceState.cutsceneName;
    if (!name) return;
    const doIt = () => {
      const saved = ceLoadAllSaved();
      delete saved[name];
      ceWriteAllSaved(saved);
      ceState.cutsceneName = null;
      ceRefreshSavedSelect();
    };
    if (typeof showConfirm === 'function') {
      showConfirm('Borrar la cutscene "' + name + '"?', doIt);
    } else { doIt(); }
  }
  ceSaveBtn.addEventListener('click', ceSaveCurrent);
  ceNewBtn.addEventListener('click', ceNewCutscene);
  ceDeleteCsBtn.addEventListener('click', ceDeleteCurrent);
  ceSavedSelect.addEventListener('change', () => ceLoadByName(ceSavedSelect.value));
  cePovToggle.addEventListener('click', () => {
    const cam = ceState.cutscene.camera;
    cam.povActive = !cam.povActive;
    cePovToggle.classList.toggle('active', cam.povActive);
    document.body.classList.toggle('pov-mode', cam.povActive);
    // En POV, ocultar el gizmo (estamos DENTRO de la cámara). En edición
    // mostrarlo si type=camera.
    if (cam.povActive) {
      setCameraGizmoVisible(false);
    } else {
      setCameraGizmoVisible(ceTypeSelect.value === 'camera');
    }
    if (!cam.povActive) {
      updateCamera();
      hidePovControls();
    } else {
      ceState.applyOnce = true;
      showPovControls();
    }
    updatePovFrame();
  });

  // ── Modo Preview: ejecuta la cutscene en pantalla completa cinemática ──
  function cePreviewMode() {
    // Reset playhead a 0 + reset triggers
    ceState.playhead = 0;
    for (const tr of ceState.cutscene.tracks) tr.lastTriggeredT = -0.001;
    // Activar POV
    const cam = ceState.cutscene.camera;
    cam.povActive = true;
    cePovToggle.classList.add('active');
    document.body.classList.add('pov-mode');
    setCameraGizmoVisible(false);
    // Default a cinema si era full
    if (!ceState.povAspect || ceState.povAspect === 'full') {
      ceState.povAspect = 'cinema';
      ceAspectSelect.value = 'cinema';
    }
    updatePovFrame();
    // Iniciar playback
    ceState.playing = true;
    ceState.applyOnce = true;
    ceUpdatePlayButton();
    ceUpdatePlayheadPosition();
    showPovControls();
  }
  document.getElementById('ce-preview-btn').addEventListener('click', cePreviewMode);

  // ── POV controls overlay (estilo YouTube: aparece con mousemove, se oculta tras 2.5s) ──
  let _povControlsTimeout = null;
  function showPovControls() {
    const el = document.getElementById('pov-controls');
    if (!el) return;
    el.classList.add('visible');
    clearTimeout(_povControlsTimeout);
    _povControlsTimeout = setTimeout(() => {
      el.classList.remove('visible');
    }, 2500);
  }
  function hidePovControls() {
    const el = document.getElementById('pov-controls');
    if (el) el.classList.remove('visible');
    clearTimeout(_povControlsTimeout);
  }
  // Mostrar overlay con cualquier movimiento del mouse mientras POV activo
  window.addEventListener('mousemove', () => {
    if (document.body.classList.contains('pov-mode')) showPovControls();
  });
  // Wire de botones del overlay POV
  document.getElementById('pov-prev').addEventListener('click', () => ceSetPlayhead(0));
  document.getElementById('pov-back').addEventListener('click', () => ceSetPlayhead(ceState.playhead - 1));
  document.getElementById('pov-play').addEventListener('click', () => {
    ceTogglePlay();
    document.getElementById('pov-play').textContent = ceState.playing ? '⏸' : '▶';
  });
  document.getElementById('pov-fwd').addEventListener('click',  () => ceSetPlayhead(ceState.playhead + 1));
  document.getElementById('pov-next').addEventListener('click', () => ceSetPlayhead(ceState.cutscene.duration));
  document.getElementById('pov-exit').addEventListener('click', () => {
    cePovToggle.click();   // re-usa el toggle para salir limpio
  });
  // Sync periódico del time display y play button del overlay
  function updatePovOverlayTime() {
    if (!document.body.classList.contains('pov-mode')) return;
    const el = document.getElementById('pov-time');
    if (el) el.textContent = `${ceFormatTime(ceState.playhead)} / ${ceFormatTime(ceState.cutscene.duration)}`;
    const playBtn = document.getElementById('pov-play');
    if (playBtn) playBtn.textContent = ceState.playing ? '⏸' : '▶';
    const fill = document.getElementById('pov-progress-fill');
    if (fill) {
      const pct = Math.max(0, Math.min(100, (ceState.playhead / ceState.cutscene.duration) * 100));
      fill.style.width = `${pct}%`;
    }
  }
  // Click en la progress bar → seek
  const _povProgress = document.getElementById('pov-progress');
  if (_povProgress) {
    _povProgress.addEventListener('mousedown', (e) => {
      const rect = _povProgress.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      ceSetPlayhead(ratio * ceState.cutscene.duration);
      e.stopPropagation();
    });
  }
  // Hook en el animate loop — vamos a llamarlo desde ceUpdate

  // ── POV frame (barras negras según aspect ratio) ──
  const POV_ASPECTS = { full: 0, '16:9': 16/9, cinema: 2.39 };
  function updatePovFrame() {
    const frame = document.getElementById('pov-frame');
    if (!frame) return;
    const cam = ceState.cutscene && ceState.cutscene.camera;
    const aspectKey = (ceState.povAspect || 'full');
    const aspect = POV_ASPECTS[aspectKey] || 0;
    if (!cam || !cam.povActive || aspect === 0) {
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
  ceAspectSelect.addEventListener('change', () => {
    ceState.povAspect = ceAspectSelect.value;
    updatePovFrame();
  });
  window.addEventListener('resize', updatePovFrame);
  ceAgentSelect.addEventListener('change', () => {
    ceState.selectedAgentId = ceAgentSelect.value || null;
    ceRenderTracks();
  });

  // Scrub: mousedown en ruler o track-area → setear playhead, drag para mover
  function ceScrubFromEvent(e) {
    const labelW = 110;
    const rect = ceTimeline.getBoundingClientRect();
    const x = e.clientX - rect.left - labelW;
    const w = ceRulerWidth();
    const t = cePixelToTime(x, w);
    ceSetPlayhead(t);
  }
  // ── Interacciones con keyframes (select / drag / dblclick) ──
  let ceKfDragInfo = null;     // { trackIdx, kfIdx, isCamera, startX, startT, moved }
  let ceSceneDragInfo = null;  // { kind: 'move'|'resize-right'|'resize-left', scene, startX, shift, moved }
  // Wheel sobre timeline: cmd/ctrl+scroll = zoom, shift+scroll = pan horizontal
  ceTimeline.addEventListener('wheel', (e) => {
    if (!ceState.open) return;
    // Zoom con cmd/ctrl o trackpad pinch (e.ctrlKey true en pinch en mac)
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const w = ceRulerWidth();
      const labelW = 110;
      const tlRect = ceTimeline.getBoundingClientRect();
      const cursorPx = e.clientX - tlRect.left - labelW;
      // Tiempo bajo el cursor antes del zoom (para preservar)
      const tCursor = cePixelToTime(cursorPx, w);
      // Aplicar zoom (factor exponencial)
      const zoomFactor = Math.exp(-e.deltaY * 0.005);
      const oldZoom = ceState.zoom || 1;
      ceState.zoom = Math.max(0.25, Math.min(20, oldZoom * zoomFactor));
      // Ajustar scrollX para que tCursor quede bajo el cursor
      const totalW = w * ceState.zoom;
      const newPxAbsolute = (tCursor / ceState.cutscene.duration) * totalW;
      ceState.scrollX = newPxAbsolute - cursorPx;
      ceClampScroll();
      ceRenderRuler();
      ceRenderTracks();
      ceUpdatePlayheadPosition();
      return;
    }
    // Shift + scroll, o scroll horizontal nativo (deltaX) → pan
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      const delta = e.shiftKey ? e.deltaY : e.deltaX;
      ceState.scrollX = (ceState.scrollX || 0) + delta;
      ceClampScroll();
      ceRenderRuler();
      ceRenderTracks();
      ceUpdatePlayheadPosition();
      return;
    }
  }, { passive: false });
  ceTimeline.addEventListener('mousedown', (e) => {
    if (!ceState.open) return;
    // ── Modo tijera: click en cualquier parte del timeline corta ahí ──
    if (ceState.scissorsMode && e.button === 0) {
      const tlRect = ceTimeline.getBoundingClientRect();
      const labelW = 110;
      const x = e.clientX - tlRect.left - labelW;
      const w = ceRulerWidth();
      const t = cePixelToTime(x, w);
      e.preventDefault(); e.stopPropagation();
      if (ceInsertCutAt(t)) {
        // Desactivar tijera tras corte (UX más limpia)
        ceState.scissorsMode = false;
        const btn = document.getElementById('ce-scissors');
        if (btn) {
          btn.style.background = 'rgba(220, 200, 100, 0.18)';
          btn.style.color = 'rgba(240, 220, 140, 1)';
        }
        document.body.classList.remove('cs-scissors-mode');
      }
      return;
    }
    // ── Drag/resize de planos ──
    if (e.target.classList.contains('ce-scene-edge')) {
      const idx = parseInt(e.target.dataset.sceneIdx, 10);
      const edge = e.target.dataset.edge;
      const scenes = ceComputeScenes();
      const scene = scenes[idx];
      if (scene) {
        ceSnapshot();   // undo: snapshot antes de resize
        ceSceneDragInfo = {
          kind: edge === 'right' ? 'resize-right' : 'resize-left',
          scene: { ...scene },
          startX: e.clientX,
          shift: e.shiftKey,
          // Baseline: estado completo al inicio del drag para Esc cancel
          baseline: JSON.stringify(ceSerializeCutscene()),
        };
        e.preventDefault(); e.stopPropagation();
      }
      return;
    }
    if (e.target.classList.contains('ce-scene-block')) {
      const idx = parseInt(e.target.dataset.sceneIdx, 10);
      const scenes = ceComputeScenes();
      const scene = scenes[idx];
      if (scene) {
        // ── Shift+click: toggle membership en multiSel (no drag) ──
        if (e.shiftKey) {
          if (ceMultiSelHasScene(scene.id)) {
            ceState.multiSel.scenes = ceState.multiSel.scenes.filter(id => id !== scene.id);
          } else {
            ceState.multiSel.scenes.push(scene.id);
          }
          ceRenderTracks();
          e.preventDefault(); e.stopPropagation();
          return;
        }
        ceSnapshot();
        // ── Multi-selección: si este plano está en multiSel, drag de grupo ──
        if (ceMultiSelHasScene(scene.id) && ceMultiSelCount() > 1) {
          ceStartGroupDrag(scene.id, 'scene', e.clientX, e.altKey);
          e.preventDefault(); e.stopPropagation();
          return;
        }
        // ── Alt/Option = duplicar (plano individual) ──
        if (e.altKey) {
          const clone = ceCloneScene(scene, scene.tStart);
          ceSceneDragInfo = {
            kind: 'move',
            scene: { ...clone },
            startX: e.clientX,
            shift: e.shiftKey,
            moved: false,
            cloning: true,
            baseline: JSON.stringify(ceSerializeCutscene()),
          };
          ceRenderTracks();
          e.preventDefault(); e.stopPropagation();
          return;
        }
        // Click en plano fuera de multiSel: limpia multiSel
        if (ceMultiSelCount() > 0) ceMultiSelClear();
        ceSceneDragInfo = {
          kind: 'move',
          scene: { ...scene },
          startX: e.clientX,
          shift: e.shiftKey,
          moved: false,
          baseline: JSON.stringify(ceSerializeCutscene()),
        };
        e.preventDefault(); e.stopPropagation();
      }
      return;
    }
    if (e.target.classList.contains('ce-keyframe')) {
      const trackKind = e.target.dataset.trackKind;
      const isCamera = trackKind === 'camera';
      const isFx = trackKind === 'fx';
      const isWalls = trackKind === 'walls';
      const kfIdx = parseInt(e.target.dataset.kfIdx, 10);
      let kf, trackIdx;
      if (isCamera) {
        kf = ceState.cutscene.camera.keyframes[kfIdx];
        trackIdx = -1;
      } else if (isFx) {
        const entIdx = parseInt(e.target.dataset.fxEntityIdx, 10);
        const ent = ceState.cutscene.fx.entities[entIdx];
        kf = ent && ent.keyframes[kfIdx];
        trackIdx = -1;
        ceState.selectedFxEntityIdx = entIdx;
      } else if (isWalls) {
        kf = ceState.cutscene.walls.keyframes[kfIdx];
        trackIdx = -1;
      } else {
        trackIdx = parseInt(e.target.dataset.trackIdx, 10);
        const track = ceState.cutscene.tracks[trackIdx];
        kf = track && track.keyframes[kfIdx];
      }
      if (kf) {
        // ── Shift+click: toggle membership en multiSel ──
        const myKind = isCamera ? 'camera' : (isFx ? 'fx' : (isWalls ? 'walls' : 'agent'));
        const myFxEntIdx = isFx ? ceState.selectedFxEntityIdx : -1;
        if (e.shiftKey) {
          if (ceMultiSelHasKf(myKind, trackIdx, myFxEntIdx, kfIdx)) {
            ceState.multiSel.kfs = ceState.multiSel.kfs.filter(k =>
              !(k.kind === myKind &&
                (k.trackIdx ?? -1) === (trackIdx ?? -1) &&
                (k.fxEntityIdx ?? -1) === (myFxEntIdx ?? -1) &&
                k.kfIdx === kfIdx));
          } else {
            ceState.multiSel.kfs.push({ kind: myKind, trackIdx, fxEntityIdx: myFxEntIdx, kfIdx });
          }
          ceRenderTracks();
          e.preventDefault(); e.stopPropagation();
          return;
        }
        ceSnapshot();
        // ── Multi-selección: si este kf está en multiSel, arrancar drag de grupo ──
        if (ceMultiSelHasKf(myKind, trackIdx, myFxEntIdx, kfIdx) && ceMultiSelCount() > 1) {
          ceStartGroupDrag({ kind: myKind, trackIdx, fxEntityIdx: myFxEntIdx, kfIdx, t: kf.t },
            'kf', e.clientX, e.altKey);
          e.preventDefault(); e.stopPropagation();
          return;
        }
        // Click en kf fuera de multiSel: limpiar multiSel
        if (ceMultiSelCount() > 0) ceMultiSelClear();
        // ── Alt/Option = duplicar el kf (individual) ──
        let cloning = false;
        let workKfIdx = kfIdx;
        let workKf = kf;
        if (e.altKey) {
          let arr = null;
          if (isCamera) arr = ceState.cutscene.camera.keyframes;
          else if (isFx) {
            const ent = ceState.cutscene.fx.entities[ceState.selectedFxEntityIdx];
            arr = ent && ent.keyframes;
          } else if (isWalls) arr = ceState.cutscene.walls.keyframes;
          else {
            const track = ceState.cutscene.tracks[trackIdx];
            arr = track && track.keyframes;
          }
          if (arr) {
            // Deep-copy de los campos relevantes
            const clone = {
              ...kf,
              position: kf.position ? { ...kf.position } : kf.position,
              target: kf.target ? { ...kf.target } : kf.target,
              hiddenIds: kf.hiddenIds ? [...kf.hiddenIds] : kf.hiddenIds,
            };
            arr.push(clone);
            workKfIdx = arr.length - 1;
            workKf = clone;
            cloning = true;
          }
        }
        ceKfDragInfo = {
          trackIdx, kfIdx: workKfIdx, isCamera, isFx, isWalls,
          fxEntityIdx: isFx ? ceState.selectedFxEntityIdx : -1,
          startX: e.clientX, startT: workKf.t, moved: false,
          cloning,
          baseline: cloning ? JSON.stringify(ceSerializeCutscene()) : null,
        };
        ceState.selectedKf = { trackIdx, kfIdx: workKfIdx };
        ceState.selectedKfIsCamera = isCamera;
        ceState.selectedKfIsFx = isFx;
        ceState.selectedKfIsWalls = isWalls;
        // Al seleccionar un kf de walls, cargar su estado en pendingHiddenIds
        if (isWalls) {
          ceState.currentHiddenIds = new Set(workKf.hiddenIds || []);
          ceApplyWallState(ceState.currentHiddenIds);
        }
        if (isCamera && workKf.position && workKf.target) {
          const cam = ceState.cutscene.camera;
          cam.gizmoPosition = { ...workKf.position };
          cam.gizmoTarget = { ...workKf.target };
          cam.gizmoRoll = workKf.roll || 0;
          cam.gizmoLens = workKf.lens || 50;
          cam.gizmoProjection = workKf.projection || 'perspective';
          updateCameraGizmo();
          if (typeof ceSyncLensUI === 'function') ceSyncLensUI();
        }
        ceUpdateDeleteBtn();
        ceUpdateToolbarFields();
        ceRenderTracks();
      }
      e.preventDefault(); e.stopPropagation();
      return;
    }
    if (ceState.selectedKf) {
      ceState.selectedKf = null;
      ceState.selectedKfIsCamera = false;
      ceState.selectedKfIsFx = false;
      ceState.selectedKfIsWalls = false;
      ceUpdateDeleteBtn();
      ceUpdateToolbarFields();
      ceRenderTracks();
    }
    if (e.target.classList.contains('ce-track-label')) return;
    if (e.target.classList.contains('ce-track-area') ||
        e.target.classList.contains('ce-scenes-area')) {
      // ── Shift+drag = iniciar lasso (selección por área) ──
      if (e.shiftKey) {
        ceState.lassoDrag = {
          startX: e.clientX, startY: e.clientY,
          currX: e.clientX, currY: e.clientY,
          additive: e.metaKey || e.ctrlKey,   // Cmd/Ctrl mantiene selección previa
          started: false,
        };
        if (!ceState.lassoDrag.additive) ceMultiSelClear();
        e.preventDefault(); e.stopPropagation();
        return;
      }
      // Click sin shift en zona vacía: deseleccionar grupo si había
      if (ceMultiSelCount() > 0) {
        ceMultiSelClear();
        ceRenderTracks();
      }
      if (e.target.dataset.trackKind === 'fx') {
        const entIdx = parseInt(e.target.dataset.fxEntityIdx, 10);
        if (!isNaN(entIdx)) {
          ceState.selectedFxEntityIdx = entIdx;
          ceRenderTracks();
        }
      } else {
        const agentId = e.target.dataset.agentId;
        if (agentId) {
          ceState.selectedAgentId = agentId;
          ceAgentSelect.value = agentId;
          ceRenderTracks();
        }
      }
    }
    ceState.scrubbing = true;
    ceScrubFromEvent(e);
    e.preventDefault();
  });
  ceTimeline.addEventListener('dblclick', (e) => {
    // ── Doble-click en plano: abrir popover de rename + toggle inherit ──
    if (e.target.classList.contains('ce-scene-block')) {
      const sceneId = e.target.dataset.sceneId;
      const sc = (ceState.cutscene.scenes || []).find(s => s.id === sceneId);
      if (sc) ceOpenScenePopover(sc, e.target);
      e.preventDefault(); e.stopPropagation();
      return;
    }
    if (!e.target.classList.contains('ce-keyframe')) return;
    const trackKind = e.target.dataset.trackKind;
    const isCamera = trackKind === 'camera';
    const isFx = trackKind === 'fx';
    const kfIdx = parseInt(e.target.dataset.kfIdx, 10);
    if (isCamera) {
      const kf = ceState.cutscene.camera.keyframes[kfIdx];
      if (kf) {
        const cam = ceState.cutscene.camera;
        kf.position = { ...cam.gizmoPosition };
        kf.target = { ...cam.gizmoTarget };
        kf.lens = cam.gizmoLens || 50;
        kf.projection = cam.gizmoProjection || 'perspective';
        ceRenderTracks();
      }
    } else if (isFx) {
      const entIdx = parseInt(e.target.dataset.fxEntityIdx, 10);
      const ent = ceState.cutscene.fx.entities[entIdx];
      const kf = ent && ent.keyframes[kfIdx];
      if (kf && kf.target && kf.target.kind === 'cell') {
        // Entrar en modo placement para reposicionar este kf
        ceState.fxPlacing = {
          fxKind: ent.kind, duration: ent.duration, t: kf.t,
          isNewEntity: false, entityIdx: entIdx,
          replaceKfIdx: kfIdx,    // marca para reemplazar el kf existente
        };
        // Borrar el kf actual ahora; se recreará al hacer click
        ent.keyframes.splice(kfIdx, 1);
        ceState.selectedKf = null;
        ceState.selectedKfIsFx = false;
        document.body.classList.add('fx-placing');
        ceRenderTracks();
      } else if (ent) {
        // Si target es agent, ciclar el kind del FX
        const kinds = Object.keys(FX_PRESETS);
        const cur = kinds.indexOf(ent.kind);
        ent.kind = kinds[(cur + 1) % kinds.length];
        const inst = _activeFxInstances.get(ent.id);
        if (inst) { despawnFxInstance(inst); _activeFxInstances.delete(ent.id); }
        ceRenderTracks();
        ceState.applyOnce = true;
      }
    } else {
      const trackIdx = parseInt(e.target.dataset.trackIdx, 10);
      const track = ceState.cutscene.tracks[trackIdx];
      const kf = track && track.keyframes[kfIdx];
      if (!kf) return;
      if (kf.type === 'speak') {
        showPrompt('Texto a decir:', kf.text || '', (newText) => {
          if (newText !== null && newText !== undefined) {
            kf.text = (newText || '').trim();
            ceRenderTracks();
          }
        });
      } else if (kf.type === 'animation') {
        const presets = Object.keys(CE_ANIM_PRESETS);
        const cur = presets.indexOf(kf.preset);
        kf.preset = presets[(cur + 1) % presets.length];
        ceRenderTracks();
      } else if (kf.type === 'move') {
        const agent = agents.find(a => a.id === track.agentId);
        if (agent) { kf.cx = agent.cx; kf.cy = agent.cy; ceRenderTracks(); }
      }
    }
    e.preventDefault(); e.stopPropagation();
  });

  window.addEventListener('mousemove', (e) => {
    // ── Lasso (selección por área) ──
    if (ceState.lassoDrag) {
      ceState.lassoDrag.currX = e.clientX;
      ceState.lassoDrag.currY = e.clientY;
      const dx = e.clientX - ceState.lassoDrag.startX;
      const dy = e.clientY - ceState.lassoDrag.startY;
      if (!ceState.lassoDrag.started && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        ceState.lassoDrag.started = true;
      }
      if (ceState.lassoDrag.started) ceUpdateLassoBox();
      e.preventDefault();
      return;
    }
    // ── Drag de grupo (multi-selección) ──
    if (ceState.groupDrag) {
      const gd = ceState.groupDrag;
      const dx = e.clientX - gd.startX;
      if (Math.abs(dx) > 3) gd.moved = true;
      const w = ceRulerWidth();
      const z = ceState.zoom || 1;
      const dt = (dx / (w * z)) * ceState.cutscene.duration;
      ceApplyGroupDrag(dt);
      ceRenderTracks();
      ceState.applyOnce = true;
      e.preventDefault();
      return;
    }
    // ── Drag/resize de planos ──
    if (ceSceneDragInfo) {
      const dx = e.clientX - ceSceneDragInfo.startX;
      if (Math.abs(dx) > 3) ceSceneDragInfo.moved = true;
      const w = ceRulerWidth();
      const z = ceState.zoom || 1;
      const dt = (dx / (w * z)) * ceState.cutscene.duration;
      const sc = ceSceneDragInfo.scene;   // snapshot del estado al inicio del drag
      // Recomputar el plano actual por id (porque puede haber sido modificado)
      const allScenes = ceComputeScenes();
      const liveScene = allScenes.find(s => s.id === sc.id);
      if (!liveScene) return;
      if (ceSceneDragInfo.kind === 'move') {
        // Mover: shift de tStart por dt. Pero como ya pudo haberse aplicado parcialmente,
        // calculamos el delta neto entre el target original (sc.tStart + dt) y el actual.
        const targetT = sc.tStart + dt;
        const deltaNeto = targetT - liveScene.tStart;
        if (Math.abs(deltaNeto) > 0.001) {
          ceMoveScene(liveScene, deltaNeto);
        }
      } else if (ceSceneDragInfo.kind === 'resize-right') {
        const targetEnd = sc.tEnd + dt;
        const deltaNeto = targetEnd - liveScene.tEnd;
        if (Math.abs(deltaNeto) > 0.001) {
          const mode = (e.shiftKey || ceSceneDragInfo.shift) ? 'warp' : 'shift';
          ceResizeSceneRight(liveScene, deltaNeto, mode);
        }
      } else if (ceSceneDragInfo.kind === 'resize-left') {
        // Resize del borde izquierdo: cambia solo tStart de este plano (sin tocar el anterior).
        // Permite gaps entre planos.
        const targetStart = sc.tStart + dt;
        const deltaNeto = targetStart - liveScene.tStart;
        if (Math.abs(deltaNeto) > 0.001) {
          const mode = (e.shiftKey || ceSceneDragInfo.shift) ? 'warp' : 'shift';
          ceResizeSceneLeft(liveScene, deltaNeto, mode);
        }
      }
      e.preventDefault();
      return;
    }
    if (ceKfDragInfo) {
      const dx = e.clientX - ceKfDragInfo.startX;
      if (Math.abs(dx) > 3) ceKfDragInfo.moved = true;
      const w = ceRulerWidth();
      // dt en segundos: el ancho total virtual es w * zoom, así que dt = (dx / (w * zoom)) * duration
      const z = ceState.zoom || 1;
      const dt = (dx / (w * z)) * ceState.cutscene.duration;
      const newT = Math.max(0, Math.min(ceState.cutscene.duration, ceKfDragInfo.startT + dt));
      let kf;
      if (ceKfDragInfo.isCamera) {
        kf = ceState.cutscene.camera.keyframes[ceKfDragInfo.kfIdx];
      } else if (ceKfDragInfo.isFx) {
        const ent = ceState.cutscene.fx.entities[ceKfDragInfo.fxEntityIdx];
        kf = ent && ent.keyframes[ceKfDragInfo.kfIdx];
      } else if (ceKfDragInfo.isWalls) {
        kf = ceState.cutscene.walls.keyframes[ceKfDragInfo.kfIdx];
      } else {
        const track = ceState.cutscene.tracks[ceKfDragInfo.trackIdx];
        kf = track && track.keyframes[ceKfDragInfo.kfIdx];
      }
      if (kf) { kf.t = newT; ceRenderTracks(); }
      return;
    }
    if (ceState.scrubbing) ceScrubFromEvent(e);
  });
  window.addEventListener('mouseup', () => {
    // ── Cerrar lasso ──
    if (ceState.lassoDrag) {
      const ld = ceState.lassoDrag;
      ceState.lassoDrag = null;
      const box = document.getElementById('ce-lasso-box');
      if (box) box.remove();
      if (ld.started) {
        ceComputeLassoSelection(ld.startX, ld.startY, ld.currX, ld.currY, ld.additive);
        ceRenderTracks();
      }
      return;
    }
    // ── Cerrar group drag ──
    if (ceState.groupDrag) {
      const gd = ceState.groupDrag;
      ceState.groupDrag = null;
      if (gd.cloning && !gd.moved) {
        // Clon del grupo cancelado: revertir
        try {
          if (gd.baseline) ceApplyCutsceneData(JSON.parse(gd.baseline));
          if (ceState.undoStack.length > 0) ceState.undoStack.pop();
        } catch (err) { console.warn('[group clone cancel] error:', err); }
        ceMultiSelClear();
      } else if (gd.moved) {
        // Aplicar resolveOverlaps a cada plano movido del grupo
        for (const initSc of gd.initial.scenes) {
          ceResolveSceneOverlaps(initSc.id);
        }
        // Reordenar arrays de kfs por t (porque los movimientos los desordenaron)
        const cam = ceState.cutscene.camera;
        if (cam && cam.keyframes) cam.keyframes.sort((a, b) => a.t - b.t);
        if (ceState.cutscene.walls && ceState.cutscene.walls.keyframes) {
          ceState.cutscene.walls.keyframes.sort((a, b) => a.t - b.t);
        }
        for (const ent of (ceState.cutscene.fx && ceState.cutscene.fx.entities || [])) {
          if (ent.keyframes) ent.keyframes.sort((a, b) => a.t - b.t);
        }
        for (const tr of (ceState.cutscene.tracks || [])) {
          if (tr.keyframes) tr.keyframes.sort((a, b) => a.t - b.t);
        }
      }
      ceState.applyOnce = true;
      ceRenderTracks();
      ceRenderRuler();
      return;
    }
    if (ceSceneDragInfo) {
      const sc = ceSceneDragInfo.scene;
      const moved = !!ceSceneDragInfo.moved;
      const cloning = !!ceSceneDragInfo.cloning;
      const baseline = ceSceneDragInfo.baseline;
      ceSceneDragInfo = null;
      if (cloning && !moved) {
        // Clon cancelado (Alt+click sin arrastrar): revertir al baseline
        try {
          if (baseline) ceApplyCutsceneData(JSON.parse(baseline));
          if (ceState.undoStack.length > 0) ceState.undoStack.pop();
        } catch (err) { console.warn('[clone cancel] error:', err); }
        ceRenderTracks();
        return;
      }
      if (moved && sc && sc.id) {
        ceResolveSceneOverlaps(sc.id);
        ceState.applyOnce = true;
        ceRenderTracks();
        ceRenderRuler();
      }
      return;
    }
    if (ceKfDragInfo) {
      const cloning = !!ceKfDragInfo.cloning;
      const moved = !!ceKfDragInfo.moved;
      const baseline = ceKfDragInfo.baseline;
      if (cloning && !moved) {
        // Clon de kf cancelado (Alt+click sin arrastrar): revertir
        try {
          if (baseline) ceApplyCutsceneData(JSON.parse(baseline));
          if (ceState.undoStack.length > 0) ceState.undoStack.pop();
        } catch (err) { console.warn('[kf clone cancel] error:', err); }
        ceKfDragInfo = null;
        ceState.selectedKf = null;
        ceRenderTracks();
        ceState.scrubbing = false;
        return;
      }
      let arr;
      if (ceKfDragInfo.isCamera) {
        arr = ceState.cutscene.camera.keyframes;
      } else if (ceKfDragInfo.isFx) {
        const ent = ceState.cutscene.fx.entities[ceKfDragInfo.fxEntityIdx];
        arr = ent && ent.keyframes;
      } else if (ceKfDragInfo.isWalls) {
        arr = ceState.cutscene.walls.keyframes;
      } else {
        const track = ceState.cutscene.tracks[ceKfDragInfo.trackIdx];
        arr = track && track.keyframes;
      }
      if (arr) {
        const draggedKf = arr[ceKfDragInfo.kfIdx];
        arr.sort((a, b) => a.t - b.t);
        if (draggedKf) {
          const newIdx = arr.indexOf(draggedKf);
          ceState.selectedKf = { trackIdx: ceKfDragInfo.trackIdx, kfIdx: newIdx };
        }
        ceRenderTracks();
      }
      ceKfDragInfo = null;
    }
    ceState.scrubbing = false;
  });

  // Keyboard shortcuts cuando editor abierto
  window.addEventListener('keydown', (e) => {
    if (!ceState.open) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    // Cmd+Z / Ctrl+Z = undo, Cmd+Shift+Z o Cmd+Y = redo
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ' && !e.shiftKey) {
      e.preventDefault();
      ceUndo();
      return;
    }
    if (((e.metaKey || e.ctrlKey) && e.code === 'KeyZ' && e.shiftKey)
        || ((e.metaKey || e.ctrlKey) && e.code === 'KeyY')) {
      e.preventDefault();
      ceRedo();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault(); ceTogglePlay();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      // Lasso en curso: cancelar
      if (ceState.lassoDrag) {
        ceState.lassoDrag = null;
        const box = document.getElementById('ce-lasso-box');
        if (box) box.remove();
        return;
      }
      // Group drag en curso: revertir
      if (ceState.groupDrag) {
        try {
          if (ceState.groupDrag.baseline) ceApplyCutsceneData(JSON.parse(ceState.groupDrag.baseline));
          if (ceState.undoStack.length > 0) ceState.undoStack.pop();
        } catch (err) { console.warn('[esc cancel group drag]', err); }
        ceState.groupDrag = null;
        ceRenderTracks();
        return;
      }
      // Si hay drag de plano activo, cancelar — restaurar baseline
      if (ceSceneDragInfo && ceSceneDragInfo.baseline) {
        try {
          ceApplyCutsceneData(JSON.parse(ceSceneDragInfo.baseline));
          if (ceState.undoStack.length > 0) ceState.undoStack.pop();
        } catch (err) { console.warn('[esc cancel scene drag] error:', err); }
        ceSceneDragInfo = null;
        ceRenderTracks();
        return;
      }
      // Si hay drag de kf con clon activo, también cancelar
      if (ceKfDragInfo && ceKfDragInfo.cloning && ceKfDragInfo.baseline) {
        try {
          ceApplyCutsceneData(JSON.parse(ceKfDragInfo.baseline));
          if (ceState.undoStack.length > 0) ceState.undoStack.pop();
        } catch (err) { console.warn('[esc cancel kf clone] error:', err); }
        ceKfDragInfo = null;
        ceState.selectedKf = null;
        ceRenderTracks();
        return;
      }
      // Si hay multi-selección, deseleccionar
      if (ceMultiSelCount() > 0) {
        ceMultiSelClear();
        ceRenderTracks();
        return;
      }
      // Si está colocando un agente nuevo, primero cancela el placement
      if (ceState.addingAgent) {
        ceState.addingAgent = false;
        document.body.classList.remove('cs-adding-agent');
        return;
      }
      // Si está colocando un FX, primero cancela el placement
      if (ceState.fxPlacing) {
        ceState.fxPlacing = null;
        document.body.classList.remove('fx-placing');
        return;
      }
      ceClose();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault(); ceSetPlayhead(ceState.playhead - (e.shiftKey ? 5 : 1));
    } else if (e.code === 'ArrowRight') {
      e.preventDefault(); ceSetPlayhead(ceState.playhead + (e.shiftKey ? 5 : 1));
    } else if (e.code === 'Home') {
      e.preventDefault(); ceSetPlayhead(0);
    } else if (e.code === 'End') {
      e.preventDefault(); ceSetPlayhead(ceState.cutscene.duration);
    } else if (e.code === 'Digit0' || e.code === 'Numpad0') {
      // Reset zoom — vuelve a ver toda la timeline
      e.preventDefault();
      ceState.zoom = 1;
      ceState.scrollX = 0;
      ceRenderRuler();
      ceRenderTracks();
      ceUpdatePlayheadPosition();
    } else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      // + zoom in
      e.preventDefault();
      ceState.zoom = Math.min(20, (ceState.zoom || 1) * 1.5);
      ceClampScroll();
      ceRenderRuler();
      ceRenderTracks();
      ceUpdatePlayheadPosition();
    } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      // - zoom out
      e.preventDefault();
      ceState.zoom = Math.max(0.25, (ceState.zoom || 1) / 1.5);
      ceClampScroll();
      ceRenderRuler();
      ceRenderTracks();
      ceUpdatePlayheadPosition();
    } else if (e.code === 'Delete' || e.code === 'Backspace') {
      if (ceState.selectedKf) {
        e.preventDefault();
        ceDeleteSelectedKeyframe();
      }
    } else {
      // Atajos de cámara: WASD/QE/RF cuando type=Camera
      // - Modo edición (POV off): mueven el TARGET
      // - Modo POV (POV on): mueven la CÁMARA entera (FPS-style)
      const inCameraMode = ceTypeSelect.value === 'camera';
      if (!inCameraMode) return;
      const cam = ceState.cutscene.camera;
      const inPov = !!cam.povActive;
      const STEP = e.shiftKey ? 24 : 8;       // unidades world por tap
      const ROT_STEP = e.shiftKey ? 0.15 : 0.05;  // radianes por tap
      const TILT_STEP = e.shiftKey ? 24 : 8;
      let modified = false;
      // Vector forward (de cámara a target en plano XZ)
      const fx = cam.gizmoTarget.x - cam.gizmoPosition.x;
      const fz = cam.gizmoTarget.z - cam.gizmoPosition.z;
      const fLen = Math.sqrt(fx * fx + fz * fz) || 1;
      const fxn = fx / fLen, fzn = fz / fLen;
      const rxn = -fzn, rzn = fxn;   // right vector (perpendicular en XZ)
      if (inPov) {
        // POV: WASD mueve cámara en plano XZ siguiendo dirección de mira
        if (e.code === 'KeyW') {
          cam.gizmoPosition.x += fxn * STEP; cam.gizmoPosition.z += fzn * STEP;
          cam.gizmoTarget.x   += fxn * STEP; cam.gizmoTarget.z   += fzn * STEP;
          modified = true;
        } else if (e.code === 'KeyS') {
          cam.gizmoPosition.x -= fxn * STEP; cam.gizmoPosition.z -= fzn * STEP;
          cam.gizmoTarget.x   -= fxn * STEP; cam.gizmoTarget.z   -= fzn * STEP;
          modified = true;
        } else if (e.code === 'KeyA') {
          cam.gizmoPosition.x -= rxn * STEP; cam.gizmoPosition.z -= rzn * STEP;
          cam.gizmoTarget.x   -= rxn * STEP; cam.gizmoTarget.z   -= rzn * STEP;
          modified = true;
        } else if (e.code === 'KeyD') {
          cam.gizmoPosition.x += rxn * STEP; cam.gizmoPosition.z += rzn * STEP;
          cam.gizmoTarget.x   += rxn * STEP; cam.gizmoTarget.z   += rzn * STEP;
          modified = true;
        } else if (e.code === 'KeyZ' || e.code === 'KeyX') {
          // Yaw: rotar el target alrededor de la cámara (eje vertical Y)
          const angle = (e.code === 'KeyZ' ? 1 : -1) * ROT_STEP;
          const dx = cam.gizmoTarget.x - cam.gizmoPosition.x;
          const dz = cam.gizmoTarget.z - cam.gizmoPosition.z;
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          cam.gizmoTarget.x = cam.gizmoPosition.x + dx * cosA - dz * sinA;
          cam.gizmoTarget.z = cam.gizmoPosition.z + dx * sinA + dz * cosA;
          modified = true;
        } else if (e.code === 'KeyQ' || e.code === 'KeyE') {
          // Roll: barrel roll alrededor del eje de mira (la imagen se inclina lateralmente)
          const angle = (e.code === 'KeyE' ? 1 : -1) * ROT_STEP;
          cam.gizmoRoll = (cam.gizmoRoll || 0) + angle;
          modified = true;
        } else if (e.code === 'KeyR') {
          // Subir cámara (y target sigue Y para mantener mira)
          cam.gizmoPosition.y += TILT_STEP;
          cam.gizmoTarget.y   += TILT_STEP;
          modified = true;
        } else if (e.code === 'KeyF') {
          cam.gizmoPosition.y = Math.max(10, cam.gizmoPosition.y - TILT_STEP);
          cam.gizmoTarget.y   -= TILT_STEP;
          modified = true;
        }
      } else {
        // Edición: WASD mueve el TARGET en el plano XZ (igual referencia que cámara)
        if (e.code === 'KeyW') {
          cam.gizmoTarget.x += fxn * STEP; cam.gizmoTarget.z += fzn * STEP;
          modified = true;
        } else if (e.code === 'KeyS') {
          cam.gizmoTarget.x -= fxn * STEP; cam.gizmoTarget.z -= fzn * STEP;
          modified = true;
        } else if (e.code === 'KeyA') {
          cam.gizmoTarget.x -= rxn * STEP; cam.gizmoTarget.z -= rzn * STEP;
          modified = true;
        } else if (e.code === 'KeyD') {
          cam.gizmoTarget.x += rxn * STEP; cam.gizmoTarget.z += rzn * STEP;
          modified = true;
        } else if (e.code === 'KeyZ' || e.code === 'KeyX') {
          // Yaw: rotar target alrededor de cámara (eje vertical Y)
          const angle = (e.code === 'KeyZ' ? 1 : -1) * ROT_STEP;
          const dx = cam.gizmoTarget.x - cam.gizmoPosition.x;
          const dz = cam.gizmoTarget.z - cam.gizmoPosition.z;
          const cosA = Math.cos(angle), sinA = Math.sin(angle);
          cam.gizmoTarget.x = cam.gizmoPosition.x + dx * cosA - dz * sinA;
          cam.gizmoTarget.z = cam.gizmoPosition.z + dx * sinA + dz * cosA;
          modified = true;
        } else if (e.code === 'KeyQ' || e.code === 'KeyE') {
          // Roll: barrel roll alrededor del eje de mira (la imagen se inclina lateralmente)
          const angle = (e.code === 'KeyE' ? 1 : -1) * ROT_STEP;
          cam.gizmoRoll = (cam.gizmoRoll || 0) + angle;
          modified = true;
        } else if (e.code === 'KeyR') {
          cam.gizmoTarget.y += TILT_STEP;
          modified = true;
        } else if (e.code === 'KeyF') {
          cam.gizmoTarget.y -= TILT_STEP;
          modified = true;
        }
      }
      if (modified) {
        e.preventDefault();
        if (typeof updateCameraGizmo === 'function') updateCameraGizmo();
        // Auto-record kf en playhead actual
        const t = ceState.playhead;
        const existing = cam.keyframes.find(k => Math.abs(k.t - t) < 0.05);
        if (existing) {
          existing.position = { ...cam.gizmoPosition };
          existing.target = { ...cam.gizmoTarget };
          existing.roll = cam.gizmoRoll || 0;
        } else {
          const newKf = {
            t, type: 'camera',
            position: { ...cam.gizmoPosition },
            target: { ...cam.gizmoTarget },
            roll: cam.gizmoRoll || 0,
            lens: cam.gizmoLens || 50,
            projection: cam.gizmoProjection || 'perspective',
            cut: false, transition: 'none', transitionDuration: 0.5,
          };
          if (typeof ceAssignSceneIdToKf === 'function') ceAssignSceneIdToKf(newKf);
          cam.keyframes.push(newKf);
          cam.keyframes.sort((a, b) => a.t - b.t);
        }
        ceRenderTracks();
      }
    }
  });

  // Re-render tracks/ruler en resize
  window.addEventListener('resize', () => {
    if (!ceState.open) return;
    ceRenderRuler();
    ceRenderTracks();
    ceUpdatePlayheadPosition();
  });

  // ══════════════════════════════════════════════════════════════
  //  STATION ARRIVAL DETECTION
  // ══════════════════════════════════════════════════════════════
  // Cuando un agente con _stationProp asignado termina su path, emit
  // 'agentReachedStation' y limpiar el flag. Gameplay engancha minijuegos acá.
  eventBus.on('agentMoved', ({ agent }) => {
    if (!agent._stationProp) return;
    if (agent.path && agent.path.length > 0) return;     // todavía caminando
    const prop = agent._stationProp;
    const zoneKind = agent._stationZoneKind;
    delete agent._stationProp;
    delete agent._stationZoneKind;
    startWorkingState(agent, prop, zoneKind);
  });

  // ══════════════════════════════════════════════════════════════
  //  NEEDS — decay + restore + autonomous seeking + working state
  // ══════════════════════════════════════════════════════════════

  // ensureStatusMesh ahora en src/engine/agent-status.ts (ensureAgentStatus).
  // updateAgentNeeds + clearAgentStatus ya importan directo desde el módulo.

  // getAgentMostCriticalNeed + findZoneForNeed ahora en src/game/needs.ts.

  // pickCellInZone ahora en src/engine/agent-helpers.ts.

  // updateAgentNeeds ahora en src/game/needs.ts. Wrapper para inyectar
  // el agente arrastrado (queda excluido del tick).
  function updateAgentNeeds(dt) { updateAgentNeedsImpl(agents, dt, getDraggedAgent()); }

  // updateAgentStatusOverlays ahora en src/engine/agent-status.ts (updateAgentStatusPositions).
  function updateAgentStatusOverlays() { updateAgentStatusPositions(agents); }

  // Door animation eliminada — pendiente reescritura por Pablo. Las puertas
  // quedan estáticas (openness=0). El panel rotatorio sigue creándose en
  // walls-render pero no se anima.

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    // Rotación continua si las teclas , o . están sostenidas
    if ((keyLeft || keyRight) && !(typeof isCameraLocked === 'function' && isCameraLocked())) {
      if (keyLeft)  theta -= ROT_SPEED * dt;
      if (keyRight) theta += ROT_SPEED * dt;
      updateCamera();
    }
    if (!paused) {
      updateAgentNeeds(dt);
      updateAgents(dt);
    }
    updateAgentDragPhysics(dt);
    updateLandingAnims(dt);
    updateThoughtBubbles(dt);
    // updateDoorAnimations(dt);   // eliminado, pendiente reescritura
    updateAgentStatusOverlays();
    updateSpeechBubbles(dt);
    updateDialoguePanel(dt);
    if (typeof ceUpdate === 'function') {
      try { ceUpdate(dt); } catch (err) { console.warn('[ceUpdate] error:', err); }
    }
    // Render con cámara cinemática solo si POV activo dentro del editor
    const usingPov = (typeof ceState !== 'undefined') && ceState.cutscene
      && ceState.cutscene.camera && ceState.cutscene.camera.povActive;
    // Si el editor está abierto y el playhead está en un GAP entre planos,
    // pintar el canvas en negro (sin renderizar la escena). Esto da el efecto
    // de "pantalla negra entre clips" como en cualquier editor de video.
    const inGap = (typeof ceState !== 'undefined') && ceState.open
      && (typeof ceSceneAt === 'function')
      && (ceSceneAt(ceState.playhead) === null);
    if (inGap) {
      // Solo limpiar a negro, no renderizar escena
      const _prev = renderer.getClearColor(new THREE.Color());
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, true);
      renderer.setClearColor(_prev, 1);
    } else {
      renderer.render(scene, usingPov ? cinematicCamera : camera);
    }
  }
  animate();
})();
