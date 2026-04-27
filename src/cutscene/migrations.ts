/**
 * Migrations del modelo de cutscene. Lee raw JSON y muta in-place a la
 * versión actual.
 *
 * APIs:
 *   - migrateCutscene(raw): muta + retorna raw. Idempotente.
 *   - loadAndMigrateCutscene(raw): clona ANTES de migrar (raw original NO
 *     se corrompe), después valida con CutsceneSchema. Retorna
 *     `{ok, value} | {ok, error}`.
 *
 * Pasos de migración (orden importa):
 *   1. normalizeCutsceneData (defaults básicos + fx.keyframes → entities).
 *   2. ensureScenesInModel (genera scenes desde camera kfs cut=true si faltan).
 *   3. migrateKfsToScenes (asigna sceneId a kfs viejos según rango temporal).
 *   4. assignEscenaRootIds (validación todo-o-nada: si grafo parcial/inválido,
 *      recalcula desde scratch).
 *   5. ensureAgentKfTypes (infiere type SOLO con señal clara: cx/cy → 'move',
 *      text → 'speak', preset → 'animation'. Si no hay señal, deja sin type
 *      para que validate falle — caller decide).
 */

import type { z } from 'zod';
import { CutsceneSchema } from './schema';
import { normalizeCutsceneData } from './persistence';
import { newSceneId } from './scenes';

type RawObject = Record<string, any>;

function isObject(v: unknown): v is RawObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ── Step 2: ensureScenesInModel ──────────────────────────────────────

function ensureScenesInModel(data: RawObject): void {
  const existing = Array.isArray(data['scenes']) ? data['scenes'] : null;
  if (existing && existing.length > 0) return;

  const cam = isObject(data['camera']) ? data['camera'] : {};
  const camKfs = Array.isArray(cam['keyframes']) ? cam['keyframes'] : [];
  const dur = typeof data['duration'] === 'number' && data['duration'] > 0 ? data['duration'] : 30;

  const cutTimes: number[] = [0];
  for (const kf of camKfs) {
    if (isObject(kf) && kf['cut'] === true && typeof kf['t'] === 'number') {
      const t = kf['t'];
      if (t > 0.001 && t < dur - 0.001 && !cutTimes.some((x) => Math.abs(x - t) < 0.05)) {
        cutTimes.push(t);
      }
    }
  }
  cutTimes.sort((a, b) => a - b);

  const namesMap = isObject(data['sceneNames']) ? data['sceneNames'] : {};
  const scenes: any[] = [];
  for (let i = 0; i < cutTimes.length; i++) {
    const tStart = cutTimes[i]!;
    const tEnd = i < cutTimes.length - 1 ? cutTimes[i + 1]! : dur;
    if (tEnd <= tStart) continue;
    const nameKey = tStart.toFixed(2);
    scenes.push({
      id: newSceneId(),
      tStart,
      tEnd,
      name: typeof namesMap[nameKey] === 'string' ? namesMap[nameKey] : '',
      inheritState: i > 0,
    });
  }
  if (scenes.length === 0) {
    scenes.push({ id: newSceneId(), tStart: 0, tEnd: dur, name: '', inheritState: false });
  }
  data['scenes'] = scenes;
}

// ── Step 3: migrateKfsToScenes ───────────────────────────────────────

function findSceneIdForT(scenes: any[], t: number): string | null {
  for (const sc of scenes) {
    if (typeof sc.tStart === 'number' && typeof sc.tEnd === 'number') {
      if (t >= sc.tStart - 0.001 && t < sc.tEnd - 0.001) return sc.id;
    }
  }
  return null;
}

function migrateKfsToScenes(data: RawObject): void {
  const scenes = Array.isArray(data['scenes']) ? data['scenes'] : [];
  if (scenes.length === 0) return;

  const fix = (kf: any): void => {
    if (!isObject(kf)) return;
    if (kf['sceneId'] === undefined && typeof kf['t'] === 'number') {
      kf['sceneId'] = findSceneIdForT(scenes, kf['t']);
    }
  };

  const cam = isObject(data['camera']) ? data['camera'] : {};
  if (Array.isArray(cam['keyframes'])) cam['keyframes'].forEach(fix);

  const walls = isObject(data['walls']) ? data['walls'] : {};
  if (Array.isArray(walls['keyframes'])) walls['keyframes'].forEach(fix);

  const fx = isObject(data['fx']) ? data['fx'] : {};
  if (Array.isArray(fx['entities'])) {
    for (const ent of fx['entities']) {
      if (isObject(ent) && Array.isArray(ent['keyframes'])) ent['keyframes'].forEach(fix);
    }
  }

  if (Array.isArray(data['tracks'])) {
    for (const tr of data['tracks']) {
      if (isObject(tr) && Array.isArray(tr['keyframes'])) tr['keyframes'].forEach(fix);
    }
  }
}

