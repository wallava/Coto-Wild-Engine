# CUTSCENE_EXTRACT_PLAN.md — Plan de extracción del editor de cutscenes

## Alcance

Análisis read-only de `src/legacy.ts` al 2026-04-27. El bloque principal del editor vive entre `ceState` en la línea ~2944 y los handlers finales en ~7217. Hay wrappers de cámara antes, en ~1717-1795, y hooks de mouse sobre el canvas que ya llaman al editor entre ~2132-2258 y ~2490-2515.

Objetivo: extraer el sistema sin reescribirlo, preservando paridad con el monolito. La separación deseada sigue `ARCHITECTURE.md`:

- `src/cutscene/*`: modelo serializable, evaluación runtime, herencia, interpolación, persistencia de datos.
- `src/editor/*`: timeline, DOM, toolbar, gizmo editor, multi-selección, popovers, shortcuts.
- `src/engine/*`: comportamiento reusable que no sabe de cutscenes ni editor.

Regla operacional: NO tocar `ROOF`. El plan puede depender de wrappers existentes para ocultarlo/mostrarlo, pero no debe extraer ni mover el sistema de techo.

## Inventario de subsistemas

| Subsistema | Funciones | Líneas aprox. | Destino propuesto |
|---|---:|---:|---|
| Camera gizmo | 5 | ~80 | `src/editor/gizmo.ts` + engine ya extraído |
| Scene model + reassignments | 12 | ~570 | `src/cutscene/scenes.ts`, `src/cutscene/keyframes.ts`, UI popover en `src/editor/popovers.ts` |
| Timeline rendering + ruler | 9 | ~520 | `src/editor/timeline.ts`, `src/editor/tracks/*` |
| Keyframe ops | 10 | ~320 | `src/cutscene/keyframes.ts` + comandos editor |
| Drag/snap ops | 7 | ~180 | `src/editor/scene-drag.ts`; helpers puros a `cutscene/scenes.ts` si se pueden aislar |
| Multi-select + lasso | 8 | ~260 | `src/editor/multi-sel.ts` |
| FX system | 9 | ~230 | runtime visual a `src/engine/fx.ts` o `src/cutscene/fx-runtime.ts`; modelo a `src/cutscene/fx.ts`; UI a editor |
| Walls visibility per kf | 8 | ~190 | evaluación a `src/cutscene/walls.ts`; aplicación visual a `src/editor/walls-visibility.ts` con deps engine |
| Open/close + play | 6 | ~770 | `src/editor/editor.ts` + `src/cutscene/runtime.ts` |
| Persistence + undo | 9 | ~210 | `src/editor/undo.ts`, `src/editor/persistence.ts`, schema futuro en `src/cutscene/schema.ts` |
| POV controls | 6 | ~160 | `src/editor/pov.ts`; cámara real en `src/engine/camera.ts` si se generaliza |
| Toolbar/UI | 10 | ~280 | `src/editor/toolbar.ts` |
| Misc helpers | 5 | ~220 | repartir entre `cutscene/scenes.ts`, `cutscene/camera.ts`, `cutscene/keyframes.ts` |

Total aproximado: 104 funciones y ~4.000-4.500 líneas de cutscene/editor directo. Si se incluyen los hooks de canvas/mouse y shortcuts embebidos alrededor del bloque, el movimiento real se acerca a ~5.000 líneas.

## Detalle por subsistema

### Camera gizmo

Funciones identificadas: `buildCameraGizmo`, `updateCameraGizmo`, `ceResetCameraGizmo`, `ceSetCameraLens`, `ceSyncLensUI`.

Destino:

- `src/editor/gizmo.ts`: wrapper que conecta `ceState.cutscene.camera` con `engine/camera-gizmo`.
- Mantener `src/engine/camera-gizmo.ts` como renderer puro ya extraído.

Dependencias internas: keyframes de cámara, timeline render, toolbar lens, `ceAssignSceneIdToKf`.

Dependencias externas: `scene`, `renderCameraGizmoPose`, `setCameraGizmoVisible`, DOM lens select/slider/label.

Riesgos: el wrapper vive antes de `ceState` en el archivo y depende de inicialización tardía; ya hubo problemas de orden con otros bloques. La extracción debe invertir el control: `initCameraGizmoEditor({ getState, scene, dom })`, sin globals nuevos.

### Scene model + reassignments

