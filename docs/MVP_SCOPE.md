# MVP_SCOPE.md — Qué es y qué no es el MVP

## El frame

El MVP del proyecto es **una herramienta personal de Pablo para desarrollar AGENTS.INC**. No es producto, no tiene usuarios, no tiene marketing.

El éxito se mide así: **¿Pablo puede desarrollar AGENTS.INC más rápido y mejor con esta herramienta que sin ella?**

Si la respuesta es sí, el MVP funcionó. Si no, hay que arreglarlo antes de avanzar a horizontes posteriores.

---

## Qué SÍ entra al MVP

### Migración del monolito (en curso)

- Vite + TypeScript strict + tooling moderno.
- Separación de capas: `engine/`, `game/`, `cutscene/`, `editor/`, `ui/`, `utils/`.
- APIs públicas explícitas (`index.ts` por carpeta).
- Reglas de import duras (engine no importa game, etc.).
- Estado: ~50% migrado al 2026-04-27. Faltan principalmente cutscene editor lifecycle/runtime/UI.

### Schemas Zod + validation + migrations (cerrado)

- Schemas completos para world y cutscene (Fase 3 cerrada).
- Validación al cargar de localStorage con fallback.
- Sistema de cuarentena (`cwe_quarantine_*`) para data corrupta.
- Migrations de versiones viejas del modelo.
- 100 tests verdes cubriendo schemas, migrations, integration.

### Tests críticos

- Patrón Vitest establecido.
- Cobertura: `cutscene/inheritance.ts`, schemas Zod, migrations.
- Pendientes post-Fase 3: tests para DSL compiler, engine/coords, engine/walls, E2E con Playwright.

### Internacionalización es/en (pendiente)

Decisión cerrada del MVP. Setup `i18next` o equivalente desde la fase de extracción inicial post-migración. Estructura preparada para más idiomas sin refactor.

- `src/i18n/` para configuración.
- `locales/es.json` y `locales/en.json` para strings.
- Detección de idioma del input para los generators de IA.

### DSL de cutscenes (pendiente, alta prioridad)

El feature que desbloquea autoría rápida de Pablo. Pre-requisito para que la IA genere cutscenes después.

- Parser markdown narrativo → AST.
- Schema del AST con Zod.
- Compiler AST → cutscene model.
- Shot types: `wide_establishing`, `medium_shot`, `close_up`, `two_shot`, `over_the_shoulder`.
- Camera moves: `dolly_in`, `pull_out`, `pan`, `push_in`.
- Agent actions: `camina_a`, `mira_a`, `dice`, `anima`, `espera`.
- CLI: `npm run cutscene-compile path/to/scene.md`.

Ver `CUTSCENES.md` para detalle.

### Capa LLM + agentes con LLM real (pendiente)

La diferencia con The Sims clásico.

- Capa LLM básica (`src/llm/`) con cliente Anthropic.
- Settings UI para API key (Pablo lo usa con su key directo, sin proxy).
- AgentBrain + Personality + AgentMemory básicos.
- 3-5 personalidades concretas para AGENTS.INC (CEO, junior, RRHH, intern, etc.).
- Streaming bubbles word-by-word.
- Trigger automático de encuentros entre agentes adyacentes.
- Persistencia de memoria.

### AI Orchestration: tres generators internos (pendiente)

Las herramientas que aceleran el desarrollo de contenido.

- **Personality Generator**: descripción → Personality completa.
- **Cutscene Generator**: descripción → DSL compilable.
- **World Iterator**: instrucción → modifica mundo existente.

Ver `AI_ORCHESTRATION.md`.

### AGENTS.INC contenido inicial (pendiente)

Para tener un mundo demostrable.

- 5-10 personalidades base generadas y refinadas.
- Mundo de oficina con layout, props, zonas.
- 5-10 cutscenes narrativas demostrando el juego.
- Encuentros sociales LLM funcionando.
- Mecánicas básicas de gameplay (necesidades, working state, social).

---

## Qué NO entra al MVP

Estas cosas **NO se construyen ahora**, regardless de cuán tentadoras sean.

### Sin backend

- **No Supabase** ni equivalente. Todo localStorage.
- **No auth, no cuentas, no login**.
- **No LLM proxy**. Pablo usa su API key directo desde browser. Aceptable porque es único usuario.
- **No multi-device sync**.
- **No cloud save**.

### Sin features para usuarios externos

- **No onboarding**. El proyecto se abre y Pablo sabe usarlo.
- **No tooltips contextuales**. El proyecto es para Pablo, Pablo conoce sus propias features.
- **No settings panel** (más allá de API key).
- **No pause menu, no save slots múltiples más allá del actual**.
- **No tutorial**.

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

- **No chat persistente** con memoria a largo plazo.
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

## Reglas para no descarrilarse

Cuando aparece tentación de meter algo al MVP, tres preguntas:

1. **¿Esto es necesario para que Pablo desarrolle AGENTS.INC?**
   Si la respuesta es "sería bueno tenerlo" en lugar de "sin esto no puedo avanzar" → no es del MVP.

2. **¿Esto sirve a usuarios futuros que aún no existen?**
   Si la respuesta es sí → no es del MVP. Es horizonte 2 o 3.

3. **¿Esto agrega complejidad arquitectónica que voy a tener que mantener?**
   Si la respuesta es sí y no entra en las dos preguntas anteriores → no es del MVP.

---

## Métricas de éxito del MVP

El MVP está cerrado cuando Pablo puede:

- ✅ Crear una personalidad nueva en menos de 2 minutos (vía Personality Generator).
- ✅ Crear una cutscene de 30 segundos en menos de 5 minutos (vía DSL escrito a mano o Cutscene Generator).
- ✅ Iterar el mundo (mover muebles, agregar zonas) en menos de 1 minuto (vía World Iterator).
- ✅ Cargar y modificar cutscenes existentes sin perder datos.
- ✅ Ver el juego con agentes que hablan con LLM real, encuentros sociales que se sienten distintos cada vez.
- ✅ Tener cero regresiones del comportamiento del monolito original.

Si esto se cumple, el MVP funciona. A partir de ahí se decide si se avanza a horizonte 2 (publicar AGENTS.INC) o se itera el MVP.

---

## Cuando aparece tentación de hacer producto

Mientras el MVP está activo, **toda decisión que se sienta como "feature de producto" se difiere**.

Cosas que pueden aparecer pero hay que resistir:
- "Mejoremos el onboarding por si alguien más lo prueba" → NO. Pablo no necesita onboarding.
- "Agreguemos métricas para ver qué se usa" → NO. Pablo es único usuario, sabe qué usa.
- "Hagamos auth para multi-device" → NO. Single-machine basta.
- "Pulámos la UX de la API key, parece técnico" → NO. Pablo es técnico, le da igual.
- "Implementemos Stripe por si querés cobrar" → NO. Sin usuarios no hay con quién cobrar.

La regla es estricta. Si después de cerrar MVP queremos abrir horizonte 2, esos features tienen su lugar. Antes, son ruido.
