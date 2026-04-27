// Persistencia serializable de cutscenes.
// Este módulo no conoce DOM, Three.js ni ceState: solo localStorage y
// normalización del modelo guardado. Las mutaciones de migración son explícitas
// para que el editor pueda aplicarlas antes de tocar lifecycle/UI.

import type { z } from 'zod';
import type { Cutscene } from './model';
import { CutsceneSchema, type Cutscene as CutsceneValidated } from './schema';

const CUTSCENES_STORAGE_KEY = 'agentsinc_cutscenes_v1';

export type CutsceneData = Record<string, unknown>;
export type SavedCutscenesMap = Record<string, CutsceneData>;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

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

/** Devuelve una copia JSON-safe del modelo persistible de una cutscene. */
export function serializeCutscene(cutscene: Cutscene): CutsceneData {
  return cloneJson({
    duration: cutscene.duration,
    tracks: cutscene.tracks.map((track) => ({
      agentId: track.agentId,
      keyframes: track.keyframes,
    })),
    camera: {
      keyframes: cutscene.camera.keyframes,
      parentAgentId: cutscene.camera.parentAgentId ?? null,
    },
    fx: {
      entities: cutscene.fx.entities ?? [],
    },
    walls: {
      keyframes: cutscene.walls.keyframes ?? [],
    },
    agents: cutscene.agents ?? [],
    sceneNames: cutscene.sceneNames ?? {},
    scenes: cutscene.scenes ?? [],
  });
}

/**
 * Normaliza data cargada in-place. Migra formatos viejos y garantiza defaults
 * mínimos antes de que legacy copie el modelo a ceState.
 */
export function normalizeCutsceneData(data: CutsceneData): void {
  data.duration = typeof data.duration === 'number' && data.duration > 0 ? data.duration : 30;

  const tracks = Array.isArray(data.tracks) ? data.tracks : [];
  data.tracks = tracks.map((track) => {
    const tr = ensureRecord(track);
    return {
      agentId: typeof tr.agentId === 'string' ? tr.agentId : '',
      keyframes: Array.isArray(tr.keyframes) ? tr.keyframes : [],
    };
  });

  const camera = ensureRecord(data.camera);
  const cameraKfs = Array.isArray(camera.keyframes) ? camera.keyframes : [];
  data.camera = {
    keyframes: cameraKfs.filter((kf) => {
      if (!isRecord(kf)) return false;
      return isRecord(kf.position) && isRecord(kf.target);
    }),
    parentAgentId: typeof camera.parentAgentId === 'string' ? camera.parentAgentId : null,
  };

  const fx = ensureRecord(data.fx);
  if (Array.isArray(fx.keyframes) && !Array.isArray(fx.entities)) {
    data.fx = {
      entities: fx.keyframes.map((kf, idx) => {
        const fxKf = ensureRecord(kf);
        const kind = typeof fxKf.fx === 'string' ? fxKf.fx : 'smoke';
        const duration = typeof fxKf.duration === 'number' ? fxKf.duration : 3.0;
        return {
          id: `fx_${idx}_${Math.random().toString(36).slice(2, 8)}`,
          kind,
          duration,
          keyframes: [{ t: fxKf.t, target: fxKf.target }],
        };
      }),
    };
  } else {
    data.fx = {
      entities: Array.isArray(fx.entities) ? fx.entities : [],
    };
  }

  const walls = ensureRecord(data.walls);
  data.walls = {
    keyframes: Array.isArray(walls.keyframes) ? walls.keyframes : [],
  };

  data.sceneNames = isRecord(data.sceneNames) ? data.sceneNames : {};
  data.scenes = Array.isArray(data.scenes) ? data.scenes : [];
  data.agents = Array.isArray(data.agents) ? data.agents : [];
}

// ── Validation ──────────────────────────────────────────────────────

export type ValidationResult =
  | { ok: true; value: CutsceneValidated }
  | { ok: false; error: z.ZodError };

/**
 * Valida `raw` contra `CutsceneSchema`. NO aplica `normalizeCutsceneData`
 * — el caller decide qué hacer si falla (usar default, intentar migration,
 * abortar).
 *
 * NOTA: cutscenes legacy con modelo viejo (`fx.keyframes` en vez de
 * `fx.entities`, kfs sin `type`, etc.) van a fallar acá. La integración
 * con migration vendrá en R4.
 *
 * Si pasa: `{ok: true, value}` con tipos garantizados.
 * Si falla: log estructurado + `{ok: false, error}`.
 */
export function validateCutscene(raw: unknown): ValidationResult {
  const result = CutsceneSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  console.warn('[cutscene/validate]', {
    issues: result.error.issues.map((i) => ({
      path: i.path.join('.'),
      code: i.code,
      message: i.message,
    })),
  });
  return { ok: false, error: result.error };
}
