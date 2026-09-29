// قن الدجاج: الدجاج يبيض كل كم ساعة إذا فيه أكل، والبيض يتجمع لين تستلمه
import { count, add, addStat } from './inventory.js';
import { typeLevel } from './placement.js';

export const LAY_EVERY = 120;      // دقايق لعب لكل بيضة (لكل دجاجة)
export const FEED_PER_ITEM = 240;  // كل وحدة أكل = دقايق أكل للقن كله
export const FEEDS = ['wheat', 'alfalfa', 'corn', 'seed_wheat', 'seed_alfalfa'];
export const HEN_PRICE = 60;
export const HEN_CAP = [6, 9, 12];
export const STARTER_HENS = 3;

export function coop(state) {
  state.coop = state.coop || { hens: 0, feedMin: 0, eggs: 0, last: null, acc: 0 };
  return state.coop;
}

export function henCap(state) {
  const lv = Math.max(1, typeLevel(state, 'coop'));
  return HEN_CAP[Math.min(HEN_CAP.length, lv) - 1];
}

export function eggCap(state) {
  return coop(state).hens * 4;
}

// أول ما ينبني القن: دجاج هدية
export function giftHens(state) {
  const c = coop(state);
  if (c.hens > 0 || state.flags.henGift) return false;
  state.flags.henGift = true;
  c.hens = STARTER_HENS;
  return true;
}

// يمشّي الوقت: الدجاج يبيض بس إذا فيه أكل، والأكل ينقص
export function coopTick(state, nowMin) {
  const c = coop(state);
  if (c.last == null) { c.last = nowMin; return 0; }
  const dt = Math.max(0, nowMin - c.last);
  c.last = nowMin;
  if (!c.hens || dt <= 0) return 0;
  const fed = Math.min(dt, c.feedMin);
  c.feedMin -= fed;
  c.acc = (c.acc || 0) + fed * c.hens;
  const laid = Math.floor(c.acc / LAY_EVERY);
  c.acc -= laid * LAY_EVERY;
  const room = Math.max(0, eggCap(state) - c.eggs);
  const n = Math.min(laid, room);
  c.eggs += n;
  if (c.eggs >= eggCap(state)) c.acc = 0;
  return n;
}

// يحط أكل من الحقيبة. يرجع كم وحدة حط
export function addFeed(state, item, n = 1) {
  if (!FEEDS.includes(item)) return 0;
  const k = Math.min(n, count(state, item));
  if (k <= 0) return 0;
  add(state, item, -k);
  coop(state).feedMin += k * FEED_PER_ITEM;
  addStat(state, 'henFeed', k);
  return k;
}

// أول أكل موجود بالحقيبة
export function feedItem(state) {
  return FEEDS.find(id => count(state, id) > 0) || null;
}

export function collectEggs(state) {
  const c = coop(state);
  const n = c.eggs;
  c.eggs = 0;
  if (n) addStat(state, 'eggs', n);
  return n;
}

export function buyHen(state) {
  const c = coop(state);
  if (c.hens >= henCap(state)) return { ok: false, reason: 'القن مليان، رقّه' };
  if (state.player.coins < HEN_PRICE) return { ok: false, reason: 'الدراهم ما تكفي' };
  state.player.coins -= HEN_PRICE;
  c.hens += 1;
  return { ok: true };
}

export function hungry(state) {
  const c = coop(state);
  return c.hens > 0 && c.feedMin <= 0;
}
