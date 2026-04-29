import { describe, it, expect } from 'vitest';
import { cellToWorld, worldToCell, type WorldXYZ } from '../../src/engine/coords';
import { CELL, GRID_W, GRID_H } from '../../src/engine/state';

describe('engine/coords - cellToWorld', () => {
  it('origen (0,0) mapea a (0, 0, 0)', () => {
    expect(cellToWorld(0, 0)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('y siempre vale 0 (mundo plano)', () => {
    expect(cellToWorld(3, 7).y).toBe(0);
    expect(cellToWorld(-5, 99).y).toBe(0);
  });

  it('cx escala por CELL hacia x', () => {
    expect(cellToWorld(1, 0).x).toBe(CELL);
    expect(cellToWorld(5, 0).x).toBe(5 * CELL);
  });

  it('cy escala por CELL hacia z', () => {
    expect(cellToWorld(0, 1).z).toBe(CELL);
    expect(cellToWorld(0, 4).z).toBe(4 * CELL);
  });

  it('esquina top-left (0, GRID_H-1)', () => {
    const pos = cellToWorld(0, GRID_H - 1);
    expect(pos).toEqual({ x: 0, y: 0, z: (GRID_H - 1) * CELL });
  });

  it('esquina bottom-right (GRID_W-1, 0)', () => {
    const pos = cellToWorld(GRID_W - 1, 0);
    expect(pos).toEqual({ x: (GRID_W - 1) * CELL, y: 0, z: 0 });
  });

  it('esquina opuesta (GRID_W-1, GRID_H-1)', () => {
    const pos = cellToWorld(GRID_W - 1, GRID_H - 1);
    expect(pos).toEqual({
      x: (GRID_W - 1) * CELL,
      y: 0,
      z: (GRID_H - 1) * CELL,
    });
  });

  it('coordenadas negativas se preservan (no clamp)', () => {
    expect(cellToWorld(-1, -2)).toEqual({ x: -CELL, y: 0, z: -2 * CELL });
  });

  it('valores fuera de rango se preservan (no clamp)', () => {
    expect(cellToWorld(GRID_W + 5, GRID_H + 5)).toEqual({
      x: (GRID_W + 5) * CELL,
      y: 0,
      z: (GRID_H + 5) * CELL,
    });
  });

  it('respeta el valor actual de CELL (no hardcoded)', () => {
    const pos = cellToWorld(1, 1);
    expect(pos.x / CELL).toBe(1);
    expect(pos.z / CELL).toBe(1);
  });
});

describe('engine/coords - worldToCell', () => {
  it('(0, _, 0) mapea a celda (0, 0)', () => {
    expect(worldToCell({ x: 0, z: 0 })).toEqual({ cx: 0, cy: 0 });
  });

  it('(CELL, _, CELL) mapea a celda (1, 1)', () => {
    expect(worldToCell({ x: CELL, z: CELL })).toEqual({ cx: 1, cy: 1 });
  });

  it('redondea al entero más cercano (round, no floor)', () => {
    expect(worldToCell({ x: CELL * 0.4, z: CELL * 0.6 })).toEqual({
      cx: 0,
      cy: 1,
    });
  });

  it('redondea exactamente .5 hacia arriba', () => {
    expect(worldToCell({ x: CELL * 0.5, z: CELL * 1.5 })).toEqual({
      cx: 1,
      cy: 2,
    });
  });

  it('valores negativos se redondean simétricamente', () => {
    expect(worldToCell({ x: -CELL * 1.4, z: -CELL * 2.6 })).toEqual({
      cx: -1,
      cy: -3,
    });
  });

  it('ignora la coordenada y (no la consume)', () => {
    const pos = { x: CELL * 2, y: 999, z: CELL * 3 } as WorldXYZ;
    expect(worldToCell(pos)).toEqual({ cx: 2, cy: 3 });
  });
});

describe('engine/coords - roundtrip', () => {
  it('cellToWorld → worldToCell devuelve celda original (enteros)', () => {
    for (let cx = 0; cx < GRID_W; cx++) {
      for (let cy = 0; cy < GRID_H; cy++) {
        const world = cellToWorld(cx, cy);
        expect(worldToCell(world)).toEqual({ cx, cy });
      }
    }
  });

  it('worldToCell → cellToWorld snappea a centro de celda', () => {
    const noisy = { x: CELL * 2 + 3, z: CELL * 4 - 7 };
    const cell = worldToCell(noisy);
    const snapped = cellToWorld(cell.cx, cell.cy);
    expect(snapped).toEqual({ x: cell.cx * CELL, y: 0, z: cell.cy * CELL });
  });
});
