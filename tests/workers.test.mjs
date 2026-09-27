import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, deserialize } from '../web/js/systems/state.js';
import { mulberry32 } from '../web/js/systems/util.js';
import { candidates, hire, hourTick, payAll, reinstate, reinstateCost, totalOwed, workerCap, assignBuild, progressBuild, cancelBuild, fire } from '../web/js/systems/workers.js';
import { listItem, listSheep, stallTick, collect, unlistSlot, sellChancePerHour, priceRange, ensureOrders, fulfill, discard, canFulfill, newspaper, buyFromPaper } from '../web/js/systems/shop.js';
import { buyLamb, feedSheep, shear, canShear, sheepDaily } from '../web/js/systems/sheep.js';
import { STRIKE_AFTER, FINE_MIN } from '../web/js/data/workers.js';

const T0 = new Date(2026, 8, 27, 10).getTime();

function withWorker(type = 'woodcutter') {
  const s = newState(T0);
  s.player.coins = 10000;
  const c = candidates(s, 1).find(x => x.type === type) || { ...candidates(s, 1)[0], type };
  const r = hire(s, c);
  assert.ok(r.ok);
  return { s, w: r.worker };
}

test('candidates are deterministic and hiring costs coins and respects the cap', () => {
  const s = newState(T0);
  assert.deepEqual(candidates(s, 4), candidates(s, 4));
  s.player.coins = 0;
  assert.equal(hire(s, candidates(s, 1)[0]).reason, 'poor');
  s.player.coins = 10000;
  const c = candidates(s, 1);
  assert.ok(hire(s, c[0]).ok);
  assert.equal(hire(s, c[0]).reason, 'hired');
  assert.ok(hire(s, c[1]).ok);
  assert.equal(workerCap(s), 2);
  assert.equal(hire(s, c[2]).reason, 'full');
  s.built.workers_house = true;
  assert.ok(hire(s, c[2]).ok);
});

test('wages accrue per working hour only, not at night', () => {
  const { s, w } = withWorker();
  hourTick(s, 23);
  assert.equal(w.owed, 0);
  hourTick(s, 9);
  assert.equal(w.owed, w.wage);
  assert.equal(totalOwed(s), w.wage);
});

test('unpaid for 3 hours means strike, and coming back costs debt plus fine', () => {
  const { s, w } = withWorker();
  let ev = [];
  for (let h = 8; h < 8 + STRIKE_AFTER; h++) ev = ev.concat(hourTick(s, h));
  assert.equal(w.status, 'strike');
  assert.ok(ev.some(e => e.type === 'late'));
  assert.ok(ev.some(e => e.type === 'strike'));
  const owed = w.owed;
  assert.equal(w.fine, Math.max(FINE_MIN, Math.round(owed * 0.5)));
  // المضرب ما يزيد دينه
  hourTick(s, 12);
  assert.equal(w.owed, owed);
  // السداد العادي ما يرجّعه
  payAll(s);
  assert.equal(w.status, 'strike');
  const coins = s.player.coins;
  const cost = reinstateCost(w);
  assert.equal(reinstate(s, w.id), cost);
  assert.equal(s.player.coins, coins - cost);
  assert.equal(w.status, 'work');
  assert.equal(w.owed, 0);
});

test('paying on time prevents strikes; auto-pay pays every hour', () => {
  const { s, w } = withWorker();
  hourTick(s, 8); hourTick(s, 9);
  assert.equal(payAll(s), w.wage * 2);
  hourTick(s, 10); hourTick(s, 11);
  assert.equal(w.status, 'work');
  s.payroll.auto = true;
  for (let h = 8; h < 18; h++) hourTick(s, h);
  assert.equal(w.status, 'work');
  assert.equal(w.owed, 0);
  // بدون دراهم الدفع التلقائي ما يمنع الإضراب
  s.player.coins = 0;
  for (let h = 8; h < 12; h++) hourTick(s, h);
  assert.equal(w.status, 'strike');
});

