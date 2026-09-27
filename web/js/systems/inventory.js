import { BAG_CAPS } from '../data/buildings.js';
import { ITEMS } from '../data/items.js';

export function count(state, id) {
  return state.inv[id] || 0;
}

// كم منه بالصناديق (المخزن)
export function stored(state, id) {
  let n = 0;
  for (const c of Object.values(state.chests || {})) n += c.items[id] || 0;
  return n;
}

// الحقيبة + المخزن: البناء والصناعة ياخذون من الاثنين
export function total(state, id) {
  return count(state, id) + stored(state, id);
}

export function has(state, cost) {
  for (const [id, n] of Object.entries(cost)) {
    if (total(state, id) < n) return false;
  }
  return true;
}

export function add(state, id, n = 1) {
  state.inv[id] = count(state, id) + n;
  if (state.inv[id] <= 0) delete state.inv[id];
}

// ياخذ من الحقيبة أول، وبعدين من الصناديق
export function remove(state, cost) {
  if (!has(state, cost)) return false;
  for (const [id, n] of Object.entries(cost)) {
    const fromBag = Math.min(count(state, id), n);
    add(state, id, -fromBag);
    let rest = n - fromBag;
    for (const c of Object.values(state.chests || {})) {
      if (rest <= 0) break;
      const k = Math.min(c.items[id] || 0, rest);
      if (!k) continue;
      c.items[id] -= k;
      if (c.items[id] <= 0) delete c.items[id];
      rest -= k;
    }
  }
  return true;
}

export function addStat(state, key, n = 1) {
  state.stats[key] = (state.stats[key] || 0) + n;
}

export function stat(state, key) {
  return state.stats[key] || 0;
}

// ---------- سعة الحقيبة ----------
// البذور والتحف ما تاخذ مكان
export function counts(id) {
  return !!ITEMS[id] && !id.startsWith('seed_');
}

export function bagUsed(state) {
  let n = 0;
  for (const [id, k] of Object.entries(state.inv)) if (counts(id)) n += k;
  return n;
}

export function bagCap(state) {
  return BAG_CAPS[Math.min(BAG_CAPS.length - 1, state.bagLevel || 0)];
}

export function bagFree(state) {
  return Math.max(0, bagCap(state) - bagUsed(state));
}
