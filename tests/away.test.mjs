import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../web/js/systems/state.js';
import { catchUp, worthShowing, AWAY_MIN_MS } from '../web/js/systems/away.js';
import { planNotifications, avoidNight, MAX_NOTIFS, NOTIF_IDS } from '../web/js/systems/notify.js';
import * as PR from '../web/js/systems/production.js';

const H = 3600000;

test('short breaks show nothing; long ones grow watered crops, finish workshops and lay eggs', () => {
  const t0 = new Date(2026, 9, 8, 12).getTime();
  const s = newState(t0);
  s.lastSeen = t0;
  assert.equal(catchUp(s, t0 + AWAY_MIN_MS - 1000, 500), null);
  s.plots = { a: { seed: 'seed_wheat', stage: 0, watered: true }, b: { seed: 'seed_wheat', stage: 0, watered: false } };
  s.inv = { clay: 10, water: 5, wood: 5 }; s.tech.t_brick = true;
  PR.enqueue(s, 'kiln', 'brick', 500);
  s.built.coop = true; s.coop = { hens: 3, feedMin: 480, eggs: 0, last: 500, acc: 0 };
  const rep = catchUp(s, t0 + 2 * H, 500);
  assert.equal(rep.grown, 1);
  assert.equal(s.plots.a.stage, 1);
  assert.equal(s.plots.a.watered, false);
  assert.equal(s.plots.b.stage, 0, 'dry plot does not grow');
  assert.equal(rep.jobs.kiln, 1);
  assert.equal(PR.readyCount(s, 500, 'kiln'), 1);
  assert.ok(rep.eggs > 0 && rep.eggs <= 12);
  assert.ok(s.coop.feedMin < 480);
  assert.ok(rep.coins > 0);
  assert.ok(worthShowing(rep));
});

test('notifications: at most 3, never at night, and respect the setting', () => {
  const s = newState(0);
  s.plots = { a: { seed: 'seed_wheat', stage: 99, watered: true } };
  s.plots.a.stage = 0; s.plots.a.seed = 'seed_wheat';
  const night = new Date(2026, 9, 8, 23, 30).getTime();
  const fixed = avoidNight(night);
  const d = new Date(fixed);
  assert.equal(d.getHours(), 9);
  assert.equal(d.getDate(), 9);
  const noon = new Date(2026, 9, 8, 12).getTime();
  s.built.coop = true; s.coop = { hens: 3, feedMin: 300, eggs: 0, last: 0, acc: 0 };
  s.inv = { clay: 10, water: 5, wood: 5 }; s.tech.t_brick = true;
  PR.enqueue(s, 'kiln', 'brick', 0);
  const list = planNotifications(s, noon, 0);
  assert.ok(list.length <= MAX_NOTIFS);
  assert.ok(list.some(n => n.id === NOTIF_IDS.eggs));
  assert.ok(list.some(n => n.id === NOTIF_IDS.daily));
  for (const n of list) {
    const h = new Date(noon + n.minutes * 60000).getHours();
    assert.ok(h >= 8 && h < 22, `${n.title} at ${h}`);
  }
  s.settings.notify = false;
  assert.deepEqual(planNotifications(s, noon, 0), []);
});
