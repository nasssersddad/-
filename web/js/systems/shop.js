// التجارة زي Hay Day: البسطة، قافلة الطلبات، جريدة السوق
import { ITEMS } from '../data/items.js';
import { SHEEP_BREEDS } from '../data/sheep.js';
import { TRADER_NAMES } from './market.js';
import { add, count, addStat } from './inventory.js';
import { mulberry32, hashString, pick, randInt, clamp } from './util.js';

export const STALL_SLOTS = 6;
export const ORDER_SLOTS = 6;

export function emptyStall() {
  return { slots: Array(STALL_SLOTS).fill(null), seq: 0 };
}

export function unitValue(item) {
  return ITEMS[item] ? ITEMS[item].price : 0;
}

// سعر الغنم يتغير بالمواسم (عيد الأضحى يغليه). اللعبة تضبطه من الموسم الحالي
let sheepMul = 1;
export function setSheepMul(m) { sheepMul = m > 0 ? m : 1; }
export function getSheepMul() { return sheepMul; }

export function sheepValue(sh) {
  const b = SHEEP_BREEDS[sh.breed];
  return Math.round(b.base * (sh.ageDays >= 2 ? 1 : 0.6) * sheepMul);
}

// نطاق السعر المسموح بالبسطة
export function priceRange(base) {
  return { min: Math.max(1, Math.round(base * 0.5)), max: Math.round(base * 3.5), suggested: Math.max(1, Math.round(base * 1.3)) };
}

export function listItem(state, idx, item, qty, price) {
  const slot = state.stall.slots[idx];
  if (slot || qty < 1 || count(state, item) < qty || !ITEMS[item]) return false;
  const r = priceRange(unitValue(item) * qty);
  price = clamp(Math.round(price), r.min, r.max);
  add(state, item, -qty);
  state.stall.seq += 1;
  state.stall.slots[idx] = { id: 'S' + state.stall.seq, kind: 'item', item, qty, price, base: unitValue(item) * qty, sold: false };
  return true;
}

export function listSheep(state, idx, sheepId, price) {
  const slot = state.stall.slots[idx];
  const sh = state.sheep.find(s => s.id === sheepId);
  if (slot || !sh) return false;
  const base = sheepValue(sh);
  const r = priceRange(base);
  state.sheep = state.sheep.filter(s => s.id !== sheepId);
  state.stall.seq += 1;
  state.stall.slots[idx] = { id: 'S' + state.stall.seq, kind: 'sheep', sheep: sh, price: clamp(Math.round(price), r.min, r.max), base, sold: false };
  return true;
}

// احتمال البيع بالساعة حسب نسبة السعر للقيمة
export function sellChancePerHour(price, base) {
  const r = price / Math.max(1, base);
  return clamp(0.95 - (r - 1) * 0.38, 0.02, 0.97);
}

// minutes = دقايق لعبة عدّت. يرجع اللي انباع
export function stallTick(state, minutes, rng) {
  const sold = [];
  for (const s of state.stall.slots) {
    if (!s || s.sold) continue;
    const p = 1 - Math.pow(1 - sellChancePerHour(s.price, s.base), minutes / 60);
    if (rng() < p) {
      s.sold = true;
      s.buyer = pick(rng, TRADER_NAMES);
      sold.push(s);
    }
  }
  return sold;
}

export function collect(state, idx) {
  const s = state.stall.slots[idx];
  if (!s || !s.sold) return 0;
  state.player.coins += s.price;
  addStat(state, 'coinsEarned', s.price);
  addStat(state, 'stallSales', 1);
  state.stall.slots[idx] = null;
  return s.price;
}

export function unlistSlot(state, idx) {
  const s = state.stall.slots[idx];
  if (!s || s.sold) return false;
  if (s.kind === 'item') add(state, s.item, s.qty);
  else state.sheep.push(s.sheep);
  state.stall.slots[idx] = null;
  return true;
}

