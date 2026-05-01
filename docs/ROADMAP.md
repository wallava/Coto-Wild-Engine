<!-- ARCHIVO: ROADMAP.md -->

# ROADMAP.md — Pendientes y futuro

Este archivo es la lista viva de lo que falta. Se actualiza con cada sesión.

---

## Estructura por horizontes

CWE existe en tres horizontes (ver `VISION.md`). Cada feature pertenece a uno:

- **MVP (horizonte 1)**: herramienta personal de Pablo para AGENTS.INC.
- **AGENTS.INC publicado (horizonte 2)**: el juego en una web pública.
- **CWE producto (horizonte 3)**: motor para que otros creadores construyan.

Solo el horizonte 1 tiene plazos. Los otros dos son post-MVP.

---

## Convenciones

- 🔴 Bloqueante / urgente
- 🟠 Alta prioridad
- 🟡 Media
- 🟢 Baja / nice-to-have
- ✅ Hecho

---

# HORIZONTE 1 — MVP

Ver `MVP_SCOPE.md` para alcance estricto.

## 🟠 Migración del monolito

- ✅ **Fase 0**: setup Vite + TS + tooling
- ✅ **Fase 1**: bulk del monolito a `legacy.ts` con `@ts-nocheck`, imports CDN → ES modules pinneados
- 🟠 **Fase 2**: separar `engine/`, `game/`, `cutscene/`, `editor/` con APIs explícitos. **40+ módulos extraídos al 2026-04-27 (~50% migrado, ~5,800 líneas restantes en legacy.ts).** Ver `ARCHITECTURE.md` para inventario.
- ✅ **Fase 3**: schemas Zod + migrations de datos persistidos. **Cerrada con 100 tests verdes + cuarentena de data corrupta + validation runtime cableada.**
- 🔲 Verificar paridad final con monolito (todo lo que andaba antes anda ahora).

### Sesión 2026-04-27 — extracciones cerradas (referencia histórica)

Engine:
- ✅ agent-chassis, agent-drag, agent-selection, agent-status, agent-helpers
- ✅ stations, needs queries, prop-drag, place-mode, wall-build
- ✅ camera-iso, spawners (Codex Wave 1)
- ✅ paint-tool (Codex Wave 2)
- ✅ zone-edit (Codex Wave 3)
- ✅ loadWorldData (geometry+props+zones; agents quedan en legacy hasta extraer applyWorld completo)

Cutscene chunk 1 (modelo puro):
- ✅ cutscene/model, scenes, inheritance, keyframes, camera, walls

Cutscene Fase 2 diferidos:
- ✅ Diferido 1: ceStartGroupDrag → editor/multi-sel
- ✅ Diferido 2: ceUpdateToolbarFields → editor/toolbar
- ✅ Diferido 3: POV controls + scrubbing → editor/playback
- ✅ Diferido 4: ceUpdate POV early + FX eval → cutscene/runtime

Schemas Zod (Fase 3):
- ✅ Fase 3.1: schemas Zod cutscene + world
- ✅ Fase 3.2: validateCutscene + tests schema cutscene
- ✅ Fase 3.3: validateWorld + tests engine schema
- ✅ Fase 3.4: migrations cutscene + world
- ✅ Fase 3.5: cabling validate+migrate en callers reales (loadFromStorage + getSavedCutscene)

### Pendientes Fase 2 grandes

- **CUTSCENE EDITOR** — chunk 1 modelo puro hecho, diferidos cerrados, schemas cerrados. **Pendiente**:
  - Editor lifecycle (ceOpen/ceClose — CRITICAL: muta agents global)
  - Runtime evaluation (ceUpdate, resto del body)
  - Persistence/undo (ceSnapshot, ceUndo, ceRedo)
  - Timeline rendering (DOM heavy)
  - Cámara gizmo editor wrapper
  - FX system (singleton mutable)
  - POV controls completos
  - Toolbar UI completa
  - Mouse handlers globales
  - Plan detallado: `docs/CUTSCENE_EXTRACT_PLAN.md`
