// AGENTS.INC — entry point
// Slice 1.2: importa el bulk legacy del monolito.

import './legacy';
import { mountLLMSettings } from './ui/settings-llm';
import { createSessionCostTracker } from './llm/cost-tracker';
import { loadSessionCapFromStorage } from './llm/factory';

console.log('[AGENTS.INC] v0.3.0 fase 1.2 — bulk monolito cargado');

// ── Settings LLM (Fase 5) ──────────────────────────────────────────
// Tracker compartido para toda la sesión. Cap inicial leído de localStorage.
const llmTracker = createSessionCostTracker({ capUSD: loadSessionCapFromStorage() });
const llmSettings = mountLLMSettings({ tracker: llmTracker });

document.getElementById('btn-llm-settings')?.addEventListener('click', () => {
  if (llmSettings.isOpen()) llmSettings.close();
  else llmSettings.open();
});

// Expose para console testing en DevTools.
(window as any).__llmTracker = llmTracker;
(window as any).__llmSettings = llmSettings;
