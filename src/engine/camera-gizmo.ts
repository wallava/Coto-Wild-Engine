// Dummy 3D de la cámara cinemática (gizmo).
//
// Componentes:
//   group        — Object3D padre, posición = position de cámara
//     body       — caja oscura (cuerpo de cámara)
//     lens       — cilindro al frente (apunta al target)
//     viewfinder — caja chica arriba
//     axes       — 3 ejes RGB (X rojo, Y verde, Z azul) con handles drag
//     frustum    — líneas que dibujan el FOV cónico
//   targetGroup  — Object3D, posición = target de cámara
//     targetMesh — rectángulo plano sobre el piso con flecha
//   sightLine    — línea entre gizmo y target
//   pathLine     — curva conectando todas las posiciones de los kfs
//
// Render puro: el módulo NO sabe de cutscene editor state. El llamante mapea
// su state a CameraPose y llama renderCameraGizmoPose.

import * as THREE from 'three';

const GIZMO_BODY_W = 28;
const GIZMO_BODY_H = 22;
const GIZMO_BODY_D = 36;
const GIZMO_AXIS_LEN = 70;

export type CameraPose = {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  lens: number;
  roll: number;
};

export type CameraGizmo = {
  group: THREE.Group;
  body: THREE.Mesh;
  lens: THREE.Mesh;
  viewfinder: THREE.Mesh;
  axes: THREE.Group[];
  frustum: THREE.LineSegments;
  frustumPositions: Float32Array;
  targetGroup: THREE.Group;
  targetMesh: THREE.Mesh;
  targetEdges: THREE.LineSegments;
  targetCross: THREE.LineSegments;
  sightLine: THREE.LineSegments;
  pathLine: THREE.Line;
  pathPositions: Float32Array;
};

let _gizmo: CameraGizmo | null = null;

function makeAxisArrow(color: number, dir: 'x' | 'y' | 'z'): THREE.Group {
  const group = new THREE.Group();
  const lineGeo = new THREE.CylinderGeometry(1.2, 1.2, GIZMO_AXIS_LEN - 12, 8);
  lineGeo.translate(0, (GIZMO_AXIS_LEN - 12) / 2, 0);
  const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 });
  const line = new THREE.Mesh(lineGeo, mat);
  line.renderOrder = 9000;
  group.add(line);
  const coneGeo = new THREE.ConeGeometry(5, 12, 12);
  coneGeo.translate(0, GIZMO_AXIS_LEN - 6, 0);
  const cone = new THREE.Mesh(coneGeo, mat);
  cone.renderOrder = 9000;
  group.add(cone);
  // Hitbox invisible más gruesa para drag fácil
  const hitGeo = new THREE.CylinderGeometry(8, 8, GIZMO_AXIS_LEN, 8);
  hitGeo.translate(0, GIZMO_AXIS_LEN / 2, 0);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hit = new THREE.Mesh(hitGeo, hitMat);
  hit.userData['gizmoAxis'] = dir;
  group.add(hit);
  if (dir === 'x') group.rotation.z = -Math.PI / 2;
  else if (dir === 'z') group.rotation.x = Math.PI / 2;
  return group;
}

