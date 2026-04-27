// Selección click-to-move del agente. Anillo amarillo translúcido en el piso
// bajo el agente seleccionado, sincronizado por syncAgentMesh (chassis hook).
//
// State interno: selectedAgent + highlight mesh. Otros módulos consultan via
// getters (chassis necesita ambos para el sync de posición).

import * as THREE from 'three';
import { getScene } from './scene-graph';
import { getRaycaster, setRaycasterFromEvent } from './raycaster';
import { syncAgentMesh, type Agent } from './agent-chassis';

const HIGHLIGHT_INNER_R = 20;
const HIGHLIGHT_OUTER_R = 26;
const HIGHLIGHT_SEGMENTS = 28;
const HIGHLIGHT_COLOR = 0xffe060;
const HIGHLIGHT_OPACITY = 0.75;
const HIGHLIGHT_RENDER_ORDER = 998;

let _selected: Agent | null = null;
let _highlight: THREE.Mesh | null = null;
let _getAgents: () => Agent[] = () => [];

export function initAgentSelection(getAgents: () => Agent[]): void {
  _getAgents = getAgents;
}

export function getSelectedAgent(): Agent | null {
  return _selected;
}

export function getAgentHighlight(): THREE.Mesh | null {
  return _highlight;
}

export function clearAgentSelection(): void {
  if (_highlight) {
    const scene = getScene();
    if (scene) scene.remove(_highlight);
    _highlight.geometry.dispose();
    (_highlight.material as THREE.Material).dispose();
    _highlight = null;
  }
  _selected = null;
}

export function selectAgent(agent: Agent | null): void {
  clearAgentSelection();
  _selected = agent;
  if (!agent) return;
  const scene = getScene();
  if (!scene) return;
  const geo = new THREE.RingGeometry(HIGHLIGHT_INNER_R, HIGHLIGHT_OUTER_R, HIGHLIGHT_SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: HIGHLIGHT_COLOR,
    transparent: true,
    opacity: HIGHLIGHT_OPACITY,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  _highlight = new THREE.Mesh(geo, mat);
  _highlight.renderOrder = HIGHLIGHT_RENDER_ORDER;
  scene.add(_highlight);
  syncAgentMesh(agent);
}

// Raycast click → agente (intersección contra los sprites). null si no
// pegó a ninguno o no hay agentes con mesh.
export function getAgentFromEvent(event: { clientX: number; clientY: number }): Agent | null {
  setRaycasterFromEvent(event);
  const agents = _getAgents();
  const sprites = agents.map((a) => a.mesh).filter((m): m is THREE.Sprite => !!m);
  if (sprites.length === 0) return null;
  const hits = getRaycaster().intersectObjects(sprites, false);
  if (hits.length === 0) return null;
  return agents.find((a) => a.mesh === hits[0]!.object) ?? null;
}
