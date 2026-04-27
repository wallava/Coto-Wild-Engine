import { describe, it, expect } from 'vitest';
import { parseDsl } from '../../src/cutscene/parser';

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

function validDslWithAction(actionLine: string): string {
  return `# Test
Agentes: mike@cocina-1
Duracion: 1s
## Plano 1 (1s)
Camara: medium_shot mike
${actionLine}`;
}

describe('parseDsl', () => {
  it('parses the complete happy path DSL', () => {
    const result = parseDsl(fullDsl);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.map(error => error.message).join('\n'));

    expect(result.ast.title).toBe('Mike y Cris se encuentran');
    expect(result.ast.duration).toBe(7.5);
    expect(result.ast.agents).toHaveLength(2);
    expect(result.ast.scenes).toHaveLength(3);
    expect(result.ast.scenes[1]?.camera.lens).toBe(35);
    expect(result.ast.scenes[2]?.camera.move?.kind).toBe('dolly_in');
    expect(result.ast.scenes[2]?.camera.move?.args.distancia).toBe(2);
    expect(typeof result.ast.scenes[2]?.camera.move?.args.distancia).toBe('number');
    expect(result.ast.finalTransition).toBe('cut');
  });

  it('defaults an action without timestamp to time zero', () => {
    const result = parseDsl(validDslWithAction('- mike camina_a cris'));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.map(error => error.message).join('\n'));

    expect(result.ast.scenes[0]?.actions[0]?.time).toBe(0);
  });

  it('parses an action timestamp with s suffix', () => {
    const result = parseDsl(validDslWithAction('- 0.5s: mike dice "hola"'));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.map(error => error.message).join('\n'));

    expect(result.ast.scenes[0]?.actions[0]?.time).toBe(0.5);
  });

  it('parses an action timestamp without s suffix', () => {
    const result = parseDsl(validDslWithAction('- 0.5: mike dice "hola"'));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.map(error => error.message).join('\n'));

    expect(result.ast.scenes[0]?.actions[0]?.time).toBe(0.5);
  });

  it('ignores comment lines starting with percent markers', () => {
    const result = parseDsl(`# Test
%%% comentario ignorado
Agentes: mike@cocina-1
Duracion: 1s
## Plano 1 (1s)
Camara: medium_shot mike
- mike espera`);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.map(error => error.message).join('\n'));

    expect(result.ast.scenes[0]?.actions).toHaveLength(1);
  });

  it('ignores empty lines', () => {
    const result = parseDsl(`# Test

Agentes: mike@cocina-1

Duracion: 1s

## Plano 1 (1s)

Camara: medium_shot mike

- mike espera
`);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.map(error => error.message).join('\n'));

    expect(result.ast.scenes[0]?.actions).toHaveLength(1);
  });

  it('parses dice text inside double quotes without the quotes', () => {
    const result = parseDsl(validDslWithAction('- mike dice "hola hermano"'));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.map(error => error.message).join('\n'));

    expect(result.ast.scenes[0]?.actions[0]?.args[0]).toBe('hola hermano');
  });

  it('rejects DSL without an H1 title', () => {
    const result = parseDsl(`Agentes: mike@cocina-1
Duracion: 1s
## Plano 1 (1s)
Camara: medium_shot mike
- mike espera`);

    expect(result.ok).toBe(false);
  });

  it('rejects DSL without Duracion line', () => {
    const result = parseDsl(`# Test
Agentes: mike@cocina-1
## Plano 1 (1s)
Camara: medium_shot mike
- mike espera`);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => /[Dd]uraci[óo]n/.test(e.message))).toBe(true);
    }
  });

  it('rejects an unknown shotType', () => {
    const result = parseDsl(`# Test
Agentes: mike@cocina-1
Duracion: 1s
## Plano 1 (1s)
Camara: panoramic mike
- mike espera`);

    expect(result.ok).toBe(false);
  });

  it('rejects an unknown action verb', () => {
    const result = parseDsl(validDslWithAction('- mike corre cris'));

    expect(result.ok).toBe(false);
  });

  it('rejects dice without double quotes', () => {
    const result = parseDsl(validDslWithAction('- mike dice hola'));

    expect(result.ok).toBe(false);
  });

  it('rejects agents without an at-location segment', () => {
    const result = parseDsl(`# Test
Agentes: mike
Duracion: 1s
## Plano 1 (1s)
Camara: medium_shot mike
- mike espera`);

    expect(result.ok).toBe(false);
  });

  it('reports a positive numeric line for at least one parse error', () => {
    const result = parseDsl(validDslWithAction('- mike corre cris'));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected parseDsl to fail');

    expect(typeof result.errors[0]?.line).toBe('number');
    expect(result.errors[0]?.line).toBeGreaterThan(0);
  });
});
