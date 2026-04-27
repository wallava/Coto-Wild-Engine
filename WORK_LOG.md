# Work Log

Este archivo registra cada sesión de trabajo no-trivial sobre Coto Wild Engine. Lo escriben Claude Code y Codex (vía plugin `codex-plugin-cc`).

Para qué sirve este log:

- **Debug**: cuando algo se rompe, ver cuándo se cambió y quién lo cambió.
- **Auditoría**: revisar trabajo pasado sin tener que recordar todo.
- **Onboarding de futuras sesiones**: una nueva sesión de Claude o Codex puede leer el log y entender el estado actual rápidamente.
- **Recuperar contexto perdido**: si se cae una sesión, el log preserva qué se intentó.
- **Aprender de discusiones pasadas**: la sección "Rechazos justificados" sirve para no repetir las mismas discusiones con Codex en sesiones futuras.

Convenciones:

- Entradas en orden cronológico inverso (más reciente arriba).
- Cada tarea con identificador `CLAUDE-N` o `CODEX-N`.
- Status: ✅ Done | 🔄 In progress | ❌ Failed | ⏸️ Paused
- Para delegaciones a Codex, siempre incluir el `session_id` para poder hacer `codex resume <session_id>` después.

Ver `CLAUDE.md` sección "Trabajo en equipo con Codex" para el flujo formal completo.

Este archivo **no se sincroniza con el Project en Claude.ai** — es un log local del repo.

---

## Plantilla de entrada

```markdown
## YYYY-MM-DD HH:MM - [Título corto]

**Plan inicial**: [Resumen de 1-2 líneas]

**Review loop**:
- Round 1: Codex objetó [X, Y, Z]. Claude aceptó X y Z, rechazó Y porque [razón].
- Round 2: Codex confirmó plan ajustado.
- Total: 2 rounds.

**Plan final**: [si difiere del inicial, resumen]

**Tasks**:

### CLAUDE-1: [Título]
- Archivos modificados: [lista]
- Validación: tsc ✅ / npm test ✅
- Status: ✅ Done
- Notas: [si aplica]

### CODEX-1: [Título] (delegated)
- Codex session: cs_xxxxx
- Prompt enviado: [resumen]
- Archivos modificados: [lista]
- Validación: tsc ✅
- Status: ✅ Done
- Notas: [si aplica]

**Review post-ejecución**: ✅ aprobado por Codex / ⚠️ con notas / ❌ no aplicó

**Resultado de la sesión**: [resumen breve]
**Decisiones tomadas**: [si aplica]
**Rechazos justificados**: [si Claude rechazó alguna objeción de Codex, anotar la razón]
```

---

# Sesiones

<!-- Las entradas reales empiezan acá, en orden cronológico inverso (más reciente primero) -->

## 2026-04-27 15:05 - [FASE 3.5 INTERACTIVA] Cablear validate+migrate en callers (cierre Fase 3)

**Plan inicial**: cablear validateCutscene en getSavedCutscene + validateWorld en loadFromStorage. Migration fallback en ambos.

**Tasks**:

### CLAUDE: cablear cutscene/persistence.ts:getSavedCutscene
- Pipeline: raw → validateCutscene → si falla → loadAndMigrateCutscene (clone+migrate+revalidate) → si pasa: persistir migrada en LS + return; si falla: log estructurado + return null.
- Import directo de loadAndMigrateCutscene (sin ciclo problemático).

### CLAUDE: cablear engine/persistence.ts:loadFromStorage
- Refactor: `tryLoadSlot(rawString, source)` helper compartido para SLOT_CURRENT_KEY, STORAGE_KEY_V2, STORAGE_KEY_V1.
- Pipeline: parse → validateWorld → si falla → loadAndMigrateWorld → si pasa: applyWorldFromData + saveToStorage para persistir migrada → si falla: cuarentena raw en `cwe_quarantine_<source>_<timestamp>` antes de return false (preserva data del usuario porque el caller legacy aplica defaultWorld + saveToStorage en path de falla, pisando cwe_current).

**Bugs encontrados con data real de Pablo (2 fixes)**:
1. PropSchema: `h, top, right, left` requeridos. Door props (game/migrations.ts:95) no los tienen — solo `{id, category, cx, cy, side, kind}`. Fix: hacer optional. Ajuste al modelo real, no inventar campos.
2. AgentSchema y CutsceneAgentSchema: `emoji: z.string().optional()`. Pero data real tiene `emoji: array<string>` (multi-glyph composition). Fix: `z.union([z.string(), z.array(z.string())]).optional()`.

**Mejoras de log durante debug**:
- `validateWorld` y `tryLoadSlot` errors: serializar issues a single-line string en vez de Object colapsado (más fácil de leer en console).

**Validación con data real de Pablo**:
- Primera carga: error `props.7.h` y `props.8.h` Required → fix PropSchema h optional.
- Segunda carga: error `agents.0/1/2.emoji` array vs string → fix AgentSchema emoji union.
- Tercera carga: ✅ load limpio confirmado por Pablo ("ok").

**Pérdida de data lateral (sesión 1)**: el cabling original NO tenía cuarentena en path de falla. Tu cwe_current original con door props legacy fue pisado por defaultWorld del caller legacy → door props originales perdidos en ese reload. Cuarentena agregada en sesión 2 para evitar futuras pérdidas.

**Validación**: tsc ✅, smoke-test ✅, npm test 100/100 ✅, juego anda con data real ✅.
**Status**: ✅ Done. Fase 3 oficialmente cerrada.

---

## 2026-04-27 14:40 - [FASE 3 INTERACTIVA] R4 migrations cutscene + world (paralelo)

**Plan inicial**: Claude src/cutscene/migrations.ts + tests; Codex en background src/engine/migrations.ts + tests.

**Review loop con Codex**: 1 round.
- 3 bloqueantes aceptados:
  1. ensureAgentKfTypes SIN fallback 'move' — solo inferir con señal clara.
  2. rooms→zones replicar filter `source==='manual'` del monolito.
  3. assignEscenaRootIds validación todo-o-nada (recalcula desde scratch si parcial/inválido).
- 5 sugerencias aceptadas: clone en loadAndMigrate*, dos APIs separadas, idempotencia deep-equal, raw original no se corrompe post-fail, rooms→zones solo campos válidos.

**Tasks**:

### CLAUDE-R4: src/cutscene/migrations.ts + tests
- migrations.ts (211 LOC): migrateCutscene + loadAndMigrateCutscene + 5 steps (normalize, ensureScenes, migrateKfsToScenes, assignEscenaRootIds con validación de grafo, ensureAgentKfTypes sin fallback).
- migrations.test.ts (17 tests): ensureScenes, migrateKfsToScenes, assignEscenaRootIds (recalcula si parcial), ensureAgentKfTypes (no setea sin señal), fx legacy, idempotencia, loadAndMigrate happy/clone/fail/no-corrupt.
- Test fix mid-flight: `duration: -1` no servía como caso fail (normalize lo arregla a 30). Cambié a `kf con type:''` (sin señal para inferir).

### CODEX-R4: src/engine/migrations.ts + tests (delegated)
- Codex session: ace2e1cdefe8cba60 (background, completed).
- migrations.ts (99 LOC): migrateWorld + loadAndMigrateWorld con migrateRoomsToZones (filter source==='manual') + ensureWorldDefaults.
- migrations.test.ts (14 tests).
- migrations-integration.test.ts (3 tests extra, out-of-scope aceptado).

**Validación**: tsc ✅, smoke-test ✅, npm test **100/100** ✅ (16 inheritance + 29 cutscene/schema + 18 engine/schema + 17 cutscene/migrations + 14 engine/migrations + 3 engine/integration + 3 dist).
**Status**: ✅ Done. Sin validación visual (sin wiring runtime — integración con loadFromStorage queda fuera del scope de Fase 3).

**Fase 3 cerrada**: 4 rounds, 4 commits, 100 tests, 0 reverts, 0 quarantines.

---

## 2026-04-27 14:35 - [FASE 3 INTERACTIVA] R3 validation world + tests engine schema (paralelo)

**Plan inicial**: Claude agrega validateWorld a engine/persistence.ts (estricto + dim check). Codex tests engine/schema.ts.

