// الخبرة والمستوى والقيم المشتقة (الطاقة القصوى، النجوم...)
import { BUILD_SPOTS, STAR_THRESHOLDS } from '../data/recipes.js';
import { RELICS, RELIC_SETS } from '../data/items.js';

// ---------- الصعوبة ----------
// المرحلة ترتفع كل 5 مستويات ومع كل نجمة للخان، وكل شي يصعب معها
export function stage(state) {
  return Math.floor((state.player.level || 1) / 5) + stars(state);
}

export function difficulty(st) {
  return 1 + 0.25 * st;
}

// المكافآت تزيد مع المرحلة بس أبطأ من الصعوبة
export function rewardScale(st) {
  return 1 + 0.12 * st;
}

export function xpForLevel(level) {
  return Math.round(30 * Math.pow(1.18, level - 1) + level * 10);
}

export function levelReward(level) {
  const r = { coins: 10 * level, energy: 'full' };
  if (level % 10 === 0) r.chest = level % 20 === 0 ? 'legendary' : 'rare';
  else if (level % 3 === 0) r.kp = { c: 1, n: 1, s: 1 };
  return r;
}

// ترجع قائمة المستويات الجديدة
export function addXp(state, amount) {
  const p = state.player;
  p.xp += amount;
  const ups = [];
  while (p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level += 1;
    ups.push(p.level);
  }
  if (ups.length) state.stats.level = p.level;
  return ups;
}

export function completedSets(state) {
  const bySet = {};
  for (const [id, r] of Object.entries(RELICS)) {
    bySet[r.set] = bySet[r.set] || [];
    bySet[r.set].push(id);
  }
  return Object.keys(RELIC_SETS).filter(set => bySet[set].every(id => state.relics[id]));
}

function setEffect(state, key) {
  return completedSets(state).reduce((s, set) => s + (RELIC_SETS[set].effect[key] || 0), 0);
}

export function maxEnergy(state) {
  return 100 + (state.tech.t_stamina ? 25 : 0) + setEffect(state, 'maxEnergy');
}

export function maxHp(state) {
  return 10 + (state.tech.t_armor ? 4 : 0) + setEffect(state, 'maxHp');
}

export function attackPower(state) {
  return 1 + (state.tech.t_staff ? 1 : 0) + Math.floor(state.player.level / 8);
}

export function coinMultiplier(state) {
  return 1 + (state.tech.t_hospitality ? 0.25 : 0) + (state.built.majlis ? 0.15 : 0) + setEffect(state, 'coinMul');
}

export function offlineMultiplier(state) {
  return 1 + setEffect(state, 'offlineMul');
}

export function rating(state) {
  let r = 0;
  for (const id of Object.keys(state.built)) r += (BUILD_SPOTS[id] && BUILD_SPOTS[id].rating) || 0;
  return r;
}

export function stars(state) {
  const r = rating(state);
  let s = 0;
  for (let i = 0; i < STAR_THRESHOLDS.length; i++) if (r >= STAR_THRESHOLDS[i]) s = i;
  return s;
}

export function roomsBuilt(state) {
  return Object.keys(state.built).filter(id => BUILD_SPOTS[id] && BUILD_SPOTS[id].room).length;
}

export function nextStarAt(state) {
  const s = stars(state);
  return s >= STAR_THRESHOLDS.length - 1 ? null : STAR_THRESHOLDS[s + 1];
}
