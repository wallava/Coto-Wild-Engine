import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasWallN,
  hasWallW,
  blocksSpillN,
  blocksSpillW,
  blocksPathN,
  blocksPathW,
  blocksWallN,
  blocksWallW,
  getDoorOnWallN,
  getDoorOnWallW,
  isCorner,
  isAllWindowCorner,
  getNearestEdgeFromPoint,
  getAdjacentCell,
  getCandidateWallSlots,
  pathFirstExists,
  pathBlocksOnFurniture,
  findNearestWallSegment,
  findNearestPlaceableWallFace,
  getWallPropBounds,
} from '../../src/engine/wall-queries';
import {
  loadWorldData,
  worldGrid,
  props,
  type WallStyle,
} from '../../src/engine/world';
import { GRID_W, GRID_H, CELL } from '../../src/engine/state';

// Fixture base: grid vacío del tamaño correcto (GRID_H+1 filas para wallN,
// GRID_W+1 columnas para wallW). Cada test puede mutar worldGrid después.
function buildEmptyWorld(): {
  wallN: boolean[][];
  wallW: boolean[][];
  wallNStyle: WallStyle[][];
  wallWStyle: WallStyle[][];
  props: Array<Record<string, unknown>>;
} {
  const wallN = Array.from({ length: GRID_H + 1 }, () =>
    Array<boolean>(GRID_W).fill(false),
  );
  const wallW = Array.from({ length: GRID_H }, () =>
    Array<boolean>(GRID_W + 1).fill(false),
  );
  const wallNStyle: WallStyle[][] = Array.from({ length: GRID_H + 1 }, () =>
    Array<WallStyle>(GRID_W).fill('solid'),
  );
  const wallWStyle: WallStyle[][] = Array.from({ length: GRID_H }, () =>
    Array<WallStyle>(GRID_W + 1).fill('solid'),
  );
  return { wallN, wallW, wallNStyle, wallWStyle, props: [] };
}

beforeEach(() => {
  loadWorldData(buildEmptyWorld(), () => 0xffffff);
});

describe('hasWallN / hasWallW', () => {
  it('hasWallN devuelve true cuando wall existe', () => {
    worldGrid.wallN[2]![3] = true;
    expect(hasWallN(3, 2)).toBe(true);
  });

  it('hasWallN devuelve false cuando wall no existe', () => {
    expect(hasWallN(3, 2)).toBe(false);
  });

  it('hasWallN respeta bounds (cx < 0)', () => {
    expect(hasWallN(-1, 2)).toBe(false);
  });

  it('hasWallN respeta bounds (cx >= GRID_W)', () => {
    expect(hasWallN(GRID_W, 2)).toBe(false);
  });

  it('hasWallN respeta bounds (cy fuera)', () => {
    expect(hasWallN(2, GRID_H + 1)).toBe(false);
  });

  it('hasWallW devuelve true cuando wall existe', () => {
    worldGrid.wallW[2]![3] = true;
    expect(hasWallW(3, 2)).toBe(true);
  });

  it('hasWallW respeta bounds', () => {
    expect(hasWallW(GRID_W + 1, 2)).toBe(false);
    expect(hasWallW(0, GRID_H)).toBe(false);
  });
});

describe('isCorner', () => {
  it('true cuando hay walls N y W adyacentes', () => {
    // Punto del grid (cx=2, cy=2). Si hay wallN[2][1] (al oeste del punto)
    // y wallW[1][2] (al norte del punto), es corner.
    worldGrid.wallN[2]![1] = true;
    worldGrid.wallW[1]![2] = true;
    expect(isCorner(2, 2)).toBe(true);
  });

  it('false cuando solo hay wallN', () => {
    worldGrid.wallN[2]![1] = true;
    expect(isCorner(2, 2)).toBe(false);
  });

  it('false cuando solo hay wallW', () => {
    worldGrid.wallW[1]![2] = true;
    expect(isCorner(2, 2)).toBe(false);
  });

  it('false en punto sin paredes adyacentes', () => {
    expect(isCorner(2, 2)).toBe(false);
  });
});

describe('blocksPath / blocksSpill', () => {
  it('blocksSpillN sigue hasWallN (incluye puertas)', () => {
    worldGrid.wallN[2]![3] = true;
    expect(blocksSpillN(3, 2)).toBe(true);
  });

  it('blocksPathN false si hay door prop en esa pared', () => {
    worldGrid.wallN[2]![3] = true;
    props.push({ id: 'd1', category: 'door', cx: 3, cy: 2, side: 'N' });
    expect(blocksPathN(3, 2)).toBe(false);
  });

  it('blocksPathN true si hay wall sin door', () => {
    worldGrid.wallN[2]![3] = true;
    expect(blocksPathN(3, 2)).toBe(true);
  });

  it('blocksWallN es alias de blocksPathN', () => {
    worldGrid.wallN[2]![3] = true;
    expect(blocksWallN(3, 2)).toBe(blocksPathN(3, 2));
    expect(blocksWallW(3, 2)).toBe(blocksPathW(3, 2));
  });
});

