// توليد طوابق السرداب (غرف وممرات) والوحوش
import { mulberry32, randInt } from './util.js';

export const DW = 44;
export const DH = 32;
export const D = { WALL: 0, FLOOR: 1 };

export const ENEMIES = {
  scorpion: { name: 'عقرب', hp: 3, speed: 38, dmg: 1, r: 5, xp: 6, drop: 'stinger', kind: 'scorpion' },
  ghoul:    { name: 'غول رملي', hp: 7, speed: 26, dmg: 2, r: 6, xp: 12, drop: 'bone', kind: 'ghoul' },
  bat:      { name: 'خفّاش', hp: 2, speed: 55, dmg: 1, r: 4, xp: 5, drop: null, kind: 'bat' },
  boss1:    { name: 'ملكة العقارب', hp: 26, speed: 34, dmg: 2, r: 10, xp: 80, drop: 'r_ring', kind: 'scorpion', scale: 2, boss: 1 },
  boss2:    { name: 'الغول الكبير', hp: 45, speed: 28, dmg: 3, r: 11, xp: 140, drop: 'r_letter', kind: 'ghoul', scale: 2, boss: 2 },
  boss3:    { name: 'المارد', hp: 70, speed: 32, dmg: 3, r: 12, xp: 250, drop: 'r_key', kind: 'marid', scale: 2.2, boss: 3 },
};

const FLOOR_MIX = {
  1: [['scorpion', 6], ['bat', 2]],
  2: [['scorpion', 4], ['ghoul', 3], ['bat', 3]],
  3: [['ghoul', 5], ['scorpion', 3], ['bat', 4]],
};

export function generateFloor(floor, seed, bossDefeated) {
  const rng = mulberry32(seed);
  const tiles = new Uint8Array(DW * DH);
  const rooms = [];
  for (let tries = 0; tries < 200 && rooms.length < 7; tries++) {
    const w = randInt(rng, 6, 10), h = randInt(rng, 5, 8);
    const x = randInt(rng, 1, DW - w - 2), y = randInt(rng, 1, DH - h - 2);
    const r = { x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) };
    if (rooms.some(o => x < o.x + o.w + 2 && x + w + 2 > o.x && y < o.y + o.h + 2 && y + h + 2 > o.y)) continue;
    rooms.push(r);
  }
  rooms.sort((a, b) => a.cx - b.cx);
  const carve = (x, y) => { if (x > 0 && y > 0 && x < DW - 1 && y < DH - 1) tiles[y * DW + x] = D.FLOOR; };
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(x, y);
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    // ممر على شكل L بعرض مربعين
    for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx) + 1; x++) { carve(x, a.cy); carve(x, a.cy + 1); }
    for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy) + 1; y++) { carve(b.cx, y); carve(b.cx + 1, y); }
  }

  const first = rooms[0], last = rooms[rooms.length - 1];
  const T = 16;
  const center = (tx, ty) => ({ x: tx * T + 8, y: ty * T + 8 });
  const enemies = [];
  const mix = FLOOR_MIX[floor] || FLOOR_MIX[3];
  for (let i = 1; i < rooms.length; i++) {
    const r = rooms[i];
    const n = randInt(rng, 1, 2 + Math.min(floor, 2));
    for (let k = 0; k < n; k++) {
      const total = mix.reduce((s, m) => s + m[1], 0);
      let roll = rng() * total, type = mix[0][0];
      for (const [t, w] of mix) { roll -= w; if (roll < 0) { type = t; break; } }
      const p = center(randInt(rng, r.x + 1, r.x + r.w - 2), randInt(rng, r.y + 1, r.y + r.h - 2));
      enemies.push({ type, ...p });
    }
  }
  if (!bossDefeated) {
    const p = center(last.cx, last.cy);
    enemies.push({ type: 'boss' + floor, ...p });
  }
  const chests = [];
  const chestRooms = rooms.slice(1).sort(() => rng() - 0.5).slice(0, 2);
  for (const r of chestRooms) {
    chests.push({ ...center(r.x + 1, r.y + 1), rarity: rng() < 0.2 + floor * 0.08 ? 'rare' : 'common' });
  }
  const torches = rooms.map(r => center(r.cx, r.y));
  return {
    tiles, rooms,
    start: center(first.cx, first.cy + 1),
    up: center(first.cx, first.cy),
    down: center(last.cx + 1, last.cy),
    enemies, chests, torches,
  };
}

export function dTile(tiles, x, y) {
  if (x < 0 || y < 0 || x >= DW || y >= DH) return D.WALL;
  return tiles[y * DW + x];
}
