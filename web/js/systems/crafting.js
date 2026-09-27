// الصناعة، البناء، شجرة المعرفة
import { RECIPES, BUILD_SPOTS } from '../data/recipes.js';
import { TECH_BY_ID } from '../data/tech.js';
import { has, remove, add, addStat } from './inventory.js';
import { stars } from './progression.js';

export function recipesFor(state, station) {
  return RECIPES.filter(r => r.station === station).map(r => ({
    ...r,
    locked: !!(r.tech && !state.tech[r.tech]),
    affordable: has(state, r.in),
  }));
}

export function canCraft(state, recipe) {
  if (recipe.tech && !state.tech[recipe.tech]) return false;
  return has(state, recipe.in);
}

export function craft(state, recipeId) {
  const r = RECIPES.find(x => x.id === recipeId);
  if (!r || !canCraft(state, r)) return null;
  remove(state, r.in);
  for (const [id, n] of Object.entries(r.out)) add(state, id, n);
  addStat(state, 'crafted', 1);
  addStat(state, 'craft_' + r.id, 1);
  for (const [t, n] of Object.entries(r.kp || {})) state.kp[t] = (state.kp[t] || 0) + n;
  return r;
}

export function spotStatus(state, spotId) {
  const s = BUILD_SPOTS[spotId];
  if (!s) return { ok: false, reason: 'غير معروف' };
  if (state.built[spotId]) return { ok: false, reason: 'مبني' };
  if (s.after && !state.built[s.after]) return { ok: false, reason: 'ابنِ ' + BUILD_SPOTS[s.after].name + ' أول', hidden: true };
  if (s.tech && !state.tech[s.tech]) return { ok: false, reason: 'تحتاج تتعلم: ' + TECH_BY_ID[s.tech].name, needTech: s.tech };
  if (s.flag && !questReached(state, s.flag)) return { ok: false, reason: 'زعبول بيقول لك متى', hidden: true };
  if (!has(state, s.cost)) return { ok: false, reason: 'المواد ناقصة' };
  return { ok: true };
}

// المواقع اللي تحتاج مرحلة من القصة
function questReached(state, flag) {
  if (flag === 'q_crypt') return !!state.flags.crypt_unlocked;
  return !!state.flags[flag];
}

export function build(state, spotId) {
  const st = spotStatus(state, spotId);
  if (!st.ok) return null;
  const s = BUILD_SPOTS[spotId];
  remove(state, s.cost);
  state.built[spotId] = true;
  addStat(state, 'built', 1);
  state.stats.stars = Math.max(state.stats.stars || 0, stars(state));
  return s;
}

export function techStatus(state, techId) {
  const t = TECH_BY_ID[techId];
  if (state.tech[techId]) return 'learned';
  if (!t.req.every(r => state.tech[r])) return 'locked';
  for (const [k, n] of Object.entries(t.cost)) if ((state.kp[k] || 0) < n) return 'poor';
  return 'ready';
}

export function learnTech(state, techId) {
  if (techStatus(state, techId) !== 'ready') return false;
  const t = TECH_BY_ID[techId];
  for (const [k, n] of Object.entries(t.cost)) state.kp[k] -= n;
  state.tech[techId] = true;
  return true;
}
