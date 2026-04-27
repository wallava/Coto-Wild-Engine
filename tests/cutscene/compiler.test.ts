import { describe, it, expect } from 'vitest';
import { compileCutscene } from '../../src/cutscene/compiler';
import { CutsceneSchema } from '../../src/cutscene/schema';
import type { CutsceneAst } from '../../src/cutscene/schema-ast';

function mkAst(scenes: any[], opts: Partial<CutsceneAst> = {}): CutsceneAst {
  return {
    title: opts.title ?? 'test',
    duration: opts.duration ?? scenes.reduce((s, sc) => s + sc.duration, 0),
    agents: opts.agents ?? [{ id: 'mike', location: 'spawn-1' }],
    scenes,
    finalTransition: opts.finalTransition,
  };
}

const defaultZones = new Map([['spawn-1', { cx: 0, cy: 0 }], ['cocina-1', { cx: 3, cy: 3 }]]);

describe('compileCutscene', () => {
  it('AST mínimo válido produce Cutscene runtime válido', () => {
    const ast = mkAst([
      {
        title: 'Plano 1',
        duration: 2,
        camera: { shotType: 'wide_establishing', subjects: [] },
        actions: [],
      },
    ]);
    const r = compileCutscene(ast, { zonePositions: defaultZones });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(CutsceneSchema.safeParse(r.cutscene).success).toBe(true);
      expect(r.cutscene.scenes).toHaveLength(1);
      expect(r.cutscene.camera.keyframes).toHaveLength(1);
    }
  });

  it('emite move kf inicial t=0 por cada agent', () => {
    const ast = mkAst(
      [{ title: 'P1', duration: 1, camera: { shotType: 'wide_establishing', subjects: [] }, actions: [] }],
      { agents: [{ id: 'mike', location: 'spawn-1' }, { id: 'cris', location: 'cocina-1' }] },
    );
    const r = compileCutscene(ast, { zonePositions: defaultZones });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cutscene.tracks).toHaveLength(2);
      for (const tr of r.cutscene.tracks) {
        const initKf = tr.keyframes.find(k => k.t === 0);
        expect(initKf).toBeDefined();
        expect(initKf?.type).toBe('move');
      }
    }
  });

  it('multiple scenes con cuts y tStart correcto', () => {
    const ast = mkAst([
      { title: 'P1', duration: 2, camera: { shotType: 'wide_establishing', subjects: [] }, actions: [] },
      { title: 'P2', duration: 3, camera: { shotType: 'medium_shot', subjects: ['mike'] }, actions: [] },
    ]);
    const r = compileCutscene(ast, { zonePositions: defaultZones });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cutscene.scenes![0]!.tStart).toBe(0);
      expect(r.cutscene.scenes![0]!.tEnd).toBe(2);
      expect(r.cutscene.scenes![1]!.tStart).toBe(2);
      expect(r.cutscene.scenes![1]!.tEnd).toBe(5);
      const p2Kf = r.cutscene.camera.keyframes.find(k => k.sceneId === r.cutscene.scenes![1]!.id);
      expect(p2Kf?.cut).toBe(true);
    }
  });

  it('action camina_a actualiza estado del mundo entre scenes', () => {
    const ast = mkAst([
      {
        title: 'P1', duration: 2,
        camera: { shotType: 'medium_shot', subjects: ['mike'] },
        actions: [{ line: 1, time: 1.0, actor: 'mike', verb: 'camina_a', args: ['cocina-1'], raw: '- 1s: mike camina_a cocina-1' }],
      },
    ]);
    const r = compileCutscene(ast, { zonePositions: defaultZones });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const mikeTrack = r.cutscene.tracks.find(t => t.agentId === 'mike');
      const moveKfs = mikeTrack?.keyframes.filter(k => k.type === 'move');
      expect(moveKfs?.length).toBeGreaterThanOrEqual(2);
      const walkKf = moveKfs?.find(k => k.t === 1.0);
      expect(walkKf?.cx).toBe(3);
      expect(walkKf?.cy).toBe(3);
    }
  });

  it('finalTransition aplicado al último camera kf', () => {
    const ast = mkAst(
      [{ title: 'P1', duration: 2, camera: { shotType: 'wide_establishing', subjects: [] }, actions: [] }],
      { finalTransition: 'fade' },
    );
    const r = compileCutscene(ast, { zonePositions: defaultZones });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const last = r.cutscene.camera.keyframes[r.cutscene.camera.keyframes.length - 1];
      expect(last?.transition).toBe('fade');
    }
  });

  it('warning si sum(scene.duration) != ast.duration', () => {
    const ast = mkAst(
      [{ title: 'P1', duration: 2, camera: { shotType: 'wide_establishing', subjects: [] }, actions: [] }],
      { duration: 10 },
    );
    const r = compileCutscene(ast, { zonePositions: defaultZones });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.warnings.some(w => /duration/.test(w))).toBe(true);
    }
  });

  it('AST inválido devuelve ok:false con errors', () => {
    const ast: any = { title: 'x', duration: -1, agents: [], scenes: [] };
    const r = compileCutscene(ast);
    expect(r.ok).toBe(false);
  });

  it('actions ordenadas por t aunque AST las dé fuera de orden', () => {
    const ast = mkAst([
      {
        title: 'P1', duration: 5,
        camera: { shotType: 'medium_shot', subjects: ['mike'] },
        actions: [
          { line: 3, time: 2.0, actor: 'mike', verb: 'dice', args: ['B'], raw: '' },
          { line: 2, time: 1.0, actor: 'mike', verb: 'dice', args: ['A'], raw: '' },
        ],
      },
    ]);
    const r = compileCutscene(ast, { zonePositions: defaultZones });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const mikeTrack = r.cutscene.tracks.find(t => t.agentId === 'mike');
      const speakKfs = mikeTrack?.keyframes.filter(k => k.type === 'speak') ?? [];
      expect(speakKfs[0]?.t).toBeLessThan(speakKfs[1]?.t ?? Infinity);
    }
  });
});
