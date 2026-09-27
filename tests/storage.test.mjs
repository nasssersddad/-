import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../web/js/systems/state.js';
import { buildWorld } from '../web/js/data/map.js';
import * as P from '../web/js/systems/placement.js';
import { bagUsed, bagCap, has, remove, count, stored, total } from '../web/js/systems/inventory.js';
import { applyReward } from '../web/js/systems/rewards.js';

const world = buildWorld();
const chest = (s) => { const c = P.findFreeSpot(s, world, 'chest', { x: 25, y: 18 }); return P.place(s, world, 'chest', c.tx, c.ty).p; };

test('the bag has a capacity; seeds do not count', () => {
  const s = newState(0);
  s.inv = {};
  assert.equal(bagCap(s), 150);
  s.inv.seed_tomato = 500;
  assert.equal(bagUsed(s), 0);
  const r = P.stow(s, { wood: 200 });
  assert.equal(r.bag.wood, 150);
  assert.equal(r.lost.wood, 50);
  assert.equal(P.roomFor(s, 1), false);
});

test('overflow goes into chests, then is lost', () => {
  const s = newState(0);
  s.inv = {};
  const c = chest(s);
  s.inv.stone = 150;
  const r = P.stow(s, { wood: 100 });
  assert.equal(r.chest.wood, 80);
  assert.equal(r.lost.wood, 20);
  assert.equal(P.chestUsed(s, c.id), 80);
  assert.equal(P.removePlaced(s, c.id).ok, false, 'cannot remove a full chest');
});

test('building and crafting take from the bag first, then the chests', () => {
  const s = newState(0);
  s.inv = {};
  const c = chest(s);
  s.inv.plank = 2;
  s.chests[c.id].items.plank = 5;
  assert.equal(total(s, 'plank'), 7);
  assert.ok(has(s, { plank: 6 }));
  assert.ok(remove(s, { plank: 6 }));
  assert.equal(count(s, 'plank'), 0);
  assert.equal(stored(s, 'plank'), 1);
});

test('deposit and withdraw respect the chest and bag limits; rewards are never blocked', () => {
  const s = newState(0);
  s.inv = {};
  const c = chest(s);
  s.inv.clay = 100;
  assert.equal(P.deposit(s, c.id, 'clay', 100), 80);
  assert.equal(count(s, 'clay'), 20);
  s.inv.stone = 130;
  assert.equal(P.withdraw(s, c.id, 'clay', 50), 0, 'bag is full');
  s.inv.stone = 100;
  assert.equal(P.withdraw(s, c.id, 'clay', 50), 30);
  s.inv.stone = 1000;
  applyReward(s, { items: { wood: 5 } }, Math.random);
  assert.equal(count(s, 'wood'), 5);
});

test('the barn takes building materials only, first, and only once built', () => {
  const s = newState(0);
  s.inv = {};
  const f = P.findFreeSpot(s, world, 'barn', { x: 14, y: 36 });
  const barn = P.place(s, world, 'barn', f.tx, f.ty).p;
  const c = chest(s);
  s.inv.stone = 150;
  let r = P.stow(s, { wood: 10 });
  assert.equal(r.chest.wood, 10, 'unbuilt barn: goes to the chest');
  assert.equal(P.chestUsed(s, barn.id), 0);
  s.built.barn = true;
  r = P.stow(s, { wood: 10, tomato: 5 });
  assert.equal(s.chests[barn.id].items.wood, 10, 'materials go to the barn first');
  assert.equal(s.chests[c.id].items.tomato, 5, 'crops go to chests');
  assert.equal(P.chestCap(s, barn.id), 200);
  s.inv.tomato = 3;
  assert.equal(P.deposit(s, barn.id, 'tomato', 3), 0, 'barn refuses crops');
  assert.ok(has(s, { wood: 20 }), 'building can use barn + chest wood');
});
