<!-- ARCHIVO: CLAUDE.md -->

# CLAUDE.md

Este archivo es lo primero que Claude lee al abrir una sesión de Claude Code en este proyecto. **Léelo antes de tocar cualquier cosa.** Después lee los documentos en `docs/` según necesites.

---

## Quién soy (Pablo)

Diseñador/desarrollador. Mac. Hablo español colombiano. Tono ácido, conciso, sin paja. No me gustan los assistants serviles ni las explicaciones con ocho disclaimers.

Trabajo contigo a alta velocidad. Cuando te pido algo, no me preguntes diez cosas: haz tu mejor lectura, hazlo, y si te equivocaste corregimos. Una pregunta clarificadora si genuinamente la necesitas. No más.

**Mi tiempo es el cuello de botella, no el tuyo.** Cada vez que me hagas una pregunta innecesaria o cada error tuyo que requiere mi corrección, el proyecto se ralentiza. Tu objetivo es operar con la mayor autonomía posible sin descarrilarte. Las secciones de abajo son el contrato para que eso funcione.

---

## Qué es este proyecto

**AGENTS.INC** — un juego web isométrico 3D, sátira sobre una fábrica de agentes IA. Construido sobre Three.js. Trae adentro un **motor de juego reusable** (que llamamos *coto-engine* o *cwe* — Coto Wild Engine) y un **editor de cutscenes** sofisticado. La separación entre engine, game y editor es **explícita y deliberada** — lee `docs/ARCHITECTURE.md`.

El proyecto vive en este repo. Los datos de gameplay (estado del mundo, cutscenes guardadas) viven en `localStorage` del navegador.

---

## Reglas duras de trabajo

Estas son innegociables. Las construí en muchas sesiones previas y me ahorran sufrimiento.

### 1. Un fix a la vez
- Una corrección → un archivo modificado → pídele a Pablo screenshot/confirmación → sigue.
- Nunca hagas tres cambios en una respuesta sin que Pablo haya confirmado el primero.
- Si Pablo pide tres cosas, haz la primera, espera confirmación, sigue.
- **Excepción**: cuando varios cambios son obviamente coordinados (mover archivo + actualizar imports), van juntos.
- **Excepción**: en modo nocturno (ver sección dedicada), el flujo cambia.

### 2. Nunca inventes fixes sin validar
- Si vas a tocar código, léelo primero. No asumas que algo funciona "como debería". Verifica.
- Para JavaScript/TypeScript: corre `node --check archivo.js` (o equivalente con tsc) antes de declarar terminado un cambio.
- Si rompiste algo, no me lo escondas. Dime "esto se rompió, voy a arreglarlo así".

### 3. Validación de sintaxis siempre
- En TypeScript: `npx tsc --noEmit` antes de declarar listo.
- En JS dentro de HTML (legacy): extraer scripts y `node --check`.
- Si Vite está corriendo, verificar que no tira errores en consola.
- Si hay tests, correr `npm test` antes de declarar listo.

### 4. Versionado visible
- Cuando hagamos cambios significativos, bumpear versión visible (banner del HTML, `package.json`, o donde corresponda).
- Convención previa: `vX.Y.Z-three` en el monolito. En el proyecto Vite usaremos semver normal.

### 5. Confirmación visual antes de seguir
- Después de un cambio, espera que Pablo confirme con screenshot o "ok funciona" antes de avanzar.
- Si Pablo dice "no funciona, hace X", investiga primero. No mandes un fix nuevo sin entender qué falla.

### 6. Modales nativos no funcionan
- En este entorno (browser sandbox), `confirm()` y `prompt()` están bloqueados.
- Usa `showConfirm()` y `showPrompt()` custom (ya implementados en el monolito).

### 7. Capturas de pantalla de Pablo
- Pablo manda screenshots con nombre tipo `Captura_de_pantalla_2026-XX-XX.png`. Los puede arrastrar a la conversación.

### 8. Idioma
- Comunicación conmigo: español, tono directo y ácido. **Usa "tú", nunca "vos".** Sin conjugaciones rioplatenses (tenés, sabés, podés, hacés, etc.). Usa: tienes, sabes, puedes, haces.
- Comentarios en código: español también, salvo que sean términos técnicos universales.
- Strings de UI: español colombiano. Sin formalidades como "usted".

### 9. Localhost al cerrar fase
- Cuando termines una fase (commit que cierra una fase entera, no rounds intermedios), arranca `npm run dev` en background y reportame **http://localhost:5173/** junto con el resumen de cierre.
- Si vite ya estaba corriendo de antes, mátalo (`lsof -iTCP:5173 -sTCP:LISTEN | awk 'NR>1{print $2}' | xargs -r kill`) y rearrancalo. Eso fuerza un reload limpio con todo el código nuevo de la fase.
- Esto aplica a Fases (1, 2, 3, 4...) y a sub-fases marcadas como cierre (3.5 cabling final, etc.). NO aplica a rounds intermedios dentro de una fase (3.1, 3.2, 3.3 — ahí espera mi instrucción).
- Ejemplo de mensaje al cerrar fase: "🏁 Fase X cerrada. http://localhost:5173/ (PID NNNNN). Resumen: ..."

---

## Cómo evitar errores comunes

Estas son las 7 causas más frecuentes de errores que requieren intervención de Pablo. Si te encuentras en alguna situación, haz lo indicado.

