# ROADMAP.md — Pendientes y futuro

Este archivo es la lista viva de lo que falta. Se actualiza con cada sesión.

## Convenciones

- 🔴 Bloqueante / urgente
- 🟠 Alta prioridad
- 🟡 Media
- 🟢 Baja / nice-to-have
- ✅ Hecho (mantener algunas como referencia histórica)

---

## 🔴 Migración del monolito

Sin esto, todo lo demás está en pausa.

- [x] **Fase 0**: setup Vite + TS + tooling
- [x] **Fase 1**: bulk del monolito a `legacy.ts` (con `@ts-nocheck`),
  imports CDN → ES modules pinneados.
- [ ] **Fase 2**: separar `engine/`, `game/`, `cutscene/`, `editor/` con
  APIs explícitos. **58 módulos extraídos hasta 2026-04-27** (~50%
  del legacy migrado, 6798 líneas restantes). Ver `ARCHITECTURE.md`
  para inventario.
- [ ] **Fase 3**: schemas Zod + migrations de datos persistidos.
- [ ] Verificar paridad con monolito (todo lo que andaba antes anda ahora).

### Sesión 2026-04-27 — extracciones cerradas

- ✅ agent-chassis (spawn + mesh + facing + sync)
- ✅ agent-drag (Tomodachi-style ghost + spring physics)
- ✅ agent-selection (highlight ring + raycast click)
- ✅ agent-status (ensure/clear + position update)
- ✅ agent-helpers (assignAgentTarget + setAgentMeshOpacity + nearest helpers)
- ✅ stations (handleAgentLanded + startWorkingState + pickRandomDestination + updateAgents)
- ✅ needs queries (getAgentMostCriticalNeed + findZoneForNeed + updateAgentNeeds)
- ✅ prop-drag (ghost wireframe + commit/cancel hooks)
- ✅ place-mode (catalog placement + door arrow)
- ✅ wall-build (Sims-style drag con axis-lock)
- ✅ camera-iso (theta/phi/dist/zoom/pan + updateCamera) — Codex Wave 1
- ✅ spawners (random prop + remove last + try agent) — Codex Wave 1
- ✅ paint-tool (state + tool runtime + flood fill) — Codex Wave 2
- ✅ zone-edit (start/stop + drag add/remove) — Codex Wave 3
- ✅ loadWorldData (geometry+props+zones — agents quedan en legacy hasta extraer applyWorld completo)

### Sesión 2026-04-27 (continuación) — cutscene chunk 1 (modelo puro)

- ✅ cutscene/model.ts (tipos + forEachCutsceneKf iterator)
- ✅ cutscene/scenes.ts (ensureSceneConsistency mutante + computeSceneView puro split)
- ✅ cutscene/inheritance.ts (chain + lastKfWithInheritance + kfIsVisible)
- ✅ cutscene/keyframes.ts (shift/warp/reassign/filter/assign)
- ✅ cutscene/camera.ts (interpCameraPose)
- ✅ cutscene/walls.ts (computeWallStateAt)

### Pendientes Fase 2 grandes

- **CUTSCENE EDITOR** — chunk 1 modelo puro hecho (6 archivos en
  `src/cutscene/`). **Pendiente sesión dedicada**:
  - Editor lifecycle (ceOpen/ceClose — CRITICAL: muta agents global)
  - Runtime evaluation (ceUpdate, partir por subsistema)
  - Persistence/undo (ceSnapshot, ceUndo, ceRedo, ceApplyCutsceneData)
  - Timeline rendering (DOM heavy)
  - Camera gizmo editor wrapper
  - FX system (singleton mutable)
  - POV controls
  - Toolbar UI
  - Multi-select + lasso
  - Drag/snap ops
  - ceInsertCutAt (cuando snapshot/render disponibles)
  - Mouse handlers globales
  - Plan detallado: `docs/CUTSCENE_EXTRACT_PLAN.md`
- **applyWorld + loadSlot + resetWorldToDefault** — cierre persistencia
  (loadWorldData ya extraído; falta agents restoration).
- **buildScene loop + corner posts + props render** — chunk medio del IIFE,
  ~300 líneas estructural.
- **Animate loop + boot** → `main.ts` orchestrator final.
- **Mouse handlers globales** — bloque grande en legacy, paint-tool y
  zone-edit ya leen state via getters (Codex review identificó como
  blocker para paralelizar más extracciones). Próxima sesión.
