# ARCHITECTURE.md — Estructura del código

## Estado actual (2026-04-27)

**40 módulos extraídos** del monolito. legacy.ts: 11,941 → ~8,800 líneas
(~26% migrado, ~74% pendiente). 12 commits en `main`.

```
src/
├── utils/               (3 módulos: id, escape-html, format)
├── engine/              (27 módulos — ver tabla abajo)
├── game/                (5 módulos: prop-catalog, zone-catalog, needs,
│                                    agent-kits, migrations)
├── cutscene/            (1 módulo: persistence parcial)
├── ui/                  (5 módulos: modals, catalog-panel, slots-panel,
│                                    rooms-panel, paint-panel)
├── legacy.ts            (~8,800 líneas, todo lo no extraído)
└── main.ts              (importa './legacy')
```

### Módulos engine extraídos

| Módulo | Qué cubre |
|---|---|
| state | constantes geometría grid + paleta + tipos |
| world | worldGrid + props + push/remove/findPropAt + getFloorStackBase + defaultWorld |
| persistence | localStorage (serializeWorld + saveToStorage + loadFromStorage + markWorldChanged + slots) |
| event-bus | pub/sub mínimo |
| voices | VOICE_PRESETS + hash + pickVoiceIdx |
| speech | overhead bubbles + dialogue panel + voice TTS |
| thought-bubbles | Tomodachi-style scribble overlay |
| landing-anim | squash al aterrizar tras drag |
| camera-gizmo | dummy 3D de cámara cinemática (render puro) |
| wall-queries | hasWallN/W + door queries + isCorner + isAllWindowCorner + bounds + nearest helpers + path checks |
| three-primitives | mkBox + makeGlassMesh + setStrokesGetter |
| rooms | flood-fill + detección habitaciones + zonas (mutaciones + queries) |
| rooms-overlay | render translúcido habitaciones + zonas |
| door-panels | DOOR_TEMPLATES + makeDoorPanelMesh |
| scene-graph | scene singleton + addToScene + clearScene + setPropMeshOpacity |
| walls-render | builders sólidos + ventanas + puertas |
| selection-highlight | wireframe yellow para mueble seleccionado |
| floor-render | tiles + GridHelper |
| paint | setFloorTileColor + setWallFaceColor + flood fills |
| paint-preview | overlays translúcidos en hover modo Pintar |
| pathfinding | A* clásico Manhattan + isBlockedByProp + neighbors |
| zone-config | min cells for zones (persisted) |
| wall-mode | wallHeightForN/W con cutaway-aware (setter pattern) |
| raycaster | shared raycaster + getCellFromEvent + getFloorCellFromEvent + getPropFromEvent |
| agent-texture | brain + item canvas → CanvasTexture |
| agents-state | isAgentAt + setAgentsGetter |
| wall-preview-render | overlays drag de pared (verde/rojo) |

### Setter pattern para deps cíclicas

Muchos módulos engine necesitan acceso a state que sigue en legacy hasta
extracción completa (agents, scene, theta, wallMode, paintColor,
markWorldChanged). El patrón:

```ts
// engine/foo.ts
let _xGetter: () => X = () => defaultX;
export function setXGetter(getter: () => X): void { _xGetter = getter; }
```

```ts
// legacy.ts (boot)
let x = ...;
setXGetter(() => x);
```

Permite extraer la lógica sin tocar el state owner. Cuando el state owner
también se extraiga, el setter se elimina.

---

## Estructura objetivo

