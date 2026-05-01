# MVP_SCOPE.md — Qué es y qué no es el MVP

## El frame

El MVP del proyecto es **Coto Wild Engine (CWE) terminado como herramienta funcional**. No es un juego. No es un producto público. No tiene usuarios externos.

Cuando el MVP esté cerrado, Pablo va a tener un motor de juego narrativo isométrico 3D listo para construir AGENTS.INC, otros juegos, y eventualmente convertirse en producto público (horizonte 3).

**AGENTS.INC dentro del MVP es contenido de validación**: 3-5 personalidades, world de oficina básico, algunas cutscenes. Suficiente para validar que las herramientas de CWE funcionan en un caso real. **No es el juego AGENTS.INC publishable**. Eso es horizonte 2.

El éxito del MVP se mide así: **¿CWE está listo como herramienta funcional para que Pablo empiece a construir AGENTS.INC en serio?**

Si la respuesta es sí, el MVP funcionó. Si no, hay que arreglarlo antes de avanzar a horizontes posteriores.

---

## Por qué este frame y no otro

Hubo confusión previa donde MVP se describía como "herramienta para desarrollar AGENTS.INC". Técnicamente no es falso — CWE es herramienta para AGENTS.INC entre otras cosas — pero el énfasis estaba mal. Leía como si AGENTS.INC fuera el output del MVP.

**El output del MVP es CWE**. AGENTS.INC es:

1. **Caso de validación durante el MVP** (scaffolding mínimo: 3-5 personalidades, world básico, cutscenes de prueba).
2. **Primer juego real construido sobre CWE** (post-MVP, horizonte 1.5 o 2).
3. **Producto publicado en web pública** (horizonte 2 propiamente dicho).

Mezclar esos tres roles en un solo MVP infla el alcance hasta volverlo no-terminable. Recortar el MVP a "CWE listo + scaffolding de validación" lo hace terminable.

Si en algún momento te encontrás justificando features con "esto va a hacer AGENTS.INC más rico", parate. Eso probablemente es horizonte 2, no MVP.

---

## Qué SÍ entra al MVP

### Migración del monolito (en curso)

- Vite + TypeScript strict + tooling moderno.
- Separación de capas: `engine/` (CWE), `game/` (lógica de gameplay sobre CWE), `cutscene/`, `editor/`, `ui/`, `utils/`.
- APIs públicas explícitas (`index.ts` por carpeta).
- Reglas de import duras (engine no importa game, etc.).
- Estado: ~50% migrado al 2026-04-30. Faltan principalmente cutscene editor lifecycle/runtime/UI, mouse handlers, applyWorld+loadSlot, FX system, POV controls.

### Schemas Zod + validation + migrations (cerrado en Fase 3)

- Schemas completos para world y cutscene.
- Validación al cargar de localStorage con fallback.
- Sistema de cuarentena (`cwe_quarantine_*`) para data corrupta.
- Migrations de versiones viejas del modelo.
- 100 tests verdes cubriendo schemas, migrations, integration.

### Tests críticos

- Patrón Vitest establecido.
- Cobertura: `cutscene/inheritance.ts`, schemas Zod, migrations, capa LLM, orchestrator de conversaciones, engine helpers.
- Pendientes: tests para DSL compiler, engine/coords, engine/walls, E2E con Playwright.
- Estado: 453 tests verdes al 2026-04-30.

### Internacionalización es/en (pendiente)

Decisión cerrada del MVP. Setup `i18next` o equivalente desde la fase de extracción inicial post-migración. Estructura preparada para más idiomas sin refactor.

- `src/i18n/` para configuración.
- `locales/es.json` y `locales/en.json` para strings.
- Detección de idioma del input para los generators de IA.

### DSL de cutscenes (cerrado en Fase 4)

El feature que desbloquea autoría rápida de cinematics. Pre-requisito para que la IA genere cutscenes después.

