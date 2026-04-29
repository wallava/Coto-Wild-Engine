// Genera la textura del sprite de un agente: cerebro grande + item al
// lado derecho. El brainFlipped se usa cuando el agente camina hacia la
// izquierda (cerebro mirror horizontal); el item NUNCA se flipea.
//
// Tamaño del item viene del catálogo del juego (game/agent-kits) — proporcional
// al objeto real (bombilla chica, caja grande, etc). Se inyecta vía setter
// para preservar la regla de layering "engine no importa game".

import * as THREE from 'three';

type AgentTextureCatalog = {
  brainFontSize: number;
  getItemSize: (emoji: string) => number;
};

// Defaults seguros: si el wiring de main.ts todavía no corrió cuando alguien
// llama createAgentTexture, los valores por defecto preservan el render.
let _brainFontSize = 110;
let _getItemSize: (emoji: string) => number = () => 60;

export function setAgentTextureCatalog(catalog: AgentTextureCatalog): void {
  _brainFontSize = catalog.brainFontSize;
  _getItemSize = catalog.getItemSize;
}

export function createAgentTexture(
  left: string,
  right: string,
  brainFlipped: boolean,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Cerebro: tamaño fijo grande, opcionalmente flipped horizontal cuando
  // el agente camina hacia la izquierda.
  ctx.font = `${_brainFontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  if (brainFlipped) {
    ctx.save();
    ctx.translate(76, 0);
    ctx.scale(-1, 1);
    ctx.fillText(left, 0, 130);
    ctx.restore();
  } else {
    ctx.fillText(left, 76, 130);
  }

  // Item: tamaño según catálogo inyectado. NUNCA flipped. Base alineada con
  // base del cerebro (sostenido a su altura, no flotando arriba).
  const itemSize = _getItemSize(right);
  ctx.font = `${itemSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  const itemBaseY = 130 + _brainFontSize / 2;
  const itemCenterY = itemBaseY - itemSize / 2;
  // X del item: borde derecho del cerebro + half del item + margen chico.
  const itemX = 76 + _brainFontSize * 0.36 + itemSize * 0.35 + 4;
  ctx.fillText(right, itemX, itemCenterY);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}
