import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../web/js/systems/state.js';
import { dayWeather, rainAt, rainIntensity, rainbowAt, applyRain, RAIN_CHANCE } from '../web/js/systems/weather.js';
import { buildWorld } from '../web/js/data/map.js';

test('weather is deterministic per seed and day, rains about 30% of days', () => {
  assert.deepEqual(dayWeather(7, 12), dayWeather(7, 12));
  let rain = 0;
  for (let d = 1; d <= 1000; d++) {
    const w = dayWeather(99, d);
    if (w.rain) { rain++; assert.ok(w.start >= 6 && w.end <= 22 && w.end > w.start); }
  }
  assert.ok(Math.abs(rain / 1000 - RAIN_CHANCE) < 0.05, 'rain ratio ' + rain);
});

test('no rain during a sandstorm, intensity and rainbow windows', () => {
  for (let d = 1; d < 50; d++) assert.equal(dayWeather(3, d, true).rain, false);
  const w = { rain: true, start: 10, end: 13, heavy: true };
  assert.equal(rainAt(w, 9.9), false);
  assert.ok(rainAt(w, 11));
  assert.ok(rainIntensity(w, 11.5) > 0.9);
  assert.equal(rainIntensity(w, 14), 0);
  assert.ok(rainbowAt(w, 13.6) > 0.5);
  assert.equal(rainbowAt(w, 12), 0);
});

test('rain waters growing plots only, fills the trough and the herd drinks', () => {
  const s = newState(0);
  s.plots.plot0 = { seed: 'seed_tomato', stage: 0, watered: false };
  s.plots.plot1 = { seed: 'seed_tomato', stage: 2, watered: false }; // جاهز
  s.built.trough = true; s.trough.water = 0;
  s.camels.push({ id: 'c1', wateredDay: null });
  assert.equal(applyRain(s, 4), 1);
  assert.equal(s.plots.plot0.watered, true);
  assert.equal(s.plots.plot1.watered, false);
  assert.equal(s.trough.water, 3);
  assert.equal(s.camels[0].wateredDay, 4);
  assert.equal(s.stats.watered, 1, 'rain watering counts, so the watering quest never gets stuck on a rainy day');
});

test('the home farm has plenty of trees, rocks and clay', () => {
  const w = buildWorld();
  const n = (k) => w.objects.filter(o => o.kind === k).length;
  assert.ok(n('palm') + n('sidr') >= 30, 'trees ' + (n('palm') + n('sidr')));
  assert.ok(n('sidr') >= 10);
  assert.ok(n('rock') >= 22, 'rocks ' + n('rock'));
  assert.ok(n('clay') >= 12, 'clay ' + n('clay'));
  assert.ok(n('herb') >= 14, 'herbs ' + n('herb'));
});
