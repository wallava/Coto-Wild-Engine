/**
 * Migrations del world model. Lee raw JSON de localStorage y muta in-place
 * a la versión actual del modelo.
 *
 * APIs:
 *   - migrateWorld(raw): muta + retorna raw. Idempotente.
 *   - loadAndMigrateWorld(raw): clona ANTES de migrar (raw original NO se
 *     corrompe), después valida con WorldSchema. Retorna {ok, world} | {ok, error}.
 */

import { migrateV1WorldData, type WorldData } from './persistence';
import { WorldSchema } from './schema';
import type { z } from 'zod';

type RawObject = Record<string, any>;

function isObject(v: unknown): v is RawObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Migra rooms legacy → zones[] + roomMeta[].
 * SOLO migra rooms con `source === 'manual'` (paridad monolito world.ts:303).
 * Rooms autogenerados (source !== 'manual') quedan ignorados.
 */
function migrateRoomsToZones(raw: RawObject): void {
  if (!Array.isArray(raw['rooms']) || Array.isArray(raw['zones'])) return;
  const rooms = raw['rooms'] as any[];
  const manualRooms = rooms.filter(r => isObject(r) && r['source'] === 'manual');
  raw['zones'] = manualRooms.map(r => {
    const out: any = {
      id: typeof r['id'] === 'string' ? r['id'] : `zone-${Math.random().toString(36).slice(2, 8)}`,
      name: typeof r['name'] === 'string' ? r['name'] : '',
      kind: typeof r['kind'] === 'string' || r['kind'] === null ? r['kind'] : null,
      color: typeof r['color'] === 'number' ? r['color'] : 0xcccccc,
      cells: Array.isArray(r['cells'])
        ? r['cells']
            .filter((c: any) => isObject(c) && typeof c['cx'] === 'number' && typeof c['cy'] === 'number')
            .map((c: any) => ({ cx: c['cx'], cy: c['cy'] }))
        : [],
    };
    return out;
  });
  raw['roomMeta'] = manualRooms.map(r => {
    const out: any = {
      id: r['id'],
      name: typeof r['name'] === 'string' ? r['name'] : '',
      kind: typeof r['kind'] === 'string' || r['kind'] === null ? r['kind'] : null,
      color: typeof r['color'] === 'number' ? r['color'] : 0xcccccc,
      anchorCx: typeof r['anchorCx'] === 'number' ? r['anchorCx'] : 0,
      anchorCy: typeof r['anchorCy'] === 'number' ? r['anchorCy'] : 0,
    };
    return out;
  });
  delete raw['rooms'];
}

/** Garantiza arrays vacíos para zones/roomMeta si missing. */
function ensureWorldDefaults(raw: RawObject): void {
  if (!Array.isArray(raw['zones'])) raw['zones'] = [];
  if (!Array.isArray(raw['roomMeta'])) raw['roomMeta'] = [];
}

export function migrateWorld(raw: unknown): unknown {
  if (!isObject(raw)) return raw;

  // 1. sides 'N'→'S', 'W'→'E' (legacy v1)
  if (Array.isArray(raw['props'])) {
    migrateV1WorldData(raw as unknown as WorldData);
  }

  // 2. rooms → zones + roomMeta (solo source='manual')
  migrateRoomsToZones(raw);

  // 3. Defaults
  ensureWorldDefaults(raw);

  return raw;
}

export type LoadAndMigrateResult =
  | { ok: true; world: z.infer<typeof WorldSchema> }
  | { ok: false; error: z.ZodError };

/**
 * Pipeline seguro: clone → migrate → validate. El raw original NO se muta.
 * Si validate sigue fallando después de migrate: {ok: false, error}.
 */
export function loadAndMigrateWorld(raw: unknown): LoadAndMigrateResult {
  const cloned = deepClone(raw);
  migrateWorld(cloned);
  const result = WorldSchema.safeParse(cloned);
  if (result.success) return { ok: true, world: result.data };
  return { ok: false, error: result.error };
}
