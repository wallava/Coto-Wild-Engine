/**
 * Undo/redo del editor de cutscenes.
 * Los snapshots son JSON strings para mantener compatibilidad con el monolito:
 * push/clear mutan stacks existentes; pop devuelve stacks nuevos y no muta.
 */

import { serializeCutscene, type CutsceneData } from '../cutscene/persistence';
import type { Cutscene } from '../cutscene/model';

const UNDO_MAX = 50;

export type UndoPopResult = {
  data: CutsceneData | null;
  undoStack: string[];
  redoStack: string[];
};

/** Guarda el estado actual de la cutscene en el stack de undo. */
export function pushSnapshot(cutscene: Cutscene, undoStack: string[]): void {
  const snap = serializeCutscene(cutscene);
  undoStack.push(JSON.stringify(snap));
  if (undoStack.length > UNDO_MAX) undoStack.shift();
}

/** Saca el último undo sin mutar los stacks recibidos. */
export function popUndo(undoStack: readonly string[], redoStack: readonly string[]): UndoPopResult {
  if (undoStack.length === 0) {
    return { data: null, undoStack: undoStack.slice(), redoStack: redoStack.slice() };
  }

  const nextUndoStack = undoStack.slice(0, -1);
  const raw = undoStack[undoStack.length - 1];
  return {
    data: raw ? (JSON.parse(raw) as CutsceneData) : null,
    undoStack: nextUndoStack,
    redoStack: redoStack.slice(),
  };
}

/** Saca el último redo sin mutar los stacks recibidos. */
export function popRedo(redoStack: readonly string[], undoStack: readonly string[]): UndoPopResult {
  if (redoStack.length === 0) {
    return { data: null, undoStack: undoStack.slice(), redoStack: redoStack.slice() };
  }

  const nextRedoStack = redoStack.slice(0, -1);
  const raw = redoStack[redoStack.length - 1];
  return {
    data: raw ? (JSON.parse(raw) as CutsceneData) : null,
    undoStack: undoStack.slice(),
    redoStack: nextRedoStack,
  };
}

/** Vacía ambos stacks preservando las refs que usa legacy. */
export function clearStacks(undoStack: string[], redoStack: string[]): void {
  undoStack.length = 0;
  redoStack.length = 0;
}