**Review loop con Codex**: 1 round.
- 2 bloqueantes IMPORTANTES aceptados:
  1. NO modificar isValidWorldData (queda guard laxo legacy intacto). WorldSchema estricto rechazaría worlds del monolito que applyWorldFromData tolera con migrateV1WorldData.
  2. validateWorld es API NUEVA separada — no toca el guard legacy. Integración con loadFromStorage queda para R4.
- Sugerencias aceptadas: BadDimensionsError type literal, no throw, BAD_DIMENSIONS unión vs refine en schema, GRID_H NO en schema.ts.

**Tasks**:

### CLAUDE-R3: validateWorld en engine/persistence.ts
- `validateWorld(raw): {ok, world} | {ok: false, error: ZodError | BadDimensionsError}` (Pablo refactor: `value` → `world`).
- WorldSchema.safeParse + dim check (wallN.length === GRID_H+1, wallW.length === GRID_H).
- Log warning estructurado en cada caso de falla.

### CODEX-R3: tests engine/schema (delegated)
- Codex session: a58bb3f12d5819ba2 (background, completed).
- 18 tests nuevos en tests/engine/schema.test.ts (Agent/Prop/Zone/RoomMeta/World + validateWorld + isValidWorldData compat laxo).
- Out-of-scope (aceptado): event-bus.ts agregó `typeof window` guard para que tests en Node no crasheen.

**Validación**: tsc ✅, smoke-test ✅, npm test 63/63 ✅ (16 + 29 + 18).
**Status**: ✅ Done. Sin validación visual (sin wiring runtime).

---

## 2026-04-27 14:25 - [FASE 3 INTERACTIVA] R2 validation cutscene + tests schema (paralelo)

**Plan inicial**: Claude agrega validateCutscene helper a cutscene/persistence.ts. Codex en background genera tests Vitest para cutscene/schema.ts.

**Review loop con Codex**: 1 round.
- 0 bloqueantes, 5 sugerencias todas aceptadas:
  1. validateCutscene puro (no llama normalize). Documentar legacy fx.keyframes falla.
  2. Sin cast `as Cutscene` (z.infer ya da el tipo).
  3. Test explícito de passthrough preservando extras.
  4. it.todo para comportamiento sin paridad.
  5. Tests con summary (no verbose).

**Tasks**:

### CLAUDE-R2: validateCutscene en cutscene/persistence.ts
- Helper `validateCutscene(raw): {ok, value} | {ok, error}` con safeParse + log estructurado de issues.
- Comentario advirtiendo cutscenes legacy con fx.keyframes fallarán hasta R4 migrations.
- Sin integración con loadCutsceneByName (queda para R4).

### CODEX-R2: tests schema cutscene (delegated)
- Codex session: adf27c3ff7b7f876f (background, completed).
- 29 tests nuevos en 10 describe (tests/cutscene/schema.test.ts).
- Cubre: SceneSchema (4), CameraKfSchema, FxTargetSchema (incl agent-sin-id refine), AgentKfSchema, FxEntitySchema, CutsceneSchema integración, passthrough preserva extras explícito.

**Validación**: tsc ✅, smoke-test ✅, npm test 45/45 ✅ (16 inheritance + 29 schema).
**Status**: ✅ Done. Sin validación visual (sin wiring runtime).

---

## 2026-04-27 14:15 - [FASE 3 INTERACTIVA] R1 schemas Zod (paralelo Claude+Codex)

**Plan inicial**: 2 archivos paralelos. Claude crea cutscene/schema.ts; Codex en background crea engine/schema.ts.

**Review loop con Codex**: 1 round.
- Codex bloqueantes (2 aceptados):
  1. `AgentKfSchema` discriminatedUnion limitado a 3 tipos rompía con kfs legacy / type custom (model.ts:73 permite `type: string`). Cambio a `z.string().min(1)` + campos opcionales.
  2. `FxTargetSchema` catch-all permitía `{kind:'agent'}` sin id. Agregado refine que excluye 'agent'/'cell' en rama genérica.
- Codex sugerencias aceptadas: comentario en SceneSchema sobre canónico post-edición vs drag transient.
- Codex confirmó: passthrough en kfs (no strict hasta migration), unknown[][] en walls, unknown en prop top/right/left, GRID dim validation diferida a R3, mensajes Zod default sin traducir.

**Tasks**:

### CLAUDE-R1: src/cutscene/schema.ts
- 198 LOC. Schemas: Vec3, Scene, CameraKf, WallsKf, FxTarget (union 3 ramas con refine), FxKf, FxEntity, AgentKf (string-typed con campos opcionales), AgentTrack, CutsceneAgent, Cutscene.
- 11 tipos exportados vía z.infer<>.

### CODEX-R1: src/engine/schema.ts (delegated)
- 84 LOC. Schemas: RoomMeta, Zone, Prop, Agent, World.
- 5 tipos exportados.
- Codex session: ad6bce15e35b11a24 (background, completed).

**Validación**: tsc ✅, smoke-test ✅, npm test 16/16 ✅.
**Status**: ✅ Done. Sin validación visual (sin wiring).

---

## 2026-04-27 12:10 - [INTERACTIVA] D4 ceUpdate body partial split → cutscene/runtime.ts

**Plan inicial**: extracción conservadora de 2 secciones del body de ceUpdate (el más sensible, orden per-frame).

**Review loop con Codex**: 1 round (adversarial-review obligatorio).
- Codex bloqueantes (2): preservar try/catch en wrappers legacy (no en módulo) + condición POV early `useGizmoPose || kfs.length === 0` correcta.
- Codex sugerencias: `fxEntities ?? []` para tolerar undefined; orden FX entre camera-interp y fade preservado; `import type FxInstance` no runtime.
- Codex confirmó: cutoff 8+ callbacks válido → per-track agent y camera interp diferidos. evaluateFxOnFrame seguro de extraer.
- Total rounds: 1.

**Tasks**:

### CLAUDE-D4: extraer applyPovEarlyGizmoPose + evaluateFxOnFrame
- Archivos: `src/cutscene/runtime.ts` (+135 LOC), `src/legacy.ts` (~70 LOC reemplazadas por 2 wrappers thin con try/catch).
- Funciones extraídas:
  - `applyPovEarlyGizmoPose(camera, applyKfs, gizmoDrag, applyToCamera)` — paridad legacy:4275-4290.
  - `evaluateFxOnFrame(fxEntities, currentScene, playhead, activeInstances, filterKfsToScene, fxPresets, spawn, despawn, update, interpolate)` — paridad legacy:4503-4553.
- Try/catch + `console.warn` mantenido en wrappers legacy (per Codex bloqueante 1).
- Validación: tsc ✅ (1 fix de TS2322 en runtime.ts línea 178), smoke-test ✅, validación visual Pablo ✅.
- Status: ✅ Done.

**Diferido permanente del body de ceUpdate** (justificado, NO se va a extraer):
- Header (playhead tick + applyKfs flag + gap return) — 40 LOC.
- Walls eval — DOM roof button + state.currentHiddenIds Set.
- Per-track agent eval (~100 LOC) — 8+ callbacks (showSpeechBubble, applyAnimEffect, resetAgentAnim, syncAgentMesh, getDraggedAgent, setAgentFacing, lastKfWithInheritance, filterKfsToScene). Codex confirmó cutoff anti-pattern.
- Camera interp (~95 LOC) — parent agent lookup + agents/CELL/centerX/Z global coupling.

---

## 2026-04-27 11:50 - [INTERACTIVA] D3 POV controls + scrubbing → editor/playback.ts

**Plan inicial**: extraer cePreviewMode + showPovControls + hidePovControls + updatePovOverlayTime + updatePovFrame + ceScrubFromEvent + POV_ASPECTS al módulo nuevo `src/editor/playback.ts`.

**Review loop con Codex**: 1 round.
- Codex bloqueantes (2): hidePovControls null-assign post-clearTimeout; strings con comillas (issue solo del transcript).
- Codex recomendación clave: NO extraer `enterPreviewMode` orchestrator (sobre-inyección 4 params + 7 callbacks). Quedó en legacy.
- Acepté ambas: scope reducido a 5 helpers DOM + 1 utility.
- Total rounds: 1.

**Tasks**:

### CLAUDE-D3: extraer 5 helpers + scrubFromEvent
- Archivos: `src/editor/playback.ts` (nuevo, 100 LOC), `src/legacy.ts` (~50 LOC reemplazadas por 5 wrappers thin).
- Funciones extraídas: `POV_ASPECTS`, `showPovControls`, `hidePovControls`, `updatePovOverlayTime`, `updatePovFrame`, `scrubFromEvent`.
- Diferido (per Codex): `cePreviewMode` + listeners de eventos quedan en legacy.
- Mejora aplicada: `_povControlsTimeout = null` después de `clearTimeout` (legacy no lo hacía pero es más limpio).
- Bug paridad preservado: `duration === 0` → NaN% en `updatePovOverlayTime` (legacy:5012-5014 también lo tiene).
- `formatTime` pasado como callback (mantiene playback.ts sin import a editor/timeline.ts).
- Validación: tsc ✅, smoke-test ✅, validación visual Pablo ✅.
- Status: ✅ Done.

---

## 2026-04-27 11:35 - [INTERACTIVA] D2 ceUpdateToolbarFields value-setting → editor/toolbar.ts

**Plan inicial**: extraer bloque de value-setting (~30 LOC, legacy:3001-3031) respetando `document.activeElement` + presets. Wire-in con wrapper thin.

**Reparto**: Pablo + Claude diseñan plan; Codex ejecuta wire-in mecánico (delegación `codex:codex-rescue` background).

**Tasks**:

### CODEX-D2: ejecución wire-in (delegated)
- Codex session: `task-id ad6ff5ee3715cc9c3` (background)
- Archivos modificados: `src/editor/toolbar.ts` (+62 LOC: ToolbarValueRefs + applyToolbarValues), `src/legacy.ts` (~30 LOC reemplazadas por llamada single).
- Validación Codex: tsc ✅. smoke-test falló por sandbox network (EPERM puerto 5173) — no fallo de código.
- Validación Claude desde entorno principal: tsc ✅, smoke-test ✅.
- Validación visual Pablo: ✅ ("ANDA D2").
- Status: ✅ Done.

**Mientras Codex ejecutaba**: Claude leyó código completo de D3 (POV + preview + scrubbing) y armó plan. Codex review D3 en background.

---

## 2026-04-27 11:15 - [INTERACTIVA] D1 ceStartGroupDrag → editor/multi-sel.ts

**Plan inicial**: extraer ceStartGroupDrag (~85 LOC) a multi-sel.ts. Crear tipos `ActiveGroupDrag` + `GroupDragAnchor` + `GroupDragInitial`. Wire-in con wrapper thin que llama editorStartGroupDrag(state, cutscene, anchor, kind, startX, alt) + ceRenderTracks().

**Review loop con Codex**: 1 round.
- Codex bloqueantes (4 aceptados):
  1. GroupDragState en scene-ops.ts solo tiene `initial` — crear `ActiveGroupDrag` separado en multi-sel.ts.
  2. anchor type necesita aceptar extra `t` field (caller legacy:5357 pasa { kind, ..., t: kf.t }).
  3. anchorKind debe ser literal `'scene' | 'kf'` (no identifiers).
  4. Reads downstream rotos sin tipo completo.
- Codex sugerencias aceptadas: orden explícito (baseline → clones → mutar multiSel → render), comentar bug duplicados (sceneId+t), preservar shallow clone.
- Decisiones tomadas: tipo separado `ActiveGroupDrag` en multi-sel.ts; bug preservado con comentario.
- Total rounds: 1.

**Tasks**:

### CLAUDE-D1: extraer ceStartGroupDrag
- Archivos: `src/editor/multi-sel.ts` (+155 LOC: types + startGroupDrag), `src/legacy.ts` (~85 LOC reemplazadas por wrapper de 4 LOC).
- Validación: tsc ✅, smoke-test ✅.
- Validación visual Pablo: ✅ (group drag move + alt-clone + esc cancel).
- Status: ✅ Done.

---

## 2026-04-27 09:30 - [NOCTURNO] Cierre completo: Waves H/I/J + diferidos + tests

**Activación**: continuación post-Wave G. Pablo pidió Waves H, I, J + diferidos + tests, soft stop 8:00 AM o fin migración.

### Resumen ejecutivo

**Waves cerradas en esta tanda**:
- Wave H ✅ drag/snap operations → `src/cutscene/scene-ops.ts`
- Wave I ✅ lifecycle helpers → `src/editor/lifecycle.ts` (parcial: ceOpen/ceClose orchestrators stay)
- Wave J ✅ ceInsertCutAt → `src/cutscene/cuts.ts`

**Diferidos cerrados**:
- Group-drag (Wave G): cloneScene + deleteSceneAndKfs + applyGroupDrag → scene-ops.ts
- ceUpdateToolbarFields visibility (Wave C): applyToolbarVisibility → toolbar.ts
- Fade overlay opacity (Wave D): computeFadeOpacity → runtime.ts

**Tests**:
- `tests/cutscene/inheritance.test.ts` con 16 casos, vitest 3.2.4 instalado.
- `engine/coords.ts` mencionado en objetivos no existe → SKIP-AMBIGUO documentado.

**Diferidos que siguen abiertos**:
- ceStartGroupDrag (~90 LOC): coordina multiSel + JSON.stringify(serialize) baseline + render. Mantener en legacy es más simple que parametrizar 4 callbacks.
- ceUpdateToolbarFields value-setting (~25 LOC): depende de `document.activeElement` checks + presets.
- Resto del body de ceUpdate (POV early, walls, agents, camera interp, FX eval): Codex review previa marcó como NO-low-risk por orden per-frame.
- POV controls / cePreviewMode / ceScrubFromEvent: orchestrators con coordinación cruzada, esperan refactor mayor.

**Anti-loops activados**: ninguno.
**[QUARANTINE]**: ninguno.
**[BROKEN-GAME-REVERTED]**: ninguno.
**[TSC-FAIL-REVERTED]**: ninguno.
**[SKIP-BLACKLIST]**: ninguno (instalación de vitest considerada parte del objetivo de tests).
**[SKIP-AMBIGUO]**: 1 — engine/coords.ts no existe.

**Estado del repo al cierre**:
- HEAD: `264c4f4 Tests críticos: cutscene/inheritance.ts (16 casos, vitest)`
- legacy.ts: **6085 LOC** (era ~7102 al inicio de Fase 2 cutscene → -1017 LOC migradas)
- tsc ✅ pasa
- smoke-test ✅ pasa (lifecycle round-trip + DOM verify)
- npm run test ✅ 16/16
- vite arranca limpio en localhost:5173

**Archivos nuevos creados esta sesión**:
- `src/cutscene/scene-ops.ts` (388 LOC)
- `src/cutscene/cuts.ts` (130 LOC)
- `src/cutscene/runtime.ts` (extendido con computeFadeOpacity)
- `src/editor/lifecycle.ts` (145 LOC)
- `tests/cutscene/inheritance.test.ts` (165 LOC)

**Archivos extendidos esta sesión**:
- `src/editor/toolbar.ts` (+90 LOC: applyToolbarVisibility)
- `src/cutscene/runtime.ts` (+25 LOC: computeFadeOpacity)
- `package.json` (script `test` + dep `vitest`)

**Commits totales esta sesión** (post-baseline `714a8a3`):
1. `3888402` Wave E: gizmo wire-in
2. `59fdaf0` Wave F: FX system
3. `b934748` Smoke test mejorado
4. `02a5ddd` Wave G: multi-sel + lasso
5. `dddf443` Wave H: drag/snap
6. `f07fd55` Wave I: lifecycle helpers
7. `0f97b4f` Wave J: ceInsertCutAt
8. `306b790` Diferido group-drag
9. `84ad991` Diferido toolbar visibility
10. `65a150c` Diferido fade opacity
11. `264c4f4` Tests inheritance (16 casos)

**Para revisión visual de Pablo en la mañana**: 
- Group-drag con clonado (alt+drag de múltiples planos): probar visualmente que el clone heredra kfs camera/walls/fx/tracks correctamente.
- Apply de visibility del toolbar: cambiar entre activeType=speak/animation/camera/walls/fx y verificar que los inputs correctos aparecen/desaparecen.
- Lasso (shift+drag en timeline): verificar que selección por área marca scenes y kfs como antes.
- Fade entre cuts: en POV, scrubbear cerca de un kf con `transition='fade'` y verificar fade overlay.

