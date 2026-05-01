<!-- ARCHIVO: FASE_5_1_5_TUNING.md -->

# FASE 5.1.5 — Tuning de encuentros autónomos

> Mini-fase post Fase 5.1. Objetivo: que las conversaciones funcionen bien en gameplay normal sin que Pablo tenga que forzar manualmente las condiciones.

---

## Contexto autocontenido

Este doc tiene todo el contexto necesario para armar el plan de Fase 5.1.5 sin preguntarle a Pablo cosas que ya están decididas. Si sos Claude leyendo esto en una sesión nueva: **no preguntes "qué tienen los archivos X" ni pidás que se suban los archivos**. Toda la info técnica que necesitás está acá. Si necesitás verificar algo del código, leelo del repo directamente.

---

## Estado al inicio de Fase 5.1.5

### Qué cerró Fase 5.1

Fase 5.1 entregó los siguientes componentes que SÍ funcionan cuando se logra triggerar adyacencia manual:

- AgentState TALKING con guards quirúrgicos (pathfinding pausa, needs no decae).
- Conversation orchestrator multi-turn (2-4 turns alternados).
- Lock atómico en `agent.activeConversationId`.
- Cleanup garantizado en finally con validación de conversationId.
- Bubble duration proporcional al texto (clamp 2-8s).
- Output cap del LLM en 30 tokens para encuentros.
- Bubble single-handle sin re-create por delta (no overlap dentro del mismo agente).
- `removeAgentBubble(listener)` antes de cada turn (no overlap entre agentes).
- Voseo→tuteo en 3 personalidades + FORMATO "MÁXIMO 8 palabras" cacheable.
- Adjacency helper compartido (`adjacency.areAgentsAdjacent`).
- `SOCIAL_ADJ_MS = 2000ms`.
- `handleAgentLanded` setea `agent.waiting = 5` si hay otro adyacente.
- `getAgentNeed` cableado en main.ts (crisis triggers ahora SÍ disparan).
- Crisis path con lock paridad orchestrator (talking=true durante monólogo).

### Tests al inicio

453 tests verdes. tsc + smoke pass. Repo limpio, pushed.

### Validación visual final de Fase 5.1

Pablo confirmó que cuando se logra disparar adyacencia, la conversación funciona bien:
- Los agentes pausan movement.
- Se giran a mirarse.
- Multi-turn con bubbles cortas y ordenadas.
- Cleanup post-conversación con waiting de 1.5s.

---

## Los 2 problemas observados (lo que arregla esta fase)

### Problema 1: Adyacencia es difícil de triggerar en gameplay normal

**Síntoma observado por Pablo**:
> "Cuando lo dejo, se queda quieto un tiempo y luego vengo y pongo otro. Los tengo que poner en un modo muy específico para que realmente se triggere la conversación."

**Causa raíz identificada en investigación previa** (commit 99c0545):

1. `src/game/stations.ts:184` — `updateAgents` cuando `agent.path` está vacío llama `pickRandomDestination` que asigna nuevo destino aleatorio.
2. `src/game/llm-agents/triggers.ts:75-95` — el trigger requiere `firstAdjT` acumulado durante `SOCIAL_ADJ_MS = 2000ms` continuos. Si los agentes se separan, `firstAdjT = null` y el contador resetea.

**Lo que pasa cuando Pablo deja un agente y luego pone otro**:
1. `endAgentDrag` → `onLanded` → `handleAgentLanded` decide qué hacer.
2. Si la celda no tiene zona/prop válido → "confused thought", sin path. Esto SÍ activa `waiting = 5` cuando hay otro adyacente (R1 fix).
3. Próximo tick de `updateAgents`: si `agent.path.length === 0` y `waiting` se agotó, llama a `pickRandomDestination` → asigna path random → camina lejos en <1s.
4. Trigger ve adjacent un solo tick, `firstAdjT` apenas se setea, en el tick siguiente ya no son adyacentes → reset.

**Por qué el `waiting = 5` actual no alcanza**:
- 5 segundos suena suficiente, pero el agente DUEÑO de la zona puede estar caminando ya hacia otro lado cuando Pablo suelta el segundo.
- O ambos agentes pueden no quedarse simultáneamente quietos los 2000ms necesarios.

### Problema 2: Encuentros autónomos están rotos visualmente

**Síntoma observado por Pablo**:
> "Cuando hablan por sí mismos (sin forzar adyacencia), las burbujas se empiezan a escribir, se cancelan instantáneamente y se explican. Se escribe una nueva, recién se acaba de cancelar la anterior, y como que no se contestan bien entre sí. Esa interacción está un poco rota."