- **applyWorld + loadSlot + resetWorldToDefault** — cierre persistencia (loadWorldData ya extraído; falta agents restoration).
- **buildScene loop + corner posts + props render** — chunk medio del IIFE, ~300 líneas estructural.
- **Animate loop + boot** → `main.ts` orchestrator final.
- **Mouse handlers globales** — bloque grande en legacy. Próxima sesión.
- **TECHO ROOF** (~480 líneas) — **NO EXTRAER NUNCA**. Tres intentos consecutivos dispararon `ReferenceError: Cannot access 'ceState' before initialization`. La causa raíz nunca se identificó. Pablo decidió reescribir el sistema de roof desde cero cuando llegue. Hasta entonces, dejarlo donde está en `legacy.ts` intacto.
- **Door animation** — eliminada por bug pre-existente, Pablo reescribirá.

### Debt arquitectónico identificado

- ✅ `src/engine/agent-texture.ts` ya no importa `../game/agent-kits` (corregido 2026-04-29 con setter pattern + catálogo inyectado desde main.ts).
- 4 diferidos permanentes de Fase 2 cutscene (todos justificados, no se extraerán):
  - Body de ceUpdate: header, walls eval, per-track agent eval, camera interp.
  - cePreviewMode orchestrator + cePovToggle.click handler.
  - ceStartGroupDrag listeners de mousemove/mouseup/Escape (orchestrator con baseline serialization).
  - Razón común: anti-pattern de sobre-inyección (8+ callbacks) o orchestrators con coordinación cruzada que no compensa parametrizar.

## 🟠 Internacionalización

Setup desde fase inicial post-migración.

- 🔲 Setup `i18next` o equivalente.
- 🔲 Crear `locales/es.json` y `locales/en.json`.
- 🔲 Extraer todos los strings de UI a las locales.
- 🔲 Toggle de idioma en settings.
- 🔲 Detección de idioma del input para los generators de IA.
- 🔲 Estructura preparada para agregar idiomas adicionales sin refactor.

## ✅ Capa LLM y agentes con LLM real (Fase 5 cerrada)

Capa LLM + 3 personalidades + memoria persistente + 115 tests Fase 5. GlobalLLMQueue, cost caps multi-capa, prompt caching, sanitización con world_context. Validación visual: pipeline funciona. `[PENDING-PERSONALITY-TUNING]` loggeado para sesión post-gameplay.

- ✅ **Capa LLM básica** (`src/llm/`): cliente Anthropic con streaming, mock client, factory, cost tracker, queue, sanitize.
- ✅ Settings UI para API key (integrado al toolbar).
- ✅ **Action schemas** (Zod) y action handlers (stub mínimo SAY).
- ✅ **AgentBrain** con `speak(target, context)` + streaming.
- ✅ **Personalidades concretas** (3 base): ceo-pretender, junior-overconfident, intern-anxious.
- ✅ **Streaming bubbles**: speech aparece word-by-word.
- ✅ **Trigger automático de encuentros**: agentes adyacentes hablan (`triggers.ts`).
- ✅ **Persistencia de memoria** en localStorage con cuarentena Zod.
- ✅ **Score de importance + pruning** recencia/importancia + relationship tracking (Fase 5.1).
- 🟡 **Acciones del LLM completas** — EMOTE + LOOK_AT done; WALK_TO + decide() diferidos.
- 🟢 Personalidades adicionales (5-10): senior arrogante, RRHH, etc.

### ✅ Fase 5.1 cerrada — Encuentros con cuerpo

Conversaciones cara a cara entre dos agentes adyacentes con estado TALKING que pausa otros loops, orchestrator multi-turn (2-4 turns alternados), bubble proporcional al texto, output cap del LLM. **453 tests verdes** post-fix R1-R4.

