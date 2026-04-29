# ARCHITECTURE.md — Estructura del código

## Frame del MVP

Esta arquitectura está pensada para el MVP (herramienta personal de Pablo para AGENTS.INC). Las decisiones que parecen "exageradas" — separación estricta de capas, schemas Zod, tests críticos, APIs públicas explícitas — pagan en dos horizontes:

1. **Inmediato**: Pablo desarrolla AGENTS.INC más rápido sin pelearse con un monolito.
2. **Eventual**: cuando CWE eventualmente se convierta en producto público (horizonte 3), el refactor es mínimo.

Si en algún momento te encuentras justificando complejidad solo con "los usuarios futuros van a necesitar esto", para. Esa lógica es trampa. Ver `MVP_SCOPE.md`.

---

## Estado actual de migración (2026-04-29)

**60+ módulos extraídos** del monolito. legacy.ts: 11,941 → ~5,800 líneas (~50% migrado, ~50% pendiente). Schemas Zod cerrados (Fase 3). DSL de cutscenes cerrado (Fase 4). Capa LLM + agentes con LLM real cerrada (Fase 5).

```
src/
├── utils/               (3 módulos: id, escape-html, format)
├── engine/              (27+ módulos — ver tabla abajo)
├── game/                (5 módulos: prop-catalog, zone-catalog, needs,
│                                    agent-kits, migrations)
│   └── llm-agents/      (Fase 5: brain, personality, memory, persistence,
│                                  triggers, runtime, streaming-ui +
│                                  3 personalidades concretas)
├── cutscene/            (Fase 2: model, scenes, inheritance, keyframes,
│                                  camera, walls, schema, migrations,
│                                  persistence parcial, runtime;
│                         Fase 4: parser, schema-ast, shots, camera-moves,
│                                  actions, compiler)
├── llm/                 (Fase 5: types, anthropic-client, mock-client,
│                                  models, sanitize, cost, cost-tracker,
│                                  queue, factory, storage-keys)
├── ui/                  (5 módulos: modals, catalog-panel, slots-panel,
│                                    rooms-panel, paint-panel)
├── editor/              (4 módulos: multi-sel, toolbar, playback, persistence)
├── legacy.ts            (~5,800 líneas, todo lo no extraído)
└── main.ts              (importa './legacy')

scripts/
└── cutscene-compile.ts  (CLI Fase 4: DSL .md → cutscene JSON)
```

### Módulos engine extraídos

| Módulo | Qué cubre |
|---|---|
| state | constantes geometría grid + paleta + tipos |
| world | worldGrid + props + push/remove/findPropAt + getFloorStackBase + defaultWorld |
| persistence | localStorage + serializeWorld + saveToStorage + loadFromStorage + cuarentena + slots |
| schema | Zod schemas de Prop, Agent, RoomMeta, Zone, World |
| migrations | migrateWorld (rooms→roomMeta+zones, sides v1→v2) |
| event-bus | pub/sub mínimo |
| voices | VOICE_PRESETS + hash + pickVoiceIdx |
| speech | overhead bubbles + dialogue panel + voice TTS |
| thought-bubbles | Tomodachi-style scribble overlay |
| landing-anim | squash al aterrizar tras drag |
| camera-gizmo | dummy 3D de cámara cinemática (render puro) |
| wall-queries | hasWallN/W + door queries + isCorner + isAllWindowCorner + bounds + path checks |
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
| agent-chassis | spawn + mesh + facing + sync |
| agent-drag | Tomodachi-style ghost + spring physics |
| agent-selection | highlight ring + raycast click |
| agent-status | ensure/clear + position update |
| agent-helpers | assignAgentTarget + setAgentMeshOpacity + nearest helpers |
| stations | handleAgentLanded + startWorkingState + pickRandomDestination + updateAgents |
| needs queries | getAgentMostCriticalNeed + findZoneForNeed + updateAgentNeeds |
| prop-drag | ghost wireframe + commit/cancel hooks |
| place-mode | catalog placement + door arrow |
| wall-build | Sims-style drag con axis-lock |
| camera-iso | theta/phi/dist/zoom/pan + updateCamera |
| spawners | random prop + remove last + try agent |
| paint-tool | state + tool runtime + flood fill |
| zone-edit | start/stop + drag add/remove |
| loadWorldData | geometry+props+zones |

### Módulos cutscene extraídos

