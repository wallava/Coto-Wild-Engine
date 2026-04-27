// Panel del catálogo de muebles. Render del grid de cards + show/hide.
//
// Cuando el usuario clickea un card, dispara onPlaceTemplate(template) para
// que el caller (place-mode logic en legacy) entre en modo placement con ese
// template. Inject pattern porque place-mode todavía no está extraído.

import {
  PROP_TEMPLATES,
  WALL_PROP_TEMPLATES,
  DOOR_PROP_TEMPLATES,
  type PropTemplate,
  type WallPropTemplate,
  type DoorPropTemplate,
} from '../game/prop-catalog';

type CatalogTemplate =
  | PropTemplate
  | (WallPropTemplate & { category: 'wall' })
  | (DoorPropTemplate & { category: 'door' });

let _onPlaceTemplate: (tmpl: CatalogTemplate) => void = () => {};

export function setOnPlaceTemplate(cb: (tmpl: CatalogTemplate) => void): void {
  _onPlaceTemplate = cb;
}

export function openCatalog(): void {
  document.getElementById('catalog')!.classList.add('open');
}

export function closeCatalog(): void {
  document.getElementById('catalog')!.classList.remove('open');
}

export function toggleCatalog(): void {
  document.getElementById('catalog')!.classList.toggle('open');
}

type CatalogGroup = {
  key: string;
  title: string;
  items: CatalogTemplate[];
};

export function buildCatalog(): void {
  const grid = document.getElementById('catalog-grid')!;
  grid.innerHTML = '';
  const groups: CatalogGroup[] = [
    { key: 'floor', title: 'Muebles',     items: PROP_TEMPLATES.filter((t) => (t.category || 'floor') === 'floor') },
    { key: 'rug',   title: 'Alfombras',   items: PROP_TEMPLATES.filter((t) => t.category === 'rug') },
    { key: 'stack', title: 'Encima',      items: PROP_TEMPLATES.filter((t) => t.category === 'stack') },
    { key: 'wall',  title: 'Cuadros',     items: WALL_PROP_TEMPLATES.map((t) => ({ ...t, category: 'wall' as const })) },
    { key: 'door',  title: '🚪 Puertas',  items: DOOR_PROP_TEMPLATES.map((t) => ({ ...t, category: 'door' as const })) },
  ];
  for (const grp of groups) {
    if (grp.items.length === 0) continue;
    const title = document.createElement('div');
    title.className = 'cat-section-title';
    title.textContent = grp.title;
    grid.appendChild(title);
    for (const tmpl of grp.items) {
      const card = document.createElement('div');
      card.className = 'cat-card';
      const swatch = document.createElement('div');
      swatch.className = 'cat-swatch';
      swatch.style.background = '#' + tmpl.top.toString(16).padStart(6, '0');
      const swatchInner = document.createElement('div');
      swatchInner.style.cssText =
        'height:50%;background:#' + tmpl.right.toString(16).padStart(6, '0');
      swatch.appendChild(swatchInner);
      card.appendChild(swatch);
      const label = document.createElement('div');
      label.textContent = tmpl.name;
      card.appendChild(label);
      const meta = document.createElement('div');
      meta.className = 'cat-meta';
      if ((tmpl as { category: string }).category === 'wall') {
        meta.textContent = 'cuadro';
      } else if ('w' in tmpl && 'd' in tmpl) {
        meta.textContent = `${(tmpl as PropTemplate).w}×${(tmpl as PropTemplate).d}`;
      } else {
        meta.textContent = '';
      }
      card.appendChild(meta);
      card.addEventListener('click', () => {
        closeCatalog();
        _onPlaceTemplate(tmpl);
      });
      grid.appendChild(card);
    }
  }
}
