import { actualCostUSD, estimateCostUSD } from './cost';
import type { CompletionOpts, LLMModel, SessionCostTracker, Usage } from './types';

type CacheTTLHint = NonNullable<CompletionOpts['cacheTTLHint']>;

export const DEFAULT_CAP_USD = 0.50;
export const EPSILON = 1e-9;

export type SessionCostTrackerOpts = {
  capUSD?: number;
};

function assertValidCap(capUSD: number): void {
  if (!Number.isFinite(capUSD) || capUSD < 0) {
    throw new RangeError('capUSD must be a finite non-negative number');
  }
}

/**
 * Tracker de costo acumulado por sesión LLM con cap configurable.
 * Notifica a listeners en cada actualización. Implementa SessionCostTracker.
 */
export class SessionCostTrackerImpl implements SessionCostTracker {
  private sessionCostUSD = 0;
  private capUSD: number;
  private listeners: Set<(cost: number) => void> = new Set();

  constructor(opts: SessionCostTrackerOpts = {}) {
    const capUSD = opts.capUSD ?? DEFAULT_CAP_USD;
    assertValidCap(capUSD);
    this.capUSD = capUSD;
  }

  /**
   * Suma el costo real de una llamada al acumulado y notifica listeners.
   * @param usage tokens consumidos por la llamada.
   * @param model modelo usado para resolver pricing.
   * @param ttlHint TTL de cache aplicado (opcional, afecta pricing de cache writes).
   */
  trackCall(usage: Usage, model: LLMModel, ttlHint?: CacheTTLHint): void {
    this.sessionCostUSD += actualCostUSD(model, usage, ttlHint);
    for (const cb of this.listeners) cb(this.sessionCostUSD);
  }

  /**
   * Devuelve el costo acumulado de la sesión.
   * @returns costo en USD.
   */
  getSessionCost(): number {
    return this.sessionCostUSD;
  }

  /**
   * Predice si una llamada cabría dentro del cap dado un estimado de tokens.
   * @param model modelo destino.
   * @param estInputTokens tokens de input estimados.
   * @param maxOutputTokens techo de output declarado para la llamada.
   * @returns true si el costo estimado sumado al acumulado no excede el cap.
   */
  canAffordEstimatedCall(
    model: LLMModel,
    estInputTokens: number,
    maxOutputTokens: number,
  ): boolean {
    const estimatedCostUSD = estimateCostUSD(model, estInputTokens, maxOutputTokens);
    return this.sessionCostUSD + estimatedCostUSD <= this.capUSD + EPSILON;
  }

  /**
   * Indica si el costo acumulado ya superó el cap (con tolerancia EPSILON).
   * @returns true si sessionCost > cap + EPSILON.
   */
  isOverCap(): boolean {
    return this.sessionCostUSD > this.capUSD + EPSILON;
  }

  /**
   * Suscribe un listener que se llama en cada cambio del costo acumulado.
   * @param cb callback que recibe el costo actualizado en USD.
   * @returns función para desuscribir.
   */
  onChange(cb: (cost: number) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /**
   * Resetea el costo acumulado a 0 y notifica listeners.
   */
  reset(): void {
    this.sessionCostUSD = 0;
    for (const cb of this.listeners) cb(0);
  }

  /**
   * Cambia el cap en runtime y notifica listeners (sin alterar el costo acumulado).
   * @param capUSD nuevo cap, debe ser finito y no-negativo.
   */
  setCap(capUSD: number): void {
    assertValidCap(capUSD);
    this.capUSD = capUSD;
    for (const cb of this.listeners) cb(this.sessionCostUSD);
  }
}

/**
 * Crea una instancia de SessionCostTracker con cap opcional.
 * @param opts configuración (capUSD, default DEFAULT_CAP_USD = 0.50).
 * @returns instancia que implementa SessionCostTracker.
 */
export function createSessionCostTracker(
  opts: SessionCostTrackerOpts = {},
): SessionCostTracker {
  return new SessionCostTrackerImpl(opts);
}
