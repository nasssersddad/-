// الطقس: كل يوم لعبة له طقس ثابت (من البذرة واليوم). المطر يسقي الزرع والحلال من نفسه
import { mulberry32, hashString, randInt } from './util.js';
import { isReady } from './farming.js';
import { TROUGH_CAP } from '../data/camels.js';

export const RAIN_CHANCE = 0.3;

// { rain, start, end (بالساعات), heavy }
export function dayWeather(seed, day, stormy = false) {
  const rng = mulberry32(hashString(`wx:${seed}:${day}`));
  const roll = rng();
  if (stormy || roll >= RAIN_CHANCE) return { rain: false };
  const start = randInt(rng, 6, 17);
  const len = randInt(rng, 2, 5);
  return { rain: true, start, end: start + len, heavy: rng() < 0.35 };
}

export function rainAt(w, hourFloat) {
  return !!(w && w.rain && hourFloat >= w.start && hourFloat < w.end);
}

// شدة المطر 0..1 مع بداية ونهاية ناعمة
export function rainIntensity(w, hourFloat) {
  if (!rainAt(w, hourFloat)) return 0;
  const ramp = Math.min(1, (hourFloat - w.start) * 2, (w.end - hourFloat) * 2);
  return ramp * (w.heavy ? 1 : 0.6);
}

// قوس قزح ساعة بعد المطر
export function rainbowAt(w, hourFloat) {
  if (!w || !w.rain || hourFloat < w.end || hourFloat > w.end + 1.2) return 0;
  const k = (hourFloat - w.end) / 1.2;
  return Math.sin(k * Math.PI);
}

// المطر يسقي كل حوض مزروع ما خلص، ويعبّي الحوض، والحلال يشرب. يرجع كم حوض انسقى
export function applyRain(state, day) {
  let n = 0;
  for (const p of Object.values(state.plots)) {
    if (p && !isReady(p) && !p.watered) { p.watered = true; n++; }
  }
  if (state.trough && state.built && state.built.trough) state.trough.water = Math.min(TROUGH_CAP, state.trough.water + 3);
  for (const c of state.camels || []) c.wateredDay = day;
  for (const s of state.sheep || []) s.wateredDay = day;
  state.stats.rainDays = (state.stats.rainDays || 0) + 1;
  // سقي المطر ينحسب سقي (عشان مهمة «اسقِ حوضين» ما تعلق بيوم مطر)
  state.stats.watered = (state.stats.watered || 0) + n;
  return n;
}
