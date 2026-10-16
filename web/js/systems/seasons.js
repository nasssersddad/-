// المواسم: يحسب التاريخ الهجري، ويعرف وش الموسم الحين، ويحفظ تقدّم اللاعب فيه
import { SEASONS, IFTAR_MILESTONES } from '../data/seasons.js';
import { dateKey } from './util.js';

// ---------- التاريخ الهجري ----------
let fmt = null;
function intlHijri(ms) {
  try {
    fmt = fmt || new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
    if (fmt.resolvedOptions().calendar !== 'islamic-umalqura') return null;
    const parts = fmt.formatToParts(new Date(ms));
    const get = (t) => Number((parts.find(p => p.type === t) || {}).value);
    const r = { year: get('year'), month: get('month'), day: get('day') };
    return r.year && r.month && r.day ? r : null;
  } catch {
    return null;
  }
}

// احتياط لو الجوال ما يدعم تقويم أم القرى: التقويم الهجري الحسابي (يفرق يوم أو يومين بالكثير)
export function tabularHijri(ms) {
  const d = new Date(ms);
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  const jd = day + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709);
  return { year: 30 * n + j - 30, month, day: l - Math.floor((709 * month) / 24) };
}

export function hijri(ms) {
  return intlHijri(ms) || tabularHijri(ms);
}

// ---------- وش الموسم الحين ----------
export function seasonById(id) {
  return SEASONS.find(s => s.id === id) || null;
}

export function matches(def, ms) {
  const w = def.when;
  if (w.hijri) {
    const h = hijri(ms);
    return h.month === w.hijri.month && h.day >= w.hijri.from && h.day <= w.hijri.to;
  }
  if (w.months) return w.months.includes(new Date(ms).getMonth() + 1);
  return false;
}

// override: للتجربة (من الإعدادات أو ?season= بالرابط)
export function currentSeason(ms, override = null) {
  if (override === 'none') return null; // للاختبار: بدون موسم مهما كان التاريخ
  if (override) return seasonById(override);
  return SEASONS.find(d => matches(d, ms)) || null;
}

// مفتاح الموسم: نفس الموسم بسنة ثانية = موسم جديد (ترحيب وتقدّم من جديد)
export function seasonKey(def, ms) {
  if (!def) return null;
  if (def.when.hijri) return `${def.id}:${hijri(ms).year}`;
  const d = new Date(ms);
  const y = d.getMonth() + 1 >= 12 ? d.getFullYear() : d.getFullYear() - 1; // الشتاء ينحسب بسنة ديسمبر
  return `${def.id}:${y}`;
}

// تقدّم اللاعب بالموسم الحالي
export function seasonState(state, def, ms) {
  const key = seasonKey(def, ms);
  if (!state.season || state.season.key !== key) {
    state.season = { key, id: def ? def.id : null, greeted: false, iftar: 0, claimed: 0, eidiyaDay: null, spotsDay: null, spots: [], campfireDay: null };
  }
  return state.season;
}

// ---------- رمضان: فطّر الصايمين ----------
// يزيد العداد ويرجع الجايزة إذا وصل لدرجة جديدة
export function addIftar(ss) {
  ss.iftar += 1;
  const m = IFTAR_MILESTONES[ss.claimed];
  if (m && ss.iftar >= m.at) { ss.claimed += 1; return m; }
  return null;
}

export function nextIftar(ss) {
  return IFTAR_MILESTONES[ss.claimed] || null;
}

// ---------- العيد: العيدية مرة كل يوم ----------
export function eidiya(state, ss, ms) {
  const today = dateKey(ms);
  if (ss.eidiyaDay === today) return null;
  ss.eidiyaDay = today;
  state.flags.eidOutfit = true;
  const lv = state.player.level || 1;
  return { coins: Math.min(1500, 100 + lv * 25), items: { dates: 5, coffee: 2 } };
}

// ---------- الشتاء: شبّة النار مرة باليوم ----------
export const CAMPFIRE_ENERGY = 15;
export function useCampfire(ss, ms) {
  const today = dateKey(ms);
  if (ss.campfireDay === today) return false;
  ss.campfireDay = today;
  return true;
}
