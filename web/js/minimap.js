// الخريطة الصغيرة بالزاوية، والخريطة الكبيرة (نفس الرسم بمقاس أكبر)
import { T, TILE, KHAN, PEN, FOLD, MAP_W, MAP_H } from './data/map.js';
import { FARMS } from './data/openworld.js';
import { NPCS } from './data/npcs.js';
import { isReady } from './systems/farming.js';
import { footprint, isBuilt, info } from './systems/placement.js';
import { PLACEABLES } from './data/buildings.js';
import { BUILD_ZONES } from './data/zones.js';

const COL = {
  [T.SAND]: '#d9b77a', [T.SAND2]: '#cfad70', [T.GRASS]: '#7fa84a', [T.WATER]: '#3f8fc0', [T.ROAD]: '#b8925a',
  [T.FLOOR]: '#a88a66', [T.WALL]: '#6b4a30', [T.SOIL]: '#7a4f2e', [T.ROCKY]: '#a89a84', [T.WADI]: '#c2a068',
  [T.DUNE]: '#c89a58', [T.RUBBLE]: '#8a7a66', [T.ROOMFLOOR]: '#b89a70', [T.GATE]: '#8a5a33',
};

const cache = new WeakMap();

function terrain(cv, game) {
  const open = game.mode === 'open';
  const tiles = open ? game.open.tiles : game.world.tiles;
  const W = open ? game.open.W : MAP_W, H = open ? game.open.H : MAP_H;
  const key = `${game.mode}:${cv.width}x${cv.height}:${game.boxVersion || 0}`;
  const c = cache.get(cv);
  if (c && c.key === key) return c;
  const img = document.createElement('canvas');
  img.width = W; img.height = H;
  const x = img.getContext('2d');
  const d = x.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const hex = COL[tiles[i]] || '#d9b77a';
    d.data[i * 4] = parseInt(hex.slice(1, 3), 16);
    d.data[i * 4 + 1] = parseInt(hex.slice(3, 5), 16);
    d.data[i * 4 + 2] = parseInt(hex.slice(5, 7), 16);
    d.data[i * 4 + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  const out = { key, img, W, H };
  cache.set(cv, out);
  return out;
}

export function drawMap(cv, game, opts = {}) {
  if (game.mode === 'dungeon') return false;
  const ctx = cv.getContext('2d');
  const t = terrain(cv, game);
  const sx = cv.width / (t.W * TILE), sy = cv.height / (t.H * TILE);
  const P = (x, y) => [x * sx, y * sy];
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(t.img, 0, 0, cv.width, cv.height);
  const s = game.state;
  const k = Math.max(1.5, cv.width / 90);
  const dot = (x, y, col, r = k, stroke = 'rgba(0,0,0,.6)') => {
    const [px, py] = P(x, y);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = Math.max(1, r / 3); ctx.strokeStyle = stroke; ctx.stroke();
  };
  const box = (x0, y0, x1, y1, col, fill) => {
    const [a, b] = P(x0, y0), [c, d] = P(x1, y1);
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(a, b, c - a, d - b); }
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, k / 2); ctx.strokeRect(a, b, c - a, d - b);
  };
  const label = (x, y, text, col = '#fff') => {
    if (!opts.labels) return;
    const [px, py] = P(x, y);
    ctx.font = `700 ${Math.round(k * 4.2)}px Cairo, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,15,5,.85)'; ctx.strokeText(text, px, py);
    ctx.fillStyle = col; ctx.fillText(text, px, py);
  };

  if (game.mode === 'world') {
    box(KHAN.x0 * TILE, KHAN.y0 * TILE, (KHAN.x1 + 1) * TILE, (KHAN.y1 + 1) * TILE, 'rgba(60,30,10,.8)');
    label((KHAN.x0 + KHAN.x1) / 2 * TILE, (KHAN.y0 + 2) * TILE, 'الخان');
    // ساحات البناء
    for (const z of BUILD_ZONES) {
      const r = z.rect;
      const [a1, b1] = P(r.x0 * TILE, r.y0 * TILE), [c1, d1] = P((r.x1 + 1) * TILE, (r.y1 + 1) * TILE);
      ctx.fillStyle = 'rgba(255,240,200,0.12)';
      ctx.fillRect(a1, b1, c1 - a1, d1 - b1);
      ctx.setLineDash([3, 2]);
      ctx.strokeStyle = 'rgba(120,80,30,0.7)'; ctx.lineWidth = 1;
      ctx.strokeRect(a1 + 0.5, b1 + 0.5, c1 - a1 - 1, d1 - b1 - 1);
      ctx.setLineDash([]);
      label((r.x0 + r.x1 + 1) / 2 * TILE, (r.y0 + r.y1 + 1) / 2 * TILE, z.icon + ' ' + z.name, '#ffe9a8');
    }
    // المباني والديكور المنحطة باختيارك
    for (const p of s.placed || []) {
      const d = PLACEABLES[p.type];
      const f = footprint(p);
      const built = isBuilt(s, p);
      if (d.flat) { ctx.fillStyle = p.type === 'path' ? '#b8b0a2' : p.type === 'sandpath' ? '#d8b484' : '#9a2a3a'; const [a1, b1] = P(f.x0 * TILE, f.y0 * TILE), [c1, d1] = P((f.x1 + 1) * TILE, (f.y1 + 1) * TILE); ctx.fillRect(a1, b1, c1 - a1, d1 - b1); continue; }
      const fill = d.area ? (p.type === 'stable' ? 'rgba(255,200,120,.25)' : 'rgba(255,255,255,.2)') : built ? '#8a5a33' : 'rgba(255,230,150,.4)';
      box(f.x0 * TILE, f.y0 * TILE, (f.x1 + 1) * TILE, (f.y1 + 1) * TILE, '#5e3a1f', fill);
      if (d.cat === 'building') label((f.x0 + f.x1 + 1) / 2 * TILE, (f.y1 + 1.8) * TILE, info(p.type).name);
    }
    for (const o of game.world.objects) {
      if (o.kind === 'plot') {
        if (o.group === 2 && !s.built.farm2) continue;
        const p = s.plots[o.id];
        const [px, py] = P(o.x - 7, o.y - 14);
        ctx.fillStyle = !p ? '#5e3a1f' : isReady(p) ? '#6cf24a' : p.watered ? '#3f7d2a' : '#c8a040';
        ctx.fillRect(px, py, Math.max(2, 14 * sx), Math.max(2, 12 * sy));
      } else if (o.kind === 'palm' || o.kind === 'sidr' || o.kind === 'rock' || o.kind === 'clay') {
        const [px, py] = P(o.x, o.y - 6);
        const z = Math.max(1.5, k * (o.kind === 'rock' && o.variant === 'big' ? 1.1 : 0.8));
        ctx.fillStyle = o.kind === 'rock' ? '#7a7268' : o.kind === 'clay' ? '#8a4a28' : o.kind === 'sidr' ? '#3f6a24' : '#2f5a1c';
        ctx.fillRect(px - z / 2, py - z / 2, z, z);
      } else if (o.kind === 'worldexit') {
        dot(o.x, o.y, '#e8b53a', k * 1.3);
        label(o.x + 40, o.y - 30, 'طريق القرية', '#ffe07a');
      }
    }
    label(46 * TILE, 29.6 * TILE, 'الأحواض', '#d8ffb0');
    for (const [id, pos] of Object.entries(game.world.npcSpots)) {
      if (!game.npcPresent(id)) continue;
      dot(pos.x, pos.y, '#4ad0ff', k * 1.1);
      if (NPCS[id].veggie) label(pos.x, pos.y + 22, '🥕 أبو سالم', '#bff5a0');
    }
    if (s.built.stable) for (const c of s.camels) { const rt = game.camelRt && game.camelRt[c.id]; if (rt) dot(rt.x, rt.y, c.rare ? '#ffe04a' : '#ffb03a', k * 0.9); }
    if (s.built.sheepfold) for (const x of s.sheep) { const rt = game.sheepRt && game.sheepRt[x.id]; if (rt) dot(rt.x, rt.y, '#f4f0e6', k * 0.8); }
    if (game.wildRt) for (const rt of (game.guestRt.length ? game.wildRt.caravan.concat(game.wildRt.herd) : game.wildRt.herd)) dot(rt.x, rt.y, '#c89a5a', k * 0.75);
    for (const w of s.workers) { const rt = game.workerRt && game.workerRt[w.id]; if (rt) dot(rt.x, rt.y, w.status === 'strike' ? '#ff5a3a' : '#ffe04a', k * 0.8); }
  } else {
    for (const [id, def] of Object.entries(FARMS)) {
      const f = s.farms && s.farms[id];
      const r = def.rect;
      const owned = f && f.owned;
      box(r.x0 * TILE, r.y0 * TILE, (r.x1 + 1) * TILE, (r.y1 + 1) * TILE, owned ? '#4f9a2f' : '#6b3f1f', owned ? 'rgba(120,220,90,.25)' : 'rgba(0,0,0,.08)');
      label((r.x0 + r.x1) / 2 * TILE, (r.y0 + r.y1) / 2 * TILE, (owned ? '✅ ' : '') + def.name.replace('مزرعة ', ''), owned ? '#c8ffb0' : '#fff');
      const o = game.open.farmObjs[id].owner;
      if (!owned) dot(o.x, o.y, '#4ad0ff', k * 1.1);
    }
    for (const rt of Object.values(game.openRt || {})) dot(rt.x, rt.y, rt.kind === 'sheep' ? '#f4f0e6' : '#ffb03a', k * 0.7);
    const home = game.open.objects.find(o => o.kind === 'gohome');
    if (home) { dot(home.x, home.y, '#e8b53a', k * 1.3); label(home.x, home.y - 26, 'مزرعتي', '#ffe07a'); }
  }
  const rain = game.rainLevel ? game.rainLevel() : 0;
  if (rain > 0) { ctx.fillStyle = `rgba(40,60,100,${0.25 * rain})`; ctx.fillRect(0, 0, cv.width, cv.height); }
  const gd = game.guide && game.guide.mode === game.mode ? game.guide : null;
  if (gd) dot(gd.x, gd.y, '#ff4a4a', k * 1.4, '#fff');
  const p = s.player;
  dot(p.x, p.y, '#ffffff', k * 1.5, '#1a0e08');
  return true;
}

export class Minimap {
  constructor(el) {
    this.el = el;
    this.cv = el.querySelector('canvas');
    this.acc = 0;
  }

  update(game, dt) {
    const show = game.mode !== 'dungeon';
    this.el.classList.toggle('hidden', !show);
    if (!show) return;
    this.acc += dt;
    if (this.acc < 0.2) return;
    this.acc = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(this.el.clientWidth * dpr), h = Math.round(this.el.clientHeight * dpr);
    if (w && (this.cv.width !== w || this.cv.height !== h)) { this.cv.width = w; this.cv.height = h; }
    drawMap(this.cv, game);
  }
}
