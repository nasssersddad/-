// العمّال: التوظيف، الرواتب بالساعة، الإضراب والغرامة، ومهام البناء
import { WORKER_TYPES, WORKER_NAMES, WORKER_LOOKS, WORK_START, WORK_END, STRIKE_AFTER, FINE_RATE, FINE_MIN, WORKER_CAP } from '../data/workers.js';
import { BUILD_SPOTS } from '../data/recipes.js';
import { mulberry32, hashString, pick, randInt } from './util.js';
import { has, remove, addStat } from './inventory.js';
import { spotStatus } from './crafting.js';
import { stars } from './progression.js';

export function workerCap(state) {
  if (state.built.workers_house2) return WORKER_CAP.workers_house2;
  if (state.built.workers_house) return WORKER_CAP.workers_house;
  return WORKER_CAP.base;
}

// 3 مرشحين كل يوم لعبة
export function candidates(state, day) {
  const rng = mulberry32(hashString('cand:' + state.seed + ':' + day));
  const types = Object.keys(WORKER_TYPES);
  return [0, 1, 2].map(i => {
    const type = i < types.length ? types[(day + i) % types.length] : pick(rng, types);
    const T = WORKER_TYPES[type];
    const speed = Math.round((0.8 + rng() * 0.5) * 100) / 100;
    return {
      cid: `cand${day}_${i}`, type, name: pick(rng, WORKER_NAMES), look: randInt(rng, 0, WORKER_LOOKS.length - 1),
      speed, wage: Math.max(2, Math.round(T.wage * (0.8 + speed * 0.3))), hire: Math.round(T.hire * (0.8 + speed * 0.4)),
    };
  });
}

export function hire(state, cand) {
  if (state.workers.length >= workerCap(state)) return { ok: false, reason: 'full' };
  if (state.workers.some(w => w.cid === cand.cid)) return { ok: false, reason: 'hired' };
  if (state.player.coins < cand.hire) return { ok: false, reason: 'poor' };
  state.player.coins -= cand.hire;
  state.workerSeq = (state.workerSeq || 0) + 1;
  const w = { id: 'w' + state.workerSeq, cid: cand.cid, type: cand.type, name: cand.name, look: cand.look, speed: cand.speed, wage: cand.wage, owed: 0, late: 0, status: 'work', fine: 0, job: null };
  state.workers.push(w);
  addStat(state, 'hired', 1);
  return { ok: true, worker: w };
}

export function fire(state, id) {
  const w = state.workers.find(x => x.id === id);
  if (!w) return false;
  if (w.job && w.job.spot) refundJob(state, w);
  state.workers = state.workers.filter(x => x.id !== id);
  return true;
}

export function isWorkHour(hour) {
  return hour >= WORK_START && hour < WORK_END;
}

// ساعة لعبة وحدة. hour = الساعة اللي خلصت
export function hourTick(state, hour) {
  const ev = [];
  if (!isWorkHour(hour)) return ev;
  for (const w of state.workers) {
    if (w.status === 'strike') continue;
    w.owed += w.wage;
  }
  if (state.payroll.auto) {
    const owed = totalOwed(state);
    if (owed > 0 && state.player.coins >= owed) {
      payAll(state);
      ev.push({ type: 'autopay', amount: owed });
    }
  }
  for (const w of state.workers) {
    if (w.status === 'strike') continue;
    if (w.owed > 0) {
      w.late += 1;
      if (w.late >= STRIKE_AFTER) {
        w.status = 'strike';
        w.fine = Math.max(FINE_MIN, Math.round(w.owed * FINE_RATE));
        ev.push({ type: 'strike', worker: w });
      } else if (w.late === STRIKE_AFTER - 1) {
        ev.push({ type: 'late', worker: w });
      }
    }
  }
  return ev;
}

export function totalOwed(state) {
  return state.workers.filter(w => w.status !== 'strike').reduce((s, w) => s + w.owed, 0);
}

// يسدد رواتب العمال الشغالين (المضربين يحتاجون غرامة)
export function payAll(state) {
  const due = totalOwed(state);
  if (due <= 0 || state.player.coins < due) return 0;
  state.player.coins -= due;
  for (const w of state.workers) {
    if (w.status === 'strike') continue;
    w.owed = 0;
    w.late = 0;
  }
  addStat(state, 'wagesPaid', due);
  return due;
}

export function reinstateCost(w) {
  return w.owed + w.fine;
}

export function reinstate(state, id) {
  const w = state.workers.find(x => x.id === id);
  if (!w || w.status !== 'strike') return 0;
  const cost = reinstateCost(w);
  if (state.player.coins < cost) return 0;
  state.player.coins -= cost;
  w.owed = 0; w.late = 0; w.fine = 0; w.status = 'work';
  addStat(state, 'wagesPaid', cost);
  return cost;
}

// ---------- البناء ----------
export function buildHours(spotId) {
  return 2 + Math.round((BUILD_SPOTS[spotId].rating || 0) / 5);
}

export function assignBuild(state, workerId, spotId) {
  const w = state.workers.find(x => x.id === workerId);
  if (!w || w.type !== 'builder' || w.job) return { ok: false, reason: 'busy' };
  if (state.workers.some(x => x.job && x.job.spot === spotId)) return { ok: false, reason: 'taken' };
  const st = spotStatus(state, spotId);
  if (!st.ok) return { ok: false, reason: st.reason };
  remove(state, BUILD_SPOTS[spotId].cost);
  w.job = { spot: spotId, progress: 0, need: buildHours(spotId) };
  return { ok: true };
}

function refundJob(state, w) {
  const cost = BUILD_SPOTS[w.job.spot].cost;
  for (const [id, n] of Object.entries(cost)) state.inv[id] = (state.inv[id] || 0) + n;
  w.job = null;
}

export function cancelBuild(state, workerId) {
  const w = state.workers.find(x => x.id === workerId);
  if (!w || !w.job) return false;
  refundJob(state, w);
  return true;
}

// يضيف تقدم بالساعات. يرجع الموقع إذا خلص
export function progressBuild(state, w, hours) {
  if (!w.job || w.status === 'strike') return null;
  w.job.progress += hours * w.speed;
  if (w.job.progress < w.job.need) return null;
  const spot = w.job.spot;
  state.built[spot] = true;
  addStat(state, 'built', 1);
  addStat(state, 'workerBuilds', 1);
  state.stats.stars = Math.max(state.stats.stars || 0, stars(state));
  w.job = null;
  return spot;
}

export { WORKER_TYPES };
