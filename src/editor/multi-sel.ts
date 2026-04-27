/**
 * Multi-selección + lasso del editor de cutscenes.
 *
 * Operaciones puras sobre el state `{ scenes: string[], kfs: MultiSelKfId[] }`
 * + helpers DOM para el rectángulo de lasso + start de group-drag (clone
 * cuando alt). El render de tracks queda en el caller.
 */

import type { Cutscene } from '../cutscene/model';
import { serializeCutscene } from '../cutscene/persistence';
import { cloneScene } from '../cutscene/scene-ops';

export type MultiSelKfKind = 'camera' | 'walls' | 'fx' | 'agent';

export type MultiSelKfId = {
  kind: MultiSelKfKind;
  trackIdx: number;     // -1 si no aplica
  fxEntityIdx: number;  // -1 si no aplica
  kfIdx: number;
};

export type MultiSelState = {
  scenes: string[];
  kfs: MultiSelKfId[];
};

export type LassoDrag = {
  startX: number;
  startY: number;
  currX: number;
  currY: number;
  started: boolean;
  additive?: boolean;
};

export function createEmptyMultiSel(): MultiSelState {
  return { scenes: [], kfs: [] };
}

export function multiSelClear(state: { multiSel: MultiSelState }): void {
  state.multiSel = createEmptyMultiSel();
}

export function multiSelHasScene(state: { multiSel: MultiSelState }, sceneId: string): boolean {
  return state.multiSel.scenes.includes(sceneId);
}

export function multiSelHasKf(
  state: { multiSel: MultiSelState },
  kind: MultiSelKfKind,
  trackIdx: number,
  fxEntityIdx: number,
  kfIdx: number,
): boolean {
  return state.multiSel.kfs.some(k =>
    k.kind === kind &&
    (k.trackIdx ?? -1) === (trackIdx ?? -1) &&
    (k.fxEntityIdx ?? -1) === (fxEntityIdx ?? -1) &&
    k.kfIdx === kfIdx);
}

export function multiSelCount(state: { multiSel: MultiSelState }): number {
  return state.multiSel.scenes.length + state.multiSel.kfs.length;
}

type ResolvedKf = {
  id: MultiSelKfId;
  arr: any[];
  kf: any;
};

type CutsceneShape = {
  camera?: { keyframes?: any[] };
  walls?: { keyframes?: any[] };
  fx?: { entities?: Array<{ keyframes?: any[] }> };
  tracks?: Array<{ keyframes?: any[] }>;
};

/**
 * Resuelve cada entrada de `multiSel.kfs` a su array y kf real.
 * Descarta entradas que ya no existen (kf eliminado entre selección y resolución).
 */
export function multiSelResolveKfs(
  state: { multiSel: MultiSelState },
  cutscene: CutsceneShape,
): ResolvedKf[] {
  const out: ResolvedKf[] = [];
  for (const id of state.multiSel.kfs) {
    let arr: any[] | null | undefined = null;
    if (id.kind === 'camera') arr = cutscene.camera?.keyframes;
    else if (id.kind === 'walls') arr = cutscene.walls?.keyframes;
    else if (id.kind === 'fx') {
      const ent = cutscene.fx?.entities?.[id.fxEntityIdx];
      arr = ent?.keyframes;
    } else if (id.kind === 'agent') {
      const tr = cutscene.tracks?.[id.trackIdx];
      arr = tr?.keyframes;
    }
    const kf = arr && arr[id.kfIdx];
    if (kf && arr) out.push({ id, arr, kf });
  }
  return out;
}

const LASSO_BOX_ID = 'ce-lasso-box';

/** Crea o actualiza el div visible del rectángulo de lasso. */
export function updateLassoBox(ld: LassoDrag | null): void {
  if (!ld) return;
  let box = document.getElementById(LASSO_BOX_ID);
  if (!box) {
    box = document.createElement('div');
    box.id = LASSO_BOX_ID;
    box.style.cssText =
      'position:fixed; pointer-events:none; z-index:1500; ' +
      'background:rgba(120, 200, 255, 0.10); ' +
      'border:1px solid rgba(120, 200, 255, 0.85); ' +
      'border-radius:2px;';
    document.body.appendChild(box);
  }
  const x = Math.min(ld.startX, ld.currX);
  const y = Math.min(ld.startY, ld.currY);
  const w = Math.abs(ld.currX - ld.startX);
  const h = Math.abs(ld.currY - ld.startY);
  box.style.left = x + 'px';
  box.style.top = y + 'px';
  box.style.width = w + 'px';
  box.style.height = h + 'px';
}

