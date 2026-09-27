// العالم المفتوح: قرية فيها مزارع الجيران والطرق بينها
import { mulberry32 } from '../systems/util.js';
import { T, TILE } from './map.js';

export const OW_W = 72;
export const OW_H = 52;

export const FARMS = {
  abu_rashid: {
    name: 'مزرعة أبو راشد', owner: 'أبو راشد', persona: 'stubborn', rect: { x0: 5, y0: 5, x1: 21, y1: 17 },
    look: { robe: '#efe6d2', head: '#b8292a', skin: '#c68a5a', beard: '#8a8a8a' },
    goods: ['alfalfa', 'dates', 'milk', 'wool'], camels: 3, sheep: 1, breed: 'majaheem',
    price: 18000, income: 90, produce: { milk: 3, alfalfa: 4 }, specialty: 'إبل المجاهيم',
    greet: 'هلا بالجار! المجاهيم عندي ما لها مثيل.',
  },
  umm_saad: {
    name: 'مزرعة أم سعد', owner: 'أم سعد', persona: 'generous', rect: { x0: 49, y0: 5, x1: 66, y1: 17 },
    look: { robe: '#2b2b33', head: '#1a1a20', skin: '#c68a5a', veil: true },
    goods: ['wool', 'milk', 'bread', 'herb'], camels: 0, sheep: 4,
    price: 12000, income: 60, produce: { wool: 4, milk: 2 }, specialty: 'الغنم والصوف',
    greet: 'يا هلا يا ولدي، غنمي سمان وصوفهم ناعم.',
  },
  sheikh_falih: {
    name: 'مزرعة الشيخ فالح', owner: 'الشيخ فالح', persona: 'stingy', rect: { x0: 5, y0: 32, x1: 23, y1: 46 },
    look: { robe: '#f4f0e6', head: '#f4f0e6', skin: '#b67a4a', beard: '#d8d8d8' },
    goods: ['dates', 'pressed', 'coffee2', 'cardamom'], camels: 2, sheep: 2, breed: 'wadh',
    price: 45000, income: 220, produce: { dates: 8, pressed: 1 }, specialty: 'نخل وتمر فاخر',
    greet: 'مزرعتي أكبر مزرعة بالديرة. وش تبي؟',
  },
  bu_nasser: {
    name: 'مزرعة بو ناصر', owner: 'بو ناصر', persona: 'hurry', rect: { x0: 48, y0: 32, x1: 66, y1: 46 },
    look: { robe: '#7b5a3a', head: '#e8e1cf', skin: '#8f5f3c', beard: '#2b1d14' },
    goods: ['wheat', 'tomato', 'melon', 'flour', 'seed_melon'], camels: 1, sheep: 2,
    price: 22000, income: 120, produce: { wheat: 6, tomato: 5, melon: 2 }, specialty: 'خضار وقمح',
    greet: 'بسرعة يا خوي، عندي شغل! وش تبي تشتري؟',
  },
  harbi: {
    name: 'عزبة الحربي', owner: 'الحربي', persona: 'lowball', rect: { x0: 28, y0: 6, x1: 42, y1: 17 },
    look: { robe: '#35506e', head: '#d9d2bf', skin: '#c68a5a', beard: '#555' },
    goods: ['stone', 'clay', 'brick', 'plank', 'rope'], camels: 2, sheep: 0, breed: 'shual',
    price: 9000, income: 45, produce: { stone: 6, clay: 4 }, specialty: 'مواد بناء',
    greet: 'عندي كل شي للبناء... بأسعار تناسبني، هههه.',
  },
};

