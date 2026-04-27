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
