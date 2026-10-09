// وأنت غايب: المزرعة تكمّل شغلها (بحدود)، وترجع تلقى شي تستلمه
// الزرع المسقي يكبر مرحلة، الورش تخلّص طابورها، والدجاج يبيض على قد أكله
import { isReady } from './farming.js';
import * as coopSys from './coop.js';
import { queue, TIMED } from './production.js';
import { offlineEarnings } from './retention.js';
import { openOffersCount } from './market.js';

export const AWAY_MIN_MS = 15 * 60000;   // أقل غياب يطلع له ملخص
export const GROW_AFTER_MS = 60 * 60000; // الزرع المسقي يكبر مرحلة لو غبت ساعة
export const COOP_MIN_PER_HOUR = 600;     // كم دقيقة لعب يمشي القن عن كل ساعة غياب

// يطبّق شغل الغياب على الحالة ويرجع ملخص (مرة وحدة لكل غياب)
export function catchUp(state, now, nowMin) {
  const away = Math.max(0, now - (state.lastSeen || now));
  if (away < AWAY_MIN_MS) return null;
  const hours = away / 3600000;
  const rep = { hours, coins: 0, capped: false, grown: 0, ready: 0, eggs: 0, jobs: {}, offers: 0 };
  const off = offlineEarnings(state, now);
  if (off) { rep.coins = off.coins; rep.capped = off.capped; }
  if (away >= GROW_AFTER_MS) {
    for (const p of Object.values(state.plots || {})) {
      if (p.watered && !isReady(p)) { p.stage += 1; p.watered = false; rep.grown++; }
    }
  }
  rep.ready = Object.values(state.plots || {}).filter(p => isReady(p)).length;
  for (const st of Object.keys(TIMED)) {
    const q = queue(state, st);
    for (const j of q) if (j.end > nowMin) { j.start = Math.min(j.start, nowMin - 1); j.end = nowMin; }
    if (q.length) rep.jobs[st] = q.length;
  }
  const c = coopSys.coop(state);
  if (c.hens && c.feedMin > 0) {
    const before = c.eggs;
    c.last = nowMin - Math.min(c.feedMin, Math.round(hours * COOP_MIN_PER_HOUR));
    coopSys.coopTick(state, nowMin);
    rep.eggs = c.eggs - before;
  }
  rep.eggsTotal = c.eggs;
  rep.offers = state.market ? openOffersCount(state) : 0;
  return rep;
}

// فيه شي يستاهل نعرض شاشة؟
export function worthShowing(rep) {
  return !!rep && (rep.coins > 0 || rep.grown > 0 || rep.ready > 0 || rep.eggsTotal > 0 || Object.keys(rep.jobs).length > 0);
}
