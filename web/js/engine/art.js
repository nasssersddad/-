// رسومات pixel-art مولّدة بالكود (بدون ملفات صور)
import { T } from '../data/map.js';

const cache = new Map();

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function cached(key, w, h, draw) {
  let c = cache.get(key);
  if (!c) {
    c = canvas(w, h);
    const ctx = c.getContext('2d');
    draw(ctx, w, h);
    cache.set(key, c);
  }
  return c;
}

// أدوات رسم بكسلات
function R(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}
function P(ctx, x, y, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}
function line(ctx, x0, y0, x1, y1, c, t = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = c;
  for (;;) {
    ctx.fillRect(x0, y0, t, t);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function ellipse(ctx, cx, cy, rx, ry, c) {
  ctx.fillStyle = c;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}
function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const PAL = {
  sand: '#e4bb76', sand2: '#dcae66', sandDot: '#c99a55', sandLight: '#efcd8e',
  dune: '#d09a55', duneShade: '#b98543',
  grass: '#7ea63c', grass2: '#6d9431', grassDot: '#9cc052',
  water: '#3b8db6', water2: '#4fa2c9', waterHi: '#a6def0',
  road: '#caa46c', roadDot: '#a98553',
  floor: '#bfa27a', floorLine: '#a08258', floorHi: '#d0b58e',
  wall: '#b07e4c', wallTop: '#d4a46b', wallDark: '#7d5431', wallLine: '#946438',
  soil: '#7a4f2e', soilDark: '#5e3b21',
  rocky: '#b39670', rockyDot: '#98795a',
  wadi: '#b07650', wadiDot: '#8e5a3a',
  wood: '#8a5a33', woodDark: '#5e3a1f', woodLight: '#b07a48',
  stone: '#9c948a', stoneDark: '#6f675f', stoneLight: '#c4bcb0',
  leaf: '#4f8a2f', leafDark: '#355f20', leafLight: '#7fb846',
  fire1: '#ffd24a', fire2: '#ff8a1e', fire3: '#d9401a',
  brass: '#d9a933', brassDark: '#9a6f1a', brassLight: '#ffe07a',
};

// ---------- البلاطات ----------
export function drawTile(ctx, t, tx, ty, x, y, getT) {
  const h = (s) => hash(tx, ty, s);
  switch (t) {
    case T.SAND:
    case T.SAND2: {
      R(ctx, x, y, 16, 16, t === T.SAND ? PAL.sand : PAL.sand2);
      // حبيبات رمل بثلاث درجات (dithering)
      for (let i = 0; i < 7; i++) P(ctx, x + Math.floor(h(i) * 16), y + Math.floor(h(i + 9) * 16), PAL.sandDot);
      for (let i = 0; i < 5; i++) P(ctx, x + Math.floor(h(i + 30) * 16), y + Math.floor(h(i + 40) * 16), PAL.sandLight);
      if (h(50) < 0.35) { const rx = x + Math.floor(h(51) * 12), ry = y + Math.floor(h(52) * 12); P(ctx, rx, ry, '#b88a52'); P(ctx, rx + 1, ry, '#f4d69a'); }
      if (h(20) < 0.3) { const lx = x + Math.floor(h(21) * 10), ly = y + Math.floor(h(22) * 14); R(ctx, lx, ly, 5, 1, PAL.sandLight); R(ctx, lx + 1, ly + 1, 4, 1, PAL.sandDot); }
      break;
    }
    case T.DUNE: {
      R(ctx, x, y, 16, 16, PAL.dune);
      for (let i = 0; i < 3; i++) { const ly = y + 3 + i * 5 + Math.floor(h(i) * 2); R(ctx, x + Math.floor(h(i + 3) * 4), ly, 10, 1, PAL.duneShade); R(ctx, x + Math.floor(h(i + 3) * 4) + 2, ly - 1, 8, 1, PAL.sandLight); }
      break;
    }
    case T.GRASS: {
      R(ctx, x, y, 16, 16, h(1) < 0.5 ? PAL.grass : PAL.grass2);
      for (let i = 0; i < 6; i++) { const gx = x + Math.floor(h(i + 2) * 15), gy = y + Math.floor(h(i + 12) * 14); R(ctx, gx, gy, 1, 2, PAL.grassDot); }
      // خصلات عشب بظل وإضاءة
      for (let i = 0; i < 3; i++) { const gx = x + 1 + Math.floor(h(i + 60) * 13), gy = y + 2 + Math.floor(h(i + 70) * 12); P(ctx, gx, gy + 2, '#557a26'); P(ctx, gx + 1, gy + 1, PAL.grassDot); P(ctx, gx + 2, gy, '#b8d86a'); P(ctx, gx + 3, gy + 2, '#557a26'); }
      // حافة رمل
      if (getT(tx, ty - 1) === T.SAND || getT(tx, ty - 1) === T.SAND2) R(ctx, x, y, 16, 2, PAL.sand2);
      break;
    }
    case T.WATER:
      R(ctx, x, y, 16, 16, PAL.water);
      if (getT(tx, ty - 1) !== T.WATER) { R(ctx, x, y, 16, 3, '#6d8f3a'); R(ctx, x, y + 3, 16, 1, '#2d6f94'); }
      break;
    case T.ROAD: {
      R(ctx, x, y, 16, 16, PAL.road);
      for (let i = 0; i < 5; i++) R(ctx, x + Math.floor(h(i) * 14), y + Math.floor(h(i + 5) * 14), 2, 1, PAL.roadDot);
      break;
    }
    case T.FLOOR: {
      R(ctx, x, y, 16, 16, PAL.floor);
      const off = (ty % 2) * 4;
      R(ctx, x, y + 7, 16, 1, PAL.floorLine);
      R(ctx, x, y + 15, 16, 1, PAL.floorLine);
      R(ctx, x + ((off + 3) % 16), y, 1, 7, PAL.floorLine);
      R(ctx, x + ((off + 11) % 16), y + 8, 1, 7, PAL.floorLine);
      R(ctx, x + 1, y + 1, 5, 1, PAL.floorHi);
      if (getT(tx, ty - 1) === T.WALL || getT(tx, ty - 1) === T.RUBBLE) R(ctx, x, y, 16, 4, 'rgba(60,30,10,0.25)');
      break;
    }
    case T.ROOMFLOOR: {
      R(ctx, x, y, 16, 16, '#9a6a3e');
      for (let i = 0; i < 4; i++) R(ctx, x, y + i * 4 + 3, 16, 1, '#7c5230');
      R(ctx, x + ((tx * 7) % 13), y, 1, 16, '#7c5230');
      if (getT(tx, ty - 1) === T.WALL || getT(tx, ty - 1) === T.RUBBLE) R(ctx, x, y, 16, 4, 'rgba(60,30,10,0.3)');
      break;
    }
    case T.GATE:
      drawTile(ctx, T.ROAD, tx, ty, x, y, getT);
      break;
    case T.WALL: {
      R(ctx, x, y, 16, 16, PAL.wall);
      R(ctx, x, y, 16, 5, PAL.wallTop);
      R(ctx, x, y + 5, 16, 1, PAL.wallDark);
      for (let row = 0; row < 3; row++) {
        const yy = y + 6 + row * 3 + 2;
        R(ctx, x, yy, 16, 1, PAL.wallLine);
        const off = ((row + tx) % 2) * 4;
        R(ctx, x + off + 2, yy - 2, 1, 2, PAL.wallLine);
        R(ctx, x + off + 10, yy - 2, 1, 2, PAL.wallLine);
      }
      // شرفات عربية بأعلى الجدار
      if (tx % 2 === 0) { R(ctx, x + 4, y - 3, 8, 3, PAL.wallTop); R(ctx, x + 5, y - 4, 6, 1, PAL.wallTop); }
      break;
    }
    case T.RUBBLE: {
      drawTile(ctx, T.FLOOR, tx, ty, x, y, getT);
      for (let i = 0; i < 5; i++) {
        const bx = x + Math.floor(h(i) * 12), by = y + 6 + Math.floor(h(i + 4) * 8);
        R(ctx, bx, by, 4, 3, PAL.wall); R(ctx, bx, by, 4, 1, PAL.wallTop); R(ctx, bx, by + 2, 4, 1, PAL.wallDark);
      }
      R(ctx, x + 2, y + 2, 5, 6, PAL.wall); R(ctx, x + 2, y + 2, 5, 2, PAL.wallTop);
      break;
    }
    case T.SOIL: {
      R(ctx, x, y, 16, 16, '#c79a5c');
      for (let i = 0; i < 3; i++) P(ctx, x + Math.floor(h(i) * 16), y + Math.floor(h(i + 5) * 16), '#a87c45');
      break;
    }
    case T.ROCKY: {
      R(ctx, x, y, 16, 16, PAL.rocky);
      for (let i = 0; i < 5; i++) R(ctx, x + Math.floor(h(i) * 14), y + Math.floor(h(i + 5) * 14), 2, 2, PAL.rockyDot);
      break;
    }
    case T.WADI: {
      R(ctx, x, y, 16, 16, PAL.wadi);
      for (let i = 0; i < 3; i++) { const cx = x + Math.floor(h(i) * 12); const cy = y + Math.floor(h(i + 3) * 14); line(ctx, cx, cy, cx + 3, cy + 1, PAL.wadiDot); }
      break;
    }
    default:
      R(ctx, x, y, 16, 16, '#f0f');
  }
}

export function waterFrame(f) {
  return cached('water' + f, 16, 16, (ctx) => {
    for (let i = 0; i < 3; i++) {
      const y = (i * 5 + f * 2) % 16;
      const x = (i * 7 + f * 3) % 12;
      R(ctx, x, y, 4, 1, PAL.water2);
      R(ctx, x + 1, y, 2, 1, PAL.waterHi);
    }
  });
}

// ---------- الشخصيات ----------
// look: { robe, head, skin, beard, veil, blue }
export function character(look, dir, frame, key = '') {
  const k = `ch:${key || JSON.stringify(look)}:${dir}:${frame}`;
  return cached(k, 16, 24, (ctx) => {
    const flip = dir === 'left';
    if (flip) { ctx.translate(16, 0); ctx.scale(-1, 1); }
    const d = dir === 'left' ? 'right' : dir;
    const bob = frame === 0 ? 0 : 1;
    const robeDark = shade(look.robe, -0.18);
    const oy = 3 + bob;
    // الرجلين
    if (!look.float) {
      const f1 = frame === 1 ? -1 : 0, f2 = frame === 2 ? -1 : 0;
      if (d === 'right') {
        R(ctx, 6 + (frame === 1 ? 1 : 0), 21 + f1 + bob * 0, 3, 2, '#3a2616');
        R(ctx, 8 - (frame === 2 ? 1 : 0), 21 + f2, 3, 2, '#4a3220');
      } else {
        R(ctx, 5, 21 + f1, 3, 2, '#3a2616');
        R(ctx, 9, 21 + f2, 3, 2, '#3a2616');
      }
    }
    // الثوب
    const bodyTop = 9 + oy - 3;
    const bodyH = look.float ? 10 : 22 - bodyTop;
    if (d === 'right') {
      R(ctx, 5, bodyTop, 7, bodyH, look.robe);
      R(ctx, 5, bodyTop, 1, bodyH, robeDark);
      R(ctx, 8, bodyTop + 1, 2, 7 + (frame === 1 ? 1 : 0), robeDark); // الذراع
      R(ctx, 8, bodyTop + 8 + (frame === 1 ? 1 : 0), 2, 2, look.skin);
    } else {
      R(ctx, 4, bodyTop, 8, bodyH, look.robe);
      R(ctx, 11, bodyTop, 1, bodyH, robeDark);
      const sw = frame === 1 ? 1 : frame === 2 ? -1 : 0;
      R(ctx, 3, bodyTop + 1 + sw, 1, 6, robeDark);
      R(ctx, 12, bodyTop + 1 - sw, 1, 6, robeDark);
      R(ctx, 3, bodyTop + 7 + sw, 1, 2, look.skin);
      R(ctx, 12, bodyTop + 7 - sw, 1, 2, look.skin);
      if (d === 'down') { R(ctx, 7, bodyTop, 2, 3, robeDark); }
    }
    if (look.float) {
      // ذيل دخان الجني
      for (let i = 0; i < 5; i++) R(ctx, 6 + (i % 2), bodyTop + bodyH + i, 4 - Math.floor(i / 2), 1, shade(look.robe, 0.1 * i));
    }
    // الرأس
    const hy = oy - 1;
    if (look.veil) {
      R(ctx, 4, hy, 8, 8, look.head);
      if (d === 'down') { R(ctx, 5, hy + 3, 6, 2, look.skin); P(ctx, 6, hy + 3, '#1a1010'); P(ctx, 9, hy + 3, '#1a1010'); }
      if (d === 'right') { R(ctx, 8, hy + 3, 3, 2, look.skin); P(ctx, 10, hy + 3, '#1a1010'); }
      R(ctx, 3, hy + 6, 10, 3, look.head);
      return;
    }
    if (d === 'down') {
      R(ctx, 5, hy + 2, 6, 6, look.skin);
      P(ctx, 6, hy + 4, '#1a1010'); P(ctx, 9, hy + 4, '#1a1010');
      if (look.beard) { R(ctx, 5, hy + 6, 6, 2, look.beard); P(ctx, 7, hy + 6, look.skin); P(ctx, 8, hy + 6, look.skin); }
      else P(ctx, 7, hy + 6, shade(look.skin, -0.25));
      // الغترة
      R(ctx, 4, hy, 8, 3, look.head);
      R(ctx, 4, hy + 2, 1, 7, look.head); R(ctx, 11, hy + 2, 1, 7, look.head);
      R(ctx, 3, hy + 6, 2, 3, look.head); R(ctx, 11, hy + 6, 2, 3, look.head);
    } else if (d === 'up') {
      R(ctx, 4, hy, 8, 9, look.head);
      R(ctx, 3, hy + 6, 10, 3, look.head);
      R(ctx, 5, hy + 1, 6, 1, shade(look.head, -0.12));
    } else {
      R(ctx, 7, hy + 2, 4, 6, look.skin);
      P(ctx, 9, hy + 4, '#1a1010');
      if (look.beard) R(ctx, 7, hy + 6, 4, 2, look.beard);
      R(ctx, 4, hy, 7, 3, look.head);
      R(ctx, 4, hy + 2, 3, 7, look.head);
      R(ctx, 3, hy + 6, 3, 3, look.head);
    }
    // العقال
    if (!look.noEgal) {
      if (d === 'right') R(ctx, 5, hy + 1, 6, 1, '#1b1b1b');
      else R(ctx, 5, hy + 1, 6, 1, '#1b1b1b');
    }
    // نقش الشماغ الأحمر
    if (look.head === '#c9302c' || look.head === '#b8292a') {
      for (let i = 0; i < 4; i++) P(ctx, 5 + i * 2, hy, '#f2e6e0');
    }
    if (look.horns) { R(ctx, 4, hy - 2, 1, 2, '#e8d8a0'); R(ctx, 11, hy - 2, 1, 2, '#e8d8a0'); }
  });
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  r = f(r); g = f(g); b = f(b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

export const PLAYER_LOOK = { robe: '#f4efe4', head: '#c9302c', skin: '#c68a5a' };
export const DJINN_LOOK = { robe: '#3d7be0', head: '#e0a82e', skin: '#8ec5ff', beard: '#1d3f8f', float: true, noEgal: true, horns: false };
export const SALEM_LOOK = { robe: '#e9e2d0', head: '#f4f0e6', skin: '#b67a4a', beard: '#d8d8d8' };

// ---------- الكائنات ----------
export function palm(variant, sway, stump) {
  return cached(`palm:${variant}:${sway}:${stump}`, 40, 52, (ctx) => {
    const bx = 20, by = 50;
    ellipse(ctx, bx, by, 7, 2, 'rgba(0,0,0,0.18)');
    if (stump) {
      R(ctx, bx - 3, by - 6, 6, 6, PAL.wood);
      R(ctx, bx - 3, by - 6, 6, 1, PAL.woodLight);
      R(ctx, bx - 1, by - 5, 2, 1, PAL.woodDark);
      return;
    }
    const lean = (variant % 3) - 1;
    const topX = bx + lean * 3, topY = 16;
    // الجذع
    for (let y = by; y > topY; y--) {
      const t = (by - y) / (by - topY);
      const x = Math.round(bx + lean * 3 * t * t);
      R(ctx, x - 2, y, 4, 1, (y % 3 === 0) ? PAL.woodDark : PAL.wood);
      P(ctx, x + 1, y, PAL.woodDark);
      if (y % 3 === 0) P(ctx, x - 2, y, PAL.woodLight);
    }
    // السعف
    const fronds = [[-16, 6], [-12, -4], [-5, -10], [5, -10], [12, -4], [16, 6], [-9, 9], [9, 9]];
    fronds.forEach(([dx, dy], i) => {
      const s = sway * (i % 2 ? 1 : -1) * 0.6;
      const ex = topX + dx + s, ey = topY + dy + Math.abs(dx) * 0.25;
      const mx = topX + dx * 0.5 + s * 0.5, my = topY + dy * 0.5 - 4;
      let px = topX, py = topY;
      for (let k = 1; k <= 10; k++) {
        const t = k / 10;
        const x = (1 - t) * (1 - t) * topX + 2 * (1 - t) * t * mx + t * t * ex;
        const y = (1 - t) * (1 - t) * topY + 2 * (1 - t) * t * my + t * t * ey;
        line(ctx, px, py, x, y, i < 6 ? PAL.leaf : PAL.leafDark);
        // وريقات
        if (k > 2 && k % 2 === 0) { P(ctx, x, y + 1, PAL.leafDark); P(ctx, x, y + 2, PAL.leafDark); P(ctx, x + (dx > 0 ? -1 : 1), y - 1, PAL.leafLight); }
        px = x; py = y;
      }
    });
    // التمر
    if (variant % 2 === 0) {
      R(ctx, topX - 4, topY + 2, 3, 3, '#a8521e'); R(ctx, topX + 2, topY + 2, 3, 3, '#a8521e');
      P(ctx, topX - 3, topY + 2, '#d98a3a'); P(ctx, topX + 3, topY + 2, '#d98a3a');
    }
    R(ctx, topX - 2, topY - 1, 4, 3, PAL.leafDark);
  });
}

export function rock(variant, cracks) {
  return cached(`rock:${variant}:${cracks}`, 20, 16, (ctx) => {
    ellipse(ctx, 10, 13, 8, 2, 'rgba(0,0,0,0.2)');
    const w = 7 + (variant % 2);
    ellipse(ctx, 10, 9, w, 5, PAL.stoneDark);
    ellipse(ctx, 10, 8, w - 1, 4, PAL.stone);
    ellipse(ctx, 8, 6, 3, 2, PAL.stoneLight);
    P(ctx, 13, 9, PAL.stoneDark); P(ctx, 5, 10, PAL.stoneDark);
    if (cracks >= 1) line(ctx, 9, 5, 11, 10, '#4a443e');
    if (cracks >= 2) line(ctx, 13, 6, 12, 11, '#4a443e');
  });
}

// صخرة كبيرة (تعطي حجر أكثر)
export function bigRock(variant, cracks) {
  return cached(`bigrock:${variant}:${cracks}`, 30, 22, (ctx) => {
    ellipse(ctx, 15, 19, 13, 3, 'rgba(0,0,0,0.22)');
    ellipse(ctx, 15, 12, 12, 8, PAL.stoneDark);
    ellipse(ctx, 14, 11, 11, 7, PAL.stone);
    ellipse(ctx, 22, 14, 5, 4, PAL.stoneDark);
    ellipse(ctx, 21, 13, 4, 3, PAL.stone);
    ellipse(ctx, 11, 7, 5, 3, PAL.stoneLight);
    P(ctx, 18, 9, PAL.stoneLight); P(ctx, 7, 14, PAL.stoneDark); P(ctx, 16, 16, PAL.stoneDark);
    if (variant % 2) { R(ctx, 6, 12, 2, 1, '#8a9a4a'); R(ctx, 19, 7, 2, 1, '#8a9a4a'); } // أشنة
    if (cracks >= 1) line(ctx, 12, 5, 15, 15, '#4a443e');
    if (cracks >= 2) line(ctx, 19, 8, 17, 17, '#4a443e');
    if (cracks >= 3) line(ctx, 8, 9, 13, 12, '#4a443e');
  });
}

// شجرة سدر: تاج أخضر عريض وجذع قصير ملتوي
export function sidr(variant, sway, stump) {
  return cached(`sidr:${variant}:${sway}:${stump}`, 40, 40, (ctx) => {
    const bx = 20, by = 38;
    ellipse(ctx, bx, by, 12, 3, 'rgba(0,0,0,0.2)');
    if (stump) {
      R(ctx, bx - 3, by - 5, 6, 5, PAL.woodDark);
      R(ctx, bx - 3, by - 5, 6, 1, PAL.woodLight);
      return;
    }
    // الجذع والأغصان
    line(ctx, bx, by, bx - 1, by - 10, PAL.woodDark, 3);
    line(ctx, bx - 1, by - 10, bx - 7, by - 16, PAL.wood, 2);
    line(ctx, bx - 1, by - 10, bx + 6, by - 17, PAL.wood, 2);
    P(ctx, bx, by - 4, PAL.woodLight); P(ctx, bx - 1, by - 8, PAL.woodLight);
    // التاج
    const blobs = [[-9, -19, 8, 6], [7, -20, 9, 6], [-1, -25, 10, 7], [-13, -14, 5, 4], [12, -14, 6, 4]];
    for (const [dx, dy, rx, ry] of blobs) ellipse(ctx, bx + dx + (sway * (dx > 0 ? 1 : -1)) * 0.5, by + dy + 1, rx, ry, '#3f6a24');
    for (const [dx, dy, rx, ry] of blobs) ellipse(ctx, bx + dx + (sway * (dx > 0 ? 1 : -1)) * 0.5, by + dy, rx - 1, ry - 1, '#5a8a32');
    for (const [dx, dy, rx] of blobs) { ellipse(ctx, bx + dx - rx * 0.3, by + dy - 2, Math.max(1, rx * 0.4), 1.5, '#7fb046'); }
    // ثمر النبق
    if (variant % 2 === 0) for (const [dx, dy] of [[-8, -18], [4, -22], [9, -16], [-3, -26], [-12, -13]]) { P(ctx, bx + dx, by + dy, '#d9a030'); P(ctx, bx + dx + 1, by + dy, '#b87a1a'); }
  });
}

export function clayPit(empty) {
  return cached('clay:' + empty, 18, 12, (ctx) => {
    ellipse(ctx, 9, 7, 8, 4, '#5a3620');
    if (!empty) {
      ellipse(ctx, 9, 6, 6, 3, '#9a5a35');
      ellipse(ctx, 7, 5, 2, 1, '#c07a4a');
    }
  });
}

export function herb(picked) {
  return cached('herb:' + picked, 14, 12, (ctx) => {
    ellipse(ctx, 7, 10, 5, 1, 'rgba(0,0,0,0.15)');
    if (picked) { R(ctx, 5, 8, 4, 2, PAL.leafDark); return; }
    ellipse(ctx, 7, 7, 5, 3, PAL.leafDark);
    ellipse(ctx, 7, 6, 4, 2, PAL.leaf);
    P(ctx, 4, 5, '#e8e0f0'); P(ctx, 9, 4, '#e8e0f0'); P(ctx, 7, 3, '#f0d040'); P(ctx, 10, 6, '#e8e0f0');
  });
}

export function deco(v) {
  return cached('deco:' + v, 16, 12, (ctx) => {
    if (v === 0) { // عشبة يابسة
      line(ctx, 8, 11, 4, 4, '#9a7a40'); line(ctx, 8, 11, 8, 2, '#a8883f'); line(ctx, 8, 11, 12, 5, '#9a7a40');
    } else if (v === 1) { // حصى
      ellipse(ctx, 6, 9, 3, 2, PAL.stoneDark); ellipse(ctx, 6, 8, 2, 1, PAL.stone); ellipse(ctx, 11, 10, 2, 1, PAL.stone);
    } else if (v === 2) { // شجيرة
      ellipse(ctx, 8, 8, 5, 3, '#7a8a3a'); ellipse(ctx, 7, 7, 3, 2, '#95a64a');
    } else { // عظم جمل قديم
      R(ctx, 4, 9, 8, 2, '#efe6cf'); R(ctx, 3, 8, 2, 4, '#efe6cf'); R(ctx, 11, 8, 2, 4, '#efe6cf');
    }
  });
}

export function well() {
  return cached('well', 24, 30, (ctx) => {
    ellipse(ctx, 12, 26, 10, 3, 'rgba(0,0,0,0.2)');
    ellipse(ctx, 12, 21, 10, 5, PAL.stoneDark);
    ellipse(ctx, 12, 20, 10, 4, PAL.stone);
    ellipse(ctx, 12, 19, 7, 2, '#1d2a3a');
    for (let i = 0; i < 5; i++) R(ctx, 3 + i * 4, 21, 1, 3, PAL.stoneDark);
    R(ctx, 2, 4, 2, 16, PAL.wood); R(ctx, 20, 4, 2, 16, PAL.wood);
    R(ctx, 1, 3, 22, 2, PAL.woodDark);
    R(ctx, 11, 5, 1, 7, '#caa46c');
    R(ctx, 9, 11, 5, 4, PAL.woodDark); R(ctx, 9, 11, 5, 1, PAL.woodLight);
  });
}

export function station(kind, t = 0) {
  const fire = Math.floor(t * 8) % 3;
  if (kind === 'workbench') return cached('wb', 24, 22, (ctx) => {
    ellipse(ctx, 12, 20, 11, 2, 'rgba(0,0,0,0.2)');
    R(ctx, 2, 8, 20, 4, PAL.woodLight); R(ctx, 2, 12, 20, 2, PAL.woodDark);
    R(ctx, 3, 14, 2, 6, PAL.wood); R(ctx, 19, 14, 2, 6, PAL.wood);
    R(ctx, 5, 5, 8, 3, '#c9c3b6'); R(ctx, 12, 5, 3, 2, PAL.woodDark); // منشار
    for (let i = 0; i < 4; i++) P(ctx, 5 + i * 2, 8, '#8a847a');
    R(ctx, 16, 6, 4, 2, PAL.wood); R(ctx, 17, 4, 2, 2, '#999');
  });
  if (kind === 'hearth') return cached('hearth' + fire, 24, 24, (ctx) => {
    ellipse(ctx, 12, 21, 11, 3, 'rgba(0,0,0,0.2)');
    ellipse(ctx, 12, 18, 10, 4, PAL.stoneDark);
    ellipse(ctx, 12, 17, 8, 3, '#3a2a20');
    const fl = [PAL.fire3, PAL.fire2, PAL.fire1];
    for (let i = 0; i < 5; i++) {
      const h = 3 + ((i * 3 + fire * 2) % 4);
      R(ctx, 8 + i * 2, 17 - h, 2, h, fl[(i + fire) % 3]);
    }
    // الدلّة
    R(ctx, 13, 6, 5, 6, PAL.brass); R(ctx, 14, 4, 3, 2, PAL.brass); R(ctx, 15, 2, 1, 2, PAL.brassDark);
    line(ctx, 18, 7, 21, 4, PAL.brass); R(ctx, 13, 6, 1, 6, PAL.brassLight);
    R(ctx, 12, 12, 7, 1, PAL.stoneDark);
  });
  if (kind === 'kiln') return cached('kiln' + fire, 26, 28, (ctx) => {
    ellipse(ctx, 13, 25, 12, 3, 'rgba(0,0,0,0.2)');
    ellipse(ctx, 13, 16, 11, 10, '#a0603a');
    ellipse(ctx, 11, 12, 6, 5, '#b8744a');
    R(ctx, 2, 16, 22, 9, '#a0603a');
    R(ctx, 2, 24, 22, 1, '#6e3e22');
    ellipse(ctx, 13, 20, 4, 3, '#2a1510');
    R(ctx, 10, 20, 7, 4, '#2a1510');
    R(ctx, 11, 21 - fire % 2, 5, 3, [PAL.fire2, PAL.fire1, PAL.fire3][fire]);
    R(ctx, 12, 3, 3, 4, '#8a5030');
  });
  if (kind === 'mill') return cached('mill', 22, 18, (ctx) => {
    ellipse(ctx, 11, 15, 10, 3, 'rgba(0,0,0,0.2)');
    ellipse(ctx, 11, 11, 9, 4, PAL.stoneDark);
    ellipse(ctx, 11, 9, 9, 4, PAL.stone);
    ellipse(ctx, 11, 9, 2, 1, PAL.stoneDark);
    R(ctx, 16, 2, 2, 8, PAL.wood);
  });
  if (kind === 'loom') return cached('loom', 24, 28, (ctx) => {
    ellipse(ctx, 12, 26, 11, 2, 'rgba(0,0,0,0.2)');
    R(ctx, 2, 2, 2, 24, PAL.wood); R(ctx, 20, 2, 2, 24, PAL.wood);
    R(ctx, 2, 2, 20, 2, PAL.woodDark); R(ctx, 2, 22, 20, 2, PAL.woodDark);
    const cols = ['#b8292a', '#f0e0c0', '#1a1a1a', '#d9a933'];
    for (let y = 5; y < 20; y++) for (let x = 5; x < 19; x++) {
      const c = cols[(Math.floor((x + y) / 3) + (y > 12 ? 1 : 0)) % 4];
      if ((x + y) % 2 === 0 || y < 14) P(ctx, x, y, c);
    }
  });
  return cached('st?', 8, 8, (ctx) => R(ctx, 0, 0, 8, 8, '#f0f'));
}

export function brassLamp(t) {
  const g = Math.floor(t * 4) % 2;
  return cached('lamp' + g, 16, 12, (ctx) => {
    ellipse(ctx, 8, 10, 6, 1, 'rgba(0,0,0,0.2)');
    ellipse(ctx, 7, 7, 5, 2, PAL.brassDark);
    ellipse(ctx, 7, 6, 5, 2, PAL.brass);
    line(ctx, 11, 6, 15, 4, PAL.brass);
    R(ctx, 5, 3, 4, 2, PAL.brass); R(ctx, 6, 2, 2, 1, PAL.brassLight);
    line(ctx, 2, 5, 1, 8, PAL.brassDark);
    P(ctx, 15, 3 - g, PAL.brassLight);
    P(ctx, 4, 5, PAL.brassLight);
  });
}

export function buildSign() {
  return cached('sign', 16, 22, (ctx) => {
    ellipse(ctx, 8, 20, 5, 1, 'rgba(0,0,0,0.2)');
    R(ctx, 7, 8, 2, 12, PAL.woodDark);
    R(ctx, 1, 2, 14, 8, PAL.woodLight);
    R(ctx, 1, 9, 14, 1, PAL.woodDark);
    // مطرقة
    R(ctx, 5, 4, 6, 2, '#6a6a6a'); R(ctx, 7, 6, 2, 3, PAL.woodDark);
  });
}

export function woodSign() {
  return cached('wsign', 16, 18, (ctx) => {
    R(ctx, 7, 8, 2, 9, PAL.woodDark);
    R(ctx, 0, 3, 16, 7, PAL.woodLight);
    R(ctx, 0, 9, 16, 1, PAL.woodDark);
    for (let i = 0; i < 4; i++) R(ctx, 2 + i * 3, 6, 2, 1, PAL.woodDark);
  });
}

export function ghostOutline(w, h) {
  return cached(`ghost:${w}:${h}`, w, h, (ctx) => {
    for (let x = 0; x < w; x += 2) { P(ctx, x, 0, 'rgba(255,240,200,0.7)'); P(ctx, x, h - 1, 'rgba(255,240,200,0.7)'); }
    for (let y = 0; y < h; y += 2) { P(ctx, 0, y, 'rgba(255,240,200,0.7)'); P(ctx, w - 1, y, 'rgba(255,240,200,0.7)'); }
  });
}

export function floorBed(color = '#b8292a') {
  return cached('fbed' + color, 22, 14, (ctx) => {
    R(ctx, 1, 3, 20, 10, shade(color, -0.3));
    R(ctx, 1, 2, 20, 10, color);
    for (let x = 2; x < 20; x += 3) R(ctx, x, 5, 1, 5, shade(color, 0.3));
    R(ctx, 2, 3, 6, 4, '#f0e6d0'); // مخدة
  });
}

export function guestBed() {
  return cached('gbed', 24, 20, (ctx) => {
    ellipse(ctx, 12, 18, 11, 2, 'rgba(0,0,0,0.2)');
    R(ctx, 1, 6, 22, 10, PAL.woodDark);
    R(ctx, 2, 5, 20, 8, '#e9dfc8');
    R(ctx, 2, 9, 20, 4, '#3c6ea0');
    R(ctx, 3, 6, 5, 3, '#fff8e8');
    R(ctx, 1, 2, 2, 14, PAL.wood); R(ctx, 21, 2, 2, 14, PAL.wood);
  });
}

export function carpet(w, h, c1 = '#9a2a2a', c2 = '#e0b050') {
  return cached(`carpet:${w}:${h}:${c1}`, w, h, (ctx) => {
    R(ctx, 0, 0, w, h, c2);
    R(ctx, 1, 1, w - 2, h - 2, c1);
    R(ctx, 3, 3, w - 6, h - 6, shade(c1, -0.25));
    for (let x = 4; x < w - 4; x += 4) { P(ctx, x, Math.floor(h / 2), c2); P(ctx, x + 1, Math.floor(h / 2) - 1, c2); P(ctx, x + 1, Math.floor(h / 2) + 1, c2); }
    for (let x = 0; x < w; x += 2) { P(ctx, x, 0, '#f0e6d0'); P(ctx, x, h - 1, '#f0e6d0'); }
  });
}

export function cushion() {
  return cached('cushion', 10, 8, (ctx) => {
    R(ctx, 0, 2, 10, 6, '#7a1f2a'); R(ctx, 0, 2, 10, 1, '#b83a4a'); R(ctx, 2, 4, 6, 1, '#e0b050');
  });
}

export function lanternPost(t) {
  const g = Math.floor(t * 5) % 2;
  return cached('lpost' + g, 10, 26, (ctx) => {
    ellipse(ctx, 5, 24, 3, 1, 'rgba(0,0,0,0.2)');
    R(ctx, 4, 8, 2, 16, PAL.woodDark);
    R(ctx, 2, 1, 6, 7, PAL.brassDark);
    R(ctx, 3, 2, 4, 5, g ? PAL.fire1 : PAL.fire2);
    R(ctx, 1, 0, 8, 1, PAL.brass);
  });
}

export function fountain(t) {
  const f = Math.floor(t * 3) % 2;
  return cached('fountain' + f, 34, 22, (ctx) => {
    ellipse(ctx, 17, 16, 16, 5, PAL.stoneDark);
    ellipse(ctx, 17, 14, 16, 5, PAL.stone);
    ellipse(ctx, 17, 14, 13, 3, PAL.water);
    R(ctx, 16, 5, 3, 9, PAL.stone);
    R(ctx, 15, 3, 5, 2, PAL.stoneLight);
    P(ctx, 17, 1 + f, PAL.waterHi); P(ctx, 14 + f, 9, PAL.waterHi); P(ctx, 20 - f, 10, PAL.waterHi);
    R(ctx, 10 + f * 3, 14, 3, 1, PAL.waterHi);
  });
}

export function tent() {
  return cached('tent', 48, 36, (ctx) => {
    ellipse(ctx, 24, 33, 22, 3, 'rgba(0,0,0,0.2)');
    for (let y = 4; y < 22; y++) {
      const half = 6 + (y - 4) * 1.05;
      for (let x = Math.round(24 - half); x < 24 + half; x++) {
        const stripe = Math.floor((x - 24 + 40) / 4) % 2;
        P(ctx, x, y, stripe ? '#b8292a' : '#f0e6d0');
      }
    }
    R(ctx, 4, 22, 40, 2, '#6e1a1a');
    R(ctx, 6, 24, 2, 9, PAL.woodDark); R(ctx, 40, 24, 2, 9, PAL.woodDark);
    R(ctx, 12, 26, 24, 7, '#3a2418');
    // بضاعة
    R(ctx, 14, 28, 5, 5, '#c98a3c'); R(ctx, 21, 27, 6, 6, '#8a4b2a'); R(ctx, 29, 29, 5, 4, PAL.brass);
    R(ctx, 23, 1, 2, 4, PAL.woodDark);
  });
}

export function stall() {
  return cached('stall', 30, 30, (ctx) => {
    ellipse(ctx, 15, 28, 14, 2, 'rgba(0,0,0,0.2)');
    R(ctx, 2, 4, 26, 6, '#2e6b4a');
    for (let x = 2; x < 28; x += 4) R(ctx, x, 10, 2, 2, '#2e6b4a');
    R(ctx, 3, 10, 2, 17, PAL.woodDark); R(ctx, 25, 10, 2, 17, PAL.woodDark);
    R(ctx, 2, 18, 26, 4, PAL.woodLight);
    for (let i = 0; i < 5; i++) { R(ctx, 4 + i * 5, 15, 4, 3, ['#6cc24a', '#c98a3c', '#d9401a', '#e0d060', '#8a5a33'][i]); }
  });
}

export function soilPlot(watered) {
  return cached('plot' + watered, 18, 14, (ctx) => {
    R(ctx, 0, 1, 18, 13, watered ? PAL.soilDark : PAL.soil);
    R(ctx, 0, 1, 18, 1, shade(PAL.soil, 0.2));
    for (let i = 0; i < 3; i++) R(ctx, 2, 4 + i * 4, 14, 1, watered ? '#3e2614' : PAL.soilDark);
    if (watered) { P(ctx, 4, 3, '#6fa8c8'); P(ctx, 12, 7, '#6fa8c8'); }
  });
}

const CROP_COL = { tomato: ['#d9401a', '#3f7d2a'], wheat: ['#e6c050', '#9aa83a'], melon: ['#3f8f3a', '#2f6f2a'], cardamom: ['#8fc06a', '#4f8a2f'], alfalfa: ['#b890e0', '#5a9a3a'], carrot: ['#f08a24', '#5aa83a'], onion: ['#c86a8a', '#6aa84a'], cucumber: ['#3f9a3a', '#2f7a2a'], eggplant: ['#6a3a8a', '#3f7d2a'], corn: ['#f0d040', '#6aa83a'] };
export function crop(kind, stage, maxStage) {
  return cached(`crop:${kind}:${stage}:${maxStage}`, 18, 18, (ctx) => {
    const [fruit, leaf] = CROP_COL[kind] || ['#fff', '#0a0'];
    const ripe = stage >= maxStage;
    const g = ripe ? 3 : Math.min(2, stage);
    for (let i = 0; i < 3; i++) {
      const x = 3 + i * 5;
      if (g === 0) { R(ctx, x + 1, 13, 1, 2, leaf); P(ctx, x, 12, leaf); P(ctx, x + 2, 12, leaf); continue; }
      const h = g * 3 + 2;
      if (kind === 'wheat') {
        R(ctx, x + 1, 15 - h, 1, h, leaf);
        if (ripe) { R(ctx, x, 15 - h - 2, 3, 4, fruit); }
      } else {
        R(ctx, x + 1, 15 - h, 1, h, leaf);
        R(ctx, x - 1, 15 - h + 1, 2, 1, leaf); R(ctx, x + 2, 15 - h + 2, 2, 1, leaf);
        if (ripe) {
          if (kind === 'melon') { ellipse(ctx, x + 1, 13, 3, 2, fruit); P(ctx, x, 12, '#8fd07a'); }
          else { R(ctx, x, 15 - h + 3, 3, 3, fruit); P(ctx, x, 15 - h + 3, '#ffffff'); }
        }
      }
    }
  });
}

export function chest(rarity, open) {
  const col = { common: '#b98a52', rare: '#4aa3d8', legendary: '#f0c040' }[rarity] || '#b98a52';
  return cached(`chest:${rarity}:${open}`, 16, 14, (ctx) => {
    ellipse(ctx, 8, 12, 7, 2, 'rgba(0,0,0,0.25)');
    R(ctx, 1, 5, 14, 8, PAL.wood);
    R(ctx, 1, 11, 14, 1, PAL.woodDark);
    if (!open) { R(ctx, 1, 2, 14, 4, PAL.woodLight); R(ctx, 1, 2, 14, 1, col); }
    else { R(ctx, 2, 5, 12, 2, '#1a0e08'); R(ctx, 1, 0, 14, 3, PAL.woodLight); R(ctx, 4, 4, 8, 2, PAL.fire1); }
    R(ctx, 1, 5, 1, 8, col); R(ctx, 14, 5, 1, 8, col); R(ctx, 7, 5, 2, 3, col);
  });
}

export function camel(frame) {
  return cached('camel' + frame, 28, 24, (ctx) => {
    ellipse(ctx, 14, 22, 11, 2, 'rgba(0,0,0,0.2)');
    const c = '#c8964f', d = '#a0703a';
    R(ctx, 6, 9, 14, 6, c); ellipse(ctx, 12, 8, 4, 3, c); // سنام
    R(ctx, 7, 15, 2, 7, d); R(ctx, 17, 15, 2, 7, d);
    R(ctx, 10, 15, 2, 6 + (frame ? 1 : 0), c); R(ctx, 14, 15, 2, 7 - (frame ? 1 : 0), c);
    line(ctx, 20, 10, 23, 4, c, 2); R(ctx, 22, 2, 5, 3, c); P(ctx, 25, 3, '#1a1010');
    R(ctx, 8, 8, 8, 2, '#b8292a'); // سرج
  });
}

export function sheep(frame) {
  return cached('sheep' + frame, 14, 12, (ctx) => {
    ellipse(ctx, 7, 11, 5, 1, 'rgba(0,0,0,0.2)');
    ellipse(ctx, 6, 6, 5, 3, '#f0ece0');
    R(ctx, 10, 4, 3, 3, '#3a2a20');
    R(ctx, 3, 9, 1, 2 + frame, '#3a2a20'); R(ctx, 8, 9, 1, 3 - frame, '#3a2a20');
  });
}

// ---------- الوحوش ----------
export function enemy(kind, frame, hurt) {
  return cached(`en:${kind}:${frame}:${hurt}`, 20, 20, (ctx) => {
    ellipse(ctx, 10, 18, 6, 1, 'rgba(0,0,0,0.3)');
    const H = hurt ? '#ffffff' : null;
    if (kind === 'scorpion') {
      const b = H || '#5a2a1a', l = H || '#8a3a20';
      R(ctx, 6, 11, 8, 5, b); R(ctx, 7, 10, 6, 1, l);
      for (let i = 0; i < 3; i++) { P(ctx, 5, 12 + i + (frame && i === 1 ? 1 : 0), b); P(ctx, 14, 12 + i + (!frame && i === 1 ? 1 : 0), b); }
      R(ctx, 3, 9, 3, 2, l); R(ctx, 14, 9, 3, 2, l); P(ctx, 3, 8, b); P(ctx, 16, 8, b);
      // الذيل
      R(ctx, 9, 7, 2, 4, b); R(ctx, 10, 4, 2, 3, b); R(ctx, 11, 3, 3, 2, b); P(ctx, 13, 5, H || '#ffcc33');
      P(ctx, 8, 12, '#ff4030'); P(ctx, 11, 12, '#ff4030');
    } else if (kind === 'ghoul') {
      const b = H || '#8f8a70', d = H || '#5f5a48';
      R(ctx, 6, 5, 8, 11, b); R(ctx, 5, 8, 2, 7 + frame, d); R(ctx, 13, 8, 2, 8 - frame, d);
      R(ctx, 7, 2, 6, 5, b); R(ctx, 7, 16, 2, 2, d); R(ctx, 11, 16, 2, 2, d);
      P(ctx, 8, 4, '#ffe040'); P(ctx, 11, 4, '#ffe040');
      R(ctx, 8, 6, 4, 1, '#3a3020');
    } else if (kind === 'bat') {
      const b = H || '#3a2a3a';
      R(ctx, 8, 8, 4, 4, b);
      if (frame) { R(ctx, 3, 6, 5, 2, b); R(ctx, 12, 6, 5, 2, b); }
      else { R(ctx, 3, 10, 5, 2, b); R(ctx, 12, 10, 5, 2, b); }
      P(ctx, 9, 9, '#ff5050'); P(ctx, 11, 9, '#ff5050');
    } else if (kind === 'marid') {
      const b = H || '#6a2ad0', d = H || '#3a1a80';
      R(ctx, 5, 5, 10, 9, b); ellipse(ctx, 10, 15, 4, 2, d); R(ctx, 8, 17, 4, 2, d);
      R(ctx, 3, 6, 2, 6 + frame, d); R(ctx, 15, 6, 2, 6 - frame, d);
      R(ctx, 7, 1, 6, 5, b); P(ctx, 6, 0, '#e8d8a0'); P(ctx, 13, 0, '#e8d8a0');
      P(ctx, 8, 3, '#ff4030'); P(ctx, 11, 3, '#ff4030'); R(ctx, 8, 5, 4, 1, '#ffd24a');
    }
  });
}

// ---------- السرداب ----------
export function dungeonTile(isWall, below, tx, ty) {
  return cached(`dt:${isWall}:${below}:${(tx * 7 + ty * 3) % 4}`, 16, 16, (ctx) => {
    const v = (tx * 7 + ty * 3) % 4;
    if (!isWall) {
      R(ctx, 0, 0, 16, 16, '#4a3a30');
      R(ctx, 0, 7, 16, 1, '#3a2c24'); R(ctx, 0, 15, 16, 1, '#3a2c24');
      R(ctx, (v * 4 + 3) % 16, 0, 1, 7, '#3a2c24'); R(ctx, (v * 4 + 10) % 16, 8, 1, 7, '#3a2c24');
      if (v === 2) R(ctx, 4, 10, 2, 1, '#5e4a3c');
    } else if (below) {
      // وجه جدار ظاهر
      R(ctx, 0, 0, 16, 16, '#5a4636');
      for (let r = 0; r < 4; r++) { R(ctx, 0, r * 4 + 3, 16, 1, '#3e2e22'); R(ctx, ((r + v) % 2) * 6 + 3, r * 4, 1, 3, '#3e2e22'); }
      R(ctx, 0, 0, 16, 2, '#6e5844');
    } else {
      R(ctx, 0, 0, 16, 16, '#1a1310');
    }
  });
}

export function stairs(down) {
  return cached('stairs' + down, 16, 16, (ctx) => {
    for (let i = 0; i < 4; i++) {
      const c = down ? shade('#6a5646', -i * 0.2) : shade('#8a7666', -0.1 * (3 - i));
      R(ctx, 1, i * 4, 14, 4, c);
      R(ctx, 1, i * 4, 14, 1, shade(c, 0.2));
    }
  });
}

export function torch(t) {
  const f = Math.floor(t * 8) % 3;
  return cached('torch' + f, 8, 14, (ctx) => {
    R(ctx, 3, 6, 2, 8, PAL.woodDark);
    R(ctx, 2, 3 - (f % 2), 4, 4, [PAL.fire3, PAL.fire2, PAL.fire1][f]);
    R(ctx, 3, 2, 2, 2, PAL.fire1);
  });
}

export function cryptDoor(open, t) {
  const g = Math.floor(t * 3) % 2;
  return cached(`cdoor:${open}:${g}`, 20, 16, (ctx) => {
    R(ctx, 0, 1, 20, 14, PAL.stoneDark);
    if (open) {
      R(ctx, 2, 3, 16, 10, '#0c0806');
      for (let i = 0; i < 3; i++) R(ctx, 4 + i * 2, 4 + i * 3, 12 - i * 4, 2, '#3a2c24');
    } else {
      R(ctx, 1, 2, 18, 12, PAL.stone);
      const rc = g ? '#7fb2ff' : '#4f82df';
      P(ctx, 5, 5, rc); P(ctx, 6, 6, rc); P(ctx, 5, 7, rc); P(ctx, 10, 4, rc); P(ctx, 10, 6, rc); P(ctx, 10, 8, rc); P(ctx, 14, 6, rc); P(ctx, 15, 5, rc); P(ctx, 15, 7, rc);
      R(ctx, 3, 10, 14, 1, PAL.stoneDark);
    }
  });
}

export function gateArch() {
  return cached('arch', 48, 40, (ctx) => {
    // قوس عربي فوق البوابة
    R(ctx, 0, 8, 8, 32, PAL.wall); R(ctx, 40, 8, 8, 32, PAL.wall);
    R(ctx, 0, 8, 8, 3, PAL.wallTop); R(ctx, 40, 8, 8, 3, PAL.wallTop);
    for (let x = 8; x < 40; x++) {
      const t = (x - 24) / 16;
      const y = Math.round(10 + 10 * (1 - Math.sqrt(Math.max(0, 1 - t * t))));
      R(ctx, x, 4, 1, Math.max(3, 18 - y), PAL.wall);
      P(ctx, x, 4, PAL.wallTop);
    }
    R(ctx, 0, 0, 48, 5, PAL.wallTop);
    for (let x = 2; x < 48; x += 6) R(ctx, x, -1, 4, 2, PAL.wallTop);
    R(ctx, 8, 14, 3, 26, PAL.woodDark); R(ctx, 37, 14, 3, 26, PAL.woodDark);
    R(ctx, 20, 1, 8, 3, PAL.brass);
  });
}

export function stableArt() {
  return cached('stable', 56, 40, (ctx) => {
    for (let x = 0; x < 56; x += 6) R(ctx, x, 20, 2, 18, PAL.woodDark);
    R(ctx, 0, 23, 56, 2, PAL.wood); R(ctx, 0, 31, 56, 2, PAL.wood);
    R(ctx, 0, 4, 56, 4, '#c8b080'); R(ctx, 2, 8, 2, 12, PAL.woodDark); R(ctx, 52, 8, 2, 12, PAL.woodDark);
  });
}

export function relicSparkle(t) {
  const f = Math.floor(t * 6) % 2;
  return cached('spark' + f, 7, 7, (ctx) => {
    const c = f ? '#fff6c0' : '#ffd24a';
    R(ctx, 3, 0, 1, 7, c); R(ctx, 0, 3, 7, 1, c);
  });
}

// ---------- النياق ----------
// col = { body, dark, hump }. الرسمة متجهة يمين
export function camelSprite(col, frame, key) {
  return cached(`camelS:${key}:${frame}`, 30, 26, (ctx) => {
    ellipse(ctx, 15, 24, 11, 2, 'rgba(0,0,0,0.22)');
    const c = col.body, d = col.dark, h = col.hump;
    // الرجول
    const l1 = frame === 1 ? 1 : 0, l2 = frame === 2 ? 1 : 0;
    R(ctx, 7, 15, 2, 8 - l1, d); R(ctx, 10, 15, 2, 8 - l2, c);
    R(ctx, 17, 15, 2, 8 - l2, d); R(ctx, 20, 15, 2, 8 - l1, c);
    R(ctx, 7, 22 - l1, 2, 1, '#3a2616'); R(ctx, 10, 22 - l2, 2, 1, '#3a2616'); R(ctx, 17, 22 - l2, 2, 1, '#3a2616'); R(ctx, 20, 22 - l1, 2, 1, '#3a2616');
    // الجسم والسنام
    ellipse(ctx, 14, 13, 9, 4, c);
    ellipse(ctx, 13, 9, 5, 4, c);
    ellipse(ctx, 12, 8, 3, 2, h);
    R(ctx, 6, 14, 17, 2, d);
    R(ctx, 5, 11, 2, 4, c); P(ctx, 4, 12, d); // الذيل
    // الرقبة والراس (frame 3 و4 = راسها نازل تاكل، والفك يتحرك)
    if (frame >= 3) {
      line(ctx, 22, 13, 25, 19, c, 3);
      R(ctx, 24, 19, 5, 3, c); R(ctx, 28, 21 - (frame === 4 ? 1 : 0), 2, 1 + (frame === 4 ? 1 : 0), d);
      P(ctx, 25, 19, '#1a1010');
      R(ctx, 24, 18, 2, 1, d);
      return;
    }
    line(ctx, 22, 12, 24, 6, c, 3);
    R(ctx, 23, 3, 6, 4, c); R(ctx, 27, 5, 2, 2, d);
    P(ctx, 26, 4, '#1a1010');
    R(ctx, 23, 2, 2, 1, d);
  });
}

export function heldJar(tilt) {
  return cached('hjar', 8, 9, (ctx) => {
    ellipse(ctx, 4, 5, 3, 3, '#b0643a');
    R(ctx, 2, 1, 4, 2, '#9a5530'); R(ctx, 3, 0, 2, 1, '#c07a4a');
    P(ctx, 2, 4, '#d0905a');
  });
}

export function bowl(fill) {
  const f = Math.round(fill * 3);
  return cached('bowl' + f, 10, 6, (ctx) => {
    R(ctx, 0, 1, 10, 1, '#8a5a33'); R(ctx, 1, 2, 8, 3, '#6e4424'); R(ctx, 2, 5, 6, 1, '#5e3a1f');
    if (f > 0) R(ctx, 1, 1, 8, 1, '#ffffff');
    if (f > 1) R(ctx, 2, 0, 6, 1, '#f4f0e8');
  });
}

export function bucket() {
  return cached('bucket', 6, 6, (ctx) => {
    R(ctx, 0, 1, 6, 5, PAL.woodDark); R(ctx, 0, 1, 6, 1, PAL.woodLight); R(ctx, 1, 0, 4, 1, '#999');
  });
}

export function trough(level) {
  const l = Math.max(0, Math.min(10, level));
  return cached('trough' + l, 30, 16, (ctx) => {
    ellipse(ctx, 15, 14, 14, 2, 'rgba(0,0,0,0.22)');
    R(ctx, 1, 4, 28, 9, '#a0603a');
    R(ctx, 1, 4, 28, 2, '#c07a4a');
    R(ctx, 3, 6, 24, 5, '#3a2418');
    if (l > 0) {
      const h = Math.max(1, Math.round((l / 10) * 5));
      R(ctx, 3, 11 - h, 24, h, PAL.water);
      R(ctx, 4, 11 - h, 8, 1, PAL.waterHi);
    }
    R(ctx, 1, 12, 28, 1, '#6e3e22');
    // جرة كبيرة جنب الحوض
    ellipse(ctx, 26, 5, 4, 5, '#b0643a'); R(ctx, 24, 0, 4, 2, '#9a5530');
  });
}

export function fencePost() {
  return cached('fpost', 4, 12, (ctx) => {
    R(ctx, 1, 0, 2, 12, PAL.woodDark); R(ctx, 1, 0, 2, 1, PAL.woodLight);
  });
}

export function sheepSprite(body, head, frame) {
  return cached(`sheepS:${body}:${head}:${frame}`, 16, 13, (ctx) => {
    ellipse(ctx, 8, 12, 6, 1, 'rgba(0,0,0,0.2)');
    ellipse(ctx, 7, 7, 6, 3, shade(body, -0.12));
    ellipse(ctx, 7, 6, 5, 3, body);
    P(ctx, 4, 4, '#ffffff'); P(ctx, 8, 4, '#ffffff');
    R(ctx, 11, 4, 4, 4, head); P(ctx, 14, 5, '#1a1010'); R(ctx, 11, 3, 1, 2, head);
    R(ctx, 3, 9, 1, 3 - (frame ? 1 : 0), '#3a2a20'); R(ctx, 6, 9, 1, 2 + (frame ? 1 : 0), '#3a2a20');
    R(ctx, 9, 9, 1, 3 - (frame ? 1 : 0), '#3a2a20'); R(ctx, 11, 9, 1, 2 + (frame ? 1 : 0), '#3a2a20');
  });
}

export function mudHouse(level = 1) {
  return cached('mudhouse' + level, 44, 40, (ctx) => {
    ellipse(ctx, 22, 38, 20, 2, 'rgba(0,0,0,0.2)');
    R(ctx, 3, 12, 38, 26, '#c79a66'); R(ctx, 3, 12, 38, 3, '#e0b27a');
    R(ctx, 3, 36, 38, 2, '#8a5a33');
    for (let x = 4; x < 40; x += 6) R(ctx, x, 9, 4, 3, '#e0b27a');
    R(ctx, 18, 22, 9, 16, '#5e3a1f'); R(ctx, 19, 23, 7, 1, '#8a5a33');
    R(ctx, 7, 20, 6, 5, '#3a2418'); R(ctx, 31, 20, 6, 5, '#3a2418');
    R(ctx, 7, 20, 6, 1, '#1a1010'); R(ctx, 31, 20, 6, 1, '#1a1010');
    if (level > 1) { R(ctx, 12, 2, 20, 8, '#c79a66'); R(ctx, 12, 2, 20, 2, '#e0b27a'); R(ctx, 19, 4, 6, 4, '#3a2418'); }
    for (let i = 0; i < 4; i++) R(ctx, 2 + i * 12, 14, 1, 1, '#6e4424'); // خشب بارز
  });
}

export function ordersBoard() {
  return cached('oboard', 28, 30, (ctx) => {
    ellipse(ctx, 14, 28, 12, 2, 'rgba(0,0,0,0.2)');
    R(ctx, 3, 12, 2, 16, PAL.woodDark); R(ctx, 23, 12, 2, 16, PAL.woodDark);
    R(ctx, 1, 2, 26, 16, PAL.wood); R(ctx, 2, 3, 24, 14, PAL.woodLight);
    const papers = ['#f4ecd8', '#fff8e8', '#efe2c4'];
    for (let i = 0; i < 6; i++) { const x = 3 + (i % 3) * 8, y = 4 + Math.floor(i / 3) * 7; R(ctx, x, y, 6, 5, papers[i % 3]); R(ctx, x + 1, y + 1, 4, 1, '#8a8070'); P(ctx, x + 3, y, '#c9302c'); }
  });
}

export function shopStall() {
  return cached('shopstall', 40, 34, (ctx) => {
    ellipse(ctx, 20, 32, 18, 2, 'rgba(0,0,0,0.2)');
    R(ctx, 2, 4, 36, 6, '#c9302c');
    for (let x = 2; x < 38; x += 6) R(ctx, x, 4, 3, 6, '#f4ecd8');
    for (let x = 2; x < 38; x += 4) R(ctx, x, 10, 2, 2, '#c9302c');
    R(ctx, 4, 10, 2, 22, PAL.woodDark); R(ctx, 34, 10, 2, 22, PAL.woodDark);
    R(ctx, 3, 20, 34, 5, PAL.woodLight); R(ctx, 3, 25, 34, 7, PAL.wood);
    const goods = ['#d9401a', '#e6c050', '#3f8f3a', '#f4f0e8', '#8a5a33', '#c98a3c'];
    for (let i = 0; i < 6; i++) { R(ctx, 5 + i * 5, 16, 4, 4, goods[i]); P(ctx, 6 + i * 5, 16, '#fff'); }
  });
}

export function scaffold(p) {
  return cached('scaf' + Math.round(p * 4), 30, 30, (ctx) => {
    R(ctx, 2, 4, 2, 26, PAL.woodDark); R(ctx, 26, 4, 2, 26, PAL.woodDark);
    R(ctx, 2, 10, 26, 2, PAL.wood); R(ctx, 2, 20, 26, 2, PAL.wood);
    line(ctx, 3, 28, 27, 6, PAL.woodLight);
    const h = Math.round(p * 18);
    R(ctx, 6, 28 - h, 18, h, '#c79a66');
  });
}

// ---------- تحسين البكسل: حدود داكنة + إضاءة حافة ----------
const outlineCache = new WeakMap();
const OUTLINE = [40, 22, 10];
// يرجع نسخة من الرسمة أكبر ببكسل من كل جهة، فيها حد داكن حولها وإضاءة خفيفة على الحافة العلوية
export function outlined(img) {
  let c = outlineCache.get(img);
  if (c) return c;
  const w = img.width, h = img.height;
  c = canvas(w + 2, h + 2);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 1, 1);
  const data = ctx.getImageData(0, 0, w + 2, h + 2);
  const d = data.data;
  const W = w + 2, H = h + 2;
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 140;
  const out = new Uint8ClampedArray(d);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (solid(x, y)) {
        // إضاءة الحافة العلوية
        if (!solid(x, y - 1)) { out[i] = Math.min(255, d[i] * 1.18 + 14); out[i + 1] = Math.min(255, d[i + 1] * 1.15 + 12); out[i + 2] = Math.min(255, d[i + 2] * 1.08 + 8); }
        // ظل الحافة السفلية
        else if (!solid(x, y + 1)) { out[i] = d[i] * 0.8; out[i + 1] = d[i + 1] * 0.78; out[i + 2] = d[i + 2] * 0.78; }
        continue;
      }
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        out[i] = OUTLINE[0]; out[i + 1] = OUTLINE[1]; out[i + 2] = OUTLINE[2]; out[i + 3] = 215;
      }
    }
  }
  data.data.set(out);
  ctx.putImageData(data, 0, 0);
  outlineCache.set(img, c);
  return c;
}