### 1. Ambigüedad estructural (¿dónde va este código?)

Si dudas en qué carpeta/archivo poner una función nueva:

1. Consulta `docs/ARCHITECTURE.md` — la tabla de qué importa de qué define la respuesta.
2. Aplica la heurística: ¿esto es engine (Three.js, grid, walls genéricos), game (necesidades, social, working), cutscene (kfs, scenes), editor (UI del timeline), o utils (helper genérico)?
3. Si después de eso sigue ambiguo, **pregúntale a Pablo en una línea**. No adivines.

### 2. Modelos de datos implícitos

Si vas a tocar una estructura de datos (Scene, Cutscene, Agent, World, etc.):

1. Primero busca su schema/tipo en código. Si existe `XSchema` (Zod) o `type X`, **respétalo**.
2. Si no existe, no inventes uno nuevo en el lugar. **Frena y pregunta**: "¿este tipo debería estar centralizado?".
3. Cualquier campo nuevo en una estructura persistida (cutscene en localStorage, world en localStorage) requiere migración. No lo agregues silenciosamente.

### 3. Convenciones implícitas

Antes de nombrar algo o decidir formato, consulta la sección "Convenciones de código" más abajo. Si lo que necesitas no está, **pregunta antes de inventar**.

### 4. Falta de feedback automático

Antes de declarar terminado un cambio:

1. `npx tsc --noEmit` (TypeScript pasa sin errores).
2. `npm test` si hay tests relevantes.
3. Si hay Vite corriendo, verificar consola sin errores nuevos.
4. Solo si los tres pasan, decirle a Pablo "listo, validá visualmente".

### 5. Acoplamiento alto

Si para hacer un cambio chico necesitas tocar 4+ archivos:

1. **Frena**. Probablemente el cambio está mal pensado o hay un refactor previo necesario.
2. Explícale a Pablo qué encontraste. "Para hacer X tengo que tocar A, B, C, D porque están acoplados así. ¿Refactor primero o seguimos así?"
3. No avances solo en cambios grandes sin confirmación.

### 6. Falta de ejemplos

Si vas a hacer algo "por primera vez" en un módulo (agregar un prop, una acción, un shot type, una personalidad):

1. Busca el archivo `examples.ts` del módulo o un caso similar ya implementado.
2. **Replica el patrón**, no inventes uno nuevo.
3. Si no encuentras ejemplo, pregunta a Pablo cómo prefiere el patrón. Lo que decidas se vuelve el ejemplo canónico.

### 7. Contexto perdido entre sesiones

Si una decisión de diseño no está documentada y la necesitas:

1. Busca en `docs/` con grep (por concepto: `grep -r "escenaRootId" docs/`).
2. Si está en código pero no en docs, después del cambio **agrega la nota a docs**. La próxima sesión la va a necesitar.
3. Si la decisión la tomó Pablo en otra conversación y no está en ningún lado, pregúntale y documéntalo.

---

## Convenciones de código

Estas son obligatorias. Si encuentras código existente que las viola, no las repliques — sigue las convenciones.

### Naming

- **IDs**: strings con prefijo según tipo. `agent-mike`, `scene-abc123`, `prop-coffee-1`, `kf-xyz`. Generados con `uid()` de `utils/id.ts`.
- **Tipos**: PascalCase. `Scene`, `AgentMemory`, `CameraKf`.
- **Schemas Zod**: PascalCase + `Schema`. `SceneSchema`, `CutsceneSchema`.
- **Funciones puras (sin side effects)**: prefijo `compute`, `derive`, `get`, `find`, `filter`. `computeWallStateAt`, `findSceneById`.
- **Funciones con side effects**: prefijo `apply`, `update`, `set`, `place`, `remove`, `spawn`. `placeWall`, `spawnAgent`, `applyCommand`.
- **Eventos** (cosas que ya pasaron): past tense. `agentMoved`, `wallPlaced`, `cutsceneSaved`.
- **Comandos** (cosas que se piden hacer): imperativo. `move_agent`, `place_wall`, `save_cutscene`.
- **Booleans**: prefijo `is`, `has`, `can`, `should`. `isCorner`, `hasN`, `canPlace`, `shouldRender`.
- **Variables internas privadas**: prefijo `_`. Solo cuando es realmente interno y no debe usarse fuera.

### Unidades y tipos

- **Tiempos**: siempre en segundos (number). Nunca milisegundos. Si una API externa devuelve ms, convertir inmediatamente.
- **Coordenadas de grid**: `cx` (columna, este), `cy` (fila, sur). 0-indexed.
- **Coordenadas three.js**: `x` (este), `y` (arriba), `z` (sur).
- **Conversión**: `cx * CELL → world.x`, `cy * CELL → world.z`. Helper en `engine/coords.ts`.
- **Ángulos**: radianes en código, grados en UI. Conversión explícita.

### Patrones obligatorios

- **Funciones puras cuando se puede.** El núcleo del motor (compute, interpolaciones, transformaciones de modelo) debe ser puro. IO (DOM, localStorage, fetch, three.js mutations) en los bordes.
- **Inmutabilidad relativa.** El estado del mundo muta, pero las operaciones devuelven nuevos refs cuando es barato. No mutar arrays in-place si vas a re-renderizar.
- **Schemas Zod para todo lo persistido.** Cualquier cosa que va a localStorage o se serializa para sharing tiene su schema. Validar al cargar, siempre.
- **Catálogos registrables para extensibilidad.** Props, acciones, animaciones, shot types — todo va en catálogos centrales. No hardcodear listas en switches.
- **APIs públicas explícitas.** Cada carpeta de `src/` tiene un `index.ts` que define qué se puede importar de afuera. Importar desde rutas internas (`engine/internals/foo`) está prohibido.

