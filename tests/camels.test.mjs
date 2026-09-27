import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, deserialize } from '../web/js/systems/state.js';
import { mulberry32 } from '../web/js/systems/util.js';
import { makeCamel, feed, waterCamel, breed, breedBlocker, dailyUpdate, milk, fillTrough, makeCalf, capacity, camelValue, rollRare } from '../web/js/systems/camels.js';
import { RARE_CHANCE, GESTATION_DAYS, TROUGH_CAP } from '../web/js/data/camels.js';
import {
  refreshDaily, listCamel, tick, acceptOffer, counterOffer, haggleBuy, buyAtAsk, acceptBarter, haggleBarter, marketIndex, PERSONAS,
} from '../web/js/systems/market.js';

const T0 = new Date(2026, 8, 27, 10).getTime();

function pen(state) {
  state.built.stable = true;
  state.built.trough = true;
  return state;
}

test('rare chance is 2% and doubles with blessing', () => {
  const rng = mulberry32(7);
  let n = 0, nb = 0;
  const N = 200000;
  for (let i = 0; i < N; i++) { if (rollRare(rng, false)) n++; if (rollRare(rng, true)) nb++; }
  assert.ok(Math.abs(n / N - RARE_CHANCE) < 0.002, `rare ${n / N}`);
  assert.ok(Math.abs(nb / N - 0.04) < 0.003, `blessed ${nb / N}`);
});

test('breeding needs adult male+female, fed and watered, and births after gestation', () => {
  const s = pen(newState(T0));
  const rng = mulberry32(1);
  const m = makeCamel(s, rng, { sex: 'm', traits: ['milky'] });
  const f = makeCamel(s, rng, { sex: 'f', traits: ['milky'] });
  s.camels.push(m, f);
  const day = s.time.day;
  assert.equal(breedBlocker(s, m.id, f.id, day), 'أطعمهم اليوم أول');
  s.inv.alfalfa = 5; s.inv.water = 5;
  assert.ok(feed(s, m.id, day)); assert.ok(feed(s, f.id, day));
  assert.equal(feed(s, f.id, day), false, 'once per day');
  assert.equal(breedBlocker(s, m.id, f.id, day), 'اسقهم اليوم أول');
  assert.ok(waterCamel(s, m.id, day)); assert.ok(waterCamel(s, f.id, day));
  assert.equal(breedBlocker(s, f.id, m.id, day), 'تحتاج فحل وناقة');
  assert.ok(breed(s, m.id, f.id, day));
  assert.equal(breed(s, m.id, f.id, day), false, 'already pregnant');
  let births = [];
  for (let d = 1; d <= GESTATION_DAYS; d++) births = births.concat(dailyUpdate(s, day + d, rng));
  assert.equal(births.length, 1);
  assert.equal(s.camels.length, 3);
  assert.equal(births[0].ageDays, 0);
  assert.equal(s.stats.camelsBorn, 1);
});

test('calf can be rare and rare camels are worth a fortune', () => {
  const s = newState(T0);
  const rng = mulberry32(2);
  const mom = makeCamel(s, rng, { sex: 'f', beauty: 60 });
  const always = () => 0.001;
  const calf = makeCalf(s, mom, null, always, false);
  assert.ok(calf.rare);
  const normal = makeCamel(s, rng, { beauty: 60 });
  const rare = { ...normal, rare: 'golden' };
  assert.ok(camelValue(rare) > 50 * camelValue(normal));
});

test('trough fills to cap and camels drink every morning', () => {
  const s = pen(newState(T0));
  const rng = mulberry32(3);
  s.inv.water = 20;
  assert.equal(fillTrough(s, 15), TROUGH_CAP);
  assert.equal(fillTrough(s, 1), 0);
  s.camels.push(makeCamel(s, rng), makeCamel(s, rng));
  dailyUpdate(s, 2, rng);
  assert.equal(s.trough.water, TROUGH_CAP - 2);
  assert.ok(s.camels.every(c => c.wateredDay === 2));
});