// ---------- أشياء تنحط باختيارك ----------
export function storageChest(level = 1) {
  return cached('schest:' + level, 16, 16, (ctx) => {
    ellipse(ctx, 8, 14, 7, 2, 'rgba(0,0,0,0.25)');
    const band = level >= 3 ? '#e8c050' : level === 2 ? '#c0c4c8' : '#6a4a2a';
    R(ctx, 1, 5, 14, 9, PAL.wood);
    R(ctx, 1, 2, 14, 4, PAL.woodLight);
    R(ctx, 1, 5, 14, 1, PAL.woodDark);
    R(ctx, 1, 9, 14, 1, PAL.woodDark);
    R(ctx, 1, 2, 1, 12, band); R(ctx, 14, 2, 1, 12, band);
    R(ctx, 6, 5, 4, 3, band); P(ctx, 7, 6, '#2a1a0a'); P(ctx, 8, 6, '#2a1a0a');
    R(ctx, 3, 11, 10, 1, PAL.woodLight);
  });
}

export function flowers(v = 0) {
  return cached('flowers:' + v, 16, 14, (ctx) => {
    ellipse(ctx, 8, 11, 7, 3, '#6a4a2a');
    ellipse(ctx, 8, 10, 6, 2, '#4a2e18');
    const cols = [['#ff5a7a', '#ffe060'], ['#ffa040', '#fff0f0'], ['#b070f0', '#ffe060']][v % 3];
    for (const [x, y] of [[4, 7], [8, 5], [12, 7], [6, 9], [10, 9]]) {
      R(ctx, x, y + 1, 1, 3, '#3f7d2a');
      P(ctx, x - 1, y, cols[0]); P(ctx, x + 1, y, cols[0]); P(ctx, x, y - 1, cols[0]); P(ctx, x, y + 1, cols[0]); P(ctx, x, y, cols[1]);
    }
  });
}

