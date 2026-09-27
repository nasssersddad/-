// الوقت داخل اللعبة: يوم كامل = 6 دقايق حقيقية تقريباً
export const GAME_MIN_PER_SEC = 4;
export const DAWN = 6 * 60;
export const DUSK = 20 * 60;

export function hour(state) {
  return Math.floor(state.time.minute / 60);
}

export function weekday(state) {
  return (state.time.day - 1) % 7;
}

export function isNight(state) {
  const m = state.time.minute;
  return m >= DUSK || m < DAWN;
}

// درجة الظلام 0..1
export function darkness(minute) {
  const h = minute / 60;
  if (h >= 7 && h < 18) return 0;
  if (h >= 18 && h < 21) return (h - 18) / 3;
  if (h >= 21 || h < 4.5) return 1;
  if (h >= 4.5 && h < 7) return 1 - (h - 4.5) / 2.5;
  return 0;
}

export function clockText(state) {
  const m = Math.floor(state.time.minute);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  return `${String(h).padStart(2, '0')}:${mm}`;
}

// يقدّم الوقت. يرجع عدد الأيام الجديدة اللي بدت
export function advance(state, sec) {
  state.time.minute += sec * GAME_MIN_PER_SEC;
  let newDays = 0;
  while (state.time.minute >= 24 * 60) {
    state.time.minute -= 24 * 60;
    state.time.day += 1;
    newDays += 1;
  }
  return newDays;
}

// النوم: ينقلك لصباح اليوم الجاي (أو نفس اليوم إذا قبل الفجر)
export function sleepUntilMorning(state) {
  const wakeAt = DAWN + 30;
  let newDays = 0;
  if (state.time.minute >= wakeAt) {
    state.time.day += 1;
    newDays = 1;
  }
  state.time.minute = wakeAt;
  return newDays;
}
