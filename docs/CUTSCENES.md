# CUTSCENES.md — Editor y runtime de cutscenes

## Qué es

Un sistema completo para crear **cinematics narrativas** dentro del mundo de cwe. No es video editing — es **scripting de simulaciones**. Escribes kfs (keyframes) que dicen "en t=2s, el agente Mike va a la cell (3,4)" o "en t=5s, la cámara hace un push-in al agente Cris", y el runtime los reproduce en vivo, simulando todo desde cero cada vez.

La inspiración es Sequencer de Unreal o Source Filmmaker, no Premiere.

## Capas del sistema

```
┌──────────────────────────────────────┐
│   editor (UI)                        │   ← timeline, gizmo, multi-sel
└──────────────┬───────────────────────┘
               │ edita y guarda cutscene
               ▼
┌──────────────────────────────────────┐
│   cutscene-runtime                   │   ← reproduce cutscene
└──────────────┬───────────────────────┘
               │ emite comandos al engine
               ▼
┌──────────────────────────────────────┐
│   engine (cwe)                       │
└──────────────────────────────────────┘
```

El **runtime** es lo que el juego incluye en producción (un .js liviano que sabe leer una cutscene serializada y reproducirla). El **editor** es una herramienta separada, pesada, solo para autoría.

Más adelante: un **DSL compiler** que toma un script en formato narrativo (markdown estructurado) y genera la cutscene serializada, sin pasar por el editor. Ver sección "DSL" abajo.

---

## Modelo de datos

> **Nota**: el schema canónico vive en `src/cutscene/schema.ts` (Zod). La descripción aquí es conceptual. Si hay diferencia entre lo que está acá y el schema en código, **el schema gana**. Los schemas Zod fueron cerrados en Fase 3 (ver `ROADMAP.md`).

Toda cutscene es un objeto serializable:

```ts
type Cutscene = {
  duration: number;
  scenes: Scene[];        // los "planos" / shots
  camera: { keyframes: CameraKf[] };
  walls:  { keyframes: WallsKf[] };
  fx:     { entities: FxEntity[] };  // cada entidad tiene sus kfs
  tracks: AgentTrack[];   // un track por agente
  agents: { id, emoji, voiceIdx }[];
};
```

### Scene (plano)

Cada `Scene` representa un plano (en lenguaje cinematográfico). Los planos son **entidades del modelo**, no derivados del tiempo. Tienen identidad estable.

```ts
type Scene = {
  id: string;             // único, estable
  tStart: number;
  tEnd: number;
  name: string;           // "Plano 1", "Mike camina"...
  inheritState: boolean;  // continuidad o corte de escena
  escenaRootId: string;   // identidad de escena (ver abajo)
};
```

### Keyframe

Cada kf vive en un track (cámara, walls, fx por entidad, agente por track) y tiene un `t` y un `sceneId`:

```ts
type CameraKf = {
  t: number;
  sceneId: string;        // a qué plano pertenece (estable)
  position: { x, y, z };
  target: { x, y, z };
  lens: number;           // mm, 24-200
  projection: 'orto' | 'perspective';
  roll: number;
  cut: boolean;           // marca de cut entre planos
  // ... transition info
};

type AgentKf = {
  t: number;
  sceneId: string;
  type: 'move' | 'speak' | 'animation';
  // dependiendo del type:
  cx?: number; cy?: number;       // move
  text?: string;                  // speak
  preset?: string; duration?: number;  // animation
};

// Walls y FX kfs siguen el mismo patrón.
```

---

## Decisiones de modelo importantes (críticas)

Estas decisiones tomaron muchas iteraciones. Si no las entiendes, vas a romper cosas. Léelas dos veces.

### 1. `sceneId` por keyframe — identidad estable

Cada kf está vinculado a su plano de origen vía `sceneId`. El kf NO se vincula por rango temporal. Si el plano se acorta o mueve, el kf sigue siendo del plano. Si su `t` cae fuera del rango actual del plano, el kf queda **dormido** (no se renderiza ni reproduce, pero existe). Si después el plano se extiende y el `t` vuelve a caer dentro, el kf reaparece.

Esta es la base de **drag no destructivo**: arrastrar planos no destruye kfs.

### 2. `inheritState` por plano — continuidad narrativa