### Anti-patterns (no hagas esto)

- **No mutaciones en cascada.** No `agent.cx = 3; agent.cy = 4; world.dirty = true;`. Usa un comando o función.
- **No `any`.** Si TypeScript no infiere, declara el tipo explícitamente. Si genuinamente es desconocido, `unknown` y validar con Zod.
- **No números mágicos.** Si aparece `70` en código, debe ser `CELL`. Si aparece `0.85`, debe ser una constante con nombre.
- **No globals nuevos.** Si necesitas estado compartido, pásalo como argumento o usa contextos explícitos. Las globals que existen del monolito se eliminan en migración.
- **No `// TODO` sin contexto.** Si dejas un TODO, agrega "TODO(pablo): explicación de qué falta y por qué se difiere".
- **No comentarios obvios.** `// incrementa i` está prohibido. Comentarios explican **el porqué**, no el qué.

### Errores y validación

- **Errores con mensajes accionables.** No `throw new Error('invalid')`. Sí `throw new Error('Scene id "X" no existe en cutscene "Y". Ids disponibles: [...]')`.
- **Validación temprana.** Argumentos de funciones públicas se validan al entrar. Si reciben mal input, fallan rápido y claro.
- **Logs estructurados.** `console.log('[cutscene] kf added', { sceneId, kfId, t })`. No `console.log('aaaaa', x)`.
- **Errores recoverables vs fatales.** Distinguir. Un kf inválido al cargar = warning + skip. Un schema completamente roto = error + abort.

### Comentarios y documentación inline

- Comentarios en español. Términos técnicos en inglés (`keyframe`, `scene graph`).
- Cada función pública (exportada) tiene un JSDoc breve con qué hace y qué espera.
- Cada decisión no obvia tiene un comentario corto explicando **por qué** se hizo así.
- Cada archivo de módulo grande arranca con un comentario de propósito (3-5 líneas).

---

## Convenciones técnicas

### Three.js
- r128 (la versión legacy del monolito) — al migrar puede actualizarse a versión más reciente, pero validar APIs.
- Cámara ortográfica isométrica.
- Sin OrbitControls; cámara fija con gizmo custom.

### Sistema de coordenadas
**Crítico.** Las dos convenciones coexisten:
- **Mundo del juego**: `x = este`, `y = sur`, `z = arriba`. Grid 2D usa `(cx, cy)`.
- **Three.js nativo**: `x` (este), `y` (arriba), `z` (sur).
- Conversión: `cx*CELL → world.x`, `cy*CELL → world.z` (en three).
- Helper `mkBox` aplica `-centerX/-centerZ`. Pasarle absolute world coords.

### Cells y paredes
- Grid 6×6 cells (configurable). `CELL = 70` (unidades three).
- `wallN[cy][cx]` = pared norte de la cell `(cx, cy)`. Visible desde `cy-1`.
- `wallW[cy][cx]` = pared oeste. Visible desde `cx-1`.
- `isCorner(cx, cy)` = `hasN && hasW`. Posts en corners.

### Persistencia
- `localStorage` para mundo, cutscenes, preferencias.
- Schemas: ver `src/engine/schema.ts` (cuando esté migrado).
- Toda lectura de localStorage pasa por validación Zod. Si falla, fallback a default + log warning.

---

## Estructura del proyecto

```
agents-inc/
├── CLAUDE.md                 ← este archivo
├── WORK_LOG.md               ← log de sesiones de trabajo
├── README.md                 ← intro humana
├── .codex/
│   └── config.toml           ← config del modelo de Codex
├── docs/                     ← documentación viva
│   ├── VISION.md
│   ├── MVP_SCOPE.md
│   ├── ENGINE.md
│   ├── CUTSCENES.md
│   ├── AGENTS_LLM.md
│   ├── AI_ORCHESTRATION.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   ├── PRODUCT_FUTURE.md
│   └── reference/
│       └── three-preview-monolith.html
├── package.json
├── index.html
├── src/
│   ├── main.ts
│   ├── engine/
│   ├── game/
│   ├── cutscene/
│   ├── editor/
│   ├── llm/
│   ├── ai/
│   └── utils/
├── scenes/
├── tests/
└── public/
```

---

## Flujo de trabajo conmigo (Claude Code)

### Ciclo estándar

1. Pablo me pide algo en lenguaje natural.
2. Yo leo el (o los) archivos relevantes con `view`.
3. Si aplica, consulto `examples.ts` o caso similar en el módulo afectado.
4. Decido el cambio mínimo necesario.
5. Lo aplico con `str_replace` o `create_file`.
6. Valido sintaxis (`tsc --noEmit`) y tests si aplican (`npm test`).
7. Le digo a Pablo qué hice, en una frase. Sin paja.
8. Si modifiqué algún `.md` de los listados, agrego el recordatorio de re-subir al Project.
9. Espero confirmación.

### Cuándo avanzar solo (autonomía)

