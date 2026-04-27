#!/usr/bin/env tsx

import { readFileSync, writeFileSync, watchFile } from 'node:fs';
import { resolve } from 'node:path';
import { parseDsl } from '../src/cutscene/parser';
import { compileCutscene } from '../src/cutscene/compiler';

type CliArgs = {
  input: string;
  output: string;
  zones?: string;
  watch: boolean;
};

function parseArgs(argv: string[]): CliArgs | null {
  const args: any = { watch: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--output' && rest[i+1]) { args.output = rest[++i]; continue; }
    if (a === '--zones' && rest[i+1]) { args.zones = rest[++i]; continue; }
    if (a === '--watch') { args.watch = true; continue; }
    if (a.startsWith('--')) {
      console.error(`Argumento desconocido: ${a}`);
      return null;
    }
    if (!args.input) { args.input = a; continue; }
    console.error(`Argumento posicional inesperado: ${a}`);
    return null;
  }
  if (!args.input) {
    console.error('Uso: cutscene-compile <input.scene.md> [--output <path>] [--zones <path.json>] [--watch]');
    return null;
  }
  if (!args.output) {
    const inputBase = args.input.replace(/\.scene\.md$/, '').replace(/\.md$/, '');
    args.output = `${inputBase}.json`;
  }
  return args as CliArgs;
}

function loadZones(path: string | undefined): Map<string, { cx: number; cy: number }> {
  if (!path) return new Map();
  try {
    const raw = readFileSync(path, 'utf8');
    const data = JSON.parse(raw);
    return new Map(Object.entries(data).map(([k, v]: any) => [k, { cx: v.cx, cy: v.cy }]));
  } catch (e) {
    console.error(`Error leyendo --zones ${path}:`, (e as Error).message);
    process.exit(1);
  }
}

function compileFile(input: string, output: string, zones: Map<string, { cx: number; cy: number }>): boolean {
  let source: string;
  try {
    source = readFileSync(input, 'utf8');
  } catch (e) {
    console.error(`Error leyendo ${input}:`, (e as Error).message);
    return false;
  }
  const parseResult = parseDsl(source);
  if (!parseResult.ok) {
    console.error(`[parser] ${parseResult.errors.length} errores en ${input}:`);
    for (const err of parseResult.errors) {
      console.error(`  línea ${err.line}: ${err.message}`);
    }
    return false;
  }
  const compileResult = compileCutscene(parseResult.ast, { zonePositions: zones });
  if (!compileResult.ok) {
    console.error(`[compiler] errores en ${input}:`);
    for (const err of compileResult.errors) {
      console.error(`  ${err}`);
    }
    return false;
  }
  if (compileResult.warnings.length > 0) {
    for (const w of compileResult.warnings) console.warn(`[compiler] warning: ${w}`);
  }
  try {
    writeFileSync(output, JSON.stringify(compileResult.cutscene, null, 2), 'utf8');
    console.log(`✅ ${input} → ${output}`);
    return true;
  } catch (e) {
    console.error(`Error escribiendo ${output}:`, (e as Error).message);
    return false;
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (!args) process.exit(1);
  const inputAbs = resolve(args.input);
  const outputAbs = resolve(args.output);
  const zones = loadZones(args.zones);

  const ok = compileFile(inputAbs, outputAbs, zones);

  if (!args.watch) {
    process.exit(ok ? 0 : 1);
  }

  console.log(`watching ${inputAbs}...`);
  watchFile(inputAbs, { interval: 200 }, () => {
    compileFile(inputAbs, outputAbs, zones);
  });
}

main();