Cada plano tiene un flag `inheritState`:

- `inheritState: false` → **corte de escena**. Todo arranca fresh. No hereda nada del plano anterior.
- `inheritState: true` → **continuación**. Hereda del plano anterior: cámara, walls, posiciones de agentes (kfs `move`). NO hereda eventos puntuales (kfs `speak`, `animation`, `fx`).

El primer plano por `tStart` siempre se fuerza a `inheritState: false` (no hay nada antes que heredar).

### 3. `escenaRootId` — identidad estable de escena (NO derivada del orden temporal)

Esta es la decisión más sutil. Una "escena" en sentido cinematográfico es un grupo de planos que pertenecen narrativamente juntos. En el editor se ve como tag "ESCENA N" arriba de los planos.

Las opciones de modelo eran:

a) **Derivar la escena del orden temporal**: si dos planos son consecutivos y el segundo es `inheritState: true`, son la misma escena. Esto es lo que hicimos primero. **Falla** cuando el usuario mueve un plano de Escena 1 al final de Escena 2 — el plano automáticamente queda como continuación de Escena 2, lo cual rompe la narrativa.

b) **Identidad explícita**: cada plano tiene un `escenaRootId` que apunta al plano-raíz de su escena. Si mueves el plano por la timeline, **mantiene su escena**. Esto es lo que hacemos ahora.

Reglas:

- Plano con `inheritState: false` → es root → `escenaRootId = self.id`.
- Plano con `inheritState: true` → `escenaRootId` heredado del plano anterior temporalmente al momento de creación.
- Mover el plano NO cambia su `escenaRootId`.
- Cambiar `inheritState` en el popover SÍ recalcula el `escenaRootId`:
  - `true → false`: este plano ahora es root, `escenaRootId = self.id`.
  - `false → true`: hereda el `escenaRootId` del plano inmediatamente anterior temporalmente.

**Implicación visual**: la timeline puede mostrar "ESCENA 1" sobre A1, "ESCENA 2" sobre B1, "ESCENA 1" otra vez sobre A2 si A2 fue movido después de B1 manteniendo su pertenencia a Escena 1. Visualmente raro, narrativamente correcto.

**Implicación de herencia**: la cadena de continuidad busca planos con MISMO `escenaRootId`, no consecutivos en el tiempo. Así A2 hereda de A1 saltando por encima de B1.

### 4. Drag no destructivo (mouseup-resolves)

Durante el drag de un plano, los vecinos NO se modifican. Pueden visualmente solaparse. Solo en el `mouseup` se ejecuta `resolveOverlaps` que acorta o elimina vecinos invadidos. Esto permite "pasar un plano por encima de otro" sin destruir nada si el usuario vuelve atrás antes de soltar.

**Esc durante drag** restaura el estado al baseline capturado en mousedown.

### 5. Kfs absorbidos cuando se elimina un plano

Cuando A invade B totalmente y B se elimina, los kfs de B (con `sceneId = B.id`) **se reasignan a A**. No se pierden. Si después divides A de nuevo, los kfs se distribuyen.

### 6. Tijera preserva movimiento

Al cortar un plano A en t (creando A1 + A2 con `inheritState: true`), si hay una animación de movimiento de un agente que cruza t, se insertan kfs de move interpolados en `t-ε` (para A1) y `t` (para A2) con la posición intermedia. Resultado: la animación es continua a través del cut.

Lo mismo para walls (snapshot del estado en t para A2).

---

## Persistencia y validación (Fase 3 cerrada)

Las cutscenes guardadas se cargan a través de `validateCutscene` que combina **Zod schema** + **migrations**. El flujo:

1. Leer JSON de localStorage.
2. Pasar por `validateCutscene` (en `src/cutscene/persistence.ts`).
3. Si valida → cargar normal.
4. Si falla → intentar `migrateCutscene` → re-validar.
5. Si sigue fallando → guardar en `cwe_quarantine_*` para inspección, fallback a cutscene vacía con log estructurado.

Los schemas y migrations viven en:

- `src/cutscene/schema.ts` — Zod schemas (Scene, kfs con discriminated union, Cutscene).
- `src/cutscene/migrations.ts` — `migrateCutscene(raw, version)` con casos de kfs viejos sin sceneId, escenaRootId default chain, defaults para campos faltantes.

