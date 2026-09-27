// تربية النياق: الأكل والشرب والتلقيح والولادة والحلب والقيمة
import { BREEDS, RARES, RARE_CHANCE, BLESSED_RARE_CHANCE, GESTATION_DAYS, ADULT_AGE, TROUGH_CAP, PEN_CAPACITY, FEMALE_NAMES, MALE_NAMES } from '../data/camels.js';
import { add, count, addStat } from './inventory.js';
import { pick, randInt, clamp } from './util.js';

export function makeCamel(state, rng, opts = {}) {
  state.camelSeq = (state.camelSeq || 0) + 1;
  const sex = opts.sex || (rng() < 0.5 ? 'f' : 'm');
  const breed = opts.breed || pick(rng, Object.keys(BREEDS));
  return {
    id: 'c' + state.camelSeq + '_' + Math.floor(rng() * 1e6).toString(36),
    name: opts.name || pick(rng, sex === 'f' ? FEMALE_NAMES : MALE_NAMES),
    sex, breed,
    rare: opts.rare || null,
    beauty: opts.beauty != null ? opts.beauty : randInt(rng, 25, 70),
    ageDays: opts.ageDays != null ? opts.ageDays : ADULT_AGE,
    pregnant: null,
    fedDay: null, wateredDay: null, milkedDay: null,
  };
}

export function isAdult(c) {
  return c.ageDays >= ADULT_AGE;
}

export function capacity(state) {
  if (state.built.pen3) return PEN_CAPACITY.pen3;
  if (state.built.pen2) return PEN_CAPACITY.pen2;
  return PEN_CAPACITY.base;
}

export function camelById(state, id) {
  return (state.camels || []).find(c => c.id === id) || null;
}

// القيمة التقديرية. idx = مؤشر السوق للسلالة
export function camelValue(c, idx = 1) {
  const young = isAdult(c) ? 1 : 0.55;
  if (c.rare) return Math.round(RARES[c.rare].base * (0.6 + c.beauty / 100) * young / 100) * 100;
  const sexMul = c.sex === 'f' ? 1.1 : 1;
  return Math.round(BREEDS[c.breed].base * (0.55 + c.beauty / 90) * young * sexMul * idx / 10) * 10;
}

export function isFed(c, day) { return c.fedDay === day; }
export function isWatered(c, day) { return c.wateredDay === day; }

export const FEEDS = { alfalfa: 1, dates: 3 };

export function feedItem(state) {
  if (count(state, 'alfalfa') >= FEEDS.alfalfa) return 'alfalfa';
  if (count(state, 'dates') >= FEEDS.dates) return 'dates';
  return null;
}

export function feed(state, id, day) {
  const c = camelById(state, id);
  if (!c || isFed(c, day)) return false;
  const it = feedItem(state);
  if (!it) return false;
  add(state, it, -FEEDS[it]);
  c.fedDay = day;
  addStat(state, 'camelFed', 1);
  return it;
}

export function waterCamel(state, id, day) {
  const c = camelById(state, id);
  if (!c || isWatered(c, day) || count(state, 'water') < 1) return false;
  add(state, 'water', -1);
  c.wateredDay = day;
  addStat(state, 'camelWatered', 1);
  return true;
}

export function fillTrough(state, n = 1) {
  const t = state.trough;
  const room = TROUGH_CAP - t.water;
  const k = Math.min(n, room, count(state, 'water'));
  if (k <= 0) return 0;
  add(state, 'water', -k);
  t.water += k;
  addStat(state, 'troughFilled', k);
  return k;
}

export function canMilk(c, day) {
  return c.sex === 'f' && isAdult(c) && !c.pregnant && c.milkedDay !== day;
}

export function milk(state, id, day) {
  const c = camelById(state, id);
  if (!c || !canMilk(c, day)) return 0;
  const n = isFed(c, day) && isWatered(c, day) ? 2 : 1;
  c.milkedDay = day;
  add(state, 'milk', n);
  addStat(state, 'milked', 1);
  return n;
}

// سبب عدم إمكانية التلقيح (أو null إذا ممكن)
export function breedBlocker(state, maleId, femaleId, day) {
  const m = camelById(state, maleId), f = camelById(state, femaleId);
  if (!m || !f || m.sex !== 'm' || f.sex !== 'f') return 'تحتاج فحل وناقة';
  if (!isAdult(m) || !isAdult(f)) return 'لازم يكبرون أول';
  if (f.pregnant) return 'الناقة حامل';
  if (!isFed(m, day) || !isFed(f, day)) return 'أطعمهم اليوم أول';
  if (!isWatered(m, day) || !isWatered(f, day)) return 'اسقهم اليوم أول';
  if (state.camels.length >= capacity(state)) return 'المراح مليان، وسّعه أو بيع';
  return null;
}

export function breed(state, maleId, femaleId, day, blessed = false) {
  if (breedBlocker(state, maleId, femaleId, day)) return false;
  const f = camelById(state, femaleId);
  f.pregnant = { days: 0, father: maleId, blessed: !!blessed };
  addStat(state, 'breedings', 1);
  return true;
}

export function rollRare(rng, blessed) {
  return rng() < (blessed ? BLESSED_RARE_CHANCE : RARE_CHANCE);
}

export function makeCalf(state, mother, father, rng, blessed) {
  const rare = rollRare(rng, blessed) ? pick(rng, Object.keys(RARES)) : null;
  const parentBeauty = father ? (mother.beauty + father.beauty) / 2 : mother.beauty;
  const beauty = clamp(Math.round(parentBeauty + randInt(rng, -8, 12) + (rare ? 20 : 0)), 1, 100);
  const breed = father && rng() < 0.5 ? father.breed : mother.breed;
  return makeCamel(state, rng, { breed, rare, beauty, ageDays: 0 });
}

// بداية كل يوم: يشربون من الحوض، يكبرون، والحوامل يولدون. يرجع الولادات
export function dailyUpdate(state, day, rng) {
  const births = [];
  for (const c of [...state.camels]) {
    c.ageDays += 1;
    if (state.trough && state.trough.water > 0 && state.built.trough) {
      state.trough.water -= 1;
      c.wateredDay = day;
    }
    if (c.pregnant) {
      c.pregnant.days += 1;
      if (c.pregnant.days >= GESTATION_DAYS) {
        const father = camelById(state, c.pregnant.father);
        const calf = makeCalf(state, c, father, rng, c.pregnant.blessed);
        c.pregnant = null;
        state.camels.push(calf);
        addStat(state, 'camelsBorn', 1);
        if (calf.rare) addStat(state, 'rareCamels', 1);
        births.push(calf);
      }
    }
  }
  return births;
}

export function camelNeeds(c, day) {
  const needs = [];
  if (!isWatered(c, day)) needs.push('water');
  if (!isFed(c, day)) needs.push('food');
  if (canMilk(c, day)) needs.push('milk');
  return needs;
}
