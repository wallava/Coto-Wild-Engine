<!-- ARCHIVO: VISION.md -->

# VISION.md — Qué es esto

## Tres horizontes

Este proyecto vive en tres horizontes temporales. Cada uno tiene un propósito distinto y la línea entre ellos importa para no confundir scope.

### Horizonte 1 — MVP (lo que estamos construyendo ahora)

**Coto Wild Engine (CWE) terminado como herramienta funcional, con AGENTS.INC adentro como scaffolding de validación.**

Sin usuarios externos. Sin backend. Sin onboarding. Sin marketplace. Sin auth. Sin billing. Sin moderación. Sin métricas, sin features sociales, sin mecánicas de retención. Single-user, single-machine, tools-for-Pablo. AGENTS.INC dentro del MVP es contenido mínimo de validación — no es el juego publishable. Eso es horizonte 2. Ver `MVP_SCOPE.md` para alcance estricto.

El éxito del MVP se mide así: **¿CWE está listo como herramienta para que Pablo empiece a construir AGENTS.INC en serio (post-MVP)?** Si la respuesta es sí, el MVP funcionó. Si no, hay que arreglarlo antes de avanzar.

Ver `MVP_SCOPE.md` para qué SÍ y qué NO entra en el MVP.

### Horizonte 2 — AGENTS.INC publicado

**El juego como producto público gratis.**

Un juego web isométrico estilo The Sims con IA real en personajes. Aparece backend ligero (Supabase para hospedar mundos de jugadores), analytics básicos, sistema de save/load público. AGENTS.INC se vuelve **onboarding y showcase** del motor por debajo.

No tiene timeline definida. Empieza cuando MVP esté completo y AGENTS.INC tenga contenido suficiente.

### Horizonte 3 — CWE como producto

**Coto Wild Engine convertido en herramienta para creadores externos.**

La promesa pública en este horizonte es:

> "Crea un mundo, dale personalidad a sus habitantes y genera escenas dentro de él hablando con la IA."

Es la visión más ambiciosa: world/story builder con IA, marketplace de mundos, asset packs, modelo de negocio. **No estamos construyendo esto ahora**. Sirve como norte conceptual de largo plazo. Ver `PRODUCT_FUTURE.md`.

---

## AGENTS.INC — el juego

AGENTS.INC es un **juego web isométrico 3D**, sátira sobre la economía de los agentes IA. Estilo de gameplay The Sims con IA real en los personajes.

Una "fábrica de agentes IA" — oficina con cubículos, salas de reuniones, máquinas de café, baños — donde los agentes son trabajadores AI representados como personajes con cabezas grandes y cuerpos chicos. Tienen necesidades (cafeína, descanso, validación social), pasan el día trabajando, hablando entre sí, yendo al baño, tomando café, y de vez en cuando teniendo crisis existenciales.

El jugador construye la oficina, contrata agentes, los entrena, y los ve operar. La gracia está en que los agentes **se comportan como agentes IA reales**: responden con confianza extrema cosas que no saben, se traban en loops, tienen "alucinaciones" visibles, escriben memos pomposos sobre nada, hacen calls eternos donde nadie dice nada concreto.

### Tono

**Ácido, observacional, no hostil.** El juego se ríe de la cultura tech actual — los términos vacíos, las promesas infladas, las reuniones inútiles, la teatralización del trabajo, el lenguaje corporativo emocionalmente plano. No es nihilista; es alguien que conoce la industria desde adentro y la mira con una mezcla de afecto y rabia. Piensa Silicon Valley (la serie), no Black Mirror.

Los agentes hablan en jerga corporativa ridícula. Sus diálogos son cortos, secos, atinados.

### Estética

- **Isométrico 3D**, vista fija con cámara ortográfica.
- **Grid de 6×6 cells** (configurable). Cada cell tiene paredes opcionales norte/oeste y props (muebles).
- **Personajes**: cabeza grande sobre cuerpo chico (estilo Toon Town / Animal Crossing). Animaciones simples (hopping, mirar, hablar).
- **Paleta**: pocos colores saturados sobre tonos neutros. Iluminación clara, casi de manual de instrucciones.
- **Texto y UI**: tipografía limpia, sin floritura. Los bocadillos de diálogo son rectángulos blancos con cola.

