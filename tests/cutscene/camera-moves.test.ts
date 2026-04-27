import { describe, it, expect } from 'vitest';
import { dollyIn, pullOut, pan, pushIn } from '../../src/cutscene/camera-moves';
import type { AgentPos } from '../../src/cutscene/shots';

const sub = (id: string, x: number, z: number): AgentPos => ({ id, x, y: 0, z });

describe('dollyIn', () => {
  it('end más cerca del subject que start (acercamiento)', () => {
    const r = dollyIn(sub('mike', 0, 0), {});
    const distStart = Math.hypot(r.start.position.x, r.start.position.z);
    const distEnd = Math.hypot(r.end.position.x, r.end.position.z);
    expect(distEnd).toBeLessThan(distStart);
  });

  it('lens default 50mm en start y end', () => {
    const r = dollyIn(sub('mike', 0, 0), {});
    expect(r.start.lens).toBe(50);
    expect(r.end.lens).toBe(50);
  });

  it('respeta args.distancia_inicial / distancia_final', () => {
    const r = dollyIn(sub('mike', 0, 0), { distancia_inicial: 500, distancia_final: 100 });
    const distStart = Math.hypot(r.start.position.x, r.start.position.z);
    const distEnd = Math.hypot(r.end.position.x, r.end.position.z);
    expect(distEnd).toBeLessThan(distStart);
  });
});

describe('pullOut', () => {
  it('end más lejos que start (alejamiento)', () => {
    const r = pullOut(sub('a', 0, 0), {});
    const dStart = Math.hypot(r.start.position.x, r.start.position.z);
    const dEnd = Math.hypot(r.end.position.x, r.end.position.z);
    expect(dEnd).toBeGreaterThan(dStart);
  });
});

describe('pushIn', () => {
  it('lens crece (zoom in)', () => {
    const r = pushIn(sub('a', 0, 0), {});
    expect(r.end.lens).toBeGreaterThan(r.start.lens);
  });

  it('position constante (zoom puro)', () => {
    const r = pushIn(sub('a', 0, 0), {});
    expect(r.end.position).toEqual(r.start.position);
  });
});

describe('pan', () => {
  it('target cambia entre start y end', () => {
    const r = pan({ de_x: 0, de_y: 0, de_z: 0, hacia_x: 100, hacia_y: 0, hacia_z: 0 });
    expect(r.end.target.x).not.toEqual(r.start.target.x);
  });
});