export function buildOpenWorld() {
  const rng = mulberry32(4242);
  const tiles = new Uint8Array(OW_W * OW_H);
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < OW_W && y < OW_H) tiles[y * OW_W + x] = t; };
  for (let y = 0; y < OW_H; y++) for (let x = 0; x < OW_W; x++) set(x, y, rng() < 0.18 ? T.SAND2 : T.SAND);
  for (let x = 0; x < OW_W; x++) { set(x, 0, T.DUNE); set(x, 1, T.DUNE); set(x, OW_H - 1, T.DUNE); }
  for (let y = 0; y < OW_H; y++) { set(0, y, T.DUNE); set(1, y, T.DUNE); set(OW_W - 1, y, T.DUNE); set(OW_W - 2, y, T.DUNE); }
  // واحة بالنص
  for (let y = 0; y < OW_H; y++) for (let x = 0; x < OW_W; x++) {
    const d = Math.hypot(x - 36, (y - 26) * 1.2);
    if (d < 7 + rng()) set(x, y, T.GRASS);
    if (d < 3.4) set(x, y, T.WATER);
  }
  // الطرق
  for (let x = 3; x < OW_W - 3; x++) { set(x, 24, T.ROAD); set(x, 25, T.ROAD); }
  for (let y = 18; y < OW_H - 1; y++) { set(35, y, T.ROAD); set(36, y, T.ROAD); }
  for (const f of Object.values(FARMS)) {
    const cx = Math.floor((f.rect.x0 + f.rect.x1) / 2);
    const [ya, yb] = f.rect.y1 < 24 ? [f.rect.y1 + 1, 24] : [25, f.rect.y0 - 1];
    for (let y = ya; y <= yb; y++) { set(cx, y, T.ROAD); set(cx + 1, y, T.ROAD); }
    // أرض المزرعة
    for (let y = f.rect.y0 + 1; y < f.rect.y1; y++) for (let x = f.rect.x0 + 1; x < f.rect.x1; x++) {
      if (x > f.rect.x0 + 2 && x < f.rect.x0 + 9 && y > f.rect.y0 + 5) set(x, y, T.SOIL);
      else if (rng() < 0.5) set(x, y, T.GRASS);
    }
  }

  const objects = [];
  const add = (o) => { o.x = o.tx * TILE + TILE / 2; o.y = o.ty * TILE + TILE - 2; objects.push(o); return o; };
  const farmObjs = {};
  for (const [id, f] of Object.entries(FARMS)) {
    const r = f.rect;
    const cx = Math.floor((r.x0 + r.x1) / 2);
    const gateY = r.y1 < 24 ? r.y1 : r.y0;
    farmObjs[id] = {
      owner: add({ id: 'owner:' + id, kind: 'owner', farm: id, tx: cx - 1, ty: gateY + (r.y1 < 24 ? -1 : 1) }),
      house: add({ id: 'house:' + id, kind: 'farmhouse', farm: id, tx: r.x1 - 4, ty: r.y0 + 3, solid: true }),
      sign: add({ id: 'sign:' + id, kind: 'farmsign', farm: id, tx: cx + 2, ty: gateY + (r.y1 < 24 ? 1 : -1) }),
    };
    for (let i = 0; i < 4; i++) add({ id: `crop:${id}:${i}`, kind: 'crop', farm: id, tx: r.x0 + 3 + i, ty: r.y1 - 2, crop: ['wheat', 'tomato', 'melon', 'alfalfa'][i % 4] });
    for (let i = 0; i < 3; i++) add({ id: `palm:${id}:${i}`, kind: 'palm', farm: id, tx: r.x0 + 2 + i * 5, ty: r.y0 + 2, solid: true });
  }
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2;
    add({ id: 'opalm' + a, kind: 'palm', tx: Math.round(36 + Math.cos(ang) * 6), ty: Math.round(26 + Math.sin(ang) * 5), solid: true });
  }
  for (let n = 0; n < 50; n++) {
    const tx = 3 + Math.floor(rng() * (OW_W - 6)), ty = 3 + Math.floor(rng() * (OW_H - 6));
    if (Object.values(FARMS).some(f => tx >= f.rect.x0 - 1 && tx <= f.rect.x1 + 1 && ty >= f.rect.y0 - 1 && ty <= f.rect.y1 + 1)) continue;
    if (tiles[ty * OW_W + tx] === T.ROAD || tiles[ty * OW_W + tx] === T.WATER) continue;
    add({ id: 'odeco' + n, kind: 'deco', variant: Math.floor(rng() * 4), tx, ty });
  }
  const home = add({ id: 'gohome', kind: 'gohome', tx: 36, ty: 48 });
  add({ id: 'homesign', kind: 'sign', tx: 38, ty: 48, text: '🏠 مزرعتك' });
  return { tiles, objects, farmObjs, spawn: { x: home.x, y: home.y - 20 }, W: OW_W, H: OW_H };
}

export function owTile(tiles, x, y) {
  if (x < 0 || y < 0 || x >= OW_W || y >= OW_H) return T.DUNE;
  return tiles[y * OW_W + x];
}