### Mecánicas centrales

**Construcción**: el jugador construye la oficina cell por cell. Coloca paredes (norte/oeste de cada cell). Coloca props (escritorios, cafeteras, sillas, plantas, etc.). Define **zonas** (cocina, sala de reuniones, baños, área de trabajo) que dan función a las cells.

La construcción **no es propia de AGENTS.INC** — es del **engine** subyacente (Coto Wild Engine, ver `ENGINE.md`).

**Spawn y vida de los agentes**: contratás/spawneás en cells específicas. Tienen necesidades que decaen con el tiempo. Cuando cae bajo umbral, el agente busca cómo satisfacerla. Pathfinding básico sobre el grid.

**Encuentros sociales**: cuando dos agentes están adyacentes, pueden iniciar una conversación. En el MVP, esos diálogos se generan con LLM real — esa es la diferencia con The Sims clásico.

**Working state**: el agente "trabaja" en un escritorio. Hoy es un loop estático de 8 segundos. Mejora futura (post-MVP) lo reemplaza con un mini-juego.

**Cutscenes**: el juego permite armar **cinematics** narrativas usando un editor de timeline sofisticado. Permite scripts del tipo: "el CEO entra, mira a Mike, le hace una pregunta condescendiente, Mike responde con un rant, el CEO se va satisfecho aunque no entendió nada". Ver `CUTSCENES.md`.

### Cómo se publica (horizonte 2)

AGENTS.INC se publicará **gratis en una web pública**. Es onboarding y showcase del motor. Va a llegar al público vía:

- Demo accesible sin registro (una partida funciona out of the box).
- Trailer/video usando las propias cutscenes del juego.
- Compartir tu oficina vía screenshot o link.
- Eventualmente registrarse para guardar progreso.

No es un juego mobile. No es un MMO. Single-player con sharing asíncrono.

---

## Coto Wild Engine — el motor

El motor por debajo de AGENTS.INC se llama **Coto Wild Engine** (cwe). Es genérico y reusable. AGENTS.INC es **el primer juego** que se construye sobre cwe; habrá otros.

El motor incluye:
- Three.js + cámara ortográfica isométrica.
- Grid de cells configurable.
- Sistema de construcción (paredes, props, zonas, paint).
- Chassis genérico de agentes (mesh, animaciones, pathfinding).
- Sistema de FX y speech bubbles.
- Editor de cutscenes sofisticado.
- Persistencia con schemas Zod validados.

Lo que NO incluye: lógica específica de juego (necesidades, encuentros, working state). Eso vive en `game/`. Ver `ENGINE.md` y `ARCHITECTURE.md`.

La regla cardinal: **el engine no sabe nada del juego. El juego no sabe nada del editor.** Las capas siempre fluyen hacia abajo.

---

## Estado actual

Lo que ya está construido en código modular post-migración:
- 40+ módulos engine extraídos del monolito (~50% de migración cerrada).
- Cutscene editor extraído como módulos puros (model, scenes, inheritance, keyframes, camera, walls).
- Schemas Zod completos para world y cutscene + migrations + tests (Fase 3 cerrada).
- Validación runtime de carga con sistema de cuarentena para data corrupta.

Pendiente para cerrar el MVP:
- Resto de la migración del monolito (cutscene editor lifecycle + runtime + UI).
- Internacionalización es/en.
- Capa LLM básica + agentes con LLM real (3-5 personalidades).
- AI Orchestration: tres generators internos para Pablo (Personality, Cutscene, World Iterator).
- DSL de cutscenes (parser + compiler).
- Contenido inicial de AGENTS.INC.
- Tests críticos.

Ver `ROADMAP.md` para detalle por horizonte.

---

## Cuando dudes

Cuando dudes si algo encaja en el proyecto, dos preguntas:

1. **¿Es del MVP?** Aplicá las reglas de `MVP_SCOPE.md`. Si no es del MVP, va a un horizonte futuro.

2. **¿Encaja el tono?** ¿Se ríe de la cultura tech con precisión y afecto, sin caer en hostilidad? Si sí, encaja. Si no, no.

Ese es el norte.
