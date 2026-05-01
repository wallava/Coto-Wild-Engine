import { describe, it, expect } from 'vitest';
import { TriggerSystem } from '../../../src/game/llm-agents/triggers';

function mkOpts(state: { now: number; agents: Map<string, {cx:number,cy:number}>; needs?: Map<string, number> }) {
  return {
    nowMs: () => state.now,
    listActiveAgentIds: () => [...state.agents.keys()],
    getAgentCell: (id: string) => state.agents.get(id) ?? null,
    getAgentNeed: (id: string, kind: string) => state.needs?.get(`${id}|${kind}`) ?? null,
  };
}

describe('TriggerSystem.social', () => {
  it('no emite si adyacentes < 2s', () => {
    const state = { now: 0, agents: new Map([['a', {cx:0,cy:0}], ['b', {cx:1,cy:0}]]) };
    const ts = new TriggerSystem(mkOpts(state));
    expect(ts.tick()).toEqual([]);
    state.now = 1500;
    expect(ts.tick()).toEqual([]);
  });

  it('emite social_encounter cuando adyacentes >2s', () => {
    const state = { now: 0, agents: new Map([['a', {cx:0,cy:0}], ['b', {cx:1,cy:0}]]) };
    const ts = new TriggerSystem(mkOpts(state));
    ts.tick();
    state.now = 2500;
    const events = ts.tick();
    expect(events.length).toBe(1);
    expect(events[0]?.type).toBe('social_encounter');
  });

  it('boundary SOCIAL_ADJ_MS=2000: 1999ms no emite, 2001ms sí', () => {
    const state = { now: 0, agents: new Map([['a', {cx:0,cy:0}], ['b', {cx:1,cy:0}]]) };
    const ts = new TriggerSystem(mkOpts(state));
    ts.tick();   // firstAdjT = 0
    state.now = 1999;
    expect(ts.tick()).toEqual([]);
    state.now = 2001;
    expect(ts.tick().length).toBe(1);
  });

  it('cooldown 60s pareja: no emite segundo encuentro hasta pasar', () => {
    const state = { now: 0, agents: new Map([['a', {cx:0,cy:0}], ['b', {cx:1,cy:0}]]) };
    const ts = new TriggerSystem(mkOpts(state));
    ts.tick();
    state.now = 2500;
    ts.tick();
    state.now = 30000;
    expect(ts.tick()).toEqual([]);   // todavía en cooldown
    state.now = 70000;
    expect(ts.tick().length).toBe(1);   // post-cooldown
  });

  it('reset firstAdjT al separarse', () => {
    const state = { now: 0, agents: new Map([['a', {cx:0,cy:0}], ['b', {cx:1,cy:0}]]) };
    const ts = new TriggerSystem(mkOpts(state));
    ts.tick();
    state.now = 1000;
    state.agents.set('b', {cx:5,cy:5});   // se separan
    ts.tick();
    state.now = 2000;
    state.agents.set('b', {cx:1,cy:0});   // re-adyacentes
    ts.tick();
    state.now = 3000;
    // Solo pasaron 1s desde la nueva adyacencia. NO emite.
    expect(ts.tick()).toEqual([]);
    state.now = 4500;
    // Ahora 2.5s desde re-adyacentes. Emite.
    expect(ts.tick().length).toBe(1);
  });

  it('chebyshev <=1 incluye diagonales', () => {
    const state = { now: 0, agents: new Map([['a', {cx:0,cy:0}], ['b', {cx:1,cy:1}]]) };
    const ts = new TriggerSystem(mkOpts(state));
    ts.tick();
    state.now = 2500;
    expect(ts.tick().length).toBe(1);
  });

  it('no emite si distancia >1', () => {
    const state = { now: 0, agents: new Map([['a', {cx:0,cy:0}], ['b', {cx:3,cy:3}]]) };
    const ts = new TriggerSystem(mkOpts(state));
    ts.tick();
    state.now = 2500;
    expect(ts.tick()).toEqual([]);
  });

  it('setPairCooldown setea cooldown custom (10s)', () => {
    const state = { now: 1, agents: new Map([['a', {cx:0,cy:0}], ['b', {cx:1,cy:0}]]) };
    const ts = new TriggerSystem(mkOpts(state));
    ts.setPairCooldown('a', 'b', 10000);

    state.now = 2;
    expect(ts.tick()).toEqual([]);
    state.now = 10000;
    expect(ts.tick()).toEqual([]);
    state.now = 10002;
    expect(ts.tick().length).toBe(1);
  });

  it('setPairCooldown NO acorta cooldown existente más largo', () => {
    const state = { now: 0, agents: new Map([['a', {cx:0,cy:0}], ['b', {cx:1,cy:0}]]) };
    const ts = new TriggerSystem(mkOpts(state));
    ts.tick();
    state.now = 2500;
    expect(ts.tick().length).toBe(1);

    state.now = 3500;
    ts.setPairCooldown('a', 'b', 10000);
    state.now = 4500;
    expect(ts.tick()).toEqual([]);
    state.now = 61500;
    expect(ts.tick()).toEqual([]);
    state.now = 62502;
    expect(ts.tick().length).toBe(1);
  });

  it('setPairCooldown SÍ extiende cooldown existente más corto', () => {
    const state = { now: 1, agents: new Map([['a', {cx:0,cy:0}], ['b', {cx:1,cy:0}]]) };
    const ts = new TriggerSystem(mkOpts(state));
    ts.setPairCooldown('a', 'b', 10000);
    state.now = 2;
    expect(ts.tick()).toEqual([]);

    state.now = 5001;
    ts.setPairCooldown('a', 'b', 60000);
    state.now = 5002;
    expect(ts.tick()).toEqual([]);
    state.now = 64000;
    expect(ts.tick()).toEqual([]);
    state.now = 65002;
    expect(ts.tick().length).toBe(1);
  });

  it('T14: trigger spam mientras hay conversación-like cooldown no emite', () => {
    const state = { now: 1, agents: new Map([['a', {cx:0,cy:0}], ['b', {cx:1,cy:0}]]) };
    const ts = new TriggerSystem(mkOpts(state));
    ts.setPairCooldown('a', 'b', 60000);

    for (let i = 0; i < 10; i++) {
      state.now = 2 + i * 1000;
      expect(ts.tick()).toEqual([]);
    }
  });
});

describe('TriggerSystem.crisis', () => {
  it('emite crisis cuando need < 20', () => {
    const needs = new Map([['mike|hunger', 15]]);
    const state = { now: 0, agents: new Map([['mike', {cx:0,cy:0}]]), needs };
    const ts = new TriggerSystem(mkOpts(state));
    const events = ts.tick();
    expect(events.length).toBe(1);
    expect(events[0]?.type).toBe('crisis');
  });

  it('cooldown crisis por (agentId, needKind), no por agent solo', () => {
    const needs = new Map([['mike|hunger', 15], ['mike|energy', 10]]);
    const state = { now: 0, agents: new Map([['mike', {cx:0,cy:0}]]), needs };
    const ts = new TriggerSystem(mkOpts(state));
    const events = ts.tick();
    expect(events.length).toBe(2);   // hunger + energy independientes
  });

  it('no emite crisis si need >= 20', () => {
    const needs = new Map([['mike|hunger', 50]]);
    const state = { now: 0, agents: new Map([['mike', {cx:0,cy:0}]]), needs };
    const ts = new TriggerSystem(mkOpts(state));
    expect(ts.tick().filter(e => e.type === 'crisis')).toEqual([]);
  });
});
