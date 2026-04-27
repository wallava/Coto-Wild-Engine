// Acciones de spawn/despawn disparadas por UI.
// Mantiene la lógica de gameplay fuera de legacy.ts y recibe por hooks el
// estado que todavía vive en el monolito: agents, selección y spawner visual.

import { GRID_H, GRID_W } from '../engine/state';
import { isAgentAt } from '../engine/agents-state';
import { isBlockedByProp } from '../engine/pathfinding';
import {
  getFloorStackBase,
  props,
  pushProp,
  removePropAt,
  type PropAny,
} from '../engine/world';
import { hasWallN, hasWallW, getCandidateWallSlots } from '../engine/wall-queries';
import { markWorldChanged } from '../engine/persistence';
import { PROP_TEMPLATES, WALL_PROP_TEMPLATES } from './prop-catalog';
import type { Agent, SpawnOpts } from '../engine/agent-chassis';

type SelectedProp = PropAny | null;

type SpawnAgentFn = (cx: number, cy: number, opts?: SpawnOpts) => Agent;

type SpawnerHooks = {
  getAgents: () => Agent[];
  getSelectedProp: () => SelectedProp;
  setSelectedProp: (prop: SelectedProp) => void;
  spawnAgent: SpawnAgentFn;
  onAfterMutation: () => void;
  onPropDeleted: (removed: PropAny) => void;
};

let _hooks: SpawnerHooks = {
  getAgents: () => [],
  getSelectedProp: () => null,
  setSelectedProp: () => {},
  spawnAgent: () => {
    throw new Error('[spawners] spawnAgent hook no inicializado');
  },
  onAfterMutation: () => {},
  onPropDeleted: () => {},
};

export function initSpawners(hooks: SpawnerHooks): void {
  _hooks = hooks;
}

function sample<T>(items: readonly T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function resetAgentPaths(): void {
  for (const agent of _hooks.getAgents()) {
    agent.path = [];
    agent.target = null;
  }
}

function applyMutationEffects(): void {
  resetAgentPaths();
  _hooks.onAfterMutation();
  markWorldChanged();
}

function isSameWallSlotOccupied(slot: { side: string; cx: number; cy: number }): boolean {
  return props.some((p) => {
    if (((p['category'] as string) || 'floor') !== 'wall') return false;
    return p['side'] === slot.side && p['cx'] === slot.cx && p['cy'] === slot.cy;
  });
}

/**
 * Intenta crear un prop random: primero cuadros en pared, luego muebles/pisos/stacks.
 * Devuelve false si no encuentra una celda válida después de varios intentos.
 */
export function spawnRandomProp(): boolean {
  if (Math.random() < 0.25 && WALL_PROP_TEMPLATES.length > 0) {
    const free = getCandidateWallSlots().filter((slot) => !isSameWallSlotOccupied(slot));
    const slot = sample(free);
    const tmpl = sample(WALL_PROP_TEMPLATES);
    if (slot && tmpl) {
      pushProp({ category: 'wall', side: slot.side, cx: slot.cx, cy: slot.cy, ...tmpl });
      applyMutationEffects();
      return true;
    }
  }

  let attempts = 0;
  while (attempts++ < 50) {
    const tmpl = sample(PROP_TEMPLATES);
    if (!tmpl) return false;
    const cx = Math.floor(Math.random() * (GRID_W - tmpl.w + 1));
    const cy = Math.floor(Math.random() * (GRID_H - tmpl.d + 1));
    const cat = tmpl.category || 'floor';

    if (cat === 'stack' && !getFloorStackBase(cx, cy)) continue;

    const overlaps = props.some((p) => {
      if (((p['category'] as string) || 'floor') !== cat) return false;
      const px = p['cx'] as number;
      const py = p['cy'] as number;
      const pw = (p['w'] as number) ?? 1;
      const pd = (p['d'] as number) ?? 1;
      return cx < px + pw && cx + tmpl.w > px && cy < py + pd && cy + tmpl.d > py;
    });
    if (overlaps) continue;

    if (cat === 'floor') {
      let blocked = false;
      for (let dy = 0; dy < tmpl.d && !blocked; dy++) {
        for (let dx = 0; dx < tmpl.w && !blocked; dx++) {
          if (isAgentAt(cx + dx, cy + dy)) blocked = true;
        }
      }
      if (blocked) continue;
    }

    if (tmpl.w === 2 && hasWallW(cx + 1, cy)) continue;
    if (tmpl.d === 2 && hasWallN(cx, cy + 1)) continue;

    pushProp({ cx, cy, ...tmpl });
    applyMutationEffects();
    return true;
  }

  return false;
}

/**
 * Elimina el último prop del mundo y sincroniza selección/render/persistencia.
 */
export function removeLastProp(): void {
  const removed = removePropAt(props.length - 1);
  if (!removed) return;
  if (_hooks.getSelectedProp() === removed) _hooks.setSelectedProp(null);
  _hooks.onPropDeleted(removed);
  applyMutationEffects();
}

/**
 * Intenta crear un agente en una celda libre de otros agentes y muebles bloqueantes.
 */
export function trySpawnAgent(): boolean {
  let attempts = 0;
  while (attempts++ < 30) {
    const cx = Math.floor(Math.random() * GRID_W);
    const cy = Math.floor(Math.random() * GRID_H);
    if (isAgentAt(cx, cy)) continue;
    if (isBlockedByProp(cx, cy)) continue;
    _hooks.spawnAgent(cx, cy);
    return true;
  }
  return false;
}