- ✅ EMOTE handler real (`actions.applyEmoteAction`).
- ✅ LOOK_AT handler real (orientación X-relativa, convención legacy).
- ✅ Importance scoring + relationship tracking + prune wired.
- ✅ Sonnet 4.6 expuesto en UI (override global por agente desactivado).
- ✅ Output cap LLM por call: 30 tokens en encuentros (R4 fix), 100 default. FORMATO "MÁXIMO 8 palabras" cacheable en 3 personalidades.
- ✅ Bubble duration proporcional al texto: clamp 2-8s = 2000+chars\*50ms.
- ✅ AgentState TALKING: `agent.talking` + `activeConversationId` con guards quirúrgicos en pathfinding/needs.
- ✅ Conversation orchestrator (`conversation.startConversation`): try/finally robusto, lock atómico, cleanup match-id, re-check adjacency cada turn, cooldown 10s/60s según fail-turn-0, path/target cleanup post-lock + waiting=1.5s post-talk (R2 fix).
- ✅ Adjacency helper extraído (`adjacency.areAgentsAdjacent`) reusado por triggers + orchestrator. SOCIAL_ADJ_MS bajado a 2000ms (R1 fix).
- ✅ TriggerSystem.setPairCooldown público con regla "no acorta cooldown existente más largo".
- ✅ Streaming bubble single-handle (R3 fix): showSpeechBubble UNA vez con placeholder ' ', subsequent appends mutan handle.fullText. close() muta autoCloseAfter+timeRevealed sin re-crear. removeAgentBubble inyectado para limpiar listener antes de cada turn (no overlap cross-agente).
- ✅ Crisis path con lock paridad orchestrator (R1 fix): talking=true + path/target limpios + finally restaura + waiting=1.5s.
- ✅ getAgentNeed cableado en main.ts (era bug B1 detectado en review: crisis nunca disparaba en prod).
- ✅ handleAgentLanded con waiting=5s si hay otro agente adyacente (R1 fix): da ventana para acumular SOCIAL_ADJ_MS.
- ✅ Voseo→tuteo en 3 personalidades (R4 fix): cumple CLAUDE.md ("español colombiano, sin voseo rioplatense"). Examples y fallbackPhrases ≤8 palabras.
- 🔲 WALK_TO real (sigue stub para Fase 5.2+).
- 🔲 `decide()` avanzado con action catalog completo.
- 🔲 Memory consolidation con LLM (resúmenes de episodios viejos).
- 🔲 Conversaciones grupales 3+ (API extensible vía `participants[]`).
- 🔲 Personalidades adicionales según design narrativo.

**Observations de gameplay diferidas a Fase 5.1.5 (tuning de encuentros autónomos):**
- `[PENDING-ADJACENCY-TUNING]`: difícil triggerar adjacency en gameplay normal. Funciona cuando se cumple condición pero alcanzarla es estrecho con autonomy actual.
- `[PENDING-AUTONOMOUS-SPEAK-INTEGRATION]`: cuando agentes hablan sin forzar adyacencia, bubbles se cancelan rápido y no se contestan entre sí. Hipótesis: paths de speak() que no usan orchestrator (probablemente crisis trigger).

Ver `AGENTS_LLM.md` para detalle.

## 🟠 AI Orchestration: tres generators de Pablo

Las herramientas que aceleran el desarrollo.

- 🔲 **Personality Generator**: descripción → Personality completa.
- 🔲 **Cutscene Generator**: descripción → DSL compilable.
- 🔲 **World Iterator**: instrucción → modifica mundo existente.

Ver `AI_ORCHESTRATION.md` para detalle.

## ✅ DSL de cutscenes (Fase 4 cerrada)

DSL completo: parser + schema-ast + shots + camera-moves + actions + compiler + CLI + fixture + 43 tests. Pipeline end-to-end funcional. Pendientes nice-to-have loggeados: `[PENDING-TUNING-SHOTS]`, `[PENDING-FIXTURE-ZONES]`.

- ✅ Parser de markdown narrativo a AST (`src/cutscene/parser.ts`).
- ✅ Schema del AST (TypeScript + Zod en `src/cutscene/schema-ast.ts`).
- ✅ Compiler AST → cutscene model (`src/cutscene/compiler.ts`).
  - ✅ Resolver agentes y locations a IDs/cells.
  - ✅ Calcular poses de cámara desde shot types.
  - ✅ Compilar acciones a kfs.
  - ✅ Simulación temporal para resolver "camina_a X" según estado del mundo en t.
