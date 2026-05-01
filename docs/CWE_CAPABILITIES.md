<!-- ARCHIVO: CWE_CAPABILITIES.md -->

# CWE_CAPABILITIES.md — Catálogo de capacidades de CWE

> **Verificado vs HEAD `011a4aa` el 2026-04-30** (post-cierre Fase 5.1 fix R1-R4).
>
> **Doble propósito**:
> 1. Pablo lo usa AHORA en sesiones con IA para construir juegos sin escribir código.
> 2. Base de documentación pública para horizonte 3 (cuando CWE sea producto).
>
> **CRÍTICO — actualización viva**: este doc se actualiza CADA VEZ que se agrega o modifica una capacidad de CWE. Ver sección "Flujo de actualización" al final.

---

## Cómo leer este doc

### Sistema de marcas

Cada capacidad lleva una marca explícita pa que IAs y humanos sepan qué es REAL y qué no.

| Marca | Significado |
|-------|-------------|
| 🟢 **REAL** | API pública implementada y exportada hoy. Usable por código nuevo directamente. |
| 🟡 **REAL-PARCIAL** | Existe en código pero con limitaciones: catálogo hardcodeado, firma distinta a la documentada antes, requiere setup previo. Usable con cuidado. |
| ⚠️ **REAL-INTERNO** | Existe como mutación directa de singletons o lógica UI-bound (cableado dentro de `legacy.ts`). Funciona en runtime pero NO es API "publicable" — extraer o reescribir antes de exponer. |
| ⏳ **MVP-PENDIENTE** | Planeado para el MVP pero sin implementar todavía. |
| 🔴 **ASPIRACIONAL** | Documentación previa lo presentó como real, pero NO existe ni equivalente. Es dirección post-MVP. |
| 🔮 **HORIZONTE-FUTURO** | Post-MVP (horizonte 1.5/2/3). Sin compromiso de fecha. |

**Si una IA leyendo esto necesita CÓDIGO PARA HOY**: usar solo 🟢 y 🟡. Pa 🟡 confirmar la firma con grep al código.
**Pa 🟢 con singleton implícito**: leer la sección del módulo en este doc, el cableado a veces está en `legacy.ts`.

### Cómo se importa hoy (paths reales)

NO existe path `cwe/X` — eso es horizonte 3 (alias de package post-publicación). Hoy todos los imports son relativos al repo.

Ejemplo correcto:
```ts
// HOY:
import { ceoPretender } from './game/llm-agents/personalities/ceo-pretender';
import { startConversation } from './game/llm-agents/conversation';
import { eventBus } from './engine/event-bus';

// HORIZONTE 3 (no usar todavía):
// import { ceoPretender } from 'cwe/personalities';
```

Solo `src/llm/index.ts` existe como barrel real. Los otros módulos (`src/engine/`, `src/cutscene/`, `src/game/llm-agents/`) NO tienen `index.ts` — importar desde el archivo concreto.

### Equivalencias con la versión previa de este doc

La versión anterior tenía APIs ficticias (`createWorld`, `placeWall`, `placeProp`, `moveAgent`, `paintFloor`, `paintWall`, `createZone({name,cells,kind})`). La nueva versión las mapea a la API real.

| Versión anterior | Equivalente real |
|------------------|------------------|
| `createWorld({width,height,cellSize})` | `defaultWorld()` + `loadWorldData(data)` (`src/engine/world.ts`) |
| `placeWall(world, {cx,cy,side})` | `applyWallPath(path)` path-based (`src/engine/wall-build.ts`), o mutación directa de `worldGrid.wallN/wallW` (⚠️ INTERNO) |
| `placeProp(world, {cx,cy,type})` | `pushProp(propData)` + `canPlaceProp(prop,cx,cy)` (`src/engine/world.ts`) |
| `registerProp(...)` | 🔴 catálogo hardcoded en `src/game/prop-catalog.ts`, no extensible |
| `createZone(world, {name,cells,kind})` | `createZone(): Zone` sin args, muta `worldGrid.zones` (`src/engine/rooms.ts:306`) |
| `paintFloor(world, {cells,color})` | `paintFloorTile(cx,cy)` + `setPaintColorGetter(...)` (`src/engine/paint-tool.ts` + `paint.ts`) |
| `paintWall(world, {cx,cy,side,color})` | `paintWallFace(face)` + `setWallFaceColor(...)` |
| `moveAgent(agent, {cx,cy})` | `assignAgentTarget(agent, gx, gy): boolean` (`src/engine/agent-helpers.ts`) |
| `agent.brain.speak({target,context})` | `await brain.speak(target: string, context?: SpeakContext)` (positional) |
| `agent.memory.addEpisode(...)` | `addEpisode(memory, episode)` funcional con `episode.t` requerido |
| `import 'cwe/personalities'` | `from './game/llm-agents/personalities/...'` (path relativo) |

---

# CAPACIDADES DE CWE

## 1. Construcción de mundos

### 1.1 Inicialización del mundo

**Qué hace**: setup del grid isométrico + carga de datos previos (paredes, props, zonas, colores).

**Cómo se le pide**:
> "Quiero un mundo de 6×6 cells."
> "Cargá el mundo guardado."

**Pieza técnica**:
```ts
import { defaultWorld, loadWorldData } from './engine/world';

const data = defaultWorld();        // 🟢 mundo vacío con dimensiones default
loadWorldData(data, pickRoomColor); // 🟢 carga state al singleton worldGrid
```

**Marca**: 🟢 REAL.

**Detalles**:
- Grid dims fijos por `GRID_W`/`GRID_H` en `src/engine/state.ts` (default 6×6).
- `CELL = 70` (unidades three.js).
- `worldGrid` es singleton mutable en `src/engine/world.ts`. Otros módulos lo leen via getters.
- 🔴 ASPIRACIONAL: `createWorld({ width, height, cellSize })` con dims dinámicas. Hoy no existe — dims son constantes.

**Limitaciones**:
- Grid cuadrado/rectangular. Formas irregulares (L, T) son 🔮 horizonte 3.
- Un solo piso vertical. Multi-floor 🔮 horizonte 3.
- Tamaño máximo recomendado: 12×12.

---

### 1.2 Sistema de paredes

**Qué hace**: paredes en bordes norte/oeste de cada cell. Define habitaciones cerradas. Posts automáticos en corners.

**Cómo se le pide**:
> "Pared norte en (3, 2)."
> "Encerrá la cocina con paredes."

**Pieza técnica**:

