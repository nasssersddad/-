import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, saveToStorage, loadSave, validSave, SAVE_KEY, BACKUP_KEY, CORRUPT_KEY } from '../web/js/systems/state.js';
import { PerfMonitor, WINDOW_MS } from '../web/js/engine/perf.js';

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };

test('a broken save falls back to the backup and the broken file is kept', () => {
  const st = mem();
  const s = newState(0); s.player.coins = 777;
  assert.ok(saveToStorage(s, st, { backup: true }));
  s.player.coins = 900;
  saveToStorage(s, st);
  assert.equal(loadSave(st).state.player.coins, 900);
  st.setItem(SAVE_KEY, '{"player": {"x": 1, "y"'); // ملف مقطوع
  const r = loadSave(st);
  assert.equal(r.source, 'backup');
  assert.equal(r.state.player.coins, 777);
  assert.ok(r.corrupt);
  assert.equal(st.getItem(CORRUPT_KEY), '{"player": {"x": 1, "y"');
  st.removeItem(BACKUP_KEY);
  const r2 = loadSave(st);
  assert.equal(r2.source, 'new');
  assert.equal(r2.state, null);
  assert.ok(r2.corrupt);
});

test('saves with a wrong shape are rejected; a failing storage reports false', () => {
  assert.equal(validSave({ player: { x: 'a', y: 1, coins: 0 } }), false);
  assert.equal(validSave({ player: { x: 1, y: 1, coins: 5 }, inv: [] }), false);
  assert.ok(validSave(newState(0)));
  const full = { setItem() { throw new Error('QuotaExceeded'); }, getItem() { return null; } };
  assert.equal(saveToStorage(newState(0), full), false);
});

test('the speed meter asks to lower quality only after two slow windows', () => {
  const p = new PerfMonitor();
  let t = 0;
  const run = (fps, ms) => { const step = 1000 / fps; for (let i = 0; i <= ms / step; i++) { t += step; p.frame(t, true); } };
  run(60, WINDOW_MS + 50);
  assert.ok(p.fps > 55 && !p.shouldLower());
  run(15, WINDOW_MS + 50);
  assert.equal(p.shouldLower(), false, 'one slow window is not enough');
  run(15, WINDOW_MS + 50);
  assert.ok(p.shouldLower());
  p.frame(t + 10, false);
  run(60, WINDOW_MS + 50);
  assert.equal(p.shouldLower(), false, 'a fast window resets it');
});