- Parser markdown narrativo → AST.
- Schema del AST con Zod.
- Compiler AST → cutscene model.
- Shot types: `wide_establishing`, `medium_shot`, `close_up`, `two_shot`, `over_the_shoulder`.
- Camera moves: `dolly_in`, `pull_out`, `pan`, `push_in`.
- Agent actions: `camina_a`, `mira_a`, `dice`, `anima`, `espera`.
- CLI: `npm run cutscene-compile path/to/scene.md`.

Ver `CUTSCENES.md` para detalle.

### Capa LLM + sistema de agentes con LLM real (cerrado en Fase 5 + 5.1)

La diferencia con motores narrativos clásicos: agentes con comportamiento generado por LLM real, no scripts fijos.

- Capa LLM (`src/llm/`) con cliente Anthropic, mock client, queue, cost tracker, sanitización con `<world_context>`.
- Settings UI para API key (Pablo usa su key directo, sin proxy).
- AgentBrain + Personality + AgentMemory funcionales.
- Sistema de orquestación de conversaciones multi-turn.
- AgentState con guards quirúrgicos en pathfinding/needs.
- Streaming bubbles palabra por palabra.
- Trigger automático de encuentros entre agentes adyacentes + crisis de necesidades.
- Persistencia de memoria con cuarentena Zod + importance scoring + relationship tracking.
- Prompt caching obligatorio con SystemBlock[].
- Cost caps multi-capa: $20/mes Anthropic workspace + $0.50/sesión configurable.

**Como scaffolding de validación de CWE**: 3 personalidades concretas implementadas (CEO Pretender, Junior Overconfident, Intern Anxious). Estas personalidades viven en `src/game/llm-agents/personalities/` y son el caso de prueba que valida que el sistema LLM de CWE funciona en escenario real.

Estado: Fase 5.1 cerrada. Próxima Fase 5.1.5 es tuning de encuentros autónomos.

### AI Orchestration: tres generators internos (pendiente)

Las herramientas que aceleran el desarrollo de contenido sobre CWE. Son **lo que hace al motor verdaderamente potente**: en lugar de programar contenido a mano, Pablo lo describe en lenguaje natural.

- **Personality Generator**: descripción → Personality completa.
- **Cutscene Generator**: descripción → DSL compilable.
- **World Iterator**: instrucción → modifica mundo existente.

Ver `AI_ORCHESTRATION.md`. Visión a futuro: integración con asistente de voz para crear contenido hablando.

### Scaffolding de AGENTS.INC para validar CWE (parcialmente hecho)

Contenido mínimo necesario para validar que el motor funciona. **No es el juego AGENTS.INC propiamente dicho**, es contenido de prueba que ejercita las herramientas.

- 3-5 personalidades base implementadas como caso de prueba (3 ya hechas: CEO, Junior, Intern).
- Mundo de oficina básico con layout, props, zonas (parcial).
- 3-5 cutscenes de prueba demostrando que el editor + DSL funcionan (pendiente).
- Encuentros sociales LLM funcionando (hecho en Fase 5.1).
- Mecánicas básicas de gameplay (necesidades, working state, social) — hecho parcialmente.

**Lo que NO se hace en MVP**:
- Contenido AGENTS.INC publishable.
- 10+ personalidades pulidas.
- Narrativa completa de oficina.
- Tuning fino de tono y humor.
- Balanceo de gameplay.

Eso es post-MVP, cuando AGENTS.INC se construya en serio.

---

## Qué NO entra al MVP

Estas cosas **NO se construyen ahora**, regardless de cuán tentadoras sean.

### Sin AGENTS.INC como producto

- **No** publicar AGENTS.INC en web pública.
- **No** marketing, trailer, video promocional.
- **No** tuneo fino de personalidades para humor satírico pulido.
- **No** balanceo de gameplay loops.
- **No** narrativa completa de oficina.
- **No** "AGENTS.INC listo para mostrar al mundo".

Eso es horizonte 2. El MVP entrega CWE con scaffolding suficiente, no el juego completo.

### Sin backend