| Módulo | Qué cubre |
|---|---|
| model | tipos + forEachCutsceneKf iterator |
| scenes | ensureSceneConsistency mutante + computeSceneView puro |
| inheritance | chain + lastKfWithInheritance + kfIsVisible |
| keyframes | shift/warp/reassign/filter/assign |
| camera | interpCameraPose |
| walls | computeWallStateAt |
| schema | Zod schemas de Scene, kfs, Cutscene |
| migrations | migrateCutscene (sceneId, escenaRootId, inheritState defaults) |
| persistence (parcial) | save/load + cabling con validate |

### Módulos editor extraídos (post-Fase 2 diferidos)

| Módulo | Qué cubre |
|---|---|
| multi-sel | state ops + lasso DOM + group drag |
| toolbar | ceUpdateToolbarFields helpers |
| playback | POV controls + scrubbing + cePreviewMode (parcial) |
| persistence | save/load cutscenes + integration con validate |

### Módulos cutscene Fase 4 (DSL)

| Módulo | Qué cubre |
|---|---|
| parser | markdown narrativo → AST DSL |
| schema-ast | Zod schema del AST DSL |
| shots | shot types (wide_establishing, medium_shot, close_up, two_shot, over_the_shoulder) → CameraKf[] |
| camera-moves | dolly_in/pull_out, pan, push_in → kfs interpolados |
| actions | agent actions (camina_a, mira_a, dice, anima, espera) → kfs |
| compiler | orquestador AST → cutscene model con simulación temporal |

CLI: `scripts/cutscene-compile.ts` (`npm run cutscene-compile path/to/scene.md`).

### Módulos LLM Fase 5

| Módulo | Qué cubre |
|---|---|
| types | contrato canónico LLMClient, SystemBlock[], CompletionOpts, Message |
| models | mapping alias → API ID (`haiku-4-5` → `claude-haiku-4-5-20251001`) |
| anthropic-client | implementación real con streaming + prompt caching |
| mock-client | implementación determinista para tests |
| factory | construcción de cliente según settings |
| sanitize | escape de strings + length limits + tag-injection detection |
| cost | estimación pre-call por modelo |
| cost-tracker | session cost tracker + cap enforcement |
| queue | GlobalLLMQueue (semaphore, max 1 concurrent, FIFO) |
| storage-keys | keys de localStorage para LLM state |

### Módulos llm-agents Fase 5

| Módulo | Qué cubre |
|---|---|
| brain | AgentBrain.speak(target, context) con streaming + fallback |
| personality | tipos Personality + helpers |
| memory | AgentMemory + episodes + facts + relationships |
| persistence | save/load memory por agentId con cuarentena Zod |
| streaming-ui | speech bubbles word-by-word + abort en click |
| triggers | encuentros adyacentes + crisis de necesidades + cooldowns |
| runtime | bucle de ticks que dispara triggers vía queue |
| personalities/ceo-pretender | personalidad concreta CEO satírico |
| personalities/junior-overconfident | personalidad concreta junior arrogante |
| personalities/intern-anxious | personalidad concreta intern ansioso |

### Setter pattern para deps cíclicas

Muchos módulos engine necesitan acceso a state que sigue en legacy hasta extracción completa (agents, scene, theta, wallMode, paintColor, markWorldChanged). El patrón:

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

Permite extraer la lógica sin tocar el state owner. Cuando el state owner también se extraiga, el setter se elimina.

### Debt arquitectónico identificado

- `src/engine/agent-texture.ts` importa `../game/agent-kits` — viola layering "engine no importa game". Pre-existente, fuera de scope de Fase 2 actual. Corregir en sesión de cleanup.

---

## Estructura objetivo (cuando MVP esté completo)

