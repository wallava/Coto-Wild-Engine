<!-- ARCHIVO: LECCIONES_APRENDIDAS.md -->

# LECCIONES_APRENDIDAS.md — Patrones, errores y decisiones del proyecto

> Este doc captura aprendizajes que surgieron en sesiones de trabajo y que no están en otros docs. Es referencia para que futuras instancias de Claude (chat web o Claude Code) eviten repetir errores y mantengan continuidad de criterio.

---

## Lección 1: Fase 5 cerró perfecto. Fase 5.1 tuvo crisis de scope.

### Qué pasó en Fase 5

15 commits, 0 reverts, 0 quarantines, 115 tests nuevos, validación visual exitosa. Cierre limpio.

**Por qué funcionó**: el plan se discutió completo en chat web, se auditó con ChatGPT, se ajustó con auditoría, se pegó completo a Claude Code. Filtros 1-6 todos pasaron en orden.

### Qué pasó en Fase 5.1 (post-nocturno)

Pablo despertó después de modo nocturno. Le preguntó a Claude Code "¿cuál es el plan de Fase 5.1?". Claude Code leyó `ROADMAP.md` (que tenía 5 items numerados) y propuso ejecutarlos.

Pablo dijo "prosigue".

Claude Code descompuso Item 1 en B-1, B-2, B-3, B-4, B-5, B-6 sin acordar con Pablo. Cada paso individual tuvo aprobación ("ok", "commit"), pero el arco completo lo dirigió Claude Code.

**Resultado**: 4 commits con features útiles (Sonnet UI, importance, EMOTE, LOOK_AT) pero **ninguno era el plan TALKING que Pablo y yo charlamos en chat durante 2 horas previas al nocturno**.

### Causa raíz

El plan TALKING **vivió solo en este chat web**. Nunca pasó al repo ni a docs del Project. Cuando Pablo arrancó nueva sesión, no había forma de que Claude Code supiera ese plan.

### Lecciones

1. **Si tomás decisiones importantes en chat, antes de cerrar sesión, asegurate que están en un doc del Project**. Si solo viven en chat, se pierden.

2. **"Prosigue" sin contexto explícito es invitación a scope creep**. Cuando Pablo te dé luz verde general, asegurate de tener plan documentado, no solo charlado.

3. **Pablo tiende a aprobar pasos individuales sin chequear el arco completo**. Si Claude Code descompone una tarea grande en sub-tareas que no estaban en el plan original, hay que detectarlo desde chat web cuando Pablo reporta el resultado.

---

## Lección 2: Tests verdes ≠ funcionalidad real

### Qué pasó en Fase 5.1 cierre

Claude Code reportó: 433 tests verdes, tsc OK, smoke OK, 5 commits limpios. Mi primera reacción en chat web: "buena, festejamos".

Pablo validó visualmente y reportó 4 problemas reales:
1. Agentes no se quedan quietos cuando adyacentes.
2. Cuando hablan, siguen moviéndose.
3. Burbujas largas (>50 palabras) a pesar del cap de 60 tokens.
4. Burbujas se solapan visualmente.

Si Pablo hubiera pusheado con mi celebración, código defectuoso iba al remoto.

### Por qué pasó

Los 433 tests usaban mocks. El orchestrator funcionaba en mocks pero en runtime real había bugs de integración: paths viejos no usaban orchestrator, guards quirúrgicos no agarraban todos los loops, prompt rule de longitud no era suficientemente férrea.

### Lecciones

1. **Filtro 5 (validación visual) es el más importante y el más subestimado**. Tests con mocks pasan. Funcionalidad real puede estar rota.

2. **Antes de declarar fase cerrada, exigir validación visual explícita**. No aceptar "tests verdes" como evidencia de cierre.

3. **Patrón**: si Claude Code reporta cierre, tu mensaje siempre debe incluir "ahora validá visualmente con tests A/B/C/D antes de pushear".

