// Catálogos de props específicos de AGENTS.INC. Per ENGINE.md, el catálogo
// concreto vive en game/ — el engine provee infraestructura genérica, el
// juego registra sus props.
//
// 3 catálogos:
//   - PROP_TEMPLATES       — muebles (floor/rug/stack)
//   - WALL_PROP_TEMPLATES  — cuadros (category='wall')
//   - DOOR_PROP_TEMPLATES  — puertas (category='door')
//
// `kind` semánticamente: 'table'/'chair'/'sofa' satisfacen requisitos de
// zonas (ROOM_REQUIREMENTS en gameplay). 'laptop'/'coffee'/'lamp' tienen
// kinds propios para checks específicos.

export type PropCategory = 'floor' | 'rug' | 'stack';

export type PropTemplate = {
  name: string;
  kind: string;
  category: PropCategory;
  w: number;
  d: number;
  h: number;
  stackable?: boolean;
  top: number;
  right: number;
  left: number;
};

export type WallPropTemplate = {
  name: string;
  w: number;
  h: number;
  zOffset: number;
  top: number;
  right: number;
  left: number;
};

export type DoorPropTemplate = {
  name: string;
  kind: string;
  top: number;
  right: number;
  left: number;
};

// Templates para spawn de muebles random (mismas paletas + variaciones de tamaño).
// Kinds consolidados: todas las mesas → 'table', todas las sillas → 'chair'.
// Solo objetos específicos (laptop, café, lámpara) tienen kind propio.
export const PROP_TEMPLATES: PropTemplate[] = [
  // ── floor (bloquea walking). stackable=true permite poner objetos encima ──
  { name: 'Cubo alto',       kind: 'box',     category: 'floor', w: 1, d: 1, h: 60, top: 0x705030, right: 0x503010, left: 0x301000 },
  { name: 'Mesa chica',      kind: 'table',   category: 'floor', w: 1, d: 1, h: 28, stackable: true, top: 0x705030, right: 0x503010, left: 0x301000 },
  { name: 'Mesa larga H',    kind: 'table',   category: 'floor', w: 2, d: 1, h: 28, stackable: true, top: 0x705030, right: 0x503010, left: 0x301000 },
  { name: 'Mesa larga V',    kind: 'table',   category: 'floor', w: 1, d: 2, h: 28, stackable: true, top: 0x705030, right: 0x503010, left: 0x301000 },
  { name: 'Sillón',          kind: 'sofa',    category: 'floor', w: 2, d: 1, h: 24, top: 0xa84838, right: 0x782818, left: 0x481008 },
  { name: 'Silla',           kind: 'chair',   category: 'floor', w: 1, d: 1, h: 40, top: 0xa84838, right: 0x782818, left: 0x481008 },
  { name: 'Mesita azul',     kind: 'table',   category: 'floor', w: 1, d: 1, h: 16, stackable: true, top: 0x4878a0, right: 0x285878, left: 0x183858 },
  { name: 'Taburete',        kind: 'chair',   category: 'floor', w: 1, d: 1, h: 12, top: 0xa89070, right: 0x787050, left: 0x584030 },
  // ── rug (alfombra: no bloquea walking, va plano sobre el piso) ──
  { name: 'Alfombra roja',   kind: 'rug',     category: 'rug', w: 1, d: 1, h: 1.5, top: 0xa84030, right: 0x882010, left: 0x680000 },
  { name: 'Tapete azul',     kind: 'rug',     category: 'rug', w: 2, d: 1, h: 1.5, top: 0x4878a0, right: 0x285878, left: 0x183858 },
  { name: 'Alfombra grande', kind: 'rug',     category: 'rug', w: 2, d: 2, h: 1.5, top: 0xa89868, right: 0x887838, left: 0x685810 },
  { name: 'Tapete verde V',  kind: 'rug',     category: 'rug', w: 1, d: 2, h: 1.5, top: 0x70a060, right: 0x508040, left: 0x305020 },
  // ── stack (encima de mesas: una unidad por celda de mueble stackable) ──
  { name: 'Laptop',          kind: 'laptop',  category: 'stack', w: 1, d: 1, h: 4,  top: 0x404448, right: 0x282c30, left: 0x181c20 },
  { name: 'Monitor',         kind: 'monitor', category: 'stack', w: 1, d: 1, h: 24, top: 0x202428, right: 0x383c40, left: 0x181c20 },
  { name: 'Lámpara',         kind: 'lamp',    category: 'stack', w: 1, d: 1, h: 32, top: 0xe8d0a0, right: 0xc8a878, left: 0x988050 },
  { name: 'Planta',          kind: 'plant',   category: 'stack', w: 1, d: 1, h: 22, top: 0x60a040, right: 0x408828, left: 0x286818 },
  { name: 'Café',            kind: 'coffee',  category: 'stack', w: 1, d: 1, h: 10, top: 0xf0e8d8, right: 0xc0b8a0, left: 0x807868 },
  { name: 'Libros',          kind: 'books',   category: 'stack', w: 1, d: 1, h: 14, top: 0xa84028, right: 0x782010, left: 0x481008 },
];

// Templates de wall props (cuadros). Se agregan al catálogo con category='wall'.
export const WALL_PROP_TEMPLATES: WallPropTemplate[] = [
  { name: 'Cuadro ocre',    w: 1, h: 24, zOffset: 50, top: 0xc88040, right: 0xa86028, left: 0x804818 },
  { name: 'Cuadro azul',    w: 1, h: 18, zOffset: 60, top: 0x6090c0, right: 0x4078a8, left: 0x285880 },
  { name: 'Cuadro grande',  w: 1, h: 30, zOffset: 40, top: 0x4a3a20, right: 0x382818, left: 0x201810 },
];

// Templates de puerta: una por kind. Con info para el catálogo.
export const DOOR_PROP_TEMPLATES: DoorPropTemplate[] = [
  { name: 'Puerta de madera', kind: 'wood',   top: 0x8a5a30, right: 0x6a4220, left: 0x4a2a10 },
  { name: 'Puerta moderna',   kind: 'modern', top: 0xd0d0d0, right: 0xa0a0a0, left: 0x808080 },
  { name: 'Puerta de vidrio', kind: 'glass',  top: 0xa8d0e0, right: 0xa8d0e0, left: 0xa8d0e0 },
];
