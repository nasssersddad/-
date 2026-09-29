// مزارع الجيران بالعالم المفتوح: بضاعتهم، حلالهم، المساومة، وشراء المزرعة كاملة
import { FARMS } from '../data/openworld.js';
import { ITEMS, SEEDS } from '../data/items.js';
import { SHEEP_BREEDS, SHEEP_CAP } from '../data/sheep.js';
import { sheepCapBonus } from './placement.js';
import { PERSONAS, LINES, fmt } from './market.js';
import { makeCamel, camelValue, capacity } from './camels.js';
import { add, addStat, has, remove } from './inventory.js';
import { mulberry32, hashString, pick, randInt } from './util.js';

function line(rng, key, vars = {}) {
  let s = pick(rng, LINES[key]);
  for (const [k, v] of Object.entries(vars)) s = s.replace('{' + k + '}', typeof v === 'number' ? fmt(v) : v);
  return s;
}

function round(n) {
  if (n >= 10000) return Math.round(n / 500) * 500;
  if (n >= 1000) return Math.round(n / 50) * 50;
  return Math.max(1, Math.round(n));
}

export function sheepPrice(sh) {
  return round(SHEEP_BREEDS[sh.breed].base * (sh.ageDays >= 2 ? 1 : 0.6));
}

export function farmState(state, id) {
  state.farms = state.farms || {};
  if (!state.farms[id]) state.farms[id] = { owned: false, day: -1, stock: [], animals: [], sale: null, storage: {}, lastIncomeDay: null };
  const f = state.farms[id];
  if (f.aff == null) f.aff = 0;
  return f;
}

// ---------- المودّة ----------
// كل ما سلّمت طلبات الجار تزيد المودّة، ومعها خصم على بضاعته وحلاله ومزرعته
export const AFF_LEVELS = [
  { at: 0, id: 'stranger', name: 'غريب', icon: '🙂', discount: 0 },
  { at: 20, id: 'known', name: 'معروف', icon: '🤝', discount: 0.05 },
  { at: 50, id: 'friend', name: 'صديق', icon: '😊', discount: 0.10 },
  { at: 80, id: 'brother', name: 'أخو', icon: '❤️', discount: 0.15 },
];
export const ANGER_AFF = 3;

export function affinityLevel(aff = 0) {
  let i = 0;
  for (let k = 0; k < AFF_LEVELS.length; k++) if (aff >= AFF_LEVELS[k].at) i = k;
  const L = AFF_LEVELS[i];
  return { ...L, index: i, next: AFF_LEVELS[i + 1] || null };
}

// يطبّق خصم المودّة على الصفقات المفتوحة (ولو تغيّر المستوى يعدّلها)
export function applyDiscount(f) {
  const disc = affinityLevel(f.aff).discount;
  const deals = [...(f.stock || []), ...(f.animals || []), ...(f.sale ? [f.sale] : [])];
  for (const d of deals) {
    if (d.closed) continue;
    const was = d.disc || 0;
    if (was === disc) continue;
    const k = (1 - disc) / (1 - was);
    // نحفظ السعر بدون تقريب عشان لو رجع الخصم يرجع السعر نفسه بالضبط (إلا إذا تساومتوا بالنص)
    if (d.rawAsk == null || round(d.rawAsk) !== d.ask) d.rawAsk = d.ask;
    if (d.rawMin == null || round(d.rawMin) !== d.min) d.rawMin = d.min;
    d.rawAsk *= k; d.rawMin *= k;
    d.ask = round(d.rawAsk);
    d.min = round(d.rawMin);
    d.disc = disc;
    d.bonusPatience = disc >= 0.15 ? 1 : 0;
  }
}

// زعل من المساومة: المودّة تنقص شوي
export function offend(state, farmId) {
  const f = farmState(state, farmId);
  f.aff = Math.max(0, f.aff - ANGER_AFF);
  applyDiscount(f);
  return f.aff;
}

// ---------- طلبات الجيران ----------
// كل جار يطلب أشياء تناسب شغله (وأنت تقدر تنتجها)
export const REQUEST_POOL = {
  abu_rashid: ['wheat', 'corn', 'rope', 'water', 'herb', 'carrot'],
  umm_saad: ['tomato', 'egg', 'carrot', 'flour', 'dates', 'onion'],
  sheikh_falih: ['coffee', 'jar', 'brick', 'lantern', 'milk', 'cucumber'],
  bu_nasser: ['wood', 'stone', 'plank', 'water', 'egg', 'rope'],
  harbi: ['wool', 'bread', 'milk', 'dates', 'onion', 'eggplant'],
};