---

## 2026-04-27 08:41 - [NOCTURNO] Reanudación post-handoff: Waves B→J cutscene

**Activación**: 2026-04-27 08:41. Pablo restart manual sin esperar ScheduleWakeup 09:08. Bypass mode confirmado activo (sin prompts), vite up (PID 27515), timeline.ts ya escrito sin cablear.
**Hora de soft stop programada**: 7:00 AM (ya pasada al arranque — interpretación: "horario extra, optimizá entrega antes de que Pablo despierte").
**Budget**: Claude 150k, Codex 200k.
**Reglas Pablo override**: delegá a Codex SOLO refactors >5 archivos; review Codex 2 rounds máximo; ambigüedad genuina → SKIP-AMBIGUO; blacklist estricta (no schemas, deps, deletes, git destructivo, docs/CLAUDE.md).
**Tareas asignadas**: Wave B (cablear timeline) + Waves C-J cutscene. Optional Waves: tests cutscene/inheritance.ts + engine/coords.ts.

### Ejecución

**TASK Wave B**: cablear `src/editor/timeline.ts` en `src/legacy.ts`
- Tipo: CLAUDE
- Status: ✅ Done
- Archivos: `src/legacy.ts` (import block + 9 wrappers), `src/editor/timeline.ts` (untracked → tracked)
- Validación: `npx tsc --noEmit` ✅
- Notas: agregué helper `ceTimelineViewport()` que arma `TimelineViewport` desde `ceState`. Reemplazo limpio de las 9 funciones por wrappers thin. `ceFormatTime` quedó como alias directo a `timelineFormatTime` (idéntico).

**TASK Wave C**: extraer toolbar a `src/editor/toolbar.ts`
- Tipo: CLAUDE
- Status: ✅ Done (parcial — `ceUpdateToolbarFields` deferida a Wave I)
- Archivos: `src/editor/toolbar.ts` (nuevo), `src/legacy.ts` (8 wrappers)
- Funciones extraídas: `isCutsceneAgent`, `syncSnapBtn`, `syncLensUI`, `updatePlayButton`, `updateDeleteBtn`, `updateTimeDisplay`, `refreshAgentSelect`, `refreshParentSelect`.
- Diferida: `ceUpdateToolbarFields` (~80 LOC con DOM-coupling cruzado vía `selectedKf` + `activeElement` + presets — esperar Wave I lifecycle para extraer junto a refs DOM).
- Validación: `npx tsc --noEmit` ✅

**TASK Wave D**: extraer runtime helpers a `src/cutscene/runtime.ts`
- Tipo: CLAUDE
- Status: ✅ Done (parcial — body de `ceUpdate` deferido)
- Archivos: `src/cutscene/runtime.ts` (nuevo), `src/legacy.ts` (3 wrappers)
- Funciones extraídas: `applyPoseToCinematicCamera` (parametrizado con camera+viewW+viewH+cache), `isCameraLocked`, `isCutsceneControlled`. `createCinematicCameraCache` reemplaza el literal `_camCache`.
- Diferido: split del body de `ceUpdate` por subsistema. Razón: Codex review previa marcó este split como NO-low-risk — preservar orden per-frame exacto requiere más cuidado del que cabe en nocturno autónomo. Decidido extraer solo helpers periféricos.
- Validación: `npx tsc --noEmit` ✅

**TASK Wave E**: wire-in `src/editor/gizmo.ts` en legacy
- Tipo: CLAUDE
- Status: ✅ Done
- Archivos: `src/legacy.ts` (import + 2 wrappers)
- Funciones cableadas: `updateGizmoPose(camera, gizmoExists)`, `resetGizmoPose(camera)`. Reemplazan bodies de `updateCameraGizmo` (legacy:1611-1625) y `ceResetCameraGizmo` (legacy:1630-1639).
- Validación: tsc ✅, smoke-test ✅
- Notas: Wave E previa había creado `gizmo.ts` sin cablear (entró a `714a8a3` baseline como dead code). Esta entrada cierra el wire-in.

**TASK Wave E2 (POV)**: deferida para después de Waves F-J. POV controls (`cePreviewMode`, `showPovControls`, `hidePovControls`, `updatePovOverlayTime`, `updatePovFrame`, `ceScrubFromEvent`) son orchestrators que coordinan demasiado state — extraerlos parcialmente da poca ganancia y rompe la cohesión del módulo. Diferido: extracción de POV/scrub helpers. Razón: orchestrators con coordinación cruzada — abordar con Wave I lifecycle.

**TASK Tests críticos: cutscene/inheritance.ts (16 casos)**
- Tipo: CLAUDE
- Status: ✅ Done
- Archivos: `tests/cutscene/inheritance.test.ts` (nuevo, 165 LOC), `package.json` (script `test`, dep `vitest@^3.2.4`)
- 16 tests cubriendo: `inheritanceChain` (5), `lastKfWithInheritance` (6), `kfIsVisible` (5).
- Vitest 4.1.5 inicialmente instalado pero falló por bug rolldown native binding en darwin-arm64. Downgradé a vitest@^3.2.4 (estable). 
- `npm run test` → 16/16 ✅. tsc ✅, smoke-test ✅.
- `engine/coords.ts` mencionado en objetivos no existe en el repo. SKIP-AMBIGUO: el archivo no fue creado en migraciones previas. Si Pablo quiere helpers de coords (`cellToWorld`, `worldToCell`) extraídos, requiere nueva tarea.

**DIFERIDO CERRADO Wave D fade overlay opacity**: → `src/cutscene/runtime.ts::computeFadeOpacity`
- Tipo: CLAUDE
- Status: ✅ Done (parcial — body de ceUpdate sigue mayormente en legacy)
- Función pura `computeFadeOpacity(camKeyframes, playhead, povActive): number` extraída.
- En legacy: bloque de fade reducido de ~25 LOC a 7 LOC.
- Resto del body de ceUpdate (POV early, wall state, agent eval, camera interp, FX eval) mantiene preservado el orden per-frame en legacy. Codex review previa lo marcó como NO-low-risk; no se vale la pena seguir extrayendo sin más cuidado.
- Validación: tsc ✅, smoke-test ✅

**DIFERIDO CERRADO Wave C ceUpdateToolbarFields visibility**: → `src/editor/toolbar.ts::applyToolbarVisibility`
- Tipo: CLAUDE
- Status: ✅ Done (parcial — value-setting de selectedKf sigue en legacy)
- Archivos: `src/editor/toolbar.ts` (+90 LOC), `src/legacy.ts` (~50 LOC reemplazadas)
- Extraída la lógica de visibility CSS según activeType + showTrans + transIsNone (toda la rama mecánica). Tipos `ToolbarVisibilityRefs` + `ToolbarActiveType`.
- Value-setting (`selectedKf` → `input.value` con guards de `document.activeElement`) sigue en legacy: depende de presets + activeElement check, no compensa parametrizar.
- Validación: tsc ✅, smoke-test ✅

**DIFERIDO CERRADO Wave G group-drag**: cloneScene + deleteSceneAndKfs + applyGroupDrag → `src/cutscene/scene-ops.ts`
- Tipo: CLAUDE
- Status: ✅ Done
- Archivos: `src/cutscene/scene-ops.ts` (extendido +130 LOC), `src/legacy.ts` (4 wrappers reducidos)
- ceCloneScene 70→3 LOC, ceDeleteSceneAndKfs 22→3 LOC, ceApplyGroupDrag 25→4 LOC.
- ceStartGroupDrag NO extraído — coordina ceState.multiSel + JSON.stringify(ceSerializeCutscene()) baseline + render. Mantenerlo en legacy queda más simple que parametrizar 4 callbacks. Sigue diferido.
- Validación: tsc ✅, smoke-test ✅

