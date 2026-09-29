import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../web/js/systems/state.js';
import * as C from '../web/js/systems/coop.js';

test('hens lay only while fed, eggs are capped, feed runs down', () => {
  const s = newState(0);
  s.inv = { wheat: 3 };
  assert.ok(C.giftHens(s));
  assert.equal(s.coop.hens, 3);
  C.coopTick(s, 0);
  assert.equal(C.coopTick(s, 600), 0, 'no feed → no eggs');
  assert.ok(C.hungry(s));
  assert.equal(C.addFeed(s, 'wheat', 1), 1);
  assert.equal(s.coop.feedMin, 240);
  const n = C.coopTick(s, 840);
  assert.equal(n, 6, '3 hens × 240 min / 120');
  assert.equal(s.coop.feedMin, 0);
  C.addFeed(s, 'wheat', 2);
  C.coopTick(s, 840 + 480);
  assert.equal(s.coop.eggs, 12, 'capped at hens × 4');
  assert.equal(C.collectEggs(s), 12);
  assert.equal(s.coop.eggs, 0);
  assert.equal(C.addFeed(s, 'tomato', 1), 0, 'tomatoes are not hen feed');
});

test('buying hens respects the coop capacity', () => {
  const s = newState(0);
  C.giftHens(s);
  s.player.coins = 1000;
  for (let i = 0; i < 3; i++) assert.ok(C.buyHen(s).ok);
  assert.equal(s.coop.hens, 6);
  assert.match(C.buyHen(s).reason, /مليان/);
  assert.equal(s.player.coins, 1000 - 3 * C.HEN_PRICE);
});