// ── Step 4: assignEscenaRootIds ──────────────────────────────────────

function escenaGraphIsConsistent(scenes: any[]): boolean {
  if (scenes.length === 0) return true;
  const sorted = scenes.slice().sort((a, b) => a.tStart - b.tStart);
  const idSet = new Set(sorted.map((s) => s.id));
  for (let i = 0; i < sorted.length; i++) {
    const sc = sorted[i];
    if (sc.escenaRootId === undefined) return false;
    if (!idSet.has(sc.escenaRootId)) return false;
    // Si inherit=false → debe ser self-root.
    if (sc.inheritState === false && sc.escenaRootId !== sc.id) return false;
    // Si inherit=true → no puede ser primero (no hay ancestro).
    if (sc.inheritState === true && i === 0) return false;
  }
  return true;
}

function recalculateEscenaRootIds(scenes: any[]): void {
  const sorted = scenes.slice().sort((a, b) => a.tStart - b.tStart);
  let currentRoot: string | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const sc = sorted[i];
    if (i === 0 || sc.inheritState !== true) {
      sc.inheritState = i > 0 ? sc.inheritState === true : false;
      if (i === 0) sc.inheritState = false;
      currentRoot = sc.id;
      sc.escenaRootId = sc.id;
    } else {
      sc.escenaRootId = currentRoot ?? sc.id;
    }
  }
}

function assignEscenaRootIds(data: RawObject): void {
  const scenes = Array.isArray(data['scenes']) ? data['scenes'] : [];
  if (scenes.length === 0) return;
  if (!escenaGraphIsConsistent(scenes)) {
    recalculateEscenaRootIds(scenes);
  }
}

// ── Step 5: ensureAgentKfTypes ───────────────────────────────────────

function inferKfType(kf: RawObject): string | undefined {
  if (typeof kf['cx'] === 'number' && typeof kf['cy'] === 'number') return 'move';
  if (typeof kf['text'] === 'string') return 'speak';
  if (typeof kf['preset'] === 'string') return 'animation';
  return undefined;
}

function ensureAgentKfTypes(data: RawObject): void {
  if (!Array.isArray(data['tracks'])) return;
  for (const tr of data['tracks']) {
    if (!isObject(tr) || !Array.isArray(tr['keyframes'])) continue;
    for (const kf of tr['keyframes']) {
      if (!isObject(kf)) continue;
      if (typeof kf['type'] === 'string' && kf['type'].length > 0) continue;
      const inferred = inferKfType(kf);
      if (inferred !== undefined) kf['type'] = inferred;
      // Si no hay señal: NO seteamos. Schema validará y el caller decide.
    }
  }
}

// ── Public APIs ──────────────────────────────────────────────────────

/**
 * Muta `raw` in-place a la versión actual del modelo. Idempotente.
 * NO clona: si necesitás conservar el original, usar `loadAndMigrateCutscene`.
 */
export function migrateCutscene(raw: unknown): unknown {
  if (!isObject(raw)) return raw;

  // 1. Defaults básicos + fx.keyframes → entities.
  normalizeCutsceneData(raw);

  // 2. Generar scenes si faltan.
  ensureScenesInModel(raw);

  // 3. Asignar sceneId a kfs viejos.
  migrateKfsToScenes(raw);

  // 4. Validar/recalcular escenaRootId.
  assignEscenaRootIds(raw);

  // 5. Inferir type de agent kfs (sin fallback).
  ensureAgentKfTypes(raw);

  return raw;
}

export type LoadAndMigrateCutsceneResult =
  | { ok: true; value: z.infer<typeof CutsceneSchema> }
  | { ok: false; error: z.ZodError };

/**
 * Pipeline seguro: clone → migrate → validate. El raw original NO se muta.
 * Si validate sigue fallando después de migrate: `{ok: false, error}`.
 */
export function loadAndMigrateCutscene(raw: unknown): LoadAndMigrateCutsceneResult {
  const cloned = deepClone(raw);
  migrateCutscene(cloned);
  const result = CutsceneSchema.safeParse(cloned);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: result.error };
}
