/**
 * Helpers de adyacencia entre agentes en grid.
 * Compartido entre TriggerSystem (detecta encuentros) y conversation
 * orchestrator (verifica que sigan adyacentes durante turns).
 */

export type CellPos = { cx: number; cy: number };

/**
 * Distancia chebyshev (king moves) entre dos celdas en grid.
 * 0 = misma celda. 1 = adyacente (incluye diagonal). >1 = no adyacente.
 */
export function chebyshevCellDistance(a: CellPos, b: CellPos): number {
  return Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy));
}

/**
 * Devuelve true si las dos celdas son adyacentes (distancia chebyshev <= 1).
 * Incluye misma celda (distancia 0) y diagonales.
 */
export function areAgentsAdjacent(a: CellPos, b: CellPos): boolean {
  return chebyshevCellDistance(a, b) <= 1;
}