/** Elimina el div del rectángulo de lasso si existe. */
export function removeLassoBox(): void {
  const box = document.getElementById(LASSO_BOX_ID);
  if (box) box.remove();
}

/**
 * Recorre `.ce-scene-block` y `.ce-keyframe` dentro de `tracksRoot` y los
 * agrega al multiSel si su rect overlapa con el rect del lasso.
 * Si `additive=false`, limpia la selección antes.
 */
export function computeLassoSelection(
  state: { multiSel: MultiSelState },
  tracksRoot: HTMLElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  additive: boolean,
): void {
  const bx = Math.min(x1, x2);
  const by = Math.min(y1, y2);
  const bx2 = Math.max(x1, x2);
  const by2 = Math.max(y1, y2);
  function overlap(r: DOMRect): boolean {
    return !(r.right < bx || r.left > bx2 || r.bottom < by || r.top > by2);
  }
  if (!additive) multiSelClear(state);

  const blocks = tracksRoot.querySelectorAll<HTMLElement>('.ce-scene-block');
  for (const b of blocks) {
    if (!overlap(b.getBoundingClientRect())) continue;
    const sceneId = b.dataset.sceneId;
    if (sceneId && !multiSelHasScene(state, sceneId)) {
      state.multiSel.scenes.push(sceneId);
    }
  }

  const kfs = tracksRoot.querySelectorAll<HTMLElement>('.ce-keyframe');
  for (const kf of kfs) {
    if (!overlap(kf.getBoundingClientRect())) continue;
    const cl = kf.classList;
    const kfIdx = parseInt(kf.dataset.kfIdx ?? '', 10);
    if (isNaN(kfIdx)) continue;
    let kind: MultiSelKfKind;
    let trackIdx = -1;
    let fxEntityIdx = -1;
    if (cl.contains('kf-camera')) {
      kind = 'camera';
    } else if (cl.contains('kf-walls')) {
      kind = 'walls';
    } else if (cl.contains('kf-fx')) {
      kind = 'fx';
      fxEntityIdx = parseInt(kf.dataset.fxEntityIdx ?? '', 10);
      if (isNaN(fxEntityIdx)) continue;
    } else {
      kind = 'agent';
      trackIdx = parseInt(kf.dataset.trackIdx ?? '', 10);
      if (isNaN(trackIdx)) continue;
    }
    if (!multiSelHasKf(state, kind, trackIdx, fxEntityIdx, kfIdx)) {
      state.multiSel.kfs.push({ kind, trackIdx, fxEntityIdx, kfIdx });
    }
  }
}

// ── Group drag (start) ────────────────────────────────────────────────

export type GroupDragInitial = {
  scenes: Array<{ id: string; tStart: number }>;
  kfs: Array<{ id: MultiSelKfId; kfRef: any; t: number }>;
};

export type ActiveGroupDrag = {
  startX: number;
  anchorKind: 'scene' | 'kf';
  anchorScene: string | null;
  anchorKf: (MultiSelKfId & { t?: number }) | null;
  initial: GroupDragInitial;
  baseline: string;
  moved: boolean;
  cloning: boolean;
};

/** Anchor del drag: sceneId (string) o kfId (con `t` opcional del caller). */
export type GroupDragAnchor = string | (MultiSelKfId & { t?: number });

type GroupDragHostState = {
  multiSel: MultiSelState;
  groupDrag: ActiveGroupDrag | null;
};

/**
 * Inicia un group-drag: snapshot baseline, clona el grupo si `alt`, y arma
 * `state.groupDrag` con refs directas a kfs (sobreviven a re-orderings).
 *
 * Orden explícito (cambiarlo rompe cancelación / selección):
 *   1. baseline = serializeCutscene(cutscene) [antes de cualquier mutación]
 *   2. Si alt: clone scenes → idMap → clone kfs sueltos → mutar state.multiSel
 *   3. Build initial con kfRef directos
 *   4. Set state.groupDrag
 *
 * NOTA: el match de kfs clonados por `(sceneId, t)` con tolerancia 0.0001
 * es frágil cuando hay múltiples kfs del mismo tipo en el mismo plano y
 * mismo `t`. Preserva el comportamiento legacy — no corregir acá.
 *
 * NOTA: el clone de `position`/`target`/`hiddenIds` es shallow (una sola
 * spread). Preserva legacy — no profundizar.
 */