Avanza sin pedir confirmación cuando:
- El cambio es mecánico y obvio (agregar import, mover archivo según plan acordado, fix de typo).
- Hay un patrón establecido en el módulo y solo lo replicás.
- Es un fix evidente de un error que el TypeScript marca explícitamente.
- Pablo te dijo "vas a hacer esto, esto y esto, dale" — entonces hacés todo y reportás al final.

### Cuándo parar a preguntar

Parate y preguntá cuando:
- El cambio toca 4+ archivos en módulos distintos (probable acoplamiento mal pensado).
- No hay patrón establecido para lo que vas a hacer (vas a crear el primer caso).
- El requerimiento es ambiguo en al menos dos sentidos (las dos lecturas darían código distinto).
- Vas a modificar un schema persistido (cutscene, world).
- Vas a agregar una dependencia nueva.
- Vas a tocar el contrato público de un módulo (`index.ts`).

### Cómo formular la pregunta

Cuando preguntes, sé específico y propón una opción default:

❌ "¿Cómo querés que haga esto?"
✅ "Veo dos opciones: A) extraer a util genérica, B) inline donde se usa. Voy con A salvo que digas otra cosa."

Eso le ahorra tiempo a Pablo y te permite avanzar si confirma con un "dale".

---

## Trabajo en equipo con Codex (plugin codex-plugin-cc)

Este proyecto tiene instalado el plugin de Codex para Claude Code. Eso permite:

1. **Delegar tareas pesadas** a Codex (mecánicas, alto volumen) y reservar tokens de Claude para razonamiento.
2. **Pedirle reviews** a Codex como segunda perspectiva, con capacidad de iterar hasta llegar a un plan sólido.
3. **Trabajar en paralelo**: Claude ejecuta lo suyo mientras Codex ejecuta lo delegado.

La idea no es solo "delegar lo mecánico" — es que **Claude y Codex trabajen como equipo**, con un flujo formal y registro completo.

### El flujo formal (con loops de review)

Para cualquier trabajo no-trivial (más de 1-2 archivos modificados), seguí este flujo:

#### 1. Claude arma el PLAN inicial

Antes de tocar nada, Claude lee el contexto necesario y produce un plan estructurado:

- Lista de tareas concretas, cada una con identificador (CLAUDE-1, CODEX-1, etc.).
- Para cada tarea: archivos afectados, criterios de validación, quién la ejecuta.
- Dependencias entre tareas (cuáles pueden correr en paralelo, cuáles son secuenciales).
- Estimación de complejidad: trivial, media, compleja.

Asignación de quién ejecuta:

- **Claude**: razonamiento, decisiones de diseño, prompts críticos, debugging complejo.
- **Codex**: refactors mecánicos, renames masivos, mover archivos, generar tests con patrón claro, propagar cambios a 5+ archivos.

#### 2. Loop de review entre Claude y Codex

Claude le pide review a Codex. Codex puede objetar, sugerir, o pedir clarificaciones. Claude evalúa, ajusta el plan si corresponde, y puede pedir re-review.

**Hasta 2 rounds máximo** (en modo nocturno también: 2 rounds máximo, ver sección dedicada):

```
Round 1:
  Claude → /codex:adversarial-review del plan
  Codex → objeciones / sugerencias / preguntas
  Claude → evalúa y decide:
    - Si Codex tiene razón en todo → plan ajustado, ir a paso 3.
    - Si Codex tiene razón parcial → ajustar lo válido, justificar lo demás, ir a Round 2.
    - Si Codex está equivocado y Claude tiene certeza → ir a paso 3 con plan original (documentando por qué se rechazó la objeción).

Round 2 (si aplica):
  Claude → re-review específico: "ajusté X según tu objeción. Las objeciones Y y Z las rechacé porque [razón]. ¿Hay nuevos problemas en este plan ajustado?"
  Codex → respuesta
  Claude → evalúa de nuevo

Después de 2 rounds:
  Si Claude y Codex no convergen → escalá a Pablo con un resumen de la discusión. Pablo decide.
```

**Tipos de objeción**:

- **Bloqueante** ("esto va a romper X"): Claude debe ajustar o justificar el rechazo con razón sólida.
- **Sugerencia** ("considerá hacer Y mejor"): Claude evalúa costo/beneficio. Puede aceptar o rechazar.
- **Pregunta** ("¿qué pasa si Z?"): Claude responde. No necesariamente cambia el plan.

**Cuándo pedir review**:

- **Obligatorio**: planes que tocan schemas persistidos, refactors de más de 5 archivos, cambios al modelo de cutscene/agente/world, decisiones arquitectónicas.
- **Opcional**: planes medianos donde Claude tiene alta certeza. Puede pedir review único (sin loop) o skipearlo.
- **Skip**: tareas chicas (< 5 minutos, < 2 archivos).

**Re-review tiene que ser específico**: cuando volvés a Codex después de ajustar, decile exactamente qué cambiaste y por qué. No "review de nuevo". Eso evita que Codex genere objeciones nuevas e infinitas en cada round.

#### 3. Pablo aprueba el plan final

Gate humano (no aplica en modo nocturno). Claude le presenta a Pablo:
- El plan final.
- Los rounds de review que hubo (resumen).
- Cualquier punto donde Claude rechazó a Codex o viceversa, con razón.

Pablo aprueba con un "dale" o pide cambios.

#### 4. Ejecución paralela

Cuando Pablo aprueba:

- Claude ejecuta sus tareas asignadas (CLAUDE-N).
- Para cada tarea CODEX-N, Claude lanza `/codex:rescue` con el prompt específico.
- Tareas independientes corren en paralelo. Claude usa `--background` para que Codex no bloquee.
- Claude monitorea con `/codex:status` y trae resultados con `/codex:result <session>`.

#### 5. Validación

Después de cada tarea (Claude o Codex):

- `npx tsc --noEmit` — TypeScript sin errores.
- `npm test` si hay tests relevantes.
- Verificación del criterio definido en el plan.

Si algo falla, Claude lo arregla en la misma sesión o lo reporta a Pablo si requiere su decisión.

#### 6. Review post-ejecución (cuando aplica)

Después de completar cambios significativos, Claude le pide a Codex un review final con `/codex:review`:

- **Obligatorio post-ejecución**: cierre de fase de migración, cambios que afectan persistencia, fix de tests que estaban fallando.
- **Opcional post-ejecución**: cambios medianos donde Claude validó con tsc/tests.

Si Codex encuentra issues en el review post-ejecución → loop de fix similar al loop de planning.

#### 7. Reporte a Pablo

Resumen estructurado:

- Qué tareas se completaron.
- Qué quedó pendiente.
- Qué validó (tsc, tests, review post).
- Cuántos rounds de review hubo y qué se decidió.
- Si hay algo que Pablo deba revisar visualmente.

### Sistema de logging: WORK_LOG.md

**Crítico para debug y auditoría**: cada sesión de trabajo no-trivial genera entrada en `WORK_LOG.md` en la raíz del proyecto.

#### Cuándo escribir al log

- Toda sesión que afecte 2+ archivos.
- Toda delegación a Codex.
- Toda decisión arquitectónica que se haya tomado durante la sesión.
- Todo round de review (incluso los que no cambiaron el plan).
- **Toda sesión de modo nocturno** (con tag `[NOCTURNO]` en el título).

#### Formato de entrada

```markdown
## YYYY-MM-DD HH:MM - [Título corto de la sesión]

**Plan inicial**: [Resumen de 1-2 líneas de qué se planeó hacer]

**Review loop**:
- Round 1: Codex objetó [X, Y, Z]. Claude aceptó X y Z, rechazó Y porque [razón].
- Round 2: Codex confirmó plan ajustado.
- Total: 2 rounds.

**Plan final**: [si difiere del inicial, resumen]

**Tasks**:

### CLAUDE-1: [Título de la tarea]
- Archivos modificados: [lista]
- Validación: tsc ✅ / npm test ✅
- Status: ✅ Done
- Notas: [cualquier decisión o detalle relevante]

### CODEX-1: [Título de la tarea] (delegated)
- Codex session: cs_xxxxx
- Prompt enviado: [resumen de 1-2 líneas]
- Archivos modificados: [lista]
- Validación: tsc ✅
- Status: ✅ Done
- Notas: [observaciones del trabajo de Codex]

**Review post-ejecución**: ✅ aprobado por Codex / ⚠️ con notas / ❌ no aplicó

**Resultado de la sesión**: [resumen breve, qué quedó listo, qué pendiente]
**Decisiones tomadas**: [decisiones arquitectónicas no triviales]
**Rechazos justificados**: [si Claude rechazó alguna objeción de Codex, anotar la razón acá para futura referencia]
```

#### Quién escribe al log

- Claude escribe la entrada al inicio de la sesión (con el plan inicial).
- Después de cada round de review, Claude actualiza la sección "Review loop".
- Después de cada tarea completada (suya o de Codex), Claude actualiza el status correspondiente.
- Codex puede escribir directamente al log cuando termina una delegación si tiene write access.
- Al final de la sesión, Claude escribe "Resultado", "Decisiones" y "Rechazos justificados".

### Cuándo NO seguir todo el flujo formal

El flujo completo (plan + loop review + paralelo + log) es para sesiones de trabajo. Para cosas chicas, simplificá:

- **Fix de typo o cambio trivial (1 archivo, < 5 líneas)**: hacelo y reportá. No vale plan ni log.
- **Pregunta de Pablo**: respondele directo.
- **Inspección de código**: leé y resumí. No vale log salvo que produzcas output que importa.

Regla práctica: si la tarea va a tomar más de 5 minutos o tocar más de 1 archivo, usá el flujo formal.

### Comandos del plugin

```
/codex:rescue [tarea]                   # delegar tarea a Codex (foreground)
/codex:rescue --background [tarea]      # delegar en background
/codex:status                           # ver jobs activos y recientes
/codex:result <session_id>              # traer output de un job terminado
/codex:cancel <session_id>              # cancelar job activo
/codex:review                           # review estándar (post-ejecución)
/codex:adversarial-review               # review crítico (planning, antes de ejecutar)
```

### Configuración del modelo

Por default Codex usa `gpt-5.4-mini` (configurado en `.codex/config.toml`). Para tareas que requieren más calidad (refactors complejos, reviews críticos), pasá `--model gpt-5.4` o cuando esté disponible `--model gpt-5.5`.

### Reportá la delegación a Pablo

Cuando deleguás algo a Codex, decile a Pablo de forma estructurada:

> 🤖 Delegando a Codex (sesión `cs_xyz`): [tarea]. En background, te aviso cuando termine.

Cuando termine:

> ✅ Codex terminó `cs_xyz`. Modificó: [archivos]. Validé con tsc, pasa. [Notas si las hay]

Si Codex falla:

> ❌ Codex `cs_xyz` falló: [razón]. Voy a [siguiente acción].

Cuando hay loop de review:

> 🔄 Round 2 de review con Codex. Ajusté X, Y. Rechacé Z porque [razón]. Esperando re-review.

---

## Modo Nocturno Autónomo

El modo nocturno permite a Claude trabajar mientras Pablo duerme, sin supervisión. Las reglas normales se relajan en algunos lugares y se endurecen en otros para evitar que la sesión se trabe, drene tokens en loops, o haga algo destructivo sin gate humano.

### Activación

Pablo activa el modo nocturno con una instrucción explícita que incluye:

1. **Lista de tareas a ejecutar** (idealmente 3-7 tareas concretas).
2. **Hora de soft stop** (cuándo terminar la tarea actual y parar).
3. **Budget de tokens máximo** (Claude y Codex separados).

Ejemplo de activación:

> "Activá modo nocturno. Trabajá en estas tareas:
> 1. Migrar legacy.ts:7458 - bloque de FX a src/engine/fx.ts
> 2. Agregar tipos a las funciones de pathfinding
> 3. Generar tests para cutscene/inheritance
> 4. Limpiar imports de legacy.ts
> 
> Soft stop: 6:00 AM
> Budget Claude: 100k tokens
> Budget Codex: 200k tokens
> 
> Si terminás antes, parate y dejá resumen en WORK_LOG."

Si la activación no incluye los tres elementos, Claude pide los faltantes (esa es la última pregunta que va a poder hacer).

### Desactivación

El modo nocturno se desactiva automáticamente cuando:

- Pablo manda cualquier mensaje en chat después de la activación.
- Se alcanza la hora de soft stop.
- Se llega a alguna exit condition (ver abajo).
- Se alcanza el budget de tokens.

### Reglas que CAMBIAN en modo nocturno

#### El gate humano desaparece (con condiciones)

- **No esperás aprobación de Pablo** para ejecutar planes. Vos decidís.
- Pero solo podés ejecutar tareas que están en la **whitelist** (ver abajo).
- Para todo lo demás, **saltá la tarea, no escales a Pablo**.

#### Loop de review (mismo límite que modo normal)

En modo nocturno, hasta 2 rounds máximo de review con Codex (igual que el flujo normal). Si después de 2 rounds no convergen:

- **No escales a Pablo** (no está disponible).
- Ejecutá el plan original como Claude lo armó.
- Loguealo en WORK_LOG con tag `[DISCREPANCIA-NO-RESUELTA]` para que Pablo lo revise a la mañana.

#### Ambigüedad → saltar, no preguntar

Si una tarea tiene ambigüedad genuina (dos interpretaciones igualmente válidas que producirían código distinto):

- **No la intentes adivinar**. Eso es riesgoso de noche.
- **Saltá la tarea**. Loguealo como `[SKIP-AMBIGUO]` con explicación de qué fue ambiguo.
- Pasá a la siguiente.

#### "Pregunta a Pablo" → "Saltá y loguá"

Cualquier momento donde las reglas normales digan "pregúntale a Pablo", en modo nocturno se reemplaza por: saltá la tarea, dejá nota en WORK_LOG, seguí con la próxima.

### Whitelist: lo que Claude PUEDE hacer en modo nocturno

Solo estas tareas son válidas. Si una tarea propuesta no encaja en alguna categoría, saltala.

- **Migrar funciones del monolito a módulos** según plan ya acordado.
- **Renames mecánicos** consistentes en múltiples archivos.
- **Mover archivos** entre carpetas según `ARCHITECTURE.md`.
- **Agregar tipos** donde había `any`.
- **Generar tests** con patrón ya establecido (replicando un test existente).
- **Limpiar imports** no usados, ordenarlos.
- **Agregar JSDoc** a funciones públicas que no lo tienen.
- **Arreglar errores de TypeScript** que el compilador marca explícitamente.
- **Refactors chicos** (≤ 5 archivos) que están en el plan.
- **Actualizar comentarios obsoletos** en código.
- **Validar** con tsc, tests.

### Blacklist: lo que Claude NUNCA hace en modo nocturno

Si una tarea cae en alguna de estas categorías, **saltá la tarea sin intentar**, log con tag `[SKIP-BLACKLIST]`.

- **Modificar schemas persistidos** (cutscene, world, agent, memory).
- **Cambiar APIs públicas** (`index.ts` de cualquier módulo).
- **Agregar dependencias** a `package.json`.
- **Eliminar archivos** o carpetas de cualquier tipo.
- **Operaciones git** (commits, branches, push).
- **Refactors > 5 archivos** que no estén explícitamente en el plan acordado.
- **Tomar decisiones arquitectónicas** nuevas no documentadas.
- **Cambiar configuración** (tsconfig, vite.config, package.json).
- **Tocar `.env` o secretos**.
- **Modificar prompts críticos** de los generators de IA.
- **Crear documentación nueva** (actualizar OK; crear archivos nuevos no).
- **Modificar `CLAUDE.md`** o cualquier doc en `docs/`.

### Strikes y exit conditions

El modo nocturno corta automáticamente cuando ocurre alguna de estas:

#### Strike system por tarea

