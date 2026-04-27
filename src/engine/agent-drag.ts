// Drag estilo Tomodachi: agente desaparece de su celda y un sprite "ghost"
// sigue al cursor con un sistema masa-resorte. La rotación oscila según
// velocidad horizontal (péndulo). Tint rojo cuando la celda destino es inválida.
//
// State interno encapsulado: el módulo es la fuente de verdad sobre quién
// está siendo arrastrado y dónde. Otros módulos consultan via getters.

import * as THREE from 'three';
import { CELL, GRID_W, GRID_H, centerX, centerZ } from './state';
import { isBlockedByProp } from './pathfinding';
import { getWorldPointFromEvent } from './raycaster';
import { getScene } from './scene-graph';
import { eventBus } from './event-bus';
import { startLandingAnim } from './landing-anim';
import { setAgentFacing, syncAgentMesh, type Agent } from './agent-chassis';

const SPRING_K = 65;
const DAMP_K = 14;
const LIFT_Y = 24;
const ROT_GAIN = 0.011;
const ROT_DAMP = 12;
const FACING_VEL_THRESHOLD = 8;
const IDLE_WOBBLE_FREQ = 5;
const IDLE_WOBBLE_AMP = 0.04;
const GHOST_RENDER_ORDER = 999;
const INVALID_TINT_R = 1;
const INVALID_TINT_G = 0.55;
const INVALID_TINT_B = 0.55;

type DragHooks = {
  getAgents: () => Agent[];
  onClearSelection: () => void;
  onLanded: (agent: Agent) => void;
};

let _hooks: DragHooks = {
  getAgents: () => [],
  onClearSelection: () => {},
  onLanded: () => {},
};

let isDragging = false;
let draggedAgent: Agent | null = null;
let ghost: THREE.Sprite | null = null;
let originalCx = 0;
let originalCy = 0;
let originalPx = 0;
let originalPy = 0;
let targetCx = 0;
let targetCy = 0;
let valid = false;
let cursorX = 0;
let cursorZ = 0;
let ghostX = 0;
let ghostZ = 0;
let velX = 0;
let velZ = 0;
let rot = 0;
let timeAcc = 0;

export function initAgentDrag(hooks: DragHooks): void {
  _hooks = hooks;
}

export function isAgentDragging(): boolean {
  return isDragging;
}

export function getDraggedAgent(): Agent | null {
  return draggedAgent;
}

export function getDragGhost(): THREE.Sprite | null {
  return ghost;
}

// Una celda es válida para drop si: dentro del grid + no bloqueada por prop
// + no ocupada por otro agente (excepto el ignorado).
export function isCellValidForAgentDrop(
  cx: number,
  cy: number,
  ignoreAgent?: Agent | null,
): boolean {
  if (cx < 0 || cx >= GRID_W || cy < 0 || cy >= GRID_H) return false;
  if (isBlockedByProp(cx, cy)) return false;
  for (const a of _hooks.getAgents()) {
    if (a === ignoreAgent) continue;
    if (a.cx === cx && a.cy === cy) return false;
  }
  return true;
}

export function startAgentDrag(agent: Agent): void {
  draggedAgent = agent;
  isDragging = true;
  originalCx = agent.cx;
  originalCy = agent.cy;
  originalPx = agent.px;
  originalPy = agent.py;
  targetCx = agent.cx;
  targetCy = agent.cy;
  agent.path = [];
  agent.target = null;
  agent.waiting = 0;
  agent.hopping = false;
  if (agent.mesh) agent.mesh.visible = false;
  const scene = getScene();
  if (!scene || !agent.mesh) return;
  const ghostMat = new THREE.SpriteMaterial({
    map: (agent.mesh.material as THREE.SpriteMaterial).map,
    depthTest: false,
    transparent: true,
    opacity: 1.0,
    alphaTest: 0.1,
    depthWrite: false,
  });
  ghost = new THREE.Sprite(ghostMat);
  ghost.scale.set(agent.spriteW, agent.spriteH, 1);
  ghost.renderOrder = GHOST_RENDER_ORDER;
  scene.add(ghost);
  ghostX = agent.px * CELL;
  ghostZ = agent.py * CELL;
  cursorX = ghostX;
  cursorZ = ghostZ;
  velX = 0;
  velZ = 0;
  rot = 0;
  timeAcc = 0;
  _hooks.onClearSelection();
}

export function updateAgentDragGhost(event: MouseEvent | PointerEvent): void {
  if (!isDragging || !draggedAgent) return;
  const wp = getWorldPointFromEvent(event);
  if (!wp) return;
  cursorX = wp.x;
  cursorZ = wp.z;
  const cx = Math.floor(wp.x / CELL);
  const cy = Math.floor(wp.z / CELL);
  targetCx = cx;
  targetCy = cy;
  valid = isCellValidForAgentDrop(cx, cy, draggedAgent);
}

export function updateAgentDragPhysics(dt: number): void {
  if (!isDragging || !ghost || !draggedAgent) return;
  timeAcc += dt;
  const fx = (cursorX - ghostX) * SPRING_K;
  const fz = (cursorZ - ghostZ) * SPRING_K;
  const dampX = -velX * DAMP_K;
  const dampZ = -velZ * DAMP_K;
  velX += (fx + dampX) * dt;
  velZ += (fz + dampZ) * dt;
  ghostX += velX * dt;
  ghostZ += velZ * dt;
  if (Math.abs(velX) > FACING_VEL_THRESHOLD) {
    setAgentFacing(draggedAgent, velX > 0 ? 'left' : 'right');
  }
  const targetRot = -velX * ROT_GAIN;
  const idle = Math.sin(timeAcc * IDLE_WOBBLE_FREQ) * IDLE_WOBBLE_AMP;
  const targetRotWithIdle = targetRot + idle;
  rot += (targetRotWithIdle - rot) * Math.min(1, ROT_DAMP * dt);
  const baseY = draggedAgent.spriteH / 2 + LIFT_Y;
  ghost.position.set(ghostX - centerX, baseY, ghostZ - centerZ);
  (ghost.material as THREE.SpriteMaterial).rotation = rot;
  const mat = ghost.material as THREE.SpriteMaterial;
  if (valid) mat.color.setRGB(1, 1, 1);
  else mat.color.setRGB(INVALID_TINT_R, INVALID_TINT_G, INVALID_TINT_B);
}

// Termina el drag. commit=true → aterriza en celda destino; commit=false →
// vuelve a posición original. Si aterrizó, dispara landing-anim + onLanded.
export function endAgentDrag(commit: boolean): void {
  if (!isDragging || !draggedAgent) return;
  const agent = draggedAgent;
  let landed = false;
  if (commit && valid) {
    agent.cx = targetCx;
    agent.cy = targetCy;
    agent.px = targetCx + 0.5;
    agent.py = targetCy + 0.5;
    eventBus.emit('agentMoved', { agent, cx: agent.cx, cy: agent.cy });
    landed = true;
  } else {
    agent.cx = originalCx;
    agent.cy = originalCy;
    agent.px = originalPx;
    agent.py = originalPy;
  }
  if (agent.mesh) {
    agent.mesh.visible = true;
    (agent.mesh.material as THREE.SpriteMaterial).rotation = 0;
  }
  syncAgentMesh(agent);
  if (ghost) {
    const scene = getScene();
    if (scene) scene.remove(ghost);
    (ghost.material as THREE.Material).dispose();
    ghost = null;
  }
  isDragging = false;
  draggedAgent = null;
  valid = false;
  if (landed) {
    startLandingAnim(agent as never);
    _hooks.onLanded(agent);
  }
}
