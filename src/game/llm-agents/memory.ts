import { z } from 'zod';

export type EpisodeType = 'spoke_to' | 'overheard' | 'witnessed' | 'felt';

export type Episode = {
  id: string;
  t: number;
  type: EpisodeType;
  participants: string[];
  summary: string;
  importance: number;   // 0-1
};

export type Fact = {
  id: string;
  t: number;
  text: string;
  importance: number;
};

export type RelationshipState = {
  affinity: number;     // -1..1
  lastInteractionT: number;
  encounterCount: number;
};

export type AgentMemory = {
  version: number;
  agentId: string;
  episodes: Episode[];
  facts: Fact[];
  relationships: Record<string, RelationshipState>;
};

export type PruneOptions = {
  keepRecent: number;   // default 20
  keepImportant: number;// default 30
  maxTotal: number;     // default 50
};

export const CURRENT_MEMORY_VERSION = 1;

export const EpisodeTypeSchema = z.enum(['spoke_to', 'overheard', 'witnessed', 'felt']);

export const EpisodeSchema = z.object({
  id: z.string().min(1),
  t: z.number().nonnegative(),
  type: EpisodeTypeSchema,
  participants: z.array(z.string()),
  summary: z.string(),
  importance: z.number().min(0).max(1),
});

export const FactSchema = z.object({
  id: z.string().min(1),
  t: z.number().nonnegative(),
  text: z.string(),
  importance: z.number().min(0).max(1),
});

export const RelationshipStateSchema = z.object({
  affinity: z.number().min(-1).max(1),
  lastInteractionT: z.number().nonnegative(),
  encounterCount: z.number().int().nonnegative(),
});

export const AgentMemorySchema = z.object({
  version: z.number().int().positive(),
  agentId: z.string().min(1),
  episodes: z.array(EpisodeSchema),
  facts: z.array(FactSchema),
  relationships: z.record(z.string(), RelationshipStateSchema),
});

// ── CRUD ─────────────────────────────────────────────────────────────

export function createEmptyMemory(agentId: string): AgentMemory {
  return {
    version: CURRENT_MEMORY_VERSION,
    agentId,
    episodes: [],
    facts: [],
    relationships: {},
  };
}

let _episodeCounter = 0;
function newId(prefix: string): string {
  _episodeCounter++;
  return `${prefix}_${Date.now().toString(36)}_${_episodeCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

export function addEpisode(
  memory: AgentMemory,
  episode: { t: number; type: EpisodeType; participants: string[]; summary: string; importance: number },
): Episode {
  const newEp: Episode = {
    id: newId('ep'),
    t: episode.t,
    type: episode.type,
    participants: [...episode.participants],
    summary: episode.summary,
    importance: episode.importance,
  };
  memory.episodes.push(newEp);
  return newEp;
}

export function addFact(
  memory: AgentMemory,
  fact: { t: number; text: string; importance: number },
): Fact {
  const newF: Fact = {
    id: newId('fact'),
    t: fact.t,
    text: fact.text,
    importance: fact.importance,
  };
  memory.facts.push(newF);
  return newF;
}

export function updateRelationship(
  memory: AgentMemory,
  otherAgentId: string,
  patch: Partial<RelationshipState>,
): RelationshipState {
  const existing = memory.relationships[otherAgentId] ?? {
    affinity: 0,
    lastInteractionT: 0,
    encounterCount: 0,
  };
  const updated = { ...existing, ...patch };
  memory.relationships[otherAgentId] = updated;
  return updated;
}

// ── Importance scoring ───────────────────────────────────────────────

const IMPORTANCE_BASE = 0.5;
const IMPORTANCE_FIRST_ENCOUNTER_BONUS = 0.3;
const IMPORTANCE_LONG_SUMMARY_BONUS = 0.1;
const IMPORTANCE_LONG_SUMMARY_THRESHOLD = 100;
const IMPORTANCE_PER_EXTRA_PARTICIPANT = 0.05;
const IMPORTANCE_EXTRA_PARTICIPANT_CAP = 0.10;

/**
 * Heurística MVP de importance para un episodio nuevo. Combina señales
 * conocidas (primer encuentro, longitud del diálogo, cantidad de testigos)
 * en un score [0, 1]. Refinable post-validación gameplay.
 *
 * @param opts.isFirstEncounter true si el participante principal nunca
 *        habló con este agente antes (encounterCount === 0).
 * @param opts.summary texto del episodio. Diálogos largos pesan más.
 * @param opts.participantCount cuántos participantes (incluye actor + targets).
 *        Más testigos = más memorable. Cap a +0.10.
 * @returns score en [0, 1].
 */
export function computeEpisodeImportance(opts: {
  isFirstEncounter: boolean;
  summary: string;
  participantCount: number;
}): number {
  let score = IMPORTANCE_BASE;
  if (opts.isFirstEncounter) score += IMPORTANCE_FIRST_ENCOUNTER_BONUS;
  if (opts.summary.length > IMPORTANCE_LONG_SUMMARY_THRESHOLD) {
    score += IMPORTANCE_LONG_SUMMARY_BONUS;
  }
  const extras = Math.max(0, opts.participantCount - 1);
  const participantBonus = Math.min(
    IMPORTANCE_EXTRA_PARTICIPANT_CAP,
    extras * IMPORTANCE_PER_EXTRA_PARTICIPANT,
  );
  score += participantBonus;
  return Math.min(1, Math.max(0, score));
}

// ── Pruning ──────────────────────────────────────────────────────────

const DEFAULT_PRUNE: PruneOptions = { keepRecent: 20, keepImportant: 30, maxTotal: 50 };

/**
 * Mantiene unión de:
 * - Últimos `keepRecent` por t descendente.
 * - Top `keepImportant` por importance descendente.
 * Dedup por episode.id. Sort estable. Si union > maxTotal, trim
 * por (importance asc, t asc — más viejo y menos importante primero).
 */
export function pruneOldEpisodes(
  memory: AgentMemory,
  opts: Partial<PruneOptions> = {},
): void {
  const { keepRecent, keepImportant, maxTotal } = { ...DEFAULT_PRUNE, ...opts };
  const all = memory.episodes;
  if (all.length === 0) return;

  // Tagged sort: stable order preserved on ties via index.
  const byRecency = [...all].sort((a, b) => b.t - a.t || a.id.localeCompare(b.id));
  const byImportance = [...all].sort((a, b) => b.importance - a.importance || b.t - a.t || a.id.localeCompare(b.id));

  const recentSet = new Set(byRecency.slice(0, keepRecent).map((e) => e.id));
  const importantSet = new Set(byImportance.slice(0, keepImportant).map((e) => e.id));

  const unionIds = new Set([...recentSet, ...importantSet]);
  let kept = all.filter((e) => unionIds.has(e.id));

  if (kept.length > maxTotal) {
    // Trim por (importance asc, t asc, id asc) → eliminar primero los menos
    // importantes y más antiguos.
    kept = kept
      .slice()
      .sort((a, b) => a.importance - b.importance || a.t - b.t || a.id.localeCompare(b.id))
      .slice(kept.length - maxTotal);
  }

  // Restaurar orden temporal ascendente.
  kept.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
  memory.episodes = kept;
}
