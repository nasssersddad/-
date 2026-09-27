import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, serialize, deserialize } from '../web/js/systems/state.js';
import { mulberry32, dateKey, dayDiff } from '../web/js/systems/util.js';
import { add, has } from '../web/js/systems/inventory.js';
import { craft, build, learnTech, techStatus, spotStatus } from '../web/js/systems/crafting.js';
import { addXp, xpForLevel, stars, rating } from '../web/js/systems/progression.js';
import { applyReward, rollChest } from '../web/js/systems/rewards.js';
import {
  dailyStatus, claimDaily, ensureDailyQuests, dqProgress, claimDailyQuest, dqBonusReady,
  wheelStatus, spinWheel, offlineEarnings, OFFLINE_CAP_HOURS, adsLeft, consumeAd,
  claimableAchievements, claimAchievement, pendingRewardsCount,
} from '../web/js/systems/retention.js';
import { plant, water, growPlots, harvest, isReady } from '../web/js/systems/farming.js';
import { advance, sleepUntilMorning, weekday, darkness } from '../web/js/systems/time.js';
import { checkQuest, currentQuest } from '../web/js/systems/quests.js';
import { generateFloor, dTile, D } from '../web/js/systems/dungeon.js';
import { buildWorld, tileAt, SOLID_TILES } from '../web/js/data/map.js';
import { WHEEL, AD_DAILY_CAP, DAILY_CALENDAR } from '../web/js/data/rewards.js';
import { RECIPES, BUILD_SPOTS } from '../web/js/data/recipes.js';
import { ITEMS } from '../web/js/data/items.js';
import { TECH, TECH_BY_ID } from '../web/js/data/tech.js';

const DAY = 86400000;
const T0 = new Date(2026, 8, 27, 10, 0, 0).getTime();

test('save/load roundtrip keeps data and fills new defaults', () => {
  const s = newState(T0);
  s.player.coins = 999;
  s.inv.wood = 7;
  const text = serialize(s);
  const back = deserialize(text, T0);
  assert.equal(back.player.coins, 999);
  assert.equal(back.inv.wood, 7);
  // حفظ قديم ناقص حقول
  const old = JSON.parse(text);
  delete old.daily;
  delete old.settings;
  const migrated = deserialize(JSON.stringify(old), T0);
  assert.ok(migrated.daily);
  assert.equal(migrated.settings.music, true);
  assert.equal(deserialize('not json'), null);
  assert.equal(deserialize('{}'), null);
});

test('daily reward streak continues, resets after a missed day, and wraps after 7', () => {
  const s = newState(T0);
  let r = claimDaily(s, T0);
  assert.equal(r.dayIndex, 0);
  assert.equal(claimDaily(s, T0 + 3600000), null, 'same day cannot claim twice');
  r = claimDaily(s, T0 + DAY);
  assert.equal(r.dayIndex, 1);
  assert.equal(r.streak, 2);
  // فوّت يوم
  const st = dailyStatus(s, T0 + 3 * DAY);
  assert.equal(st.broken, true);
  assert.equal(st.dayIndex, 0);
  // سبعة أيام متتالية ثم يرجع لليوم الأول من التقويم
  const s2 = newState(T0);
  for (let i = 0; i < 7; i++) assert.equal(claimDaily(s2, T0 + i * DAY).dayIndex, i);
  assert.equal(claimDaily(s2, T0 + 7 * DAY).dayIndex, 0);
  assert.equal(s2.daily.streak, 8);
  assert.equal(DAILY_CALENDAR.length, 7);
});

test('dayDiff handles month boundaries', () => {
  assert.equal(dayDiff('2026-09-30', '2026-10-01'), 1);
  assert.equal(dayDiff('2026-12-31', '2027-01-01'), 1);
  assert.equal(dateKey(T0), '2026-09-27');
});

test('daily quests: 3 generated, progress from baseline, claim and bonus', () => {
  const s = newState(T0);
  s.stats.palms = 50;
  ensureDailyQuests(s, T0);
  assert.equal(s.daily.dq.length, 3);
  assert.equal(ensureDailyQuests(s, T0 + 1000), false, 'same day does not regenerate');
  for (const q of s.daily.dq) {
    assert.equal(dqProgress(s, q), 0);
    assert.notEqual(q.id, 'enemy', 'enemy quest hidden before crypt');
  }
  for (let i = 0; i < 3; i++) {
    const q = s.daily.dq[i];
    assert.equal(claimDailyQuest(s, i), null);
    s.stats[q.stat] = (s.stats[q.stat] || 0) + q.target;
    assert.ok(claimDailyQuest(s, i));
  }
  assert.equal(dqBonusReady(s), true);
  ensureDailyQuests(s, T0 + DAY);
  assert.equal(s.daily.dq.every(q => !q.claimed), true);
});

