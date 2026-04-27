// SPEECH SYSTEM: dos UIs de diálogo unificadas con audio (Animal Crossing-style).
//   - SpeechBubble overhead: aparece sobre la cabeza del agente, sigue movimiento.
//     Para reacciones cortas, encuentros sociales, status, confused.
//   - DialoguePanel inferior: panel fijo. Conversaciones extendidas + cutscenes.
//     Bloquea inputs del jugador (mover/construir/drag), simulación sigue corriendo.
//
// Audio: Tone.js PolySynth con onda square4 (cartoony). Cada agente tiene un
// voiceIdx determinístico (hash del id) que selecciona freq base de VOICE_PRESETS.

import * as THREE from 'three';
import * as Tone from 'tone';
import { CELL, centerX, centerZ } from './state';
import { VOICE_PRESETS } from './voices';
import { escapeHtml } from '../utils/escape-html';

// ── Tipos ──────────────────────────────────────────────────────────
type AgentLike = {
  id?: unknown;
  emoji?: string;
  voiceIdx?: number;
  talking?: boolean;
  px: number;
  py: number;
  spriteH: number;
};

type BubbleOpts = {
  cps?: number;
  autoCloseAfter?: number | null;
  fontSize?: number;
  maxWidth?: number;
};

type SpeechBubble = {
  agent: AgentLike;
  fullText: string;
  charsRevealed: number;
  charsPerSec: number;
  autoCloseAfter: number | null;
  timeRevealed: number | null;
  mesh: THREE.Sprite | null;
  _lastVisibleChars: number;
  _voiceCounter: number;
  bornAt: number;
  bounceIn: number;
  bounceInTotal: number;
  fadeOut: number;
  fadeOutDuration: number;
};

type DialogueOpts = {
  cps?: number;
  name?: string;
  onComplete?: (() => void) | null;
};

type ActiveDialogue = {
  agent: AgentLike | null;
  segments: string[];
  currentIdx: number;
  charsRevealed: number;
  charsPerSec: number;
  fullyRevealed: boolean;
  onComplete: (() => void) | null;
  voiceCounter: number;
  _lastVisibleChars: number;
  accelerating: boolean;
};

// ── State del módulo ──────────────────────────────────────────────
let _scene: THREE.Scene | null = null;
let _getAgents: (() => AgentLike[]) | null = null;

let voiceSynth: Tone.PolySynth | null = null;
let voiceContextStarted = false;
const speechBubbles: SpeechBubble[] = [];
let activeDialogue: ActiveDialogue | null = null;
let dialogueKeyHeld = false;

// ── Voice subsystem ───────────────────────────────────────────────
function ensureVoiceSynth(): Tone.PolySynth | null {
  if (voiceSynth) return voiceSynth;
  voiceSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square4' },
    envelope: { attack: 0.005, decay: 0.045, sustain: 0, release: 0.025 },
  }).toDestination();
  voiceSynth.volume.value = -18;
  return voiceSynth;
}

export async function startVoiceContext(): Promise<void> {
  if (voiceContextStarted) return;
  try {
    await Tone.start();
    voiceContextStarted = true;
    ensureVoiceSynth();
  } catch (e) {
    console.warn('[voice] Tone.start failed:', e);
  }
}

export function playVoiceTone(voiceIdx: number): void {
  const synth = ensureVoiceSynth();
  if (!synth || !voiceContextStarted) return;
  const preset = VOICE_PRESETS[voiceIdx % VOICE_PRESETS.length]!;
  const variation = (Math.random() - 0.5) * 0.1;
  const freq = preset.baseFreq * (1 + variation);
  try {
    synth.triggerAttackRelease(freq, 0.04);
  } catch {
    // concurrent triggers can fail silently
  }
}

