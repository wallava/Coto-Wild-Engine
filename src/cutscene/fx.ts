/**
 * FX system para cutscenes: sprites de partículas + luces opcionales.
 * Estilos predefinidos (smoke, fire, sparks, light) con sprite procedural,
 * fade in/out, oscilación y trail vertical.
 *
 * No mantiene state singleton — el caller dueño del Map de instancias activas
 * (typically el editor) lo pasa como argumento. Permite tests + reuso fuera
 * del editor.
 */

import * as THREE from 'three';

export type FxKind = 'smoke' | 'fire' | 'sparks' | 'light';

export type FxPreset = {
  duration: number;
  color1: string;
  color2: string;
  size: number;
  rise: number;
  pulse: number;
  count: number;
  addLight?: boolean;
};

export const FX_PRESETS: Record<FxKind, FxPreset> = {
  smoke:  { duration: 3.0, color1: 'rgba(180,180,180,0.95)', color2: 'rgba(40,40,40,0)',  size: 90,  rise: 100, pulse: 0.20, count: 3 },
  fire:   { duration: 3.0, color1: 'rgba(255,220,80,1)',     color2: 'rgba(255,40,0,0)',   size: 110, rise: 50,  pulse: 0.55, count: 4 },
  sparks: { duration: 1.5, color1: 'rgba(255,255,200,1)',    color2: 'rgba(255,180,40,0)', size: 60,  rise: 30,  pulse: 0.85, count: 6 },
  light:  { duration: 4.0, color1: 'rgba(255,240,180,1)',    color2: 'rgba(255,180,80,0)', size: 200, rise: 0,   pulse: 0.20, count: 1, addLight: true },
};

export type FxTextureCache = Map<FxKind, THREE.CanvasTexture>;

export function createFxTextureCache(): FxTextureCache {
  return new Map();
}

export function makeFxTexture(kind: FxKind, cache: FxTextureCache): THREE.CanvasTexture {
  const cached = cache.get(kind);
  if (cached) return cached;
  const preset = FX_PRESETS[kind];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 60);
  grad.addColorStop(0, preset.color1);
  grad.addColorStop(0.5, preset.color1.replace(/[0-9.]+\)$/, '0.65)'));
  grad.addColorStop(1, preset.color2);
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  if (kind === 'sparks' || kind === 'light') {
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = preset.color1;
    g.lineWidth = 3;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(64, 64);
      g.lineTo(64 + Math.cos(ang) * 56, 64 + Math.sin(ang) * 56);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  cache.set(kind, tex);
  return tex;
}

type SpriteUserData = {
  offsetX: number;
  offsetZ: number;
  phase: number;
  baseSize: number;
};

export type FxInstance = {
  sprites: THREE.Sprite[];
  light: THREE.PointLight | null;
};

export type SpawnFxKf = { fx: FxKind };

export function spawnFxInstance(
  kf: SpawnFxKf,
  scene: THREE.Scene,
  cache: FxTextureCache,
): FxInstance | null {
  const preset = FX_PRESETS[kf.fx];
  if (!preset) return null;
  const tex = makeFxTexture(kf.fx, cache);
  const sprites: THREE.Sprite[] = [];
  for (let i = 0; i < preset.count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(preset.size, preset.size, 1);
    sp.position.y = -1000;
    mat.opacity = 0.01;
    sp.userData = {
      offsetX: (Math.random() - 0.5) * 20,
      offsetZ: (Math.random() - 0.5) * 20,
      phase: Math.random() * Math.PI * 2,
      baseSize: preset.size,
    } satisfies SpriteUserData;
    scene.add(sp);
    sprites.push(sp);
  }
  let light: THREE.PointLight | null = null;
  if (preset.addLight) {
    light = new THREE.PointLight(0xffd0a0, 1.5, 280, 2);
    scene.add(light);
  }
  return { sprites, light };
}

export function despawnFxInstance(inst: FxInstance | null | undefined, scene: THREE.Scene): void {
  if (!inst) return;
  for (const sp of inst.sprites) {
    if (sp.material) sp.material.dispose();
    scene.remove(sp);
  }
  if (inst.light) scene.remove(inst.light);
}

type AgentLike = { id: string; px: number; py: number };

type FxTarget =
  | { kind: 'agent'; id: string }
  | { kind: 'cell'; cx: number; cy: number };

export type UpdateFxKf = { fx: FxKind; target?: FxTarget; duration?: number };

