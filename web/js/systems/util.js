// أدوات مشتركة: أرقام عشوائية بذرة، اختيار بالأوزان، التواريخ
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function weightedIndex(rng, list, key = 'w') {
  const total = list.reduce((s, x) => s + x[key], 0);
  let r = rng() * total;
  for (let i = 0; i < list.length; i++) {
    r -= list[i][key];
    if (r < 0) return i;
  }
  return list.length - 1;
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// مفتاح اليوم المحلي YYYY-MM-DD
export function dateKey(ms) {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// فرق الأيام بين مفتاحين (b - a)
export function dayDiff(a, b) {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  const ta = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const tb = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((tb - ta) / 86400000);
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
