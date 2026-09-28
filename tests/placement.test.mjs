import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../web/js/systems/state.js';
import { buildWorld, KHAN } from '../web/js/data/map.js';
import * as P from '../web/js/systems/placement.js';

const world = buildWorld();

test('buildings go outside the house only, furniture inside only', () => {
  const s = newState(0);
  assert.equal(P.canPlace(s, world, 'kiln', 30, 20).ok, false, 'kiln inside the house');
  assert.match(P.canPlace(s, world, 'kiln', 30, 20).reason, /ساحة الورش/);
  const out = P.findFreeSpot(s, world, 'kiln', { x: 16, y: 32 });
  assert.ok(out, 'there is room outside');
  assert.ok(P.canPlace(s, world, 'kiln', out.tx, out.ty).ok);
  assert.equal(P.canPlace(s, world, 'chest', out.tx, out.ty).ok, false, 'chest outside');
  const inside = P.findFreeSpot(s, world, 'chest', { x: 25, y: 18 });
  assert.ok(inside && inside.tx > KHAN.x0 && inside.tx < KHAN.x1, 'chest fits inside the house');
});

test('no placing on water, road, farm soil, or on top of trees and other buildings', () => {
  const s = newState(0);
  assert.match(P.canPlace(s, world, 'fence', 53, 20).reason, /الماي/);
  assert.match(P.canPlace(s, world, 'fence', 10, 29).reason, /الطريق/);
  assert.match(P.canPlace(s, world, 'fence', 44, 32).reason, /الزراعة/);
  const palm = world.objects.find(o => o.kind === 'palm' && o.tx > 5);
  assert.equal(P.canPlace(s, world, 'fence', palm.tx, palm.ty).ok, false);
  const spot = P.findFreeSpot(s, world, 'kiln', { x: 16, y: 34 });
  const r = P.place(s, world, 'kiln', spot.tx, spot.ty);
  assert.ok(r.ok && !P.isBuilt(s, r.p), 'building goes down as a site');
  assert.match(P.canPlace(s, world, 'fence', spot.tx, spot.ty).reason, /يتداخل/);
  assert.equal(P.place(s, world, 'kiln', spot.tx + 5, spot.ty).ok, false, 'only one kiln');
});

test('trough must sit inside the pen, and moving the pen carries the trough', () => {
  const s = newState(0);
  const pen = P.findFreeSpot(s, world, 'stable', { x: 50, y: 40 });
  const st = P.place(s, world, 'stable', pen.tx, pen.ty).p;
  s.built.stable = true;
  assert.equal(P.canPlace(s, world, 'trough', pen.tx - 4, pen.ty).ok, false);
  const tr = P.place(s, world, 'trough', pen.tx + 1, pen.ty + 2);
  assert.ok(tr.ok, tr.reason);
  const dest = P.findFreeSpot(s, world, 'stable', { x: 12, y: 40 });
  const mv = P.move(s, world, st.id, dest.tx, dest.ty);
  assert.ok(mv.ok, mv.reason);
  assert.equal(tr.p.tx, dest.tx + 1);
  assert.equal(tr.p.ty, dest.ty + 2);
  const r = P.pxRect(st);
  assert.ok(r.x0 > dest.tx * 16 && r.x1 < (dest.tx + 7) * 16);
});

test('old saves keep outdoor buildings where they were and move workshops out of the house', () => {
  const s = newState(0);
  Object.assign(s.built, { stable: true, trough: true, sheepfold: true, kiln: true, mill: true, pen2: true, stall_shop: true });
  const r = P.migrate(s, world);
  const pen = P.placedOf(s, 'stable')[0];
  assert.deepEqual([pen.tx, pen.ty], [53, 31]);
  assert.deepEqual([P.placedOf(s, 'sheepfold')[0].tx, P.placedOf(s, 'sheepfold')[0].ty], [34, 34]);
  assert.deepEqual(r.moved.sort(), ['kiln', 'mill']);
  for (const t of ['kiln', 'mill']) {
    const k = P.placedOf(s, t)[0];
    assert.ok(!P.insideKhan(k.tx, k.ty), t + ' is outside');
  }
  assert.equal(P.levelOf(s, pen), 2, 'pen2 became level 2');
  assert.deepEqual(P.migrate(s, world).moved, [], 'runs once');
});

test('upgrades, comfort and beauty', () => {
  const s = newState(0);
  const spot = P.findFreeSpot(s, world, 'stall_shop', { x: 14, y: 34 });
  const st = P.place(s, world, 'stall_shop', spot.tx, spot.ty).p;
  s.built.stall_shop = true;
  assert.equal(P.stallSpeed(s), 1);
  assert.ok(P.applyUpgrade(s, st));
  assert.equal(P.stallSpeed(s), 1.25);
  const c = P.findFreeSpot(s, world, 'f_carpet', { x: 25, y: 18 });
  P.place(s, world, 'f_carpet', c.tx, c.ty);
  const b = P.findFreeSpot(s, world, 'f_bed', { x: 25, y: 20 });
  P.place(s, world, 'f_bed', b.tx, b.ty);
  assert.equal(P.comfort(s), 7);
  for (let i = 0; i < 20; i++) { const f = P.findFreeSpot(s, world, 'flowers', { x: 12, y: 38 }); P.place(s, world, 'flowers', f.tx, f.ty); }
  assert.ok(P.beauty(s) >= 60);
  assert.equal(P.beautyBonus(s), 0.06);
});

test('fields: placed on sand or farm soil, price rises, limit grows with level; planted fields move with their crop', () => {
  const s = newState(0);
  s.player.level = 2;
  assert.equal(P.maxFields(s), 5);
  assert.equal(P.fieldPrice(s), 20);
  assert.ok(P.canPlace(s, world, 'field', 44, 32).ok, 'on farm soil next to the fixed plots');
  const a = P.place(s, world, 'field', 44, 32).p;
  assert.equal(P.fieldPrice(s), 35);
  s.plots[P.fieldId(a)] = { seed: 'seed_tomato', stage: 1, watered: true };
  assert.match(P.removePlaced(s, a.id).reason, /احصده/);
  const dest = P.findFreeSpot(s, world, 'field', { x: 14, y: 36 });
  assert.ok(P.move(s, world, a.id, dest.tx, dest.ty).ok);
  assert.equal(s.plots[P.fieldId(a)].stage, 1, 'crop kept after moving');
  for (let i = 0; i < 10; i++) { const f = P.findFreeSpot(s, world, 'field', { x: 14, y: 38 }); P.place(s, world, 'field', f.tx, f.ty); }
  assert.equal(P.placedOf(s, 'field').length, 5, 'capped by level');
  const hit = P.pickAt(s, (a.tx + 0.5) * 16, (a.ty + 0.5) * 16);
  assert.equal(hit.id, a.id);
});
