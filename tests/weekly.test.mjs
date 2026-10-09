import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../web/js/systems/state.js';
import * as R from '../web/js/systems/retention.js';
import { dateKey } from '../web/js/systems/util.js';

const DAY = 86400000;

test('weekly challenge: 5 goals, same all week, new on Saturday, big reward once', () => {
  const sat = new Date(2026, 9, 10, 10).getTime(); // السبت
  assert.equal(new Date(sat).getDay(), 6);
  const s = newState(sat);
  assert.ok(R.ensureWeekly(s, sat));
  assert.equal(s.weekly.goals.length, R.WEEKLY_COUNT);
  assert.ok(!s.weekly.goals.some(g => g.id === 'eggs'), 'no egg goal without a coop');
  assert.equal(R.ensureWeekly(s, sat + 5 * DAY), false, 'same week through Thursday');
  assert.equal(R.weekIndex(sat - DAY) + 1, R.weekIndex(sat), 'Friday is the previous week');
  assert.equal(R.claimWeekly(s), null);
  for (const g of s.weekly.goals) s.stats[g.stat] = (s.stats[g.stat] || 0) + g.target;
  assert.ok(R.weeklyDone(s));
  assert.ok(R.pendingRewardsCount(s, sat) >= 1);
  const r = R.claimWeekly(s);
  assert.equal(r.chest, 'legendary');
  assert.ok(r.coins > 0);
  assert.equal(R.claimWeekly(s), null);
  assert.ok(R.ensureWeekly(s, sat + 7 * DAY));
  assert.equal(s.weekly.claimed, false);
});

test('a missed day can be restored once a week', () => {
  const now = new Date(2026, 9, 14, 10).getTime();
  const s = newState(now);
  s.daily.streak = 6;
  s.daily.lastClaim = dateKey(now - 2 * DAY);
  assert.ok(R.dailyStatus(s, now).broken);
  assert.ok(R.restoreStreak(s, now));
  const st = R.dailyStatus(s, now);
  assert.equal(st.broken, false);
  assert.equal(st.streak, 7);
  s.daily.lastClaim = dateKey(now - 2 * DAY);
  assert.equal(R.restoreStreak(s, now), false, 'only once a week');
});
