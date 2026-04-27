// Banner sticky que aparece cuando se está editando celdas de una zona.
// Muestra el nombre de la zona + hint de controles + botón Terminar.
// El listener del botón Terminar se registra en ui/rooms-panel.ts (vía
// initRoomsPanel).

export function showZoneEditBanner(zoneName: string): void {
  const banner = document.getElementById('zone-edit-banner');
  if (!banner) return;
  document.getElementById('zone-edit-name')!.textContent = zoneName;
  banner.classList.add('open');
}

export function hideZoneEditBanner(): void {
  const banner = document.getElementById('zone-edit-banner');
  if (banner) banner.classList.remove('open');
}
