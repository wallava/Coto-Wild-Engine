import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { CutsceneSchema } from '../../src/cutscene/schema';

const REPO_ROOT = resolve(__dirname, '../..');
const FIXTURE = resolve(REPO_ROOT, 'scenes/test-encuentro.scene.md');
const ZONES = resolve(REPO_ROOT, 'scenes/test-encuentro.zones.json');
const OUTPUT = resolve(REPO_ROOT, 'scenes/test-encuentro.json');

function runCli(args: string[]) {
  return spawnSync('npm', ['run', 'cutscene-compile', '--', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 30000,
  });
}

describe('cutscene-compile CLI e2e', () => {
  it('compila el fixture y genera JSON válido contra CutsceneSchema', () => {
    if (existsSync(OUTPUT)) unlinkSync(OUTPUT);
    const r = runCli([FIXTURE, '--zones', ZONES]);
    expect(r.status).toBe(0);
    expect(existsSync(OUTPUT)).toBe(true);
    const data = JSON.parse(readFileSync(OUTPUT, 'utf8'));
    const validation = CutsceneSchema.safeParse(data);
    expect(validation.success).toBe(true);
  });

  it('JSON output tiene 3 scenes con tiempos correctos', () => {
    const data = JSON.parse(readFileSync(OUTPUT, 'utf8'));
    expect(data.scenes).toHaveLength(3);
    expect(data.scenes[0].tStart).toBe(0);
    expect(data.scenes[0].tEnd).toBe(2);
    expect(data.scenes[1].tEnd).toBe(6);
    expect(data.scenes[2].tEnd).toBe(7.5);
  });

  it('JSON output tiene tracks para mike y cris con kfs', () => {
    const data = JSON.parse(readFileSync(OUTPUT, 'utf8'));
    const ids = data.tracks.map((t: any) => t.agentId).sort();
    expect(ids).toEqual(['cris', 'mike']);
    for (const tr of data.tracks) {
      expect(tr.keyframes.length).toBeGreaterThan(0);
    }
  });

  it('CLI con archivo inexistente devuelve exit code != 0', () => {
    const r = runCli(['scenes/nonexistent.scene.md']);
    expect(r.status).not.toBe(0);
  });

  it('CLI con --output personalizado escribe a ese path', () => {
    const customOut = resolve(REPO_ROOT, 'scenes/custom-output.json');
    if (existsSync(customOut)) unlinkSync(customOut);
    const r = runCli([FIXTURE, '--zones', ZONES, '--output', customOut]);
    expect(r.status).toBe(0);
    expect(existsSync(customOut)).toBe(true);
    unlinkSync(customOut);
  });
});
