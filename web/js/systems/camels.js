// تربية النياق: الأكل والشرب والتلقيح والولادة والحلب والقيمة
import { BREEDS, RARES, RARE_CHANCE, BLESSED_RARE_CHANCE, GESTATION_DAYS, ADULT_AGE, TROUGH_CAP, PEN_CAPACITY, FEMALE_NAMES, MALE_NAMES, TRAITS, COMMON_TRAITS, RARE_TRAITS, RARE_TRAIT_CHANCE, SECOND_TRAIT_CHANCE, INHERIT_COMMON, INHERIT_RARE } from '../data/camels.js';
import { add, count, addStat } from './inventory.js';
import { pick, randInt, clamp, mulberry32, hashString } from './util.js';

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
    traits: opts.traits || rollTraits(rng, !!opts.rare),
  };
}

// ---------- الخواص ----------
// نوادر السلالة دايم لها خاصية نادرة
export function rollTraits(rng, rare = false, inherited = []) {
  const out = [...new Set(inherited)];
  const hasRare = () => out.some(t => TRAITS[t].tier === 'rare');
  if ((rare || rng() < RARE_TRAIT_CHANCE) && !hasRare()) out.push(pick(rng, RARE_TRAITS));
  const commons = () => out.filter(t => TRAITS[t].tier === 'common').length;
  const want = rng() < SECOND_TRAIT_CHANCE ? 2 : 1;
  for (let i = 0; i < 6 && commons() < want; i++) {
    const t = pick(rng, COMMON_TRAITS);
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

// النياق القديمة (قبل الخواص) تاخذ خواص ثابتة من رقمها
export function ensureTraits(c) {
  if (!Array.isArray(c.traits)) c.traits = rollTraits(mulberry32(hashString('traits:' + c.id)), !!c.rare);
  return c.traits;
}

export function hasTrait(c, t) {
  return !!(c && c.traits && c.traits.includes(t));
}

function traitSum(c, key) {
  return (c.traits || []).reduce((a, t) => a + (TRAITS[t] && TRAITS[t][key] ? TRAITS[t][key] : 0), 0);
}

export function speedMul(c) { return 1 + traitSum(c, 'speed'); }
export function valueMul(c) { return 1 + traitSum(c, 'value'); }
export function gestationDays(c) { return Math.max(1, GESTATION_DAYS + traitSum(c, 'gestation')); }
export function rareMul(c) { return (c.traits || []).reduce((a, t) => a * ((TRAITS[t] && TRAITS[t].rareMul) || 1), 1); }

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
  const tm = valueMul(c);
  if (c.rare) return Math.round(RARES[c.rare].base * (0.6 + c.beauty / 100) * young * tm / 100) * 100;
  const sexMul = c.sex === 'f' ? 1.1 : 1;
  return Math.round(BREEDS[c.breed].base * (0.55 + c.beauty / 90) * young * sexMul * idx * tm / 10) * 10;
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
  let n = isFed(c, day) && (isWatered(c, day) || hasTrait(c, 'hardy')) ? 2 : 1;
  n += traitSum(c, 'milk');
  n *= (c.traits || []).reduce((a, t) => a * ((TRAITS[t] && TRAITS[t].milkMul) || 1), 1);
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

export function rollRare(rng, blessed, mul = 1) {
  return rng() < (blessed ? BLESSED_RARE_CHANCE : RARE_CHANCE) * mul;
}

export function makeCalf(state, mother, father, rng, blessed) {
  const mul = Math.max(rareMul(mother), father ? rareMul(father) : 1);
  const rare = rollRare(rng, blessed, mul) ? pick(rng, Object.keys(RARES)) : null;
  const parentBeauty = father ? (mother.beauty + father.beauty) / 2 : mother.beauty;
  const beauty = clamp(Math.round(parentBeauty + randInt(rng, -8, 12) + (rare ? 20 : 0)), 1, 100);
  const breed = father && rng() < 0.5 ? father.breed : mother.breed;
  // الوراثة: كل خاصية عند الأب أو الأم لها فرصة تنتقل للحوار
  const inherited = [];
  for (const t of [...(mother.traits || []), ...((father && father.traits) || [])]) {
    if (!TRAITS[t] || inherited.includes(t)) continue;
    if (rng() < (TRAITS[t].tier === 'rare' ? INHERIT_RARE : INHERIT_COMMON)) inherited.push(t);
  }
  const rareKept = inherited.filter(t => TRAITS[t].tier === 'rare');
  const clean = inherited.filter(t => TRAITS[t].tier === 'common').concat(rareKept.slice(0, 1));
  return makeCamel(state, rng, { breed, rare, beauty, ageDays: 0, traits: rollTraits(rng, !!rare, clean) });
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
      if (c.pregnant.days >= gestationDays(c)) {
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

// المبروكة تجيب رزق كل يوم. يرجع مجموع الدراهم
export function luckyIncome(state, rng) {
  let sum = 0;
  for (const c of state.camels) {
    const r = (c.traits || []).map(t => TRAITS[t] && TRAITS[t].lucky).find(Boolean);
    if (r && isAdult(c)) sum += randInt(rng, r[0], r[1]);
  }
  if (sum) { state.player.coins += sum; addStat(state, 'luckyCoins', sum); }
  return sum;
}

export function camelNeeds(c, day) {
  const needs = [];
  if (!isWatered(c, day)) needs.push('water');
  if (!isFed(c, day)) needs.push('food');
  if (canMilk(c, day)) needs.push('milk');
  return needs;
}