🟡 **API path-based (build tool)**:
```ts
import {
  beginWallDrag, updateWallDrag, computeWallPath,
  applyWallPath, endWallDrag, setBuildWallStyle,
} from './engine/wall-build';

setBuildWallStyle('solid');  // 'solid' | 'window' | 'door'
beginWallDrag({x, z});
// ... durante drag: updateWallDrag + computeWallPath para preview
applyWallPath(computedPath, /* options */);
endWallDrag();
```

⚠️ **Mutación directa (INTERNO, usado por legacy)**:
```ts
import { worldGrid } from './engine/world';
worldGrid.wallN[cy][cx] = true;   // pared norte en (cx, cy)
worldGrid.wallW[cy][cx] = true;   // pared oeste en (cx, cy)
worldGrid.wallNStyle[cy][cx] = 'window';
```

🟢 **API de query (read-only)** — `src/engine/wall-queries.ts`:
- `hasWallN(cx, cy)`, `hasWallW(cx, cy)` — existencia de pared.
- `isCorner(cx, cy)`, `isAllWindowCorner(cx, cy)` — corners.
- `blocksSpillN/W(cx, cy)` — bloqueo de luz/sonido.
- `blocksPathN/W(cx, cy)` — bloqueo de pathfinding (puertas no bloquean).
- `getDoorOnWallN/W(cx, cy)` — door props en pared.
- `getCandidateWallSlots(cx, cy)` — slots disponibles para colgar wall props.
- `getNearestEdgeFromPoint({x,z})` — edge más cercano dado world point.
- `getAdjacentCell(cx, cy, side)` — celda vecina por side.
- `findNearestWallSegment(...)`, `findNearestPlaceableWallFace(...)` — search helpers.
- `pathFirstExists(...)`, `pathBlocksOnFurniture(...)` — validación pre-aplicar path.
- `getWallPropBounds(...)` — bounds de wall prop.

**Tipos de paredes**: `'solid'` | `'window'` | `'door'` (`WallStyle` en `world.ts:13`).

**Marca**: 🟡 PARCIAL (build API existe pero path-based, no single-edge `placeWall`). 🔴 `placeWall(world, {cx,cy,side})` clean ASPIRACIONAL.

**Detalle importante**: en corners donde coinciden pared norte y oeste, se renderiza un poste automáticamente.

---

### 1.3 Props (muebles, objetos)

**Qué hace**: pone objetos físicos en cells del mundo (escritorios, sillas, plantas, máquinas).

**Cómo se le pide**:
> "Una mesa en (2, 3)."
> "Una cafetera en la cocina."

**Pieza técnica**:
```ts
import { pushProp, canPlaceProp, removePropAt, findPropAt } from './engine/world';

if (canPlaceProp(propData, cx, cy)) {
  pushProp({ ...propData, cx, cy });
}
```

**Marca**: 🟢 REAL (push + validación).
🔴 ASPIRACIONAL: `placeProp(world, {cx,cy,type})` clean wrapper. Hoy se usa `pushProp` con objeto pre-armado.

**Catálogo REAL exhaustivo** — `src/game/prop-catalog.ts` `PROP_TEMPLATES` (18 entries):

| Nombre display | `kind` | category | dims (w×d) |
|----------------|--------|----------|------------|
| Cubo alto | `box` | floor | 1×1 |
| Mesa chica | `table` | floor | 1×1 |
| Mesa larga H | `table` | floor | 2×1 |
| Mesa larga V | `table` | floor | 1×2 |
| Sillón | `sofa` | floor | 2×1 |
| Silla | `chair` | floor | 1×1 |
| Mesita azul | `table` | floor | 1×1 |
| Taburete | `chair` | floor | 1×1 |
| Alfombra roja | `rug` | rug | 1×1 |
| Tapete azul | `rug` | rug | 2×1 |
| Alfombra grande | `rug` | rug | 2×2 |
| Tapete verde V | `rug` | rug | 1×2 |
| Laptop | `laptop` | stack | 1×1 |
| Monitor | `monitor` | stack | 1×1 |
| Lámpara | `lamp` | stack | 1×1 |
| Planta | `plant` | stack | 1×1 |
| Café | `coffee` | stack | 1×1 |
| Libros | `books` | stack | 1×1 |

Más `WALL_PROP_TEMPLATES` (3 entries, props colgables en pared):

| Nombre display | dims (w×h) | zOffset |
|----------------|-----------|---------|
| Cuadro ocre | 1×24 | 50 |
| Cuadro azul | 1×18 | 60 |
| Cuadro grande | 1×30 | 40 |

Más `DOOR_PROP_TEMPLATES` (3 styles): `wood` ("Puerta de madera"), `modern` ("Puerta moderna"), `glass` ("Puerta de vidrio").

**Cómo extender el catálogo**: 🔴 ASPIRACIONAL. `registerProp(...)` no existe — el catálogo está hardcoded en 3 arrays (`PROP_TEMPLATES`, `WALL_PROP_TEMPLATES`, `DOOR_PROP_TEMPLATES`). Pa agregar props nuevos hay que editar `prop-catalog.ts` directo.

---

### 1.4 Zonas funcionales

**Qué hace**: marca grupos de cells como "zonas" con función específica (cocina, baño, etc.). Los agentes saben usarlas según necesidades.

**Cómo se le pide**:
> "Las cells (4,4)..(5,5) son la cocina."
> "Definí zona de baño en la esquina."

**Pieza técnica**:
```ts
import { createZone, setZoneCell, deleteZone, getZoneAt } from './engine/rooms';

const zone = createZone();              // 🟡 sin args, muta worldGrid.zones
zone.kind = 'kitchen';                  // setear kind manualmente
setZoneCell(zone.id, 4, 4, true);       // agregar cell
setZoneCell(zone.id, 5, 4, true);
```

**Marca**: 🟡 PARCIAL.
- `createZone(): Zone` existe (`src/engine/rooms.ts:306`) pero NO toma args (no es la firma `createZone(world, {name, cells, kind})` previamente documentada). Muta `worldGrid.zones` directo.
- 🔴 ASPIRACIONAL: API funcional `createZone({...})` con args. Hoy se ensambla post-creación.

**Catálogo REAL exhaustivo** — `src/game/zone-catalog.ts` (10 kinds):

| `kind` | Label | `ROOM_REQUIREMENTS` |
|--------|-------|---------------------|
| `office` | Oficina | table×1, chair×1, laptop×1 |
| `meeting` | Sala de juntas | table×1, chair×4 |
| `kitchen` | Cocina | table×1, coffee×1 |
| `lounge` | Lounge | sofa×1, table×1 |
| `bathroom` | Baño | (sin requisitos) |
| `storage` | Depósito | box×1 |
| `lobby` | Recepción | sofa×1, plant×1 |
| `creative` | Espacio creativo | table×1, chair×2, lamp×1 |
| `social` | Espacio social | sofa×1, chair×2 |
| `outdoor` | Exterior | (sin requisitos) |

