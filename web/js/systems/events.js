// نظام الفعاليات: التدوير، العملة، مسار الجوايز، الترتيب، ونتائج الألعاب الصغيرة
import { EVENTS, EVENT_DAYS, EVENT_OFFSET, TRACK_COSTS, TRACK_REWARDS, DAILY_PLAYS, AD_PLAYS } from '../data/events.js';
import { TRADER_NAMES } from './market.js';
import { dateKey, mulberry32, hashString, clamp } from './util.js';
import { add, count, addStat } from './inventory.js';
import { stage, rewardScale } from './progression.js';

const DAY = 86400000;

function dayNumber(now) {
  const d = new Date(now);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

export function currentEvent(now) {
  const n = dayNumber(now);
  const slot = Math.floor(n / EVENT_DAYS);
  const def = EVENTS[(((slot + EVENT_OFFSET) % EVENTS.length) + EVENTS.length) % EVENTS.length];
  const d = new Date(now);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const endMs = midnight + (EVENT_DAYS - (n % EVENT_DAYS)) * DAY;
  return { def, key: `${def.id}:${slot}`, endMs };
}

export function ensureEvent(state, now) {
  const cur = currentEvent(now);
  if (!state.event || state.event.key !== cur.key) {
    state.event = { key: cur.key, id: cur.def.id, tokens: 0, earned: 0, claimed: 0, plays: {}, adPlays: {}, spots: {}, day: null };
  }
  return cur;
}

export function mod(state, now, name) {
  const cur = currentEvent(now);
  return cur.def.mods ? cur.def.mods[name] : undefined;
}

export function addTokens(state, n) {
  if (!state.event || n <= 0) return 0;
  state.event.tokens += n;
  state.event.earned += n;
  addStat(state, 'eventTokens', n);
  return n;
}

// كم عملة تحتاج للدرجة i (تصعب مع المرحلة)
export function tierCost(state, i) {
  const st = stage(state);
  return Math.round(TRACK_COSTS[i] * (1 + 0.1 * st));
}

export function nextTier(state) {
  return state.event ? state.event.claimed : 0;
}

export function canClaimTier(state) {
  const i = nextTier(state);
  return i < TRACK_COSTS.length && state.event.tokens >= tierCost(state, i);
}

export function claimTier(state) {
  if (!canClaimTier(state)) return null;
  const i = state.event.claimed;
  state.event.tokens -= tierCost(state, i);
  state.event.claimed += 1;
  const r = { ...TRACK_REWARDS[i] };
  const sc = rewardScale(stage(state));
  if (r.coins) r.coins = Math.round(r.coins * sc);
  if (state.event.claimed === TRACK_COSTS.length) addStat(state, 'eventsCompleted', 1);
  return { tier: i, reward: r };
}

// ---------- محاولات الألعاب الصغيرة ----------
export function playsLeft(state, now) {
  const k = dateKey(now);
  return Math.max(0, DAILY_PLAYS - (state.event.plays[k] || 0));
}

export function adPlaysLeft(state, now) {
  const k = dateKey(now);
  return Math.max(0, AD_PLAYS - (state.event.adPlays[k] || 0));
}

export function usePlay(state, now, viaAd = false) {
  const k = dateKey(now);
  if (viaAd) {
    if (adPlaysLeft(state, now) <= 0) return false;
    state.event.adPlays[k] = (state.event.adPlays[k] || 0) + 1;
    return true;
  }
  if (playsLeft(state, now) <= 0) return false;
  state.event.plays[k] = (state.event.plays[k] || 0) + 1;
  return true;
}

// ---------- سباق الهجن ----------
export const RACE_LEN = 1000;
export const RACE_TOKENS = [12, 7, 4, 2, 1];

export function raceBaseSpeed(beauty) {
  return 38 + clamp(beauty || 30, 1, 100) * 0.22;
}

export function raceRivals(seed, n = 4) {
  const rng = mulberry32(seed);
  const names = [...TRADER_NAMES].sort(() => rng() - 0.5).slice(0, n);
  return names.map(name => ({ name, speed: 52 + rng() * 16, jitter: rng() * 6 }));
}

// الضغطة: quality من 0 (بعيد) إلى 1 (بالنص تماماً)
export function boostFor(quality) {
  if (quality >= 0.85) return 26;
  if (quality >= 0.55) return 14;
  return -10;
}

export function racePlace(myTime, rivalTimes) {
  return 1 + rivalTimes.filter(t => t < myTime).length;
}

export function raceTokens(place) {
  return RACE_TOKENS[place - 1] || 1;
}

// ---------- صيد الصقور ----------
export function falconHit(falconX, preyX, preyW = 26) {
  return Math.abs(falconX - preyX) <= preyW / 2;
}

// ---------- التوصيل (مهرجان التمور) ----------
export function deliver(state, now) {
  const def = currentEvent(now).def;
  if (!def.deliver) return 0;
  const n = Math.floor(count(state, def.deliver.item) / def.deliver.per);
  if (n <= 0) return 0;
  add(state, def.deliver.item, -n * def.deliver.per);
  return addTokens(state, n);
}

// ---------- لوحة الترتيب ----------
export function leaderboard(state, now) {
  const cur = currentEvent(now);
  const rng = mulberry32(hashString('lb:' + cur.key + ':' + state.seed));
  const elapsed = clamp(1 - (cur.endMs - now) / (EVENT_DAYS * DAY), 0.05, 1);
  const rows = [...TRADER_NAMES].sort(() => rng() - 0.5).slice(0, 9).map(name => ({ name, score: Math.round((20 + rng() * 150) * elapsed) }));
  rows.push({ name: 'أنت', score: state.event ? state.event.earned : 0, me: true });
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

export function timeLeftText(now) {
  const ms = Math.max(0, currentEvent(now).endMs - now);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h >= 24 ? `${Math.floor(h / 24)} يوم ${h % 24} ساعة` : `${h} ساعة ${m} دقيقة`;
}
