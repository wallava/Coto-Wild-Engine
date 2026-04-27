// Formatters genéricos. Solo helpers puros sin acceso a DOM/state.

// Distancia temporal humana relativa al ahora.
//   < 1 min     → "hace un momento"
//   < 1 hour    → "hace N min"
//   < 1 day     → "hace N h"
//   < 30 days   → "hace N día(s)"
//   resto       → fecha local
export function formatRelTime(ts: number): string {
  const dt = (Date.now() - ts) / 1000;
  if (dt < 60) return 'hace un momento';
  if (dt < 3600) return `hace ${Math.floor(dt / 60)} min`;
  if (dt < 86400) return `hace ${Math.floor(dt / 3600)} h`;
  const days = Math.floor(dt / 86400);
  if (days < 30) return `hace ${days} día${days === 1 ? '' : 's'}`;
  return new Date(ts).toLocaleDateString();
}
