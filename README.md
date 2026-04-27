# AGENTS.INC / Coto Wild Engine

Juego web isométrico 3D, sátira sobre la economía de los agentes IA, construido sobre **Coto Wild Engine (cwe)** — un motor de juego reusable para iso 3D + construcción + cutscenes.

---

## Para empezar

```bash
npm install
npm run dev
```

Abrí `http://localhost:5173` en el navegador.

Comandos útiles:

```bash
npm run dev               # dev server con HMR
npm test                  # tests Vitest (100/100 al 2026-04-27)
npx tsc --noEmit          # validación TypeScript
npm run smoke-test        # smoke test con Playwright (validación E2E mínima)
```

---

## Documentación

Si vas a trabajar en este proyecto (humano o Claude/Codex), leé en este orden:

1. **`CLAUDE.md`** — convenciones de trabajo y reglas duras (incluye flujo Codex y modo nocturno).
2. **`docs/VISION.md`** — qué es esto. Tres horizontes.
3. **`docs/MVP_SCOPE.md`** — qué SÍ y qué NO es del MVP. Crítico.
4. **`docs/ENGINE.md`** — el motor reusable.
5. **`docs/CUTSCENES.md`** — el editor de cutscenes (la pieza más compleja).
6. **`docs/AGENTS_LLM.md`** — agentes con LLM real.
7. **`docs/AI_ORCHESTRATION.md`** — los tres generators internos para Pablo.
8. **`docs/ARCHITECTURE.md`** — estructura de código.
9. **`docs/ROADMAP.md`** — pendientes y futuro por horizontes.
10. **`docs/PRODUCT_FUTURE.md`** — visión a largo plazo (horizonte 3).
11. **`WORK_LOG.md`** — log local de sesiones de trabajo (no se sincroniza al Project en Claude.ai).

El monolito original (HTML de ~12,500 líneas) está en `docs/reference/three-preview-monolith.html` como referencia histórica.

---

## Stack

- TypeScript (strict)
- Vite (dev server + bundler)
- Three.js (3D, r128)
- Tone.js (audio + TTS)
- Zod (schema validation + migrations)
- Vitest (tests)
- i18next (cuando llegue, es/en desde el setup)
- Anthropic API (cuando llegue capa LLM)

---

## Estado actual

- ✅ Migración del monolito ~50% (40+ módulos engine + 8 módulos cutscene + 4 módulos editor extraídos).
- ✅ Schemas Zod cerrados (Fase 3) con 100 tests verdes y validación runtime con cuarentena.
- 🟠 Próximo: cleanup docs + Fase 4 (DSL de cutscenes).

Ver `docs/ROADMAP.md` para detalle.

---

## Tooling Codex

Este proyecto usa el plugin oficial de Codex para Claude Code (`openai/codex-plugin-cc`). Permite delegación de tareas mecánicas a Codex (GPT-5.4-mini default) mientras Claude trabaja en razonamiento.

Setup:

```bash
npm install -g @openai/codex
codex login
# En Claude Code:
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
/codex:setup
```

Configuración del modelo en `.codex/config.toml`. Ver `CLAUDE.md` sección "Trabajo en equipo con Codex" para flujo formal.

---

## Licencia

Propietario por ahora. Reconsideración cuando llegue horizonte 3 (ver `docs/PRODUCT_FUTURE.md`).