- **No Supabase** ni equivalente. Todo localStorage.
- **No auth, no cuentas, no login**.
- **No LLM proxy**. Pablo usa su API key directo desde browser. Aceptable porque es único usuario.
- **No multi-device sync**.
- **No cloud save**.

### Sin features para usuarios externos

- **No onboarding**. El proyecto se abre y Pablo sabe usarlo.
- **No tooltips contextuales**. Pablo conoce sus propias features.
- **No settings panel** (más allá de API key + cap de costos).
- **No pause menu**.
- **No tutorial**.
- **No documentación pública del motor**.

### Sin marketplace ni sharing

- **No mundos compartibles públicamente**.
- **No remixes, likes, comentarios**.
- **No asset packs ni tienda**.
- **No revenue share, no Stripe, no billing**.

### Sin generación de mundo de cero

- **No World Generator** que genera mundo desde descripción libre. Eso es horizonte 3.
- **No Object Builder** con IA que genera meshes 3D. Horizonte 3.
- **No templates de partida**. Pablo construye los mundos a mano o con World Iterator (que modifica existente).

### Sin Conversation Manager con memoria persistente

- **No chat persistente** con memoria a largo plazo en los generators.
- Los generators de IA son request-response, no conversaciones largas.
- Si Pablo necesita iterar, abre otra request.

### Sin output profesional

- **No render MP4 con calidad de producción**. Horizonte 2.
- **No screenshots con composición automática**. Horizonte 2.
- **No export a formatos de terceros**.

### Sin moderación

- **No filtros de contenido**. Pablo es único usuario.
- **No COPPA, GDPR compliance**.
- **No controles parentales**.

### Sin métricas ni analytics

- **No telemetría**.
- **No crash reporting**.
- **No A/B testing**.
- **No funnels de conversión**.

---

## La distinción crítica: validación vs producto

Esta es la regla que evita scope creep en MVP.

Cuando aparece una decisión sobre AGENTS.INC, pregúntate:

**¿Esto es necesario para validar que CWE funciona?**

- ✅ "Necesito personalidades funcionales para probar el sistema LLM" → SÍ. Hacer 3-5.
- ❌ "Necesito 10 personalidades para que el juego se sienta variado" → NO. Eso es producto.

**¿Esto es necesario para que Pablo pueda usar CWE para construir juegos?**

- ✅ "Necesito el editor de cutscenes funcional" → SÍ.
- ✅ "Necesito el DSL para que la IA pueda generar cutscenes" → SÍ.
- ❌ "Necesito que el editor tenga undo de 100 niveles" → NO si 10 niveles bastan.

**¿Esto sirve a usuarios futuros que aún no existen?**

- Si la respuesta es sí → no es del MVP. Es horizonte 2 o 3.

**¿Esto agrega complejidad arquitectónica que voy a tener que mantener?**

- Si la respuesta es sí y no entra en las dos preguntas anteriores → no es del MVP.

---

## Métricas de éxito del MVP

El MVP está cerrado cuando Pablo puede:

### CWE como herramienta funcional

- ✅ Construir un mundo nuevo desde el editor en menos de 10 minutos (placement de paredes, props, zonas).
- ✅ Spawnear agentes en el mundo y ver que se comportan según necesidades.
- ✅ Crear una cutscene desde el DSL en menos de 5 minutos (escribir markdown narrativo, compilarlo, abrirlo en el editor).
- ✅ Editar una cutscene existente en el editor sin perder datos.
- ✅ Ver agentes hablar con LLM real, con personalidades distintas, en encuentros sociales.

### AI Orchestration funcional

- ✅ Generar una personalidad nueva en menos de 2 minutos (vía Personality Generator).
- ✅ Generar una cutscene de 30 segundos en menos de 5 minutos (vía Cutscene Generator).
- ✅ Iterar el mundo (mover muebles, agregar zonas) en menos de 1 minuto (vía World Iterator).

### Calidad técnica