// الغرض يطلع بالطلب بس إذا تقدر توصل له بمستواك ومبانيك
export function canSupply(state, item) {
  const seed = Object.values(SEEDS).find(d => d.crop === item);
  if (seed && seed.level && (state.player.level || 1) < seed.level) return false;
  if (item === 'egg') return !!state.built.coop;
  if (item === 'jar' || item === 'brick' || item === 'lantern') return !!state.built.kiln;
  if (item === 'flour') return !!state.built.mill;
  if (item === 'bread') return !!state.tech.t_bread;
  if (item === 'milk') return !!state.built.stable;
  if (item === 'wool') return !!state.built.sheepfold;
  return !!ITEMS[item];
}

// طلب اليوم لجار (ثابت لنفس اليوم والبذرة)
export function ensureRequest(state, id, day) {
  const f = farmState(state, id);
  if (f.owned) { f.request = null; return null; }
  if (f.request && f.request.day === day) return f.request;
  const rng = mulberry32(hashString(`req:${id}:${state.seed}:${day}`));
  const pool = (REQUEST_POOL[id] || ['water']).filter(it => canSupply(state, it));
  const item = pool.length ? pick(rng, pool) : 'water';
  const price = ITEMS[item].price;
  const qty = Math.max(2, Math.min(12, Math.round((25 + rng() * 30) / price)));
  const coins = Math.round(qty * price * 1.8 + 10);
  const aff = randInt(rng, 8, 15);
  const goods = FARMS[id].goods;
  const bonus = rng() < 0.3 ? { [goods[Math.floor(rng() * goods.length)]]: randInt(rng, 1, 3) } : null;
  f.request = { day, item, qty, coins, aff, bonus, done: false };
  return f.request;
}

// تسلّم الطلب: ياخذ الأغراض (من الحقيبة والصناديق) ويعطيك الجايزة والمودّة
export function fulfillRequest(state, farmId) {
  const f = farmState(state, farmId);
  const r = f.request;
  if (!r || r.done || f.owned) return { ok: false, reason: 'ما عنده طلب الحين' };
  if (!has(state, { [r.item]: r.qty })) return { ok: false, reason: `ناقصك ${ITEMS[r.item].name}` };
  remove(state, { [r.item]: r.qty });
  state.player.coins += r.coins;
  addStat(state, 'coinsEarned', r.coins);
  if (r.bonus) for (const [k, n] of Object.entries(r.bonus)) add(state, k, n);
  const before = affinityLevel(f.aff).index;
  f.aff = Math.min(100, f.aff + r.aff);
  const after = affinityLevel(f.aff);
  r.done = true;
  addStat(state, 'requests', 1);
  applyDiscount(f);
  return { ok: true, coins: r.coins, aff: r.aff, bonus: r.bonus, levelUp: after.index > before ? after : null };
}

// صفقة جديدة (بياع يطلب ask، وأقل شي يقبله min)
function deal(value, persona, rng, askMul = null) {
  const P = PERSONAS[persona];
  return { value, persona, ask: round(value * (askMul || P.askMul) * (0.95 + rng() * 0.12)), min: round(value * P.minMul), rounds: 0, log: [], closed: false, angry: false };
}

// يجدد بضاعة المزرعة وحلالها مرة كل يوم لعبة
export function refreshFarm(state, id, day) {
  const f = farmState(state, id);
  ensureRequest(state, id, day);
  if (f.day === day || f.owned) { applyDiscount(f); return f; }
  const def = FARMS[id];
  const rng = mulberry32(hashString(`farm:${id}:${state.seed}:${day}`));
  f.day = day;
  f.stock = def.goods.map((item, i) => ({
    id: `${id}_g${i}`, item, qty: randInt(rng, 3, 10),
    ...deal(ITEMS[item].price, def.persona, rng, 1.25),
  }));
  f.animals = [];
  for (let i = 0; i < def.camels; i++) {
    const cam = makeCamel({ camelSeq: day * 10 + i }, rng, { ageDays: randInt(rng, 1, 8), breed: def.breed || undefined });
    f.animals.push({ id: `${id}_c${day}_${i}`, kind: 'camel', camel: cam, ...deal(camelValue(cam), def.persona, rng) });
  }
  for (let i = 0; i < def.sheep; i++) {
    const sh = { breed: pick(rng, Object.keys(SHEEP_BREEDS)), ageDays: randInt(rng, 0, 5), fedDay: null, wateredDay: null, shornDay: -99 };
    f.animals.push({ id: `${id}_s${day}_${i}`, kind: 'sheep', sheep: sh, ...deal(sheepPrice(sh), def.persona, rng) });
  }
  if (!f.sale) f.sale = deal(def.price, def.persona, rng, 1.35);
  applyDiscount(f);
  return f;
}

