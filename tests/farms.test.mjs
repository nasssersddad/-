import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../web/js/systems/state.js';
import { mulberry32 } from '../web/js/systems/util.js';
import { makeCamel } from '../web/js/systems/camels.js';
import { refreshFarm, haggle, buyGoods, buyAnimal, sellOffer, counterSell, completeSell, buyFarm, farmDaily, collectStorage } from '../web/js/systems/farms.js';
import { FARMS, buildOpenWorld, owTile } from '../web/js/data/openworld.js';
import { SOLID_TILES } from '../web/js/data/map.js';

const T0 = new Date(2026, 8, 27, 10).getTime();

test('open world has all NPC farms with owners and a walkable way home', () => {
  const w = buildOpenWorld();
  for (const id of Object.keys(FARMS)) assert.ok(w.farmObjs[id].owner, id);
  const tx = Math.floor(w.spawn.x / 16), ty = Math.floor(w.spawn.y / 16);
  assert.ok(!SOLID_TILES.has(owTile(w.tiles, tx, ty)));
  assert.ok(w.objects.some(o => o.kind === 'gohome'));
});

test('farm stock refreshes once per day and is deterministic', () => {
  const a = newState(T0), b = newState(T0);
  const fa = refreshFarm(a, 'abu_rashid', 3), fb = refreshFarm(b, 'abu_rashid', 3);
  assert.deepEqual(fa.stock.map(x => x.ask), fb.stock.map(x => x.ask));
  assert.equal(fa.animals.filter(x => x.kind === 'camel').length, FARMS.abu_rashid.camels);
  assert.equal(refreshFarm(a, 'abu_rashid', 3), fa);
});

test('haggling never goes below the seller minimum; buying goods pays the agreed price', () => {
  const s = newState(T0);
  const rng = mulberry32(2);
  s.player.coins = 1e6;
  const f = refreshFarm(s, 'bu_nasser', 1);
  const d = f.stock[0];
  const r = haggle(d, 1, rng);
  assert.ok(['counter', 'leave'].includes(r.result));
  if (r.result === 'counter') assert.ok(r.amount >= d.min);
  const d2 = f.stock[1];
  assert.equal(haggle(d2, d2.min, rng).result, 'accept');
  const coins = s.player.coins;
  const res = buyGoods(s, 'bu_nasser', d2.id);
  assert.equal(res.result, 'bought');
  assert.equal(s.player.coins, coins - d2.ask * res.qty);
  assert.equal(s.inv[d2.item] >= res.qty, true);
});

test('buying animals needs a pen or fold and room', () => {
  const s = newState(T0);
  s.player.coins = 1e7;
  const f = refreshFarm(s, 'umm_saad', 1);
  const sheep = f.animals.find(a => a.kind === 'sheep');
  assert.equal(buyAnimal(s, 'umm_saad', sheep.id).result, 'nofold');
  s.built.sheepfold = true;
  assert.equal(buyAnimal(s, 'umm_saad', sheep.id).result, 'bought');
  assert.equal(s.sheep.length, 1);
  const g = refreshFarm(s, 'abu_rashid', 1);
  const cam = g.animals.find(a => a.kind === 'camel');
  assert.equal(buyAnimal(s, 'abu_rashid', cam.id).result, 'nostable');
  s.built.stable = true;
  assert.equal(buyAnimal(s, 'abu_rashid', cam.id).result, 'bought');
  // الحلال المشترى ينتظر يمشي للمراح أول ما ترجع المزرعة
  assert.deepEqual(s.arrivals, [s.sheep[0].id, s.camels[0].id]);
});

test('selling your camel to a farmer: counter stays under their max, completes the sale', () => {
  const s = newState(T0);
  const rng = mulberry32(3);
  const c = makeCamel(s, rng, { sex: 'f', beauty: 60 });
  s.camels.push(c);
  const o = sellOffer(s, 'sheikh_falih', 'camel', c.id, rng);
  const r = counterSell(o, o.maxPay * 5, rng);
  if (r.result === 'counter') assert.ok(r.amount <= o.maxPay);
  counterSell(o, o.maxPay, rng);
  const coins = s.player.coins;
  const done = completeSell(s, o);
  assert.ok(done && done.price > 0);
  assert.equal(s.camels.length, 0);
  assert.equal(s.player.coins, coins + done.price);
});

test('buying a farm makes it yours and it produces into storage daily', () => {
  const s = newState(T0);
  const f = refreshFarm(s, 'harbi', 1);
  assert.equal(buyFarm(s, 'harbi').result, 'poor');
  s.player.coins = f.sale.ask;
  assert.equal(buyFarm(s, 'harbi').result, 'bought');
  assert.equal(s.player.coins, 0);
  s.time.day = 3;
  assert.deepEqual(farmDaily(s, 3), ['harbi']);
  const got = collectStorage(s, 'harbi');
  assert.ok(got.coins > 0 && got.stone > 0);
  assert.ok(s.player.coins > 0);
  assert.equal(s.stats.farmsOwned, 1);
});
