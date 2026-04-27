// Helpers de altura de pared según modo + cámara. NO mantiene state propio
// — wallMode, WALL_H y cameraTheta vienen vía getters callbacks (legacy
// los maneja hasta que se extraiga camera control + wall mode toggle).
//
// Modos:
//   'up'      → todas las paredes a altura completa
//   'down'    → todas reducidas a zócalo
//   'cutaway' → la pared "del frente" (según camera azimuth) se reduce
//               a zócalo, dejando ver el interior

import { WALL_H_DOWN, GRID_W, GRID_H } from './state';

export type WallMode = 'up' | 'down' | 'cutaway';

let _modeGetter: () => WallMode = () => 'up';
let _wallHGetter: () => number = () => 110;
let _thetaGetter: () => number = () => 0;

export function setWallModeGetter(getter: () => WallMode): void {
  _modeGetter = getter;
}

export function setWallHGetter(getter: () => number): void {
  _wallHGetter = getter;
}

export function setCameraThetaGetter(getter: () => number): void {
  _thetaGetter = getter;
}

export function wallHeightForN(cy: number): number {
  if (_modeGetter() !== 'cutaway') return _wallHGetter();
  const camAtSouth = Math.cos(_thetaGetter()) > 0;
  const front = camAtSouth ? cy > 0 : cy < GRID_H;
  return front ? WALL_H_DOWN : _wallHGetter();
}

export function wallHeightForW(cx: number): number {
  if (_modeGetter() !== 'cutaway') return _wallHGetter();
  const camAtEast = Math.sin(_thetaGetter()) > 0;
  const front = camAtEast ? cx > 0 : cx < GRID_W;
  return front ? WALL_H_DOWN : _wallHGetter();
}