**Lección aprendida en Fase 3**: los schemas iniciales tenían gaps porque se escribieron mirando la doc, no la data real. Cuando se cableó al runtime aparecieron casos del modelo real (door props sin altura, agents con emoji-array, etc.). Para fases futuras: probar contra data real desde el primer round.

---

## El editor (UI) — qué tiene

Construido a lo largo de muchas versiones, ahora es comparable a un NLE comercial básico:

### Timeline
- Zoom horizontal (Cmd + scroll o pinch).
- Pan (Shift + scroll o middle drag).
- Ruler con tiempos.
- Múltiples tracks: planos arriba, cámara, walls, FX (uno por entidad), tracks de agentes.
- Scrubbing del playhead (click en ruler o cualquier track-area).

### Planos (scenes)
- Bloques visuales con borde sólido (continuidad) o punteado (escena nueva).
- Color por escena (todos los planos de una escena comparten color).
- Tag "ESCENA N" arriba al inicio de cada nueva escena.
- Drag para mover (no destructivo).
- Resize por ambos bordes (con shift = warp, sin shift = shift).
- Dobleclick → popover con rename + toggle "Heredar".
- Tijera (botón) → click en cualquier punto corta el plano ahí.
- Snap+clamp entre planos vecinos (toggleable).

### Keyframes
- Click selecciona, drag mueve.
- Dobleclick: cámara → recaptura pose actual del gizmo. FX → modo placement para reposicionar. Walls → carga estado en pendingHiddenIds.
- Cada tipo de kf tiene su clase visual (`.kf-camera`, `.kf-walls`, `.kf-fx`, `.kf-move`, `.kf-speak`, `.kf-animation`).

### Cámara
- Gizmo 3D editable (drag ejes en mundo 3D).
- Controles WASD + QE + RF.
- Selector de lente (24-200mm).
- Toggle orto/perspectiva.
- Parent agent (cámara sigue al agente).
- "+ Keyframe cámara" captura el estado actual del gizmo.

### Multi-selección
- **Shift + drag en zona vacía** → lasso (rectángulo de selección).
- **Shift + Cmd + drag** → lasso aditivo.
- **Shift + click** en plano/kf → toggle membership (agrega/quita).
- **Drag desde item seleccionado** → mueve grupo entero.
- **Alt + drag desde item seleccionado** → clona grupo entero.
- **Esc** → limpia selección.
- Outline celeste para items en multi-sel.

### Duplicación individual
- **Alt + drag plano** → clona plano (con todos sus kfs vinculados).
- **Alt + drag kf** → clona kf.
- Soltar sin movimiento → cancela el clon.

### Undo/Redo
- Cmd+Z / Cmd+Shift+Z.
- Stack de 50 snapshots (JSON.stringify completo del cutscene).
- Snapshot antes de cada acción discreta.

### Save / Load
- Cutscenes guardadas en localStorage del browser.
- Lista en panel lateral, con miniaturas de timeline.
- **Validación con cuarentena** al cargar (Fase 3 cabling).

---

## El runtime (playback) — cómo funciona

El runtime es lo que ejecuta una cutscene en producción (durante el juego). NO tiene UI.

```ts
import { CutsceneRuntime } from 'cwe/cutscene';

const runtime = new CutsceneRuntime(world, cutsceneData);
runtime.setPlayhead(0);
runtime.play();

// Cada frame del juego:
runtime.tick(dt);
// El runtime calcula el estado de cámara, walls, agentes para playhead actual
// y emite comandos al engine.
```

### Lógica de evaluación

Para cada frame en `playhead = t`:

1. **Determinar el plano activo** (`sceneAt(t)`). Si está en gap entre planos → renderer clear a negro.
2. **Para cámara**: filtrar kfs por `sceneId == sceneAt(t).id`. Interp con prev/next dentro del plano. Si no hay kfs en el plano actual y `inheritState: true`, buscar el último kf en la cadena de continuidad (planos con mismo `escenaRootId` anteriores temporalmente).
3. **Para walls**: idem, pero con snapshot (no interp).
4. **Para cada agente**: idem, kfs `move` interpolan posición. Speak/animation se disparan como eventos (no heredan).
5. **Para FX**: kfs en el plano spawnean entidades cuando `t >= kf.t && t < kf.t + duration`.