Funciones identificadas: `ceComputeScenes`, `ceEnsureScenesInModel`, `ceMigrateKfsToScenes`, `ceCloneScene`, `ceDeleteSceneAndKfs`, `ceRenameScene`, `ceSceneAt`, `ceOpenScenePopover`, `ceNewSceneId`, `ceAssignSceneIdToKf`, `ceReassignKfsByTime`, `ceReassignKfsByOwnerToTarget`.

Destino:

- `src/cutscene/scenes.ts`: compute, ensure, sceneAt, clone/delete scene sin DOM.
- `src/cutscene/keyframes.ts`: iteradores por todos los tracks, assign/reassign por tiempo/owner.
- `src/editor/popovers.ts`: `ceOpenScenePopover`.

Dependencias internas: keyframe ops, drag/snap, timeline render, inheritance, persistence, undo.

Dependencias externas: `ceState.cutscene`, `document.body`, `showPrompt` indirecto por UI, `ceRenderTracks`, `ceSnapshot`.

Riesgos: `ceComputeScenes` muta el modelo aunque su nombre suene puro. Fuerza primer plano `inheritState=false` y rellena `escenaRootId`. Al extraer, decidir explícitamente si será `ensureSceneConsistency(cutscene)` mutante o `computeSceneView(cutscene)` puro. No mezclar las dos cosas.

### Timeline rendering + ruler

Funciones identificadas: `ceRenderRuler`, `ceRenderTracks`, `ceTimeToPixel`, `cePixelToTime`, `ceTrackAreaWidth`, `ceRulerWidth`, `ceClampScroll`, `ceUpdateZoomIndicator`, `ceUpdatePlayheadPosition`.

Destino:

- `src/editor/timeline.ts`: ruler, playhead, zoom/pan, conversiones tiempo-pixel.
- `src/editor/tracks/scenes.ts`, `camera.ts`, `walls.ts`, `fx.ts`, `agents.ts`: render por track.

Dependencias internas: scene model, `ceKfIsVisible`, multi-select, toolbar selected state, FX presets, anim presets.

Dependencias externas: DOM completo (`ceTimeline`, `ceTracks`, `ceRuler`, `cePlayhead`), `agents`, `FX_PRESETS`, `CE_ANIM_PRESETS`.

Riesgos: `ceRenderTracks` es un mega-render manual que también codifica selección, títulos, dataset contract y parte del modelo visual. Conviene extraerlo después de estabilizar el modelo y antes de mover handlers, para preservar los `dataset.*` que los handlers consumen.

### Keyframe ops

Funciones identificadas: `ceAddKeyframe`, `ceDeleteSelectedKeyframe`, `ceShiftKeyframesBySceneId`, `ceWarpKeyframesBySceneId`, `ceShiftKeyframesInRange`, `ceWarpKeyframesInRange`, `ceFilterKfsToScene`, `ceLastKfWithInheritance`, `ceInheritanceChain`, `ceKfIsVisible`.

Destino:

- `src/cutscene/keyframes.ts`: shift/warp/filter/visibility.
- `src/cutscene/inheritance.ts`: inheritance chain y last effective kf.
- `src/editor/keyframe-commands.ts`: add/delete desde toolbar, porque lee DOM y selección.

Dependencias internas: scene model, walls, FX, toolbar, runtime `ceUpdate`.

Dependencias externas: `ceState`, `ceTypeSelect`, `ceTextInput`, `ceAnimSelect`, `ceDurationInput`, `agents`, `FX_PRESETS`.

Riesgos: operaciones genéricas recorren cámara, walls, FX entities y tracks de agentes con lógica duplicada. Antes de mover mucho, crear un iterador único `forEachCutsceneKf(cutscene, fn)` reduce errores y tests.

### Drag/snap ops

Funciones identificadas: `ceMoveScene`, `ceResizeSceneRight`, `ceResizeSceneLeft`, `ceApplySnapToStart`, `ceApplySnapToEnd`, `ceApplySnapToStartResize`, `ceResolveSceneOverlaps`.

Destino:

- `src/editor/scene-drag.ts`: operación interactiva, snapshots, mouseup behavior.
- `src/cutscene/scenes.ts`: resolución de solapes y snap si se parametriza sin DOM.

Dependencias internas: keyframe shift/warp, scene model, timeline render, undo.

Dependencias externas: `ceState.snapEnabled`, `ceState.cutscene.duration`.

Riesgos: drag es no destructivo hasta mouseup. Si se llama `resolveOverlaps` durante mousemove se rompe una decisión crítica documentada en `CUTSCENES.md`. También hay semántica de absorción: al eliminar un plano invadido, sus kfs se reasignan, no se borran.