export function buildCameraGizmo(scene: THREE.Scene): CameraGizmo {
  if (_gizmo) return _gizmo;
  const group = new THREE.Group();
  const bodyGeo = new THREE.BoxGeometry(GIZMO_BODY_W, GIZMO_BODY_H, GIZMO_BODY_D);
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x222428 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.userData['gizmoBody'] = true;
  group.add(body);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(bodyGeo),
    new THREE.LineBasicMaterial({ color: 0x88a0c0 }),
  );
  body.add(edges);
  const lensGeo = new THREE.CylinderGeometry(7, 7, 16, 16);
  lensGeo.rotateX(Math.PI / 2);
  lensGeo.translate(0, 0, GIZMO_BODY_D / 2 + 8);
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x101418 });
  const lens = new THREE.Mesh(lensGeo, lensMat);
  group.add(lens);
  const ringGeo = new THREE.TorusGeometry(7.5, 1.2, 8, 24);
  ringGeo.rotateY(Math.PI / 2);
  ringGeo.translate(0, 0, GIZMO_BODY_D / 2 + 16);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xa0a8b0 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  group.add(ring);
  const vfGeo = new THREE.BoxGeometry(10, 6, 10);
  vfGeo.translate(0, GIZMO_BODY_H / 2 + 3, -6);
  const vf = new THREE.Mesh(vfGeo, bodyMat);
  group.add(vf);
  const recGeo = new THREE.SphereGeometry(1.6, 8, 8);
  recGeo.translate(GIZMO_BODY_W / 2 - 4, GIZMO_BODY_H / 2 - 4, -GIZMO_BODY_D / 2 + 4);
  const recMat = new THREE.MeshBasicMaterial({ color: 0xe84030 });
  const rec = new THREE.Mesh(recGeo, recMat);
  group.add(rec);
  const axisX = makeAxisArrow(0xe84850, 'x');
  const axisY = makeAxisArrow(0x50d068, 'y');
  const axisZ = makeAxisArrow(0x4a90e8, 'z');
  group.add(axisX);
  group.add(axisY);
  group.add(axisZ);
  const frustumMat = new THREE.LineBasicMaterial({
    color: 0xe8c068, transparent: true, opacity: 0.65, depthTest: false,
  });
  const frustumGeo = new THREE.BufferGeometry();
  const frustumPositions = new Float32Array(8 * 3);
  frustumGeo.setAttribute('position', new THREE.BufferAttribute(frustumPositions, 3));
  const frustum = new THREE.LineSegments(frustumGeo, frustumMat);
  frustum.renderOrder = 9001;
  group.add(frustum);

  // Target marker — rectángulo + halo + cruz + pilar
  const targetGroup = new THREE.Group();
  const tRingGeo = new THREE.RingGeometry(28, 36, 32);
  tRingGeo.rotateX(-Math.PI / 2);
  const tRingMat = new THREE.MeshBasicMaterial({
    color: 0xe8c068, transparent: true, opacity: 0.45,
    depthTest: false, side: THREE.DoubleSide,
  });
  const tRing = new THREE.Mesh(tRingGeo, tRingMat);
  tRing.renderOrder = 9001;
  tRing.userData['gizmoTarget'] = true;
  targetGroup.add(tRing);
  const tBoxGeo = new THREE.PlaneGeometry(48, 32);
  tBoxGeo.rotateX(-Math.PI / 2);
  const tMat = new THREE.MeshBasicMaterial({
    color: 0xe8c068, transparent: true, opacity: 0.55,
    depthTest: false, side: THREE.DoubleSide,
  });
  const tBox = new THREE.Mesh(tBoxGeo, tMat);
  tBox.renderOrder = 9002;
  tBox.userData['gizmoTarget'] = true;
  targetGroup.add(tBox);
  const tEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(tBoxGeo),
    new THREE.LineBasicMaterial({ color: 0xfae098, depthTest: false, linewidth: 2 }),
  );
  tEdges.renderOrder = 9003;
  targetGroup.add(tEdges);
  const crossGeo = new THREE.BufferGeometry();
  const crossPos = new Float32Array([
    -16, 0.5, 0, 16, 0.5, 0,
    0, 0.5, -10, 0, 0.5, 10,
  ]);
  crossGeo.setAttribute('position', new THREE.BufferAttribute(crossPos, 3));
  const cross = new THREE.LineSegments(
    crossGeo,
    new THREE.LineBasicMaterial({ color: 0xff5040, depthTest: false }),
  );
  cross.renderOrder = 9004;
  targetGroup.add(cross);
  const pillarGeo = new THREE.CylinderGeometry(1.5, 1.5, 80, 8);
  pillarGeo.translate(0, 40, 0);
  const pillarMat = new THREE.MeshBasicMaterial({
    color: 0xe8c068, transparent: true, opacity: 0.55, depthTest: false,
  });
  const pillar = new THREE.Mesh(pillarGeo, pillarMat);
  pillar.renderOrder = 9005;
  pillar.userData['gizmoTarget'] = true;
  targetGroup.add(pillar);

  // Sight line
  const sightGeo = new THREE.BufferGeometry();
  const sightPos = new Float32Array(6);
  sightGeo.setAttribute('position', new THREE.BufferAttribute(sightPos, 3));
  const sightLine = new THREE.LineSegments(
    sightGeo,
    new THREE.LineDashedMaterial({
      color: 0xe8c068, transparent: true, opacity: 0.5,
      dashSize: 8, gapSize: 6, depthTest: false,
    }),
  );
  sightLine.renderOrder = 9000;

  // Path preview
  const pathGeo = new THREE.BufferGeometry();
  const pathPos = new Float32Array(64 * 3);
  pathGeo.setAttribute('position', new THREE.BufferAttribute(pathPos, 3));
  const pathLine = new THREE.Line(
    pathGeo,
    new THREE.LineBasicMaterial({
      color: 0xc080ff, transparent: true, opacity: 0.55, depthTest: false,
    }),
  );
  pathLine.renderOrder = 8999;
  pathLine.frustumCulled = false;

  _gizmo = {
    group,
    body,
    lens,
    viewfinder: vf,
    axes: [axisX, axisY, axisZ],
    frustum,
    frustumPositions,
    targetGroup,
    targetMesh: tBox,
    targetEdges: tEdges,
    targetCross: cross,
    sightLine,
    pathLine,
    pathPositions: pathPos,
  };
  _gizmo.group.visible = false;
  _gizmo.targetGroup.visible = false;
  _gizmo.sightLine.visible = false;
  _gizmo.pathLine.visible = false;
  scene.add(_gizmo.group);
  scene.add(_gizmo.targetGroup);
  scene.add(_gizmo.sightLine);
  scene.add(_gizmo.pathLine);
  return _gizmo;
}