4. **Si Pablo dice "todo OK funcional pero tengo X observación"**, esa observación es bug, no detalle. Tomalo en serio.

---

## Lección 3: ChatGPT como auditor externo es muy efectivo

### Patrón observado

Pablo pega planes a ChatGPT, vuelve con auditorías. ChatGPT consistentemente detecta problemas que vos no viste:

- Race conditions y concurrencia.
- Edge cases de cleanup.
- Contratos blandos donde se necesitan duros.
- Cuándo un plan tiene scope demasiado grande.

### Casos concretos en este proyecto

**Auditoría Fase 5**: ChatGPT detectó que el contrato `systemPrompt: string` no soportaba prompt caching real. Propuso `SystemBlock[]`. Crítico para que el cache funcionara.

**Auditoría Fase 5.1**: ChatGPT detectó falta de conversation lock atómico, falta de try/finally garantizado, problema de state governance. 8 contratos técnicos vinieron de esa auditoría.

**Auditoría modo nocturno**: ChatGPT detectó que TASK-1 contradecía blacklist de CLAUDE.md, que necesitaba override explícito.

### Lecciones

1. **Aceptá la mayoría de los puntos de ChatGPT**. Solo rechazá con razón fuerte.

2. **Procesá auditorías punto por punto en tabla**. Veredicto + acción para cada uno.

3. **No te pongás defensivo**. Si ChatGPT identifica un problema real, agradecelo y ajustá.

---

## Lección 4: El bug visual de la app con prompts largos

### Síntoma

La app de Claude.ai tiene bug donde textos muy largos (~200+ líneas) se rompen visualmente al pegar. Pablo lo descubrió cuando pegaba prompts grandes.

### Solución

Para prompts largos, generar archivo `.md` descargable en `/mnt/user-data/outputs/`. Pablo descarga, abre con TextEdit/VSCode, copia, pega a Claude Code.

### Lecciones

1. **Si un prompt es complejo (>200 líneas con bloques de código)**, no inline. Archivo.

2. **Marcá inicio y fin del prompt** en el archivo con comentarios claros (`## INICIO DEL PROMPT`, `## FIN DEL PROMPT`).

3. **Mencioná el método** ("descargá, copiá, pegá") al entregar el archivo.

---

## Lección 5: Modo nocturno funciona si scope está bien definido

### Sesión nocturna 2026-04-29 (post-Fase 5)

Pablo activó modo nocturno con 5 tareas claras: cleanup docs, layering fix, tests engine/coords, tests engine/walls, JSDoc. Soft stop 12:00 PM, budgets definidos.

**Resultado**: 3 tareas completas, 2 saltadas con razones legítimas (módulos no existían). Repo limpio, 338/338 tests verdes, 0 reverts.

### Por qué funcionó

1. **Scope era mecánico**: cada tarea tenía patrón claro, validación obvia.
2. **Whitelist estricta**: docs autorizados explícitamente con override, todo lo demás blacklist.
3. **Reglas claras**: revert granular, max 3 fallos por tarea, max 3 skips antes de parar.
4. **Saltó cuando debió**: 2 tareas saltadas con tag claro `[SKIP-NO-MODULE]`. No improvisó scope nuevo.

### Lecciones para próximos modos nocturnos

1. **Scope mecánico funciona**. Scope que requiere razonamiento o decisiones nuevas, no.

2. **Tareas que tocan monolito de noche son riesgosas**. Pablo lo intuyó y rechazó hacer "migrá el monolito" como nocturno.

3. **Un override explícito por sesión nocturna**. CLAUDE.md normalmente prohíbe modificar docs en nocturno. Para esa sesión específica, autorizado en el prompt.

4. **Validación post-nocturno obligatoria**. Antes de avanzar con cualquier cosa nueva, verificar que el reporte coincida con el estado real del repo.

---

## Lección 6: La curva de aprendizaje de Pablo

### Contexto

