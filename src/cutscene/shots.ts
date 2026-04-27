export type Vec3 = { x: number; y: number; z: number };

export type AgentPos = {
  id: string;
  x: number;       // world units
  y: number;
  z: number;
};

export type ShotResult = {
  position: Vec3;
  target: Vec3;
  lens: number;    // mm
};

export type ShotOpts = { lens?: number };

const origin: Vec3 = { x: 0, y: 0, z: 0 };

function shotDistance(lens: number): number {
  return Math.max(80, Math.min(600, 200 * (50 / lens)));
}

function bboxCenter(subjects: AgentPos[]): Vec3 {
  if (subjects.length === 0) {
    return origin;
  }

  const first = subjects[0]!;
  let minX = first.x;
  let maxX = first.x;
  let minY = first.y;
  let maxY = first.y;
  let minZ = first.z;
  let maxZ = first.z;

  for (const subject of subjects) {
    minX = Math.min(minX, subject.x);
    maxX = Math.max(maxX, subject.x);
    minY = Math.min(minY, subject.y);
    maxY = Math.max(maxY, subject.y);
    minZ = Math.min(minZ, subject.z);
    maxZ = Math.max(maxZ, subject.z);
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: (minZ + maxZ) / 2,
  };
}

function isoShot(target: Vec3, lens: number): ShotResult {
  const distance = shotDistance(lens);
  const elevation = Math.PI / 4;   // 45 grados
  const azimuth = Math.PI / 6;     // 30 grados
  const horizDist = distance * Math.cos(elevation);
  const vertDist = distance * Math.sin(elevation);

  return {
    position: {
      x: target.x + horizDist * Math.cos(azimuth),
      y: target.y + vertDist,
      z: target.z + horizDist * Math.sin(azimuth),
    },
    target,
    lens,
  };
}

/** Crea un establishing shot con target en el centro del bbox. */
export function wideEstablishing(subjects: AgentPos[], opts?: ShotOpts): ShotResult {
  const lens = opts?.lens ?? 24;
  return isoShot(bboxCenter(subjects), lens);
}

/** Crea un medium shot con target elevado hacia el torso. */
export function mediumShot(subject: AgentPos, opts?: ShotOpts): ShotResult {
  const lens = opts?.lens ?? 50;
  return isoShot({ x: subject.x, y: subject.y + 10, z: subject.z }, lens);
}

/** Crea un close up con target elevado hacia la cabeza. */
export function closeUp(subject: AgentPos, opts?: ShotOpts): ShotResult {
  const lens = opts?.lens ?? 85;
  return isoShot({ x: subject.x, y: subject.y + 15, z: subject.z }, lens);
}

/** Crea un two shot con target en el midpoint de dos subjects. */
export function twoShot(subjects: AgentPos[], opts?: ShotOpts): ShotResult {
  const lens = opts?.lens ?? 35;

  if (subjects.length !== 2) {
    console.warn('[shots/twoShot] expected 2, got ' + subjects.length);
    return isoShot(bboxCenter(subjects), lens);
  }

  const first = subjects[0]!;
  const second = subjects[1]!;

  return isoShot({
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
    z: (first.z + second.z) / 2,
  }, lens);
}

/** Crea un over the shoulder desde subjectCam hacia subjectTarget. */
export function overTheShoulder(
  subjectCam: AgentPos,
  subjectTarget: AgentPos,
  opts?: ShotOpts,
): ShotResult {
  const lens = opts?.lens ?? 50;
  const distance = shotDistance(lens);
  const dx = subjectTarget.x - subjectCam.x;
  const dy = subjectTarget.y - subjectCam.y;
  const dz = subjectTarget.z - subjectCam.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const dir = length === 0
    ? origin
    : { x: dx / length, y: dy / length, z: dz / length };
  const target = {
    x: subjectTarget.x,
    y: subjectTarget.y + 10,
    z: subjectTarget.z,
  };

  return {
    position: {
      x: subjectCam.x - dir.x * (distance * 0.3),
      y: subjectCam.y - dir.y * (distance * 0.3) + 15,
      z: subjectCam.z - dir.z * (distance * 0.3),
    },
    target,
    lens,
  };
}
