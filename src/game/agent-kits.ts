// Catálogo de agentes AGENTS.INC: variedad de items que el agente lleva
// al lado del cerebro + tamaños proporcionales por emoji.
//
// El cerebro siempre se renderiza grande (BRAIN_FONT_SIZE). El item al
// lado es proporcional al tamaño "real" del objeto: una bombilla es
// chica, una caja es grande, un café mediano. Editá ITEM_SIZES y los
// tamaños quedan guardados en el juego como defaults por objeto.
// Si un emoji no está en ITEM_SIZES, usa ITEM_DEFAULT_SIZE.

export type AgentKit = readonly [string, string];

export const AGENT_KITS: readonly AgentKit[] = [
  ['🧠', '💼'], ['🧠', '📦'], ['🧠', '🛠️'], ['🧠', '💻'],
  ['🧠', '📱'], ['🧠', '☕'], ['🧠', '🔬'], ['🧠', '📊'],
  ['🧠', '🔧'], ['🧠', '📋'], ['🧠', '💡'], ['🧠', '🎯'],
];

export const BRAIN_FONT_SIZE = 110;
export const ITEM_DEFAULT_SIZE = 60;

export const ITEM_SIZES: Record<string, number> = {
  '💼': 64,    // maletín — mediano
  '📦': 76,    // caja — grande
  '🛠️': 60,    // martillo — mediano
  '💻': 70,    // laptop — grande-mediano
  '📱': 50,    // teléfono — chico
  '☕': 56,    // café — chico-mediano
  '🔬': 64,    // microscopio — mediano
  '📊': 60,    // gráfico — mediano
  '🔧': 56,    // llave inglesa — chico-mediano
  '📋': 60,    // clipboard — mediano
  '💡': 48,    // bombilla — chica
  '🎯': 56,    // diana — chico-mediano
};

export function getItemSize(emoji: string): number {
  return ITEM_SIZES[emoji] ?? ITEM_DEFAULT_SIZE;
}