// تساوم على صفقة (أنت المشتري). ترجع accept / counter / leave
export function haggle(d, price, rng) {
  if (d.closed) return { result: 'gone' };
  if (d.angry) return { result: 'leave' };
  price = Math.round(price);
  d.log.push({ who: 'me', text: `أعطيك ${fmt(price)}` });
  if (price >= d.min || price >= d.ask) {
    d.ask = Math.min(price, d.ask);
    d.log.push({ who: 'them', text: line(rng, 'accept') });
    return { result: 'accept', amount: d.ask };
  }
  d.rounds += 1;
  const P = PERSONAS[d.persona];
  if (price < d.value * 0.45) d.rounds += 1;
  if (d.rounds > P.patience + (d.bonusPatience || 0)) {
    d.angry = true;
    d.log.push({ who: 'them', text: line(rng, 'leave') });
    return { result: 'leave' };
  }
  const next = round(Math.max(d.min, d.ask - (d.ask - price) * P.step));
  const isFinal = next <= d.min || d.rounds === P.patience + (d.bonusPatience || 0);
  d.ask = Math.min(d.ask, next);
  d.log.push({ who: 'them', text: price < d.value * 0.45 ? line(rng, 'insult') + ' ' + line(rng, 'counter', { x: d.ask }) : line(rng, isFinal ? 'final' : 'counter', { x: d.ask }) });
  return { result: 'counter', amount: d.ask, final: isFinal };
}

// الشراء بالسعر المتفق عليه (d.ask)
export function buyGoods(state, farmId, dealId, qty = null) {
  const f = farmState(state, farmId);
  const d = f.stock.find(x => x.id === dealId);
  if (!d || d.closed || d.qty < 1) return { result: 'gone' };
  const n = Math.min(qty || d.qty, d.qty);
  const cost = d.ask * n;
  if (state.player.coins < cost) return { result: 'poor' };
  state.player.coins -= cost;
  add(state, d.item, n);
  d.qty -= n;
  if (d.qty <= 0) d.closed = true;
  addStat(state, 'npcBuys', 1);
  return { result: 'bought', price: cost, qty: n };
}

export function buyAnimal(state, farmId, dealId) {
  const f = farmState(state, farmId);
  const d = f.animals.find(x => x.id === dealId);
  if (!d || d.closed) return { result: 'gone' };
  if (state.player.coins < d.ask) return { result: 'poor' };
  if (d.kind === 'camel') {
    if (!state.built.stable) return { result: 'nostable' };
    if (state.camels.length >= capacity(state)) return { result: 'full' };
    state.player.coins -= d.ask;
    state.camelSeq = (state.camelSeq || 0) + 1;
    state.camels.push({ ...d.camel, id: 'c' + state.camelSeq + '_f', fedDay: null, wateredDay: null, milkedDay: null, pregnant: null });
  } else {
    if (!state.built.sheepfold) return { result: 'nofold' };
    if (state.sheep.length >= SHEEP_CAP + sheepCapBonus(state)) return { result: 'full' };
    state.player.coins -= d.ask;
    state.sheepSeq = (state.sheepSeq || 0) + 1;
    state.sheep.push({ ...d.sheep, id: 's' + state.sheepSeq + '_f' });
  }
  d.closed = true;
  // الحلال الجديد يمشي من طريق القرية للمراح أول ما ترجع مزرعتك
  state.arrivals = state.arrivals || [];
  state.arrivals.push(d.kind === 'camel' ? state.camels[state.camels.length - 1].id : state.sheep[state.sheep.length - 1].id);
  addStat(state, 'npcBuys', 1);
  return { result: 'bought', price: d.ask, kind: d.kind };
}

// أنت تبيع حلالك لصاحب المزرعة: يعطيك عرض، وتساوم عليه
export function sellOffer(state, farmId, kind, animalId, rng) {
  const def = FARMS[farmId];
  const P = PERSONAS[def.persona];
  const list = kind === 'camel' ? state.camels : state.sheep;
  const a = list.find(x => x.id === animalId);
  if (!a) return null;
  const value = kind === 'camel' ? camelValue(a) : sheepPrice(a);
  const maxPay = round(value * P.maxMul * (a.rare ? 1.2 : 1));
  return { farmId, kind, animalId, value, maxPay, amount: round(value * (0.6 + rng() * 0.2)), persona: def.persona, rounds: 0, log: [{ who: 'them', text: line(rng, a.rare ? 'openRare' : 'open', { n: a.name || 'حلالك', x: round(value * 0.7) }) }], closed: false };
}

export function counterSell(o, price, rng) {
  price = Math.round(price);
  o.log.push({ who: 'me', text: `أبيها بـ ${fmt(price)}` });
  if (price <= o.maxPay) {
    o.amount = price;
    o.log.push({ who: 'them', text: line(rng, 'accept') });
    return { result: 'accept', amount: price };
  }
  o.rounds += 1;
  const P = PERSONAS[o.persona];
  if (o.rounds > P.patience) { o.closed = true; o.log.push({ who: 'them', text: line(rng, 'leave') }); return { result: 'leave' }; }
  o.amount = Math.max(o.amount, round(Math.min(o.maxPay, o.amount + (price - o.amount) * P.step)));
  o.log.push({ who: 'them', text: line(rng, 'counter', { x: o.amount }) });
  return { result: 'counter', amount: o.amount };
}