export function potPalm() {
  return cached('potpalm', 20, 30, (ctx) => {
    ellipse(ctx, 10, 28, 6, 2, 'rgba(0,0,0,0.25)');
    R(ctx, 6, 20, 8, 8, '#a8583a'); R(ctx, 5, 20, 10, 2, '#c87a4a'); R(ctx, 7, 24, 6, 1, '#e0b050');
    R(ctx, 9, 11, 2, 10, PAL.wood);
    for (const [dx, dy] of [[-8, 3], [-6, -2], [0, -5], [6, -2], [8, 3], [-3, 5], [3, 5]]) line(ctx, 10, 11, 10 + dx, 11 + dy, PAL.leaf, 1);
    for (const [dx, dy] of [[-7, 4], [7, 4], [0, -4]]) P(ctx, 10 + dx, 11 + dy, PAL.leafDark);
  });
}

export function bench() {
  return cached('bench', 30, 16, (ctx) => {
    ellipse(ctx, 15, 14, 13, 2, 'rgba(0,0,0,0.22)');
    R(ctx, 2, 6, 26, 3, PAL.woodLight); R(ctx, 2, 9, 26, 1, PAL.woodDark);
    R(ctx, 2, 2, 26, 2, PAL.wood);
    R(ctx, 4, 4, 2, 2, PAL.woodDark); R(ctx, 24, 4, 2, 2, PAL.woodDark);
    R(ctx, 4, 10, 2, 4, PAL.woodDark); R(ctx, 24, 10, 2, 4, PAL.woodDark);
  });
}