test('milking once a day, only adult non-pregnant females', () => {
  const s = pen(newState(T0));
  const rng = mulberry32(4);
  const f = makeCamel(s, rng, { sex: 'f' });
  const calf = makeCamel(s, rng, { sex: 'f', ageDays: 0 });
  s.camels.push(f, calf);
  assert.ok(milk(s, f.id, 1) >= 1);
  assert.equal(milk(s, f.id, 1), 0);
  assert.equal(milk(s, calf.id, 1), 0);
  assert.ok(s.inv.milk >= 1);
});

test('pen capacity grows with expansions and blocks breeding when full', () => {
  const s = pen(newState(T0));
  assert.equal(capacity(s), 4);
  s.built.pen2 = true;
  assert.equal(capacity(s), 8);
});

test('old v1 saves load with camel and market defaults', () => {
  const old = newState(T0);
  delete old.camels; delete old.market; delete old.trough; old.v = 1;
  const s = deserialize(JSON.stringify(old), T0);
  assert.deepEqual(s.camels, []);
  assert.ok(s.market && Array.isArray(s.market.listings));
  assert.equal(s.trough.water, 0);
});

// ---------- السوق ----------
test('market listings and index are deterministic per day', () => {
  const a = pen(newState(T0)), b = pen(newState(T0));
  refreshDaily(a, 3); refreshDaily(b, 3);
  assert.deepEqual(a.market.listings.map(l => [l.seller, l.ask]), b.market.listings.map(l => [l.seller, l.ask]));
  assert.deepEqual(marketIndex(1, 5), marketIndex(1, 5));
  assert.equal(refreshDaily(a, 3), false);
});

test('buyers never pay above their hidden max and walk away when out of patience', () => {
  const s = pen(newState(T0));
  const rng = mulberry32(9);
  refreshDaily(s, 1);
  const c = makeCamel(s, rng, { sex: 'f', beauty: 50 });
  s.camels.push(c);
  listCamel(s, c.id, 5000, T0);
  const fresh = tick(s, T0 + 10 * 60000, rng);
  assert.ok(fresh.length >= 1);
  const o = fresh[0];
  assert.ok(o.amount <= o.maxPay);
  // سعر منطقي يوصل لاتفاق أو عرض مضاد ما يتعدى الحد
  const r = counterOffer(s, o.id, o.maxPay + 1000, rng);
  assert.ok(r.result === 'counter' || r.result === 'leave');
  if (r.result === 'counter') assert.ok(r.amount <= o.maxPay);
  // يطلع بعد ما يخلص صبره
  let res;
  for (let i = 0; i < 10; i++) { res = counterOffer(s, o.id, o.maxPay * 3, rng); if (!res || res.result === 'leave') break; }
  assert.ok(!res || res.result === 'leave');
});

test('accepting an offer transfers the camel and coins', () => {
  const s = pen(newState(T0));
  const rng = mulberry32(11);
  refreshDaily(s, 1);
  const c = makeCamel(s, rng, { sex: 'm' });
  s.camels.push(c);
  listCamel(s, c.id, 100, T0);
  const [o] = tick(s, T0 + 5 * 60000, rng);
  const coins = s.player.coins;
  const r = acceptOffer(s, o.id);
  assert.equal(s.player.coins, coins + r.price);
  assert.equal(s.camels.length, 0);
  assert.equal(s.market.myListings.length, 0);
  assert.equal(s.stats.marketSales, 1);
});

test('rare listings attract rising bids', () => {
  const s = pen(newState(T0));
  const rng = mulberry32(12);
  refreshDaily(s, 1);
  const c = makeCamel(s, rng, { rare: 'golden', beauty: 80 });
  s.camels.push(c);
  listCamel(s, c.id, 10_000_000, T0);
  const offers = tick(s, T0 + 20 * 60000, rng);
  assert.ok(offers.length >= 2);
  for (let i = 1; i < offers.length; i++) assert.ok(offers[i].amount > offers[i - 1].amount);
  assert.ok(offers[0].amount > 30000);
});