Helpers: `checkZoneRequirements(zone)` valida cumplimiento. `getZoneAt(cx, cy)` devuelve la zona en una cell.

---

### 1.5 Pintar paredes y pisos

**Qué hace**: cambia color de pisos y caras de paredes.

**Cómo se le pide**:
> "Pintá el piso de la cocina de azul."

**Pieza técnica**:

🟡 **API low-level (color directo)** — `src/engine/paint.ts`:
```ts
import { setFloorTileColor, setWallFaceColor, setPaintColorGetter, floodFillFloor } from './engine/paint';

setPaintColorGetter(() => 0x4878a0);    // setter del color "actual"
setFloorTileColor(cx, cy);               // pinta tile con color actual
setWallFaceColor(cx, cy, 'N', /* ... */);
floodFillFloor(startCx, startCy);        // flood-fill de cells contiguas
```

🟡 **API tool-level (drag + preview)** — `src/engine/paint-tool.ts`:
```ts
import { paintFloorTile, paintWallFace, beginPaintDrag, endPaintDrag, setPaintColor } from './engine/paint-tool';

setPaintColor(0xa4d4f4);
beginPaintDrag();
paintFloorTile(cx, cy);
paintWallFace(face);
endPaintDrag();
```

**Marca**: 🟡 PARCIAL. Las APIs existen pero requieren setup de "color actual" via setter (no toma color como arg directo). 🔴 ASPIRACIONAL: `paintFloor({cells, color})` / `paintWall({cx,cy,side,color})` con args funcionales puros.

---

### 1.6 Helpers de coordenadas

**Qué hace**: convertir entre coords de grid (cx, cy) y coords de three.js (x, y, z).

**Pieza técnica**:
```ts
import { cellToWorld, worldToCell } from './engine/coords';

const { x, y, z } = cellToWorld(3, 4);          // 🟢 grid → three
const { cx, cy } = worldToCell({ x: 210, z: 280 }); // 🟢 three → grid
```

**Marca**: 🟢 REAL. Funciones puras testeadas (18 tests en `tests/engine/coords.test.ts`).

**Convención**:
- Grid: `cx` (columna, este), `cy` (fila, sur), 0-indexed.
- Three.js mundo: `x` (este), `y` (arriba), `z` (sur).
- Conversión: `cx*CELL → world.x`, `cy*CELL → world.z`.

---

## 2. Agentes

### 2.1 Spawnear un agente

**Qué hace**: pone un personaje en el mundo con sprite + estados (path, target, needs, talking).

**Cómo se le pide**:
> "Mete un personaje en (2, 2)."
> "Spawneá a Mike en la cocina."

**Pieza técnica**:
```ts
import { spawnAgent } from './engine/agent-chassis';

const agents: Agent[] = [];
const agent = spawnAgent(agents, /* cx */ 2, /* cy */ 2, {
  id: 'mike',                            // opcional, default uid()
  emoji: ['👨', '🧠'],                   // par [left, right]
  voiceIdx: 0,                           // opcional, 0-4
});
```

**Marca**: 🟢 REAL.

**Firma exacta** (`src/engine/agent-chassis.ts:155`):
```ts
spawnAgent(agents: Agent[], cx: number, cy: number, opts?: SpawnOpts): Agent
```

`SpawnOpts`:
- `id?: string` — auto-generado si falta.
- `emoji?: [string, string]` — par L/R (sprite gira al moverse).
- `voiceIdx?: number` — 0-4 (índice en `VOICE_PRESETS`).
- `needs?: { focus, hunger, social, bathroom }` — overrides iniciales.
- `heldItem?: string | null`.
- `csAgent?: boolean` — marca como cutscene-controlled.

**No existe** parámetro `mesh: 'default'` (la mesh se construye internamente desde el emoji par).

🟢 **Singleton getter** — `src/engine/agents-state.ts`:
```ts
import { setAgentsGetter, getAgents, isAgentAt } from './engine/agents-state';

setAgentsGetter(() => agents);    // cablea el array al getter global
const all = getAgents();           // lectura desde otros módulos
isAgentAt(cx, cy);                 // ¿hay algún agente en esa cell?
```

---

### 2.2 Mover un agente

**Qué hace**: pathfinding A* sobre el grid. Agente camina hop-by-hop al destino.

**Cómo se le pide**:
> "Que Mike vaya a (5, 4)."
> "Mové a Mike a la cafetera."

**Pieza técnica**:
```ts
import { assignAgentTarget } from './engine/agent-helpers';

const ok = assignAgentTarget(agent, /* gx */ 5, /* gy */ 4);
// ok === true si encontró path; false si destino == origen o sin path
```

**Marca**: 🟡 PARCIAL.
- 🟢 `assignAgentTarget(agent, gx, gy): boolean` existe (`src/engine/agent-helpers.ts:19`).
- 🔴 ASPIRACIONAL: `moveAgent(agent, { target: 'coffee_machine' })` con resolver de target. Hoy hay que resolver el target a `(gx, gy)` con helpers separados.

**Helpers relacionados** — `src/engine/agent-helpers.ts`:
- `pickNearestProp(props, cx, cy)` — encuentra prop más cercano.
- `findWalkableAdjacentToProp(prop, cx, cy)` — celda walkable adyacente al prop.
- `pickCellInZone(cells, cx, cy)` — random walkable en zona.

---

### 2.3 Personalidad con LLM real

**Qué hace**: agente habla con Claude Haiku 4.5 en tiempo real. Respuestas generadas, no scripted.

**Cómo se le pide**:
> "Mike es un CEO que pretende escuchar pero todo termina siendo lo que ya pensaba."
> "Asigná la personalidad CEO Pretender."

**Pieza técnica**:
```ts
import { ceoPretender, juniorOverconfident, internAnxious } from './game/llm-agents/personalities';
// O: import { ALL_PERSONALITIES, getPersonalityById } from './game/llm-agents/personalities';

const personality = ceoPretender;
// personality.id, .name, .emoji, .voiceIdx, .model, .staticSystemBlock, etc.
```

**Marca**: 🟢 REAL. 3 personalidades scaffolding: `ceoPretender`, `juniorOverconfident`, `internAnxious`.

**Tipo `Personality`** (`src/game/llm-agents/personality.ts:13`) — campos requeridos por `PersonalitySchema` (Zod):
```ts
type Personality = {
  id: string;
  name: string;
  emoji: string;
  voiceIdx: number;
  model: 'haiku-4-5' | 'sonnet-4-6';
  staticSystemBlock: string;        // ← string, NO SystemBlock[]
  speakStyle: string;
  examples: { user: string; assistant: string }[];
  fallbackPhrases: string[];        // ≥5 requeridos
  triggers: {
    socialEncounterEnabled: boolean;
    crisisNeedThreshold: number;
    cooldownMsAfterSpeak: number;
  };
};
```

