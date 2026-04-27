// Sprite de status (emoji sobre la cabeza del agente). Crea/actualiza/borra
// el sprite según el emoji target. Idempotente: si emoji === statusEmoji
// actual, no toca nada.

import * as THREE from 'three';
import { getScene } from './scene-graph';

const EMOJI_FONT = '72px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const CANVAS_SIZE = 96;
const SPRITE_SCALE = 36;
const SPRITE_RENDER_ORDER = 1001;

type AgentWithStatus = {
  statusEmoji?: string | null;
  statusMesh?: THREE.Sprite | null;
};

// Borra el sprite actual del agente (si lo hay). Dispone material y textura.
export function clearAgentStatus(agent: AgentWithStatus): void {
  if (!agent.statusMesh) return;
  const scene = getScene();
  if (scene) scene.remove(agent.statusMesh);
  const mat = agent.statusMesh.material;
  if (mat) {
    if (mat.map) mat.map.dispose();
    mat.dispose();
  }
  agent.statusMesh = null;
  agent.statusEmoji = null;
}

// Si el emoji target == statusEmoji actual, no hace nada. Si difiere,
// elimina el sprite previo y crea uno nuevo (o ninguno si emoji vacío).
export function ensureAgentStatus(agent: AgentWithStatus, emoji: string | null | undefined): void {
  if (agent.statusEmoji === emoji) return;
  clearAgentStatus(agent);
  agent.statusEmoji = emoji ?? null;
  if (!emoji) return;
  const scene = getScene();
  if (!scene) return;
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.font = EMOJI_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    depthTest: false,
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(SPRITE_SCALE, SPRITE_SCALE, 1);
  sprite.renderOrder = SPRITE_RENDER_ORDER;
  scene.add(sprite);
  agent.statusMesh = sprite;
}