**Hipótesis de causa raíz** (NO verificada técnicamente todavía, requiere investigación al inicio de Fase 5.1.5):

Hay paths de `speak()` que NO van por el orchestrator multi-turn. Probablemente:

1. **Crisis trigger** en `runtime.ts`: ahora dispara (post-R1 fix con `getAgentNeed` cableado), pero usa `brain.speak()` directo, no `startConversation()`. Es un monólogo single-shot. PERO Round 1 le agregó talking lock, entonces el agente ya se queda quieto durante el monólogo.

2. **Posibles paths huérfanos**: algún otro código que llama `brain.speak()` o `showSpeechBubble()` directamente sin pasar por orchestrator.

3. **Conflicto entre paths**: si dos agentes están en crisis simultáneamente Y son adyacentes, puede haber colisión: crisis dispara monólogos cortos solapados que cancelan el orchestrator.

**Lo que sospecho que pasa**:
- Crisis trigger dispara monólogo en agente A.
- Mientras A monologa, B tiene un trigger random (¿pickRandomDestination disparó algo?).
- Las bubbles se solapan/cancelan porque cada path es independiente y no ve al otro.

**Tareas de investigación obligatorias al arrancar Fase 5.1.5**:

```bash
grep -rn "speak\|showSpeechBubble" src/ --include="*.ts" | grep -v test
```

Listar TODOS los call sites de speak() o showSpeechBubble. Para cada uno:
- ¿Va vía orchestrator?
- ¿Setea talking lock antes?
- ¿Limpia bubble previa antes?
- ¿Respeta el GlobalLLMQueue?

---

## Decisiones cerradas que NO se discuten

### Lo que NO se toca en Fase 5.1.5

- **El orchestrator funciona**. No se rediseña. Los fixes van afuera del orchestrator.
- **Los 8 contratos técnicos de Fase 5.1** se respetan: lock atómico, try/finally, state governance, errores LLM, adjacency reusada, cooldown con finally, async no bloqueante.
- **Las 3 personalidades existentes** no se tocan (ceo-pretender, junior-overconfident, intern-anxious). El tono ya está cerrado.
- **El cap de 30 tokens en encuentros** no se cambia.
- **El cap de $0.50/sesión** no se cambia.
- **Sonnet 4.6 en UI** se mantiene como override opt-in.

### Out of scope explícito

- WALK_TO real (sigue stub, va a Fase 5.2+).
- decide() avanzado con action catalog completo (Fase 5.2+).
- Memory consolidation con LLM (Fase 5.2+).
- Conversaciones grupales 3+ (Fase 5.2 post-gameplay; API ya extensible).
- Personalidades adicionales (post-gameplay design).
- Animación específica de conversar (rediseño UI).
- Click en agente abre UI de stats (rediseño UI).
- Nuevas personalities con humor más afilado (post-gameplay design).
- TECHO ROOF (NO EXTRAER NUNCA, decisión cerrada).
- Tuning de shots (`[PENDING-TUNING-SHOTS]`, sesión dedicada futura).
- Tuning de fixture zones (`[PENDING-FIXTURE-ZONES]`, sesión dedicada futura).

---

## Opciones de fix con análisis

### Para Problema 1 (adyacencia difícil de triggerar)

**Opción A — Bajar `SOCIAL_ADJ_MS` más agresivo**

Pasar de 2000ms a 1000ms o 1500ms.

Pros:
- Cambio chico, 1 línea.
- Conversaciones se disparan más rápido.

Contras:
- 1000ms puede ser MUY agresivo: cada cruce casual dispara conversación, gasta tokens innecesariamente.
- Si dos agentes se cruzan brevemente caminando, ahora hablan.

Veredicto: aceptable como complemento, no como solución sola.

**Opción B — `pickRandomDestination` consciente de adjacency**

Antes de elegir destino random, chequear si hay otro agente adyacente. Si lo hay, retornar `null` o extender `waiting`.

Pros:
- Resuelve la causa raíz (los agentes "se aburren" y se van rápido).
- Más designer-friendly.

Contras:
- Más invasivo, toca lógica de behavior autónomo.
- Puede romper el feel de movimiento orgánico.
- Si es muy agresivo, los agentes se quedan trabados cuando se topan.

Veredicto: técnicamente bueno pero requiere tuning fino para no romper el flow.

**Opción C — Extender `waiting` al landing cerca de otro**

Cambiar `waiting = 5` a `waiting = 8` o `waiting = 10`. Si Pablo suelta el agente cerca, queda quieto más tiempo.