// ── Helpers de texto y dibujo del bubble ───────────────────────────
function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = String(text).split('\n');
  const lines: string[] = [];
  for (const p of paragraphs) {
    const words = p.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tailBaseX: number,
  tailHeight: number,
  tailDir: 'left' | 'right' | 'center',
): void {
  const r = 10;
  const tailHalf = 7;
  const tailTipOffset = tailDir === 'left' ? -6 : tailDir === 'right' ? 6 : 0;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(tailBaseX + tailHalf, y + h);
  ctx.lineTo(tailBaseX + tailTipOffset, y + h + tailHeight);
  ctx.lineTo(tailBaseX - tailHalf, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = '#fdf6dd';
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function createBubbleCanvas(text: string, opts: BubbleOpts = {}): HTMLCanvasElement {
  const fontSize = opts.fontSize ?? 15;
  const padding = 10;
  const maxWidth = opts.maxWidth ?? 170;
  const tailHeight = 14;
  const fontStr = `bold ${fontSize}px "Comic Sans MS", "Marker Felt", "Trebuchet MS", sans-serif`;
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;
  measureCtx.font = fontStr;
  const lines = text.length > 0 ? wrapTextLines(measureCtx, text, maxWidth - padding * 2) : [''];
  const lineHeight = fontSize * 1.25;
  const textWidth = Math.max(40, ...lines.map((l) => measureCtx.measureText(l).width));
  const bubbleW = Math.ceil(textWidth + padding * 2);
  const bubbleH = Math.ceil(lines.length * lineHeight + padding * 2 - 4);
  const margin = 6;
  const canvas = document.createElement('canvas');
  canvas.width = bubbleW + margin * 2;
  canvas.height = bubbleH + tailHeight + margin * 2;
  const ctx = canvas.getContext('2d')!;
  drawSpeechBubble(ctx, margin, margin, bubbleW, bubbleH,
                   margin + bubbleW * 0.42, tailHeight, 'left');
  ctx.font = fontStr;
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i]!, margin + bubbleW / 2, margin + padding - 2 + i * lineHeight);
  }
  return canvas;
}

// ── SpeechBubble overhead ──────────────────────────────────────────
export function removeAgentBubble(agent: AgentLike): void {
  if (!_scene) return;
  for (let i = speechBubbles.length - 1; i >= 0; i--) {
    if (speechBubbles[i]!.agent === agent) {
      const b = speechBubbles[i]!;
      if (b.mesh) {
        _scene.remove(b.mesh);
        const mat = b.mesh.material as THREE.SpriteMaterial;
        if (mat.map) mat.map.dispose();
        mat.dispose();
      }
      speechBubbles.splice(i, 1);
    }
  }
}

export function showSpeechBubble(
  agent: AgentLike,
  text: string,
  opts: BubbleOpts = {},
): SpeechBubble | null {
  if (!_scene) return null;
  if (!agent || !text) return null;
  removeAgentBubble(agent);
  const bubble: SpeechBubble = {
    agent,
    fullText: String(text),
    charsRevealed: 0,
    charsPerSec: opts.cps ?? 30,
    autoCloseAfter: opts.autoCloseAfter !== undefined ? opts.autoCloseAfter : 2.5,
    timeRevealed: null,
    mesh: null,
    _lastVisibleChars: -1,
    _voiceCounter: 0,
    bornAt: performance.now() / 1000,
    bounceIn: 0.22,
    bounceInTotal: 0.22,
    fadeOut: 0,
    fadeOutDuration: 0.3,
  };
  const canvas = createBubbleCanvas('', opts);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    depthTest: false,
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(canvas.width, canvas.height, 1);
  sprite.userData['baseW'] = canvas.width;
  sprite.userData['baseH'] = canvas.height;
  sprite.renderOrder = 1100;
  _scene.add(sprite);
  bubble.mesh = sprite;
  speechBubbles.push(bubble);
  return bubble;
}

function regenerateBubbleTexture(bubble: SpeechBubble, visibleChars: number): void {
  if (!bubble.mesh) return;
  const visibleText = bubble.fullText.substr(0, visibleChars);
  const canvas = createBubbleCanvas(visibleText.length > 0 ? visibleText : ' ', {});
  const mat = bubble.mesh.material as THREE.SpriteMaterial;
  if (mat.map) mat.map.dispose();
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  mat.map = tex;
  mat.needsUpdate = true;
  bubble.mesh.userData['baseW'] = canvas.width;
  bubble.mesh.userData['baseH'] = canvas.height;
}

