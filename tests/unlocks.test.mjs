import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../web/js/systems/state.js';
import { UNLOCKS, isUnlocked, newlyUnlocked, markAllSeen } from '../web/js/systems/unlocks.js';
import { MAIN_QUESTS } from '../web/js/data/quests.js';

test('a new player sees only the bag, the store and the help', () => {
  const s = newState(0);
  const open = UNLOCKS.filter(u => isUnlocked(s, u.id)).map(u => u.id).sort();
  assert.deepEqual(open, ['help', 'inventory', 'store']);
});

test('buttons open as quests progress, and old saves see everything', () => {
  const s = newState(0);
  markAllSeen(s);
  s.quest.index = 1;
  assert.deepEqual(newlyUnlocked(s).map(u => u.id), ['rewards']);
  assert.deepEqual(newlyUnlocked(s), [], 'announced once');
  s.quest.index = MAIN_QUESTS.findIndex(q => q.id === 'q_kiln');
  const ids = newlyUnlocked(s).map(u => u.id);
  assert.ok(ids.includes('manage') && ids.includes('tech'));
  assert.ok(!isUnlocked(s, 'camels'));
  s.built.stable = true;
  assert.ok(isUnlocked(s, 'camels'));
  const old = newState(0);
  old.quest.index = 12; old.player.level = 8; old.relics = { r1: 1 };
  for (const u of UNLOCKS) assert.ok(isUnlocked(old, u.id), u.id);
});

test('unknown ids are never hidden', () => {
  assert.ok(isUnlocked(newState(0), 'settings'));
});
