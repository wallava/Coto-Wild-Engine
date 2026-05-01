<!-- ARCHIVO: AI_ORCHESTRATION.md -->

# AI_ORCHESTRATION.md — Los tres generators internos

## Frame del MVP

Este documento describe la capa de **AI Orchestration** dentro del MVP. Son herramientas que **Pablo usa para acelerar el desarrollo de AGENTS.INC**, no features para usuarios externos.

Si en algún momento te encuentras pensando "esto sería bueno para usuarios futuros", parate. Eso es horizonte 3, no MVP. Ver `MVP_SCOPE.md`.

---

## Los tres generators

El MVP incluye **tres generators internos**, no más:

### 1. Personality Generator

**Input**: descripción libre en español/inglés.

> "Un CEO que pretende escuchar pero todo lo que dice termina siendo lo que ya pensaba al principio. Habla en jerga corporativa pero a veces se le escapa que no entendió la pregunta."

**Output**: Personality completa lista para meter en el código.

```ts
{
  id: 'ceo-pretender',
  emoji: '🎩',
  voiceIdx: 2,
  name: 'CEO Pretender',
  systemPrompt: '...',
  speakStyle: 'corporativo, pretensioso, redirige siempre a su agenda',
  examples: [
    { context: '...', response: '...' },
    // ...
  ],
  triggers: { ... },
}
```

**Para qué sirve**: Pablo describe en lenguaje natural una personalidad, el generator escribe el archivo `src/game/llm-agents/personalities/ceo-pretender.ts`. Pablo lo refina.

### 2. Cutscene Generator

**Input**: descripción libre de la escena en español/inglés.

> "Mike y Cris están en la cocina. Cris está estresada porque le pidieron renderizar un video de 10 minutos en 2 horas. Mike, sin entender el contexto, le dice que use IA. La cámara empieza wide, después close-up de Cris reaccionando, después cut a Mike satisfecho."

**Output**: archivo `.scene.md` en formato DSL compilable.

**Para qué sirve**: Pablo describe la escena, el generator escribe el DSL, el compiler (Fase 4) lo convierte en cutscene serializada, el editor la abre y Pablo la refina visualmente.

**Pre-requisito**: Fase 4 (DSL) tiene que estar implementada. El Cutscene Generator genera DSL, no JSON crudo.

### 3. World Iterator

**Input**: instrucción de cambio sobre el mundo existente.

> "Agregale un baño en la esquina suroeste con dos cubículos."

**Output**: una serie de comandos sobre el world existente (no un mundo de cero).

```ts
[
  { kind: 'place_walls', cells: [...], pattern: 'enclose' },
  { kind: 'place_door', cx: 1, cy: 4, side: 'N' },
  { kind: 'place_prop', type: 'toilet', cx: 0, cy: 5 },
  { kind: 'place_prop', type: 'toilet', cx: 1, cy: 5 },
  { kind: 'create_zone', name: 'baño', cells: [...], kind: 'bathroom' },
]
```

**Para qué sirve**: en lugar de hacer click-by-click en el editor para agregar un baño, Pablo lo dicta y aparece. Especialmente útil para layouts grandes.

---

## Por qué solo estos tres

Hay otros generators que se podrían imaginar (World Generator de cero, Conversation Manager con memoria, Object Builder con IA generando meshes 3D). **No están en el MVP**.

Razones:
- **World Generator de cero** requiere composición coherente (layout + props + agentes + relaciones todos juntos). Demasiado complejo para MVP. Es horizonte 3.
- **Conversation Manager** requiere memoria persistente y chat lateral. No vale el costo en MVP. Pablo puede usar request-response con los tres generators para iterar.
- **Object Builder con IA** genera meshes 3D. Requiere pipeline de mesh generation + optimización + storage. Horizonte 3.

Los tres que SÍ están son los que **directamente aceleran el desarrollo de AGENTS.INC en el MVP**. El resto son features de producto.

---

## Arquitectura técnica

Los generators viven en `src/ai/`. Dependencias:

```
src/ai/
├── index.ts                    ← exporta los tres generators
├── action-schema.ts            ← Zod schemas de cada action
├── action-handlers.ts          ← ejecutores sobre el motor
├── validators.ts               ← valida output del LLM
├── prompts/
│   ├── personality.ts          ← prompt template para Personality Generator
│   ├── cutscene.ts             ← prompt template para Cutscene Generator
│   ├── iterator.ts             ← prompt template para World Iterator
│   └── shared.ts               ← partes comunes (definiciones de DSL, etc.)
├── generators/
│   ├── personality-generator.ts
│   ├── cutscene-generator.ts
│   └── world-iterator.ts
└── ui/                         ← UI básica para Pablo
    ├── personality-panel.ts
    ├── cutscene-panel.ts
    └── iterator-panel.ts
```

Capa LLM compartida en `src/llm/` (cliente Anthropic). Ver `ARCHITECTURE.md`.

---

## Patrones obligatorios