export function updateSpeechBubbles(dt: number): void {
  if (!_scene) return;
  const now = performance.now() / 1000;
  for (let i = speechBubbles.length - 1; i >= 0; i--) {
    const b = speechBubbles[i]!;
    if (!b.agent || !b.mesh) {
      speechBubbles.splice(i, 1);
      continue;
    }
    b.charsRevealed += b.charsPerSec * dt;
    let visibleChars = Math.floor(b.charsRevealed);
    if (visibleChars > b.fullText.length) visibleChars = b.fullText.length;
    if (visibleChars !== b._lastVisibleChars) {
      const newChars = visibleChars - b._lastVisibleChars;
      for (let n = 0; n < newChars; n++) {
        const ch = b.fullText[b._lastVisibleChars + 1 + n];
        if (ch && /\S/.test(ch)) {
          b._voiceCounter++;
          if (b._voiceCounter % 2 === 0) playVoiceTone(b.agent.voiceIdx ?? 0);
        }
      }
      b._lastVisibleChars = visibleChars;
      regenerateBubbleTexture(b, visibleChars);
    }
    if (b.timeRevealed === null && visibleChars >= b.fullText.length) {
      b.timeRevealed = now;
    }
    if (b.timeRevealed !== null && b.autoCloseAfter !== null && b.fadeOut === 0) {
      if (now - b.timeRevealed >= b.autoCloseAfter) b.fadeOut = 0.001;
    }
    let fadeAlpha = 1;
    if (b.fadeOut > 0) {
      b.fadeOut += dt;
      fadeAlpha = Math.max(0, 1 - b.fadeOut / b.fadeOutDuration);
      const mat = b.mesh.material as THREE.SpriteMaterial;
      mat.opacity = fadeAlpha;
      if (fadeAlpha <= 0) {
        _scene.remove(b.mesh);
        if (mat.map) mat.map.dispose();
        mat.dispose();
        speechBubbles.splice(i, 1);
        continue;
      }
    }
    const ax = b.agent.px * CELL - centerX - 6;
    const baseH = (b.mesh.userData['baseH'] as number) ?? 0;
    const baseW = (b.mesh.userData['baseW'] as number) ?? 0;
    const ay = b.agent.spriteH * 0.85 + baseH / 2;
    const az = b.agent.py * CELL - centerZ - 14;
    b.mesh.position.set(ax, ay, az);
    let scaleMult = 1;
    if (b.bounceIn > 0) {
      b.bounceIn -= dt;
      const t = 1 - Math.max(0, b.bounceIn / b.bounceInTotal);
      const overshoot = 1 + 0.18 * Math.sin(t * Math.PI);
      scaleMult = t < 1 ? overshoot * (t * t * (3 - 2 * t)) : 1;
    }
    b.mesh.scale.set(baseW * scaleMult, baseH * scaleMult, 1);
  }
}

// ── DialoguePanel inferior ─────────────────────────────────────────
function drawAgentPortrait(agent: AgentLike | null, canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffeaa6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#e8c878';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  ctx.font = '78px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🧠', canvas.width / 2 - 10, canvas.height / 2 + 4);
  if (agent && agent.emoji) {
    ctx.font = '34px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.fillText(agent.emoji, canvas.width / 2 + 30, canvas.height / 2 + 16);
  }
}

export function showDialoguePanel(
  agent: AgentLike | null,
  segments: string | string[],
  opts: DialogueOpts = {},
): void {
  if (typeof segments === 'string') segments = [segments];
  if (!Array.isArray(segments) || segments.length === 0) return;
  closeDialoguePanel();
  activeDialogue = {
    agent,
    segments,
    currentIdx: 0,
    charsRevealed: 0,
    charsPerSec: opts.cps ?? 30,
    fullyRevealed: false,
    onComplete: opts.onComplete ?? null,
    voiceCounter: 0,
    _lastVisibleChars: -1,
    accelerating: false,
  };
  if (agent) agent.talking = true;
  drawAgentPortrait(agent, document.getElementById('dialogue-portrait-canvas') as HTMLCanvasElement);
  const nameEl = document.getElementById('dialogue-name')!;
  nameEl.textContent = opts.name ?? (agent ? `Agente ${String(agent.id).slice(-3)}` : '');
  document.getElementById('dialogue-text')!.textContent = '';
  const panel = document.getElementById('dialogue-panel')!;
  panel.classList.remove('hidden');
  panel.classList.remove('advanceable');
}

export function advanceDialoguePanel(): void {
  if (!activeDialogue) return;
  const seg = activeDialogue.segments[activeDialogue.currentIdx]!;
  if (!activeDialogue.fullyRevealed) {
    activeDialogue.charsRevealed = seg.length;
    return;
  }
  activeDialogue.currentIdx++;
  if (activeDialogue.currentIdx >= activeDialogue.segments.length) {
    closeDialoguePanel();
    return;
  }
  activeDialogue.charsRevealed = 0;
  activeDialogue.fullyRevealed = false;
  activeDialogue._lastVisibleChars = -1;
  document.getElementById('dialogue-text')!.textContent = '';
  document.getElementById('dialogue-panel')!.classList.remove('advanceable');
}

export function closeDialoguePanel(): void {
  if (!activeDialogue) return;
  if (activeDialogue.agent) activeDialogue.agent.talking = false;
  if (activeDialogue.onComplete) {
    try {
      activeDialogue.onComplete();
    } catch (e) {
      console.warn(e);
    }
  }
  activeDialogue = null;
  const panel = document.getElementById('dialogue-panel')!;
  panel.classList.add('hidden');
  panel.classList.remove('advanceable');
}

