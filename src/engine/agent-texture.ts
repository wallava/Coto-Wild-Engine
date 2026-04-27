// Genera la textura del sprite de un agente: cerebro grande + item al
// lado derecho. El brainFlipped se usa cuando el agente camina hacia la
// izquierda (cerebro mirror horizontal); el item NUNCA se flipea.
//
// Tamaño del item viene de ITEM_SIZES (catálogo AGENTS.INC) — proporcional
// al objeto real (bombilla chica, caja grande, etc).

import * as THREE from 'three';
import { BRAIN_FONT_SIZE, getItemSize } from '../game/agent-kits';

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
  ctx.font = `${BRAIN_FONT_SIZE}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  if (brainFlipped) {
    ctx.save();
    ctx.translate(76, 0);
    ctx.scale(-1, 1);
    ctx.fillText(left, 0, 130);
    ctx.restore();
  } else {
    ctx.fillText(left, 76, 130);
  }

  // Item: tamaño según ITEM_SIZES. NUNCA flipped. Base alineada con base
  // del cerebro (sostenido a su altura, no flotando arriba).
  const itemSize = getItemSize(right);
  ctx.font = `${itemSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  const itemBaseY = 130 + BRAIN_FONT_SIZE / 2;
  const itemCenterY = itemBaseY - itemSize / 2;
  // X del item: borde derecho del cerebro + half del item + margen chico.
  const itemX = 76 + BRAIN_FONT_SIZE * 0.36 + itemSize * 0.35 + 4;
  ctx.fillText(right, itemX, itemCenterY);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}