// ---------- قافلة الطلبات ----------
export function orderPool(state) {
  const pool = ['wood', 'stone', 'clay', 'frond', 'water', 'plank', 'rope', 'dates', 'coffee', 'herb'];
  if ((state.stats.planted || 0) > 0) pool.push('tomato', 'wheat');
  if (state.tech.t_brick) pool.push('brick');
  if (state.built.kiln) pool.push('jar');
  if (state.tech.t_bread) pool.push('bread', 'flour');
  if (state.built.stable) pool.push('milk', 'alfalfa');
  if (state.built.sheepfold) pool.push('wool');
  if (state.tech.t_melon) pool.push('melon');
  if (state.built.coop) pool.push('egg', 'egg');
  return pool;
}

export function makeOrder(state, rng, nowMin, delay = 0) {
  const pool = orderPool(state);
  const n = randInt(rng, 1, Math.min(3, 1 + Math.floor((state.player.level || 1) / 3)));
  const items = {};
  for (let i = 0; i < n; i++) {
    const it = pick(rng, pool);
    items[it] = (items[it] || 0) + randInt(rng, 2, ITEMS[it].price > 6 ? 4 : 8);
  }
  const value = Object.entries(items).reduce((s, [k, v]) => s + ITEMS[k].price * v, 0);
  state.orderSeq = (state.orderSeq || 0) + 1;
  return {
    id: 'R' + state.orderSeq, items,
    coins: Math.round(value * 1.7 + 10), xp: Math.max(4, Math.round(value / 4)),
    chest: rng() < 0.15 ? 'common' : null,
    readyAt: nowMin + delay,
  };
}

export function ensureOrders(state, rng, nowMin) {
  while (state.orders.length < ORDER_SLOTS) state.orders.push(makeOrder(state, rng, nowMin));
}

export function canFulfill(state, o, nowMin) {
  return nowMin >= o.readyAt && Object.entries(o.items).every(([k, v]) => count(state, k) >= v);
}

export function fulfill(state, id, rng, nowMin) {
  const i = state.orders.findIndex(o => o.id === id);
  if (i < 0) return null;
  const o = state.orders[i];
  if (!canFulfill(state, o, nowMin)) return null;
  for (const [k, v] of Object.entries(o.items)) add(state, k, -v);
  state.orders[i] = makeOrder(state, rng, nowMin, 60);
  addStat(state, 'ordersDone', 1);
  return { coins: o.coins, xp: o.xp, chest: o.chest || undefined };
}

export function discard(state, id, rng, nowMin) {
  const i = state.orders.findIndex(o => o.id === id);
  if (i < 0) return false;
  state.orders[i] = makeOrder(state, rng, nowMin, 30);
  return true;
}

// ---------- جريدة السوق: بسطات لاعبين افتراضيين ----------
export function newspaper(state, day) {
  if (state.paper && state.paper.day === day) return state.paper.list;
  const rng = mulberry32(hashString('paper:' + state.seed + ':' + day));
  const pool = orderPool(state).concat(['seed_wheat', 'seed_tomato', 'seed_alfalfa', 'beans', 'wool']);
  const list = [];
  for (let i = 0; i < 8; i++) {
    const item = pick(rng, pool);
    const qty = randInt(rng, 2, 8);
    list.push({ id: `P${day}_${i}`, seller: pick(rng, TRADER_NAMES), item, qty, price: Math.max(2, Math.round(ITEMS[item].price * qty * (0.7 + rng() * 0.9))), sold: false });
  }
  state.paper = { day, list };
  return list;
}

export function buyFromPaper(state, id) {
  const p = state.paper && state.paper.list.find(x => x.id === id && !x.sold);
  if (!p || state.player.coins < p.price) return false;
  state.player.coins -= p.price;
  add(state, p.item, p.qty);
  p.sold = true;
  addStat(state, 'paperBuys', 1);
  return true;
}
