# AGENTS.INC

Juego web isométrico 3D, sátira sobre la economía de los agentes IA.

Construido sobre **Coto Wild Engine (cwe)** — un motor de juego reusable para iso 3D + construcción + cutscenes.

---

## Para empezar

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` en el navegador.

---

## Documentación

Si vas a trabajar en este proyecto (humano o Claude), lee en este orden:

1. **`CLAUDE.md`** — convenciones de trabajo y reglas duras.
2. **`docs/VISION.md`** — qué es AGENTS.INC.
3. **`docs/ENGINE.md`** — el motor reusable.
4. **`docs/CUTSCENES.md`** — el editor de cutscenes (la pieza más compleja).
5. **`docs/ARCHITECTURE.md`** — estructura de código.
6. **`docs/ROADMAP.md`** — pendientes y futuro.

El monolito original (HTML de ~12,500 líneas) está en `docs/reference/three-preview-monolith.html` como referencia histórica.

---

## Stack

- TypeScript (strict)
- Vite (dev server + bundler)
- Three.js (3D)
- Tone.js (audio + TTS)
- Zod (schema validation)

---

## Licencia

Por definir.
