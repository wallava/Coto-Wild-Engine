// AGENTS.INC — entry point
// Slice 1.2: importa el bulk legacy del monolito.

import { setAgentTextureCatalog } from './engine/agent-texture';
import { BRAIN_FONT_SIZE, getItemSize } from './game/agent-kits';

// Wire engine ↔ game catalog ANTES de que legacy evalúe.
// engine/agent-texture es agnóstico de game; main.ts inyecta el catálogo concreto.
setAgentTextureCatalog({ brainFontSize: BRAIN_FONT_SIZE, getItemSize });

import './legacy';
import { mountLLMSettings } from './ui/settings-llm';
import { createSessionCostTracker } from './llm/cost-tracker';
import { getLLMClient, loadSessionCapFromStorage } from './llm/factory';
import { getGlobalQueue } from './llm/queue';
import { setupAgentRuntime } from './game/llm-agents/runtime';
import { ALL_PERSONALITIES, getPersonalityById } from './game/llm-agents/personalities';
import { logCall } from './game/llm-agents/logging';
import { showSpeechBubble } from './engine/speech';

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

// ── Agent runtime (Fase 5 R5) ──────────────────────────────────────
// Asignación hardcoded MVP: primeros 3 agents → 3 personalidades.
// Pablo puede sobrescribir via window.__assignPersonality(agentId, personalityId).
const _personalityAssignments = new Map<string, string>();

(window as any).__assignPersonality = (agentId: string, personalityId: string) => {
  _personalityAssignments.set(agentId, personalityId);
  console.log(`[llm-runtime] agent ${agentId} asignado a personalidad ${personalityId}`);
};

const llmClient = getLLMClient();
if (llmClient) {
  const runtime = setupAgentRuntime({
    listActiveAgentIds: () => {
      const agents = ((window as any)._cweAgents ?? []) as Array<{ id: string }>;
      return agents.map(a => a.id);
    },
    getAgentCell: (agentId: string) => {
      const agents = ((window as any)._cweAgents ?? []) as Array<{ id: string; cx: number; cy: number }>;
      const a = agents.find(x => x.id === agentId);
      return a ? { cx: a.cx, cy: a.cy } : null;
    },
    getAgentPositionX: (agentId: string) => {
      const agents = ((window as any)._cweAgents ?? []) as Array<{ id: string; px: number }>;
      const a = agents.find(x => x.id === agentId);
      return a ? a.px : null;
    },
    getAgentNeed: (agentId: string, kind: string) => {
      const agents = ((window as any)._cweAgents ?? []) as Array<{ id: string; needs?: Record<string, number> }>;
      const a = agents.find(x => x.id === agentId);
      if (!a || !a.needs) return null;
      const v = a.needs[kind];
      return typeof v === 'number' ? v : null;
    },
    personalityFor: (agentId: string) => {
      // Asignación manual via window.__assignPersonality, o auto-asignar las 3 primeras.
      const manual = _personalityAssignments.get(agentId);
      if (manual) return getPersonalityById(manual) ?? null;
      // Auto: primeros 3 agents en orden de creación → 3 personalidades.
      const agents = ((window as any)._cweAgents ?? []) as Array<{ id: string }>;
      const idx = agents.findIndex(a => a.id === agentId);
      if (idx >= 0 && idx < ALL_PERSONALITIES.length) {
        return ALL_PERSONALITIES[idx] ?? null;
      }
      return null;
    },
    agentRef: (agentId: string) => {
      const agents = ((window as any)._cweAgents ?? []) as Array<any>;
      return agents.find(a => a.id === agentId) ?? null;
    },
    client: llmClient,
    tracker: llmTracker,
    queue: getGlobalQueue(),
    showSpeechBubble: showSpeechBubble as any,
    onCallEnd: (info) => {
      logCall({
        agentId: info.agentId,
        target: '<...>',
        model: 'haiku-4-5',
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        cacheHit: false,
        latencyMs: info.durationMs,
        costUSD: info.cost,
        ...(info.reason ? { errorCode: info.reason } : {}),
      });
    },
  });
  (window as any).__llmRuntime = runtime;
  console.log('[llm-runtime] setup OK. Tick cada 1s.');
} else {
  console.log('[llm-runtime] sin API key cargada. Setear key en Settings 🤖 LLM para activar.');
}
