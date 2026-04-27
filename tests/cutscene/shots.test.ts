import { describe, it, expect, vi } from 'vitest';
import {
  wideEstablishing, mediumShot, closeUp, twoShot, overTheShoulder,
  type AgentPos,
} from '../../src/cutscene/shots';

const sub = (id: string, x: number, z: number): AgentPos => ({ id, x, y: 0, z });

describe('mediumShot', () => {
  it('default lens 50mm', () => {
    const r = mediumShot(sub('mike', 100, 100));
    expect(r.lens).toBe(50);
  });

  it('opts.lens overrides default', () => {
    const r = mediumShot(sub('mike', 100, 100), { lens: 85 });
    expect(r.lens).toBe(85);
  });

  it('target apunta al subject (con raise y)', () => {
    const r = mediumShot(sub('mike', 100, 100));
    expect(r.target.x).toBe(100);
    expect(r.target.z).toBe(100);
    expect(r.target.y).toBeGreaterThan(0);
  });

  it('position arriba del target (elevation iso)', () => {
    const r = mediumShot(sub('mike', 100, 100));
    expect(r.position.y).toBeGreaterThan(r.target.y);
  });
});

describe('closeUp', () => {
  it('default lens 85mm', () => {
    const r = closeUp(sub('cris', 0, 0));
    expect(r.lens).toBe(85);
  });
});

describe('wideEstablishing', () => {
  it('default lens 24mm', () => {
    const r = wideEstablishing([sub('a', 0, 0)]);
    expect(r.lens).toBe(24);
  });

  it('subjects vacío: target en origen sin throw', () => {
    expect(() => wideEstablishing([])).not.toThrow();
    const r = wideEstablishing([]);
    expect(r.target).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('target = centro de bbox de subjects', () => {
    const r = wideEstablishing([sub('a', 0, 0), sub('b', 100, 100)]);
    expect(r.target.x).toBe(50);
    expect(r.target.z).toBe(50);
  });
});

describe('twoShot', () => {
  it('default lens 35mm', () => {
    const r = twoShot([sub('a', 0, 0), sub('b', 100, 100)]);
    expect(r.lens).toBe(35);
  });

  it('cardinalidad inválida: warn + fallback (no throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => twoShot([sub('a', 0, 0)])).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('overTheShoulder', () => {
  it('default lens 50mm', () => {
    const r = overTheShoulder(sub('a', 0, 0), sub('b', 100, 0));
    expect(r.lens).toBe(50);
  });

  it('target apunta al subjectTarget', () => {
    const r = overTheShoulder(sub('a', 0, 0), sub('b', 100, 0));
    expect(r.target.x).toBe(100);
  });
});

describe('fórmula distance lens-inversa', () => {
  it('lens más alta → cámara más cerca del target', () => {
    const r50 = mediumShot(sub('a', 0, 0), { lens: 50 });
    const r100 = mediumShot(sub('a', 0, 0), { lens: 100 });
    const dist50 = Math.hypot(r50.position.x - r50.target.x, r50.position.z - r50.target.z);
    const dist100 = Math.hypot(r100.position.x - r100.target.x, r100.position.z - r100.target.z);
    expect(dist100).toBeLessThan(dist50);
  });
});
