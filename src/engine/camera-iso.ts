// Cámara isométrica ortográfica del engine.
// Mantiene pose y zoom de la vista principal, pero no crea la cámara Three:
// legacy/main sigue siendo el owner de esa instancia durante la migración.
// El hook de cuadrante permite reconstruir paredes cutaway solo cuando toca.

import type * as THREE from 'three';
import type { WallMode } from './wall-mode';

const DEFAULT_THETA = Math.PI / 4;
const DEFAULT_PHI = Math.atan(1 / Math.sqrt(2));
const CAMERA_DISTANCE = 1500;
const MIN_PHI = 0.05;
const MAX_PHI = Math.PI / 2 - MIN_PHI;

type CameraQuadrant = '' | 'ES' | 'EN' | 'WS' | 'WN';

type CameraIsoHooks = {
  getCamera: () => THREE.OrthographicCamera;
  getWallMode: () => WallMode;
  onQuadrantChanged: () => void;
};

let hooks: CameraIsoHooks | null = null;

let theta = DEFAULT_THETA;
let phi = DEFAULT_PHI;
const dist = CAMERA_DISTANCE;
let camZoom = 1;
let panX = 0;
let panZ = 0;
let lastCamQuadrant: CameraQuadrant = '';

/** Inicializa los hooks que conectan cámara, wall mode y rebuild cutaway. */
export function initCameraIso(nextHooks: CameraIsoHooks): void {
  hooks = nextHooks;
}

/** Devuelve el azimuth actual de la cámara, en radianes. */
export function getTheta(): number {
  return theta;
}

/** Devuelve la elevación actual de la cámara, en radianes. */
export function getPhi(): number {
  return phi;
}

/** Devuelve la distancia fija usada para proyectar la cámara iso. */
export function getDist(): number {
  return dist;
}

/** Devuelve el zoom ortográfico actual. */
export function getCamZoom(): number {
  return camZoom;
}

/** Devuelve el pan horizontal X del target de cámara. */
export function getPanX(): number {
  return panX;
}

/** Devuelve el pan horizontal Z del target de cámara. */
export function getPanZ(): number {
  return panZ;
}

/** Ajusta el azimuth de cámara, en radianes. */
export function setTheta(nextTheta: number): void {
  theta = nextTheta;
}

/** Ajusta la elevación de cámara, clampeada al rango navegable. */
export function setPhi(nextPhi: number): void {
  phi = Math.max(MIN_PHI, Math.min(MAX_PHI, nextPhi));
}

/** Ajusta el zoom ortográfico. El caller decide límites de UI. */
export function setCamZoom(nextCamZoom: number): void {
  camZoom = nextCamZoom;
}

/** Ajusta el pan X del target de cámara. */
export function setPanX(nextPanX: number): void {
  panX = nextPanX;
}

/** Ajusta el pan Z del target de cámara. */
export function setPanZ(nextPanZ: number): void {
  panZ = nextPanZ;
}

/** Aplica la pose iso a la cámara Three y dispara rebuild si cambia el cuadrante cutaway. */
export function updateCamera(): void {
  if (!hooks) {
    throw new Error('camera-iso no fue inicializado. Llama initCameraIso() antes de updateCamera().');
  }
  const camera = hooks.getCamera();
  camera.up.set(0, 1, 0);   // reset roll inducido por POV cinemático
  camera.position.x = panX + dist * Math.cos(phi) * Math.sin(theta);
  camera.position.y = dist * Math.sin(phi);
  camera.position.z = panZ + dist * Math.cos(phi) * Math.cos(theta);
  camera.lookAt(panX, 0, panZ);
  camera.zoom = camZoom;
  camera.updateProjectionMatrix();

  const quadrant = computeCameraQuadrant(theta);
  if (hooks.getWallMode() === 'cutaway' && quadrant !== lastCamQuadrant) {
    lastCamQuadrant = quadrant;
    hooks.onQuadrantChanged();
  } else {
    lastCamQuadrant = quadrant;
  }
}

function computeCameraQuadrant(nextTheta: number): CameraQuadrant {
  return `${Math.sin(nextTheta) > 0 ? 'E' : 'W'}${Math.cos(nextTheta) > 0 ? 'S' : 'N'}`;
}