### Estado heredado vs eventos

| Tipo | Hereda |
|---|---|
| Cámara (pose, lens, roll) | ✅ |
| Walls (snapshots) | ✅ |
| Agente posición (`move`) | ✅ |
| Agente `speak` | ❌ (evento) |
| Agente `animation` | ❌ (evento) |
| FX | ❌ (evento) |

Eventos no heredan porque no tiene sentido "heredar un saludo" del plano anterior.

---

## DSL — implementado en Fase 4

El editor es poderoso pero **lento para iterar narrativas** desde cero. Para una escena nueva, escribir kf por kf es tedioso. Por eso se implementó un **DSL declarativo** en Fase 4 (cerrada 2026-04-28).

**Formato decidido**: markdown narrativo (no YAML). Razón: es lo que vos vas a escribir a mano (más legible) y lo que la IA va a generar mejor (entrenada con miles de scripts).

**Estado actual**: pipeline end-to-end funcional. Pendientes nice-to-have loggeados como `[PENDING-TUNING-SHOTS]` (ajuste fino de poses por shot type) y `[PENDING-FIXTURE-ZONES]` (resolver locations a fixture zones del mundo).

### Idea

Pablo escribe en lenguaje natural / Claude genera un script en formato narrativo:

```markdown
# Mike y Cris se encuentran

Agentes: mike@cocina-1, cris@pasillo-3
Duración: 7.5s

## Plano 1 — Establecer (2s)
Cámara: wide_establishing
- mike camina_a cris

## Plano 2 — Diálogo (4s)
Cámara: two_shot mike cris, lente 35mm
- 0.5s: mike dice "Cómo va, hermano?"
- 2.5s: cris dice "Acá, peleándola con la planilla."

## Plano 3 — Reacción (1.5s)
Cámara: close_up cris
- 0.0s: cris anima roll_eyes

Transición final: cut
```

Un **compilador** lee este markdown, simula el mundo paso a paso para resolver referencias ("camina_a cris" → cell donde está cris en ese momento), y emite la cutscene serializada (validada contra el schema Zod). El editor abre esa cutscene y la muestra como kfs concretos editables.

### Vocabulario mínimo del DSL

**Shot types** (calculan pose de cámara a partir de sujetos):
- `wide_establishing`
- `medium_shot { sujeto, lente? }`
- `close_up { sujeto, lente? }`
- `two_shot { sujetos[2], lente? }`
- `over_the_shoulder { sujeto_camara, sujeto_objetivo }`
- `top_down { centro? }`
- `tracking { sujeto }`

**Camera moves** (compilan a 2 kfs):
- `dolly_in { sujeto, distancia_inicial, distancia_final }`
- `pan { de, hacia }`
- `push_in { sujeto, factor }`
- `pull_out { sujeto, factor }`

**Acciones de agente**:
- `mike camina_a cris`
- `mike camina_a cocina-1`
- `mike mira_a cris`
- `mike dice "..."`
- `mike anima saluda`
- `mike toma cafe_de cocina-1`
- `mike espera 1s`

### Round-trip

Idealmente, editar visualmente en el editor genera diffs que se reflejan en el DSL. Eso es complicado. Para fase 1, basta con:

- DSL → cutscene model (compile, una vía).
- Editar cutscene model en el editor → guarda el cutscene editado, marca el DSL como "desactualizado" o lo regenera con confirmación.

### Estructura de archivos esperada

```
src/cutscene/
├── compiler.ts       ← DSL → cutscene model (orquestador)
├── parser.ts         ← markdown → AST
├── shots.ts          ← shot types (puros, AST → CameraKf[])
├── camera-moves.ts   ← dolly_in, pan, etc. (puros)
├── actions.ts        ← agent actions (puros)
└── schema-ast.ts     ← Zod schema del AST DSL
```

---

## Estado actual del editor

Pre-migración (en monolito v1.45.1-three): todo lo siguiente funciona y se preservó en migración:

- ✅ Modelo de datos completo (Scene, kfs con sceneId, escenaRootId, inheritState).
- ✅ Drag no destructivo de planos con Esc cancel.
- ✅ Tijera con preservación de movimiento.
- ✅ Multi-sel con lasso (Shift+drag).
- ✅ Shift+click toggle.
- ✅ Group drag y group clone (Alt+drag desde grupo).
- ✅ Alt+drag duplica plano/kf individual.
- ✅ Snap+clamp con toggle.
- ✅ Undo/redo.
- ✅ Doble-click plano → popover rename + inherit.
- ✅ Cámara con gizmo 3D + lentes + orto/perspectiva + parent agent.
- ✅ Walls con snapshots ocultables.
- ✅ FX con entidades y placement.
- ✅ Agentes con tracks (move, speak, animation).
- ✅ Speech bubbles unificados con audio TTS.
- ✅ Save/load de cutscenes en localStorage (con validation Zod desde Fase 3).
- ✅ Preview con renderer clear a negro en gaps.

Post-migración (módulos puros extraídos):
- ✅ `cutscene/model.ts` (tipos + iterator).
- ✅ `cutscene/scenes.ts` (ensureSceneConsistency + computeSceneView).
- ✅ `cutscene/inheritance.ts` (chain + lastKfWithInheritance + kfIsVisible) — con 16 tests críticos.
- ✅ `cutscene/keyframes.ts` (shift/warp/reassign/filter/assign).
- ✅ `cutscene/camera.ts` (interpCameraPose).
- ✅ `cutscene/walls.ts` (computeWallStateAt).
- ✅ `cutscene/schema.ts` + `cutscene/migrations.ts` (Fase 3).
- ✅ `editor/multi-sel.ts` + `editor/toolbar.ts` + `editor/playback.ts` (Fase 2 diferidos).
- ✅ `cutscene/runtime.ts` (POV early + FX eval extraídos en Fase 2 diferidos).

Post-migración Fase 4 (DSL):
- ✅ `cutscene/parser.ts` (markdown narrativo → AST).
- ✅ `cutscene/schema-ast.ts` (Zod schema del AST DSL).
- ✅ `cutscene/shots.ts` (shot types puros AST → CameraKf[]).
- ✅ `cutscene/camera-moves.ts` (dolly_in/pull_out, pan, push_in).
- ✅ `cutscene/actions.ts` (agent actions: camina_a, mira_a, dice, anima, espera).
- ✅ `cutscene/compiler.ts` (orquestador con simulación temporal).
- ✅ `scripts/cutscene-compile.ts` (CLI: `npm run cutscene-compile path/to/scene.md`).
- 43 tests Fase 4 cubriendo parser, shots, camera-moves, actions, compiler y e2e CLI.
- Pendientes nice-to-have: `[PENDING-TUNING-SHOTS]` (ajuste fino de poses por shot type), `[PENDING-FIXTURE-ZONES]` (resolver locations a fixture zones del mundo).

Pendientes (en orden de prioridad):
- 🔲 **DSL compiler** (alta prioridad — desbloquea autoría rápida).
- 🔲 **Editor lifecycle completo** (ceOpen/ceClose, runtime evaluation, persistence/undo, timeline rendering, gizmo wrapper, FX system, POV controls completos, toolbar UI completa, mouse handlers).
- 🔲 **Render MP4 vía WebCodecs** (horizonte 2).
- 🔲 **Transiciones entre planos** (modelo ya preparado: `scene.transitionIn = { type, duration }`).
- 🔲 **Audio tracks** (música + SFX sincronizados, horizonte 2).
- 🔲 **Copy/paste con multi-sel** (Cmd+C/V).
- 🔲 **Markers/notas** en el timeline.
- 🔲 **Round-trip DSL ↔ editor**.

---

## Para retomar

Si vas a tocar algo del editor:

1. **Lee el código del monolito** primero (`docs/reference/three-preview-monolith.html`). Busca la función relevante con grep.
2. **Antes de cambiar el modelo**, entiende las 6 decisiones de arriba. Romper una = romper todo.
3. **Si vas a tocar persistencia**: respeta los schemas Zod en `src/cutscene/schema.ts`. Cualquier campo nuevo requiere migración.
4. **El DSL es la siguiente prioridad**. Casi todo lo nuevo del editor debería pensarse en términos de "cómo se expresa en DSL".

Esto es la pieza más madura y compleja del proyecto. Cuídala.