**`SystemBlock[]`** se construye runtime via `buildSystemBlocks(personality, context)` en `personality.ts:60` — wrappea `staticSystemBlock` como block cacheable + agrega bloque dinámico opcional.

**Limitaciones**:
- 3 personalidades hoy. Más requieren editar archivos directo o esperar Personality Generator (⏳ §6.1).

---

### 2.4 Memoria persistente de agentes

**Qué hace**: agente recuerda episodios + facts + relationships entre sesiones.

**Cómo se le pide**:
> "Que Mike y Cris recuerden cuando discutieron."

**Pieza técnica** — API funcional, NO orientada a objetos:
```ts
import {
  addEpisode, addFact, updateRelationship,
  pruneOldEpisodes, computeEpisodeImportance,
  createEmptyMemory,
} from './game/llm-agents/memory';

const memory = createEmptyMemory(agent.id);
addEpisode(memory, {
  t: Date.now() / 1000,            // ← timestamp en SEGUNDOS, requerido
  type: 'spoke_to',                 // 'spoke_to' | 'overheard' | 'witnessed' | 'felt'
  participants: ['cris'],
  summary: 'Discutieron sobre el deploy',
  importance: 0.7,                  // 0-1
});
updateRelationship(memory, 'cris', { lastInteractionT: t, encounterCount: 1 });
pruneOldEpisodes(memory);           // recencia + importancia
```

**Marca**: 🟢 REAL.

**Persistencia** — `src/game/llm-agents/persistence.ts`:
- `saveAgentMemory(memory)`, `loadAgentMemory(agentId)`, `loadOrCreateAgentMemory(agentId)`.
- localStorage key: `cwe_agent_memory_<agentId>`.
- Cuarentena en `cwe_quarantine_agent_memory_*` si schema falla.

---

### 2.5 Necesidades y comportamiento autónomo

**Qué hace**: agentes tienen necesidades que decaen. Cuando bajan a crítico, buscan zona apropiada.

**Cómo se le pide**:
> "Cuando Mike tenga hambre, que vaya a la cocina."

**Pieza técnica** — `src/game/needs.ts`:
```ts
import {
  NEED_TYPES, NEED_DECAY, NEED_THRESHOLD_CRITICAL,
  ZONE_RESTORES, NEED_EMOJI, WORKING_DURATION,
  getAgentMostCriticalNeed, findZoneForNeed, updateAgentNeeds,
} from './game/needs';
```

**Marca**: 🟢 REAL.

**Catálogo REAL de needs** (`NEED_TYPES`):
- `focus` — concentración (decae con el tiempo).
- `hunger` — hambre.
- `social` — interacción.
- `bathroom` — necesidad fisiológica.

**Constantes**:
- `NEED_THRESHOLD_CRITICAL = 30` — bajo esto, busca zona.
- `NEED_THRESHOLD_OK = 75` — sobre esto, overlay desaparece.
- `WORKING_DURATION = 8` segundos — duración del working state.
- `WORKING_RESTORE_MULT = 2.5` — restore acelerado mientras trabaja.

**Zone restores** (`ZONE_RESTORES`): mapea `kind` → `Partial<Record<NeedType, number>>`. Ej: `kitchen` restora `hunger`.

🔴 ASPIRACIONAL: `registerNeed('hunger', { decayRate, satisfiedBy, visualIndicator })`. NEED_TYPES está hardcoded — no extensible sin editar el archivo.

---

### 2.6 Working state

**Qué hace**: cuando agente entra a zona con requisitos cumplidos, trabaja por 8s (animación static loop, productividad visible vía emoji).

**Pieza técnica**: handled internamente por `updateAgents` + `startWorkingState` en `src/game/stations.ts`.

**Marca**: 🟢 REAL (`WORKING_DURATION = 8`s). 🔮 Mini-juego interactivo es horizonte 2/3.

---

### 2.7 Event bus

**Qué hace**: pub/sub interno para que sistemas se suscriban a eventos del motor sin acoplarse.

**Pieza técnica** — `src/engine/event-bus.ts`:
```ts
import { eventBus } from './engine/event-bus';

const unsub = eventBus.on('agentMoved', ({ agent, from, to }) => {
  console.log(`${agent.id} de ${from.cx},${from.cy} a ${to.cx},${to.cy}`);
});
unsub();   // desuscribir

eventBus.emit('agentSpawned', { agent });
```

**Marca**: 🟢 REAL.

**Eventos emitidos hoy**:
- `worldLoaded` — `{ source: 'storage' | 'default' | 'reset' }`.
- `worldSaved` — `{}`.
- `propPlaced`, `propDeleted`, `propMoved` — `{ prop, from?, to? }`.
- `agentSpawned` — `{ agent }`.
- `agentMoved` — `{ agent, from, to }` (cambio de cell, no por sub-paso).
- `agentReachedStation` — `{ agent, prop, zoneKind }` (al iniciar working state).
- `wallChanged` — `{ type, cx, cy, exists, style }`.
- `paintApplied` — `{ kind, cx, cy, side?, color }`.
- `zonesChanged` — `{ reason, zoneId }`.

Debug: `window.__cweDebugEvents = true` loguea todo.

---

## 3. Conversaciones entre agentes (LLM)

### 3.0 Setup del runtime LLM

**Qué hace**: cabla agentes con sistema LLM (triggers + brains + queue + tracker).

**Pieza técnica** — `src/game/llm-agents/runtime.ts`:
```ts
import { setupAgentRuntime } from './game/llm-agents/runtime';

const runtime = setupAgentRuntime({
  listActiveAgentIds: () => agents.map(a => a.id),
  getAgentCell: (id) => /* {cx,cy} | null */,
  getAgentPositionX: (id) => /* number | null */,
  personalityFor: (id) => /* Personality | null */,
  agentRef: (id) => /* AgentLike | null */,
  getAgentNeed: (id, kind) => /* number | null */,   // requerido para crisis
  client: llmClient,
  tracker: sessionCostTracker,
  queue: getGlobalQueue(),
  showSpeechBubble,
  removeAgentBubble,
  onCallEnd: (info) => logCall(info),
});
// runtime.tick() corre cada 1s. runtime.stop() limpia interval.
```

**Marca**: 🟢 REAL. Cableado real en `src/main.ts`.

---

### 3.1 Encuentros adyacentes (multi-turn)