- **TECHO ROOF** (~480 líneas) — **NO EXTRAER NUNCA**. Tres intentos
  consecutivos (sesión 2026-04-26 y 2026-04-27) dispararon
  `ReferenceError: Cannot access 'ceState' before initialization` al
  cargar la página. La causa raíz nunca se identificó: el bloque ROOF
  no referencia ceState directamente, pero al moverlo (extraer Y/O
  pegar de vuelta de monolito) algo del init order rompe. Pablo
  decidió reescribir el sistema de roof desde cero cuando llegue. Hasta
  entonces, dejarlo donde está en `legacy.ts` intacto.
- **Door animation** — eliminada por bug pre-existente, Pablo reescribirá.

### Debt arquitectónico identificado (Codex review 2026-04-27)

- `src/engine/agent-texture.ts` importa `../game/agent-kits` — viola
  layering "engine no importa game". Pre-existente, fuera de scope de
  Fase 2 actual. Corregir en sesión de cleanup.

Ver detalle en `ARCHITECTURE.md`.

---

## 🟠 DSL de cutscenes (post-migración)

La feature más importante una vez separado el código. Desbloquea el flujo "Pablo describe escena en lenguaje natural → Claude genera DSL → editor muestra kfs editables".

- [ ] Parser de markdown narrativo a AST.
- [ ] Schema del AST (tipos TypeScript).
- [ ] Compiler AST → cutscene model.
  - [ ] Resolver agentes y locations a IDs/cells.
  - [ ] Calcular poses de cámara desde shot types.
  - [ ] Compilar acciones a kfs (move, speak, animation).
  - [ ] Simulación temporal para resolver "camina_a X" en función del estado del mundo en t.
- [ ] **Shot types** mínimos:
  - [ ] `wide_establishing`
  - [ ] `medium_shot`
  - [ ] `close_up`
  - [ ] `two_shot`
  - [ ] `over_the_shoulder`
  - [ ] `top_down`
  - [ ] `tracking`
- [ ] **Camera moves**:
  - [ ] `dolly_in` / `pull_out`
  - [ ] `pan`
  - [ ] `push_in`
- [ ] **Agent actions**:
  - [ ] `camina_a` (cell o agente)
  - [ ] `mira_a`
  - [ ] `dice "..."`
  - [ ] `anima <preset>`
  - [ ] `toma <prop>`
  - [ ] `espera <Ns>`
- [ ] Validación con errores legibles (referencia inexistente, agente inalcanzable, etc.).
- [ ] CLI: `npm run cutscene-compile path/to/scene.md`.
- [ ] Round-trip básico: editar en editor → marca DSL como desactualizado.

Ver detalle en `CUTSCENES.md` sección "DSL".

---

## 🟠 Cierre del editor de cutscenes

- [ ] **Render MP4 vía WebCodecs** — exportar la cutscene como video. Cierre lógico del módulo.
- [ ] **Transiciones entre planos** — modelo ya preparado (`scene.transitionIn = { type, duration }`). Tipos: cut (default), fade, dissolve, wipe.
- [ ] **Audio tracks** — música + SFX sincronizados con kfs. Probablemente un nuevo tipo de track.
- [ ] **Copy/paste con multi-sel** — Cmd+C / Cmd+V para mover kfs y planos entre puntos del timeline.
- [ ] **Markers/notas** — anotaciones en el timeline (no afectan la reproducción).

---

## 🟠 Mecánicas de gameplay (AGENTS.INC)

Lo que falta para que el juego sea jugable más allá del editor.

- [ ] **B.9 Encuentros sociales** — agentes adyacentes hablan automáticamente. Templates de diálogo procedural.
- [ ] **B.11 Mini-juego del working state** — reemplazar los 8s estáticos con cámara zoom + tap-fest. Microtarea ridícula (escribir email, validar PR, asistir standup).
- [ ] **B.8 HeldItem dinámico** — slot existe en el agente, falta wire visual + pickup/drop. Ejemplo: agente toma café de la cocina, lleva taza visible, llega a su escritorio, deposita.
- [ ] **D.13 Construcción mediada por agentes** — muebles "en obra" mientras un agente los arma. Tarda tiempo, no aparecen instantáneos.

---

## 🟡 Engine improvements

Todo lo que es performance o feature del engine, no del juego.