test('wheel: one free spin per day, 3 ad spins, weights valid', () => {
  const s = newState(T0);
  const rng = mulberry32(5);
  assert.ok(spinWheel(s, T0, rng, 'free'));
  assert.equal(spinWheel(s, T0, rng, 'free'), null);
  for (let i = 0; i < 3; i++) assert.ok(spinWheel(s, T0, rng, 'ad'));
  assert.equal(spinWheel(s, T0, rng, 'ad'), null);
  assert.equal(wheelStatus(s, T0 + DAY).free, true);
  assert.ok(WHEEL.every(w => w.w > 0 && w.reward));
  // التوزيع قريب من الأوزان
  const counts = new Array(WHEEL.length).fill(0);
  const s2 = newState(T0);
  const r2 = mulberry32(99);
  for (let i = 0; i < 20000; i++) { s2.daily.freeSpin = true; counts[spinWheel(s2, T0, r2, 'free').index]++; }
  const total = WHEEL.reduce((a, w) => a + w.w, 0);
  WHEEL.forEach((w, i) => assert.ok(Math.abs(counts[i] / 20000 - w.w / total) < 0.02));
});

test('offline earnings require 5 minutes and cap at 8 hours', () => {
  const s = newState(T0);
  s.lastSeen = T0;
  assert.equal(offlineEarnings(s, T0 + 60000), null);
  const a = offlineEarnings(s, T0 + 2 * 3600000);
  const b = offlineEarnings(s, T0 + 30 * 3600000);
  const c = offlineEarnings(s, T0 + OFFLINE_CAP_HOURS * 3600000);
  assert.ok(a.coins > 0);
  assert.equal(b.coins, c.coins);
  assert.equal(b.capped, true);
  s.built.room1 = true;
  assert.ok(offlineEarnings(s, T0 + 2 * 3600000).coins > a.coins);
});

test('ads are capped per day', () => {
  const s = newState(T0);
  assert.equal(adsLeft(s, T0), AD_DAILY_CAP);
  for (let i = 0; i < AD_DAILY_CAP; i++) assert.ok(consumeAd(s, T0));
  assert.equal(consumeAd(s, T0), false);
  assert.equal(adsLeft(s, T0 + DAY), AD_DAILY_CAP);
});

test('crafting consumes inputs and produces outputs; locked recipes refuse', () => {
  const s = newState(T0);
  add(s, 'wood', 4);
  assert.ok(craft(s, 'plank'));
  assert.equal(s.inv.wood, 2);
  assert.equal(s.inv.plank, 1);
  assert.equal(s.stats.craft_plank, 1);
  add(s, 'clay', 5); add(s, 'water', 3);
  assert.equal(craft(s, 'brick'), null, 'needs t_brick');
  s.tech.t_brick = true;
  assert.ok(craft(s, 'brick'));
});

test('all recipe/spot/tech references are valid', () => {
  for (const r of RECIPES) {
    for (const id of [...Object.keys(r.in), ...Object.keys(r.out)]) assert.ok(ITEMS[id], `${r.id}: ${id}`);
    if (r.tech) assert.ok(TECH_BY_ID[r.tech], r.tech);
  }
  for (const [id, sp] of Object.entries(BUILD_SPOTS)) {
    for (const k of Object.keys(sp.cost)) assert.ok(ITEMS[k], `${id}: ${k}`);
    if (sp.tech) assert.ok(TECH_BY_ID[sp.tech], sp.tech);
  }
  for (const t of TECH) for (const r of t.req) assert.ok(TECH_BY_ID[r], r);
});

test('tech requires prerequisites and points', () => {
  const s = newState(T0);
  assert.equal(techStatus(s, 't_brick'), 'locked');
  assert.equal(techStatus(s, 't_kiln'), 'poor');
  s.kp = { c: 5, n: 5, s: 0 };
  assert.ok(learnTech(s, 't_kiln'));
  assert.deepEqual(s.kp, { c: 3, n: 3, s: 0 });
  assert.equal(techStatus(s, 't_brick'), 'ready');
});

test('building raises rating and stars; spot needs tech', () => {
  const s = newState(T0);
  add(s, 'stone', 20); add(s, 'clay', 10);
  assert.equal(spotStatus(s, 'kiln').ok, false);
  s.tech.t_kiln = true;
  assert.ok(build(s, 'kiln'));
  assert.equal(rating(s), 3);
  s.built.wall_n = true; s.built.wall_s = true;
  assert.equal(stars(s), 1);
  assert.equal(spotStatus(s, 'crypt_door').hidden, true);
});

test('xp levels up correctly', () => {
  const s = newState(T0);
  const ups = addXp(s, xpForLevel(1) + xpForLevel(2) + 1);
  assert.deepEqual(ups, [2, 3]);
  assert.equal(s.player.xp, 1);
});

