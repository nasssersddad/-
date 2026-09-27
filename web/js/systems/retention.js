// أنظمة الرجوع للعبة: المكافأة اليومية، المهام اليومية، العجلة، أرباح الغياب، سقف الإعلانات، الإنجازات
import { DAILY_CALENDAR, DAILY_QUEST_POOL, WHEEL, AD_DAILY_CAP, ACHIEVEMENTS, ACH_TIER_REWARDS } from '../data/rewards.js';
import { dateKey, dayDiff, mulberry32, hashString, randInt, weightedIndex } from './util.js';
import { stars, roomsBuilt, offlineMultiplier, stage, difficulty, rewardScale } from './progression.js';
import { STREAK_LEGENDARY_EVERY } from '../data/rewards.js';

// ---------- المكافأة اليومية ----------
// ترجع { available, dayIndex (0..6), streak, broken }
export function dailyStatus(state, now) {
  const today = dateKey(now);
  const d = state.daily;
  if (d.lastClaim === today) {
    return { available: false, dayIndex: (d.streak - 1) % 7, streak: d.streak, broken: false };
  }
  const gap = d.lastClaim ? dayDiff(d.lastClaim, today) : null;
  const continues = gap === 1;
  const streak = continues ? d.streak + 1 : 1;
  return { available: true, dayIndex: (streak - 1) % 7, streak, broken: !!d.lastClaim && !continues };
}

export function claimDaily(state, now) {
  const st = dailyStatus(state, now);
  if (!st.available) return null;
  state.daily.lastClaim = dateKey(now);
  state.daily.streak = st.streak;
  const reward = st.streak % STREAK_LEGENDARY_EVERY === 0 ? { chest: 'legendary', label: 'صندوق أسطوري' } : DAILY_CALENDAR[st.dayIndex];
  return { reward, dayIndex: st.dayIndex, streak: st.streak };
}

// ---------- المهام اليومية ----------
export function ensureDailyQuests(state, now) {
  const today = dateKey(now);
  if (state.daily.dqDate === today && state.daily.dq.length) return false;
  const rng = mulberry32(hashString(today + ':' + state.seed));
  const pool = DAILY_QUEST_POOL.filter(q => (q.id !== 'enemy' || state.built.crypt_door) && (!q.needs || state.built[q.needs]));
  const chosen = [];
  while (chosen.length < 3 && pool.length) {
    const i = Math.floor(rng() * pool.length);
    chosen.push(pool.splice(i, 1)[0]);
  }
  const st = stage(state);
  const lvlMul = difficulty(st);
  const payMul = rewardScale(st);
  state.daily.dq = chosen.map(q => {
    const n = Math.max(1, Math.round(randInt(rng, q.range[0], q.range[1]) * lvlMul));
    return {
      id: q.id, stat: q.stat, name: q.name.replace('{n}', n), target: n,
      base: state.stats[q.stat] || 0, claimed: false,
      reward: { coins: Math.round(q.coins * payMul), xp: Math.round(8 * payMul) },
    };
  });
  state.daily.dqDate = today;
  state.daily.dqBonus = false;
  return true;
}

export function dqProgress(state, q) {
  return Math.min(q.target, (state.stats[q.stat] || 0) - q.base);
}

export function claimDailyQuest(state, idx) {
  const q = state.daily.dq[idx];
  if (!q || q.claimed || dqProgress(state, q) < q.target) return null;
  q.claimed = true;
  return q.reward;
}

export function dqBonusReady(state) {
  return state.daily.dq.length > 0 && !state.daily.dqBonus && state.daily.dq.every(q => q.claimed);
}

// ---------- عجلة الحظ ----------
export function wheelStatus(state, now) {
  const today = dateKey(now);
  if (state.daily.wheelDate !== today) {
    state.daily.wheelDate = today;
    state.daily.freeSpin = true;
    state.daily.adSpins = 0;
  }
  return { free: state.daily.freeSpin, adSpinsLeft: Math.max(0, 2 - state.daily.adSpins) };
}

// kind: 'free' | 'ad'. يرجع رقم الخانة
export function spinWheel(state, now, rng, kind = 'free') {
  const st = wheelStatus(state, now);
  if (kind === 'free') {
    if (!st.free) return null;
    state.daily.freeSpin = false;
  } else {
    if (st.adSpinsLeft <= 0) return null;
    state.daily.adSpins += 1;
  }
  const idx = weightedIndex(rng, WHEEL);
  return { index: idx, reward: WHEEL[idx].reward };
}

// ---------- أرباح الغياب ----------
export const OFFLINE_CAP_HOURS = 6;
export function offlineRatePerHour(state) {
  return Math.round((6 + stars(state) * 10 + roomsBuilt(state) * 7) * offlineMultiplier(state));
}

export function offlineEarnings(state, now) {
  const away = Math.max(0, now - (state.lastSeen || now));
  const minutes = away / 60000;
  if (minutes < 5) return null;
  const hours = Math.min(OFFLINE_CAP_HOURS, minutes / 60);
  const coins = Math.floor(hours * offlineRatePerHour(state));
  if (coins < 1) return null;
  return { coins, hours, capped: minutes / 60 >= OFFLINE_CAP_HOURS };
}

// ---------- الإعلانات ----------
export function adsLeft(state, now) {
  const today = dateKey(now);
  if (state.daily.adsDate !== today) {
    state.daily.adsDate = today;
    state.daily.adsCount = 0;
  }
  return Math.max(0, AD_DAILY_CAP - state.daily.adsCount);
}

export function consumeAd(state, now) {
  if (adsLeft(state, now) <= 0) return false;
  state.daily.adsCount += 1;
  return true;
}

// ---------- الإنجازات ----------
// ترجع الإنجازات اللي تقدر تستلمها
export function claimableAchievements(state) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    const got = state.ach[a.stat] || 0;
    if (got < a.tiers.length && (state.stats[a.stat] || 0) >= a.tiers[got]) {
      out.push({ ach: a, tier: got });
    }
  }
  return out;
}

export function claimAchievement(state, stat) {
  const a = ACHIEVEMENTS.find(x => x.stat === stat);
  if (!a) return null;
  const got = state.ach[stat] || 0;
  if (got >= a.tiers.length || (state.stats[stat] || 0) < a.tiers[got]) return null;
  state.ach[stat] = got + 1;
  return { tier: got, reward: ACH_TIER_REWARDS[got] };
}

// عدد الأشياء اللي تنتظر استلام (للنقطة الحمراء)
export function pendingRewardsCount(state, now) {
  let n = 0;
  if (dailyStatus(state, now).available) n++;
  if (wheelStatus(state, now).free) n++;
  n += state.daily.dq.filter(q => !q.claimed && dqProgress(state, q) >= q.target).length;
  if (dqBonusReady(state)) n++;
  n += claimableAchievements(state).length;
  return n;
}