**Qué hace**: cuando dos agentes están adyacentes ≥`SOCIAL_ADJ_MS` (2s), trigger emite `social_encounter`. Runtime invoca orchestrator → conversación 2-4 turns alternados.

**Cómo se le pide**:
> "Cuando Mike y Cris se encuentren, que hablen."

**Pieza técnica**:
```ts
import { startConversation, type StartConversationOpts } from './game/llm-agents/conversation';

await startConversation({
  participants: [agentA, agentB],     // exactamente 2
  brainFor: (id) => brains.get(id) ?? null,
  getAgentCell: (id) => ...,
  getAgentPositionX: (id) => ...,
  setFacing: (agent, dir) => setAgentFacing(agent, dir),
  markPairCooldown: (a, b, ms) => triggers.setPairCooldown(a, b, ms),
  removeAgentBubble: (agent) => removeAgentBubble(agent),
  log: console.log,
  // optional: totalTurns, sleep, nowMs, newConversationId
});
```

**Marca**: 🟢 REAL (post-Fase 5.1 fix R1-R4).

**Comportamiento**:
- Lock atómico en `talking` + `activeConversationId` (rechaza si alguno ya está hablando).
- Path/target/waiting limpios al lockear (R2 fix).
- Re-verifica adjacency cada turn.
- Cleanup garantizado en `finally` con match-id (no pisa otra conversación).
- Cooldown 10s si fail-turn-0 / 60s normal.
- Async fire-and-forget — game loop no se bloquea.

**Helpers relacionados**:
- `src/game/llm-agents/conversation.ts`: `computeConversationImportance(turns)`, `buildConversationSummary(turns)`.
- `src/game/llm-agents/triggers.ts`: `TriggerSystem` clase con método `.setPairCooldown(a, b, ms)` (cooldown post-conversación, regla "no acorta cooldown existente más largo"). NO es export standalone — accesible vía `triggers.setPairCooldown(...)` después de instanciar `new TriggerSystem(opts)`.
- `src/game/llm-agents/adjacency.ts`: `chebyshevCellDistance(a, b)`, `areAgentsAdjacent(a, b)`.

**Fase 5.1.5 pendiente** (`docs/AGENTS_LLM.md`):
- `[PENDING-ADJACENCY-TUNING]`: difícil triggerar adjacency en gameplay normal — window estrecho.
- `[PENDING-AUTONOMOUS-SPEAK-INTEGRATION]`: speak() sin orchestrator (crisis trigger) cancela bubbles rápido y no se contestan entre sí.

**Limitaciones**:
- Solo conversaciones de 2 agentes en MVP. Grupos 3+ son ⏳ Fase 5.2+.

---

### 3.2 brain.speak — diálogo forzado

**Qué hace**: dispara una intervención del LLM programáticamente (sin esperar adjacency natural).

**Pieza técnica**:
```ts
import { AgentBrain, type SpeakContext, type SpeakResult } from './game/llm-agents/brain';

const brain = new AgentBrain({ agent, personality, memory, client, tracker, queue, showSpeechBubble });
const result: SpeakResult = await brain.speak('mike', {
  situationLines: ['Acabás de ver a Mike entrar a la sala'],
  maxTokens: 60,                    // override per-call
  turnContext: { speakerId, text }, // si responde a otro turn
  skipMemoryWrite: true,            // si la memoria se persiste afuera (ej. orchestrator)
});
// result: { ok: boolean, text: string, cost: number, reason?: string }
```

**Marca**: 🟢 REAL.

**Firma exacta** (`src/game/llm-agents/brain.ts:82`):
```ts
async speak(target: string, context?: SpeakContext): Promise<SpeakResult>
```

`target` es positional `string` (id del otro agente o '' para monólogo). Retorna `Promise<SpeakResult>`.

---

### 3.3 Crisis (monólogos automáticos)

**Qué hace**: cuando una necesidad de un agente cae a crítico (<20), el agente "verbaliza" su queja.

**Pieza técnica**: handled por `setupAgentRuntime` (§3.0). El trigger `crisis` invoca `brain.speak('', { situationLines: ['Tu necesidad X está en N'] })` directo (no orchestrator).

**Marca**: 🟢 REAL (post-fix R1: setea `talking=true` durante monólogo + `path=[]` + `finally` restaura `talking=false` + `waiting=1.5s`).

**Pendiente Fase 5.1.5**: `[PENDING-AUTONOMOUS-SPEAK-INTEGRATION]` — paths de speak directo no comparten orchestrator → bubbles se cortan rápido.

---

### 3.4 Costos y caps

**Qué hace**: control de gasto del LLM multi-capa.

**Marca**: 🟢 REAL.

**Caps**:
- App-side por sesión: `DEFAULT_CAP_USD = 0.50` (configurable en Settings UI). Constante en `src/llm/cost-tracker.ts`.
- Workspace Anthropic: configurable fuera del código (en dashboard de Anthropic).
- Prompt caching obligatorio (90% discount) via `SystemBlock[]` con `cache: '5m' | '1h'`.

**Configs literales validados**:
| Constante | Valor | Archivo |
|-----------|-------|---------|
| `SOCIAL_ADJ_MS` | 2000ms | `triggers.ts:15` |
| `TURN_MAX_TOKENS` | 30 | `conversation.ts:39` |
| `DEFAULT_CAP_USD` | 0.50 | `cost-tracker.ts` |
| `COOLDOWN_NORMAL_MS` | 60_000ms | `conversation.ts:31` |
| `COOLDOWN_FAIL_TURN0_MS` | 10_000ms | `conversation.ts:30` |
| `WORKING_DURATION` | 8s | `needs.ts:42` |

**Test coverage**: 453 tests verdes post-Fase 5.1 fix R1-R4.

**Limitaciones MVP**:
- API key en localStorage (sin proxy). Pablo único usuario.
- 🔮 Horizonte 2: LLM proxy via Cloudflare Workers.

---

### 3.5 API LLM client (utilities)

**Qué hace**: barrel real con tipos + factory + queue + cost utilities.

**Pieza técnica** — `src/llm/index.ts` (único barrel real del repo):
```ts
import {
  // Tipos
  type LLMClient, type CompletionOpts, type StreamChunk,
  type LLMModel, type SystemBlock,
  // Cliente
  getLLMClient, isLLMEnabled, setApiKey, clearApiKey,
  loadKillSwitchFromStorage, loadSessionCapFromStorage,
  // Modelos
  MODEL_API_IDS, MODEL_PRICING, MODEL_MIN_CACHEABLE_TOKENS,
  recommendCacheTTL,
  // Cost
  estimateCostUSD, actualCostUSD,
  // Queue (concurrency control)
  GlobalLLMQueue, getGlobalQueue, resetGlobalQueueForTests,
  // Sanitización
  sanitizeError, wrapWorldContext, sanitizeWorldString,
  // Storage keys
  LLM_STORAGE_KEYS,
  // Errors
  LLMError,
} from './llm';
```

