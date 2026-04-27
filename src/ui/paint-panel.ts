// Panel de pintura: 8 swatches + color picker custom + clear (vuelve a
// paleta default). El estado real (paintColor) vive en legacy hasta extraer
// paint mode full — acá solo manejamos UI.
//
// Cuando el usuario clickea swatch / picker / clear, dispara onColorChange
// para que legacy actualice su state + dispare refresh de preview.

let _onColorChange: (color: number | null) => void = () => {};

export function setOnColorChange(cb: (color: number | null) => void): void {
  _onColorChange = cb;
}

// Sincroniza highlight de swatches + valor del color picker con el color
// dado. NO dispara el callback (sólo refleja el state actual).
export function syncPaintUI(color: number | null): void {
  const swatches = document.querySelectorAll<HTMLButtonElement>('.paint-swatch');
  swatches.forEach((sw) => {
    const swColor = parseInt(sw.dataset['color'] ?? '0', 16);
    sw.classList.toggle('active', color !== null && swColor === color);
  });
  if (color !== null) {
    const hex = '#' + color.toString(16).padStart(6, '0');
    (document.getElementById('paint-custom') as HTMLInputElement).value = hex;
  }
}

export function initPaintPanel(): void {
  document.querySelectorAll<HTMLButtonElement>('.paint-swatch').forEach((sw) => {
    sw.addEventListener('click', () => {
      const c = parseInt(sw.dataset['color'] ?? '0', 16);
      _onColorChange(c);
    });
  });
  document.getElementById('paint-custom')!.addEventListener('input', (e) => {
    const hex = (e.target as HTMLInputElement).value; // #rrggbb
    const c = parseInt(hex.slice(1), 16);
    _onColorChange(c);
  });
  document.getElementById('paint-clear')!.addEventListener('click', () => {
    _onColorChange(null);
  });
}