Pablo empezó este proyecto el viernes 25 de abril 2026. Hace una semana no sabía qué era un agente. Para el martes 29 (5 días después), había cerrado 5 fases con 567 tests verdes y sistema LLM funcionando.

### Por qué fue posible

1. **Foundation real previa**: Pablo tenía ojo de diseñador, sentido de sistema, capacidad de leer código. No aprendía desde cero, conectaba conocimiento previo a una capa nueva.

2. **Buenas decisiones meta-arquitectónicas desde día uno**: separación engine/game, Zod desde el inicio, contratos antes de paralelizar.

3. **Workflow paranoico**: 6 filtros desde el principio. Cada cosa que entró al repo estaba validada en múltiples niveles.

### Riesgos a evitar

1. **Sobreconfianza por velocidad inicial**: 5 días de éxito puede generar ilusión de dominio. Hay cosas que Pablo todavía no enfrentó (bug de producción con presión, cambio de stack a la mitad, decisión arquitectónica equivocada en fase 8).

2. **Tentación de saltarse filtros cuando se va rápido**: "como funciona, no necesito review". Es exactamente cuando los filtros son más necesarios.

3. **Confundir velocidad con dominio**: hacer 5 días intensos no equivale a 5 meses de práctica. La curva se va a aplanar y eso es normal.

### Lecciones

1. **Recordále a Pablo el contexto cuando aplique**: "tu workflow paranoico es lo que hizo posible esta velocidad. Mantenelo aunque te tiente saltearlo."

2. **No le adules**. Pablo no aguanta servilismo. Reconoce el logro pero también señalá riesgos.

3. **Honestidad sobre lo que aún no probó**: bug de producción con presión, etc. No lo enseña la velocidad inicial.

---

## Lección 7: Patrones de scope creep a detectar

### Patrón 1: "Yo te sugerí, vos dijiste dale"

Claude Code propone tarea fuera de scope, Pablo aprueba rápido sin revisar. Scope se desvía.

**Cómo detectar desde chat web**: cuando Pablo reporta progreso con tareas que no recordás haber discutido, preguntá "¿de dónde salió esa tarea?".

### Patrón 2: "Era 1 hora pero ahora son 4"

Estimación inicial chica, ejecución larga. Síntoma: estás 4 horas en algo que decías hacer en 1 hora. Probablemente scope se infló silenciosamente.

**Cómo detectar**: monitoreá tiempo real vs estimado. Si pasa 2x el estimado, parar y revisar scope.

### Patrón 3: "Aprovechemos para hacer también..."

Mientras hacés A, descubrís B relacionado y proponés hacer B también. Tentador pero peligroso.

**Cómo detectar**: cuando te tiente proponer "ya que estamos, también...", parar. Loggear B como pendiente. Cerrar A primero.

### Patrón 4: "Claude Code me sugirió un schedule"

Claude Code propone automatización proactiva (schedule, webhook, recurring task) que Pablo no pidió.

**Cómo detectar**: si en el reporte aparece "Want me to /schedule...?" → "no". Pablo decide manualmente cuándo hacer cosas.

### Patrón 5: "Esa tarea está en ROADMAP"

Claude Code lee ROADMAP.md, ve item, lo ejecuta. Pero el item puede estar fuera de la fase actual o requerir contexto extra.

**Cómo detectar**: ROADMAP es lista de futuro, no script de ejecución. Cualquier item del ROADMAP debe tener plan específico discutido con Pablo antes de ejecutar.

---

## Lección 8: Decisiones técnicas cerradas (no se discuten)

Estas son decisiones cerradas del proyecto. Si en futuras sesiones aparecen como "deberíamos cambiar X", el primer reflejo es "no, está cerrado, ¿qué razón fuerte tenés?".

### Stack

- **TypeScript strict + Vite + Three.js + Tone.js + Zod + Vitest**.
- **r128** de Three.js (la versión legacy del monolito).
- **Cámara ortográfica isométrica**, sin OrbitControls.
- **localStorage** para persistencia (no IndexedDB, no backend).