test('rewards: chests roll contents and apply, level up gives rewards', () => {
  const s = newState(T0);
  const rng = mulberry32(3);
  const c = rollChest(s, 'legendary', rng);
  assert.ok(c.coins >= 250);
  const coins0 = s.player.coins;
  const res = applyReward(s, { chest: 'rare', xp: 500 }, rng);
  assert.ok(res.chests.length >= 1);
  assert.ok(res.levelUps.length >= 2);
  assert.ok(s.player.coins > coins0);
  assert.ok(s.stats.chests >= 1);
});

test('farming: plant, water, grow per day, harvest', () => {
  const s = newState(T0);
  const rng = mulberry32(1);
  add(s, 'seed_tomato', 1); add(s, 'water', 5);
  assert.ok(plant(s, 'plot0', 'seed_tomato'));
  assert.equal(plant(s, 'plot0', 'seed_tomato'), false);
  growPlots(s, 1);
  assert.equal(s.plots.plot0.stage, 0, 'no growth without water');
  assert.ok(water(s, 'plot0'));
  assert.equal(water(s, 'plot0'), false, 'once per day');
  growPlots(s, 1);
  water(s, 'plot0');
  growPlots(s, 1);
  assert.ok(isReady(s.plots.plot0));
  const h = harvest(s, 'plot0', rng);
  assert.equal(h.crop, 'tomato');
  assert.ok(s.inv.tomato >= 2);
  assert.ok(s.inv.seed_tomato >= 1);
});

test('time advances days and sleep jumps to morning', () => {
  const s = newState(T0);
  s.time.minute = 23 * 60;
  assert.equal(advance(s, 30), 1);
  assert.equal(weekday(s), 1);
  s.time.minute = 22 * 60;
  assert.equal(sleepUntilMorning(s), 1);
  assert.equal(s.time.minute, 6 * 60 + 30);
  assert.equal(darkness(12 * 60), 0);
  assert.equal(darkness(23 * 60), 1);
});

test('main quest chain advances', () => {
  const s = newState(T0);
  assert.equal(currentQuest(s).id, 'q_wake');
  assert.equal(checkQuest(s), null);
  s.flags.talked_lamp = true;
  assert.equal(checkQuest(s).id, 'q_wake');
  assert.equal(currentQuest(s).id, 'q_palms');
});

test('achievements claim tiers in order', () => {
  const s = newState(T0);
  s.stats.palms = 70;
  const c = claimableAchievements(s).find(x => x.ach.stat === 'palms');
  assert.equal(c.tier, 0);
  assert.equal(claimAchievement(s, 'palms').tier, 0);
  assert.equal(claimAchievement(s, 'palms').tier, 1);
  assert.equal(claimAchievement(s, 'palms'), null);
  assert.ok(pendingRewardsCount(s, T0) >= 2, 'daily + wheel pending');
});

test('world map: spawn and objects are on walkable tiles', () => {
  const w = buildWorld();
  const tx = Math.floor(w.spawn.x / 16), ty = Math.floor(w.spawn.y / 16);
  assert.ok(!SOLID_TILES.has(tileAt(w.tiles, tx, ty)));
  const kinds = new Set(w.objects.map(o => o.kind));
  for (const k of ['palm', 'rock', 'clay', 'herb', 'plot', 'station', 'spot', 'lamp', 'well']) assert.ok(kinds.has(k), k);
  assert.ok(w.objects.filter(o => o.kind === 'palm').length >= 12);
  assert.ok(w.objects.filter(o => o.kind === 'rock').length >= 8);
  const ids = w.objects.map(o => o.id);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  // الخريطة ثابتة بين المرات
  assert.deepEqual(buildWorld().objects.map(o => o.id), ids);
});

test('dungeon floors are connected from start to stairs', () => {
  for (let f = 1; f <= 3; f++) {
    for (let seed = 1; seed < 30; seed++) {
      const fl = generateFloor(f, seed, false);
      const sx = Math.floor(fl.start.x / 16), sy = Math.floor(fl.start.y / 16);
      const dx = Math.floor(fl.down.x / 16), dy = Math.floor(fl.down.y / 16);
      const seen = new Set([sx + ',' + sy]);
      const q = [[sx, sy]];
      while (q.length) {
        const [x, y] = q.pop();
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + ax, ny = y + ay, k = nx + ',' + ny;
          if (!seen.has(k) && dTile(fl.tiles, nx, ny) === D.FLOOR) { seen.add(k); q.push([nx, ny]); }
        }
      }
      assert.ok(seen.has(dx + ',' + dy), `floor ${f} seed ${seed}`);
      assert.ok(fl.enemies.some(e => e.type === 'boss' + f));
    }
  }
});