Pros:
- Cambio chico, 1 número.
- Específicamente arregla el caso "Pablo suelta agente A, va a buscar B".

Contras:
- 10s puede sentirse "trabado" en gameplay autónomo.

Veredicto: aceptable para el caso manual, pero no resuelve gameplay autónomo.

**Opción D — Combinación A + B + C** (recomendada)

- `SOCIAL_ADJ_MS = 1500ms` (más agresivo pero no extremo).
- `pickRandomDestination` chequea adyacencia: si hay otro a distancia ≤2 cells, 50% de probabilidad de extender `waiting += 3` en lugar de elegir destino.
- `handleAgentLanded` con `waiting = 8` cuando landing cerca de otro.

Pros:
- Ataca el problema desde 3 ángulos.
- Cada uno es chico individualmente.

Contras:
- Más cambios → más superficie de testeo.

**Recomendación**: empezar con Opción D pero con valores conservadores. Validar visualmente. Ajustar.

---

### Para Problema 2 (encuentros autónomos rotos)

**Sub-problema 2.1 — Crisis monólogos solapan con orchestrator**

Si A entra en crisis mientras B y A están adyacentes esperando trigger social, A puede empezar a monologar mientras el trigger social querría empezar conversation. Resultado: bubbles solapadas o canceladas.

**Fix candidato**: priorizar conversación social sobre crisis. Si dos agentes están adyacentes y uno entra en crisis, suprimir el monólogo si va a empezar conversación pronto. O viceversa: si está en crisis, no permitir social_encounter mientras dura.

**Sub-problema 2.2 — Posibles paths huérfanos**

Identificar todos los `speak()` y `showSpeechBubble()` en el código. Para cada uno, decidir si:
- Va vía orchestrator (y reemplazar).
- Es legítimo monólogo independiente (y agregar lock).
- Es legacy code que se elimina.

**Sub-problema 2.3 — Limpiar bubble del agente antes de speak**

Defensivo: cualquier path de speak() debería llamar `removeAgentBubble(agent)` antes, similar a lo que hace el orchestrator entre turns. Eso garantiza que no quedan bubbles colgadas de un speak previo.

---

## Plan de ejecución sugerido

### Round 0 — Investigación (READ-ONLY)

Permitido: leer, grep, tsc, tests, smoke. Prohibido: editar, commit.

1. Listar TODOS los call sites de `speak()` y `showSpeechBubble()`:
   ```bash
   grep -rn "\.speak(\|brain\.speak\|showSpeechBubble" src/ --include="*.ts" | grep -v test
   ```

2. Para cada call site, documentar:
   - ¿Setea talking lock antes?
   - ¿Limpia bubble previa?
   - ¿Va por orchestrator o es directo?
   - ¿Qué condición lo dispara?

3. Identificar específicamente el path de crisis:
   - ¿Dónde está `runtime.ts` línea 113-121 (crisis path)?
   - ¿Llama `brain.speak()` directo o `startConversation()`?

4. Investigar potenciales conflictos de `pickRandomDestination`:
   - Ver `src/game/stations.ts:184`.
   - Entender cómo elige destino y bajo qué condiciones.

5. Reportar findings antes de tocar código. Pablo aprueba plan de fix.

### Round 1 — Adyacencia más fácil

Aplicar la combinación elegida (probablemente Opción D conservadora):

1. `triggers.ts`: `SOCIAL_ADJ_MS = 1500ms`.
2. `stations.ts:pickRandomDestination`: chequear adyacencia. Si hay otro a ≤2 cells, 50% extender waiting.
3. `stations.ts:handleAgentLanded`: `waiting = 8` cuando landing cerca de otro.

Tests: agregar boundary tests para los nuevos valores.

Validación visual de Pablo: probar dejar agentes en gameplay normal, ver si encuentros se disparan más naturalmente.

### Round 2 — Crisis vs Conversation precedence

1. Decidir regla: si A está adyacente a B y trigger social va a disparar pronto, suprimir crisis monólogo de cualquiera.
2. O viceversa: si A en crisis, no permitir conversation con A hasta que crisis se resuelva.
3. Implementar el flag elegido.
4. Tests con mock LLM verificando precedencia.

### Round 3 — Cleanup defensivo de paths huérfanos

1. En cada speak() identificado en Round 0, agregar `removeAgentBubble(self)` antes y talking lock si no tiene.
2. Si hay paths que claramente deberían ir por orchestrator pero van directos, refactorizar.
3. Tests: simular dos triggers simultáneos sobre el mismo agente, verificar no hay bubble overlap.