```
agents-inc/
├── CLAUDE.md
├── WORK_LOG.md               ← log local de sesiones
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html                  ← entry point HTML (chiquito, ~20 líneas)
│
├── .codex/
│   └── config.toml             ← config del modelo de Codex
│
├── docs/
│   ├── VISION.md
│   ├── MVP_SCOPE.md
│   ├── ENGINE.md
│   ├── CUTSCENES.md
│   ├── AGENTS_LLM.md
│   ├── AI_ORCHESTRATION.md
│   ├── ARCHITECTURE.md         ← este archivo
│   ├── ROADMAP.md
│   ├── PRODUCT_FUTURE.md
│   └── reference/
│       └── three-preview-monolith.html
│
├── locales/                    ← i18n desde día uno
│   ├── es.json
│   └── en.json
│
├── scenes/                     ← archivos DSL escritos a mano o por IA
│   ├── intro-tutorial.scene.md
│   ├── ceo-arrives.scene.md
│   └── ...
│
├── public/                     ← assets estáticos
│   ├── textures/
│   ├── sounds/
│   └── fonts/
│
├── src/
│   ├── main.ts                 ← arranque: importa todo y conecta
│   │
│   ├── engine/                 ← cwe (Coto Wild Engine) — reusable
│   │   ├── index.ts            ← API público del engine
│   │   ├── world.ts
│   │   ├── camera.ts
│   │   ├── walls.ts
│   │   ├── props.ts
│   │   ├── agents.ts
│   │   ├── pathfinding.ts
│   │   ├── fx.ts
│   │   ├── speech.ts
│   │   ├── build-mode.ts
│   │   ├── persistence.ts
│   │   ├── coords.ts
│   │   ├── schema.ts           ← Zod schemas del engine
│   │   └── migrations.ts
│   │
│   ├── game/                   ← AGENTS.INC: lógica específica
│   │   ├── index.ts
│   │   ├── needs.ts
│   │   ├── working.ts
│   │   ├── encounters.ts       ← encuentros sociales (con LLM)
│   │   ├── prop-catalog.ts
│   │   ├── agent-presets.ts
│   │   ├── voices.ts
│   │   └── llm-agents/         ← integración LLM con agentes
│   │       ├── personality.ts
│   │       ├── memory.ts
│   │       ├── brain.ts
│   │       ├── actions.ts
│   │       ├── persistence.ts
│   │       ├── triggers.ts
│   │       └── personalities/
│   │
│   ├── cutscene/               ← runtime + DSL compiler
│   │   ├── index.ts
│   │   ├── runtime.ts
│   │   ├── schema.ts           ← Zod schema cutscene
│   │   ├── migrations.ts
│   │   ├── inheritance.ts
│   │   ├── compiler.ts         ← DSL → cutscene model
│   │   ├── parser.ts           ← markdown → AST DSL
│   │   ├── shots.ts
│   │   ├── camera-moves.ts
│   │   └── actions.ts
│   │
│   ├── editor/                 ← UI del editor de cutscenes
│   │   ├── index.ts
│   │   ├── editor.ts           ← orquestador
│   │   ├── timeline.ts
│   │   ├── tracks/
│   │   ├── gizmo.ts
│   │   ├── popovers.ts
│   │   ├── multi-sel.ts
│   │   ├── undo.ts
│   │   └── persistence.ts
│   │
│   ├── llm/                    ← capa LLM genérica (compartida)
│   │   ├── index.ts
│   │   ├── client.ts           ← LLMClient interface
│   │   ├── anthropic-client.ts ← implementación Anthropic
│   │   ├── cache.ts
│   │   └── types.ts
│   │
│   ├── ai/                     ← AI Orchestration (los generators)
│   │   ├── index.ts
│   │   ├── action-schema.ts
│   │   ├── action-handlers.ts
│   │   ├── validators.ts
│   │   ├── prompts/
│   │   │   ├── personality.ts
│   │   │   ├── cutscene.ts
│   │   │   ├── iterator.ts
│   │   │   └── shared.ts
│   │   ├── generators/
│   │   │   ├── personality-generator.ts
│   │   │   ├── cutscene-generator.ts
│   │   │   └── world-iterator.ts
│   │   └── ui/
│   │       ├── personality-panel.ts
│   │       ├── cutscene-panel.ts
│   │       └── iterator-panel.ts
│   │
│   ├── i18n/
│   │   ├── index.ts            ← setup i18next
│   │   └── types.ts
│   │
│   ├── ui/                     ← UI compartida
│   │   ├── modals.ts
│   │   ├── toolbar.ts
│   │   ├── settings.ts         ← API key, idioma
│   │   └── styles.css
│   │
│   └── utils/                  ← helpers genéricos
│       ├── id.ts
│       ├── math.ts
│       └── color.ts
│
└── tests/                      ← tests críticos (Vitest)
    ├── engine/
    ├── cutscene/
    ├── ai/
    └── ...
```

---

## Reglas de import

**Estas son las reglas duras de dependencias entre carpetas.** Romperlas = la separación se cae.