### Modelo híbrido: streaming + structured output

Los generators usan dos paradigmas según el caso:

- **Streaming token-by-token** para UX (Pablo ve la respuesta aparecer en vivo, puede cancelar si va en mala dirección).
- **Structured output con Zod** al final (parsea el JSON resultante y valida contra schema).

El streaming es para feedback. La validación es para correctness.

### Catálogo finito de acciones

Cada generator tiene un **catálogo cerrado** de acciones que puede emitir. El LLM no inventa acciones nuevas; elige de la lista.

Ejemplo World Iterator:

```ts
const WORLD_ACTIONS = [
  'place_wall', 'remove_wall',
  'place_prop', 'remove_prop', 'move_prop',
  'place_door',
  'create_zone', 'modify_zone',
  'spawn_agent', 'remove_agent',
  'paint_floor', 'paint_wall',
] as const;
```

Razón: si el LLM puede inventar acciones, no podemos garantizar que el handler exista. Catálogo finito = previsibilidad.

### Schemas Zod para todo lo que viene del LLM

El output del LLM se parsea con Zod **siempre**. Si el output no encaja, se reintenta con feedback al LLM o se aborta con error legible.

```ts
const result = WorldIteratorOutputSchema.safeParse(llmResponse);
if (!result.success) {
  // Reintentar con feedback al LLM o abort
}
```

### Caché de prompts/respuestas

Los prompts en español pesan tokens. Para iteración rápida (Pablo cambia un detalle y re-genera), caché basado en hash del prompt.

```ts
import { LRUCache } from 'lru-cache';
const cache = new LRUCache<string, string>({ max: 100 });
```

### API key de Pablo, sin proxy

En MVP, Pablo configura su API key de Anthropic en una settings UI. La key vive en `localStorage` (o mejor, en `sessionStorage` por privacidad). Las requests salen directo al endpoint de Anthropic desde el browser.

**Esto solo funciona porque Pablo es único usuario**. Cuando llegue horizonte 2 (publicar AGENTS.INC), aparece LLM proxy via Cloudflare Workers para esconder la key.

---

## Modelos a usar

Recomendación inicial:

- **Claude Haiku 4.5** para volumen y velocidad (Cutscene Generator iterando, World Iterator).
- **Claude Sonnet 4.6** o superior para calidad fina (Personality Generator, donde el output se vuelve código permanente).

Pablo puede cambiar el modelo en settings. Default razonable.

---

## UI mínima (no producto)

Las UIs de los generators son **paneles internos**, no producto. No hay onboarding. No hay validación de input formal. Pablo conoce el sistema.

```
┌────────────────────────────────────────┐
│ Personality Generator                  │
├────────────────────────────────────────┤
│ Describí la personalidad:              │
│ ┌────────────────────────────────────┐ │
│ │                                    │ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│ [ Generar ]    [ Cancelar ]            │
│                                        │
│ Output:                                │
│ ┌────────────────────────────────────┐ │
│ │ (streaming aparece acá)            │ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│ [ Guardar como archivo ]   [ Iterar ]  │
└────────────────────────────────────────┘
```

Tres botones, un input, un output. Suficiente para Pablo.

---

## Plan de implementación

Cuando llegue el momento (post-DSL):

### Fase A — Capa LLM básica

- `src/llm/client.ts` con interface `LLMClient`.
- `src/llm/anthropic-client.ts` implementación Anthropic con streaming.
- Settings UI para API key.
- Tests con mock del LLM.

### Fase B — Personality Generator

Es el más simple. Empezar acá.

- `src/ai/prompts/personality.ts` con system prompt.
- `src/ai/generators/personality-generator.ts` que orquesta llm.
- Schema Zod del output.
- UI panel mínimo.
- 3 ejemplos de uso real (CEO, junior, RRHH).

### Fase C — World Iterator

El segundo. Acciones discretas sobre el world.

- Catálogo de WORLD_ACTIONS.
- Schemas Zod por acción.
- Handlers que ejecutan sobre `world` real.
- UI panel.
- 3-5 ejemplos de iteraciones reales sobre la oficina.

### Fase D — Cutscene Generator

El más complejo. Requiere DSL ya implementado.

- Prompt extenso con definición del DSL.
- Generator que produce DSL en streaming.
- Validación: el DSL generado tiene que compilar limpio.
- UI panel.
- 5+ ejemplos de cutscenes generadas.

---

## Lo que NO va en MVP

Resumiendo restricciones:

- **No World Generator de cero**. Solo iterator sobre existente.
- **No Conversation Manager** con memoria persistente.
- **No Object Builder** generando meshes 3D.
- **No moderación** del input (Pablo es único usuario).
- **No telemetría** del uso de los generators.
- **No A/B de prompts**.
- **No cost monitoring**.
- **No retry inteligente** complejo (un retry simple basta).

Cuando llegue horizonte 2 (publicar AGENTS.INC) o horizonte 3 (CWE producto), esos features tienen su lugar. Antes, no.
