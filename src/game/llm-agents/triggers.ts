/**
 * TriggerSystem — lógica determinística de cuándo un agente debe hablar.
 *
 * Eventos:
 * - social_encounter: dos agentes adyacentes (chebyshev <= 1) hace > 3s.
 *   Cooldown por par (ordenado lexicográfico): 60s post-encuentro.
 * - crisis: necesidad < 20 dispara monólogo. Cooldown por (agentId, needKind): 60s.
 *
 * NOTA: triggers NO duplica el rate limit per-agent que ya hace AgentBrain.
 * Si AgentBrain rechaza por cooldown, el trigger igual gastó un tick. Aceptable.
 */

const SOCIAL_ADJ_MS = 3000;        // 3s adyacentes para emit social.
const SOCIAL_PAIR_COOLDOWN_MS = 60000;
const CRISIS_NEED_THRESHOLD = 20;
const CRISIS_COOLDOWN_MS = 60000;
const CRISIS_NEED_KINDS = ['hunger', 'energy', 'social', 'fun'] as const;

export type TriggerEvent =
  | { type: 'social_encounter'; speaker: string; target: string; t: number }
  | { type: 'crisis'; agent: string; need: string; level: number; t: number };

export type TriggerOpts = {
  nowMs(): number;
  getAgentCell(agentId: string): { cx: number; cy: number } | null;
  listActiveAgentIds(): string[];
  getAgentNeed?(agentId: string, kind: string): number | null;
};

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function chebyshev(a: { cx: number; cy: number }, b: { cx: number; cy: number }): number {
  return Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy));
}

type PairState = { firstAdjT: number | null; lastTriggerT: number };
type CrisisState = { lastTriggerT: number };

export class TriggerSystem {
  private pairState = new Map<string, PairState>();
  private crisisState = new Map<string, CrisisState>();   // key: `${agentId}|${needKind}`
  private opts: TriggerOpts;

  constructor(opts: TriggerOpts) {
    this.opts = opts;
  }

  tick(): TriggerEvent[] {
    const events: TriggerEvent[] = [];
    const now = this.opts.nowMs();

    // ── Social encounters ────────────────────────────────────────────
    const ids = this.opts.listActiveAgentIds();
    const seenPairs = new Set<string>();

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]!;
        const b = ids[j]!;
        const cellA = this.opts.getAgentCell(a);
        const cellB = this.opts.getAgentCell(b);
        if (!cellA || !cellB) continue;
        const key = pairKey(a, b);
        seenPairs.add(key);
        const adjacent = chebyshev(cellA, cellB) <= 1;
        const state = this.pairState.get(key);

        if (adjacent) {
          if (!state) {
            this.pairState.set(key, { firstAdjT: now, lastTriggerT: 0 });
            continue;
          }
          // Si separados antes y volvieron adyacentes: reset firstAdjT.
          if (state.firstAdjT === null) {
            state.firstAdjT = now;
            continue;
          }
          const adjDuration = now - state.firstAdjT;
          if (adjDuration < SOCIAL_ADJ_MS) continue;
          // Cooldown chequeo.
          if (state.lastTriggerT > 0 && now - state.lastTriggerT < SOCIAL_PAIR_COOLDOWN_MS) continue;
          // Emit. Speaker arbitrario: el primero alfabéticamente.
          const speaker = a < b ? a : b;
          const target = a < b ? b : a;
          events.push({ type: 'social_encounter', speaker, target, t: now });
          state.lastTriggerT = now;
        } else {
          if (state) {
            // Reset firstAdjT al separarse. Cooldown se mantiene.
            state.firstAdjT = null;
          }
        }
      }
    }

    // Cleanup pares que ya no existen (agentes despawnaron).
    for (const key of this.pairState.keys()) {
      if (!seenPairs.has(key)) this.pairState.delete(key);
    }

    // ── Crisis ───────────────────────────────────────────────────────
    if (this.opts.getAgentNeed) {
      for (const id of ids) {
        for (const needKind of CRISIS_NEED_KINDS) {
          const level = this.opts.getAgentNeed(id, needKind);
          if (level === null || level === undefined) continue;
          if (level >= CRISIS_NEED_THRESHOLD) continue;
          const cKey = `${id}|${needKind}`;
          const cState = this.crisisState.get(cKey);
          if (cState && now - cState.lastTriggerT < CRISIS_COOLDOWN_MS) continue;
          events.push({ type: 'crisis', agent: id, need: needKind, level, t: now });
          this.crisisState.set(cKey, { lastTriggerT: now });
        }
      }
    }

    return events;
  }
}
