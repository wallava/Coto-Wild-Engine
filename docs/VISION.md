# VISION.md — Qué es AGENTS.INC

## La idea

AGENTS.INC es un juego web isométrico 3D que es **una sátira sobre la economía de los agentes IA**. Muestras una "fábrica de agentes IA" — una oficina con cubículos, salas de reuniones, máquinas de café, baños — donde los agentes son trabajadores AI representados como personajes con cabezas grandes y cuerpos chicos. Los agentes tienen necesidades (cafeína, descanso, validación social) y pasan el día trabajando, hablando entre sí, yendo al baño, tomando café, y de vez en cuando teniendo crisis existenciales.

El jugador construye la oficina, contrata agentes, los entrena, y los ve operar. La gracia está en que los agentes **se comportan como agentes IA reales malditos**: responden con confianza extrema cosas que no saben, se traban en loops, tienen "alucinaciones" visibles, escriben memos pomposos sobre nada, hacen calls eternos donde nadie dice nada concreto. La sátira es ácida pero precisa.

## Tono

**Ácido, observacional, no hostil.** El juego se ríe de la cultura tech actual — los términos vacíos, las promesas infladas, las reuniones inútiles, la teatralización del trabajo, el lenguaje corporativo emocionalmente plano. No es nihilista; es alguien que conoce la industria desde adentro y la mira con una mezcla de afecto y rabia. Piensa Silicon Valley (la serie), no Black Mirror.

Los agentes hablan en jerga corporativa ridícula. Sus diálogos son cortos, secos, atinados.

## Estética

- **Isométrico 3D**, vista fija con cámara ortográfica.
- **Grid de 6×6 cells** (configurable). Cada cell tiene paredes opcionales norte/oeste y props (muebles).
- **Personajes**: cabeza grande sobre cuerpo chico (estilo Toon Town / Animal Crossing). Animaciones simples (hopping, mirar, hablar).
- **Paleta**: pocos colores saturados sobre tonos neutros. Iluminación clara, casi de manual de instrucciones.
- **Texto y UI**: tipografía limpia, sin floritura. Los bocadillos de diálogo son rectángulos blancos con cola.

## Mecánicas centrales

### Construcción
El jugador construye la oficina cell por cell:
- Coloca paredes (norte/oeste de cada cell).
- Coloca props (escritorios, cafeteras, sillas, plantas, etc.).
- Define **zonas** (cocina, sala de reuniones, baños, área de trabajo) que dan función a las cells.

**Importante**: la mecánica de construcción no es propia de AGENTS.INC — es del **engine**. Reusable para otros juegos (ver `ENGINE.md`).

### Spawn y vida de los agentes
- Los agentes se contratan/spawnean en cells específicas.
- Tienen **necesidades** que decaen con el tiempo (cafeína, energía, social, satisfacción profesional).
- Cuando una necesidad cae bajo cierto umbral, el agente busca cómo satisfacerla: va a la cocina por café, busca interactuar con otro agente, va al baño, etc.
- Pathfinding básico sobre el grid.

### Encuentros sociales
Cuando dos agentes están en cells adyacentes, pueden iniciar una conversación corta. Los diálogos son procedurales (templates con variables) y ridículos. Esta mecánica todavía no está implementada (B.9 en el roadmap).

### Working state
Cuando un agente "trabaja" en un escritorio, hoy entra en un loop de 8 segundos estáticos. La idea futura (B.11) es reemplazar esto con un mini-juego: la cámara hace zoom, aparecen tap-targets, y el jugador colabora en una microtarea ridícula (escribir un email, validar un PR, asistir un standup). Mucho más divertido que ver al agente parado.

### Cutscenes
El juego permite armar **cinematics** narrativas usando un editor de timeline sofisticado. Permite scripts narrativos del tipo: "el CEO entra, mira a Mike, le hace una pregunta condescendiente, Mike responde con un rant, el CEO se va satisfecho aunque no entendió nada". Ver `CUTSCENES.md`.

El editor es **inusualmente potente** para un proyecto solo: cámara con lentes reales, multi-selección con lasso, drag no destructivo, herencia de estado entre planos, planos como entidades estables. La visión es que las cutscenes sirven tanto para storytelling del juego como para promo/trailers.

## Por qué este juego

Hay tres razones empíricas:

1. **El momento cultural** — la economía de los agentes IA es absurda y nadie está haciendo el chiste bien. Hay una ventana para meter una sátira con punto de vista.

2. **El motor reusable** — la mecánica isométrica + construcción + props + cámara cinemática + cutscenes es un kit que sirve para muchos juegos. AGENTS.INC es el primer producto sobre ese motor; vendrán otros (ver `ENGINE.md`).

3. **El editor de cutscenes como producto secundario** — es lo bastante sólido como para ser una herramienta independiente. Una vez separado del juego, podría exponerse como editor in-engine para otros desarrolladores.

## Lo que NO es

- **No es un management sim profundo.** No hay finanzas complejas, ni trees de tecnologías, ni multi-temporada. Las mecánicas son pocas pero pulidas.
- **No es un sandbox infinito.** Hay un grid finito (~6×6 expandible) y una cantidad limitada de agentes simultáneos.
- **No es un juego mobile.** Es desktop web, controles de mouse y teclado.
- **No es un MMO.** Single-player. Quizás eventualmente "comparte tu oficina" tipo screenshots, pero no online en tiempo real.

## Estado actual

Lo que ya está construido (en el monolito):
- Motor 3D iso completo (cámara, grid, walls, props, lighting básico).
- Construcción y placement de objetos.
- Agentes con animaciones básicas, pathfinding simple, voces TTS.
- Sistema de necesidades y working state estático.
- Editor de cutscenes completo (la pieza más madura del proyecto).
- Speech bubbles unificados con audio.

Lo que falta (ver `ROADMAP.md` para detalle):
- Encuentros sociales automáticos.
- Mini-juego del working state.
- HeldItem dinámico (café, papeles).
- Render MP4 de cutscenes.
- Audio tracks en cutscenes.
- Construcción mediada por agentes (muebles "en obra").
- Performance (dirty rebuild de paredes, parent/child stacks).
- DSL de cutscenes (alta prioridad — ver `CUTSCENES.md`).

---

Este es el norte. Cuando dudes si algo encaja en AGENTS.INC, pregúntate: ¿se ríe de la cultura tech con precisión y afecto, sin caer en hostilidad? Si sí, encaja.