export function yardTorch(t = 0) {
  const f = Math.floor(t * 8) % 3;
  return cached('torch:' + f, 10, 26, (ctx) => {
    ellipse(ctx, 5, 24, 3, 1, 'rgba(0,0,0,0.25)');
    R(ctx, 4, 9, 2, 16, PAL.woodDark);
    R(ctx, 3, 8, 4, 2, '#5a5048');
    const h = 5 + f;
    R(ctx, 3, 8 - h, 4, h, '#f08a2a'); R(ctx, 4, 7 - h, 2, h - 1, '#ffd24a'); P(ctx, 4 + (f % 2), 5 - h, '#fff3c4');
  });
}

export function dallahStand(t = 0) {
  const f = Math.floor(t * 6) % 2;
  return cached('dallah:' + f, 14, 18, (ctx) => {
    ellipse(ctx, 7, 16, 6, 2, 'rgba(0,0,0,0.25)');
    R(ctx, 2, 12, 10, 3, '#3a3030'); R(ctx, 3, 11, 8, 1, f ? '#ff8a2a' : '#ffb04a');
    R(ctx, 5, 5, 5, 6, '#d8a040'); R(ctx, 6, 3, 3, 2, '#e8c060'); R(ctx, 7, 1, 1, 2, '#e8c060');
    line(ctx, 10, 6, 12, 3, '#d8a040'); R(ctx, 3, 6, 2, 3, '#b8862a');
  });
}