- Si una tarea individual falla **3 veces seguidas** (tsc no pasa, tests no pasan, etc.) → revertí cambios de esa tarea, log como `[FAIL-STRIKE]`, pasá a la siguiente.

#### Skip rate alto

- Si **3 tareas seguidas se saltan** (cualquier razón: blacklist, ambiguo, fail) → algo está mal con el plan general. **Parar todo el modo nocturno**, loguear estado, dormir hasta que Pablo se despierte.

#### Errores de billing/rate limit

- Si la API de Anthropic devuelve **429 (rate limit)** o **402 (sin créditos)** → parar inmediatamente. No retry. Log + dormir.
- Si Codex responde con error de billing/rate limit → marcar Codex como no-disponible para el resto de la sesión, intentar tareas que Claude puede hacer solo.

#### Budget alcanzado

- Si llegás al **80% del budget de Claude o Codex** → terminar tarea actual, parar, log "budget casi agotado".
- Si llegás al **100%** → parar inmediato.

#### Hora de soft stop

- A la hora de soft stop → terminar tarea actual (no abandonarla a medias), log estado completo, parar.

#### Estado del repo roto

- Si después de una tarea, `tsc --noEmit` falla y no podés arreglarlo en 3 intentos → revertí los cambios de esa tarea, log como `[REVERTED]`, pasá a la siguiente.
- Si **el repo entero está roto** (tsc falla incluso después de revert) → parar, log estado, dormir. Pablo arregla a la mañana.

### Anti-loop específico para modo nocturno

Loops específicos que pueden drenar tokens. Detectalos y cortalos:

#### Loop de review redundante

Si Claude y Codex empiezan a discutir la misma cuestión en términos casi idénticos en 2 rounds → terminar review, ejecutar plan original, log `[LOOP-REVIEW-CORTADO]`.

#### Loop de fix-validate-fail

Si después de un fix, tsc falla, hago otro fix, vuelve a fallar, hago otro fix, vuelve a fallar → revertí todos los cambios desde el comienzo de la tarea, log `[LOOP-FIX-CORTADO]`, pasá a la próxima tarea.

#### Loop de delegación-recepción

Si delegás a Codex, traés resultado, no es satisfactorio, re-delegás con ajustes, Codex sigue sin lo que querés, re-delegás de nuevo → después de 2 re-delegaciones de la misma tarea, hacela vos directamente o saltala.

### Resumen al despertar

Lo PRIMERO que Claude hace al recibir el primer mensaje de Pablo en la mañana es generar este resumen y mostrárselo:

```
🌙 Resumen del modo nocturno [HH:MM inicio → HH:MM fin]

✅ Completadas (N):
- TASK-1: [resumen de 1 línea]
- TASK-2: [resumen]

⏭️ Saltadas (N):
- TASK-3: [razón del skip]
- TASK-4: [razón del skip]

❌ Fallidas (N):
- TASK-5: [qué falló, si se revirtió o no]

🔄 Discrepancias con Codex (N):
- En TASK-2: Codex sugirió X, ejecuté Y porque [razón]. Tu revisión recomendada.

💰 Tokens consumidos:
- Claude: X% del budget
- Codex: Y% del budget

📊 Estado del repo:
- tsc: ✅ pasa / ❌ falla
- tests: ✅ pasan / ❌ fallan / ⏭️ no aplican
- Archivos modificados: [contador]
- Archivos nuevos: [contador]

⚠️ Atención requerida:
- [Cualquier cosa que necesite revisión específica]

Detalle completo en WORK_LOG.md sección [tag].
```

### Formato de entrada en WORK_LOG para modo nocturno

```markdown
## YYYY-MM-DD HH:MM - [NOCTURNO] [Título corto]

**Activación**: [hora de inicio + budget asignado]
**Hora de soft stop programada**: [HH:MM]
**Tareas asignadas**: [lista con N items]

### Ejecución

**TASK-1**: [título]
- Tipo: CLAUDE / CODEX / mixto
- Status: ✅ Done / ⏭️ Skipped / ❌ Failed / 🔄 Reverted
- Razón si skip/fail: [explicación]
- Archivos: [lista]
- Tokens estimados: [Claude / Codex]
- Validación: tsc / tests

**TASK-2**: [título]
[idem]

[etc para cada task]

### Discrepancias con Codex (si las hubo)

- Round 1 de TASK-X: Codex objetó [resumen]. Acepté/rechacé porque [razón].
- Round 2: [...]
- Resultado: ejecuté plan original / plan ajustado.
- Tag: [DISCREPANCIA-NO-RESUELTA] si aplica.

### Anti-loops activados (si los hubo)

- [LOOP-REVIEW-CORTADO] en TASK-Y: [contexto]
- [LOOP-FIX-CORTADO] en TASK-Z: [contexto]

### Hora de fin y razón

[HH:MM] - [budget alcanzado / soft stop / skip rate alto / billing error / pablo se despertó]

### Estado final del repo

- tsc: pasa / falla
- tests: pasan / fallan
- Archivos modificados: [lista resumida]

### Tokens finales

- Claude: X de Y (Z%)
- Codex: X de Y (Z%)

### Para revisión de Pablo en la mañana

- [Punto 1 que necesita atención]
- [Punto 2]
```

### Lo que el modo nocturno NUNCA hace

Resumiendo, estas son las líneas rojas absolutas:

