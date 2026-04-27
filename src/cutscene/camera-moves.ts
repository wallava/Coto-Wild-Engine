import type { Vec3, AgentPos, ShotOpts } from './shots';

export type { ShotOpts };

export type MoveKf = {
  position: Vec3;
  target: Vec3;
  lens: number;
};

export type MoveKfPair = {
  start: MoveKf;
  end: MoveKf;
};

export type MoveArgs = Record<string, string | number>;

function numArg(args: MoveArgs, key: string, fallback: number): number {
  const v = args[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return fallback;
}

function isoPosition(target: Vec3, distance: number): Vec3 {
  const elevation = Math.PI / 4;
  const azimuth = Math.PI / 6;
  const horizDist = distance * Math.cos(elevation);
  const vertDist = distance * Math.sin(elevation);
  return {
    x: target.x + horizDist * Math.cos(azimuth),
    y: target.y + vertDist,
    z: target.z + horizDist * Math.sin(azimuth),
  };
}

/**
 * Acerca la camara al sujeto para concentrar la atencion sin cambiar el punto narrativo.
 */
export function dollyIn(subject: AgentPos, args: MoveArgs): MoveKfPair {
  const distanciaInicial = numArg(args, 'distancia_inicial', 350);
  const distanciaFinal = numArg(args, 'distancia_final', 140);
  const lens = numArg(args, 'lens', 50);
  const target = { x: subject.x, y: subject.y + 10, z: subject.z };

  return {
    start: { position: isoPosition(target, distanciaInicial), target, lens },
    end: { position: isoPosition(target, distanciaFinal), target, lens },
  };
}

/**
 * Aleja la camara para revelar contexto despues de iniciar cerca del sujeto.
 */
export function pullOut(subject: AgentPos, args: MoveArgs): MoveKfPair {
  const distanciaInicial = numArg(args, 'distancia_inicial', 140);
  const distanciaFinal = numArg(args, 'distancia_final', 350);
  const lens = numArg(args, 'lens', 50);
  const target = { x: subject.x, y: subject.y + 10, z: subject.z };

  return {
    start: { position: isoPosition(target, distanciaInicial), target, lens },
    end: { position: isoPosition(target, distanciaFinal), target, lens },
  };
}

/**
 * Recorre entre dos puntos manteniendo una lectura isometrica estable de cada objetivo.
 */
export function pan(args: MoveArgs): MoveKfPair {
  const lens = numArg(args, 'lens', 50);
  const de: Vec3 = {
    x: numArg(args, 'de_x', 0),
    y: numArg(args, 'de_y', 0),
    z: numArg(args, 'de_z', 0),
  };
  const hacia: Vec3 = {
    x: numArg(args, 'hacia_x', 100),
    y: numArg(args, 'hacia_y', 0),
    z: numArg(args, 'hacia_z', 0),
  };

  return {
    start: { position: isoPosition(de, 350), target: de, lens },
    end: { position: isoPosition(hacia, 350), target: hacia, lens },
  };
}

/**
 * Cambia la compresion optica para intensificar el encuadre sin desplazar la camara.
 */
export function pushIn(subject: AgentPos, args: MoveArgs): MoveKfPair {
  const lensInicial = numArg(args, 'lens_inicial', 50);
  const lensFinal = numArg(args, 'lens_final', 100);
  const distance = numArg(args, 'distance', 350);
  const target = { x: subject.x, y: subject.y + 10, z: subject.z };
  const position = isoPosition(target, distance);

  return {
    start: { position, target, lens: lensInicial },
    end: { position, target, lens: lensFinal },
  };
}