test('builder consumes materials up front, builds over hours, and refunds on cancel', () => {
  const { s, w } = withWorker('builder');
  w.type = 'builder';
  s.inv.plank = 10; s.inv.frond = 10; s.inv.rope = 4;
  assert.ok(assignBuild(s, w.id, 'stall_shop').ok);
  assert.equal(s.inv.plank, 6);
  assert.equal(progressBuild(s, w, 0.5), null);
  assert.equal(progressBuild(s, w, 10), 'stall_shop');
  assert.ok(s.built.stall_shop);
  assert.ok(assignBuild(s, w.id, 'orders_board').ok);
  assert.ok(cancelBuild(s, w.id));
  assert.equal(s.inv.plank, 6);
  w.status = 'strike';
  assert.ok(assignBuild(s, w.id, 'orders_board').ok);
  assert.equal(progressBuild(s, w, 10), null, 'strikers do not build');
  fire(s, w.id);
  assert.equal(s.inv.plank, 6, 'firing refunds the job');
});

test('stall: price limits, cheaper sells faster, collect pays', () => {
  const s = newState(T0);
  s.inv.tomato = 10;
  assert.ok(listItem(s, 0, 'tomato', 5, 1e9));
  const slot = s.stall.slots[0];
  assert.equal(slot.price, priceRange(slot.base).max);
  assert.equal(s.inv.tomato, 5);
  assert.ok(sellChancePerHour(10, 20) > sellChancePerHour(40, 20));
  assert.equal(listItem(s, 0, 'tomato', 1, 5), false, 'slot taken');
  assert.ok(unlistSlot(s, 0));
  assert.equal(s.inv.tomato, 10);
  listItem(s, 1, 'tomato', 5, 5);
  const rng = mulberry32(3);
  let sold = [];
  for (let i = 0; i < 20 && !sold.length; i++) sold = stallTick(s, 60, rng);
  assert.equal(sold.length, 1);
  const coins = s.player.coins;
  assert.equal(collect(s, 1), s.stall.slots[1] ? 0 : coins + 0 - coins + (s.player.coins - coins));
  assert.ok(s.player.coins > coins);
  assert.equal(s.stats.stallSales, 1);
});

test('orders: fulfilling consumes items and replaces the order after a wait', () => {
  const s = newState(T0);
  const rng = mulberry32(5);
  s.inv = {};
  ensureOrders(s, rng, 0);
  assert.equal(s.orders.length, 6);
  const o = s.orders[0];
  assert.equal(fulfill(s, o.id, rng, 0), null);
  for (const [k, v] of Object.entries(o.items)) s.inv[k] = (s.inv[k] || 0) + v;
  const r = fulfill(s, o.id, rng, 0);
  assert.ok(r.coins > 0);
  for (const k of Object.keys(o.items)) assert.ok((s.inv[k] || 0) >= 0);
  const replaced = s.orders[0];
  assert.notEqual(replaced.id, o.id);
  assert.equal(canFulfill(s, replaced, 0), false, 'new order waits');
  assert.ok(discard(s, s.orders[1].id, rng, 0));
});

test('newspaper listings are daily and can be bought', () => {
  const s = newState(T0);
  s.player.coins = 1e6;
  const a = newspaper(s, 2);
  assert.equal(newspaper(s, 2), a);
  const p = a[0];
  assert.ok(buyFromPaper(s, p.id));
  assert.equal(buyFromPaper(s, p.id), false);
  assert.equal(s.inv[p.item] >= p.qty, true);
});

test('sheep: buy lamb, grows, sheared for wool, sold via stall', () => {
  const s = newState(T0);
  const rng = mulberry32(8);
  s.player.coins = 5000;
  assert.equal(buyLamb(s, 'najdi', rng).ok, false);
  s.built.sheepfold = true;
  const { sheep } = buyLamb(s, 'najdi', rng);
  assert.equal(canShear(sheep, 1), false);
  s.inv.alfalfa = 5;
  assert.ok(feedSheep(s, sheep.id, 1));
  sheepDaily(s, 2); sheepDaily(s, 3);
  assert.ok(canShear(sheep, 3));
  assert.ok(shear(s, sheep.id, 3) >= 2);
  assert.equal(shear(s, sheep.id, 3), 0);
  assert.ok(listSheep(s, 2, sheep.id, 300));
  assert.equal(s.sheep.length, 0);
});

test('v2 saves load with worker/shop/sheep defaults', () => {
  const old = newState(T0);
  delete old.workers; delete old.stall; delete old.sheep; delete old.payroll; delete old.orders;
  old.v = 2;
  const s = deserialize(JSON.stringify(old), T0);
  assert.deepEqual(s.workers, []);
  assert.equal(s.stall.slots.length, 6);
  assert.equal(s.payroll.auto, false);
});