export function getCameraGizmo(): CameraGizmo | null {
  return _gizmo;
}

// Actualiza la pose del gizmo (posición + lookAt + roll), recalcula frustum
// según lens (mm), redibuja sight line entre cámara y target, y arma path
// line con las posiciones de los kfs (orden temporal).
export function renderCameraGizmoPose(
  pose: CameraPose,
  kfPositions: { x: number; y: number; z: number }[],
): void {
  if (!_gizmo) return;
  const { position: pos, target: tgt, lens, roll } = pose;
  _gizmo.group.position.set(pos.x, pos.y, pos.z);
  // Rodrigues' rotation: rotar (0,1,0) alrededor del eje forward por roll
  const fx = tgt.x - pos.x, fy = tgt.y - pos.y, fz = tgt.z - pos.z;
  const flen = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
  const fxn = fx / flen, fyn = fy / flen, fzn = fz / flen;
  const cR = Math.cos(roll), sR = Math.sin(roll);
  const ux0 = 0, uy0 = 1, uz0 = 0;
  const dot = fxn * ux0 + fyn * uy0 + fzn * uz0;
  const upX = ux0 * cR + (fyn * uz0 - fzn * uy0) * sR + fxn * dot * (1 - cR);
  const upY = uy0 * cR + (fzn * ux0 - fxn * uz0) * sR + fyn * dot * (1 - cR);
  const upZ = uz0 * cR + (fxn * uy0 - fyn * ux0) * sR + fzn * dot * (1 - cR);
  _gizmo.group.up.set(upX, upY, upZ);
  _gizmo.group.lookAt(tgt.x, tgt.y, tgt.z);
  _gizmo.targetGroup.position.set(tgt.x, Math.max(0.5, tgt.y), tgt.z);

  // Frustum: pirámide proyectada en world units. Convertir lens (mm) a fov (rad).
  // fov (deg) ≈ 2 * atan(36 / (2 * lens))   — sensor 36mm fullframe
  const fovRad = 2 * Math.atan(36 / (2 * lens));
  const aspect = 16 / 9;
  const dist = Math.sqrt((tgt.x - pos.x) ** 2 + (tgt.y - pos.y) ** 2 + (tgt.z - pos.z) ** 2);
  const farDist = Math.max(60, dist);
  const halfH = Math.tan(fovRad / 2) * farDist;
  const halfW = halfH * aspect;
  const corners: [number, number, number][] = [
    [-halfW, halfH, farDist],
    [halfW, halfH, farDist],
    [halfW, -halfH, farDist],
    [-halfW, -halfH, farDist],
  ];
  const positions = _gizmo.frustumPositions;
  for (let i = 0; i < 4; i++) {
    const c = corners[i]!;
    positions[i * 6 + 0] = 0;
    positions[i * 6 + 1] = 0;
    positions[i * 6 + 2] = 0;
    positions[i * 6 + 3] = c[0];
    positions[i * 6 + 4] = c[1];
    positions[i * 6 + 5] = c[2];
  }
  _gizmo.frustum.geometry.attributes['position']!.needsUpdate = true;
  _gizmo.frustum.geometry.computeBoundingSphere();

  // Sight line entre gizmo (pos) y target (tgt)
  const sightPos = _gizmo.sightLine.geometry.attributes['position']!.array as Float32Array;
  sightPos[0] = pos.x; sightPos[1] = pos.y; sightPos[2] = pos.z;
  sightPos[3] = tgt.x; sightPos[4] = tgt.y; sightPos[5] = tgt.z;
  _gizmo.sightLine.geometry.attributes['position']!.needsUpdate = true;
  _gizmo.sightLine.computeLineDistances();

  // Path line: une todas las posiciones de kfs en orden temporal
  const pathPos = _gizmo.pathPositions;
  const maxPts = Math.min(64, kfPositions.length);
  for (let i = 0; i < maxPts; i++) {
    const p = kfPositions[i]!;
    pathPos[i * 3 + 0] = p.x;
    pathPos[i * 3 + 1] = p.y;
    pathPos[i * 3 + 2] = p.z;
  }
  _gizmo.pathLine.geometry.attributes['position']!.needsUpdate = true;
  _gizmo.pathLine.geometry.setDrawRange(0, maxPts);
  _gizmo.pathLine.geometry.computeBoundingSphere();
}

export function setCameraGizmoVisible(v: boolean): void {
  if (!_gizmo) return;
  _gizmo.group.visible = !!v;
  _gizmo.targetGroup.visible = !!v;
  _gizmo.sightLine.visible = !!v;
  _gizmo.pathLine.visible = !!v;
}
