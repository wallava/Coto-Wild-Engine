<!-- ARCHIVO: ENGINE.md -->

# ENGINE.md — Coto Wild Engine (cwe)

## Por qué existe

Pablo construyó AGENTS.INC pero la intención **siempre fue** que el motor por debajo sirva para múltiples juegos. La construcción, el sistema de props, la cámara isométrica, los agentes, el editor de cutscenes — nada de eso es específico de AGENTS.INC. Son piezas genéricas de un motor isométrico de simulación.

A esto lo llamamos **Coto Wild Engine** (cwe), o solo "el engine". AGENTS.INC es **el primer juego** que se construye sobre cwe; habrá otros.

## La regla cardinal

**El engine no sabe nada del juego. El juego no sabe nada del editor.**

```
┌─────────────────────────────┐
│        editor (UI)          │   ← edita cutscenes
└──────────────┬──────────────┘
               │ emite cutscene serializada
               ▼
┌─────────────────────────────┐
│   cutscene-runtime          │   ← reproduce cutscene
└──────────────┬──────────────┘
               │ emite comandos al engine
               ▼
┌─────────────────────────────┐
│         game (AGENTS.INC)   │   ← simula el mundo
└──────────────┬──────────────┘
               │ usa engine para todo
               ▼
┌─────────────────────────────┐
│         engine (cwe)        │   ← Three.js + grid + walls + props + agents
└─────────────────────────────┘
```

Los flujos van **siempre hacia abajo**. Nunca al revés. Nunca shortcuts.

Si te encuentras escribiendo "if (cutsceneActive)" dentro de `engine/`, párate. Esa lógica va en otra capa.

---

## Qué incluye el engine

### 1. Motor 3D base
- Three.js (r128 hoy, posiblemente actualizable al migrar).
- Cámara ortográfica isométrica con gizmo 3D editable.
- Lentes simulados (24mm a 200mm) con FOV calculado a partir de focal length real.
- Modo perspectiva opcional (no solo orto).
- Lighting básico (ambient + direccional).
- Renderer con render loop y scene graph estándar.

### 2. Grid y mundo
- Grid de cells configurable (default 6×6, ampliable).
- Constante `CELL = 70` (unidades three).
- Coordenadas de grid: `(cx, cy)` donde `cx = este`, `cy = sur`.
- Conversión grid → three: `cx * CELL → world.x`, `cy * CELL → world.z`.
- Origen centrado: helpers aplican `-centerX/-centerZ` automáticamente.

### 3. Construcción (CRÍTICO — esto NO es del juego)
**Reconsideración importante de Pablo: las mecánicas de construcción son del engine, no del juego.** Pablo quiere reusar esto en otros juegos.

El sistema de construcción incluye:
- **Modos**: Jugar / Mover / Construir / Pintar.
- **Walls placement**: click en bordes de cells para colocar paredes norte/oeste.
- **Props placement**: paleta de muebles, click coloca el mueble en la cell.
- **Wall types**: paredes, ventanas, puertas (con animación de apertura).
- **Posts**: en corners (`hasN && hasW`) se renderiza poste.
- **Roof toggle**: techo global activable/desactivable.
- **Painting**: pintar paredes/pisos con colores.
- **Persistence**: estado del mundo se serializa a localStorage.

API limpia esperada (al separar del juego):

```ts
import { createWorld, placeWall, placeProp, removeProp, setMode } from 'cwe/build';

const world = createWorld({ width: 6, height: 6, cellSize: 70 });
placeWall(world, { cx: 2, cy: 3, side: 'N' });
placeProp(world, { cx: 1, cy: 1, type: 'desk', rotation: 0 });
setMode('build');
```

El juego (AGENTS.INC) consume este API; no implementa la lógica de construcción.

### 4. Sistema de props (también del engine)
- Catálogo de props (escritorios, sillas, plantas, máquinas, etc.).
- Cada prop es una entidad con: `id`, `type`, `cx`, `cy`, `rotation`, `meta`.
- Props ocultables (kfs de cutscene pueden ocultarlos).
- Props con animación opcional (puertas que se abren).

**Diseño**: el catálogo de props es **registrable** desde el juego. El engine provee la infraestructura, el juego registra los props específicos de AGENTS.INC. Otros juegos registrarán otros props sobre el mismo motor.

```ts
import { registerProp } from 'cwe/props';

registerProp('coffee_machine', {
  mesh: () => loadGLTF('coffee.glb'),
  bbox: { w: 1, h: 1 },
  category: 'kitchen',
  // ... metadata semántica que el juego puede usar
});
```

