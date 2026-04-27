// Pathfinding A* sobre el grid. Heurística Manhattan, costo uniforme.
// Bloquea por paredes (con puertas atravesables) + muebles floor (alto).
//
// Camino devuelto NO incluye la posición inicial.

import { GRID_W, GRID_H } from './state';
import { props } from './world';
import { blocksWallN, blocksWallW } from './wall-queries';

export function isBlockedByProp(cx: number, cy: number): boolean {
  for (const p of props) {
    if (((p['category'] as string) || 'floor') !== 'floor') continue;
    const px = p['cx'] as number;
    const py = p['cy'] as number;
    const w = (p['w'] as number) ?? 1;
    const d = (p['d'] as number) ?? 1;
    if (cx >= px && cx < px + w && cy >= py && cy < py + d) return true;
  }
  return false;
}

// ¿Puede el agente caminar de (cx, cy) a vecino? Bloqueado por wallN/wallW
// y muebles floor. Las puertas son atravesables (blocksWall* las excluye).
export function neighbors(cx: number, cy: number): [number, number][] {
  const result: [number, number][] = [];
  if (cy > 0 && !blocksWallN(cx, cy) && !isBlockedByProp(cx, cy - 1)) result.push([cx, cy - 1]);
  if (cy < GRID_H - 1 && !blocksWallN(cx, cy + 1) && !isBlockedByProp(cx, cy + 1)) result.push([cx, cy + 1]);
  if (cx > 0 && !blocksWallW(cx, cy) && !isBlockedByProp(cx - 1, cy)) result.push([cx - 1, cy]);
  if (cx < GRID_W - 1 && !blocksWallW(cx + 1, cy) && !isBlockedByProp(cx + 1, cy)) result.push([cx + 1, cy]);
  return result;
}

type AstarNode = {
  cx: number;
  cy: number;
  g: number;
  h: number;
  parent: AstarNode | null;
  closed: boolean;
};

// A* clásico, heurística Manhattan, costo uniforme. Devuelve array de [cx,cy]
// SIN incluir posición inicial. null si no hay path.
export function findPath(sx: number, sy: number, gx: number, gy: number): [number, number][] | null {
  if (sx === gx && sy === gy) return [];
  const open: AstarNode[] = [];
  const nodes = new Map<string, AstarNode>();
  const start: AstarNode = {
    cx: sx,
    cy: sy,
    g: 0,
    h: Math.abs(sx - gx) + Math.abs(sy - gy),
    parent: null,
    closed: false,
  };
  open.push(start);
  nodes.set(`${sx},${sy}`, start);

  while (open.length) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.g + open[i]!.h < open[bestIdx]!.g + open[bestIdx]!.h) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0]!;
    current.closed = true;

    if (current.cx === gx && current.cy === gy) {
      const path: [number, number][] = [];
      let n: AstarNode | null = current;
      while (n && n.parent) {
        path.unshift([n.cx, n.cy]);
        n = n.parent;
      }
      return path;
    }

    for (const [nx, ny] of neighbors(current.cx, current.cy)) {
      const nkey = `${nx},${ny}`;
      const ng = current.g + 1;
      let node = nodes.get(nkey);
      if (node) {
        if (node.closed || node.g <= ng) continue;
        node.g = ng;
        node.parent = current;
      } else {
        node = {
          cx: nx,
          cy: ny,
          g: ng,
          h: Math.abs(nx - gx) + Math.abs(ny - gy),
          parent: current,
          closed: false,
        };
        nodes.set(nkey, node);
        open.push(node);
      }
    }
  }
  return null;
}
