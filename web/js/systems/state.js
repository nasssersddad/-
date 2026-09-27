// حالة اللعبة، الحفظ والتحميل
import { emptyMarket } from './market.js';
import { emptyStall } from './shop.js';
export const SAVE_KEY = 'almuzare_save';
export const SAVE_VERSION = 3;

export function newState(now = Date.now()) {
  return {
    v: SAVE_VERSION,
    created: now,
    lastSeen: now,
    seed: (now % 2147483647) >>> 0,
    player: { x: 26.5 * 16, y: 17.5 * 16, dir: 'down', energy: 100, hp: 10, level: 1, xp: 0, coins: 30 },
    location: 'world',
    inv: { beans: 2, water: 2, dates: 3 },
    kp: { c: 0, n: 0, s: 0 },
    tech: {},
    time: { day: 1, minute: 7 * 60 },
    built: {},
    nodes: {},     // حالة الموارد: { id: { hits, respawnDay } }
    plots: {},     // الأحواض: { id: { seed, stage, watered, ready } }
    quest: { index: 0, done: false, shownStart: -1 },
    flags: {},
    stats: {},
    ach: {},       // stat -> عدد الدرجات المستلمة
    relics: {},
    daily: {
      lastClaim: null, streak: 0,
      dqDate: null, dq: [], dqBonus: false,
      wheelDate: null, freeSpin: true, adSpins: 0,
      adsDate: null, adsCount: 0,
    },
    dungeon: { floor: 0, maxFloor: 0 },
    guests: { day: 0, list: [] },
    camels: [],
    camelSeq: 0,
    trough: { water: 0 },
    market: emptyMarket(),
    blessNext: false,
    blessDay: null,
    mazayenWeek: -1,
    workers: [],
    workerSeq: 0,
    payroll: { auto: false, lastHour: null },
    stall: emptyStall(),
    orders: [],
    orderSeq: 0,
    sheep: [],
    arrivals: [],
    placed: [],
    chests: {},
    bagLevel: 0,
    sheepSeq: 0,
    paper: null,
    settings: { music: true, sfx: true },
    tutorialDone: false,
    introSeen: false,
  };
}

export function serialize(state) {
  return JSON.stringify(state);
}

// يدمج الحفظ القديم مع القيم الافتراضية عشان التحديثات ما تكسر الحفظ
export function deserialize(text, now = Date.now()) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || !data.player) return null;
  return migrate(data, now);
}

function deepMerge(base, data) {
  for (const k of Object.keys(data)) {
    const bv = base[k];
    const dv = data[k];
    if (bv && typeof bv === 'object' && !Array.isArray(bv) && dv && typeof dv === 'object' && !Array.isArray(dv)) {
      base[k] = deepMerge(bv, dv);
    } else {
      base[k] = dv;
    }
  }
  return base;
}

export function migrate(data, now = Date.now()) {
  const base = newState(now);
  const merged = deepMerge(base, data);
  merged.v = SAVE_VERSION;
  return merged;
}

export function saveToStorage(state, storage) {
  try {
    storage.setItem(SAVE_KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function loadFromStorage(storage, now = Date.now()) {
  try {
    const t = storage.getItem(SAVE_KEY);
    return t ? deserialize(t, now) : null;
  } catch {
    return null;
  }
}
