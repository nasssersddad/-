// الورش اللي تشتغل بالوقت (زي Hay Day): تحط طلبات بطابور، كل طلب ياخذ وقت، وتستلمها لما تخلص
import { RECIPES } from '../data/recipes.js';
import { has, remove, addStat } from './inventory.js';
import { typeLevel } from './placement.js';

export const TIMED = { kiln: true, mill: true, loom: true };
export const RUSH_PER_HOUR = 8; // دراهم لكل ساعة لعب باقية

export function isTimed(station) {
  return !!TIMED[station];
}

export function recipeTime(r) {
  return r.time || 60;
}

// عدد خانات الطابور: 2، وتزيد مع مستوى الورشة
export function slots(state, station) {
  return 1 + Math.max(1, typeLevel(state, station));
}

export function queue(state, station) {
  state.queues = state.queues || {};
  state.queues[station] = state.queues[station] || [];
  return state.queues[station];
}

// يحط طلب: يسحب المواد (من الحقيبة والمخازن)، ويبدأ بعد آخر طلب
export function enqueue(state, station, recipeId, nowMin) {
  const r = RECIPES.find(x => x.id === recipeId && x.station === station);
  if (!r) return { ok: false, reason: 'غير معروف' };
  if (r.tech && !state.tech[r.tech]) return { ok: false, reason: 'تحتاج تتعلمها' };
  const q = queue(state, station);
  if (q.length >= slots(state, station)) return { ok: false, reason: 'الطابور مليان' };
  if (!has(state, r.in)) return { ok: false, reason: 'المواد ناقصة' };
  remove(state, r.in);
  const last = q.length ? q[q.length - 1].end : nowMin;
  const start = Math.max(last, nowMin);
  const job = { recipe: r.id, start, end: start + recipeTime(r) };
  q.push(job);
  addStat(state, 'queued', 1);
  return { ok: true, job };
}

// حالة كل طلب: الباقي بالدقايق، والتقدّم، وجاهز ولا لا
export function jobs(state, station, nowMin) {
  return queue(state, station).map(j => {
    const total = j.end - j.start;
    const left = Math.max(0, j.end - nowMin);
    const started = nowMin >= j.start;
    return { ...j, left, ready: left <= 0, started, progress: started ? Math.min(1, 1 - left / total) : 0 };
  });
}

export function readyCount(state, nowMin, station = null) {
  const list = station ? [station] : Object.keys(TIMED);
  return list.reduce((a, st) => a + queue(state, st).filter(j => j.end <= nowMin).length, 0);
}

// يستلم الجاهز. يرجع الإنتاج { out: {id: n}, xp, done: [recipeIds], bonus }
export function collect(state, station, nowMin, rng = Math.random, doubleChance = 0) {
  const q = queue(state, station);
  const out = {};
  let xp = 0, bonus = 0;
  const done = [];
  while (q.length && q[0].end <= nowMin) {
    const j = q.shift();
    const r = RECIPES.find(x => x.id === j.recipe);
    if (!r) continue;
    const twice = doubleChance && rng() < doubleChance;
    for (const [id, n] of Object.entries(r.out)) out[id] = (out[id] || 0) + n * (twice ? 2 : 1);
    if (twice) bonus++;
    xp += r.xp;
    for (const [t, n] of Object.entries(r.kp || {})) state.kp[t] = (state.kp[t] || 0) + n;
    addStat(state, 'crafted', 1);
    addStat(state, 'craft_' + r.id, 1);
    done.push(r.id);
  }
  return { out, xp, done, bonus };
}

export function rushCost(job, nowMin) {
  const left = Math.max(0, job.end - nowMin);
  return Math.max(1, Math.ceil(left / 60) * RUSH_PER_HOUR);
}

// يخلّص الطلب رقم idx (والطلبات قبله) على طول بدراهم
export function rush(state, station, idx, nowMin) {
  const q = queue(state, station);
  const j = q[idx];
  if (!j || j.end <= nowMin) return { ok: false };
  const cost = rushCost(j, nowMin);
  if (state.player.coins < cost) return { ok: false, reason: 'poor', cost };
  state.player.coins -= cost;
  const shift = j.end - nowMin;
  for (let i = 0; i < q.length; i++) {
    if (i <= idx) { q[i].end = Math.min(q[i].end, nowMin); q[i].start = Math.min(q[i].start, nowMin); }
    else { q[i].start -= shift; q[i].end -= shift; }
  }
  addStat(state, 'rushed', 1);
  return { ok: true, cost };
}