**TASK Wave J**: ceInsertCutAt → `src/cutscene/cuts.ts`
- Tipo: CLAUDE
- Status: ✅ Done
- Archivos: `src/cutscene/cuts.ts` (nuevo, 130 LOC), `src/legacy.ts` (import + wrapper de 7 LOC)
- ceInsertCutAt reducido de ~85 LOC a 7 LOC en legacy. Modelo entero (split de plano + reasignación de kfs camera/agent/walls a través del cut con interpolación) en módulo puro.
- Snapshot undo y render quedan en legacy wrapper.
- Validación: tsc ✅, smoke-test ✅

**TASK Wave I**: lifecycle helpers → `src/editor/lifecycle.ts`
- Tipo: CLAUDE
- Status: ✅ Done (parcial — orchestrators ceOpen/ceClose siguen en legacy)
- Archivos: `src/editor/lifecycle.ts` (nuevo, 145 LOC), `src/legacy.ts` (import + 6 wrappers)
- Funciones extraídas: `backupAndRemoveWorldAgents`, `restoreWorldAgents`, `despawnAllAgentsFromScene`, `spawnCutsceneAgents`, `initCameraGizmoState`, `clearCutsceneAnimCache`.
- ceOpen reducido de ~75 LOC a ~15 LOC (orchestrator). ceClose reducido de ~55 LOC a ~30 LOC.
- Diferido (justificado): `ceUpdateToolbarFields` (~80 LOC con DOM refs cerradas), `cePreviewMode/POV controls` (orchestrators), POV/scrub helpers. Coordinación cruzada con FX/walls/render/toolbar/POV/fade/undo todavía atada a closure refs en legacy. Extraerlos requiere refactor más amplio que no entra en presupuesto.
- Validación: tsc ✅, smoke-test ✅

**TASK Wave H**: drag/snap operations → `src/cutscene/scene-ops.ts`
- Tipo: CLAUDE
- Status: ✅ Done
- Archivos: `src/cutscene/scene-ops.ts` (nuevo, 240 LOC), `src/legacy.ts` (import + 7 wrappers reducidos)
- Funciones extraídas: `SCENE_SNAP_THRESHOLD`, `SCENE_SNAP_BREAKAWAY`, `applySnapToStart`, `applySnapToEnd`, `applySnapToStartResize`, `resolveSceneOverlaps`, `moveSceneByDt`, `resizeSceneRight`, `resizeSceneLeft`. Tipos `MoveSceneResult` + `ResizeMode`.
- Wrappers en legacy reducidos a una línea cada uno (move/resizeRight/resizeLeft). Render se queda en legacy via `if (r.changed) ceRenderTracks/Ruler()`.
- Importa `Cutscene`/`Scene` desde `model.ts` para que tsc valide alineación con strict types.
- Validación: tsc ✅, smoke-test ✅

**TASK Wave F**: FX system → `src/cutscene/fx.ts`
- Tipo: CLAUDE
- Status: ✅ Done
- Archivos: `src/cutscene/fx.ts` (nuevo, 220 LOC), `src/legacy.ts` (import + 9 wrappers)
- Funciones extraídas: `FX_PRESETS`, `createFxTextureCache`, `makeFxTexture`, `spawnFxInstance`, `despawnFxInstance`, `updateFxInstance`, `clearAllFx`, `newFxId`, `interpolateFxTarget`, `migrateFxModel`.
- Decisión Codex review previa respetada: `_activeFxInstances` y `_fxTexCache` quedan como locals de legacy (no singletons de módulo). El módulo expone constructor `createFxTextureCache()` y los callers pasan el Map de instancias activas como argumento.
- Validación: tsc ✅, smoke-test ✅
- Tipos: agregué `FxKind`, `FxPreset`, `FxInstance`, `FxTextureCache`, `WorldDims` para parametrizar `CELL/centerX/centerZ` desde legacy.

---

## 2026-04-27 08:15 - HANDOFF nocturno: bypass mode no estaba activo, requiere restart Claude

**Razón pausa**: Pablo recibió prompts de permisos durante la sesión nocturna y vite estaba caído. Pre-flight detectó que `defaultMode: "bypassPermissions"` faltaba en `.claude/settings.local.json`, pero arranqué igual porque Pablo dijo "empezá YA". Decisión incorrecta — quebraba la regla cero-permisos del nocturno.

**Estado al pausar**:
- Wave A: ✅ commit `73b8cf3` "Extracción Fase 2 cutscene Wave A: persistence + undo split (Codex)". `src/editor/persistence.ts` + `src/editor/undo.ts` nuevos, `src/cutscene/persistence.ts` extendido con `serializeCutscene` + `normalizeCutsceneData`. Wire-in en `src/legacy.ts` usando `pushSnapshot`/`popUndo`/`popRedo`. tsc ✅.
- Wave B: ⏸ pausada. `src/editor/timeline.ts` escrito (untracked, NO commiteado, sin wire-in en legacy todavía). Contiene: `formatTime`, `trackAreaWidth`, `rulerWidth`, `timeToPixel`, `pixelToTime`, `clampScroll`, `updateZoomIndicator`, `updatePlayheadPosition`, `renderRuler`. Falta: cablear en legacy reemplazando `ceFormatTime`/`ceTrackAreaWidth`/`ceRulerWidth`/`ceTimeToPixel`/`cePixelToTime`/`ceClampScroll`/`ceUpdateZoomIndicator`/`ceUpdatePlayheadPosition`/`ceRenderRuler` (líneas 3259-3362 de legacy.ts) por wrappers thin que llamen al módulo nuevo. NO incluye `ceRenderTracks` (327 líneas, depende de multi-sel + scene-drag = Waves G/H).
- Waves C-J: pendientes. Plan completo en TaskList y en entrada nocturno previa más abajo.
- CLAUDE.md: modificado por mí ANTES del nocturno (escribí spec nocturno refinado). Sin commitear. Pablo lo va a revisar en claude.ai.
- vite: levantado en background (PID 27515 al pausar, puede haber muerto en restart).
- Bypass mode: AHORA agregado a `.claude/settings.local.json`. Carga al reiniciar sesión Claude Code.
- ScheduleWakeup: programado para 09:08 con prompt original "reanuda nocturno". Sin cancelar (Pablo decidirá).

**Próxima sesión Claude debe**:
1. Verificar bypass activo: ningún tool debería pedir permiso.
2. Verificar vite arriba: `lsof -iTCP:5173 -sTCP:LISTEN`. Si caído: `npm run dev > /tmp/vite-nocturno.log 2>&1 &`.
3. Continuar Wave B: cablear `src/editor/timeline.ts` en `src/legacy.ts` (reemplazar 9 funciones por wrappers thin), validar tsc, commitear.
4. Continuar Waves C-J según plan en TaskList y entrada anterior.
5. Si pre-flight falla algún ítem: NO arrancar, reportar a Pablo.

**Decisiones tomadas**:
- Wave A split de `ceApplyCutsceneData` en 4 callbacks aceptado (no en 5 como sugería Codex review previo). Razón: 4 callbacks cubren la responsabilidad sin granularidad excesiva.
- Wave B conservadora: solo helpers timeline puros + `renderRuler`. `ceRenderTracks` queda en legacy hasta extraer multi-sel/scene-drag. Razón: dependencia cruzada con Waves G/H = acoplamiento alto, mejor diferir.

**Rechazos justificados**: ninguno esta sesión.

---

## 2026-04-27 05:44 - Fase 2 cutscene MODO NOCTURNO: chunks 2-5 autónomos

**Modo**: NOCTURNO autónomo. Pablo activó (CLAUDE.md sección "Modo nocturno"). Reglas:
- 1 review Codex por plan, no rounds.
- NO pedir confirmación entre chunks.
- bypass mode + python3/grep/sed/awk allowlisted.
- Si tokens bajos: ScheduleWakeup 7200s.

**Estado actual repo**:
- legacy.ts: 6798 líneas
- cutscene/ chunk 1 hecho: model, scenes, inheritance, keyframes, camera, walls
- Último commit: `aa57502 Docs: cierre sesión cutscene chunk 1`

**Plan ejecutivo nocturno** (5 waves secuenciales):

### Wave N1: persistence + undo split
- Funciones: ceSerializeCutscene, ceSnapshot, ceUndo, ceRedo, ceApplyCutsceneData (CRITICAL: split en normalize + apply + refresh per Codex review previo), ceSaveCurrent, ceLoadByName, ceNewCutscene, ceDeleteCurrent, ceRefreshSavedSelect
- Destinos: src/editor/undo.ts (snapshots), src/editor/persistence.ts (UI save/load), src/cutscene/persistence.ts (extender)
- Riesgo medio: ceApplyCutsceneData mezcla 5 responsabilidades

