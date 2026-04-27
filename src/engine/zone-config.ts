// Configuración runtime de zonas: mínimo de celdas que tiene que tener un
// componente conexo (área cerrada por paredes, o área abierta del piso)
// para que se permita pintar zonas adentro. Habitaciones más chicas que
// esto no admiten zonas — no tiene sentido sub-dividir un closet o baño.
//
// Editable en vivo desde panel "🏠 Habitaciones". Se persiste en
// localStorage.

import { DEFAULT_MIN_CELLS_FOR_ZONES } from './state';
import { computeFloodFillFloor } from './rooms';

const STORAGE_KEY = 'cwe_min_cells_for_zones';

let _minCellsForZones = DEFAULT_MIN_CELLS_FOR_ZONES;

// Cargar desde localStorage al evaluar el módulo
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const n = parseInt(stored, 10);
    if (!isNaN(n) && n >= 1 && n <= 100) _minCellsForZones = n;
  }
} catch {
  // Sin acceso a localStorage — usar default
}

export function getMinCellsForZones(): number {
  return _minCellsForZones;
}

export function setMinCellsForZones(n: number | string): void {
  const parsed = Math.max(1, Math.min(100, parseInt(String(n), 10) || 1));
  _minCellsForZones = parsed;
  try {
    localStorage.setItem(STORAGE_KEY, String(parsed));
  } catch {
    // Sin localStorage — solo cambio en memoria
  }
}

// ¿La celda pertenece a un componente conexo lo suficiente grande para
// admitir zonas? Habitaciones más chicas que minCellsForZones no admiten
// zonas (no tiene sentido sub-dividir un closet o baño).
export function canPaintZoneCell(cx: number, cy: number): boolean {
  const component = computeFloodFillFloor(cx, cy);
  return component.length >= _minCellsForZones;
}