describe('getDoorOnWallN / W', () => {
  it('encuentra door con side=N', () => {
    const door = { id: 'd1', category: 'door', cx: 2, cy: 1, side: 'N' };
    props.push(door);
    expect(getDoorOnWallN(2, 1)).toBe(door);
  });

  it('encuentra door con side=S en wallN', () => {
    const door = { id: 'd1', category: 'door', cx: 2, cy: 1, side: 'S' };
    props.push(door);
    expect(getDoorOnWallN(2, 1)).toBe(door);
  });

  it('null cuando no hay door en esa cell', () => {
    expect(getDoorOnWallN(2, 1)).toBeNull();
  });

  it('getDoorOnWallW: side=W o E cuentan', () => {
    props.push({ id: 'd1', category: 'door', cx: 2, cy: 1, side: 'W' });
    expect(getDoorOnWallW(2, 1)).not.toBeNull();
  });
});

describe('isAllWindowCorner', () => {
  it('true si todas las paredes adyacentes son window', () => {
    worldGrid.wallN[2]![1] = true;
    worldGrid.wallNStyle![2]![1] = 'window';
    worldGrid.wallW[1]![2] = true;
    worldGrid.wallWStyle![1]![2] = 'window';
    expect(isAllWindowCorner(2, 2)).toBe(true);
  });

  it('false si alguna pared adyacente es solid', () => {
    worldGrid.wallN[2]![1] = true;
    worldGrid.wallNStyle![2]![1] = 'window';
    worldGrid.wallW[1]![2] = true;
    worldGrid.wallWStyle![1]![2] = 'solid';
    expect(isAllWindowCorner(2, 2)).toBe(false);
  });

  it('false si no hay paredes adyacentes', () => {
    expect(isAllWindowCorner(2, 2)).toBe(false);
  });
});

describe('getAdjacentCell', () => {
  it("side='S' devuelve mismo cell", () => {
    expect(getAdjacentCell('wallN', 3, 2, 'S')).toEqual({ cx: 3, cy: 2 });
  });

  it("side='N' devuelve cell arriba (cy-1)", () => {
    expect(getAdjacentCell('wallN', 3, 2, 'N')).toEqual({ cx: 3, cy: 1 });
  });

  it("side='E' devuelve mismo cell", () => {
    expect(getAdjacentCell('wallW', 3, 2, 'E')).toEqual({ cx: 3, cy: 2 });
  });

  it("side='W' devuelve cell a la izquierda (cx-1)", () => {
    expect(getAdjacentCell('wallW', 3, 2, 'W')).toEqual({ cx: 2, cy: 2 });
  });
});

describe('getNearestEdgeFromPoint', () => {
  it('null cuando p es null', () => {
    expect(getNearestEdgeFromPoint(null)).toBeNull();
  });

  it('null cuando punto fuera del grid', () => {
    expect(getNearestEdgeFromPoint({ x: -10, z: 0 })).toBeNull();
    expect(getNearestEdgeFromPoint({ x: GRID_W * CELL + 10, z: 0 })).toBeNull();
  });

  it('punto cerca del edge norte de cell devuelve wallN del cell', () => {
    // cell (cx=2, cy=2): centro en (2.5*CELL, 2.5*CELL). Borde norte en cy=2*CELL.
    const p = { x: 2 * CELL + CELL / 2, z: 2 * CELL + 5 };
    const edge = getNearestEdgeFromPoint(p);
    expect(edge).toEqual({ type: 'wallN', cx: 2, cy: 2 });
  });

  it('punto cerca del edge sur devuelve wallN del cell siguiente', () => {
    // cell (cx=2, cy=2): borde sur en cy=3*CELL → wallN[3][2].
    const p = { x: 2 * CELL + CELL / 2, z: 3 * CELL - 5 };
    const edge = getNearestEdgeFromPoint(p);
    expect(edge).toEqual({ type: 'wallN', cx: 2, cy: 3 });
  });

  it('punto cerca del edge oeste devuelve wallW del cell', () => {
    const p = { x: 2 * CELL + 5, z: 2 * CELL + CELL / 2 };
    const edge = getNearestEdgeFromPoint(p);
    expect(edge).toEqual({ type: 'wallW', cx: 2, cy: 2 });
  });
});