- ✅ Cero regresiones del comportamiento del monolito original (todo lo que andaba antes anda ahora).
- ✅ Tests verdes en CI.
- ✅ Schemas Zod validan toda data persistida.
- ✅ Cero violaciones de la regla de capas (engine no importa game, etc.).
- ✅ i18n funcionando con es/en.

### Validación con AGENTS.INC scaffolding

- ✅ 3-5 personalidades funcionando como casos de prueba.
- ✅ World de oficina básico construido (no requerido publishable, solo funcional).
- ✅ Algunas cutscenes de prueba demostrando que el pipeline DSL → compilador → editor funciona.

Si todo esto se cumple, el MVP funciona. A partir de ahí Pablo puede:

- Empezar a construir AGENTS.INC en serio (horizonte 1.5 / 2).
- Empezar a construir otros juegos sobre CWE.
- Eventualmente preparar CWE para horizonte 3 (producto público).

---

## Después del MVP: qué viene

### Horizonte 1.5 (intermedio): construir AGENTS.INC con CWE

Una vez cerrado MVP, Pablo dedica una fase a construir AGENTS.INC en serio usando las herramientas de CWE:

- 10+ personalidades pulidas con tono satírico afilado.
- Mundo de oficina rico con múltiples ambientes.
- Narrativa completa con cutscenes guionadas.
- Gameplay loops balanceados.
- Tuning de humor y tono.

Esto NO es MVP. Es construir un juego con las herramientas que el MVP entregó.

### Horizonte 2: AGENTS.INC publicado

Cuando AGENTS.INC tenga contenido suficiente, se publica:

- Backend ligero (Supabase para hospedar mundos).
- Auth básico para guardar progreso.
- Sharing asíncrono.
- Demo accesible sin registro.
- Marketing.

### Horizonte 3: CWE como producto público

Cuando AGENTS.INC esté publicado y CWE haya demostrado ser sólido y reusable:

- Onboarding mágico para creadores externos.
- World Generator de cero.
- Marketplace de mundos.
- Asset packs.
- Modelo de negocio.

Ver `PRODUCT_FUTURE.md` para la visión a largo plazo.

---

## Cuando aparece tentación de hacer producto durante MVP

Mientras el MVP está activo, **toda decisión que se sienta como "feature de producto" se difiere**.

Cosas que pueden aparecer pero hay que resistir:

- "Mejoremos el onboarding por si alguien más lo prueba" → NO. Pablo no necesita onboarding.
- "Agreguemos métricas para ver qué se usa" → NO. Pablo es único usuario, sabe qué usa.
- "Hagamos auth para multi-device" → NO. Single-machine basta.
- "Pulámos la UX de la API key" → NO. Pablo es técnico.
- "Implementemos Stripe por si querés cobrar" → NO. Sin usuarios no hay con quién cobrar.
- **"Hagamos AGENTS.INC más rico para mostrarlo"** → NO. Eso es horizonte 2.
- **"Agreguemos 5 personalidades más"** → NO si las 3 existentes ya validan el sistema.
- **"Tuneemos el humor de las personalidades"** → NO. Eso es contenido post-MVP.

La regla es estricta. Si después de cerrar MVP querés abrir horizonte 1.5 (AGENTS.INC en serio) o horizonte 2 (publicar), esos features tienen su lugar. Antes, son ruido.

---

## Para retomar este documento

Si vas a leer/escribir esto, recordá:

1. **El output del MVP es CWE como herramienta funcional**. AGENTS.INC dentro del MVP es scaffolding de validación, no producto.

2. **3-5 personalidades de AGENTS.INC son suficientes para MVP**. Más es scope creep.

3. **Si alguna decisión enfatiza "AGENTS.INC más rico"**, eso es horizonte 2.

4. **Si alguna decisión enfatiza "CWE más completo y validado"**, eso es MVP.

5. **El éxito del MVP es que Pablo pueda empezar a construir AGENTS.INC en serio después**, no que AGENTS.INC esté listo durante MVP.

Cuando dudes, vuelve al frame: el output del MVP es la herramienta, no el contenido.