export function startGroupDrag(
  state: GroupDragHostState,
  cutscene: Cutscene,
  anchor: GroupDragAnchor,
  anchorKind: 'scene' | 'kf',
  startX: number,
  alt: boolean,
): void {
  // 1. Snapshot baseline ANTES de cualquier mutación.
  const baseline = JSON.stringify(serializeCutscene(cutscene));

  let workScenes = state.multiSel.scenes.slice();
  let workKfs = state.multiSel.kfs.slice();
  let anchorScene: string | null = (anchorKind === 'scene') ? (anchor as string) : null;
  let anchorKf: (MultiSelKfId & { t?: number }) | null =
    (anchorKind === 'kf') ? (anchor as MultiSelKfId & { t?: number }) : null;

  if (alt) {
    // 2. Clonar scenes primero, kfs sueltos después.
    const newSceneIds: string[] = [];
    const idMap = new Map<string, string>();
    for (const sceneId of workScenes) {
      const sc = (cutscene.scenes || []).find(s => s.id === sceneId);
      if (!sc) continue;
      const clone = cloneScene(cutscene, sc, sc.tStart);
      newSceneIds.push(clone.id);
      idMap.set(sceneId, clone.id);
    }

    const newKfs: MultiSelKfId[] = [];
    for (const kfId of workKfs) {
      let arr: any[] | null | undefined = null;
      if (kfId.kind === 'camera') arr = cutscene.camera?.keyframes;
      else if (kfId.kind === 'walls') arr = cutscene.walls?.keyframes;
      else if (kfId.kind === 'fx') {
        const ent = cutscene.fx?.entities?.[kfId.fxEntityIdx];
        arr = ent?.keyframes;
      } else if (kfId.kind === 'agent') {
        const tr = cutscene.tracks?.[kfId.trackIdx];
        arr = tr?.keyframes;
      }
      const orig = arr && arr[kfId.kfIdx];
      if (!orig || !arr) continue;
      if (orig.sceneId && idMap.has(orig.sceneId)) {
        // El plano padre fue clonado; el clon ya fue creado por cloneScene.
        const newSceneId = idMap.get(orig.sceneId)!;
        let cloneIdx = -1;
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i].sceneId === newSceneId && Math.abs(arr[i].t - orig.t) < 0.0001) {
            cloneIdx = i;
            break;
          }
        }
        if (cloneIdx >= 0) newKfs.push({ ...kfId, kfIdx: cloneIdx });
      } else {
        // kf suelto: clonar en sitio (shallow).
        const cloneKf = {
          ...orig,
          position: orig.position ? { ...orig.position } : orig.position,
          target: orig.target ? { ...orig.target } : orig.target,
          hiddenIds: orig.hiddenIds ? [...orig.hiddenIds] : orig.hiddenIds,
        };
        arr.push(cloneKf);
        newKfs.push({ ...kfId, kfIdx: arr.length - 1 });
      }
    }

    workScenes = newSceneIds;
    workKfs = newKfs;
    state.multiSel.scenes = newSceneIds;
    state.multiSel.kfs = newKfs;
    if (anchorKind === 'scene' && typeof anchor === 'string') {
      anchorScene = idMap.get(anchor) || anchor;
    }
  }

  // 3. Build initial con refs directas a kfs (sobreviven a re-orderings).
  const initial: GroupDragInitial = {
    scenes: workScenes.map(id => {
      const sc = (cutscene.scenes || []).find(s => s.id === id);
      return { id, tStart: sc ? sc.tStart : 0 };
    }),
    kfs: workKfs.map((kfId): { id: MultiSelKfId; kfRef: any; t: number } => {
      let arr: any[] | null | undefined = null;
      if (kfId.kind === 'camera') arr = cutscene.camera?.keyframes;
      else if (kfId.kind === 'walls') arr = cutscene.walls?.keyframes;
      else if (kfId.kind === 'fx') {
        const ent = cutscene.fx?.entities?.[kfId.fxEntityIdx];
        arr = ent?.keyframes;
      } else if (kfId.kind === 'agent') {
        const tr = cutscene.tracks?.[kfId.trackIdx];
        arr = tr?.keyframes;
      }
      const k = arr && arr[kfId.kfIdx];
      return { id: kfId, kfRef: k, t: k ? k.t : 0 };
    }).filter(x => x.kfRef),
  };

  // 4. Set group drag state.
  state.groupDrag = {
    startX,
    anchorKind,
    anchorScene,
    anchorKf,
    initial,
    baseline,
    moved: false,
    cloning: !!alt,
  };
}