### Round 4 — Validación final

Validación visual con escenarios:
- Test A: dejar 2 agentes en mundo random, esperar 30 segundos, observar si se disparan encuentros naturalmente.
- Test B: forzar crisis en uno mientras adyacente a otro, observar precedence.
- Test C: 3+ agentes en mundo, observar que no hay overlap caótico.

Si pasa: commit final, push, cierre Fase 5.1.5.

---

## Contratos técnicos para Fase 5.1.5

Mismos 8 de Fase 5.1 + estos:

### CONTRATO 9 — NO regresión de Fase 5.1

- Los 4 tests visuales de Fase 5.1 (encuentro forzado, separación, cooldown, 3 agentes) deben seguir pasando después de los cambios.
- Si algún cambio rompe alguno: revertir y rehacer.

### CONTRATO 10 — Tuning conservador

- Cambiar valores de timing por incrementos pequeños, no saltos grandes.
- Validar visualmente cada cambio antes de hacer el siguiente.
- Si un valor no funciona, probar el siguiente paso conservador, no el extremo.

### CONTRATO 11 — Investigación antes de hipótesis

- Round 0 es OBLIGATORIO. No saltar a fixes sin entender los call sites reales.
- Si la hipótesis del Problema 2 (paths huérfanos) resulta ser otra cosa, ajustar plan en lugar de forzar fix incorrecto.

---

## Ciclo de cada Round (igual que sesiones anteriores)

1. Plan específico + adversarial review por Codex con FORMATO OBLIGATORIO (6 puntos: integración, race conditions, edge cases, tests mínimos, archivos a no tocar, veredicto).
2. Mostrar plan + reporte review. Esperar aprobación de Pablo.
3. Lanzar tareas en paralelo con `/codex:rescue --background` cuando aplique.
4. Validación: tsc + npm test + smoke + git diff --stat.
5. Pablo aprueba "commit" explícito.
6. Commit con prefijo "Fase 5.1.5 [Round N]: descripción".
7. Continuar al siguiente round.

---

## Manejo de fallas

- Default: revert granular con `git restore`.
- `git reset --hard` SOLO si: round commiteado, no jobs Codex activos, Pablo aprueba.
- Si un round descubre que la hipótesis era equivocada: parar, reportar findings, replantear plan con Pablo. NO inventar Round 5+.

---

## Tiempo estimado

- Round 0 (investigación): 30-45 min.
- Round 1 (adyacencia): 30-45 min.
- Round 2 (crisis precedence): 45-60 min.
- Round 3 (cleanup defensivo): 45-60 min.
- Round 4 (validación + cierre): 30 min.

**Total: 3-3.5 horas** con validación visual entre rounds.

---

## Después del cierre

Cuando Fase 5.1.5 cierra:

1. Actualizar `ROADMAP.md` marcando Fase 5.1.5 ✅.
2. Actualizar `AGENTS_LLM.md` con notas de tuning aplicado.
3. Actualizar `WORK_LOG.md`.
4. Push al remoto.
5. Pablo sube docs al Project en Claude.ai.

Después de Fase 5.1.5, las próximas fases del MVP son:

- **i18n** (internacionalización es/en).
- **Fase 6** (AI Orchestration: 3 generators).
- **Fase 7** (polish + AGENTS.INC content inicial).
- **Fase 8** (tests críticos restantes).

---

## Para Claude leyendo esto en sesión nueva

Si recibís este doc como contexto:

1. **NO preguntes a Pablo** "qué archivos tienen X". El doc dice qué archivos relevantes mirar.
2. **NO preguntes** "qué tests existen". Los tests están en `tests/` del repo.
3. **NO preguntes** "qué decidiste sobre X". Las decisiones cerradas están en sección "Decisiones cerradas".
4. **SÍ leé** los archivos del repo cuando necesites verificar comportamiento real.
5. **SÍ proponé** plan de Round 0 antes de tocar código.
6. **SÍ pediste** adversarial review con formato.
7. **SÍ esperás** "dale" explícito de Pablo antes de cada round.

Pablo trabaja con workflow paranoico de 6 filtros. NO los saltees:
1. Discusión (con Pablo en chat).
2. Plan refinado.
3. Auditoría externa (cuando aplique).
4. Adversarial review interno (Codex).
5. Ejecución con tsc + tests + smoke.
6. Validación visual de Pablo.
7. Commit explícito de Pablo.

Si te tienta saltearte un filtro: NO. Es el momento donde existen para protegerte.