export type WorldDims = {
  CELL: number;
  centerX: number;
  centerZ: number;
};

export function updateFxInstance(
  kf: UpdateFxKf,
  inst: FxInstance,
  progress: number,
  agents: AgentLike[],
  world: WorldDims,
): void {
  const preset = FX_PRESETS[kf.fx];
  if (!preset || !inst) return;
  let wx = 0, wz = 0, wy = 4;
  if (kf.target && kf.target.kind === 'agent') {
    const a = agents.find(x => x.id === (kf.target as any).id);
    if (a) {
      wx = a.px * world.CELL - world.centerX;
      wz = a.py * world.CELL - world.centerZ;
      wy = 30;
    }
  } else if (kf.target && kf.target.kind === 'cell') {
    wx = (kf.target.cx + 0.5) * world.CELL - world.centerX;
    wz = (kf.target.cy + 0.5) * world.CELL - world.centerZ;
    wy = 4;
  }
  const fadeIn = Math.min(1, progress * 8);
  const fadeOut = Math.min(1, (1 - progress) * 4);
  const alpha = Math.max(0, Math.min(1, fadeIn * fadeOut));
  const elapsed = progress * preset.duration;
  for (let i = 0; i < inst.sprites.length; i++) {
    const sp = inst.sprites[i]!;
    const ud = sp.userData as SpriteUserData;
    const t = elapsed + ud.phase;
    const upY = wy + (preset.rise * progress) + Math.sin(t * 2.5) * 4;
    const sway = Math.sin(t * 1.7 + i) * 6;
    sp.position.set(wx + ud.offsetX + sway, upY + i * 14, wz + ud.offsetZ);
    const pulse = 1 + Math.sin(t * (kf.fx === 'fire' ? 7 : 3)) * preset.pulse;
    const flicker = (kf.fx === 'sparks') ? (0.5 + 0.5 * Math.sin(t * 18 + i)) : 1;
    sp.scale.set(ud.baseSize * pulse, ud.baseSize * pulse, 1);
    (sp.material as THREE.SpriteMaterial).opacity = alpha * flicker;
    (sp.material as THREE.SpriteMaterial).rotation = t * 0.4 * (i % 2 === 0 ? 1 : -1);
  }
  if (inst.light) {
    inst.light.position.set(wx, wy + 40, wz);
    inst.light.intensity = 1.5 + Math.sin(elapsed * 6) * 0.5;
    inst.light.intensity *= alpha;
  }
}

export function clearAllFx(
  activeInstances: Map<string, FxInstance>,
  scene: THREE.Scene,
): void {
  for (const inst of activeInstances.values()) despawnFxInstance(inst, scene);
  activeInstances.clear();
}

export function newFxId(): string {
  return 'fx_' + Math.random().toString(36).slice(2, 8);
}

/** Interpola entre dos targets. Cell→cell smooth, otros snap a media. */
export function interpolateFxTarget(
  t1: FxTarget | null | undefined,
  t2: FxTarget | null | undefined,
  lerp: number,
): FxTarget | null | undefined {
  if (!t1) return t2;
  if (!t2) return t1;
  if (t1.kind === 'cell' && t2.kind === 'cell') {
    return {
      kind: 'cell',
      cx: t1.cx + (t2.cx - t1.cx) * lerp,
      cy: t1.cy + (t2.cy - t1.cy) * lerp,
    };
  }
  return lerp < 0.5 ? t1 : t2;
}

type LegacyFxRoot = {
  entities?: Array<{ id: string; kind: FxKind; duration: number; keyframes: any[] }>;
  keyframes?: Array<{ fx?: FxKind; t: number; target?: FxTarget; duration?: number }>;
};

/** Migra modelo viejo (fx.keyframes) → nuevo (fx.entities). Idempotente. */
export function migrateFxModel(cutscene: { fx?: LegacyFxRoot }): void {
  if (!cutscene.fx) cutscene.fx = { entities: [] };
  const root = cutscene.fx;
  if (root.keyframes && !root.entities) {
    root.entities = root.keyframes.map(kf => ({
      id: newFxId(),
      kind: (kf.fx || 'smoke') as FxKind,
      duration: kf.duration || 3.0,
      keyframes: [{ t: kf.t, target: kf.target }],
    }));
    delete root.keyframes;
  }
  if (!root.entities) root.entities = [];
}
