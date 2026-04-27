// Helpers de geometría three.js usados por wall/prop builders.
//
//   mkBox: crea una caja con materiales por cara (iso colors top/right/left,
//          con overrides opcionales por cara cardinal). Aplica offset
//          -centerX/-centerZ. Retorna null si las dimensiones son inválidas.
//   makeGlassMesh: convierte un mesh sólido en transparente (vidrio).
//
// `showStrokes` (toggle global de edges) viene vía getter callback que el
// llamante setea con setStrokesGetter() — evita exportar mutables.

import * as THREE from 'three';
import { centerX, centerZ, PALETTE } from './state';

let _strokesGetter: () => boolean = () => true;

export function setStrokesGetter(getter: () => boolean): void {
  _strokesGetter = getter;
}

// Lectura pública del flag (otros módulos que crean meshes con edges).
export function getStrokesEnabled(): boolean {
  return _strokesGetter();
}

export type FaceCode = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

export type BoxColors = {
  top: number;
  right: number;
  left: number;
  // Overrides por cara cardinal (paredes pintables: cada lado puede tener
  // un color distinto).
  pxColor?: number;
  nxColor?: number;
  pzColor?: number;
  nzColor?: number;
};

// Retorna null si las dimensiones son inválidas (NaN, no finitas, o ≤ 0).
// Esto evita BoxGeometry inválidos que producen "Computed radius is NaN".
// hideFaces opcional: caras que se ocultan (útil para evitar overlap de
// transparencias entre cajas vidrio adyacentes).
export function mkBox(
  xmin: number,
  ymin: number,
  zmin: number,
  xmax: number,
  ymax: number,
  zmax: number,
  colors: BoxColors,
  hideFaces?: FaceCode[],
): THREE.Mesh | null {
  const w = xmax - xmin;
  const h = zmax - zmin;
  const d = ymax - ymin;
  if (!isFinite(w) || !isFinite(h) || !isFinite(d) || w <= 0 || h <= 0 || d <= 0) {
    console.warn('[mkBox] dimensiones inválidas, skip:', {
      w, h, d, xmin, ymin, zmin, xmax, ymax, zmax,
    });
    return null;
  }
  const geo = new THREE.BoxGeometry(w, h, d);

  // Material array order: [+X, -X, +Y, -Y, +Z, -Z]
  const pxC = colors.pxColor !== undefined ? colors.pxColor : colors.right;
  const nxC = colors.nxColor !== undefined ? colors.nxColor : colors.right;
  const pzC = colors.pzColor !== undefined ? colors.pzColor : colors.left;
  const nzC = colors.nzColor !== undefined ? colors.nzColor : colors.left;
  const mat: THREE.MeshBasicMaterial[] = [
    new THREE.MeshBasicMaterial({ color: pxC }),
    new THREE.MeshBasicMaterial({ color: nxC }),
    new THREE.MeshBasicMaterial({ color: colors.top }),
    new THREE.MeshBasicMaterial({ color: colors.top }),
    new THREE.MeshBasicMaterial({ color: pzC }),
    new THREE.MeshBasicMaterial({ color: nzC }),
  ];
  if (hideFaces && hideFaces.length) {
    const faceMap: Record<FaceCode, number> = {
      '+x': 0, '-x': 1, '+y': 2, '-y': 3, '+z': 4, '-z': 5,
    };
    for (const face of hideFaces) {
      const idx = faceMap[face];
      if (idx !== undefined) mat[idx]!.visible = false;
    }
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(
    (xmin + xmax) / 2 - centerX,
    (zmin + zmax) / 2,
    (ymin + ymax) / 2 - centerZ,
  );

  // Edges (strokes)
  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: PALETTE.edge });
  const line = new THREE.LineSegments(edges, lineMat);
  line.visible = _strokesGetter();
  mesh.add(line);
  mesh.userData['edges'] = line;

  return mesh;
}

// Convierte un mesh sólido (devuelto por mkBox) en uno tipo vidrio:
// transparent + alta opacidad para que se vea a través, edges sutiles.
export function makeGlassMesh(mesh: THREE.Mesh | null): THREE.Mesh | null {
  if (!mesh || !Array.isArray(mesh.material)) return mesh;
  for (const m of mesh.material as THREE.MeshBasicMaterial[]) {
    m.transparent = true;
    m.opacity = 0.32;
    m.depthWrite = false;
  }
  mesh.renderOrder = 1;
  const edges = mesh.userData['edges'] as THREE.LineSegments | undefined;
  if (edges) {
    const m = edges.material as THREE.LineBasicMaterial;
    m.color.setHex(0x4a6878);
    m.transparent = true;
    m.opacity = 0.6;
  }
  return mesh;
}