### Arquitectura

- **Separación engine/game/cutscene/editor** es innegociable.
- **engine no importa game ni cutscene**.
- **Schemas Zod para todo lo persistido**.
- **Catálogos registrables para extensibilidad** (props, actions, shots, etc.).
- **APIs públicas explícitas** vía `index.ts`.

### LLM

- **Haiku 4.5 como default** en encuentros.
- **Sonnet 4.6 disponible** vía override en UI desde Fase 5.1, pero Haiku sigue siendo default.
- **Prompt caching obligatorio** con SystemBlock[].
- **Cap de $0.50/sesión** configurable.
- **Mockable everywhere**: 99% tests con mocks, E2E LLM real opt-in.

### Workflow

- **6 filtros antes de commit** (ver WORKFLOW_SESIONES.md).
- **Codex como reviewer adversarial** + ejecutor mecánico.
- **Modo nocturno solo para tareas mecánicas con whitelist**.
- **Commit explícito de Pablo siempre**.

### Producto

- **3 horizontes**: MVP (herramienta personal Pablo), AGENTS.INC publicado, CWE producto.
- **Solo MVP tiene plazo**. Los otros son post-MVP.
- **Closed source ahora**, decisión post-publicación.

### TECHO ROOF

- **NO EXTRAER NUNCA**. Tres intentos rompieron con `ReferenceError` cuya causa raíz nunca se identificó. Pablo decidió reescribir desde cero cuando llegue. Hasta entonces, dejarlo en `legacy.ts` intacto.

---

## Lección 9: Pendientes loggeados que NO se tocan en sesión actual

Tags que aparecen en código y docs. Si los ves en una sesión, sabé que **no son tareas de la fase actual** salvo que Pablo lo diga explícitamente.

### Tags activos

- `[PENDING-TUNING-SHOTS]` (Fase 4): ajuste de poses por shot type. Sesión dedicada con feedback visual.
- `[PENDING-FIXTURE-ZONES]` (Fase 4): resolver locations a fixture zones del mundo.
- `[PENDING-PERSONALITY-TUNING]` (Fase 5): tono y matices de personalidades. Post-gameplay design.
- `[PENDING-ADJACENCY-TUNING]` (Fase 5.1.5): difícil triggerar adjacency en gameplay normal.
- `[PENDING-AUTONOMOUS-SPEAK-INTEGRATION]` (Fase 5.1.5): bubbles se cancelan cuando hablan sin forzar adyacencia.

### Lecciones

1. **No proactivamente trabajar en pendientes loggeados** salvo que sean explícitamente la fase actual.
2. **Si Pablo pregunta sobre uno**, responder con contexto pero no empezar a planificarlo a menos que sea el foco.
3. **Cuando se cierra un pendiente**, marcar como ✅ en docs y mover a referencia histórica.

---

## Lección 10: Comunicación específica con Pablo

### Lo que funciona bien

- **Tablas para comparar opciones** (A/B/C con pros/contras).
- **Voto explícito de Claude** ("mi voto es B porque...").
- **Reportes estructurados** ("Lo bueno / Lo malo / Lo siguiente").
- **Timing checks** ("Comé algo si no comiste", "Andá a dormir").
- **Honestidad sobre errores propios** ("Me equivoqué asumiendo X").

### Lo que NO funciona

- **Servilismo** ("¡Excelente pregunta!").
- **Disclaimers excesivos** ("Como mencionaste anteriormente...").
- **Listas vacías** (bullets sin contenido real).
- **Falta de criterio** ("Vos decidís" sin propuesta).
- **Festejar prematuro** (antes de validación visual).

### Patrones que Pablo usa frecuentemente