| De | Puede importar de |
|---|---|
| `engine/` | `utils/`, `i18n/`, libs externas (three.js, etc.) |
| `game/` | `engine/`, `llm/`, `utils/`, `i18n/` |
| `cutscene/` | `engine/`, `utils/`, `i18n/` |
| `editor/` | `cutscene/`, `engine/`, `ui/`, `utils/`, `i18n/` |
| `llm/` | `utils/` y libs externas |
| `ai/` | `llm/`, `engine/`, `cutscene/`, `game/`, `ui/`, `utils/`, `i18n/` |
| `ui/` | `utils/`, `i18n/` |
| `main.ts` | todos |

**Lo que NO puede pasar nunca:**
- ❌ `engine/` importa de `game/` — engine no sabe del juego.
- ❌ `engine/` importa de `cutscene/` — engine no sabe de cutscenes.
- ❌ `engine/` importa de `ai/` ni de `llm/` — engine es agnóstico de IA.
- ❌ `cutscene/` importa de `editor/` — el runtime de producción no incluye el editor.
- ❌ `cutscene/` importa de `ai/` — cutscenes son ejecutables sin IA.
- ❌ `game/` importa de `editor/` — la lógica del juego no depende de la UI del editor.
- ❌ `llm/` importa de `engine/` ni `game/` — la capa LLM es genérica.

Si te encuentras escribiendo uno de esos imports, párate y rediseña.

---

## Stack técnico

- **Lenguaje**: TypeScript (strict mode).
- **Bundler / dev server**: Vite.
- **Renderer**: Three.js (r128 en monolito; revisar si actualizar al migrar).
- **Audio**: Tone.js.
- **Schema validation**: Zod.
- **i18n**: i18next o similar.
- **LLM**: Anthropic API (Claude Haiku para volumen, Sonnet para calidad).
- **Tests**: Vitest.
- **Linting**: ESLint + Prettier.

### Lo que NO hay en el MVP

- **Sin backend**. Todo localStorage. Cuando llegue horizonte 2 (AGENTS.INC publicado), aparece Supabase.
- **Sin LLM proxy**. Pablo usa su API key directo desde el browser.
- **Sin auth, billing, sharing público**. Esos son features de horizontes futuros.

Ver `MVP_SCOPE.md` para detalle.

---

## Decisiones técnicas

### Por qué Vite
- Hot reload rápido.
- Build de producción optimizado.
- TypeScript out of the box.
- Sin config compleja.

### Por qué TypeScript strict
- Modelo de cutscene es complejo (kfs, scenes, inheritance) — los tipos previenen errores costosos.
- Refactoring asistido por compilador.
- Documentación implícita en tipos.
- Strict mode evita `any` accidental.

### Por qué Zod
- Cutscenes y mundos se serializan a JSON y persisten. Cargar datos viejos puede fallar silenciosamente sin validación.
- Zod valida en runtime y da errores legibles.
- Con migrations explícitas, podemos versionar schemas y migrar datos.
- **Lección aprendida en Fase 3**: probar contra data real desde el primer round del schema. Asumir que la doc cubre todos los casos lleva a parches después.

### Por qué módulos pequeños
- Cada archivo idealmente < 300 líneas.
- Fácil de navegar, testear, entender.
- El monolito tiene 12,500 líneas porque no había alternativa. No volvemos ahí.

### Por qué i18n desde el principio
- Agregar i18n después es 10x más caro que hacerlo desde el setup inicial.
- AGENTS.INC se publicará en español e inglés — eso es decisión cerrada.
- Estructura preparada para más idiomas sin refactor.

### Por qué separación tan estricta engine/game
- Permite que CWE sea reusable después (horizonte 3) sin reescribir.
- Hace tests más fáciles (engine se testea sin necesidad de game).
- Disciplina cognitiva: cada función vive donde tiene sentido conceptualmente.

---

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
  on, off, // eventos
} from './...';
```

### `game/` consume engine y registra cosas

```ts
// src/game/index.ts
import { registerProp } from '../engine';
import { startNeedsLoop } from './needs';
import { startEncountersLoop } from './encounters';

export function startGame(world) {
  registerProp('coffee_machine', { ... });
  registerProp('desk', { ... });
  startNeedsLoop(world);
  startEncountersLoop(world);
}
```

### `llm/` es genérico

```ts
// src/llm/index.ts
export interface LLMClient {
  complete(prompt: string, opts: CompletionOpts): Promise<string>;
  completeStream(prompt: string, opts: CompletionOpts): AsyncIterator<string>;
}