**Marca**: 🟢 REAL.

**Detalles**:
- `MockLLMClient` en `src/llm/mock-client.ts` — para tests (no en barrel).
- `createSessionCostTracker(opts?)` en `src/llm/cost-tracker.ts`.
- `MODEL_API_IDS`: `'haiku-4-5' → 'claude-haiku-4-5-20251001'`, `'sonnet-4-6' → 'claude-sonnet-4-6'`.

---

## 4. Cutscenes

### 4.1 Modelo Cutscene

**Qué hace**: simulaciones temporales con tracks de cámara, agentes, props animados, FX, walls hideable.

**Pieza técnica**: schema Zod en `src/cutscene/schema.ts` con tipos `Cutscene`, `Scene`, `CameraKf`, `AgentKf`, etc. Soporta inheritance entre escenas y multi-sel de keyframes.

**Marca**: 🟢 REAL (modelo + runtime + schemas + inheritance + tests).

---

### 4.2 DSL en lenguaje natural

**Qué hace**: markdown narrativo → cutscene serializada vía compiler.

**Pieza técnica**:
```bash
npm run cutscene-compile path/to/scene.md
# → produce JSON validado contra CutsceneSchema
```

```ts
// Programático:
import { parseDsl } from './cutscene/parser';
import { compileCutscene } from './cutscene/compiler';

const parseResult = parseDsl(markdown);
if (parseResult.ok) {
  const result = compileCutscene(parseResult.ast, { /* CompileOpts */ });
}
```

**Marca**: 🟢 REAL (parser + compiler + CLI).

**Vocabulario REAL exhaustivo**:

🟢 **Shot types (5)** — `src/cutscene/shots.ts`:
- `wideEstablishing(subjects, opts?)` — plano abierto.
- `mediumShot(subject, opts?)` — plano medio.
- `closeUp(subject, opts?)` — primer plano.
- `twoShot(subjects, opts?)` — dos sujetos juntos.
- `overTheShoulder(...)` — sobre el hombro.

🟢 **Camera moves (4)** — `src/cutscene/camera-moves.ts`:
- `dollyIn(subject, args)` — acercar.
- `pullOut(subject, args)` — alejar.
- `pan(args)` — barrer horizontal.
- `pushIn(subject, args)` — empujar hacia sujeto.

🟢 **Agent action verbs en DSL (5)** — `ActionVerbSchema` en `src/cutscene/schema-ast.ts`:
- `camina_a {cell|agente|prop}` — pathfinding.
- `mira_a {cell|agente}` — orientación.
- `dice "..."` — diálogo (con audio TTS).
- `anima {preset}` — animación cutscene (ver §8.3).
- `espera {Ns}` — pausa.

**Pendientes**:
- ⏳ Cutscene Generator (descripción → DSL) — §6.2.

---

### 4.3 Editor visual

**Qué hace**: timeline con tracks, cámara con gizmo 3D editable, multi-selección de keyframes, drag no destructivo.

**Marca**: ⏳ MVP-PENDIENTE (extracción del editor ~50%). Modelo y runtime cerrados, lifecycle del editor sigue en `src/legacy.ts`.

**Para Pablo**: el editor existe y funciona desde el monolito. La extracción es para modularizar.

---

### 4.4 Walls hideable en cutscenes

**Qué hace**: durante una cutscene, ocultar paredes para ver mejor el interior.

**Marca**: 🟡 PARCIAL (modelo decidido, schema soporta `hiddenIds`, integration en runtime parcial).

**Schema**: `cutscene.walls.keyframes[t].hiddenIds: string[]` (incluye `'ROOF'` para techo). Note: TECHO/ROOF nunca se debe extraer del legacy — decisión cerrada.

---

### 4.5 FX system

**Qué hace**: efectos visuales (humo, fuego, chispas, luz) spawneables por cell o por agente.

**Pieza técnica** — `src/cutscene/fx.ts`:
```ts
import {
  FX_PRESETS, type FxKind,
  spawnFxInstance, despawnFxInstance, updateFxInstance,
  makeFxTexture, createFxTextureCache,
} from './cutscene/fx';

const cache = createFxTextureCache();
const inst = spawnFxInstance({ fx: 'smoke' }, scene, cache, target);
updateFxInstance(inst, dt);
despawnFxInstance(inst, scene);
```

**Marca**: 🟢 REAL (catálogo + lifecycle).

**Catálogo REAL exhaustivo** (`FxKind` en `fx.ts:13`):
- `smoke` — humo gris ascendente (3s, 3 sprites).
- `fire` — fuego amarillo→rojo (3s, 4 sprites).
- `sparks` — chispas blanco→naranja (1.5s, 6 sprites, additive).
- `light` — luz cálida con `PointLight` real (4s, 1 sprite).

🔴 ASPIRACIONAL: `registerFX('explosion', { ... })`. `FX_PRESETS` está hardcoded — no extensible sin editar el archivo.

---

## 5. Cámara

### 5.1 Cámara isométrica con lentes

**Qué hace**: cámara ortográfica isométrica con lentes simulados (24mm-200mm). FOV calculado a partir de focal length.

**Marca**: 🟢 REAL (`src/engine/camera-iso.ts` + `src/cutscene/shots.ts`).

---

### 5.2 Modo perspectiva

**Qué hace**: alterna entre orto (default) y perspective (cinematográfico).

**Marca**: 🟢 REAL. Field `projection: 'orthographic' | 'perspective'` en cutscene camera schema.

---

### 5.3 Cámara que sigue agente

**Qué hace**: parent de cámara a un agente — se mueve con él.

**Marca**: 🟢 REAL. Field `parentAgentId` en cutscene camera schema.

---

### 5.4 POV (cámara primera persona)

**Qué hace**: cámara montada en la cabeza de un agente.

**Marca**: ⏳ MVP-PENDIENTE (vive en `legacy.ts:1151+`, extracción pendiente).

---

## 6. AI Orchestration (3 generators internos)

### 6.1 Personality Generator

**Qué hace**: descripción libre → archivo de Personality completo.

**Marca**: ⏳ MVP-PENDIENTE. Directorio `src/ai/` no existe. Se construirá reusando la capa LLM de §3.5.

---

### 6.2 Cutscene Generator

**Qué hace**: descripción libre de escena → DSL markdown compilable.

**Marca**: ⏳ MVP-PENDIENTE. Pre-requisito (DSL §4.2) ya cerrado.

