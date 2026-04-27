// Persistencia de cutscenes en localStorage. Pure helpers — no acceso a
// scene/state runtime. El editor consume estos al guardar/cargar.
//
// Modelo serializado (CutsceneData) tiene shape compleja: tracks de agentes,
// camera kfs, fx, walls, scenes, etc. Tipado mínimo por ahora — el schema
// estricto va a Zod en Fase 3.

const CUTSCENES_STORAGE_KEY = 'agentsinc_cutscenes_v1';

export type CutsceneData = Record<string, unknown>;
export type SavedCutscenesMap = Record<string, CutsceneData>;

// Carga el mapa completo de cutscenes guardadas. Devuelve {} si no hay nada
// o si el JSON está corrupto.
export function loadAllSavedCutscenes(): SavedCutscenesMap {
  try {
    const raw = localStorage.getItem(CUTSCENES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) ?? {}) : {};
  } catch {
    return {};
  }
}

export function writeAllSavedCutscenes(map: SavedCutscenesMap): void {
  try {
    localStorage.setItem(CUTSCENES_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}

// Helpers convenience (no existían como funciones separadas en el monolito,
// pero son las dos operaciones de mantenimiento más comunes):

export function listSavedCutsceneNames(): string[] {
  return Object.keys(loadAllSavedCutscenes()).sort();
}

export function deleteSavedCutscene(name: string): void {
  const map = loadAllSavedCutscenes();
  if (!(name in map)) return;
  delete map[name];
  writeAllSavedCutscenes(map);
}

export function getSavedCutscene(name: string): CutsceneData | null {
  const map = loadAllSavedCutscenes();
  return map[name] ?? null;
}

export function saveCutsceneByName(name: string, data: CutsceneData): void {
  const map = loadAllSavedCutscenes();
  map[name] = data;
  writeAllSavedCutscenes(map);
}
