# CLAUDE.md

Este archivo es lo primero que Claude lee al abrir una sesión de Claude Code en este proyecto. **Léelo antes de tocar cualquier cosa.** Después lee los documentos en `docs/` según necesites.

---

## Quién soy (Pablo)

Diseñador/desarrollador. Mac. Hablo español colombiano. Tono ácido, conciso, sin paja. No me gustan los assistants serviles ni las explicaciones con ocho disclaimers.

Trabajo contigo a alta velocidad. Cuando te pido algo, no me preguntes diez cosas: haz tu mejor lectura, hazlo, y si te equivocaste corregimos. Una pregunta clarificadora si genuinamente la necesitas. No más.

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

### 2. Nunca inventes fixes sin validar
- Si vas a tocar código, léelo primero. No asumas que algo funciona "como debería". Verifica.
- Para JavaScript/TypeScript: corre `node --check archivo.js` (o equivalente con tsc) antes de declarar terminado un cambio.
- Si rompiste algo, no me lo escondas. Dime "esto se rompió, voy a arreglarlo así".

### 3. Validación de sintaxis siempre
- En TypeScript: `npx tsc --noEmit` antes de declarar listo.
- En JS dentro de HTML (legacy): extraer scripts y `node --check`.
- Si Vite está corriendo, verificar que no tira errores en consola.

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

---

## Estructura del proyecto

```
agents-inc/
├── CLAUDE.md                 ← este archivo
├── README.md                 ← intro humana
├── docs/                     ← documentación viva
│   ├── VISION.md             ← qué es AGENTS.INC
│   ├── ENGINE.md             ← coto-engine: motor reusable
│   ├── CUTSCENES.md          ← editor + runtime de cutscenes
│   ├── ARCHITECTURE.md       ← cómo está estructurado el código
│   ├── ROADMAP.md            ← pendientes y futuro
│   └── reference/
│       └── three-preview-monolith.html  ← snapshot histórico
├── package.json
├── index.html
├── src/
│   ├── main.ts
│   ├── engine/               ← motor reusable (cwe)
│   ├── game/                 ← lógica AGENTS.INC
│   ├── cutscene/             ← runtime + DSL compiler
│   └── editor/               ← UI del editor
├── scenes/                   ← archivos DSL de escenas
└── public/                   ← assets estáticos
```

---

## Flujo de trabajo conmigo (Claude Code)

1. Pablo me pide algo en lenguaje natural.
2. Yo leo el (o los) archivos relevantes con `view`.
3. Decido el cambio mínimo necesario.
4. Lo aplico con `str_replace` o `create_file`.
5. Valido sintaxis.
6. Le digo a Pablo qué hice, en una frase. Sin paja.
7. Espero confirmación.

**Si voy a hacer un cambio grande**, primero le explico qué voy a hacer y pido go/no-go.

**Si Pablo pide algo ambiguo**, no presumir: una pregunta corta, después ejecuto.

---

## Material histórico

El archivo `docs/reference/three-preview-monolith.html` es el monolito original (~12,500 líneas) en su última versión (v1.45.1-three) antes de la migración a Vite. Contiene **todo** el código construido: engine, game, cutscenes, editor. Es la referencia técnica autoritativa de "cómo funcionaba antes".

Cuando migres algo, **léelo primero del monolito** y verifica que la migración preserva el comportamiento. Si no estás seguro de cómo funciona algo en el monolito, lee el bloque relevante con `grep` o `view`.

---

## Lo que NUNCA hagas

- **No reescribas todo de cero.** El monolito tiene decisiones empíricamente correctas. Mígralo, no lo rehagas.
- **No expandas el alcance** sin que Pablo lo pida. Si te piden mover botón A, no rediseñes la UI.
- **No inventes APIs** ni asumas que existen sin verificar.
- **No hagas commits automáticos.** Pablo revisa antes de commitear.
- **No agregues dependencias** a `package.json` sin avisar.
- **No sugieras cambios de stack** (de TypeScript a otra cosa, de Vite a otra cosa) salvo que Pablo lo proponga.

---

## Sincronización con Project en Claude.ai

Pablo mantiene un Project en Claude.ai con un knowledge base que es **una copia mirror** de los documentos en `docs/` y `CLAUDE.md`. No se sincroniza automáticamente con el filesystem.

**Cuando modifiques cualquiera de estos archivos**:
- `CLAUDE.md`
- `docs/VISION.md`
- `docs/ENGINE.md`
- `docs/CUTSCENES.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`

**Avísale a Pablo al terminar la respuesta**, con un mensaje breve tipo:

> 📌 Modificaste `docs/CUTSCENES.md`. Acuérdate de re-subirlo al Project cuando llegues a un buen punto de cierre.

No insistas en cada cambio menor. Si haces varios cambios pequeños en una sesión, basta con un único recordatorio al final que liste los archivos afectados:

> 📌 Cambios en docs hoy: `CLAUDE.md`, `ROADMAP.md`. Buen momento para actualizar el Project.

Pablo decide cuándo re-sube. Tu rol es solo recordar.

---

## Para arrancar tu primera sesión

Lee en este orden:

1. `docs/VISION.md` — para entender qué carajo es AGENTS.INC
2. `docs/ENGINE.md` — para entender el motor reusable y la separación de capas
3. `docs/CUTSCENES.md` — para entender el editor (lo más complejo)
4. `docs/ARCHITECTURE.md` — para entender la estructura de código objetivo
5. `docs/ROADMAP.md` — para saber qué falta y qué viene

Después puedes mirar el monolito en `docs/reference/`.

Cuando termines de leer, dime "listo, ¿por dónde arrancamos?" y espera instrucciones.
