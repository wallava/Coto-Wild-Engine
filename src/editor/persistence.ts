/**
 * Borde de persistencia del editor de cutscenes.
 * Envuelve localStorage + serialización y ofrece un dispatcher pequeño para
 * aplicar data con callbacks legacy hasta extraer lifecycle.
 */

import type { Cutscene } from '../cutscene/model';
import {
  deleteSavedCutscene,
  getSavedCutscene,
  loadAllSavedCutscenes,
  normalizeCutsceneData,
  saveCutsceneByName,
  serializeCutscene,
  type CutsceneData,
  type SavedCutscenesMap,
} from '../cutscene/persistence';

export type ApplyCutsceneCallbacks = {
  setCutsceneData: (data: CutsceneData) => void;
  replaceCutsceneAgentsIfOpen: (data: CutsceneData) => void;
  refreshCameraGizmoFromData: (data: CutsceneData) => void;
  refreshEditorAfterDataChange: () => void;
};

/** Lista todas las cutscenes guardadas por nombre. */
export function listSavedCutscenes(): SavedCutscenesMap {
  return loadAllSavedCutscenes();
}

/** Guarda la cutscene actual bajo `name`. */
export function saveCurrentCutscene(name: string, cutscene: Cutscene): void {
  saveCutsceneByName(name, serializeCutscene(cutscene));
}

/** Carga data serializada por nombre, o null si no existe. */
export function loadCutsceneByName(name: string): CutsceneData | null {
  return getSavedCutscene(name);
}

/** Borra una cutscene guardada por nombre. */
export function deleteCutsceneByName(name: string): void {
  deleteSavedCutscene(name);
}

/** Factory de cutscene vacía compatible con el modelo persistido actual. */
export function newEmptyCutscene(): CutsceneData {
  return {
    duration: 30,
    tracks: [],
    camera: { keyframes: [], parentAgentId: null },
    fx: { entities: [] },
    walls: { keyframes: [] },
    agents: [],
    sceneNames: {},
    scenes: [],
  };
}

/** Aplica una cutscene cargada en el orden acordado para el split de legacy. */
export function applyCutsceneDataWithCallbacks(
  data: CutsceneData | null,
  callbacks: ApplyCutsceneCallbacks,
): void {
  if (!data) return;
  normalizeCutsceneData(data);
  callbacks.setCutsceneData(data);
  callbacks.replaceCutsceneAgentsIfOpen(data);
  callbacks.refreshCameraGizmoFromData(data);
  callbacks.refreshEditorAfterDataChange();
}