export function pathTile(kind = 'stone', v = 0) {
  return cached(`path:${kind}:${v}`, 16, 16, (ctx) => {
    if (kind === 'stone') {
      R(ctx, 0, 0, 16, 16, '#a89c8a');
      const stones = [[1, 1, 6, 5], [8, 1, 7, 4], [1, 7, 4, 4], [6, 6, 5, 5], [12, 6, 3, 5], [1, 12, 7, 3], [9, 12, 6, 3]];
      for (const [x, y, w, h] of stones) { R(ctx, x, y, w, h, v % 2 ? '#c4bcb0' : '#bab2a4'); R(ctx, x, y, w, 1, '#d8d0c4'); R(ctx, x, y + h - 1, w, 1, '#8a8274'); }
    } else {
      R(ctx, 0, 0, 16, 16, '#c8a070');
      for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < 16; x += 4) { R(ctx, x, y, 3, 3, '#d8b484'); P(ctx, x, y, '#e8c898'); }
    }
  });
}

// المخزن الكبير: بيت خشب بباب عريض وسقف، ويكبر شكله مع المستوى
export function barn(level = 1) {
  return cached('barn:' + level, 50, 44, (ctx) => {
    ellipse(ctx, 25, 41, 22, 3, 'rgba(0,0,0,0.25)');
    const wall = level >= 3 ? '#9a4a2a' : '#8a5a33', dark = level >= 3 ? '#6e3018' : PAL.woodDark;
    // الجدران
    R(ctx, 5, 18, 40, 22, wall);
    for (let x = 7; x < 45; x += 5) R(ctx, x, 18, 1, 22, dark);
    // السقف
    for (let i = 0; i < 12; i++) R(ctx, 3 + i, 17 - i, 44 - i * 2, 1, i % 3 === 0 ? '#5e3a1f' : '#b07a48');
    R(ctx, 2, 17, 46, 2, '#5e3a1f');
    // الباب العريض بخشب مصلّب
    R(ctx, 17, 24, 16, 16, '#4a2e18');
    line(ctx, 17, 24, 32, 39, '#b07a48'); line(ctx, 32, 24, 17, 39, '#b07a48');
    R(ctx, 17, 24, 16, 1, '#b07a48'); R(ctx, 24, 24, 1, 16, '#b07a48');
    // شباك علوي
    R(ctx, 22, 9, 6, 5, '#2a1a0a'); R(ctx, 22, 11, 6, 1, '#b07a48');
    // أكياس وخشب جنبه
    R(ctx, 6, 33, 8, 6, '#d8c090'); R(ctx, 7, 31, 6, 3, '#e8d0a0');
    R(ctx, 36, 34, 9, 2, '#8a5a33'); R(ctx, 37, 32, 7, 2, '#a06a3a'); R(ctx, 38, 30, 5, 2, '#8a5a33');
    if (level >= 2) { R(ctx, 4, 16, 42, 1, '#e8b53a'); P(ctx, 25, 5, '#e8b53a'); }
  });
}

