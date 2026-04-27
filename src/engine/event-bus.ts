// Pub/sub mínimo. Sin frameworks. Cualquier sistema (gameplay, cutscenes,
// UI, debug) se suscribe a eventos y nadie acopla con nadie.
//
// Eventos que el motor emite hoy (payload sin tipar — narrowing va por slice
// futura cuando consumidores se separen):
//   propPlaced    {prop}
//   propDeleted   {prop}
//   propMoved     {prop, from, to}
//   agentSpawned  {agent}
//   agentMoved    {agent, from, to}
//   wallChanged   {type, cx, cy, exists, style}
//   paintApplied  {kind, cx, cy, side?, color}
//   worldLoaded   {source}              'storage' | 'default' | 'reset'
//   worldSaved    {}
//
// Listeners no se persisten — son in-memory y se setean al inicio.
// Debug: en consola correr `window.__cweDebugEvents = true` para loguear todo.

export type EventListener = (payload: unknown) => void;
export type Unsubscribe = () => void;

export type EventBus = {
  on(evt: string, fn: EventListener): Unsubscribe;
  off(evt: string, fn: EventListener): void;
  emit(evt: string, payload?: unknown): void;
};

export const eventBus: EventBus = (() => {
  const listeners = new Map<string, Set<EventListener>>();
  const bus: EventBus = {
    on(evt, fn) {
      let set = listeners.get(evt);
      if (!set) {
        set = new Set();
        listeners.set(evt, set);
      }
      set.add(fn);
      return () => bus.off(evt, fn);
    },
    off(evt, fn) {
      const set = listeners.get(evt);
      if (set) set.delete(fn);
    },
    emit(evt, payload) {
      if (typeof window !== 'undefined' && (window as any).__cweDebugEvents) {
        console.log('[evt]', evt, payload);
      }
      const set = listeners.get(evt);
      if (!set) return;
      for (const fn of [...set]) {
        try {
          fn(payload);
        } catch (e) {
          console.error('[eventBus]', evt, 'listener error:', e);
        }
      }
    },
  };
  return bus;
})();

if (typeof window !== 'undefined') {
  (window as any).cweEventBus = eventBus;
}