```
agents-inc/
├── CLAUDE.md
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html                  ← entry point HTML (chiquito, ~20 líneas)
│
├── docs/
│   ├── VISION.md
│   ├── ENGINE.md
│   ├── CUTSCENES.md
│   ├── ARCHITECTURE.md         ← este archivo
│   ├── ROADMAP.md
│   └── reference/
│       └── three-preview-monolith.html
│
├── src/
│   ├── main.ts                 ← arranque del juego: importa todo y conecta
│   │
│   ├── engine/                 ← cwe (Coto Wild Engine) — reusable
│   │   ├── index.ts            ← API público del engine
│   │   ├── world.ts            ← grid, cells, world state
│   │   ├── camera.ts           ← cámara iso + gizmo + lentes
│   │   ├── walls.ts            ← walls placement + render
│   │   ├── props.ts            ← prop registry + placement + render
│   │   ├── agents.ts           ← chassis: mesh, animaciones, facing, hopping
│   │   ├── pathfinding.ts      ← A* sobre grid
│   │   ├── fx.ts               ← FX system
│   │   ├── speech.ts           ← speech bubbles + TTS
│   │   ├── build-mode.ts       ← modo construcción (jugar/mover/construir/pintar)
│   │   ├── persistence.ts      ← serializar/deserializar mundo
│   │   └── coords.ts           ← helpers de coordenadas grid ↔ three
│   │
│   ├── game/                   ← AGENTS.INC: lógica específica
│   │   ├── index.ts
│   │   ├── needs.ts            ← sistema de necesidades
│   │   ├── working.ts          ← working state + (futuro) mini-juego
│   │   ├── encounters.ts       ← encuentros sociales (B.9)
│   │   ├── dialogues.ts        ← templates de diálogo procedural
│   │   ├── prop-catalog.ts     ← registra props específicos de AGENTS.INC
│   │   ├── agent-presets.ts    ← presets de agentes (CEO, junior, etc.)
│   │   └── voices.ts            ← presets de voces TTS
│   │
│   ├── cutscene/               ← runtime + DSL compiler
│   │   ├── index.ts
│   │   ├── runtime.ts          ← reproductor de cutscenes
│   │   ├── schema.ts           ← Zod schema del modelo cutscene
│   │   ├── inheritance.ts      ← lógica de cadena escenaRootId
│   │   ├── compiler.ts         ← DSL → cutscene model
│   │   ├── parser.ts           ← markdown → AST DSL
│   │   ├── shots.ts            ← shot types (wide, close_up, two_shot...)
│   │   ├── camera-moves.ts     ← dolly_in, pan, push_in...
│   │   └── actions.ts          ← acciones de agente del DSL
│   │
│   ├── editor/                 ← UI del editor de cutscenes
│   │   ├── index.ts
│   │   ├── editor.ts           ← orquestador
│   │   ├── timeline.ts         ← render del timeline
│   │   ├── tracks/             ← un archivo por tipo de track
│   │   │   ├── scenes.ts
│   │   │   ├── camera.ts
│   │   │   ├── walls.ts
│   │   │   ├── fx.ts
│   │   │   └── agents.ts
│   │   ├── gizmo.ts            ← gizmo 3D de cámara
│   │   ├── popovers.ts         ← scene popover, kf popover
│   │   ├── multi-sel.ts        ← lasso, group drag, group clone
│   │   ├── undo.ts             ← stack de snapshots
│   │   └── persistence.ts      ← save/load cutscenes
│   │
│   ├── ui/                     ← UI compartida (botones, modales, layout)
│   │   ├── modals.ts           ← showConfirm, showPrompt
│   │   ├── toolbar.ts
│   │   └── styles.css
│   │
│   └── utils/                  ← helpers genéricos
│       ├── id.ts               ← uid()
│       ├── math.ts
│       └── color.ts
│
├── scenes/                     ← archivos DSL escritos a mano o por Claude
│   ├── intro-tutorial.scene.md
│   ├── ceo-arrives.scene.md
│   └── ...
│
├── public/                     ← assets estáticos (texturas, sonidos, fuentes)
│   ├── textures/
│   ├── sounds/
│   └── fonts/
│
└── tests/                      ← tests (más adelante)
    ├── engine/
    ├── cutscene/
    └── ...
```

## Reglas de import

**Estas son las reglas duras de dependencias entre carpetas.** Romperlas = la separación se cae.

| De | Puede importar de |
|---|---|
| `engine/` | `utils/` y dependencias externas (three.js, etc.) |
| `game/` | `engine/`, `utils/` |
| `cutscene/` | `engine/`, `utils/` |
| `editor/` | `cutscene/`, `engine/`, `ui/`, `utils/` |
| `main.ts` | todos |
| `ui/` | `utils/` |

**Lo que NO puede pasar nunca:**
- ❌ `engine/` importa de `game/` — engine no sabe del juego.
- ❌ `engine/` importa de `cutscene/` — engine no sabe de cutscenes.
- ❌ `cutscene/runtime.ts` importa de `editor/` — el runtime de producción no incluye el editor.
- ❌ `game/` importa de `editor/` — la lógica del juego no depende de la UI del editor.

Si te encuentras escribiendo uno de esos imports, párate y rediseña.

## Stack técnico

- **Lenguaje**: TypeScript (strict mode).
- **Bundler / dev server**: Vite.
- **Renderer**: Three.js (versión a definir en migración; r128 hoy en monolito).
- **Audio**: Tone.js.
- **Schema validation**: Zod (para validar cutscenes serializadas y world state).
- **Tests**: Vitest (cuando llegue el momento).
- **Linting**: ESLint + Prettier.

## Decisiones técnicas

### Por qué Vite
- Hot reload rápido (cambio en archivo → browser actualiza < 1s).
- Build de producción optimizado.
- TypeScript out of the box.
- No requiere config compleja.