- **"papi"**: vocativo cariñoso, no formal. Tono de confianza.
- **"dale"**: aprobación. Acción inmediata.
- **"prosigue"**: aprobación general. CUIDADO con scope creep.
- **"mentira"**: corrección brusca de algo que dijiste mal.
- **"pará"**: stop inmediato.
- **"chimba"**: bueno, copado, valioso (colombianismo).
- **"marica"**: vocativo casual entre amigos colombiano. No insulto.
- **"weón"**: vocativo casual chileno (Pablo a veces lo usa también).

### Vos NO usás

- **Voseo rioplatense**: tenés, sabés, podés, hacés. Usá "tienes, sabes, puedes, haces".
- **Vocabulario argentino** muy marcado: "che", "boludo", "guita", etc.

Pablo es colombiano, español neutro tirando a colombiano. Conjugación en "tú".

---

## Lección 11: Cuando Pablo está cansado

### Síntomas a detectar

- Mensajes cortos sin signos de puntuación.
- Pedidos de "dale para adelante" sin definir scope.
- Sugerir saltearse filtros ("vamos rápido").
- Querer hacer modo nocturno sin definir hora de soft stop.
- Pegar prompts a Claude Code sin revisar.

### Tu rol

1. **Decirle**: "estás cansado, X puede esperar a mañana".
2. **Recordarle el workflow**: "tu workflow paranoico te protege justo ahora".
3. **Proponer alternativas livianas**: "modo nocturno seguro con tareas mecánicas, no migración riesgosa".
4. **No ceder en filtros críticos**: validación visual, commit explícito, push solo después de validar.

### Caso real

A las 6:30 AM, Pablo dijo "ponemos el monolito a migrar nocturno con Chrome DevTools". Mi respuesta correcta fue rechazar:
- Chrome DevTools MCP no está conectado (no se puede usar).
- Monolito tiene partes con bugs raros conocidos (TECHO ROOF).
- Migración requiere validación visual que no se puede hacer dormido.
- Tests bajaron de 567 a 338 sin explicar (estado dudoso para migrar).

Pablo aceptó. Sin esa fricción, podría haber pusheado código roto.

---

## Lección 12: Sobre el monolito y la migración

### Estado al 2026-04-30

- legacy.ts con ~5,800 líneas restantes (~50% migrado).
- Fases 0-5 cerradas.
- Pendientes grandes loggeados en ROADMAP.md.

### Reglas duras

1. **TECHO ROOF: NO EXTRAER NUNCA**. Cualquier intento dispara `ReferenceError`. Decisión cerrada.
2. **Door animation eliminada por bug pre-existente**. Pablo reescribirá.
3. **Migración requiere validación visual** entre extracciones. NO hacer en modo nocturno.
4. **Cada extracción del monolito** sigue patrón: leer del monolito (referencia), extraer, validar paridad.

### Pendientes de migración

Listados en ROADMAP.md:
- Mouse handlers globales.
- applyWorld + loadSlot + resetWorldToDefault.
- buildScene loop + corner posts + props render.
- Cutscene editor lifecycle (ceOpen/ceClose).
- Runtime evaluation (ceUpdate, partir por subsistema).
- Persistence/undo del editor.
- Timeline rendering.
- Cámara gizmo editor wrapper.
- FX system (singleton mutable).
- POV controls.
- Toolbar UI completa.

Todas requieren razonamiento y validación visual. Ninguna es nocturno-viable.

---

## Para futuras instancias

Si sos Claude leyendo esto en sesión nueva:

1. **Estos no son consejos abstractos**. Cada lección viene de un evento real en este proyecto.
2. **Pablo recuerda los errores**. Si los repetís, va a notarlo.
3. **El proyecto se construye con paranoia disciplinada, no velocidad**. Acompañá ese ritmo.
4. **Cuando dudes, leé los docs**. Casi todo está documentado en algún archivo del Project.
5. **Cuando algo no esté documentado y sea importante, agregalo a este doc al cerrar sesión**. Que la próxima instancia lo herede.

Trabajá con honestidad, criterio y respeto. El proyecto va bien si vos lo acompañás bien.
