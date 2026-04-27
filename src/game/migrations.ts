// Migración + cleanup de props cargados de localStorage. Se ejecuta una
// vez al inicio (después de cargar world data + después de definir
// PROP_TEMPLATES). Maneja:
//
//   1. Datos pre-v0.94: floors sin flag `stackable`. Se infiere matchando
//      contra templates stackable.
//   2. Stacks huérfanos (en celdas sin floor stackable abajo) → descartar.
//   3. Pre-v1.14: props sin kind/name → recuperar matchando templates.
//   4. Paredes con style 'door' (modelo viejo v1.09-v1.10) → solid + door
//      prop con kind='wood'. Limpia cuadros que quedaron en conflicto.
//   5. Cleanup defensivo: cuadros coexistiendo con puertas → cuadro fuera.

import { GRID_W, GRID_H } from '../engine/state';
import { worldGrid, props, getFloorStackBase } from '../engine/world';
import { getDoorOnWallN, getDoorOnWallW } from '../engine/wall-queries';
import { uid } from '../utils/id';
import { PROP_TEMPLATES, WALL_PROP_TEMPLATES } from './prop-catalog';

export function migrateLoadedProps(): void {
  // ── 1. Migración kind/name (pre-v1.14) ──
  let kindMigrated = 0;
  for (const p of props) {
    const cat = (p['category'] as string) || 'floor';
    if (cat === 'door') continue;
    if (cat === 'wall') {
      if (!p['kind']) {
        const t = WALL_PROP_TEMPLATES.find(
          (t) => t.h === p['h'] && t.top === p['top'],
        );
        if (t) {
          p['kind'] = 'painting';
          if (!p['name']) p['name'] = t.name;
          kindMigrated++;
        }
      }
      continue;
    }
    if (p['kind'] && p['name']) continue;
    const pw = (p['w'] as number) || 1;
    const pd = (p['d'] as number) || 1;
    const t = PROP_TEMPLATES.find(
      (t) =>
        (t.category || 'floor') === cat &&
        t.h === p['h'] &&
        (t.w || 1) === pw &&
        (t.d || 1) === pd &&
        t.top === p['top'],
    );
    if (t) {
      if (!p['kind']) p['kind'] = t.kind;
      if (!p['name']) p['name'] = t.name;
      kindMigrated++;
    }
  }
  if (kindMigrated > 0) console.log('[migrate] props sin kind/name recuperados:', kindMigrated);

  // ── 2. Inferir stackable en floors pre-v0.94 ──
  for (const p of props) {
    if (((p['category'] as string) || 'floor') !== 'floor') continue;
    if (p['stackable']) continue;
    const pw = (p['w'] as number) || 1;
    const pd = (p['d'] as number) || 1;
    const match = PROP_TEMPLATES.find(
      (t) =>
        (t.category || 'floor') === 'floor' &&
        t.stackable === true &&
        t.h === p['h'] &&
        (t.w || 1) === pw &&
        (t.d || 1) === pd,
    );
    if (match) p['stackable'] = true;
  }

  // ── 3. Stacks huérfanos (sin floor base) → descartar ──
  let orphans = 0;
  for (let i = props.length - 1; i >= 0; i--) {
    const p = props[i]!;
    if (((p['category'] as string) || 'floor') !== 'stack') continue;
    if (!getFloorStackBase(p['cx'] as number, p['cy'] as number)) {
      props.splice(i, 1);
      orphans++;
    }
  }
  if (orphans > 0) console.warn('[load] stacks huérfanos descartados:', orphans);

  // ── 4. wallStyle 'door' (v1.09-v1.10) → solid + door prop ──
  let doorMigrated = 0;
  let conflictedWallPropsRemoved = 0;
  const wallNStyle = worldGrid.wallNStyle as string[][] | undefined;
  if (wallNStyle) {
    for (let cy = 0; cy <= GRID_H; cy++) {
      for (let cx = 0; cx < GRID_W; cx++) {
        if (wallNStyle[cy]?.[cx] === 'door') {
          (wallNStyle[cy] as string[])[cx] = 'solid';
          props.push({
            id: uid(),
            category: 'door',
            cx,
            cy,
            side: 'S',
            kind: 'wood',
          });
          // Limpiar cuadros en ambas caras del segmento
          for (let i = props.length - 1; i >= 0; i--) {
            const p = props[i]!;
            if (((p['category'] as string) || 'floor') !== 'wall') continue;
            if (p['cx'] !== cx || p['cy'] !== cy) continue;
            if (p['side'] === 'N' || p['side'] === 'S') {
              props.splice(i, 1);
              conflictedWallPropsRemoved++;
            }
          }
          doorMigrated++;
        }
      }
    }
  }
  const wallWStyle = worldGrid.wallWStyle as string[][] | undefined;
  if (wallWStyle) {
    for (let cy = 0; cy < GRID_H; cy++) {
      for (let cx = 0; cx <= GRID_W; cx++) {
        if (wallWStyle[cy]?.[cx] === 'door') {
          (wallWStyle[cy] as string[])[cx] = 'solid';
          props.push({
            id: uid(),
            category: 'door',
            cx,
            cy,
            side: 'E',
            kind: 'wood',
          });
          for (let i = props.length - 1; i >= 0; i--) {
            const p = props[i]!;
            if (((p['category'] as string) || 'floor') !== 'wall') continue;
            if (p['cx'] !== cx || p['cy'] !== cy) continue;
            if (p['side'] === 'W' || p['side'] === 'E') {
              props.splice(i, 1);
              conflictedWallPropsRemoved++;
            }
          }
          doorMigrated++;
        }
      }
    }
  }
  if (doorMigrated > 0) {
    console.log(
      '[migrate] paredes con style door → puerta-prop:',
      doorMigrated,
      conflictedWallPropsRemoved > 0
        ? `(+ ${conflictedWallPropsRemoved} cuadros en conflicto removidos)`
        : '',
    );
  }

  // ── 5. Cleanup defensivo: cuadros coexistiendo con puertas → cuadro fuera ──
  let extraConflicts = 0;
  for (let i = props.length - 1; i >= 0; i--) {
    const p = props[i]!;
    if (((p['category'] as string) || 'floor') !== 'wall') continue;
    const isHoriz = p['side'] === 'N' || p['side'] === 'S';
    const door = isHoriz
      ? getDoorOnWallN(p['cx'] as number, p['cy'] as number)
      : getDoorOnWallW(p['cx'] as number, p['cy'] as number);
    if (door) {
      props.splice(i, 1);
      extraConflicts++;
    }
  }
  if (extraConflicts > 0) console.log('[migrate] cuadros coexistiendo con puertas removidos:', extraConflicts);
}