// قن الدجاج: بيت خشب صغير بسقف سعف، وسلّم للدجاج، وشبك قدام
export function coop(level = 1, eggs = false) {
  return cached(`coop:${level}:${eggs ? 1 : 0}`, 48, 36, (ctx) => {
    ellipse(ctx, 24, 33, 22, 3, 'rgba(0,0,0,0.25)');
    const wall = level >= 3 ? '#b0703a' : '#a06a3a';
    // البيت
    R(ctx, 6, 14, 22, 18, wall);
    for (let x = 8; x < 28; x += 4) R(ctx, x, 14, 1, 18, PAL.woodDark);
    // سقف سعف
    for (let i = 0; i < 8; i++) R(ctx, 4 + i, 13 - i, 26 - i * 2, 1, i % 2 ? '#c8a050' : '#a8823a');
    R(ctx, 3, 13, 28, 2, '#7a5a2a');
    // الباب الصغير والسلّم
    R(ctx, 14, 22, 7, 7, '#3a2210');
    line(ctx, 17, 29, 23, 33, '#8a5a33', 2);
    for (let i = 0; i < 3; i++) R(ctx, 18 + i * 2, 30 + i, 3, 1, '#c89a5a');
    // الشبك قدام
    R(ctx, 29, 18, 17, 14, 'rgba(255,255,255,0.08)');
    for (let x = 29; x <= 45; x += 4) R(ctx, x, 18, 1, 14, '#6e4a28');
    R(ctx, 29, 18, 17, 1, '#6e4a28'); R(ctx, 29, 25, 17, 1, 'rgba(110,74,40,0.6)');
    // صحن أكل
    ellipse(ctx, 37, 30, 4, 1.5, '#8a6a3a'); P(ctx, 36, 29, '#e8c060'); P(ctx, 38, 29, '#e8c060');
    if (eggs) { ellipse(ctx, 10, 30, 2, 1.5, '#fff6e0'); ellipse(ctx, 13, 31, 2, 1.5, '#f4e4c0'); }
    if (level >= 2) { R(ctx, 3, 12, 28, 1, '#e8b53a'); }
    if (level >= 3) { R(ctx, 16, 16, 3, 3, '#2a1a0a'); P(ctx, 17, 17, '#ffd24a'); }
  });
}

