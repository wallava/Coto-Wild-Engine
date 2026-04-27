// Geometría del panel rotatorio de las puertas. NO toca scene — el caller
// (wall builders) agrega el panel + pivot a la scene y maneja el registro
// en doorPivotsById.
//
// makeDoorPanelMesh produce el panel local (coords del pivot, no del mundo)
// listo para que el caller lo meta en un Object3D pivot que lo posicione y
// rote en world coords.

import * as THREE from 'three';
import { DOOR_PANEL_THICK, PALETTE } from './state';
import { getStrokesEnabled } from './three-primitives';

// ── Templates ──────────────────────────────────────────────────────
type DoorColors = { top: number; right: number; left: number };

export type DoorKind = 'wood' | 'modern' | 'glass';

export type DoorTemplate = {
  name: string;
  panel: DoorColors | null;   // null = glass
  frame: DoorColors;
};

export const DOOR_TEMPLATES: Record<DoorKind, DoorTemplate> = {
  wood: {
    name: 'Puerta de madera',
    panel: { top: 0x8a5a30, right: 0x6a4220, left: 0x4a2a10 },
    frame: { top: 0x70401c, right: 0x50300c, left: 0x301800 },
  },
  modern: {
    name: 'Puerta moderna',
    panel: { top: 0xd0d0d0, right: 0xa0a0a0, left: 0x808080 },
    frame: { top: 0x404040, right: 0x303030, left: 0x202020 },
  },
  glass: {
    name: 'Puerta de vidrio',
    panel: null,
    frame: { top: 0xa8a890, right: 0x808070, left: 0x606050 },
  },
};

export function doorTpl(kind: string | null | undefined): DoorTemplate {
  return DOOR_TEMPLATES[kind as DoorKind] ?? DOOR_TEMPLATES.wood;
}

// Panel mesh local (NO usa mkBox: evita el offset de centerX/Z, queda en
// coords locales del pivot).
//   axis='X' → BoxGeometry(length, height, thickness)  (panel a lo largo de X)
//   axis='Z' → BoxGeometry(thickness, height, length)  (panel a lo largo de Z)
export function makeDoorPanelMesh(
  length: number,
  height: number,
  kind: string | null | undefined,
  axis: 'X' | 'Z',
): THREE.Mesh {
  const tpl = doorTpl(kind);
  const geo = axis === 'X'
    ? new THREE.BoxGeometry(length, height, DOOR_PANEL_THICK)
    : new THREE.BoxGeometry(DOOR_PANEL_THICK, height, length);
  let mat: THREE.Material | THREE.Material[];
  if (!tpl.panel) {
    // Glass
    mat = new THREE.MeshBasicMaterial({
      color: 0xa8d0e0,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
  } else {
    const c = tpl.panel;
    // Material order: [+X, -X, +Y, -Y, +Z, -Z]
    mat = [
      new THREE.MeshBasicMaterial({ color: c.right }),
      new THREE.MeshBasicMaterial({ color: c.right }),
      new THREE.MeshBasicMaterial({ color: c.top }),
      new THREE.MeshBasicMaterial({ color: c.top }),
      new THREE.MeshBasicMaterial({ color: c.left }),
      new THREE.MeshBasicMaterial({ color: c.left }),
    ];
  }
  const mesh = new THREE.Mesh(geo, mat);
  const edges = new THREE.EdgesGeometry(geo);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: PALETTE.edge }));
  line.visible = getStrokesEnabled();
  mesh.add(line);
  return mesh;
}