export function completeSell(state, o) {
  if (o.closed) return null;
  const list = o.kind === 'camel' ? 'camels' : 'sheep';
  const a = state[list].find(x => x.id === o.animalId);
  if (!a) return null;
  state[list] = state[list].filter(x => x.id !== o.animalId);
  if (o.kind === 'camel' && state.market) {
    state.market.myListings = state.market.myListings.filter(l => l.camelId !== o.animalId);
    state.market.offers = state.market.offers.filter(x => x.camelId !== o.animalId);
  }
  state.player.coins += o.amount;
  addStat(state, 'coinsEarned', o.amount);
  addStat(state, 'npcSales', 1);
  o.closed = true;
  return { price: o.amount };
}

// ---------- شراء المزرعة ----------
export function buyFarm(state, farmId) {
  const f = farmState(state, farmId);
  if (f.owned || !f.sale || f.sale.closed) return { result: 'gone' };
  if (state.player.coins < f.sale.ask) return { result: 'poor' };
  state.player.coins -= f.sale.ask;
  const price = f.sale.ask;
  f.owned = true;
  f.sale.closed = true;
  f.stock = [];
  f.animals = [];
  f.lastIncomeDay = state.time.day;
  addStat(state, 'farmsOwned', 1);
  return { result: 'bought', price };
}

// كل يوم لعبة المزارع اللي تملكها تنتج بمخزنها
export function farmDaily(state, day) {
  const out = [];
  for (const [id, def] of Object.entries(FARMS)) {
    const f = state.farms && state.farms[id];
    if (!f || !f.owned || f.lastIncomeDay >= day) continue;
    const days = Math.min(3, day - (f.lastIncomeDay || day));
    f.lastIncomeDay = day;
    const mul = farmMul(f);
    for (const [item, n] of Object.entries(def.produce)) f.storage[item] = Math.min(storageCap(f), (f.storage[item] || 0) + Math.round(n * mul) * days);
    f.storage.coins = Math.min(Math.round(def.income * mul) * 5, (f.storage.coins || 0) + Math.round(def.income * mul) * days);
    out.push(id);
  }
  return out;
}

// تطوير المزرعة: كل مستوى يزيد الإنتاج 50% والمخزن يكبر
export const FARM_MAX_LEVEL = 4;
export function farmLevel(f) { return f.level || 1; }
export function farmMul(f) { return 1 + 0.5 * (farmLevel(f) - 1); }
export function storageCap(f) { return 60 + 30 * (farmLevel(f) - 1); }
export function upgradeCost(farmId, f) {
  return round(FARMS[farmId].price * 0.35 * farmLevel(f));
}
export function dailyYield(farmId, f) {
  const def = FARMS[farmId], mul = farmMul(f);
  return { coins: Math.round(def.income * mul), items: Object.fromEntries(Object.entries(def.produce).map(([k, n]) => [k, Math.round(n * mul)])) };
}
export function upgradeFarm(state, farmId) {
  const f = farmState(state, farmId);
  if (!f.owned) return { result: 'notowned' };
  if (farmLevel(f) >= FARM_MAX_LEVEL) return { result: 'max' };
  const cost = upgradeCost(farmId, f);
  if (state.player.coins < cost) return { result: 'poor', cost };
  state.player.coins -= cost;
  f.level = farmLevel(f) + 1;
  addStat(state, 'farmUpgrades', 1);
  return { result: 'upgraded', level: f.level, cost };
}
export function storageValue(f) {
  return Object.entries(f.storage || {}).reduce((a, [k, v]) => a + (k === 'coins' ? v : (ITEMS[k] ? ITEMS[k].price * v : 0)), 0);
}
// استلام عن بعد من شاشة الإدارة: المندوب ياخذ 10% من الدراهم
export const COURIER_FEE = 0.1;
export function collectRemote(state, farmId) {
  const f = farmState(state, farmId);
  if (!f.owned) return null;
  const fee = Math.round((f.storage.coins || 0) * COURIER_FEE);
  if (f.storage.coins) f.storage.coins -= fee;
  const got = collectStorage(state, farmId);
  return { got, fee };
}

export function collectStorage(state, farmId) {
  const f = farmState(state, farmId);
  const got = { ...f.storage };
  if (got.coins) { state.player.coins += got.coins; addStat(state, 'coinsEarned', got.coins); }
  for (const [k, v] of Object.entries(got)) if (k !== 'coins' && v > 0) add(state, k, v);
  f.storage = {};
  return got;
}