- ✅ **Shot types** implementados (`src/cutscene/shots.ts`):
  - ✅ `wide_establishing`, `medium_shot`, `close_up`, `two_shot`, `over_the_shoulder`.
- ✅ **Camera moves** (`src/cutscene/camera-moves.ts`):
  - ✅ `dolly_in` / `pull_out`, `pan`, `push_in`.
- ✅ **Agent actions** (`src/cutscene/actions.ts`):
  - ✅ `camina_a` (cell o agente), `mira_a`, `dice "..."`, `anima <preset>`, `espera <Ns>`.
- ✅ Validación con errores legibles contra Zod.
- ✅ CLI: `npm run cutscene-compile path/to/scene.md` (`scripts/cutscene-compile.ts`).
- 🟢 `[PENDING-TUNING-SHOTS]`: ajuste fino de poses por shot type post-gameplay.
- 🟢 `[PENDING-FIXTURE-ZONES]`: resolver locations a fixture zones del mundo.

Ver `CUTSCENES.md` para detalle.

## 🟡 AGENTS.INC: contenido inicial

Para tener un mundo demostrable.

- 🔲 5-10 personalidades base generadas y refinadas.
- 🔲 Mundo de oficina con layout, props, zonas.
- 🔲 5-10 cutscenes narrativas demostrando el juego.
- 🔲 Encuentros sociales LLM funcionando.
- 🔲 Mecánicas de gameplay básicas (necesidades, working state, social).

## 🟡 Tests críticos

Solo lo más sensible.

- ✅ Setup Vitest.
- ✅ `cutscene/inheritance.test.ts` — la cadena escenaRootId.
- ✅ `cutscene/schema.test.ts` + `engine/schema.test.ts`.
- ✅ `cutscene/migrations.test.ts` + `engine/migrations.test.ts`.
- 🔲 `cutscene/compiler.test.ts` — DSL → cutscene fixtures.
- ✅ `engine/coords.test.ts` — conversión grid ↔ three (18 tests).
- ✅ `engine/walls.test.ts` — placement + corners (47 tests).
- 🔲 `ai/action-handlers.test.ts` — cada action con su efecto esperado.
- 🔲 Tests E2E con Playwright (flujos críticos del editor).

---

# HORIZONTE 2 — AGENTS.INC publicado

Cuando MVP esté completo y AGENTS.INC desarrollado, antes de publicar.

## 🔲 Backend ligero

- 🔲 Setup Supabase (auth + DB + storage).
- 🔲 Schema de DB para mundos de jugadores.
- 🔲 Auth básica (email/Google).
- 🔲 LLM proxy via Cloudflare Workers (esconder API key, rate limiting).

## 🔲 Features para jugadores externos

- 🔲 Sistema de save/load de progreso.
- 🔲 Onboarding básico para usuarios nuevos del juego.
- 🔲 Settings de jugador (volumen, calidad, idioma).

## 🔲 Output compartible

- 🔲 Render MP4 vía WebCodecs.
- 🔲 Screenshots con composición automática.
- 🔲 Links públicos a partidas/mundos.

## 🔲 Mecánicas avanzadas de gameplay

Pendientes del juego que se difieren al horizonte 2:

- 🔲 **B.11 Mini-juego del working state** — reemplazar 8s estáticos con tap-fest.
- 🔲 **B.8 HeldItem dinámico** — pickup/drop visual.
- 🔲 **D.13 Construcción mediada por agentes** — muebles "en obra".
- 🔲 Pause menu, save slots múltiples.

## 🔲 Cierre del editor de cutscenes

- 🔲 Render MP4 vía WebCodecs.
- 🔲 Transiciones entre planos (modelo ya preparado).
- 🔲 Audio tracks (música + SFX).
- 🔲 Copy/paste con multi-sel (Cmd+C/V).
- 🔲 Markers/notas en timeline.

