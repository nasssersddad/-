import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../web/js/systems/state.js';
import { buildWorld, KHAN } from '../web/js/data/map.js';
import * as P from '../web/js/systems/placement.js';
import { BUILD_ZONES, zonesFor, inZone, zoneCenter } from '../web/js/data/zones.js';

const world = buildWorld();

test('zones do not overlap, avoid the house, and each has a sign', () => {
  for (const a of BUILD_ZONES) {
    for (const b of BUILD_ZONES) {
      if (a === b) continue;
      const o = a.rect.x0 <= b.rect.x1 && a.rect.x1 >= b.rect.x0 && a.rect.y0 <= b.rect.y1 && a.rect.y1 >= b.rect.y0;
      assert.equal(o, false, `${a.id} overlaps ${b.id}`);
    }
    assert.ok(a.rect.x1 < KHAN.x0 || a.rect.x0 > KHAN.x1 || a.rect.y1 < KHAN.y0 || a.rect.y0 > KHAN.y1, a.id + ' is outside the house');
    assert.ok(world.objects.some(o => o.kind === 'zonesign' && o.zone === a.id));
  }
});

test('buildings only inside their own zone; deco anywhere', () => {
  const s = newState(0);
  const farm = zoneCenter(BUILD_ZONES.find(z => z.id === 'farm'));
  const r = P.canPlace(s, world, 'kiln', farm.x, farm.y);
  assert.equal(r.ok, false);
  assert.match(r.reason, /ساحة الورش/);
  const k = P.findFreeSpot(s, world, 'kiln', { x: 11, y: 10 });
  assert.ok(zonesFor('kiln').some(z => inZone(z, P.footprint({ type: 'kiln', ...k }))));
  const out = P.findFreeSpot(s, world, 'fence', { x: 45, y: 6 });
  assert.ok(P.canPlace(s, world, 'fence', out.tx, out.ty).ok, 'deco outside zones is fine');
});

test('each zone fits what it is meant for', () => {
  const s = newState(0);
  s.player.level = 60;
  s.zonesOpen = Object.fromEntries(BUILD_ZONES.map(z => [z.id, true]));
  for (const t of ['kiln', 'mill', 'loom', 'barn', 'workers_house', 'stall_shop', 'orders_board', 'stable', 'sheepfold']) {
    const f = P.findFreeSpot(s, world, t, zoneCenter(zonesFor(t)[0]));
    assert.ok(f, t + ' fits');
    assert.ok(P.place(s, world, t, f.tx, f.ty).ok, t);
  }
  let fields = 0;
  for (let i = 0; i < 20; i++) { const f = P.findFreeSpot(s, world, 'field', { x: 45, y: 38 }); if (f && P.place(s, world, 'field', f.tx, f.ty).ok) fields++; }
  assert.equal(fields, 20);
});

test('old saves: buildings placed outside their zone are moved into it', () => {
  const s = newState(0);
  s.built.kiln = true;
  s.placed = [{ id: 'p1', type: 'kiln', tx: 47, ty: 24, flip: false, level: 1 }];
  s.placedVersion = 1;
  const r = P.migrate(s, world);
  assert.deepEqual(r.moved, ['kiln']);
  assert.ok(zonesFor('kiln').some(z => inZone(z, P.footprint(s.placed[0]))));
  s.built.stable = true;
  const s2 = newState(0);
  s2.built.stable = true;
  P.migrate(s2, world);
  assert.deepEqual([P.placedOf(s2, 'stable')[0].tx, P.placedOf(s2, 'stable')[0].ty], [53, 31], 'legacy pen stays');
});

test('locked zones: refuse placing until unlocked with level and coins; old saves unlock them', async () => {
  const { unlockZone, isZoneOpen, zoneById } = await import('../web/js/data/zones.js');
  const s = newState(0);
  const z = zoneById('farm2');
  const c = zoneCenter(z);
  const r = P.canPlace(s, world, 'field', c.x, c.y);
  assert.equal(r.ok, false);
  assert.equal(r.locked, 'farm2');
  assert.match(unlockZone(s, 'farm2').reason, /مستوى 5/);
  s.player.level = 5; s.player.coins = 100;
  assert.match(unlockZone(s, 'farm2').reason, /الدراهم/);
  s.player.coins = 1000;
  assert.ok(unlockZone(s, 'farm2').ok);
  assert.equal(s.player.coins, 200);
  assert.ok(isZoneOpen(s, z));
  assert.ok(P.canPlace(s, world, 'field', c.x, c.y).ok);
  // حفظ قديم فيه حظيرة بالساحة ٢
  const s2 = newState(0);
  s2.built.sheepfold = true;
  P.migrate(s2, world);
  assert.ok(isZoneOpen(s2, zoneById('livestock2')), 'legacy fold unlocks livestock2');
});