export function updateDialoguePanel(dt: number): void {
  if (!activeDialogue) return;
  const seg = activeDialogue.segments[activeDialogue.currentIdx]!;
  const speed = activeDialogue.accelerating
    ? activeDialogue.charsPerSec * 4
    : activeDialogue.charsPerSec;
  activeDialogue.charsRevealed += speed * dt;
  if (activeDialogue.charsRevealed > seg.length) {
    activeDialogue.charsRevealed = seg.length;
    if (!activeDialogue.fullyRevealed) {
      activeDialogue.fullyRevealed = true;
      document.getElementById('dialogue-panel')!.classList.add('advanceable');
    }
  }
  const visibleChars = Math.floor(activeDialogue.charsRevealed);
  if (visibleChars !== activeDialogue._lastVisibleChars) {
    const newChars = visibleChars - activeDialogue._lastVisibleChars;
    for (let n = 0; n < newChars; n++) {
      const ch = seg[activeDialogue._lastVisibleChars + 1 + n];
      if (ch && /\S/.test(ch)) {
        activeDialogue.voiceCounter++;
        if (activeDialogue.voiceCounter % 2 === 0) {
          playVoiceTone(activeDialogue.agent ? activeDialogue.agent.voiceIdx ?? 0 : 2);
        }
      }
    }
    activeDialogue._lastVisibleChars = visibleChars;
    const txtEl = document.getElementById('dialogue-text')!;
    txtEl.textContent = seg.substr(0, visibleChars);
    if (activeDialogue.fullyRevealed) {
      txtEl.innerHTML = escapeHtml(seg) + '<span class="cursor"></span>';
    }
  }
}

export function isDialoguePanelActive(): boolean {
  return activeDialogue !== null;
}

// ── Test helpers (botón debug + window globals) ────────────────────
const TEST_PHRASES = [
  'Tengo unas ideas que te van a volar la cabeza.',
  'Estoy pivoteando hacia un nuevo paradigma.',
  'Necesito un café urgente.',
  '¿Alguien vio a mi product manager?',
  'Estoy iterando sobre el feedback del Q3.',
  'Synergy. Synergy en todo.',
  'Mi roadmap está completamente blockeado.',
  'Voy al baño, ya vuelvo.',
  'Hoy hicimos un pivot estratégico.',
  'Me siento alineado con la misión.',
  '¿Esto va a generar valor para el stakeholder?',
  'Estoy en deep work, no me molesten.',
  'Just shipped it.',
  'Necesitamos un standup urgente.',
  'Mi performance review viene fuerte.',
];

// ── Init ──────────────────────────────────────────────────────────
export function initSpeechSystem(opts: {
  scene: THREE.Scene;
  getAgents: () => AgentLike[];
}): void {
  _scene = opts.scene;
  _getAgents = opts.getAgents;

  // Inicializar audio context con la primera interacción del usuario
  window.addEventListener('pointerdown', startVoiceContext, { once: true });
  window.addEventListener('keydown', startVoiceContext, { once: true });

  // Listeners del panel
  document.getElementById('dialogue-panel')!.addEventListener('click', (e) => {
    e.stopPropagation();
    advanceDialoguePanel();
  });
  window.addEventListener('keydown', (e) => {
    if (!activeDialogue) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (!dialogueKeyHeld) {
        if (activeDialogue.fullyRevealed) advanceDialoguePanel();
        else activeDialogue.accelerating = true;
      }
      dialogueKeyHeld = true;
    } else if (e.code === 'Escape') {
      e.preventDefault();
      closeDialoguePanel();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      dialogueKeyHeld = false;
      if (activeDialogue) activeDialogue.accelerating = false;
    }
  });

  // API debug global (para consola)
  (window as any).testBubble = (text?: string) => {
    const agents = _getAgents!();
    if (agents.length === 0) {
      console.warn('no agents');
      return;
    }
    return showSpeechBubble(agents[0]!, text ?? 'Hola, soy un agente del sistema satírico.');
  };
  (window as any).testDialogue = (segments?: string[]) => {
    const agents = _getAgents!();
    if (agents.length === 0) {
      console.warn('no agents');
      return;
    }
    const segs = segments ?? [
      'Bienvenido a AGENTS.INC.',
      'Acá fabricamos agentes de IA, todos optimizados para hablar de "synergy".',
      'Si los descuidás, tu fábrica colapsa. Buena suerte.',
    ];
    return showDialoguePanel(agents[0]!, segs);
  };

  // Botón "💬 Test bubble"
  document.getElementById('btn-speech-test')!.addEventListener('click', async () => {
    await startVoiceContext();
    const agents = _getAgents!();
    if (agents.length === 0) {
      console.warn('[speech-test] no hay agentes');
      return;
    }
    const agent = agents[Math.floor(Math.random() * agents.length)]!;
    const phrase = TEST_PHRASES[Math.floor(Math.random() * TEST_PHRASES.length)]!;
    showSpeechBubble(agent, phrase, { autoCloseAfter: 3.0 });
  });
}
