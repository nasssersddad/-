// تطبيق المكافآت وفتح الصناديق. كل دالة ترجع قائمة "مكاسب" للواجهة
import { CHESTS, CHEST_ITEMS, CHEST_RARITY } from '../data/rewards.js';
import { ITEMS, RELICS, itemIcon, itemName } from '../data/items.js';
import { KP_TYPES } from '../data/tech.js';
import { add, addStat } from './inventory.js';
import { addXp, maxEnergy, levelReward } from './progression.js';
import { randInt, pick, weightedIndex } from './util.js';

export function rollChestRarity(rng) {
  return CHEST_RARITY[weightedIndex(rng, CHEST_RARITY)].rarity;
}

// يولّد محتوى صندوق بدون ما يطبقه
export function rollChest(state, rarity, rng) {
  const def = CHESTS[rarity];
  const out = { coins: randInt(rng, def.coins[0], def.coins[1]), items: {}, kp: {} };
  for (let i = 0; i < def.items; i++) {
    const id = pick(rng, CHEST_ITEMS);
    const cheap = ITEMS[id].price <= 4;
    out.items[id] = (out.items[id] || 0) + (cheap ? randInt(rng, 3, 6) : randInt(rng, 1, 2));
  }
  const types = Object.keys(KP_TYPES);
  for (let i = 0; i < def.kp; i++) {
    const t = pick(rng, types);
    out.kp[t] = (out.kp[t] || 0) + 1;
  }
  if (rng() < def.relic) {
    const missing = Object.keys(RELICS).filter(id => !state.relics[id] && RELICS[id].set !== 'salem');
    if (missing.length) out.relic = pick(rng, missing);
    else out.coins += 100;
  }
  return out;
}

export function doubleReward(r) {
  const d = { ...r };
  if (d.coins) d.coins *= 2;
  if (d.items) d.items = Object.fromEntries(Object.entries(d.items).map(([k, v]) => [k, v * 2]));
  if (d.kp) d.kp = Object.fromEntries(Object.entries(d.kp).map(([k, v]) => [k, v * 2]));
  return d;
}

// يطبق مكافأة. ctx.rng مطلوب للصناديق. يرجع { gains, levelUps, chests:[{rarity, contents}] }
export function applyReward(state, reward, rng, ctx = { depth: 0 }) {
  const res = { gains: [], levelUps: [], chests: [] };
  if (!reward) return res;
  if (reward.coins) {
    state.player.coins += reward.coins;
    addStat(state, 'coinsEarned', reward.coins);
    res.gains.push({ icon: '🪙', text: `+${reward.coins}`, kind: 'coins' });
  }
  if (reward.items) {
    for (const [id, n] of Object.entries(reward.items)) {
      add(state, id, n);
      res.gains.push({ icon: itemIcon(id), text: `${itemName(id)} ×${n}`, kind: 'item' });
    }
  }
  if (reward.kp) {
    for (const [t, n] of Object.entries(reward.kp)) {
      if (!n) continue;
      state.kp[t] = (state.kp[t] || 0) + n;
      res.gains.push({ icon: KP_TYPES[t].icon, text: `${KP_TYPES[t].name} +${n}`, kind: 'kp' });
    }
  }
  if (reward.energy) {
    state.player.energy = maxEnergy(state);
    res.gains.push({ icon: '⚡', text: 'طاقة كاملة', kind: 'energy' });
  }
  if (reward.relic) {
    const id = reward.relic;
    if (!state.relics[id]) {
      state.relics[id] = true;
      addStat(state, 'relics', 1);
      res.gains.push({ icon: RELICS[id].icon, text: `تحفة: ${RELICS[id].name}`, kind: 'relic', id });
    }
  }
  if (reward.chest && ctx.depth < 2) {
    const contents = rollChest(state, reward.chest, rng);
    addStat(state, 'chests', 1);
    const inner = applyReward(state, contents, rng, { depth: ctx.depth + 1 });
    res.chests.push({ rarity: reward.chest, contents, gains: inner.gains });
    res.levelUps.push(...inner.levelUps);
  }
  if (reward.xp) {
    res.gains.push({ icon: '✨', text: `خبرة +${reward.xp}`, kind: 'xp' });
    const ups = addXp(state, reward.xp);
    for (const lv of ups) {
      res.levelUps.push(lv);
      const lr = applyReward(state, levelReward(lv), rng, { depth: ctx.depth + 1 });
      res.chests.push(...lr.chests);
      res.levelGains = (res.levelGains || []).concat(lr.gains);
    }
  }
  return res;
}

// وصف مكافأة قبل استلامها (للعرض)
export function describeReward(r) {
  const out = [];
  if (!r) return out;
  if (r.coins) out.push({ icon: '🪙', text: `${r.coins} درهم` });
  if (r.items) for (const [id, n] of Object.entries(r.items)) out.push({ icon: itemIcon(id), text: `${itemName(id)} ×${n}` });
  if (r.kp) for (const [t, n] of Object.entries(r.kp)) if (n) out.push({ icon: KP_TYPES[t].icon, text: `${KP_TYPES[t].name} +${n}` });
  if (r.energy) out.push({ icon: '⚡', text: 'طاقة كاملة' });
  if (r.relic) out.push({ icon: RELICS[r.relic].icon, text: RELICS[r.relic].name });
  if (r.chest) out.push({ icon: r.chest === 'legendary' ? '👑' : r.chest === 'rare' ? '💎' : '📦', text: CHESTS[r.chest].name });
  if (r.xp) out.push({ icon: '✨', text: `خبرة +${r.xp}` });
  return out;
}
