import { describe, it, expect } from 'vitest';
import { parseDsl } from '../../src/cutscene/parser';
import {
  ActionAstSchema,
  ActionVerbSchema,
  AgentAstSchema,
  CameraDirectiveAstSchema,
  CameraMoveKindSchema,
  CutsceneAstSchema,
  SceneAstSchema,
  ShotKindSchema,
  type CutsceneAst,
} from '../../src/cutscene/schema-ast';

const fullDsl = `# Mike y Cris se encuentran

Agentes: mike@cocina-1, cris@pasillo-3
Duracion: 7.5s

## Plano 1 - Establecer (2s)
Camara: wide_establishing
- mike camina_a cris

## Plano 2 - Dialogo (4s)
Camara: two_shot mike cris, lente 35mm
- 0.5s: mike dice "Como va, hermano?"
- 2.5s: cris dice "Aca, peleandola con la planilla."

## Plano 3 - Reaccion (1.5s)
Camara: close_up cris, mover dolly_in distancia=2
- 0.0s: cris anima roll_eyes

Transicion final: cut`;

function validCutsceneAst(): CutsceneAst {
  return {
    title: 'Test',
    duration: 1,
    agents: [{ id: 'mike', location: 'cocina-1' }],
    scenes: [
      {
        title: 'Plano 1',
        duration: 1,
        camera: { shotType: 'medium_shot', subjects: ['mike'] },
        actions: [
          {
            line: 6,
            time: 0,
            actor: 'mike',
            verb: 'dice',
            args: ['hola'],
            raw: '- mike dice "hola"',
          },
        ],
      },
    ],
    finalTransition: 'cut',
  };
}

describe('AST enum schemas', () => {
  it('accepts and rejects shot kinds', () => {
    expect(ShotKindSchema.safeParse('close_up').success).toBe(true);
    expect(ShotKindSchema.safeParse('panoramic').success).toBe(false);
  });

  it('accepts and rejects action verbs', () => {
    expect(ActionVerbSchema.safeParse('dice').success).toBe(true);
    expect(ActionVerbSchema.safeParse('corre').success).toBe(false);
  });

  it('accepts and rejects camera move kinds', () => {
    expect(CameraMoveKindSchema.safeParse('dolly_in').success).toBe(true);
    expect(CameraMoveKindSchema.safeParse('crash_zoom').success).toBe(false);
  });
});

describe('AgentAstSchema', () => {
  it('accepts a valid agent', () => {
    expect(AgentAstSchema.safeParse({ id: 'mike', location: 'cocina-1' }).success).toBe(true);
  });

  it('rejects an empty id', () => {
    expect(AgentAstSchema.safeParse({ id: '', location: 'cocina-1' }).success).toBe(false);
  });

  it('rejects an empty location', () => {
    expect(AgentAstSchema.safeParse({ id: 'mike', location: '' }).success).toBe(false);
  });
});

describe('ActionAstSchema', () => {
  it('accepts a valid complete action', () => {
    const result = ActionAstSchema.safeParse({
      line: 6,
      time: 0.5,
      actor: 'mike',
      verb: 'dice',
      args: ['hola'],
      raw: '- 0.5s: mike dice "hola"',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a negative time', () => {
    const result = ActionAstSchema.safeParse({
      line: 6,
      time: -1,
      actor: 'mike',
      verb: 'dice',
      args: ['hola'],
      raw: '- mike dice "hola"',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty actor', () => {
    const result = ActionAstSchema.safeParse({
      line: 6,
      time: 0,
      actor: '',
      verb: 'dice',
      args: ['hola'],
      raw: '- dice "hola"',
    });

    expect(result.success).toBe(false);
  });
});

describe('CameraDirectiveAstSchema', () => {
  it('accepts a valid camera directive with shot, subjects, lens, and move', () => {
    const result = CameraDirectiveAstSchema.safeParse({
      shotType: 'close_up',
      subjects: ['cris'],
      lens: 35,
      move: { kind: 'dolly_in', args: { distancia: 2 } },
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unknown shotType', () => {
    const result = CameraDirectiveAstSchema.safeParse({
      shotType: 'panoramic',
      subjects: ['cris'],
      lens: 35,
      move: { kind: 'dolly_in', args: { distancia: 2 } },
    });

    expect(result.success).toBe(false);
  });
});

describe('SceneAstSchema', () => {
  it('accepts a valid scene', () => {
    expect(SceneAstSchema.safeParse(validCutsceneAst().scenes[0]).success).toBe(true);
  });

  it('rejects duration equal to zero', () => {
    const scene = { ...validCutsceneAst().scenes[0], duration: 0 };

    expect(SceneAstSchema.safeParse(scene).success).toBe(false);
  });

  it('rejects negative duration', () => {
    const scene = { ...validCutsceneAst().scenes[0], duration: -1 };

    expect(SceneAstSchema.safeParse(scene).success).toBe(false);
  });
});

describe('CutsceneAstSchema', () => {
  it('accepts a minimal valid cutscene AST', () => {
    expect(CutsceneAstSchema.safeParse(validCutsceneAst()).success).toBe(true);
  });

  it('rejects an extra field', () => {
    const cutscene = { ...validCutsceneAst(), extraField: 'foo' };

    expect(CutsceneAstSchema.safeParse(cutscene).success).toBe(false);
  });

  it('rejects duration equal to zero', () => {
    const cutscene = { ...validCutsceneAst(), duration: 0 };

    expect(CutsceneAstSchema.safeParse(cutscene).success).toBe(false);
  });

  it('rejects an extra field in strict mode', () => {
    const cutscene = { ...validCutsceneAst(), extraField: 'foo' };

    // This validates that CutsceneAstSchema is .strict() and rejects parser/schema drift.
    expect(CutsceneAstSchema.safeParse(cutscene).success).toBe(false);
  });

  it('accepts the AST produced by parseDsl for the complete DSL fixture', () => {
    const parsed = parseDsl(fullDsl);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.errors.map(error => error.message).join('\n'));

    expect(CutsceneAstSchema.safeParse(parsed.ast).success).toBe(true);
  });
});