// دجاجة صغيرة: frame 0 واقفة، 1 تمشي، 2 تنقر الأرض
export function hen(color = 0, frame = 0) {
  const body = ['#f4f0e6', '#b8743a', '#3a3030', '#d8a860'][color % 4];
  return cached(`hen:${color % 4}:${frame}`, 12, 11, (ctx) => {
    ellipse(ctx, 6, 10, 4, 1, 'rgba(0,0,0,0.25)');
    const peck = frame === 2;
    // الجسم والذيل
    R(ctx, 3, 4, 6, 4, body); R(ctx, 2, 3, 2, 3, body); R(ctx, 4, 8, 4, 1, body);
    P(ctx, 1, 3, color % 4 === 2 ? '#2a5a3a' : body);
    // الراس
    const hx = peck ? 8 : 8, hy = peck ? 5 : 1;
    R(ctx, hx, hy, 3, 3, body);
    P(ctx, hx + 1, hy - 1, '#d83a2a'); P(ctx, hx + 2, hy - 1, '#d83a2a');
    P(ctx, hx + 3, hy + 1, '#e8a030');
    P(ctx, hx + 2, hy + 1, '#1a0e08');
    P(ctx, hx + 1, hy + 3, '#d83a2a');
    // الرجول
    const leg = frame === 1 ? 1 : 0;
    P(ctx, 5 - leg, 9, '#e8a030'); P(ctx, 7 + leg, 9, '#e8a030');
    R(ctx, 4, 5, 3, 1, 'rgba(0,0,0,0.12)');
  });
}