describe('pathFirstExists / pathBlocksOnFurniture', () => {
  it('pathFirstExists false con path vacío', () => {
    expect(pathFirstExists([])).toBe(false);
  });

  it('pathFirstExists true si la primera wall existe', () => {
    worldGrid.wallN[2]![3] = true;
    expect(
      pathFirstExists([{ type: 'wallN', cx: 3, cy: 2 }]),
    ).toBe(true);
  });

  it('pathFirstExists false si la primera wall no existe', () => {
    expect(
      pathFirstExists([{ type: 'wallN', cx: 3, cy: 2 }]),
    ).toBe(false);
  });

  it('pathBlocksOnFurniture false en modo erase', () => {
    expect(
      pathBlocksOnFurniture([{ type: 'wallN', cx: 3, cy: 2 }], true),
    ).toBe(false);
  });

  it('pathBlocksOnFurniture true si pared nueva parte un mueble multi-cell', () => {
    // Mueble 1x2 en (cx=2, cy=2..3). Construir wallN en cy=3 lo parte.
    props.push({ id: 'p1', category: 'floor', cx: 2, cy: 2, w: 1, d: 2 });
    expect(
      pathBlocksOnFurniture([{ type: 'wallN', cx: 2, cy: 3 }], false),
    ).toBe(true);
  });

  it('pathBlocksOnFurniture false si la pared ya existe (no es nueva)', () => {
    worldGrid.wallN[3]![2] = true;
    props.push({ id: 'p1', category: 'floor', cx: 2, cy: 2, w: 1, d: 2 });
    expect(
      pathBlocksOnFurniture([{ type: 'wallN', cx: 2, cy: 3 }], false),
    ).toBe(false);
  });
});

describe('getCandidateWallSlots', () => {
  it('vacío sin paredes', () => {
    expect(getCandidateWallSlots()).toEqual([]);
  });

  it('pared interior wallN[2][1] genera 2 slots (N y S)', () => {
    worldGrid.wallN[2]![1] = true;
    const slots = getCandidateWallSlots();
    expect(slots).toContainEqual({ side: 'N', cx: 1, cy: 2 });
    expect(slots).toContainEqual({ side: 'S', cx: 1, cy: 2 });
    expect(slots.length).toBe(2);
  });

  it('pared exterior norte (cy=0) solo genera slot S (no hay cuarto al norte)', () => {
    worldGrid.wallN[0]![1] = true;
    const slots = getCandidateWallSlots();
    expect(slots).toContainEqual({ side: 'S', cx: 1, cy: 0 });
    expect(slots.length).toBe(1);
  });

  it('wallW interior genera 2 slots (W y E)', () => {
    worldGrid.wallW[2]![3] = true;
    const slots = getCandidateWallSlots();
    expect(slots).toContainEqual({ side: 'W', cx: 3, cy: 2 });
    expect(slots).toContainEqual({ side: 'E', cx: 3, cy: 2 });
    expect(slots.length).toBe(2);
  });
});

describe('findNearestWallSegment / findNearestPlaceableWallFace', () => {
  it('findNearestWallSegment null sin paredes', () => {
    expect(
      findNearestWallSegment({ x: CELL * 2, z: CELL * 2 }),
    ).toBeNull();
  });

  it('findNearestWallSegment encuentra segmento cercano', () => {
    worldGrid.wallN[2]![1] = true;
    const seg = findNearestWallSegment({
      x: 1 * CELL + CELL / 2,
      z: 2 * CELL + 5,
    });
    expect(seg).toEqual({ type: 'wallN', cx: 1, cy: 2 });
  });

  it('findNearestPlaceableWallFace null sin paredes', () => {
    expect(
      findNearestPlaceableWallFace({ x: CELL * 2, z: CELL * 2 }),
    ).toBeNull();
  });
});

describe('getWallPropBounds', () => {
  it('null si side inválido', () => {
    expect(
      getWallPropBounds({ cx: 2, cy: 2 } as Record<string, unknown>),
    ).toBeNull();
  });

  it('side=S devuelve bounds con xmin/xmax dentro del cell', () => {
    const bounds = getWallPropBounds({
      cx: 2,
      cy: 2,
      side: 'S',
      h: 24,
      zOffset: 50,
    } as Record<string, unknown>);
    expect(bounds).not.toBeNull();
    expect(bounds!.xmin).toBeGreaterThan(2 * CELL);
    expect(bounds!.xmax).toBeLessThan(3 * CELL);
    expect(bounds!.zmin).toBe(50);
    expect(bounds!.zmax).toBe(74);
  });

  it('usa defaults zOffset=50, h=24 si faltan', () => {
    const bounds = getWallPropBounds({
      cx: 2,
      cy: 2,
      side: 'S',
    } as Record<string, unknown>);
    expect(bounds).not.toBeNull();
    expect(bounds!.zmin).toBe(50);
    expect(bounds!.zmax).toBe(74);
  });
});