### Multi-select + lasso

Funciones identificadas: `ceMultiSelClear`, `ceMultiSelHasScene`, `ceMultiSelHasKf`, `ceMultiSelCount`, `ceMultiSelResolveKfs`, `ceStartGroupDrag`, `ceApplyGroupDrag`, `ceUpdateLassoBox`, `ceComputeLassoSelection`.

Destino: `src/editor/multi-sel.ts`.

Dependencias internas: scene clone, keyframe iteration, timeline DOM, undo serialization, drag/snap.

Dependencias externas: `ceTracks.querySelectorAll`, `getBoundingClientRect`, `document.body`, `ceSerializeCutscene`, `ceApplyCutsceneData`.

Riesgos: group drag guarda referencias directas a kfs para sobrevivir reordenamientos del array. No reemplazar por índices sin replicar ese comportamiento. Alt+drag clone usa baseline JSON para cancelar; depende de undo stack.

### FX system

Funciones identificadas: `ceApplyAnimEffect`, `ceResetAgentAnim`, `makeFxTexture`, `spawnFxInstance`, `despawnFxInstance`, `updateFxInstance`, `ceClearAllFx`, `ceFxNewId`, `ceFxInterpolateTarget`, `ceFxMigrateModel`.

Destino:

- `src/cutscene/fx.ts`: modelo, ids, migración, interpolación target.
- `src/cutscene/runtime-fx.ts` o `src/engine/fx.ts`: spawn/update/despawn visual. Si es reusable, engine; si depende de cutscene targets, cutscene runtime.
- `src/editor/fx-tools.ts`: placement y selección de entidades FX.
- `ceApplyAnimEffect` y `ceResetAgentAnim` no son FX; van mejor a `src/cutscene/agent-animation.ts` o engine agents si se vuelven presets registrables.

Dependencias internas: runtime playback, timeline tracks, keyframe add/delete, placement handlers.

Dependencias externas: `THREE`, `scene`, `agents`, `CELL`, `centerX`, `centerZ`, `FX_PRESETS`, agent mesh state.

Riesgos: `_activeFxInstances` es un singleton mutable ligado a objetos Three. Debe vivir en una instancia de runtime/editor, no en módulo global, para evitar leaks entre abrir/cerrar cutscene.

### Walls visibility per kf

Funciones identificadas: `ceComputeWallStateAt`, `ceApplyWallState`, `ceRestoreAllWalls`, `ceToggleElementAtPlayhead`, `ceWallIdFromFace`, `ceIdFromMesh`, `ceFilterKfsToScene`, `ceLastKfWithInheritance`.

Destino:

- `src/cutscene/walls.ts`: compute wall state desde kfs.
- `src/editor/walls-visibility.ts`: aplicar hiddenIds a meshes del mundo durante edición.

Dependencias internas: sceneAt, inheritance, keyframe add/update, timeline render.

Dependencias externas: `sceneObjects`, `props`, `roofObjects`, `roofVisible`, `setRoofVisible`, door panel `userData`.

Riesgos: mezcla paredes, puertas, props y techo en el mismo hiddenIds. Mantener la convención exacta: `N:cx,cy`, `W:cx,cy`, `P:propId`, `ROOF`. No extraer ni mover el sistema ROOF; solo usar el contrato visible actual.

### Open/close + play

Funciones identificadas: `ceOpen`, `ceClose`, `ceTogglePlay`, `ceSetPlayhead`, `ceUpdate`, `isCameraLocked`, `isCutsceneControlled`, `applyPoseToCinematicCamera`.

Destino:

- `src/editor/editor.ts`: lifecycle del editor, wiring de estado, apertura/cierre, shortcuts top-level.
- `src/cutscene/runtime.ts`: evaluación por frame sin DOM.
- `src/engine/camera.ts`: si `applyPoseToCinematicCamera` sirve fuera del editor; si no, queda en runtime adapter.

Dependencias internas: casi todos los subsistemas.

Dependencias externas: `agents`, `spawnAgent`, `scene`, `syncAgentMesh`, `showSpeechBubble`, `getDraggedAgent`, `cinematicCamera`, `viewW/viewH`, `updateCamera`, `window._isCutsceneControlled`.

Riesgos: este es el núcleo acoplado. `ceOpen` reemplaza agentes del mundo por agentes propios de cutscene y luego `ceClose` restaura refs. Esa mutación del array global `agents` es el riesgo más alto de la extracción.

### Persistence + undo

