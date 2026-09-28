import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../web/js/systems/state.js';
import * as PR from '../web/js/systems/production.js';

const base = () => { const s = newState(0); s.inv = { clay: 20, water: 10, wood: 10 }; s.tech.t_brick = true; return s; };

test('queue: 2 slots at level 1, 3 at level 2; inputs are taken when queued', () => {
  const s = base();
  assert.equal(PR.slots(s, 'kiln'), 2);
  assert.ok(PR.enqueue(s, 'kiln', 'brick', 100).ok);
  assert.equal(s.inv.clay, 18);
  assert.ok(PR.enqueue(s, 'kiln', 'brick', 100).ok);
  assert.equal(PR.enqueue(s, 'kiln', 'brick', 100).reason, 'الطابور مليان');
  s.built.kiln = true;
  s.placed = [{ id: 'p1', type: 'kiln', tx: 5, ty: 5, level: 2 }];
  assert.equal(PR.slots(s, 'kiln'), 3);
  s.inv = {};
  assert.equal(PR.enqueue(s, 'kiln', 'brick', 100).reason, 'المواد ناقصة');
});

test('jobs finish one after another and are collected with stats', () => {
  const s = base();
  PR.enqueue(s, 'kiln', 'brick', 0);
  PR.enqueue(s, 'kiln', 'brick', 0);
  const js = PR.jobs(s, 'kiln', 30);
  assert.equal(js[0].started, true);
  assert.equal(js[1].started, false, 'second waits for the first');
  assert.equal(PR.readyCount(s, 59), 0);
  assert.equal(PR.readyCount(s, 60), 1);
  const r = PR.collect(s, 'kiln', 60);
  assert.deepEqual(r.out, { brick: 1 });
  assert.equal(s.stats.crafted, 1);
  assert.equal(PR.queue(s, 'kiln').length, 1);
  assert.deepEqual(PR.collect(s, 'kiln', 119).out, {});
  assert.deepEqual(PR.collect(s, 'kiln', 120).out, { brick: 1 });
});

test('double chance and rushing with coins', () => {
  const s = base();
  PR.enqueue(s, 'kiln', 'brick', 0);
  assert.deepEqual(PR.collect(s, 'kiln', 60, () => 0.1, 0.5).out, { brick: 2 });
  PR.enqueue(s, 'kiln', 'brick', 60);
  PR.enqueue(s, 'kiln', 'brick', 60);
  s.player.coins = 100;
  const cost = PR.rushCost(PR.queue(s, 'kiln')[0], 60);
  assert.equal(cost, 8);
  assert.ok(PR.rush(s, 'kiln', 0, 60).ok);
  assert.equal(s.player.coins, 92);
  assert.equal(PR.readyCount(s, 60), 1);
  assert.equal(PR.queue(s, 'kiln')[1].end, 120, 'the next one moves up');
  assert.equal(PR.isTimed('workbench'), false, 'workbench stays instant');
});