export { AnthropicClient } from './anthropic-client';
```

### `ai/` orquesta los generators

```ts
// src/ai/index.ts
export {
  generatePersonality,
  generateCutscene,
  iterateWorld,
} from './generators';
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
  }
}
```

### `editor/` consume cutscene + engine + ui

```ts
// src/editor/editor.ts
import { CutsceneRuntime } from '../cutscene';
import { setCameraPose } from '../engine';
import { showConfirm } from '../ui/modals';
```

### `main.ts` conecta todo

```ts
// src/main.ts
import { createWorld } from './engine';
import { startGame } from './game';
import { initEditor } from './editor';
import { initI18n } from './i18n';
import { initAI } from './ai';

async function bootstrap() {
  await initI18n();
  const world = createWorld({ width: 6, height: 6 });
  startGame(world);
  initEditor(world);
  initAI(world);
}

bootstrap();
```

---

## Plan de migración (estado actual)

### Fase 0 — Setup ✅ (cerrada)
Vite + TS strict + tooling configurado. Monolito en `docs/reference/`.

### Fase 1 — Migración mecánica ✅ (cerrada)
Bulk del monolito a `legacy.ts` con `@ts-nocheck`. Imports CDN → ES modules pinneados.

### Fase 2 — Separación inicial 🟠 (en curso, ~50%)
40+ módulos extraídos. Pendientes grandes:
- Cutscene editor lifecycle (ceOpen/ceClose)
- Runtime evaluation (ceUpdate, partir por subsistema)
- Persistence/undo del editor
- Timeline rendering (DOM heavy)
- Cámara gizmo editor wrapper
- FX system (singleton mutable)
- POV controls
- Toolbar UI completa
- Mouse handlers globales
- TECHO ROOF: NO EXTRAER — Pablo decidió reescribir desde cero cuando llegue.

### Fase 3 — Schema + tipos ✅ (cerrada)
Schemas Zod completos (world + cutscene). Migrations. Validation runtime con cuarentena. 100 tests verdes.

### Fase 4 — DSL de cutscenes ✅ (cerrada)
Parser markdown → AST → cutscene model. Shot types (wide_establishing, medium_shot, close_up, two_shot, over_the_shoulder), camera moves (dolly_in, pull_out, pan, push_in), agent actions (camina_a, mira_a, dice, anima, espera). CLI `npm run cutscene-compile`. Fixture e2e + 43 tests Fase 4. Pipeline funcional. Pendientes nice-to-have: `[PENDING-TUNING-SHOTS]`, `[PENDING-FIXTURE-ZONES]`.

### Fase 5 — Capa LLM + agentes con LLM real ✅ (cerrada)
Capa LLM en `src/llm/` (types, anthropic-client, mock-client, models, sanitize, cost, cost-tracker, queue, factory). AgentBrain.speak() con streaming. 3 personalidades concretas: ceo-pretender, junior-overconfident, intern-anxious. AgentMemory con persistencia + cuarentena Zod. Triggers de encuentros + crisis. Settings UI integrado al toolbar (API key + cap + disable LLM). 115 tests Fase 5. Validación visual end-to-end OK. Pendiente nice-to-have: `[PENDING-PERSONALITY-TUNING]`.

### Fase 5.1 — Encuentros con cuerpo (próxima)
decide() real con action catalog completo (WALK_TO, LOOK_AT, EMOTE handlers). Score de importance + memoria episódica avanzada. Memory consolidation con LLM. Sonnet 4.6 expuesto en UI tras evaluación. Personalidades adicionales según design narrativo.

### Fase 6 — AI Orchestration
Tres generators: Personality, Cutscene, World Iterator.

### Fase 7 — Polish + AGENTS.INC content
Personalidades concretas, mundo de oficina con zonas, cutscenes narrativas.

### Fase 8 — Tests críticos
Cobertura DSL compiler, engine/coords, engine/walls, E2E con Playwright.

---

## La separación engine/game es lo más importante

Si todo lo demás se va a la mierda pero la separación se mantiene, podemos recuperar. Si la separación se rompe, volvemos al monolito.

Cada vez que escribas código, preguntate: **¿esto es engine (motor genérico) o game (lógica de AGENTS.INC)?** Si es engine, va en `src/engine/`. Si es game, va en `src/game/`. Si dudás, parate y consultá.

Esa pregunta sostenida es la disciplina que paga el largo plazo.
