// الزراعة: ازرع ← اسقِ كل يوم ← يكبر بداية كل يوم جديد ← احصد
import { SEEDS } from '../data/items.js';
import { add, addStat, count } from './inventory.js';
import { randInt } from './util.js';

export function plotState(state, id) {
  return state.plots[id] || null;
}

export function firstSeed(state) {
  return Object.keys(SEEDS).find(s => count(state, s) > 0) || null;
}

export function plant(state, id, seedId) {
  if (state.plots[id] || !SEEDS[seedId] || count(state, seedId) < 1) return false;
  add(state, seedId, -1);
  state.plots[id] = { seed: seedId, stage: 0, watered: false };
  addStat(state, 'planted', 1);
  return true;
}

export function water(state, id) {
  const p = state.plots[id];
  if (!p || p.watered || isReady(p) || count(state, 'water') < 1) return false;
  add(state, 'water', -1);
  p.watered = true;
  addStat(state, 'watered', 1);
  return true;
}

export function isReady(p) {
  return p && p.stage >= SEEDS[p.seed].days;
}

export function harvest(state, id, rng) {
  const p = state.plots[id];
  if (!isReady(p)) return null;
  const def = SEEDS[p.seed];
  const n = randInt(rng, def.yield[0], def.yield[1]);
  add(state, def.crop, n);
  // يرجع لك بذرة وحدة على الأقل عشان ما تعلق
  add(state, p.seed, rng() < 0.6 ? 2 : 1);
  delete state.plots[id];
  addStat(state, 'harvested', 1);
  return { crop: def.crop, n };
}

export function growPlots(state, days = 1) {
  for (let d = 0; d < days; d++) {
    for (const p of Object.values(state.plots)) {
      if (p.watered && !isReady(p)) p.stage += 1;
      p.watered = false;
    }
  }
}
