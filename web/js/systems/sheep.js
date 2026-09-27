// الغنم: شراء، إطعام، سقي، جز الصوف
import { SHEEP_BREEDS, SHEEP_ADULT, WOOL_EVERY, SHEEP_CAP } from '../data/sheep.js';
import { add, count, addStat } from './inventory.js';
import { pick } from './util.js';

export function lambPrice(breed) {
  return Math.round(SHEEP_BREEDS[breed].base * 0.55);
}

export function buyLamb(state, breed, rng) {
  if (!state.built.sheepfold) return { ok: false, reason: 'ابنِ الحظيرة أول' };
  if (state.sheep.length >= SHEEP_CAP) return { ok: false, reason: 'الحظيرة مليانة' };
  const price = lambPrice(breed);
  if (state.player.coins < price) return { ok: false, reason: 'الدراهم ما تكفي' };
  state.player.coins -= price;
  state.sheepSeq = (state.sheepSeq || 0) + 1;
  const sh = { id: 's' + state.sheepSeq, breed, ageDays: 0, fedDay: null, wateredDay: null, shornDay: -99, sex: rng() < 0.5 ? 'f' : 'm' };
  state.sheep.push(sh);
  return { ok: true, sheep: sh, price };
}

export function sheepFeedItem(state) {
  if (count(state, 'alfalfa') >= 1) return 'alfalfa';
  if (count(state, 'wheat') >= 1) return 'wheat';
  if (count(state, 'herb') >= 1) return 'herb';
  return null;
}

export function feedSheep(state, id, day) {
  const sh = state.sheep.find(s => s.id === id);
  if (!sh || sh.fedDay === day) return false;
  const it = sheepFeedItem(state);
  if (!it) return false;
  add(state, it, -1);
  sh.fedDay = day;
  addStat(state, 'sheepFed', 1);
  return it;
}

export function waterSheep(state, id, day) {
  const sh = state.sheep.find(s => s.id === id);
  if (!sh || sh.wateredDay === day || count(state, 'water') < 1) return false;
  add(state, 'water', -1);
  sh.wateredDay = day;
  return true;
}

export function canShear(sh, day) {
  return sh.ageDays >= SHEEP_ADULT && day - sh.shornDay >= WOOL_EVERY;
}

export function shear(state, id, day) {
  const sh = state.sheep.find(s => s.id === id);
  if (!sh || !canShear(sh, day)) return 0;
  const n = sh.fedDay === day ? 3 : 2;
  sh.shornDay = day;
  add(state, 'wool', n);
  addStat(state, 'sheared', 1);
  return n;
}

// بداية كل يوم: يكبرون، ويشربون من حوض النياق إذا فيه ماء
export function sheepDaily(state, day) {
  for (const sh of state.sheep) {
    if (sh.fedDay === day - 1 || sh.ageDays < SHEEP_ADULT) sh.ageDays += 1;
    if (state.trough && state.trough.water > 0 && state.built.trough) {
      state.trough.water -= 1;
      sh.wateredDay = day;
    }
  }
}

export function sheepNeeds(sh, day) {
  const n = [];
  if (sh.wateredDay !== day) n.push('water');
  if (sh.fedDay !== day) n.push('food');
  if (canShear(sh, day)) n.push('wool');
  return n;
}

export { SHEEP_BREEDS };
export function randomBreed(rng) { return pick(rng, Object.keys(SHEEP_BREEDS)); }