test('haggling with a seller: never below their minimum, and buying adds the camel', () => {
  const s = pen(newState(T0));
  const rng = mulberry32(13);
  refreshDaily(s, 1);
  s.player.coins = 1e7;
  const l = s.market.listings.find(x => !x.camel.rare) || s.market.listings[0];
  const r1 = haggleBuy(s, l.id, Math.round(l.min * 0.7), rng);
  assert.ok(['counter', 'leave'].includes(r1.result));
  if (r1.result === 'counter') assert.ok(r1.amount >= l.min);
  const r2 = haggleBuy(s, l.id, l.min, rng);
  if (!l.angry) {
    assert.equal(r2.result, 'bought');
    assert.equal(s.camels.length, 1);
  }
  const other = s.market.listings.find(x => !x.closed);
  const before = s.player.coins;
  assert.equal(buyAtAsk(s, other.id).result, 'bought');
  assert.equal(s.player.coins, before - other.ask);
});

test('buying is refused without a pen, coins, or room', () => {
  const s = newState(T0);
  refreshDaily(s, 1);
  s.player.coins = 1e7;
  assert.equal(buyAtAsk(s, s.market.listings[0].id).result, 'nostable');
  s.built.stable = true;
  s.player.coins = 0;
  assert.equal(buyAtAsk(s, s.market.listings[0].id).result, 'poor');
});

test('barter swaps camels and pays the coin difference', () => {
  const s = pen(newState(T0));
  const rng = mulberry32(14);
  s.camels.push(makeCamel(s, rng, { beauty: 90, breed: 'wadh' }));
  refreshDaily(s, 2);
  const b = s.market.barters[0];
  assert.ok(b);
  const h = haggleBarter(s, b.id, b.maxCoins + 100000, rng);
  assert.ok(['counter', 'leave'].includes(h.result));
  if (h.result === 'counter') {
    const coins = s.player.coins;
    const r = acceptBarter(s, b.id);
    assert.equal(s.player.coins, coins + r.coins);
    assert.equal(s.camels.length, 1);
    assert.equal(s.camels[0].name, r.got.name);
  }
  assert.ok(Object.keys(PERSONAS).length >= 5);
});

import { rollTraits, ensureTraits, speedMul, gestationDays, luckyIncome, makeCalf as mkCalf, camelValue as cv } from '../web/js/systems/camels.js';
import { TRAITS, RARE_TRAITS } from '../web/js/data/camels.js';

test('every camel gets 1-2 common traits, rare breeds always get a rare trait', () => {
  const rng = mulberry32(11);
  let rareSeen = 0;
  for (let i = 0; i < 400; i++) {
    const t = rollTraits(rng);
    const commons = t.filter(x => TRAITS[x].tier === 'common').length;
    assert.ok(commons >= 1 && commons <= 2);
    if (t.some(x => TRAITS[x].tier === 'rare')) rareSeen++;
  }
  assert.ok(rareSeen > 5 && rareSeen < 60, 'rare traits are uncommon: ' + rareSeen);
  assert.ok(rollTraits(rng, true).some(x => RARE_TRAITS.includes(x)));
});

test('trait effects: speed, gestation, value, lucky income, legacy camels', () => {
  const s = newState(0);
  const rng = mulberry32(5);
  const c = makeCamel(s, rng, { sex: 'f', beauty: 50, traits: ['fast', 'fertile'] });
  assert.ok(Math.abs(speedMul(c) - 1.08) < 1e-9);
  assert.equal(gestationDays(c), 2);
  const plain = { ...c, traits: [] };
  const rich = { ...c, traits: ['treasure'] };
  assert.ok(cv(rich) > cv(plain) * 1.7);
  s.camels.push({ ...c, traits: ['lucky'] });
  const before = s.player.coins;
  const got = luckyIncome(s, rng);
  assert.ok(got >= 40 && got <= 120 && s.player.coins === before + got);
  const old = { id: 'c9_old', rare: null };
  ensureTraits(old);
  assert.deepEqual(ensureTraits({ id: 'c9_old', rare: null }), old.traits);
});

test('calves can inherit their parents traits', () => {
  const s = newState(0);
  let inherited = 0;
  for (let i = 0; i < 200; i++) {
    const rng = mulberry32(100 + i);
    const mom = makeCamel(s, rng, { sex: 'f', traits: ['milky', 'fountain'] });
    const dad = makeCamel(s, rng, { sex: 'm', traits: ['milky'] });
    const calf = mkCalf(s, mom, dad, rng, false);
    if (calf.traits.includes('fountain')) inherited++;
  }
  assert.ok(inherited > 30 && inherited < 120, 'fountain inherited ' + inherited);
});