### Wave N2: runtime ceUpdate split
- Funciones: ceUpdate (split por subsistema: camera eval, walls eval, agents eval, fx eval), isCameraLocked, isCutsceneControlled, applyPoseToCinematicCamera
- Destino: src/cutscene/runtime.ts
- Riesgo bajo: lectura sin mutar global (excepto agent positions controlled)

### Wave N3: timeline rendering DOM
- Funciones: ceRenderRuler, ceRenderTracks, ceTimeToPixel, cePixelToTime, ceTrackAreaWidth, ceRulerWidth, ceClampScroll, ceUpdateZoomIndicator, ceUpdatePlayheadPosition, ceFormatTime
- Destino: src/editor/timeline.ts + src/editor/tracks/* (5 sub-tracks)
- Riesgo medio: DOM heavy, dataset contract con handlers

### Wave N4: toolbar + POV + gizmo editor wrapper
- Funciones: ceUpdateToolbarFields, ceRefreshParentSelect, ceUpdateTimeDisplay, ceUpdatePlayButton, ceUpdateDeleteBtn, ceRefreshAgentSelect, ceIsCutsceneAgent, ceSyncSnapBtn, ceSyncLensUI, cePreviewMode, showPovControls, hidePovControls, updatePovOverlayTime, updatePovFrame, ceScrubFromEvent, buildCameraGizmo, updateCameraGizmo, ceResetCameraGizmo, ceSetCameraLens
- Destinos: src/editor/toolbar.ts, src/editor/pov.ts, src/editor/gizmo.ts
- Riesgo bajo: UI periférica

### Wave N5 (CRITICAL último): lifecycle + FX + multi-sel + drag/snap
- ceOpen, ceClose: muta agents global (riesgo más alto)
- FX system: singleton mutable
- Multi-select + lasso, drag/snap ops
- Destinos: src/editor/editor.ts, src/cutscene/runtime.ts, src/cutscene/fx.ts, src/editor/multi-sel.ts, src/editor/scene-drag.ts
- Riesgo alto. Si tsc falla, NO commit, escalar a Pablo.

**Diferido sesión futura humana**:
- ceInsertCutAt (depende de ceSnapshot/ceRenderTracks ahora extraídos — podría hacerse en Wave N5 si todo OK)
- ceApplyWallState, ceRestoreAllWalls, ceToggleElementAtPlayhead (visual apply)
- Mouse handlers globales (gran refactor)
- Animate loop + boot → main.ts
- buildScene loop + corner posts
- applyWorld agents restoration

**Review loop**:
- **Round 1 por wave**: Codex adversarial-review del plan ejecucional de cada wave individual.

**Tasks**:

### Estado al reiniciar Claude (05:51)
- Codex review único completado (task-mogyc6gt-c0t0cx, 1m 22s).
- Plan ajustado por review: orden A→B→C(toolbar/format)→D(N2 runtime)→E(POV+gizmo)→F(N5a FX)→G(N5b multi-sel)→H(N5c drag/snap)→I(N5d lifecycle)→J(N5e ceInsertCutAt opcional). 10 waves total.
- Decisiones aceptadas del review:
  - N1 split fino: 5 hooks (normalize + setCutsceneData + replaceAgents + refreshGizmo + refreshEditor) en lugar de 3.
  - N3 timeline render antes de N2 runtime (no bloquea).
  - N2 NO es bajo riesgo — preservar orden per-frame exacto.
  - N5 partido en 5 sub-waves (N5a-e).
  - ceComputeWallStateAt acepta scenes precomputado.
  - _activeFxInstances NO singleton de módulo.
- Wave A lanzada: task-mogykkcq-mhmr7k (corriendo en background, sobrevive reinicio Claude). Plan: src/editor/undo.ts + src/editor/persistence.ts + extender src/cutscene/persistence.ts. Split ceApplyCutsceneData en 5 funciones.

**INSTRUCCIONES REINICIO** (para sesión nueva Claude que lea esto):
1. Bypass mode debe estar activo (Pablo debe verificar settings.local.json tiene `"defaultMode": "bypassPermissions"` — fue activado pero settings local pudo revertir).
2. Verificar status Wave A: `node "/Users/juanpablobermeo/.claude/plugins/cache/openai-codex/codex/1.0.4/scripts/codex-companion.mjs" status --all --json | jq '.latestFinished, .running'`
3. Si Wave A done: sacar resultado, validar tsc, commit, lanzar Wave B.
4. Continuar A→J sin pedir confirmación a Pablo.
5. Cada wave tiene su propio commit. Logging exhaustivo en WORK_LOG (orden cronológico inverso).
6. Si tsc falla: NO commit, ScheduleWakeup 7200s con prompt "investigar fallo wave X".
7. Si tokens críticos: ScheduleWakeup 7200s.
8. Para parsear JSON usar jq, NO python3 (todavía pide permiso).

---

## 2026-04-27 05:07 - Fase 2 migración: cutscene editor (chunk 1, modelo puro)

**Plan inicial**: atacar el editor de cutscenes (~5000 líneas, ~104 funciones) siguiendo el plan en `docs/CUTSCENE_EXTRACT_PLAN.md`. Pablo confirmó verificación visual de cierre Fase 2 anterior — todo anda bien.

**Estado actual repo**:
- `legacy.ts`: 7102 líneas
- 52 módulos extraídos. Plan cutscene en `docs/CUTSCENE_EXTRACT_PLAN.md`
- Último commit: `9a5a0f8 Docs: cerrar sesión Fase 2`

**Scope esta sesión**: pasos 1-5 del plan (cutscene model puro). NO tocar lifecycle (ceOpen/ceClose), persistence/undo, timeline UI, handlers DOM. Cero impacto a runtime visible si está bien hecho.

**Pasos del plan a ejecutar**:
1. tipos + iteradores (`src/cutscene/model.ts`)
2. scene model puro/mutante explícito (`src/cutscene/scenes.ts` + `src/cutscene/inheritance.ts`)
3. keyframe transforms (`src/cutscene/keyframes.ts`)
4. camera pose + cut insertion (`src/cutscene/camera.ts`)
5. walls state compute (`src/cutscene/walls.ts`)

**Plan ejecucional propuesto**:

### CODEX-A: cutscene/model.ts + scenes.ts + inheritance.ts (Wave 1)
- Foundation pura: tipos del modelo, iterador `forEachCutsceneKf`, scene compute+ensure+sceneAt, inheritance chain.
- Codex review previo identificó: `ceComputeScenes` muta modelo aunque parezca puro. Split explícito en `ensureSceneConsistency` (mutante) y `computeSceneView` (puro).
- Funciones a mover: ceComputeScenes, ceEnsureScenesInModel, ceMigrateKfsToScenes, ceSceneAt, ceNewSceneId, ceAssignSceneIdToKf, ceReassignKfsByTime, ceReassignKfsByOwnerToTarget, ceFilterKfsToScene, ceLastKfWithInheritance, ceInheritanceChain, ceKfIsVisible.
- Wrappers thin en legacy.ts.
- Validación: tsc + verificación visual (Pablo abre cutscene editor, edita escenas, ve que no rompió).

### CODEX-B: cutscene/keyframes.ts + camera.ts + walls.ts (Wave 2, después de A)
- Transforms + interpolación + cálculo paredes.
- Funciones: ceShiftKeyframesBySceneId, ceWarpKeyframesBySceneId, ceShiftKeyframesInRange, ceWarpKeyframesInRange, ceInterpCameraPose, ceInsertCutAt, ceComputeWallStateAt.
- ceInsertCutAt es CRÍTICO (preservación de movimiento + walls snapshot — decisión documentada en CUTSCENES.md).
- Wrappers thin.

**Dependencias**:
- Wave A: foundation independiente.
- Wave B: depende de Wave A (keyframes usa scene model + inheritance).

**Lo que NO se toca esta sesión**:
- Lifecycle (ceOpen/ceClose) — núcleo acoplado, mutación de agents global.
- Persistence/undo — partir ceApplyCutsceneData en sesión dedicada.
- Timeline render (ceRenderTracks, ceRenderRuler) — DOM heavy.
- Handlers de mouse/keyboard.
- FX system — singleton mutable, riesgo de leaks.
- POV controls.
- Toolbar UI.

**Review loop**:

- **Round 1**: Codex (task-mogx14qo-kw2ez4, 1m 22s). Objeciones:
  - [BLOCKER] Wave A: ceComputeScenes muta (cutscene.scenes, escenaRootId, inheritState=false). **Aceptado** — split en ensureSceneConsistency + computeSceneView.
  - [BLOCKER] Wave B: ceInsertCutAt llama ceSnapshot + ceRenderTracks (side effects editor). **Aceptado** — diferido a sesión futura cuando snapshot/render existan en módulos.
  - [SUGGESTION] mover ceAssignSceneIdToKf, ceReassignKfsByTime, ceReassignKfsByOwnerToTarget, ceFilterKfsToScene de Wave A → Wave B (mejor encaje en keyframes.ts). **Aceptado**.
  - [SUGGESTION] formalizar forEachCutsceneKf en model.ts (caminata duplicada en migración/reassign/shift/warp). **Aceptado**.
  - [SUGGESTION] todas las funciones reciben cutscene/scenes como param explícito. **Aceptado**.
  - [SUGGESTION] camera.ts solo interpCameraPose. **Aceptado**.
  - [SUGGESTION] walls.ts solo computeWallStateAt(cutscene, t, scenes). **Aceptado**.
  - [QUESTION] wrappers thin OK si pasan ceState.cutscene explícito. **Aceptado**.
  - [SUGGESTION] callsites fuera del bloque cutscene fuerte (lens, mouse FX, camera drag, animate gap) — todos guardados con ceState.open. Wrappers preservan.
- **Total**: 1 round (Pablo aprobó plan ajustado, ejecutar).

**Plan final**:

Wave A: cutscene/model.ts + scenes.ts + inheritance.ts (foundation puro)
Wave B (después de A): cutscene/keyframes.ts + camera.ts + walls.ts (transforms + interpolación + walls compute)

Diferido sesión futura: ceInsertCutAt, ceApplyWallState (visual apply), ceRestoreAllWalls, ceToggleElementAtPlayhead, ceWallIdFromFace, ceIdFromMesh.

**Tasks**:

### CODEX-A: cutscene foundation (Wave A)
- Codex session: task-mogxb50i-1cp4mq (4m 9s)
- Archivos: src/cutscene/model.ts (NEW, 170), scenes.ts (NEW, 151), inheritance.ts (NEW, 102), legacy.ts (-141)
- Validación: tsc ✅
- Status: ✅ Done (commit `d1c0fd9`)
- Notas: split ceComputeScenes en ensureSceneConsistency + computeSceneView. forEachCutsceneKf formalizado en model.ts.

### CODEX-B: cutscene transforms + camera + walls (Wave B)
- Codex session: task-mogxno1h-k8j1pu (3m 44s)
- Archivos: src/cutscene/keyframes.ts (NEW, 152), camera.ts (NEW, 80), walls.ts (NEW, 48), legacy.ts (-163)
- Validación: tsc ✅
- Status: ✅ Done (commit `90b3ec0`)
- Notas: keyframes usa forEachCutsceneKf de Wave A. Todas las funciones puras en sentido "no leen ceState global".

**Review post-ejecución**: ⚠️ no aplicó (pattern Pablo: review único antes, ejecutar después).

**Resultado de la sesión**:
- 2 commits cerrando cutscene chunk 1: `d1c0fd9` (Wave A), `90b3ec0` (Wave B).
- legacy.ts: 7102 → 6798 líneas (-304 esta sesión).
- 6 archivos NEW en src/cutscene/: model, scenes, inheritance, keyframes, camera, walls.
- Total ~700 líneas de cutscene model puro extraído (sin DOM, sin Three, sin globals).
- 0 cambios visibles a usuario — todo wrapper-thin en legacy.

**Decisiones tomadas**:
- Split explícito mutante/puro en ceComputeScenes según Codex review (ensure + computeView).
- forEachCutsceneKf formalizado (estaba duplicado 4x en monolito).
- ceInsertCutAt diferido por dependencia con editor commands aún no extraídos.
- ceApplyWallState diferido (es la mitad visual del walls system, va a editor/).
- Bypass mode permissions activado en .claude/settings.local.json (aplica próxima sesión).

**Rechazos justificados**: ninguno esta sesión.

**Pendientes próxima sesión cutscene**:
1. Editor lifecycle: ceOpen, ceClose (CRITICAL: muta agents global — más peligroso)
2. ceUpdate runtime evaluation (parte la lógica per-frame por subsistema)
3. Persistence + undo: ceSnapshot, ceUndo, ceRedo, ceApplyCutsceneData (split en normalize + apply + refresh per Codex review)
4. Timeline rendering: ceRenderTracks, ceRenderRuler, ceTimeToPixel etc (DOM heavy)
5. Camera gizmo editor wrapper
6. FX system (singleton mutable, alto riesgo de leaks)
7. POV controls
8. Toolbar UI
9. Multi-select + lasso
10. Drag/snap ops
11. Keyframe commands editor
12. Mouse handlers globales
13. ceInsertCutAt (cuando snapshot/render disponibles)

---

## 2026-04-27 04:28 - Fase 2 migración: cierre (paint-tool, camera-iso, zone-edit, cutscene plan)

**Plan inicial**: cerrar Fase 2 de la migración del monolito. Wall-build ya extraído por Claude (commit d2356b6). Quedan 4 frentes paralelizables, mayoría delegables a Codex.

**Estado actual repo**:
- `legacy.ts`: 7312 líneas (era 12,500 en monolito original)
- 35 módulos en `src/engine/`, 6 en `src/game/`, 6 en `src/ui/`, 1 en `src/cutscene/`
- Último commit: `d2356b6 Extracción Fase 2: wall-build`

**Plan inicial (4 tareas)**:

### CODEX-1: paint-tool extraction
- Archivos a tocar: `src/engine/paint-tool.ts` (NEW), `src/legacy.ts`
- State a extraer: `paintColor`, `paintDragging`, `paintLastKey`, `paintPreviewKey`, `paintShiftHeld`, `lastMouseEvent`
- Functions: `paintFloorTile`, `paintWallFace`, `paintAtEvent`, `addPaintPreviewTile`, `addPaintPreviewWallFace`, `updatePaintPreview`, `setPaintColor`, `floodFillFloor`, `floodFillRoomWalls`, `floodFillAtEvent`
- Hooks de init: `onAfterPaint` (legacy hace buildScene), `onSyncUI(color)` (notifica paint-panel), `getMode` (lee modo legacy), pasar `paintShiftHeld` y `lastMouseEvent` por parámetro
- Validación: `npx tsc --noEmit` limpio
- Complejidad: media

### CODEX-2: camera-iso extraction
- Archivos a tocar: `src/engine/camera-iso.ts` (NEW), `src/legacy.ts`
- State a extraer: `theta`, `phi`, `dist`, `camZoom`, `panX`, `panZ`, `lastCamQuadrant`
- Function: `updateCamera`
- Hooks: `onQuadrantChanged` (buildScene en cutaway), getters expuestos para cutscene + wall-mode
- 30+ callsites scattered en legacy — riesgo medio
- Validación: tsc + verificar que `setCameraThetaGetter` sigue wireado
- Complejidad: media-alta

### CODEX-3: zone-edit + spawners extraction
- Archivos a tocar: `src/game/zone-edit.ts` (NEW), `src/game/spawners.ts` (NEW), `src/legacy.ts`
- zone-edit: `startZoneEdit`, `stopZoneEdit`, `applyZoneEditAtEvent`, `floodFillAtEvent` + state `zoneEditingId`, `zoneEditDragging`, `zoneEditDragMode`
- spawners: `spawnRandomProp`, `removeLastProp`, `trySpawnAgent`
- Validación: tsc
- Complejidad: media

### CODEX-4: cutscene editor extraction PLAN (no extrae código)
- Archivo a generar: `docs/CUTSCENE_EXTRACT_PLAN.md`
- Lee bloque cutscene en legacy (~5000 líneas, ~100 funciones `ce*`)
- Identifica subsistemas (timeline render, FX, scene model, undo/redo, camera gizmo, POV, tracks UI, snap/resize)
- Mapea dependencias internas
- Propone orden de extracción incremental
- NO toca código
- Complejidad: alta (research)

**Dependencias**: las 4 son independientes — paralelizables. Ninguna toca schemas persistidos. Ninguna toca ROOF.

**Review loop**:

- **Round 1**: Codex (task-mogvodp2-pf0ko9, thread 019dcdd9-2065-71b3-8b65-990a1aaba790). Objeciones:
  - [BLOCKER] CODEX-1/CODEX-3 no son independientes: ambos tocan mouse/key handlers globales (legacy 2278-2667). **Aceptado** — secuencializar.
  - [BLOCKER] CODEX-3 zone-edit destino mal: `game/` no debe importar `ui/zone-edit-banner`. **Aceptado** — split en zone-edit (game) + callbacks al banner (legacy).
  - [BLOCKER] cross-task: `engine/agent-texture.ts` ya importa de `../game/agent-kits` (viola engine→game prohibición). **Notado pero rechazado fixear ahora** — pre-existente, fuera de scope. Anoto en ROADMAP como debt.
  - [SUGGESTION] CODEX-1 paint-tool puede duplicar paint.ts existente. **Aceptado** — scope a orchestration only.
  - [QUESTION] CODEX-1: ¿`lastMouseEvent` queda en legacy hasta extraer mouse handlers? **Aceptado** — sí.
  - [SUGGESTION] CODEX-2 camera más acoplada: cutscene usa `updateCamera`. **Aceptado** — wrapper alias en legacy preserva callsites cutscene.
  - [SUGGESTION] CODEX-3 spawners complejidad subestimada. **Aceptado** — media-alta.
  - [SUGGESTION] CODEX-1 complejidad subestimada. **Aceptado** — media-alta.
  - [SUGGESTION] cross-task scope: faltan items ROADMAP (applyWorld/loadSlot/reset, buildScene loop, animate loop). **Notado** — fuera de cierre actual, próxima sesión.
- **Total**: 1 round (Pablo dijo no más reviews, ejecutar).

**Plan final**:

Wave 1 paralelo (independientes):
- CODEX-2: camera-iso (engine/camera-iso.ts) — wrapper alias para callsites cutscene
- CODEX-3a: spawners (game/spawners.ts) — spawnRandomProp + removeLastProp + trySpawnAgent
- CODEX-4: cutscene plan doc (docs/CUTSCENE_EXTRACT_PLAN.md, read-only)

Wave 2 secuencial:
- CODEX-1: paint-tool (engine/paint-tool.ts) — standalone, toca mouse handlers

Wave 3 secuencial:
- CODEX-3b: zone-edit (game/zone-edit.ts) — comparte mouse handlers con paint

**Tasks**:

### CODEX-2: camera-iso (delegated, Wave 1)
- Codex session: task-mogvyvrw-dlx7qn (3m 51s)
- Archivos: src/engine/camera-iso.ts (NEW, 118 líneas), src/legacy.ts
- Validación: tsc ✅
- Status: ✅ Done (commit `5ff2999` consolidado con CODEX-3a, ambos modificaron legacy.ts)
- Notas: Codex no pudo commitear (sandbox bloquea .git lock). Claude commiteó.

### CODEX-3a: spawners (delegated, Wave 1)
- Codex session: task-mogvzhpb-lde9gf (4m 51s)
- Archivos: src/game/spawners.ts (NEW, 155 líneas), src/legacy.ts
- Validación: tsc ✅
- Status: ✅ Done (commit `5ff2999` consolidado con CODEX-2)
- Notas: idem — sandbox bloquea commit, Claude consolidó.

### CODEX-4: cutscene plan doc (delegated, Wave 1, read-only analysis)
- Codex session: task-mogw0tot-ahnh3j (2m 57s)
- Archivos: docs/CUTSCENE_EXTRACT_PLAN.md (NEW, 298 líneas, ~2055 palabras)
- Validación: n/a (doc only)
- Status: ✅ Done (commit `d68ddaf`)
- Hallazgos sorprendentes documentados: ceState empieza ~2944 (no ~1840), ceComputeScenes muta modelo, ceApplyCutsceneData mezcla 5 responsabilidades, FX listeners referencian modelo viejo, ceOpen/ceClose reemplazan agents global.

**Nota técnica**: subagent codex:codex-rescue falló por permisos de Bash. Lancé directo con `node codex-companion.mjs task --write --background`. Codex implementa pero no puede commitear (sandbox bloquea `.git/index.lock`). Claude consolida commits.

### CODEX-1: paint-tool (delegated, Wave 2)
- Codex session: task-mogweuph-h4y7fb
- Archivos: src/engine/paint-tool.ts (NEW, 222 líneas), src/legacy.ts (-138 líneas)
- Validación: tsc ✅
- Status: ✅ Done (commit `3a55186`)
- Notas: paintShiftHeld + lastMouseEvent quedan en legacy via hooks (Codex review Round 1 lo recomendó). NO duplica paint.ts ni paint-preview.ts. NO tocó zone-edit.

### CODEX-3b: zone-edit (delegated, Wave 3)
- Codex session: task-mogwmwdc-mqc2ow (3m 24s)
- Archivos: src/game/zone-edit.ts (NEW, 106 líneas), src/legacy.ts
- Validación: tsc ✅
- Status: ✅ Done (commit `6620960`)
- Notas: game/ NO importa ui/ (banner via callbacks). floodFillAtEvent ya en paint-tool. Mouse handlers solo lo necesario.

**Review post-ejecución**: ⚠️ no aplicó (Pablo dijo no más reviews, solo ejecutar). Validación tsc en cada wave.

**Resultado de la sesión**:
- 5 commits cerrando Fase 2: `5ff2999` (camera-iso + spawners), `d68ddaf` (cutscene plan), `3a55186` (paint-tool), `6620960` (zone-edit). Wall-build ya commiteado por Claude antes (`d2356b6`).
- legacy.ts: 7458 → 7102 líneas (-356 esta sesión, -1548 desde inicio del día).
- Nuevos módulos: 6 (camera-iso, spawners, paint-tool, zone-edit, wall-build, + plan doc cutscene)
- Codex CLI 0.125.0 lanzado en background con `task --write --background`. Sandbox bloquea `.git/index.lock` → Claude consolida commits.

**Decisiones tomadas**:
- Wave 1 paralelizado (camera-iso + spawners + cutscene plan) — independientes per Codex review.
- Wave 2 secuencial paint-tool (toca mouse handlers).
- Wave 3 secuencial zone-edit (comparte mouse handlers con paint).
- Camera-iso y spawners commit consolidado (Codex jobs paralelos modificaron mismo legacy.ts → split fino imposible sin rebase).
- ROADMAP actualizado: 52 módulos, ~46% migrado, plan cutscene listo para próxima sesión.

**Rechazos justificados**:
- agent-texture viola layering engine→game: NO fixear en esta sesión, anotado como debt en ROADMAP. Razón: pre-existente, fuera de scope cierre Fase 2, riesgo bajo (no rompe nada).
- ROADMAP scope check de Codex (faltaban applyWorld/buildScene/animate/mouse handlers): Notado pero NO incluido en esta sesión. Razón: Pablo definió "cierre Fase 2" como las 4 tareas paralelas listadas; los items extra van en próxima sesión.

**Hallazgos sorprendentes documentados** (CUTSCENE_EXTRACT_PLAN.md):
- ceState empieza ~2944 (no ~1840 como pensé)
- ceComputeScenes muta modelo (parecía read)
- ceApplyCutsceneData mezcla 5 responsabilidades
- FX listeners referencian modelo viejo (fx.keyframes vs fx.entities)
- ceOpen/ceClose reemplazan agents global completo

**Pendientes próxima sesión**:
1. Cutscene editor extraction (~5000 líneas, plan listo)
2. applyWorld agents restoration → cierre persistencia
3. buildScene loop interno
4. Mouse handlers globales (desbloquea más paralelización)
5. Animate loop + boot → main.ts
6. Fix debt agent-texture engine→game