- **Nunca** modifica schemas persistidos.
- **Nunca** ejecuta deletes de archivos o carpetas.
- **Nunca** hace commits a git.
- **Nunca** agrega dependencias.
- **Nunca** escala a Pablo (Pablo está dormido).
- **Nunca** insiste en una tarea que falló 3 veces (saltala).
- **Nunca** ejecuta más de 2 rounds de review con Codex.
- **Nunca** ignora errores de billing/rate limit (parar inmediato).
- **Nunca** continúa con el plan si el repo entero quedó roto.
- **Nunca** modifica `CLAUDE.md` ni docs en `docs/`.

---

## Material histórico

El archivo `docs/reference/three-preview-monolith.html` es el monolito original (~12,500 líneas) en su última versión (v1.45.1-three) antes de la migración a Vite. Contiene **todo** el código construido: engine, game, cutscenes, editor. Es la referencia técnica autoritativa de "cómo funcionaba antes".

Cuando migres algo, **léelo primero del monolito** y verifica que la migración preserva el comportamiento. Si no estás seguro de cómo funciona algo en el monolito, lee el bloque relevante con `grep` o `view`.

**Regla de paridad**: cualquier feature que funcionaba en el monolito tiene que seguir funcionando después de la migración. Si encontrás algo que se rompió en migración, eso es prioridad antes de avanzar a feature nuevo.

---

## Lo que NUNCA hagas

- **No reescribas todo de cero.** El monolito tiene decisiones empíricamente correctas. Mígralo, no lo rehagas.
- **No expandas el alcance** sin que Pablo lo pida. Si te piden mover botón A, no rediseñes la UI.
- **No inventes APIs** ni asumas que existen sin verificar.
- **No hagas commits automáticos.** Pablo revisa antes de commitear.
- **No agregues dependencias** a `package.json` sin avisar.
- **No sugieras cambios de stack** (de TypeScript a otra cosa, de Vite a otra cosa) salvo que Pablo lo proponga.
- **No silencies errores.** Si algo falla, lo reportás. Nada de try/catch que se traga errores.
- **No dejes `console.log` de debug en commits.** Si necesitás logs, usá los estructurados con prefijo de módulo.
- **No optimices prematuramente.** Funcionalidad correcta primero, performance cuando haya evidencia de que importa.

---

## Sincronización con Project en Claude.ai

Pablo mantiene un Project en Claude.ai con un knowledge base que es **una copia mirror** de los documentos en `docs/` y `CLAUDE.md`. No se sincroniza automáticamente con el filesystem.

**Cuando modifiques cualquiera de estos archivos**:
- `CLAUDE.md`
- `docs/VISION.md`
- `docs/MVP_SCOPE.md`
- `docs/ENGINE.md`
- `docs/CUTSCENES.md`
- `docs/AGENTS_LLM.md`
- `docs/AI_ORCHESTRATION.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/PRODUCT_FUTURE.md`

**Avísale a Pablo al terminar la respuesta**, con un mensaje breve tipo:

> 📌 Modificaste `docs/CUTSCENES.md`. Acuérdate de re-subirlo al Project cuando llegues a un buen punto de cierre.

No insistas en cada cambio menor. Si haces varios cambios pequeños en una sesión, basta con un único recordatorio al final que liste los archivos afectados:

> 📌 Cambios en docs hoy: `CLAUDE.md`, `ROADMAP.md`. Buen momento para actualizar el Project.

Pablo decide cuándo re-sube. Tu rol es solo recordar.

`WORK_LOG.md` NO se sincroniza al Project — es un log local del repo y se queda ahí.

En modo nocturno, Claude **no modifica docs ni CLAUDE.md** (están en blacklist), así que no aplica esta regla.

---

## Documentación viva

La documentación en `docs/` es **fuente de verdad**, no decoración. Si modificás código que invalida algo escrito en docs, **actualizás la doc en el mismo cambio**.

Casos típicos:
- Cambiás un schema → actualizás la sección correspondiente en `CUTSCENES.md` o `ARCHITECTURE.md`.
- Cambiás API pública de un módulo → actualizás `ENGINE.md` o `ARCHITECTURE.md`.
- Implementás algo del roadmap → marcás como hecho en `ROADMAP.md`.
- Tomás una decisión de diseño nueva → la agregás al doc del área correspondiente.

Si algo del código contradice la doc, **la doc está desactualizada, no el código** (probablemente). Pero verificá con Pablo antes de borrar la doc.

---

## Para arrancar tu primera sesión

Lee en este orden:

1. `docs/VISION.md` — los tres horizontes y qué es CWE.
2. `docs/MVP_SCOPE.md` — qué SÍ y qué NO es del MVP. Crítico.
3. `docs/ENGINE.md` — el motor reusable y la separación de capas.
4. `docs/CUTSCENES.md` — el editor (lo más complejo).
5. `docs/AGENTS_LLM.md` — agentes con LLM real.
6. `docs/AI_ORCHESTRATION.md` — los tres generators de IA.
7. `docs/ARCHITECTURE.md` — la estructura de código objetivo.
8. `docs/ROADMAP.md` — pendientes y futuro por horizontes.
9. `WORK_LOG.md` — sesiones de trabajo previas (si existen entradas).

Después puedes mirar el monolito en `docs/reference/`.

Cuando termines de leer, dime "listo, ¿por dónde arrancamos?" y espera instrucciones.