---

### 6.3 World Iterator

**Qué hace**: descripción libre → modificaciones sobre el mundo existente.

**Marca**: ⏳ MVP-PENDIENTE.

---

### 6.4 Visión: integración con asistente de voz

**Marca**: 🔮 HORIZONTE-FUTURO (2/3).

---

## 7. Persistencia y guardado

### 7.1 Save/load de mundos

**Qué hace**: estado del mundo (paredes, props, zonas, colores) persiste a localStorage con schema Zod + cuarentena de data corrupta + migrations.

**Pieza técnica**: `src/engine/persistence.ts` (read/write), `src/engine/schema.ts` (Zod), `src/engine/migrations.ts` (versioning).

**Marca**: 🟢 REAL.

**Cuarentena**: data corrupta se mueve a `cwe_quarantine_<key>_<timestamp>`. Memoria de agentes idem (`cwe_quarantine_agent_memory_*`).

---

### 7.2 Save/load de cutscenes

**Marca**: 🟢 REAL. Schema validado en `src/cutscene/schema.ts`.

---

### 7.3 Slots múltiples

**Qué hace**: múltiples mundos/escenas guardados por separado.

**Marca**: ⏳ MVP-PENDIENTE.

---

## 8. Visual y estética

### 8.1 Estilo toon-low-poly

**Marca**: 🟢 REAL (fijado, no se cambia en MVP).

---

### 8.2 Speech bubbles

**Qué hace**: bubble visual sobre agente con texto + audio TTS sincronizado word-by-word.

**Pieza técnica**:
```ts
import { showSpeechBubble, removeAgentBubble } from './engine/speech';
import { getBubbleDurationMs } from './game/llm-agents/bubble-duration';

const bubble = showSpeechBubble(agent, 'Hola', { autoCloseAfter: 3.0 });
removeAgentBubble(agent);

const ms = getBubbleDurationMs(text); // clamp 2000-8000ms = 2000+chars*50
```

**Marca**: 🟢 REAL (5 voice presets, streaming word-by-word, post-R3 single-handle).

**Voice presets REALES (5)** — `src/engine/voices.ts`:
| `name` | `baseFreq` |
|--------|-----------|
| `agudo` | 320 |
| `medio-alto` | 260 |
| `medio` | 210 |
| `medio-grave` | 175 |
| `grave` | 145 |

Helpers: `pickVoiceIdx(agentId)` (hash determinístico), `hashStringToInt(s)`.

**Bubble duration**: `BUBBLE_BASE_MS=2000`, `BUBBLE_PER_CHAR_MS=50`, `BUBBLE_MIN_MS=2000`, `BUBBLE_MAX_MS=8000`.

---

### 8.3 Animaciones de agentes

⚠️ **Distinción importante**: hay DOS catálogos distintos.

#### 8.3.a Cutscene anim presets (`anima` action en DSL §4.2)

**Qué son**: efectos animados invocados en cutscenes via `anima {preset}`.

**Pieza técnica**: `CE_ANIM_PRESETS` en `src/legacy.ts:2894`.

**Catálogo REAL exhaustivo (4)**:
| `preset` | Duration | Label |
|----------|----------|-------|
| `wave` | 1.0s | 👋 Wave |
| `excited` | 1.5s | ⚡ Excited |
| `idle` | 0.5s | 😴 Idle |
| `spin` | 1.2s | 🌀 Spin |

**Marca**: ⚠️ REAL-INTERNO (vive en `legacy.ts`, extracción pendiente).

#### 8.3.b LLM agent actions (decididas runtime por `brain.decide()` o handlers directos)

**Qué son**: acciones del agente decididas por el LLM en encuentros.

**Pieza técnica** — `src/game/llm-agents/actions.ts`:
```ts
type AgentAction =
  | { type: 'SAY'; text: string }
  | { type: 'EMOTE'; emote: string }
  | { type: 'LOOK_AT'; target: string }
  | { type: 'WALK_TO'; target: string };  // stub Fase 5.2+

import { applyAgentAction, applySayAction, applyEmoteAction, applyLookAtAction } from './game/llm-agents/actions';
```

**Marca**:
- 🟢 SAY, EMOTE, LOOK_AT — handlers reales (post-Fase 5.1).
- ⏳ WALK_TO — sigue stub. Diferido a Fase 5.2+.

#### Estados de agente (NO son presets)

`hopping`, `turn`, `talk` NO son animation presets. Son **estados** del agente:
- `agent.hopping: boolean` — flag visual de hop animation.
- `agent.facing: 'left' | 'right'` — orientación (cambiada por `setAgentFacing`).
- `agent.talking: boolean` — lock que detiene movimiento durante conversación.

---

## 9. Internacionalización

### 9.1 i18n es/en

**Qué hace** (planeado): strings de UI y prompts en es/en según idioma del usuario.

**Marca**: ⏳ MVP-PENDIENTE.

**Detalles**:
- Hoy todo está en español (Colombia). No hay estructura `src/i18n/`.
- es/en obligatorios desde el setup pa MVP.
- Estructura preparada para más idiomas sin refactor.

---

# LO QUE CWE NO PUEDE HACER

Lista exhaustiva pa evitar que la IA invente capacidades.

## Limitaciones técnicas (naturaleza del motor)

- ❌ Mundos 3D libres con cámara FPS.
- ❌ Físicas avanzadas (ragdolls, fluidos, soft bodies).
- ❌ Personajes humanoides realistas con animación procedural.
- ❌ Multiplayer real-time.
- ❌ Networking entre clientes.
- ❌ Mundos infinitos / procedural generation infinita.
- ❌ Múltiples pisos verticales (planeado horizonte 3).
- ❌ Grids irregulares (formas en L, T, etc.).
- ❌ Render fotorrealista.
- ❌ Audio 3D espacial complejo.

## Limitaciones de scope MVP (extensibles post-MVP)

- ❌ Generación de mundos de cero desde descripción libre (solo iteración sobre existente).
- ❌ Generación de meshes 3D con IA (solo catálogo predefinido).
- ❌ Conversation Manager con memoria del flow de diseño persistente.
- ❌ Backend, auth, sharing, marketplace.
- ❌ Conversaciones grupales 3+ participants (Fase 5.2+).
- ❌ Render MP4 de cutscenes.
- ❌ Audio tracks en cutscenes (música/SFX).
- ❌ Catálogos extensibles de props/needs/FX (`registerProp/registerNeed/registerFX`).

## Limitaciones culturales/estéticas

- ❌ Estilo visual fuera de toon-low-poly isométrico.
- ❌ Combat systems sofisticados.
- ❌ Inventory complejo con crafting.
- ❌ Económicas/comercio profundas.

