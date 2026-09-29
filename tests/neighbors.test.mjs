import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../web/js/systems/state.js';
import * as F from '../web/js/systems/farms.js';
import { FARMS } from '../web/js/data/openworld.js';

const T0 = new Date(2026, 8, 27, 10).getTime();

test('each neighbor has one fixed request per day that fits what you can make', () => {
  const a = newState(T0), b = newState(T0);
  for (const id of Object.keys(FARMS)) {
    const ra = F.ensureRequest(a, id, 4), rb = F.ensureRequest(b, id, 4);
    assert.deepEqual(ra, rb, id);
    assert.ok(ra.qty >= 2 && ra.qty <= 12);
    assert.ok(ra.coins > 0 && ra.aff >= 8 && ra.aff <= 15);
    assert.ok(F.canSupply(a, ra.item), `${id} asks for ${ra.item}`);
    assert.equal(F.ensureRequest(a, id, 4), ra, 'same object the same day');
  }
  // بدون قن ما يطلبون بيض، وبدون فرن ما يطلبون جرار
  const s = newState(T0);
  for (let d = 1; d < 40; d++) for (const id of Object.keys(FARMS)) {
    const r = F.ensureRequest(s, id, d);
    assert.notEqual(r.item, 'egg');
    assert.ok(!['jar', 'brick', 'lantern'].includes(r.item));
  }
});

test('fulfilling takes the items, pays, raises affinity once', () => {
  const s = newState(T0);
  const r = F.ensureRequest(s, 'umm_saad', 2);
  assert.equal(F.fulfillRequest(s, 'umm_saad').ok, false);
  s.inv[r.item] = r.qty + 1;
  const coins = s.player.coins;
  const res = F.fulfillRequest(s, 'umm_saad');
  assert.ok(res.ok);
  assert.equal(s.inv[r.item], 1);
  assert.equal(s.player.coins, coins + r.coins);
  assert.equal(F.farmState(s, 'umm_saad').aff, r.aff);
  assert.equal(F.fulfillRequest(s, 'umm_saad').ok, false, 'only once a day');
  assert.equal(s.stats.requests, 1);
  // اليوم الجاي طلب جديد
  const r2 = F.ensureRequest(s, 'umm_saad', 3);
  assert.equal(r2.done, false);
});

test('affinity levels give 0/5/10/15% and the discount reaches open deals', () => {
  assert.equal(F.affinityLevel(0).discount, 0);
  assert.equal(F.affinityLevel(19).discount, 0);
  assert.equal(F.affinityLevel(20).discount, 0.05);
  assert.equal(F.affinityLevel(50).discount, 0.10);
  assert.equal(F.affinityLevel(80).name, 'أخو');
  assert.equal(F.affinityLevel(100).next, null);
  const s = newState(T0);
  const f = F.refreshFarm(s, 'abu_rashid', 3);
  const before = f.stock.map(d => d.ask);
  const saleBefore = f.sale.ask;
  f.aff = 50;
  F.applyDiscount(f);
  f.stock.forEach((d, i) => assert.ok(d.ask <= before[i] && d.ask >= Math.floor(before[i] * 0.85), `${d.ask} vs ${before[i]}`));
  assert.ok(f.sale.ask < saleBefore);
  // الزعل ينقص المودّة، والخصم يرجع إذا نزل المستوى
  f.aff = 21;
  F.applyDiscount(f);
  F.offend(s, 'abu_rashid');
  assert.equal(f.aff, 18);
  assert.equal(f.sale.disc, 0);
  assert.equal(f.sale.ask, saleBefore);
});

test('brothers are more patient when you haggle', () => {
  const s = newState(T0);
  const f = F.refreshFarm(s, 'sheikh_falih', 5);
  f.aff = 90; F.applyDiscount(f);
  assert.equal(f.sale.bonusPatience, 1);
});

test('owned farms stop sending requests', () => {
  const s = newState(T0);
  const f = F.farmState(s, 'harbi');
  f.owned = true;
  assert.equal(F.ensureRequest(s, 'harbi', 3), null);
});
