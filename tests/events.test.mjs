import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../web/js/systems/state.js';
import { currentEvent, ensureEvent, addTokens, canClaimTier, claimTier, tierCost, usePlay, playsLeft, adPlaysLeft, deliver, leaderboard, boostFor, racePlace, raceTokens, falconHit, raceBaseSpeed } from '../web/js/systems/events.js';
import { EVENTS, EVENT_DAYS, TRACK_COSTS, DAILY_PLAYS } from '../web/js/data/events.js';

const DAY = 86400000;
const T0 = new Date(2026, 8, 27, 10).getTime();

test('events rotate every 2 days through all events', () => {
  const seen = new Set();
  for (let i = 0; i < EVENTS.length * EVENT_DAYS; i++) seen.add(currentEvent(T0 + i * DAY).def.id);
  assert.equal(seen.size, EVENTS.length);
  const a = currentEvent(T0), b = currentEvent(a.endMs - 1000), c = currentEvent(a.endMs + 1000);
  assert.equal(a.key, b.key);
  assert.notEqual(a.key, c.key);
});

test('event progress resets when the event changes', () => {
  const s = newState(T0);
  ensureEvent(s, T0);
  addTokens(s, 30);
  ensureEvent(s, T0 + 1000);
  assert.equal(s.event.tokens, 30);
  ensureEvent(s, currentEvent(T0).endMs + 1000);
  assert.equal(s.event.tokens, 0);
});

test('reward track costs rise per tier and with stage, claims in order', () => {
  const s = newState(T0);
  ensureEvent(s, T0);
  for (let i = 1; i < TRACK_COSTS.length; i++) assert.ok(tierCost(s, i) > tierCost(s, i - 1));
  const lo = tierCost(s, 3);
  s.player.level = 25;
  assert.ok(tierCost(s, 3) > lo, 'harder at higher stage');
  s.player.level = 1;
  assert.equal(canClaimTier(s), false);
  addTokens(s, tierCost(s, 0));
  const r = claimTier(s);
  assert.equal(r.tier, 0);
  assert.equal(s.event.tokens, 0);
  assert.equal(claimTier(s), null);
});

test('mini-game plays are limited per day, with extra ad plays', () => {
  const s = newState(T0);
  ensureEvent(s, T0);
  for (let i = 0; i < DAILY_PLAYS; i++) assert.ok(usePlay(s, T0));
  assert.equal(usePlay(s, T0), false);
  assert.equal(playsLeft(s, T0), 0);
  assert.ok(usePlay(s, T0, true));
  assert.ok(usePlay(s, T0, true));
  assert.equal(adPlaysLeft(s, T0), 0);
  assert.equal(playsLeft(s, T0 + DAY), DAILY_PLAYS);
});

test('race and falcon scoring', () => {
  assert.ok(boostFor(0.95) > boostFor(0.6));
  assert.ok(boostFor(0.1) < 0);
  assert.equal(racePlace(50, [40, 60, 70, 80]), 2);
  assert.ok(raceTokens(1) > raceTokens(5));
  assert.ok(raceBaseSpeed(90) > raceBaseSpeed(20));
  assert.ok(falconHit(100, 110));
  assert.equal(falconHit(100, 140), false);
});

test('dates festival delivery converts dates into baskets', () => {
  let t = T0;
  while (currentEvent(t).def.id !== 'dates_festival') t += DAY;
  const s = newState(t);
  ensureEvent(s, t);
  s.inv.dates = 20;
  assert.equal(deliver(s, t), 2);
  assert.equal(s.inv.dates, 4);
  const lb = leaderboard(s, t);
  assert.equal(lb.length, 10);
  assert.ok(lb.some(r => r.me));
});
