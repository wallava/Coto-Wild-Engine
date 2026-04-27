// Voces de agentes: 5 presets que se asignan determinísticamente al spawn
// (hash del agent.id). Frecuencia base cae como cuadrada (square4) en
// triggerAttackRelease para tono cartoony tipo Animal Crossing.

export type VoicePreset = {
  name: string;
  baseFreq: number;
};

export const VOICE_PRESETS: VoicePreset[] = [
  { name: 'agudo', baseFreq: 320 },
  { name: 'medio-alto', baseFreq: 260 },
  { name: 'medio', baseFreq: 210 },
  { name: 'medio-grave', baseFreq: 175 },
  { name: 'grave', baseFreq: 145 },
];

export function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickVoiceIdx(agentId: unknown): number {
  return hashStringToInt(String(agentId)) % VOICE_PRESETS.length;
}
