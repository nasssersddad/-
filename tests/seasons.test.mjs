import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../web/js/systems/state.js';
import * as S from '../web/js/systems/seasons.js';
import { IFTAR_MILESTONES } from '../web/js/data/seasons.js';
import { dayWeather } from '../web/js/systems/weather.js';

const at = (y, m, d) => new Date(y, m - 1, d, 12).getTime();

test('real dates: Ramadan, both Eids, winter, and nothing in October', () => {
  assert.equal(S.currentSeason(at(2027, 2, 8)).id, 'ramadan');
  assert.equal(S.currentSeason(at(2027, 3, 9)).id, 'eid_fitr');
  assert.equal(S.currentSeason(at(2027, 5, 16)).id, 'eid_adha');
  assert.equal(S.currentSeason(at(2026, 12, 15)).id, 'winter');
  assert.equal(S.currentSeason(at(2026, 10, 16)), null);
  assert.equal(S.currentSeason(at(2027, 2, 5)).id, 'winter', 'winter before Ramadan starts');
  assert.equal(S.currentSeason(at(2026, 10, 16), 'eid_fitr').id, 'eid_fitr', 'override for previews');
});

test('the backup Hijri math stays within two days of Umm al-Qura', () => {
  const idx = (h) => h.year * 354.367 + (h.month - 1) * 29.53 + h.day;
  for (let t = at(2026, 1, 1); t < at(2031, 1, 1); t += 7 * 86400000) {
    const a = S.hijri(t), b = S.tabularHijri(t);
    assert.ok(Math.abs(idx(a) - idx(b)) <= 2.5, `${new Date(t).toDateString()}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  }
});

test('season keys renew every year; progress resets with a new season', () => {
  const s = newState(0);
  const ram = S.seasonById('ramadan');
  const a = S.seasonState(s, ram, at(2027, 2, 10));
  a.iftar = 7;
  assert.equal(S.seasonState(s, ram, at(2027, 2, 20)).iftar, 7, 'same Ramadan keeps progress');
  assert.notEqual(S.seasonKey(ram, at(2028, 1, 29)), S.seasonKey(ram, at(2027, 2, 10)));
  const w = S.seasonById('winter');
  assert.equal(S.seasonKey(w, at(2026, 12, 20)), S.seasonKey(w, at(2027, 2, 1)), 'one winter spans Dec to Feb');
});

test('iftar milestones pay once each; eidiya once a day and unlocks the outfit', () => {
  const s = newState(0);
  const ss = S.seasonState(s, S.seasonById('ramadan'), at(2027, 2, 10));
  const got = [];
  for (let i = 0; i < 31; i++) { const m = S.addIftar(ss); if (m) got.push(m.at); }
  assert.deepEqual(got, IFTAR_MILESTONES.map(m => m.at));
  assert.equal(S.nextIftar(ss), null);
  const e = S.seasonState(s, S.seasonById('eid_fitr'), at(2027, 3, 9));
  assert.ok(S.eidiya(s, e, at(2027, 3, 9)).coins > 0);
  assert.equal(S.eidiya(s, e, at(2027, 3, 9) + 3600000), null, 'once a day');
  assert.ok(S.eidiya(s, e, at(2027, 3, 10)));
  assert.equal(s.flags.eidOutfit, true);
  const w = S.seasonState(s, S.seasonById('winter'), at(2026, 12, 20));
  assert.ok(S.useCampfire(w, at(2026, 12, 20)));
  assert.equal(S.useCampfire(w, at(2026, 12, 20) + 1000), false);
});

test('winter rain chance is higher', () => {
  let normal = 0, winter = 0;
  for (let d = 1; d <= 600; d++) { if (dayWeather(7, d).rain) normal++; if (dayWeather(7, d, false, 0.5).rain) winter++; }
  assert.ok(winter > normal * 1.4, `${winter} vs ${normal}`);
});

test('the "none" override hides real seasons (used by automated tests)', () => {
  assert.equal(S.currentSeason(at(2026, 12, 15), 'none'), null);
});
