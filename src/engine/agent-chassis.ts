// Chassis del agente: spawn + mesh + sync + facing. El agente es un sprite
// THREE con dos texturas (left/right) que se intercambian según movimiento.
// La altura del sprite hace que su base toque el piso; hop sube el offset Y.
//
// Hooks externos via init():
//   - getDraggedAgent / getAgentDragGhost: drag system (legacy hasta extraer)
//   - getSelectedAgent / getAgentHighlight: selection ring
//   Cuando facing/sync corren, llaman estos hooks para mantener ghost/ring sincronizados.

import * as THREE from 'three';
import { CELL, centerX, centerZ } from './state';
import { getScene } from './scene-graph';
import { createAgentTexture } from './agent-texture';
import { eventBus } from './event-bus';
import { uid } from '../utils/id';
import { pickVoiceIdx } from './voices';

const SPRITE_W = 100;
const SPRITE_H = 80;
const HOP_FREQ = 5.5;
const HOP_HEIGHT = 7;
const AGENT_SPEED_CELLS_PER_SEC = 2.2;
const HIGHLIGHT_Y = 0.3;
const NEED_INITIAL_MIN = 70;
const NEED_INITIAL_RANGE = 25;
const RENDER_ORDER_AGENT = 2;

export type Agent = {
  id: string;
  cx: number;
  cy: number;
  px: number;
  py: number;
  path: [number, number][];
  target: [number, number] | null;
  speed: number;
  waiting: number;
  emoji: [string, string];
  spriteW: number;
  spriteH: number;
  hopTime: number;
  hopFreq: number;
  hopHeight: number;
  hopping: boolean;
  mesh: THREE.Sprite | null;
  heldItem: unknown;
  facing: 'left' | 'right';
  texRight: THREE.CanvasTexture | null;
  texLeft: THREE.CanvasTexture | null;
  voiceIdx: number;
  needs: { focus: number; hunger: number; social: number; bathroom: number };
  working: { prop: unknown; zoneKind: string; duration: number; elapsed: number } | null;
  _csAgent: boolean;
  talking: boolean;
  statusEmoji: string | null;
  statusMesh: THREE.Sprite | null;
};

export type SpawnOpts = {
  id?: string;
  emoji?: [string, string];
  voiceIdx?: number;
  needs?: Partial<Agent['needs']>;
  heldItem?: unknown;
  csAgent?: boolean;
};

type ChassisHooks = {
  getDraggedAgent: () => Agent | null;
  getAgentDragGhost: () => THREE.Sprite | null;
  getSelectedAgent: () => Agent | null;
  getAgentHighlight: () => THREE.Mesh | null;
  pickRandomKit: () => [string, string];
};

let _hooks: ChassisHooks = {
  getDraggedAgent: () => null,
  getAgentDragGhost: () => null,
  getSelectedAgent: () => null,
  getAgentHighlight: () => null,
  pickRandomKit: () => ['🧠', '💡'],
};

export function initAgentChassis(hooks: Partial<ChassisHooks>): void {
  _hooks = { ..._hooks, ...hooks };
}