// ---------- زينة المواسم ----------
// فانوس رمضان: جسم ذهبي بزجاج ملون وضو يرف
export function ramadanLantern(t = 0, hue = 0) {
  const f = Math.floor(t * 5) % 2;
  const glass = ['#ffcf4a', '#ff8a5a', '#7ad0ff'][hue % 3];
  return cached(`rlantern:${hue % 3}:${f}`, 9, 14, (ctx) => {
    R(ctx, 4, 0, 1, 2, '#6e4a28');
    R(ctx, 2, 2, 5, 1, '#c8962a'); R(ctx, 3, 1, 3, 1, '#e8b53a');
    R(ctx, 1, 3, 7, 7, '#c8962a');
    R(ctx, 2, 4, 5, 5, f ? glass : '#fff3c4');
    R(ctx, 4, 4, 1, 5, '#c8962a');
    R(ctx, 1, 10, 7, 1, '#e8b53a'); R(ctx, 2, 11, 5, 1, '#c8962a'); R(ctx, 3, 12, 3, 1, '#e8b53a'); P(ctx, 4, 13, '#c8962a');
  });
}

// بالونة العيد بخيطها
export function balloon(color = 0) {
  const c = ['#e8342a', '#2a8ad8', '#4fb83a', '#f0c030', '#c04ad0'][color % 5];
  return cached(`balloon:${color % 5}`, 8, 18, (ctx) => {
    for (let y = 0; y < 8; y++) { const w = Math.round(Math.sqrt(16 - (y - 3.5) ** 2) * 1.6); R(ctx, 4 - Math.ceil(w / 2), y, w, 1, c); }
    P(ctx, 2, 2, 'rgba(255,255,255,0.7)'); P(ctx, 3, 9, c);
    for (let y = 10; y < 18; y++) P(ctx, 3 + (y % 3 === 0 ? 1 : 0), y, '#e8e0d0');
  });
}

// فقع طالع بالرمل بعد المطر: كومة رمل مشقوقة وفقعة تطل
export function truffleMound(t = 0) {
  const sh = Math.floor(t * 2) % 2;
  return cached(`truffle:${sh}`, 14, 9, (ctx) => {
    ellipse(ctx, 7, 7, 6, 2, 'rgba(0,0,0,0.18)');
    ellipse(ctx, 7, 6, 6, 2.5, '#e2bf82');
    R(ctx, 3, 5, 3, 1, '#b8924e'); R(ctx, 8, 4, 3, 1, '#b8924e'); P(ctx, 6, 6, '#b8924e');
    ellipse(ctx, 7, 4, 2.5, 2, '#7a5634'); P(ctx, 6, 3, '#9a7048'); P(ctx, 8, 4, '#5e3f22');
    if (sh) P(ctx, 10, 2, '#fff6c0');
  });
}

// شبّة نار الكشتة: حجار وحطب ونار تتحرك ودلّة
export function campfire(t = 0) {
  const f = Math.floor(t * 8) % 3;
  return cached(`campfire:${f}`, 22, 18, (ctx) => {
    ellipse(ctx, 11, 15, 10, 3, 'rgba(0,0,0,0.25)');
    for (const [x, y] of [[3, 13], [6, 15], [10, 16], [14, 15], [17, 13], [18, 11], [3, 11]]) { R(ctx, x, y, 3, 2, '#8a8478'); P(ctx, x, y, '#b0aa9c'); }
    line(ctx, 6, 14, 15, 10, '#5e3a1f', 2); line(ctx, 15, 14, 6, 10, '#6e4a28', 2);
    const h = 6 + f;
    R(ctx, 8, 12 - h, 6, h, '#e85a1a'); R(ctx, 9, 11 - h, 4, h - 1, '#ffa030'); R(ctx, 10, 10 - h + f, 2, h - 3, '#ffe68a');
    P(ctx, 11 + (f - 1), 4 - f, '#ffd24a');
    // دلّة على طرف النار
    R(ctx, 17, 7, 3, 4, '#d8a040'); R(ctx, 17, 6, 3, 1, '#e8c060'); P(ctx, 20, 8, '#d8a040'); P(ctx, 16, 9, '#b8862a');
  });
}
