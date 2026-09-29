import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../web/js/systems/state.js';
import { buildWorld } from '../web/js/data/map.js';
import * as P from '../web/js/systems/placement.js';
import { BUILD_ZONES, inZone, isZoneOpen, unlockZone, zoneById, zoneCenter } from '../web/js/data/zones.js';
import { PLACEABLES } from '../web/js/data/buildings.js';

const world = buildWorld();

test('starting zones are open; expansion zones start locked with rising prices', () => {
  const s = newState(0);
  for (const id of ['workshops', 'workers', 'market', 'farm', 'livestock']) assert.ok(isZoneOpen(s, zoneById(id)), id);
  const locked = BUILD_ZONES.filter(z => z.lock);
  assert.ok(locked.length >= 3);
  for (const z of locked) assert.equal(isZoneOpen(s, z), false, z.id);
  const byLevel = [...locked].sort((a, b) => a.lock.level - b.lock.level);
  for (let i = 1; i < byLevel.length; i++) assert.ok(byLevel[i].lock.coins >= byLevel[i - 1].lock.coins);
});

test('every expansion zone, once open, fits each building type it allows', () => {
  for (const z of BUILD_ZONES.filter(q => q.lock)) {
    const s = newState(0);
    s.zonesOpen = { [z.id]: true };
    for (const type of z.types) {
      if (PLACEABLES[type].inside) continue;
      const c = zoneCenter(z);
      const spot = P.findFreeSpot(s, world, type, c);
      assert.ok(spot, `${type} fits in ${z.id}`);
      // لازم يكون بساحة مفتوحة
      const fp = P.footprint({ type, ...spot });
      assert.ok(BUILD_ZONES.some(q => q.types.includes(type) && isZoneOpen(s, q) && inZone(q, fp)), `${type} placed in an open zone`);
    }
  }
});

test('unlocking twice does nothing and the zone counts in stats', () => {
  const s = newState(0);
  s.player.level = 10; s.player.coins = 10000;
  assert.ok(unlockZone(s, 'north').ok);
  assert.equal(s.player.coins, 6000);
  assert.equal(unlockZone(s, 'north').ok, false);
  assert.equal(s.player.coins, 6000);
  assert.equal(s.stats.zonesOpened, 1);
  assert.equal(unlockZone(s, 'farm').ok, false, 'starting zones cannot be bought');
});

test('free-spot search avoids locked zones while an open one fits', () => {
  const s = newState(0);
  const north = zoneById('north');
  // نقطة قريبة من ساحة الشمال المسكّرة (وبعيدة عن ساحة الورش): لازم ينحط بساحة الورش
  const spot = P.findFreeSpot(s, world, 'kiln', { x: 40, y: 6 });
  assert.ok(spot);
  const fp = P.footprint({ type: 'kiln', ...spot });
  assert.equal(inZone(north, fp), false);
  assert.ok(inZone(zoneById('workshops'), fp));
  // ولو فتحتها، ينحط فيها لأنها أقرب
  s.zonesOpen = { north: true };
  const sp2 = P.findFreeSpot(s, world, 'kiln', { x: 40, y: 6 });
  assert.ok(inZone(north, P.footprint({ type: 'kiln', ...sp2 })));
});
