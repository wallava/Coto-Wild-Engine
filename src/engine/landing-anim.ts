// Landing animation: squash al aterrizar tras drag. Total ~280ms.
// Cuando el agente cae al piso después del drag, hace un squash leve para
// que se sienta físico (impacto).

import type * as THREE from 'three';

type AgentLike = {
  mesh?: THREE.Object3D;
  spriteW: number;
  spriteH: number;
};

type LandingAnim = {
  agent: AgentLike;
  t: number;
  duration: number;
};

const landingAnims: LandingAnim[] = [];

export function startLandingAnim(agent: AgentLike): void {
  // Si ya hay una landing en curso para este agente, reemplazar
  for (let i = landingAnims.length - 1; i >= 0; i--) {
    if (landingAnims[i]!.agent === agent) landingAnims.splice(i, 1);
  }
  landingAnims.push({ agent, t: 0, duration: 0.28 });
}

export function updateLandingAnims(dt: number): void {
  for (let i = landingAnims.length - 1; i >= 0; i--) {
    const a = landingAnims[i]!;
    a.t += dt;
    const x = a.t / a.duration;
    if (x >= 1) {
      if (a.agent.mesh) a.agent.mesh.scale.set(a.agent.spriteW, a.agent.spriteH, 1);
      landingAnims.splice(i, 1);
      continue;
    }
    let sx: number;
    let sy: number;
    if (x < 0.4) {
      const t = x / 0.4;
      sx = 1.0 + t * 0.28;
      sy = 1.0 - t * 0.28;
    } else {
      const t = (x - 0.4) / 0.6;
      sx = 1.28 - t * 0.28;
      sy = 0.72 + t * 0.28;
    }
    if (a.agent.mesh) {
      a.agent.mesh.scale.set(a.agent.spriteW * sx, a.agent.spriteH * sy, 1);
    }
  }
}
