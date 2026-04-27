// Thought bubbles estilo Tomodachi Life: burbuja amarilla con scribble negro
// adentro, aparece sobre la cabeza del agente unos segundos. Bounce-in,
// hold, fade-out.

import * as THREE from 'three';
import { CELL, centerX, centerZ } from './state';

type ThoughtType = 'confused';

// Agent: tipo abierto. El schema oficial vive en legacy.ts hasta que se extraiga.
type AgentLike = {
  mesh?: THREE.Object3D;
  px: number;
  py: number;
  spriteH: number;
};

type ActiveThought = {
  agent: AgentLike;
  sprite: THREE.Sprite;
  t: number;
  duration: number;
  inDur: number;
  outDur: number;
};

const THOUGHT_BASE_W = 56;
const THOUGHT_BASE_H = 56;

const activeThoughts: ActiveThought[] = [];
let _scene: THREE.Scene | null = null;
let _textures: Record<ThoughtType, THREE.CanvasTexture> | null = null;

// Genera la textura de scribble (burbuja amarilla irregular + trazos enredados).
function createScribbleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fcdf2a';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const cx = 64, cy = 60, r = 48;
  const n = 14;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.86 + Math.sin(a * 3) * 0.07 + Math.cos(a * 5) * 0.05);
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  ctx.moveTo((pts[0]!.x + pts[n - 1]!.x) / 2, (pts[0]!.y + pts[n - 1]!.y) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const mid = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
    ctx.quadraticCurveTo(p.x, p.y, mid.x, mid.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Scribble adentro: trazos enredados negros (estilo TPL)
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(46, 50);
  ctx.bezierCurveTo(70, 30, 92, 60, 78, 78);
  ctx.bezierCurveTo(50, 92, 32, 78, 48, 52);
  ctx.bezierCurveTo(64, 36, 88, 50, 80, 70);
  ctx.bezierCurveTo(60, 82, 40, 68, 56, 48);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// Setup. Llamar una sola vez después de crear la scene.
export function initThoughtBubbles(scene: THREE.Scene): void {
  _scene = scene;
  _textures = {
    confused: createScribbleTexture(),
  };
}

export function showAgentThought(
  agent: AgentLike,
  type: ThoughtType,
  durationSec?: number,
): void {
  if (!_scene || !_textures) return;
  if (!agent || !agent.mesh) return;
  const tex = _textures[type] ?? _textures.confused;
  // Si ya hay un thought sobre este agente, removerlo
  for (let i = activeThoughts.length - 1; i >= 0; i--) {
    if (activeThoughts[i]!.agent === agent) {
      const t = activeThoughts[i]!;
      _scene.remove(t.sprite);
      (t.sprite.material as THREE.SpriteMaterial).dispose();
      activeThoughts.splice(i, 1);
    }
  }
  const mat = new THREE.SpriteMaterial({
    map: tex,
    depthTest: false,
    transparent: true,
    opacity: 0,
    alphaTest: 0.05,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0, 0, 1);
  sprite.renderOrder = 1000;
  _scene.add(sprite);
  activeThoughts.push({
    agent,
    sprite,
    t: 0,
    duration: durationSec ?? 2.5,
    inDur: 0.22,
    outDur: 0.32,
  });
}

export function updateThoughtBubbles(dt: number): void {
  if (!_scene) return;
  for (let i = activeThoughts.length - 1; i >= 0; i--) {
    const T = activeThoughts[i]!;
    T.t += dt;
    const total = T.inDur + T.duration + T.outDur;
    if (T.t >= total) {
      _scene.remove(T.sprite);
      (T.sprite.material as THREE.SpriteMaterial).dispose();
      activeThoughts.splice(i, 1);
      continue;
    }
    // Posición: sobre la cabeza del agente, leve offset hacia el costado
    const ax = T.agent.px * CELL - centerX + 18;
    const ay = T.agent.spriteH + 18;
    const az = T.agent.py * CELL - centerZ - 6;
    T.sprite.position.set(ax, ay, az);
    // Animación de scale + opacity
    let s = 1;
    let op = 1;
    if (T.t < T.inDur) {
      const x = T.t / T.inDur;
      // Bounce-in: ease-out cubic con overshoot leve
      const eased = 1 - Math.pow(1 - x, 3);
      s = eased * 1.15;
      if (x > 0.75) {
        // Settle del overshoot al 1.0
        const x2 = (x - 0.75) / 0.25;
        s = 1.15 - 0.15 * x2;
      }
      op = eased;
    } else if (T.t < T.inDur + T.duration) {
      s = 1;
      op = 1;
    } else {
      const x = (T.t - T.inDur - T.duration) / T.outDur;
      s = 1 + x * 0.1;
      op = 1 - x;
    }
    T.sprite.scale.set(THOUGHT_BASE_W * s, THOUGHT_BASE_H * s, 1);
    (T.sprite.material as THREE.SpriteMaterial).opacity = op;
  }
}