Funciones identificadas: `ceSerializeCutscene`, `ceSnapshot`, `ceUndo`, `ceRedo`, `ceApplyCutsceneData`, `ceSaveCurrent`, `ceLoadByName`, `ceNewCutscene`, `ceDeleteCurrent`, `ceRefreshSavedSelect`.

Destino:

- `src/editor/undo.ts`: stack JSON.
- `src/editor/persistence.ts`: UI save/load.
- `src/cutscene/persistence.ts`: ya existe parcialmente; completar storage helpers sin DOM.
- `src/cutscene/schema.ts`: siguiente fase con Zod.

Dependencias internas: scene migration, FX migration, wall state, agent spawn, timeline/toolbar refresh.

Dependencias externas: `loadAllSavedCutscenes`, `writeAllSavedCutscenes`, `showPrompt`, `showConfirm`, DOM select/buttons, `spawnAgent`, `scene`.

Riesgos: `ceApplyCutsceneData` hace más que aplicar data: limpia FX, remueve/spawnea agentes, reinicia gizmo, migra scenes, refresca UI y aplica walls. Debe partirse en `normalizeCutsceneData`, `setCutsceneData`, y `refreshEditorAfterDataChange`.

### POV controls

Funciones identificadas: `cePreviewMode`, `showPovControls`, `hidePovControls`, `updatePovOverlayTime`, `updatePovFrame`, `ceScrubFromEvent`.

Destino: `src/editor/pov.ts`.

Dependencias internas: playhead, play toggle, time format, POV camera state.

Dependencias externas: DOM `pov-*`, `document.body.classList`, `window.innerWidth/innerHeight`, `setCameraGizmoVisible`.

Riesgos: POV y preview comparten `camera.povActive` con edición de cámara. Separar estado de presentación (`povAspect`, controls timeout) del modelo persistido; hoy `povAspect` vive escondido en `ceState`.

### Toolbar/UI

Funciones identificadas: `ceUpdateToolbarFields`, `ceRefreshParentSelect`, `ceUpdateTimeDisplay`, `ceUpdatePlayButton`, `ceUpdateDeleteBtn`, `ceFormatTime`, `ceRefreshAgentSelect`, `ceIsCutsceneAgent`, `ceSyncSnapBtn`, `ceSyncLensUI`.

Destino: `src/editor/toolbar.ts`, con `ceFormatTime` movible a `src/utils/format.ts` si se reutiliza.

Dependencias internas: selected kf, FX presets, anim presets, parent camera, snap state.

Dependencias externas: DOM de toolbar, `agents`, `setCameraGizmoVisible`.

Riesgos: toolbar no es solo presentación: cambia campos de kfs en vivo vía event listeners. Extraer primero los comandos de edición para que toolbar solo llame callbacks.

### Misc helpers

Funciones identificadas: `ceNewSceneId`, `ceAssignSceneIdToKf`, `ceReassignKfsByTime`, `ceReassignKfsByOwnerToTarget`, `ceInsertCutAt`, `ceInterpCameraPose`.

Destino:

- `src/cutscene/scenes.ts`: ids y cut insert si queda puro.
- `src/cutscene/camera.ts`: interpolación de pose.
- `src/cutscene/keyframes.ts`: reassign helpers.

Dependencias internas: escenas, keyframes, walls snapshots, camera kfs.

Dependencias externas: `ceState`, `ceSnapshot`, `ceRenderTracks`.

Riesgos: `ceInsertCutAt` codifica una decisión crítica: tijera preserva movimiento y walls snapshot. Debe tener tests antes o durante extracción.

## Orden propuesto de extracción incremental

1. **Tipos e iteradores sin mover comportamiento visible.** Crear `src/cutscene/model.ts` y helpers de iteración de kfs. Justificación: casi todo depende de recorrer cámara, walls, FX y tracks igual.
2. **Scene model puro/mutante explícito.** Extraer `ensureScenesInModel`, `computeSceneView`, `sceneAt`, `inheritanceChain`. Justificación: runtime, timeline, drag y walls dependen de esto.
3. **Keyframe transforms.** Extraer shift/warp/reassign/filter/visibility. Justificación: drag, clone, cut y multi-select los usan.
4. **Camera pose + cut insertion.** Extraer interpolación de cámara y tijera con tests. Justificación: toca modelo crítico y preservación de movimiento.
5. **Walls state compute.** Separar cálculo puro de aplicación visual. Justificación: runtime necesita compute; editor necesita apply.
6. **Runtime evaluation.** Partir `ceUpdate` en evaluación de camera/walls/agents/fx y adaptadores engine. Justificación: permite que editor llame runtime en vez de contener todo.
7. **Persistence/undo.** Separar normalize/apply/refresh. Justificación: ya hay `src/cutscene/persistence.ts`; reduce baseline JSON duplicado.
8. **Timeline render.** Extraer renderer manteniendo dataset contract. Justificación: depende de todos los helpers anteriores.
9. **Toolbar, POV, gizmo editor.** Extraer UI periférica. Justificación: menos riesgo después de tener comandos y runtime aislados.
10. **Handlers de interacción.** Mover mouse/keyboard a `src/editor/interactions.ts`, `scene-drag.ts`, `keyframe-drag.ts`, `multi-sel.ts`. Justificación: son los más DOM-heavy y dependen del contrato visual de timeline.
11. **Lifecycle final.** Reducir `legacy.ts` a `initCutsceneEditor(deps)` y hooks mínimos desde canvas/animate loop. Justificación: último paso porque toca agentes globales y boot order.

