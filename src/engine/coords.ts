// engine/coords — conversión grid ↔ mundo (three.js).
//
// Convención: grid (cx, cy) es 0-indexed. cx (este) → world.x, cy (sur) → world.z.
// y queda en 0 (mundo plano para gameplay; cámaras y sprites usan otros y).
//
// CELL = unidades three por celda (definido en engine/state). Cambiar CELL no
// debería requerir tocar callers — todos pasan por estos helpers.

import { CELL } from './state';

/**
 * Posición en mundo three.js: x=este, y=arriba, z=sur.
 */
export type WorldXYZ = { x: number; y: number; z: number };

/**
 * Convierte (cx, cy) de grid a (x, y, z) de mundo. y queda en 0.
 * @param cx columna del grid (este).
 * @param cy fila del grid (sur).
 * @returns posición de mundo con y=0.
 */
export function cellToWorld(cx: number, cy: number): WorldXYZ {
  return { x: cx * CELL, y: 0, z: cy * CELL };
}

/**
 * Convierte posición de mundo a celda de grid (round al entero más cercano).
 * Solo usa x y z; el componente y se ignora.
 * @param pos posición de mundo.
 * @returns celda { cx, cy } redondeada.
 */
export function worldToCell(pos: { x: number; z: number }): { cx: number; cy: number } {
  return { cx: Math.round(pos.x / CELL), cy: Math.round(pos.z / CELL) };
}
