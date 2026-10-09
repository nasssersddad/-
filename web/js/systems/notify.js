// إشعارات الجوال لما تطلع من اللعبة: تذكّرك بالشي اللي بيجهز وأنت غايب
// (الأوقات مربوطة بشغل الغياب في away.js) — ثلاث بالكثير، وما فيه إشعارات بالليل
import { isReady } from './farming.js';
import { SEEDS } from '../data/items.js';
import * as coopSys from './coop.js';
import { queue, TIMED } from './production.js';
import { dailyStatus } from './retention.js';
import { GROW_AFTER_MS, AWAY_MIN_MS } from './away.js';

export const MAX_NOTIFS = 3;
export const QUIET_FROM = 22, QUIET_TO = 8; // من 10 بالليل لين 8 الصبح ما نزعجك
export const NOTIF_IDS = { daily: 1, crops: 2, eggs: 3, workshop: 4 };

// يأجل الوقت لو طاح بالليل للساعة 9 الصبح
export function avoidNight(ms) {
  const d = new Date(ms);
  const h = d.getHours();
  if (h >= QUIET_FROM || h < QUIET_TO) {
    if (h >= QUIET_FROM) d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  }
  return ms;
}

function nextMorning(now, hour = 9) {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

// يرجع [{ id, minutes, title, text }] مرتبة بالأهمية
export function planNotifications(state, now, nowMin) {
  if (state.settings && state.settings.notify === false) return [];
  const list = [];
  const at = (id, ms, title, text) => list.push({ id, at: avoidNight(ms), title, text });
  // زرع مسقي بيجهز بعد الغياب
  const willRipen = Object.values(state.plots || {}).filter(p => p.watered && !isReady(p) && SEEDS[p.seed] && p.stage + 1 >= SEEDS[p.seed].days).length;
  if (willRipen) at(NOTIF_IDS.crops, now + GROW_AFTER_MS + 60000, '🌾 زرعك جاهز للحصاد!', `${willRipen} حوض جاهز. تعال احصده قبل لا يطير عليه الطير 😄`);
  // الدجاج ياكل ويبيض
  const c = coopSys.coop(state);
  if (state.built && state.built.coop && c.hens && c.feedMin > 0) at(NOTIF_IDS.eggs, now + 45 * 60000, '🥚 دجاجك باض!', 'القن فيه بيض ينتظرك. تعال اجمعه وأكّل الدجاج.');
  // المكافأة اليومية
  const ds = dailyStatus(state, now);
  if (ds.available) at(NOTIF_IDS.daily, now + 4 * 3600000, '🎁 مكافأتك اليومية تنتظرك', `اليوم ${ds.dayIndex + 1} من السلسلة 🔥 لا تكسرها!`);
  else at(NOTIF_IDS.daily, nextMorning(now), '🎁 مكافأة جديدة جاهزة!', `سلسلتك ${state.daily.streak} يوم 🔥 ادخل خذ مكافأة اليوم.`);
  // الورش
  const busy = Object.keys(TIMED).filter(st => queue(state, st).some(j => j.end > nowMin));
  if (busy.length) at(NOTIF_IDS.workshop, now + AWAY_MIN_MS + 5 * 60000, '🔥 الورش خلّصت شغلها', 'تعال استلم إنتاجك وحط طلبات جديدة.');
  return list.slice(0, MAX_NOTIFS).map(n => ({ id: n.id, minutes: Math.max(1, Math.round((n.at - now) / 60000)), title: n.title, text: n.text }));
}