- [ ] **Dirty rebuild de paredes** — hoy se reconstruye toda la geometría de paredes en cada cambio. Debería rebuildear solo las cells afectadas.
- [ ] **Parent/child stacks de meshes** — reducir draw calls agrupando meshes estáticas.
- [ ] **Pathfinding cacheado** — hoy se recalcula. Cachear resultados por (start, end) hasta que cambie el grid.
- [ ] **Catálogo registrable de props** — hoy los props están hardcodeados. Sistema de registro para permitir que cada juego registre los suyos.
- [ ] **Animation presets registrables** — idem.
- [ ] **Grids no cuadrados** — hoy es 6×6 fijo. Soportar formas en L, T, etc.
- [ ] **Estética del techo** — Pablo dijo "lo resolveremos luego". Toggle visual + transparencia + lighting.

---

## 🟡 UX y polish

- [ ] Reorganización de planos por swap (no solo drag y push).
- [ ] Onboarding tutorial.
- [ ] Tooltips contextuales (las primeras veces que el usuario hace algo nuevo).
- [ ] Settings panel (volumen, calidad, idioma).
- [ ] Pause menu.
- [ ] Save slots múltiples (no solo localStorage genérico).

---

## 🟡 Test infrastructure

Cuando el código esté separado, agregar tests.

- [ ] Setup Vitest.
- [ ] Tests unitarios para `cutscene/inheritance.ts` (la lógica más sensible).
- [ ] Tests para `cutscene/compiler.ts` con DSL → cutscene fixtures.
- [ ] Tests para `engine/coords.ts` (conversión grid ↔ three).
- [ ] Tests para `engine/walls.ts` (placement, removal, corner detection).
- [ ] Tests E2E con Playwright (flujos críticos del editor).

---

## 🟢 Stretch: motor reusable como producto

Una vez que el engine esté limpio y separado:

- [ ] Documentar API público.
- [ ] Crear segundo juego como prueba ("Coto: agente número 2").
- [ ] Considerar empaquetar como package npm.
- [ ] Considerar versión standalone con Tauri (desktop app).
- [ ] Posible producto independiente: editor de cutscenes como herramienta para devs de otros juegos iso.

---

## ✅ Hecho (referencia histórica)

Versiones del monolito que llegaron a producción mental:

- ✅ v1.0-1.10: motor base (cámara, grid, walls, props, agents, animaciones).
- ✅ v1.11-1.15: necesidades, working state estático, persistencia.
- ✅ v1.16: speech bubbles unificados con audio Tone.js + 5 voice presets.
- ✅ v1.17-1.20: cutscene editor base (tracks, kfs, cámara cinemática, FX).
- ✅ v1.21-1.30: cuts, save/load, fade, POV UX, walls/techo/muebles ocultables.
- ✅ v1.31-1.34: cámara overhaul (gizmo 3D, lentes 24-200mm, perspective real, timeline video-style).
- ✅ v1.35-1.36: planos como entidades del modelo, cuts entre planos como islas temporales.
- ✅ v1.37-1.38: push behavior, snap+clamp, undo/redo (Cmd+Z).
- ✅ v1.39-1.40: sceneId estable por kf.
- ✅ v1.41: escenas + planos con continuidad narrativa (`inheritState`).
- ✅ v1.42: tijera preserva movimiento, drag no destructivo, Esc cancela.
- ✅ v1.43: `escenaRootId` para identidad estable de escenas.
- ✅ v1.44: Alt+drag duplica plano y kf individual.
- ✅ v1.45: lasso (Shift+drag), group drag, group clone.
- ✅ v1.45.1: fix lasso (todos los kfs), group drag con refs, shift+click toggle.

---

## Decisiones pendientes (preguntar a Pablo)

Cosas donde no hay decisión tomada y conviene resolverlas antes de codear:

- Versión de Three.js al migrar (r128 actual o última estable).
- Nombre del package del engine (cwe, coto-engine, otro).
- Formato exacto del DSL (markdown narrativo vs YAML estructurado).
- Estrategia de persistencia post-migración (mantener localStorage o agregar export/import a archivo).
- Estructura final de assets (texturas, sonidos): ¿cómo se organizan, cómo se cargan?
- ¿El render MP4 va antes o después del DSL? (Mi voto: DSL primero porque desbloquea autoría.)

---

Este archivo se actualiza con cada sesión. Antes de empezar a trabajar, léelo y verifica que la prioridad sigue siendo lo que está marcado 🔴.