### Por qué TypeScript
- El modelo de datos del cutscene es complejo (kfs, scenes, inheritance) — los tipos previenen errores costosos.
- Refactoring asistido por compilador.
- Documentación implícita en los tipos.
- Strict mode forzado para evitar `any` accidental.

### Por qué Zod
- El cutscene se serializa a JSON y se persiste. Cargar un cutscene viejo después de un cambio de modelo puede fallar silenciosamente.
- Zod valida en runtime y da errores legibles.
- Con migrations explícitas, podemos versionar el schema y migrar cutscenes viejas.

### Por qué módulos pequeños
- Cada archivo idealmente < 300 líneas.
- Fácil de navegar, fácil de testear, fácil de entender en una lectura.
- El monolito tiene 12,500 líneas porque no había alternativa. No queremos volver ahí.

## Conexión entre capas

### `engine/` expone
```ts
// src/engine/index.ts
export {
  createWorld, World,
  spawnAgent, moveAgent, Agent,
  placeWall, removeWall,
  placeProp, removeProp,
  registerProp,
  setCameraPose, getCameraPose,
  showSpeechBubble,
  spawnFx,
  // eventos
  on, off,
} from './...';
```

### `game/` consume engine y registra cosas
```ts
// src/game/index.ts
import { registerProp } from '../engine';
import { startNeedsLoop } from './needs';
import { startEncountersLoop } from './encounters';

export function startGame(world) {
  // Registrar props específicos de AGENTS.INC
  registerProp('coffee_machine', { ... });
  registerProp('desk', { ... });
  // etc.
  
  // Arrancar loops del juego
  startNeedsLoop(world);
  startEncountersLoop(world);
}
```

### `cutscene/runtime` consume engine
```ts
// src/cutscene/runtime.ts
import { setCameraPose, moveAgent, showSpeechBubble } from '../engine';

export class CutsceneRuntime {
  tick(dt) {
    const cameraPose = this.computeCameraAt(this.playhead);
    setCameraPose(cameraPose);
    
    for (const agent of this.activeAgents) {
      const pos = this.computeAgentPosAt(agent.id, this.playhead);
      moveAgent(agent.id, pos);
    }
    // etc.
  }
}
```

### `editor/` consume cutscene + engine + ui
```ts
// src/editor/editor.ts
import { CutsceneRuntime } from '../cutscene';
import { setCameraPose } from '../engine';
import { showConfirm } from '../ui/modals';

// Orquesta todo: timeline, gizmo, multi-sel, undo, save/load
```

### `main.ts` conecta todo
```ts
// src/main.ts
import { createWorld } from './engine';
import { startGame } from './game';
import { initEditor } from './editor';

const world = createWorld({ width: 6, height: 6 });
startGame(world);
initEditor(world);
```

## Migración del monolito

El plan de migración (ver también `ENGINE.md` sección "Plan de extracción"):

### Fase 0 — Setup (1 sesión)
- `npm create vite@latest agents-inc -- --template vanilla-ts`
- Configurar tsconfig estricto.
- Instalar dependencias (three, tone, zod).
- Mover `three-preview.html` a `docs/reference/three-preview-monolith.html`.
- Setup ESLint + Prettier.

### Fase 1 — Migración mecánica (2-3 sesiones)
- Extraer scripts del HTML a `.ts` files.
- Sin separar engine/game todavía. Una sola carpeta `src/` plana.
- Convertir vars globales (`agents`, `world`, `wallN`) a un objeto `state` exportado.
- Asegurar que el juego corre igual que antes.

### Fase 2 — Separación inicial (3-4 sesiones)
- Crear carpetas `engine/`, `game/`, `cutscene/`, `editor/`.
- Mover funciones a su carpeta correspondiente.
- Definir API públicos (`index.ts` en cada carpeta).
- Empezar a quebrar imports cruzados.

### Fase 3 — Schema + tipos (1-2 sesiones)
- Definir Zod schemas para world state, cutscene, agente.
- Tipar todo lo que estaba `any`.
- Migration helpers para datos persistidos viejos.

### Fase 4 — DSL (varias sesiones)
- Parser de markdown narrativo.
- Compiler DSL → cutscene model.
- Shot types, camera moves, agent actions.

### Fase 5 — Lo que viene
- Render MP4.
- Audio tracks.
- Tests.
- Posible separación física del engine como package.

---

La separación de capas es la cosa más importante de la arquitectura. Si todo lo demás se va a la mierda pero la separación se mantiene, podemos recuperar. Si la separación se rompe, vamos a estar de vuelta en el monolito.