### 5. Agentes (chassis genérico)
El **chassis** del agente está en el engine: mesh con cabeza grande, cuerpo chico, animaciones de hopping/idle/turn, sistema de facing, slot para `heldItem`. Nada de necesidades, nada de comportamientos específicos.

```ts
import { spawnAgent, moveAgent, setAgentFacing } from 'cwe/agents';

const a = spawnAgent({ cx: 2, cy: 2, mesh: 'default' });
moveAgent(a, { cx: 3, cy: 2 });   // pathfinding del engine
setAgentFacing(a, 'east');
```

El **comportamiento** (necesidades, AI, encuentros sociales, working state) vive en `game/`. AGENTS.INC implementa eso. Otros juegos implementarán otros comportamientos sobre el mismo chassis.

### 6. FX system
- Catálogo de FX visuales (humo, partículas, glow, etc.).
- Spawn/despawn por entidad o por cell.
- Cada FX es una entidad con duración, target (cell/agente), kind.
- Reutilizable: cualquier juego puede registrar nuevos FX kinds.

### 7. Speech bubbles (audio + visual)
- Bubble visual sobre el agente.
- Panel inferior opcional con texto largo.
- 5 voice presets (TTS via Tone.js — ver si esto va en engine o en cutscene-runtime).
- API: `showSpeechBubble(agent, text, options)`.

**Nota**: el speech bubble es genérico. Cualquier juego con personajes que hablan puede usarlo.

### 8. Cámara cinemática
- Gizmo 3D para editar pose de cámara (drag de ejes en 3D).
- Controles WASD + QE (vertical) + RF (truck).
- Lentes 24-200mm con FOV calculado correctamente.
- Modo orto / perspectiva.
- Parent agent (cámara que sigue a un agente).

Esto vive en el engine porque cualquier juego con cinematics lo va a querer.

---

## Qué NO va en el engine

- Lógica de necesidades de los agentes (eso es del juego).
- Encuentros sociales / diálogos procedurales (juego).
- Working state mini-juego (juego).
- Spawn rules específicos de AGENTS.INC (juego).
- Catálogo concreto de props (juego registra; engine provee infraestructura).
- Estética visual específica (texturas, colores). El juego provee assets.
- El editor de cutscenes (está aparte; ver `CUTSCENES.md`).

---

## Convenciones de código del engine

- **Sin globals.** Todo se accede por instancia (`world.something()`, no `globalWorld`).
- **Sin singletons.** Múltiples mundos pueden coexistir (útil para tests, splitscreen futuro).
- **Funcional cuando se puede.** `placeWall(world, params)` mejor que `world.placeWall(params)` si no tiene sentido método de instancia.
- **Inmutabilidad relativa.** El estado del mundo es un objeto que muta, pero las operaciones devuelven nuevos refs cuando es barato.
- **Eventos.** El engine emite eventos (`onAgentMove`, `onWallPlaced`) que el juego puede escuchar para implementar reglas.

---

## Plan de extracción

El monolito actual mezcla todo. La separación es un trabajo de **extracción gradual**:

**Fase 1**: migrar el monolito a módulos TypeScript en una sola carpeta `src/`. Sin separar engine/game todavía. Solo organizar.

**Fase 2**: identificar funciones que claramente son del engine (todo lo que toca Three.js, grid, walls, props placement) y moverlas a `src/engine/`. Empezar a definir el API.

**Fase 3**: identificar funciones que son del juego (needs, working, social) y moverlas a `src/game/`. Asegurarse que `game/` solo importa de `engine/`, nunca al revés.

**Fase 4**: una vez estable, considerar mover `engine/` a un paquete separado (workspace o submódulo). Esto permite empezar otro juego sin copy-paste.

No hay apuro con Fase 4. La separación lógica es lo importante.

---

## Roadmap del engine

Pendientes específicos del motor (no del juego):

- **Performance**: dirty rebuild de paredes (hoy se reconstruye toda la geometría en cada cambio).
- **Performance**: parent/child stacks de meshes para reducir draw calls.
- **Performance**: pathfinding cacheado (hoy se recalcula cada frame en peor caso).
- **API estable de construcción**: documentar y testear el API público.
- **Catálogo registrable de props**: hoy los props están hardcodeados en el monolito.
- **Sistema de animation presets** abierto al registro.
- **Posibilidad de grids no cuadrados**: hoy es 6×6. Soportar formas irregulares (cocheras en L, etc.).

---

Cuando trabajes en algo, **pregúntate constantemente: ¿esto es engine o es juego?** Si es engine, va en `src/engine/`. Si es juego, va en `src/game/`. Si dudas, pregunta a Pablo. Esta línea es la cosa más importante de la arquitectura.