---

# CÓMO LE PEDÍS A LA IA QUE USE CWE

Manual de uso para creadores no-devs.

## Patrón general

```
"Quiero hacer [tipo de juego].
El mundo es [descripción del espacio].
Los personajes son [descripción de quiénes están].
La historia trata de [premisa narrativa]."
```

La IA lee esto + `CWE_CAPABILITIES.md` + el resto de docs del Project, y arma plan de:
1. Mundo (zonas, props, paredes).
2. Agentes (cuántos, qué personalidades).
3. Mecánicas (qué necesidades, qué triggers).
4. Cutscenes iniciales (escenas narrativas).

## Ejemplo: juego de detective

**Lo que decís**:
> "Quiero un juego de detective en una mansión victoriana. 4 sospechosos, un mayordomo, una víctima en la biblioteca."

**Lo que la IA debería identificar**:

| Necesidad del juego | Capacidad de CWE |
|---|---|
| Mansión victoriana isométrica | Construcción (§1.1-1.5) con catálogo actual de oficina como placeholder (asset packs custom = 🔮 horizonte 3) |
| 4 sospechosos + mayordomo | Spawn agentes (§2.1) + Personalidades custom (§2.3 + Personality Generator ⏳ §6.1) |
| Interrogación con respuestas variables | Conversaciones LLM (§3.1, §3.2) con context dinámico |
| Pistas que afectan respuestas | AgentMemory (§2.4) con state custom |
| Investigación en habitaciones | Zonas (§1.4) + cámara cinemática (§5.1) |
| Cinematics de descubrimiento | Cutscenes con DSL (§4.2) |

**Lo que la IA debería decir si algo no se puede**:
> "El estilo victoriano no está en el catálogo actual. Podemos usar assets de oficina como placeholder, o esperar horizonte 3."

## Ejemplo: simulador de oficina

**Lo que decís**:
> "Una oficina de startup tech con 5 empleados de personalidades distintas. Trabajan, toman café, tienen reuniones inútiles, hay drama."

**Lo que la IA debería identificar**: esto ES literalmente AGENTS.INC, el caso de validación de CWE. La IA debería responder:
> "Esto coincide con AGENTS.INC. Tenemos 3 personalidades base (CEO Pretender, Junior Overconfident, Intern Anxious). Para 2 más, Personality Generator está ⏳ pendiente. El world ya tiene catálogo de oficina (mesas, sillas, sofás, laptops, lámparas, plantas, cafetera, libros)."

---

# FLUJO DE ACTUALIZACIÓN — CRÍTICO

Este doc es **inútil si está desactualizado**. Regla estricta:

## Cuándo se actualiza

**Claude Code DEBE actualizar `CWE_CAPABILITIES.md` cuando**:

1. Se cierra una fase del MVP que entrega capacidades nuevas → actualizar las secciones afectadas + cambiar marca (⏳ → 🟢/🟡).
2. Se agrega un nuevo módulo en `src/engine/`, `src/cutscene/`, `src/llm/`, `src/ai/`, o `src/game/llm-agents/` que expone API pública → agregar capacidad correspondiente.
3. Se agrega o modifica un schema persistido que cambia el modelo de capacidad.
4. Se agrega una nueva action al DSL de cutscenes → actualizar §4.2.
5. Se agrega o modifica una personalidad concreta → actualizar §2.3.
6. Se modifica una limitación → actualizar sección "LO QUE CWE NO PUEDE HACER".
7. Se descubre una capacidad olvidada o no documentada → agregarla.
8. Se extrae una API de `legacy.ts` a un módulo limpio → cambiar marca de ⚠️ a 🟢/🟡.

## Cuándo NO se actualiza

- Cambios internos sin impacto en API pública (refactors, performance, fixes).
- Tests nuevos.
- Renombres internos no observables.
- Comentarios o JSDoc.

## Patrón de actualización

Cuando Claude Code modifica `CWE_CAPABILITIES.md`:

1. **Antes de cerrar la sesión**: revisa si el cambio realizado afecta alguna capacidad documentada.
2. **Si afecta**: actualiza la sección correspondiente + cambia marca si aplica.
3. **Recordatorio a Pablo**:
   > "📌 Modificaste capacidades de CWE: actualicé `CWE_CAPABILITIES.md` sección X.Y. Acuérdate de re-subirlo al Project."

## Validación periódica

**Cada cierre de fase**, Claude Code debe:
1. Listar archivos modificados de las áreas mencionadas en "Cuándo se actualiza".
2. Revisar si `CWE_CAPABILITIES.md` refleja los cambios.
3. Si no, actualizarlo en el commit final de la fase.

## Tarea diferida

- `[PENDING-CWE-CAPS-CI]` (loggeado en `docs/ROADMAP.md`): script CI que parsea símbolos marcados 🟢/🟡 y falla si no aparecen como `export function|const|class` en `src/`. Whitelist para mutaciones directas y APIs internas no exportadas.

## Anti-patterns

- ❌ "Esto es un cambio menor, no actualizo el doc." → si hay duda, actualizá.
- ❌ "Lo actualizo después en una sesión dedicada." → después se olvida.
- ❌ "Pablo lo va a notar." → Pablo no es testeador del doc, eso es trabajo de Claude Code.

---

# PARA INSTANCIAS DE CLAUDE LEYENDO ESTO

Si sos Claude (chat web o Claude Code) leyendo este doc en sesión nueva:

1. **Es la fuente de verdad sobre qué puede hacer CWE HOY**. Si algo no está marcado 🟢 o 🟡, no asumas que existe.
2. **Distinción crítica**:
   - 🟢/🟡 → usable hoy. Verificar firma con grep antes de invocar.
   - ⚠️ → existe pero requiere extraer/wraparound. Documentar en plan.
   - 🔴/🔮 → NO existe ni equivalente. No inventar.
3. **Imports**: usar paths relativos del repo (`./game/llm-agents/...`). NO `cwe/X` (ficticio).
4. **Si Pablo describe un juego**: mapealo contra capacidades 🟢/🟡. Si pide algo 🔴/🔮, decílelo: "esto requiere fase nueva".
5. **Si proponés código**: las APIs que mencionás deben existir en este doc con marca 🟢 o 🟡.
6. **Si la doc está desactualizada vs lo que ves en código**: asumí que la doc está desactualizada (no el código). Pero antes de cambiar el doc, verificá con Pablo + grep.
7. **Cuando agregues capacidades nuevas en Claude Code**: actualizá este doc en el mismo commit. No es opcional.

Este doc es **el contrato entre lo que CWE puede y cómo se le pide**. Mantenelo vivo.