// Crea el sprite del agente, lo agrega a la escena y posiciona.
export function createAgentMesh(agent: Agent): void {
  agent.texRight = createAgentTexture(agent.emoji[0], agent.emoji[1], false);
  agent.texLeft = createAgentTexture(agent.emoji[0], agent.emoji[1], true);
  const mat = new THREE.SpriteMaterial({
    map: agent.facing === 'left' ? agent.texLeft : agent.texRight,
    depthTest: true,
    transparent: true,
    alphaTest: 0.1,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(agent.spriteW, agent.spriteH, 1);
  sprite.renderOrder = RENDER_ORDER_AGENT;
  sprite.userData['isAgent'] = true;
  agent.mesh = sprite;
  const scene = getScene();
  if (scene) scene.add(sprite);
  syncAgentMesh(agent);
}

// Cambia la dirección visible del sprite. Si está dragged, también actualiza
// el ghost del drag system (via hook).
export function setAgentFacing(agent: Agent | null, facing: 'left' | 'right'): void {
  if (!agent || !agent.mesh) return;
  if (facing !== 'left' && facing !== 'right') return;
  if (agent.facing === facing) return;
  agent.facing = facing;
  const tex = facing === 'left' ? agent.texLeft : agent.texRight;
  if (tex && agent.mesh.material) {
    (agent.mesh.material as THREE.SpriteMaterial).map = tex;
    (agent.mesh.material as THREE.SpriteMaterial).needsUpdate = true;
  }
  const dragged = _hooks.getDraggedAgent();
  const ghost = _hooks.getAgentDragGhost();
  if (dragged === agent && ghost && ghost.material) {
    (ghost.material as THREE.SpriteMaterial).map = tex;
    (ghost.material as THREE.SpriteMaterial).needsUpdate = true;
  }
}

// Posiciona el mesh del agente según px/py (con hop offset Y). Si es el
// agente seleccionado, también mueve el highlight ring (via hook).
export function syncAgentMesh(agent: Agent): void {
  if (!agent.mesh) return;
  const baseY = agent.spriteH / 2;
  const yOff = agent.hopping
    ? Math.abs(Math.sin(agent.hopTime)) * agent.hopHeight
    : 0;
  agent.mesh.position.set(
    agent.px * CELL - centerX,
    baseY + yOff,
    agent.py * CELL - centerZ,
  );
  const selected = _hooks.getSelectedAgent();
  const highlight = _hooks.getAgentHighlight();
  if (selected === agent && highlight) {
    highlight.position.set(
      agent.px * CELL - centerX,
      HIGHLIGHT_Y,
      agent.py * CELL - centerZ,
    );
  }
}

// Crea un agente nuevo con todos sus campos default + crea su mesh.
// Empuja al array agents que se pasa, emite 'agentSpawned'.
export function spawnAgent(
  agents: Agent[],
  cx: number,
  cy: number,
  opts: SpawnOpts = {},
): Agent {
  const kit: [string, string] = opts.emoji || _hooks.pickRandomKit();
  const agentId = opts.id || uid();
  const needs = opts.needs;
  const agent: Agent = {
    id: agentId,
    cx,
    cy,
    px: cx + 0.5,
    py: cy + 0.5,
    path: [],
    target: null,
    speed: AGENT_SPEED_CELLS_PER_SEC,
    waiting: 0,
    emoji: kit,
    spriteW: SPRITE_W,
    spriteH: SPRITE_H,
    hopTime: Math.random() * Math.PI * 2,
    hopFreq: HOP_FREQ,
    hopHeight: HOP_HEIGHT,
    hopping: false,
    mesh: null,
    heldItem: opts.heldItem || null,
    facing: 'right',
    texRight: null,
    texLeft: null,
    voiceIdx: opts.voiceIdx !== undefined ? opts.voiceIdx : pickVoiceIdx(agentId),
    needs: needs
      ? {
          focus: needs.focus ?? 80,
          hunger: needs.hunger ?? 80,
          social: needs.social ?? 80,
          bathroom: needs.bathroom ?? 80,
        }
      : {
          focus: NEED_INITIAL_MIN + Math.random() * NEED_INITIAL_RANGE,
          hunger: NEED_INITIAL_MIN + Math.random() * NEED_INITIAL_RANGE,
          social: NEED_INITIAL_MIN + Math.random() * NEED_INITIAL_RANGE,
          bathroom: NEED_INITIAL_MIN + Math.random() * NEED_INITIAL_RANGE,
        },
    working: null,
    _csAgent: !!opts.csAgent,
    talking: false,
    statusEmoji: null,
    statusMesh: null,
  };
  agents.push(agent);
  createAgentMesh(agent);
  eventBus.emit('agentSpawned', { agent });
  return agent;
}