## 🔲 Marketing y publicación

- 🔲 Landing page.
- 🔲 Presencia en redes (Twitter, TikTok).
- 🔲 Trailer/demo video.
- 🔲 Lanzamiento en HN, ProductHunt.

## 🔲 Analytics básicos

- 🔲 Telemetría de gameplay (qué hacen los jugadores).
- 🔲 Crash reporting.
- 🔲 LLM cost monitoring.

---

# HORIZONTE 3 — CWE como producto

Largo plazo y opcional. Ver `PRODUCT_FUTURE.md`.

## 🔲 Onboarding mágico

- 🔲 Canvas vacío con input que genera mundo en 60s.
- 🔲 Templates de partida (oficina, taberna medieval, etc.).
- 🔲 Tooltips contextuales con GIFs.

## 🔲 World Generator completo

- 🔲 Descripción libre → mundo de cero.
- 🔲 Composición coherente de layout + props + agentes + relaciones.
- 🔲 Templates inteligentes como base.

## 🔲 Conversation Manager

- 🔲 Memoria persistente del flow de diseño.
- 🔲 Chat lateral persistente.
- 🔲 Sugerencias de iteración contextual.

## 🔲 Asset packs adicionales

- 🔲 Medieval pack (taberna, dungeon, castillo).
- 🔲 School pack (aula, recreo, biblioteca).
- 🔲 Sci-fi pack (estación espacial, lab).
- 🔲 Sistema de carga dinámica de packs.

## 🔲 Object Builder con IA

- 🔲 Descripción de objeto → mesh 3D low-poly.
- 🔲 Pipeline de optimización.
- 🔲 Storage de assets de usuario.
- 🔲 Iteración del objeto generado.

## 🔲 Marketplace y comunidad

- 🔲 Mundos públicos compartibles.
- 🔲 Sistema de remix.
- 🔲 Likes, comentarios.
- 🔲 Asset pack store con revenue share.

## 🔲 Modelo de negocio

- 🔲 Tiers de pricing (Free / Hobby / Pro).
- 🔲 BYOK alternativo.
- 🔲 Educational tier.
- 🔲 Stripe integration.

## 🔲 Internacionalización profunda

- 🔲 Idiomas adicionales (pt, fr, etc.).
- 🔲 Localizaciones culturales.

## 🔲 Engine improvements

- 🔲 **Dirty rebuild de paredes** (solo cells afectadas).
- 🔲 **Parent/child stacks de meshes** (reducir draw calls).
- 🔲 **Pathfinding cacheado**.
- 🔲 **Grids no cuadrados** (formas en L, T).
- 🔲 **Múltiples pisos verticales**.
- 🔲 **Render quality switcher** (toon flat / stylized / cinematic).

## 🔲 Editor improvements

- 🔲 **Transiciones entre planos** (fade, dissolve, wipe).
- 🔲 **Audio tracks** en cutscenes.
- 🔲 **Copy/paste con multi-sel** (Cmd+C/V).
- 🔲 **Markers/notas** en timeline.
- 🔲 **Round-trip DSL ↔ editor**.

---

# ✅ Hecho (referencia histórica)

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
- ✅ v1.45.1: fix lasso, group drag con refs, shift+click toggle.

Ese fue el cierre del monolito antes de migración a Vite + TS.

---

## Decisiones pendientes (preguntar a Pablo)

Cosas donde no hay decisión tomada y conviene resolverlas antes de codear:

- Versión de Three.js al migrar (r128 actual o última estable).
- Formato exacto del DSL: **markdown narrativo** (decidido el 2026-04-27).
- Estrategia de export de mundos (JSON al filesystem cuando MVP esté listo).
- Estructura final de assets (texturas, sonidos): ¿cómo se organizan, cómo se cargan?
- Nombre del package npm si CWE eventualmente se publica como tal.

---

Este archivo se actualiza con cada sesión. Antes de empezar a trabajar, léelo y verifica que la prioridad sigue siendo lo que está marcado 🟠.