## Tareas paralelizables

- **A. Modelo cutscene:** tipos, iteradores, scene consistency, inheritance, tests unitarios.
- **B. Timeline UI:** separar render de tracks en funciones pequeñas sin cambiar HTML generado.
- **C. Persistence/undo:** extraer storage UI y stack de snapshots, manteniendo JSON actual.
- **D. FX runtime:** aislar `FX_PRESETS`, texture cache e instancias activas detrás de una clase.
- **E. POV/toolbar:** extraer DOM refs y event listeners a módulos editor con callbacks.
- **F. Docs/tests:** fixtures de cutscenes para sceneId estable, drag no destructivo, tijera, walls inheritance.

No paralelizar en el mismo archivo de destino al principio. `src/cutscene/scenes.ts` y `src/cutscene/keyframes.ts` serán puntos calientes; conviene asignar ownership claro.

## Estimación de tamaño

- Líneas a mover desde `legacy.ts`: ~5.000.
- Líneas netas nuevas esperadas: ~5.300-5.800 por tipos, adapters y tests mínimos.
- Archivos nuevos estimados: 18-24.

Propuesta de archivos:

- `src/cutscene/model.ts`
- `src/cutscene/schema.ts`
- `src/cutscene/scenes.ts`
- `src/cutscene/keyframes.ts`
- `src/cutscene/inheritance.ts`
- `src/cutscene/camera.ts`
- `src/cutscene/walls.ts`
- `src/cutscene/fx.ts`
- `src/cutscene/runtime.ts`
- `src/editor/editor.ts`
- `src/editor/timeline.ts`
- `src/editor/tracks/scenes.ts`
- `src/editor/tracks/camera.ts`
- `src/editor/tracks/walls.ts`
- `src/editor/tracks/fx.ts`
- `src/editor/tracks/agents.ts`
- `src/editor/gizmo.ts`
- `src/editor/toolbar.ts`
- `src/editor/pov.ts`
- `src/editor/popovers.ts`
- `src/editor/multi-sel.ts`
- `src/editor/scene-drag.ts`
- `src/editor/keyframe-drag.ts`
- `src/editor/undo.ts`
- `src/editor/persistence.ts`

## Hallazgos importantes

- El bloque no empieza realmente en ~1840 para cutscenes; ahí hay wall rendering/roof-adjacent code. El editor fuerte empieza en ~2944. Los wrappers de cámara sí están antes, en ~1717.
- `ceComputeScenes` no es puro: puede crear escenas y mutar `inheritState`/`escenaRootId`. Extraerlo como compute puro sin ajustar nombre rompería expectativas.
- `ceApplyCutsceneData` mezcla carga de modelo, migración, spawn/despawn de agentes, gizmo, walls y UI refresh. Es el mejor candidato a partir antes de tocar lifecycle.
- Hay una inconsistencia probable heredada: algunos listeners de FX todavía referencian `ceState.cutscene.fx.keyframes`, pero el modelo actual usa `fx.entities`. Hay que verificar antes de extraer toolbar FX.
- Group drag usa referencias directas a kfs, no índices, porque los arrays se reordenan. Eso es deliberado y debe preservarse.
- La pantalla negra en gaps no vive solo en `ceUpdate`; el render loop consulta `ceSceneAt(ceState.playhead) === null` cerca de ~7290. El runtime extraído debe exponer esa señal.
- El editor toma control total de `agents`: al abrir borra agentes del mundo del array global y spawnea agentes propios de cutscene; al cerrar restaura refs. Este es el acoplamiento más peligroso.
