// Sistema de necesidades del agente. 4 needs decaen con el tiempo
// (0=crítico, 100=lleno). Cada una se restaura en zonas específicas
// (ZONE_RESTORES). Cuando una need baja del threshold, el agente busca
// autónomamente una zona apropiada.
//
// Working: cuando un agente trabaja en una estación funcional, restore
// pasivo se multiplica por WORKING_RESTORE_MULT durante WORKING_DURATION.

export const NEED_TYPES = ['focus', 'hunger', 'social', 'bathroom'] as const;
export type NeedType = (typeof NEED_TYPES)[number];

// Decay por segundo. Valores bajos para que el ciclo dure varios minutos
// (sino los agentes están constantemente en pánico).
export const NEED_DECAY: Record<NeedType, number> = {
  focus:    0.6,   // ~165s para vaciar (2.7 min)
  hunger:   0.4,   // ~250s
  social:   0.5,   // ~200s
  bathroom: 0.7,   // ~143s (más urgente)
};

export const NEED_THRESHOLD_CRITICAL = 30;     // bajo esto: aparece overlay + busca zona
export const NEED_THRESHOLD_OK = 75;            // sobre esto: overlay desaparece

// Restauración pasiva (estando en la zona): rate por segundo. Las keys son
// kind de zona (ROOM_KINDS). Las inner keys son NeedType.
export const ZONE_RESTORES: Record<string, Partial<Record<NeedType, number>>> = {
  kitchen:  { hunger: 14 },
  bathroom: { bathroom: 22 },
  lounge:   { focus: 9, social: 4 },
  social:   { social: 14 },
  creative: { focus: 7 },
  meeting:  { social: 6 },
  outdoor:  { focus: 4, social: 2 },
  office:   {},                           // se trabaja, no descansa
  storage:  {},
  lobby:    {},
};

// Multiplier extra cuando el agente está "working" en una estación funcional
export const WORKING_RESTORE_MULT = 2.5;
// Duración default de una sesión working (segundos)
export const WORKING_DURATION = 8;

// Indicador visual de need crítica (sprite arriba del agente).
export const NEED_EMOJI: Record<NeedType, string> = {
  focus:    '💤',
  hunger:   '🍔',
  social:   '💬',
  bathroom: '🚽',
};

// Emoji que aparece sobre la cabeza durante working, según kind de zona.
export const WORKING_EMOJI: Record<string, string> = {
  office:   '💼',
  meeting:  '🗣️',
  kitchen:  '🍳',
  lounge:   '😌',
  bathroom: '🚿',
  creative: '🎨',
  social:   '🍻',
  outdoor:  '🌳',
  storage:  '📦',
  lobby:    '👋',
};
