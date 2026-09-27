// الرسم الإيزومتريك (2.5D): الأرض معيّنات، الجدران مكعبات، والأشياء واقفة على نقطة الإسقاط
// العالم يبقى بإحداثيات المربعات (16) — الإسقاط للرسم بس
import * as art from './engine/art.js';
import { TILE, MAP_W, MAP_H, T, KHAN, GATE, PEN, FOLD } from './data/map.js';
import { camelColors } from './data/camels.js';
import { SHEEP_BREEDS } from './data/sheep.js';
import { WORKER_LOOKS, WORKER_TYPES } from './data/workers.js';
import * as camelSys from './systems/camels.js';
import * as sheepSys from './systems/sheep.js';
import { DW, DH, dTile, D } from './systems/dungeon.js';
import { NPCS, GUEST_LOOKS } from './data/npcs.js';
import { ITEMS, SEEDS } from './data/items.js';
import { BUILD_SPOTS } from './data/recipes.js';
import { darkness } from './systems/time.js';
import { currentQuest } from './systems/quests.js';

const BLOCK_H = { [T.WALL]: 22, [T.RUBBLE]: 7, [T.DUNE]: 6 };
const BLOCK_KIND = { [T.WALL]: 'wall', [T.RUBBLE]: 'rubble', [T.DUNE]: 'dune' };

export class Renderer {
  constructor(worldCanvas, fxCanvas) {
    this.wc = worldCanvas;
    this.fc = fxCanvas;
    this.w = this.wc.getContext('2d');
    this.f = this.fc.getContext('2d');
    this.light = document.createElement('canvas');
    this.l = this.light.getContext('2d');
    this.isoLayer = null;
    this.scale = 2;
    this.ox = MAP_H * TILE;
    this.resize();
  }

  resize() {
    const cw = window.innerWidth, ch = window.innerHeight;
    this.scale = Math.max(2, Math.round(ch / 190));
    this.bw = Math.ceil(cw / this.scale);
    this.bh = Math.ceil(ch / this.scale);
    this.wc.width = this.bw;
    this.wc.height = this.bh;
    this.wc.style.width = this.bw * this.scale + 'px';
    this.wc.style.height = this.bh * this.scale + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.fc.width = Math.round(cw * dpr);
    this.fc.height = Math.round(ch * dpr);
    this.fc.style.width = cw + 'px';
    this.fc.style.height = ch + 'px';
    this.light.width = this.bw;
    this.light.height = this.bh;
    this.w.imageSmoothingEnabled = false;
  }

  // ---------- الإسقاط ----------
  px(x, y) { return x - y + this.ox; }
  py(x, y) { return (x + y) / 2; }
  // من العالم لبكسل الشاشة (مع رفع للأعلى lift)
  S(x, y, lift = 0) {
    return [Math.round(x - y + this.ox - this.cam.x), Math.round((x + y) / 2 - lift - this.cam.y)];
  }

  groundTransform(ctx) {
    ctx.setTransform(1, 0.5, -1, 0.5, this.ox - this.cam.x, -this.cam.y);
  }

  // يحول طبقة مربعات (من فوق) لطبقة معيّنات
  toIso(square, cols, rows) {
    const c = art.canvas((cols + rows) * TILE, (cols + rows) * (TILE / 2) + 2);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0.5, -1, 0.5, rows * TILE, 0);
    ctx.drawImage(square, 0, 0);
    return c;
  }

  buildTileLayer(game) {
    const c = art.canvas(MAP_W * TILE, MAP_H * TILE);
    const ctx = c.getContext('2d');
    const getT = (x, y) => game.tileAtWorld(x, y);
    const blocks = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = getT(x, y);
        art.drawTile(ctx, t === T.WALL || t === T.RUBBLE ? T.FLOOR : t === T.DUNE ? T.SAND : t, x, y, x * TILE, y * TILE, getT);
        if (BLOCK_H[t]) blocks.push({ tx: x, ty: y, t });
      }
    }
    this.isoLayer = this.toIso(c, MAP_W, MAP_H);
    this.blocks = blocks;
    game.tileDirty = false;
  }

  buildDungeonLayer(dg) {
    const c = art.canvas(DW * TILE, DH * TILE);
    const ctx = c.getContext('2d');
    const blocks = [];
    for (let y = 0; y < DH; y++) {
      for (let x = 0; x < DW; x++) {
        const wall = dTile(dg.tiles, x, y) !== D.FLOOR;
        ctx.drawImage(art.dungeonTile(wall, false, x, y), x * TILE, y * TILE);
        if (wall) {
          const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([a, b]) => dTile(dg.tiles, x + a, y + b) === D.FLOOR);
          if (near) blocks.push({ tx: x, ty: y, t: 'd' });
        }
      }
    }
    dg.layer = this.toIso(c, DW, DH);
    dg.blocks = blocks;
  }

  camera(game) {
    const p = game.state.player;
    const cols = game.mode === 'dungeon' ? DW : MAP_W, rows = game.mode === 'dungeon' ? DH : MAP_H;
    const iw = (cols + rows) * TILE, ih = (cols + rows) * TILE / 2;
    let cx = Math.round(this.px(p.x, p.y) - this.bw / 2);
    let cy = Math.round(this.py(p.x, p.y) - 12 - this.bh / 2);
    cx = Math.max(0, Math.min(iw - this.bw, cx));
    cy = Math.max(-40, Math.min(ih - this.bh, cy));
    if (game.shake > 0) {
      cx += Math.round((Math.random() - 0.5) * game.shake);
      cy += Math.round((Math.random() - 0.5) * game.shake);
    }
    return { x: cx, y: cy };
  }

  draw(game) {
    const ctx = this.w;
    this.ox = (game.mode === 'dungeon' ? DH : MAP_H) * TILE;
    game.fx.ox = this.ox;
    const cam = this.camera(game);
    this.cam = cam;
    this.game = game;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = game.mode === 'dungeon' ? '#0c0806' : '#c99a55';
    ctx.fillRect(0, 0, this.bw, this.bh);
    const lights = [];
    const drawables = [];
    const ground = [];
    if (game.mode === 'world') {
      if (!this.isoLayer || game.tileDirty) this.buildTileLayer(game);
      ctx.drawImage(this.isoLayer, -cam.x, -cam.y);
      this.drawWater(game);
      this.collectBlocks(game, this.blocks, drawables);
      this.collectWorld(game, drawables, lights, ground);
    } else {
      const dg = game.dungeon;
      if (!dg.layer) this.buildDungeonLayer(dg);
      ctx.drawImage(dg.layer, -cam.x, -cam.y);
      this.collectBlocks(game, dg.blocks, drawables);
      this.collectDungeon(game, drawables, lights);
    }
    for (const g of ground) g(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.collectPlayer(game, drawables, lights);
    drawables.sort((a, b) => a.d - b.d);
    for (const d of drawables) d.draw(ctx);
    game.fx.draw(ctx, cam.x, cam.y);
    this.drawLighting(game, cam, lights);
    this.drawFx(game, cam);
  }

  drawWater(game) {
    const ctx = this.w;
    const f = Math.floor(game.t * 2) % 4;
    ctx.save();
    this.groundTransform(ctx);
    for (let y = 8; y < 34; y++) {
      for (let x = 42; x < 64; x++) {
        if (game.tileAtWorld(x, y) === T.WATER) ctx.drawImage(art.waterFrame((f + x + y) % 4), x * TILE, y * TILE);
      }
    }
    ctx.restore();
  }

  visible(x, y, m = 60) {
    const sx = this.px(x, y) - this.cam.x, sy = this.py(x, y) - this.cam.y;
    return sx > -m && sx < this.bw + m && sy > -m && sy < this.bh + m * 1.6;
  }

  // صورة واقفة على نقطة (x,y) بالعالم
  sprite(list, img, x, y, opts = {}) {
    list.push({
      d: x + y + (opts.dz || 0),
      draw: (ctx) => {
        const [sx, sy] = this.S(x, y, opts.lift || 0);
        if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
        const sc = opts.scale || 1;
        const w = img.width * sc, h = img.height * sc;
        if (opts.flip) {
          ctx.save();
          ctx.translate(sx + (opts.ox || 0), 0);
          ctx.scale(-1, 1);
          ctx.drawImage(img, Math.round(-w / 2), sy - Math.round(h), Math.round(w), Math.round(h));
          ctx.restore();
        } else ctx.drawImage(img, Math.round(sx - w / 2 + (opts.ox || 0)), sy - Math.round(h), Math.round(w), Math.round(h));
        ctx.globalAlpha = 1;
      },
    });
  }

  // صورة مسطحة على الأرض (سجاد، أحواض...)
  decal(ground, img, wx, wy, alpha = 1) {
    ground.push((ctx) => {
      ctx.save();
      this.groundTransform(ctx);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, Math.round(wx), Math.round(wy));
      ctx.restore();
    });
  }

  collectBlocks(game, blocks, list) {
    if (!blocks) return;
    const p = game.state.player;
    const pd = p.x + p.y;
    const [psx, psy] = [this.px(p.x, p.y) - this.cam.x, this.py(p.x, p.y) - this.cam.y];
    for (const b of blocks) {
      const wx = b.tx * TILE, wy = b.ty * TILE;
      const sx = this.px(wx, wy) - this.cam.x, sy = this.py(wx, wy) - this.cam.y;
      if (sx < -40 || sx > this.bw + 40 || sy < -40 || sy > this.bh + 30) continue;
      const kind = b.t === 'd' ? 'dwall' : BLOCK_KIND[b.t];
      const h = b.t === 'd' ? 8 : BLOCK_H[b.t];
      const img = art.isoBlock(kind, h, (b.tx + b.ty) % 2);
      const d = wx + wy + TILE;
      // شفاف إذا اللاعب وراه
      const behind = pd < d && Math.abs(psx - sx) < 22 && psy > sy - h - 4 && psy < sy + 26 && h > 10;
      list.push({
        d,
        draw: (ctx) => {
          if (behind) ctx.globalAlpha = 0.35;
          ctx.drawImage(img, Math.round(sx - 16), Math.round(sy - h));
          if (kind === 'wall' && (b.tx + b.ty) % 2 === 0 && !behind) ctx.drawImage(art.merlon(), Math.round(sx - 4), Math.round(sy - h - 4));
          ctx.globalAlpha = 1;
        },
      });
    }
  }

  collectWorld(game, list, lights, ground) {
    const s = game.state;
    const t = game.t;
    for (const o of game.world.objects) {
      if (!this.visible(o.x, o.y)) continue;
      const sh = o.shakeT > 0 ? Math.round(Math.sin(t * 80) * 1.5) : 0;
      if (o.shakeT > 0) o.shakeT -= 1 / 60;
      switch (o.kind) {
        case 'palm': {
          const dep = game.depleted(o);
          const sway = dep ? 0 : Math.round(Math.sin(t * 1.3 + o.tx) * 1.5);
          this.sprite(list, art.palm(o.tx % 5, sway, dep), o.x, o.y, { ox: sh });
          break;
        }
        case 'rock':
          if (!game.depleted(o)) this.sprite(list, art.rock(o.tx % 2, game.nodeHits(o)), o.x, o.y, { ox: sh });
          else this.sprite(list, art.deco(1), o.x, o.y, { dz: -8 });
          break;
        case 'clay': this.sprite(list, art.clayPit(game.depleted(o)), o.x, o.y, { ox: sh, dz: -8 }); break;
        case 'herb': this.sprite(list, art.herb(game.depleted(o)), o.x, o.y, { ox: sh, dz: -4 }); break;
        case 'deco': this.sprite(list, art.deco(o.variant), o.x, o.y, { dz: -6 }); break;
        case 'well': this.sprite(list, art.well(), o.x, o.y + 2, { ox: sh }); break;
        case 'tent': this.sprite(list, art.tent(), o.x, o.y + 2); break;
        case 'stall': this.sprite(list, art.stall(), o.x, o.y + 2); break;
        case 'sign': this.sprite(list, art.woodSign(), o.x, o.y); break;
        case 'lamp': {
          this.sprite(list, art.brassLamp(t), o.x, o.y, { lift: Math.round(Math.sin(t * 2) * 0.6) });
          lights.push({ x: o.x, y: o.y, lift: 6, r: 26, c: 'rgba(120,170,255,' });
          break;
        }
        case 'station': {
          this.sprite(list, art.station(o.station, t), o.x, o.y + 2);
          if (o.station === 'hearth') lights.push({ x: o.x, y: o.y, lift: 6, r: 58, c: 'rgba(255,160,60,', flicker: true });
          break;
        }
        case 'plot': {
          if (o.group === 2 && !s.built.farm2) break;
          const p = s.plots[o.id];
          this.decal(ground, art.soilPlot(!!(p && p.watered)), o.x - 7, o.y - 12);
          if (p) {
            const def = SEEDS[p.seed];
            const img = art.crop(def.crop, p.stage, def.days);
            const pk = o.popT ? Math.min(1, (t - o.popT) / 0.35) : 1;
            const sc = pk < 1 ? 0.3 + pk * 0.9 - Math.max(0, pk - 0.75) * 0.8 : 1;
            this.sprite(list, img, o.x + 1, o.y - 5, { scale: sc, ox: sh });
          }
          break;
        }
        case 'spot': this.collectSpot(game, o, list, lights, ground); break;
        default: break;
      }
    }
    if (s.built.gate) {
      const gx = (GATE.x0 + 1) * TILE, gy = (KHAN.y1 + 1) * TILE - 2;
      this.sprite(list, art.gateArch(), gx, gy, { dz: 8 });
    }
    for (const c of s.groundChests || []) {
      this.sprite(list, art.chest(c.rarity, false), c.x, c.y, { lift: Math.round(Math.sin(t * 4)) });
      lights.push({ x: c.x, y: c.y, lift: 6, r: 22, c: 'rgba(255,220,120,' });
    }
    for (const [id, pos] of Object.entries(game.world.npcSpots)) {
      if (!game.npcPresent(id)) continue;
      this.sprite(list, art.character(NPCS[id].look, 'down', 0, id), pos.x, pos.y);
      if (id === 'shepherd') {
        for (let i = 0; i < 4; i++) {
          const x = pos.x - 20 + i * 12 + Math.sin(t * 0.5 + i) * 4, y = pos.y + 14 + (i % 2) * 10;
          this.sprite(list, art.sheep(Math.floor(t * 2 + i) % 2), x, y);
        }
      }
    }
    if (game.guestRt.length) {
      const e = game.world.caravanEntry;
      this.sprite(list, art.camel(0), e.x - 30, e.y + 22);
      this.sprite(list, art.camel(1), e.x + 36, e.y + 26, { flip: true });
    }
    if (s.built.stable) this.collectPen(game, list, lights);
    if (s.built.sheepfold) this.collectFold(game, list);
    for (const g of game.guestRt) {
      const frame = g.moving ? 1 + (Math.floor(t * 6) % 2) : 0;
      this.sprite(list, art.character(GUEST_LOOKS[g.look], g.dir || 'down', frame, 'guest' + g.look), g.x, g.y);
    }
    this.collectWorkers(game, list);
  }

  collectSpot(game, o, list, lights, ground) {
    const s = game.state;
    const built = s.built[o.spot];
    const t = game.t;
    if (o.spot === 'crypt_door') {
      this.decal(ground, art.cryptDoor(!!built, t), o.x - 10, o.y - 14);
      if (!built) lights.push({ x: o.x, y: o.y, lift: 4, r: 18, c: 'rgba(100,150,255,' });
      if (built) return;
    }
    // سقالات البنّاء
    const job = s.workers && s.workers.find(w => w.job && w.job.spot === o.spot);
    if (job && !built) {
      this.sprite(list, art.scaffold(job.job.progress / job.job.need), o.x, o.y + 2);
      return;
    }
    if (built) {
      switch (o.spot) {
        case 'my_bed': this.decal(ground, art.floorBed('#b8292a'), o.x - 11, o.y - 12); break;
        case 'kiln': this.sprite(list, art.station('kiln', t), o.x, o.y + 2); lights.push({ x: o.x, y: o.y, lift: 4, r: 50, c: 'rgba(255,140,50,', flicker: true }); break;
        case 'mill': this.sprite(list, art.station('mill', t), o.x, o.y + 2); break;
        case 'loom': this.sprite(list, art.station('loom', t), o.x, o.y + 2); break;
        case 'fountain': this.sprite(list, art.fountain(t), o.x, o.y + 4); break;
        case 'lamps': {
          for (const [tx, ty] of [[29, 16], [34, 16], [29, 25], [34, 25]]) {
            const x = tx * TILE + 8, y = ty * TILE + 14;
            this.sprite(list, art.lanternPost(t + tx), x, y);
            lights.push({ x, y, lift: 20, r: 60, c: 'rgba(255,190,90,', flicker: true });
          }
          break;
        }
        case 'room1': case 'room2': case 'room3': {
          this.decal(ground, art.carpet(40, 22, o.spot === 'room3' ? '#2a4f8a' : '#9a2a2a'), o.x - 20, o.y - 18);
          this.sprite(list, art.guestBed(), o.x + 4, o.y);
          lights.push({ x: o.x, y: o.y, lift: 8, r: 30, c: 'rgba(255,190,90,' });
          break;
        }
        case 'majlis': {
          this.decal(ground, art.carpet(64, 26, '#7a1f2a'), o.x - 32, o.y - 22);
          for (let i = 0; i < 5; i++) this.sprite(list, art.cushion(), o.x - 26 + i * 13, o.y - 18);
          break;
        }
        case 'trough': this.sprite(list, art.trough(s.trough.water), o.x, o.y + 2); break;
        case 'workers_house': this.sprite(list, art.mudHouse(s.built.workers_house2 ? 2 : 1), o.x, o.y + 4); break;
        case 'stall_shop': this.sprite(list, art.shopStall(), o.x, o.y + 4); break;
        case 'orders_board': this.sprite(list, art.ordersBoard(), o.x, o.y + 2); break;
        default: break;
      }
      return;
    }
    const status = game.spotStatusFor ? game.spotStatusFor(o.spot) : { hidden: false };
    if (status.hidden) return;
    this.decal(ground, art.ghostOutline(18, 12), o.x - 9, o.y - 10, 0.5 + Math.sin(t * 3) * 0.2);
    this.sprite(list, art.buildSign(), o.x, o.y, { alpha: status.needTech ? 0.55 : 1 });
  }

  // سياج حول مستطيل بالعالم مع فتحة بالجهة الغربية
  collectFence(list, rect) {
    const post = art.fencePost();
    const x0 = rect.x0 * TILE, x1 = (rect.x1 + 1) * TILE, y0 = rect.y0 * TILE + 8, y1 = (rect.y1 + 1) * TILE;
    const pts = [];
    for (let x = x0; x <= x1; x += 12) { pts.push([x, y0]); pts.push([x, y1]); }
    for (let y = y0 + 12; y < y1; y += 12) { pts.push([x1, y]); if (y < y0 + 30 || y > y0 + 62) pts.push([x0, y]); }
    for (const [x, y] of pts) this.sprite(list, post, x, y);
    const rail = (ax, ay, bx, by) => {
      const steps = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 12));
      for (let i = 0; i < steps; i++) {
        const k0 = i / steps, k1 = (i + 1) / steps;
        const x0r = ax + (bx - ax) * k0, y0r = ay + (by - ay) * k0, x1r = ax + (bx - ax) * k1, y1r = ay + (by - ay) * k1;
        list.push({
          d: (x0r + x1r) / 2 + (y0r + y1r) / 2 - 1,
          draw: (ctx) => {
            for (const lift of [8, 4]) {
              const [sx0, sy0] = this.S(x0r, y0r, lift), [sx1, sy1] = this.S(x1r, y1r, lift);
              this.pixLine(ctx, sx0, sy0, sx1, sy1, '#8a5a33');
            }
          },
        });
      }
    };
    rail(x0, y0, x1, y0); rail(x0, y1, x1, y1); rail(x1, y0, x1, y1);
    rail(x0, y0, x0, y0 + 30); rail(x0, y0 + 62, x0, y1);
  }

  pixLine(ctx, x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    ctx.fillStyle = c;
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1);
  }

  collectPen(game, list, lights) {
    const s = game.state;
    const t = game.t;
    this.collectFence(list, PEN);
    const rts = game.camelRt || {};
    for (const c of s.camels) {
      const rt = rts[c.id];
      if (!rt || !this.visible(rt.x, rt.y)) continue;
      const col = camelColors(c);
      const frame = rt.moving ? 1 + (Math.floor(t * 4 + rt.x) % 2) : 0;
      this.sprite(list, art.camelSprite(col, frame, c.rare || c.breed), rt.x, rt.y + 2, { scale: camelSys.isAdult(c) ? 1 : 0.62, flip: rt.dir < 0 });
      if (c.rare) lights.push({ x: rt.x, y: rt.y, lift: 10, r: 34, c: col.glow });
    }
  }

  collectFold(game, list) {
    const s = game.state;
    const t = game.t;
    this.collectFence(list, FOLD);
    const rts = game.sheepRt || {};
    for (const sh of s.sheep) {
      const rt = rts[sh.id];
      if (!rt || !this.visible(rt.x, rt.y)) continue;
      const b = SHEEP_BREEDS[sh.breed];
      const shorn = sh.shornDay === s.time.day;
      const img = art.sheepSprite(shorn ? '#d8cbb0' : b.body, b.head, rt.moving ? Math.floor(t * 5) % 2 : 0);
      this.sprite(list, img, rt.x, rt.y + 2, { scale: sh.ageDays >= 2 ? 1 : 0.7, flip: rt.dir < 0 });
    }
  }

  collectWorkers(game, list) {
    const t = game.t;
    for (const w of game.state.workers || []) {
      const rt = game.workerRt && game.workerRt[w.id];
      if (!rt || !this.visible(rt.x, rt.y)) continue;
      const frame = rt.moving ? 1 + (Math.floor(t * 7) % 2) : 0;
      const img = art.character(WORKER_LOOKS[w.look % WORKER_LOOKS.length], rt.dir || 'down', frame, 'worker' + w.look);
      list.push({
        d: rt.x + rt.y,
        draw: (ctx) => {
          const [sx, sy] = this.S(rt.x, rt.y);
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(sx - 5, sy, 10, 2);
          ctx.drawImage(img, sx - 8, sy - 22);
          if (rt.working) {
            const k = (t * 3) % 1;
            const tool = { woodcutter: 'axe', farmer: 'shovel', builder: 'pick', herder: 'staff' }[w.type];
            this.toolAt(ctx, tool, sx + 4, sy - 12, -1.6 + k * 2.4);
          }
        },
      });
    }
  }

  collectDungeon(game, list, lights) {
    const dg = game.dungeon;
    const t = game.t;
    this.sprite(list, art.stairs(false), dg.up.x, dg.up.y + 6, { dz: -10 });
    if (dg.bossDead && dg.floor < 3) this.sprite(list, art.stairs(true), dg.down.x, dg.down.y + 6, { dz: -10 });
    for (const tr of dg.torches) {
      this.sprite(list, art.torch(t + tr.x), tr.x, tr.y - 6);
      lights.push({ x: tr.x, y: tr.y - 6, lift: 10, r: 64, c: 'rgba(255,150,60,', flicker: true });
    }
    for (const c of dg.chests) {
      this.sprite(list, art.chest(c.rarity, c.opened), c.x, c.y + 4);
      if (!c.opened) lights.push({ x: c.x, y: c.y, lift: 4, r: 20, c: 'rgba(255,220,120,' });
    }
    for (const e of dg.enemies) {
      if (e.hp <= 0) continue;
      const img = art.enemy(e.def.kind, Math.floor(t * 6) % 2, e.hurt > 0);
      const sc = e.def.scale || 1;
      list.push({
        d: e.x + e.y,
        draw: (ctx) => {
          const w = img.width * sc, h = img.height * sc;
          const [x, y] = this.S(e.x, e.y);
          ctx.save();
          ctx.translate(x, y);
          if (e.face < 0) ctx.scale(-1, 1);
          ctx.drawImage(img, Math.round(-w / 2), Math.round(-h + 4), w, h);
          ctx.restore();
          if (e.hp < e.maxHp || e.def.boss) {
            const bw = e.def.boss ? 30 : 14;
            ctx.fillStyle = '#300';
            ctx.fillRect(x - bw / 2, y - h - 2, bw, 2);
            ctx.fillStyle = e.def.boss ? '#ff4a8a' : '#ff5040';
            ctx.fillRect(x - bw / 2, y - h - 2, Math.round(bw * Math.max(0, e.hp) / e.maxHp), 2);
          }
        },
      });
      lights.push(e.def.boss ? { x: e.x, y: e.y, lift: 10, r: 38, c: 'rgba(200,80,255,' } : { x: e.x, y: e.y, lift: 6, r: 16, c: 'rgba(255,90,60,' });
    }
  }

  collectPlayer(game, list, lights) {
    const s = game.state;
    const p = s.player;
    const t = game.t;
    const frame = game.moving ? 1 + (Math.floor(t * 8) % 2) : 0;
    const blink = game.hurtT > 0 && Math.floor(t * 20) % 2 === 0;
    const a = game.anim;
    const crouch = a && ['plant', 'milk', 'harvest', 'feed', 'shear'].includes(a.type);
    const img = art.character(art.PLAYER_LOOK, p.dir, frame, 'player');
    list.push({
      d: p.x + p.y,
      draw: (ctx) => {
        const [x, y] = this.S(p.x, p.y);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x - 5, y, 10, 2);
        ctx.fillRect(x - 4, y - 1, 8, 1);
        if (!blink) {
          if (crouch) {
            const k = a.t / a.dur;
            const dip = Math.round(Math.sin(Math.min(1, k * 1.4) * Math.PI) * 3) + 2;
            ctx.drawImage(img, x - 8, y - 22 + dip, 16, 24 - dip);
          } else ctx.drawImage(img, x - 8, y - 22);
        }
        if (a) this.drawAction(ctx, game, x, y);
        else if (game.swing > 0) this.drawTool(ctx, game, x, y);
      },
    });
    lights.push({ x: p.x, y: p.y, lift: 10, r: game.mode === 'dungeon' ? 78 : 36, c: 'rgba(255,200,120,', flicker: game.mode === 'dungeon' });
    if (game.ui.speaker === 'lamp' && game.mode === 'world') {
      const lamp = game.worldObjById.lamp;
      const dj = art.character(art.DJINN_LOOK, 'down', 0, 'djinn');
      this.sprite(list, dj, lamp.x, lamp.y, { lift: 12 + Math.round(Math.sin(t * 3) * 2), alpha: 0.85, dz: 1 });
    }
  }

  sideOf(game) {
    return game.state.player.dir === 'left' ? -1 : 1;
  }

  drawAction(ctx, game, x, y) {
    const a = game.anim;
    const k = Math.min(1, a.t / a.dur);
    const side = this.sideOf(game);
    if (a.type === 'chop' || a.type === 'mine' || a.type === 'dig') {
      const tool = { chop: 'axe', mine: 'pick', dig: 'shovel' }[a.type];
      this.toolAt(ctx, tool, x + side * 4, y - 12, (-1.8 + Math.min(1, k * 1.8) * 2.6) * side);
      return;
    }
    if (a.type === 'water' || a.type === 'pour') {
      const tilt = Math.min(1, k / 0.3) * (k > 0.85 ? (1 - k) / 0.15 : 1);
      ctx.save();
      ctx.translate(x + side * 7, y - 15);
      ctx.rotate(tilt * 1.7 * side);
      ctx.drawImage(art.heldJar(), -6, -7, 12, 13);
      ctx.restore();
      return;
    }
    if (a.type === 'plant' || a.type === 'harvest' || a.type === 'shear') {
      const ang = (a.type === 'plant' ? 2.2 + Math.sin(k * Math.PI * 4) * 0.6 : a.type === 'shear' ? 1.6 + Math.sin(k * Math.PI * 8) * 0.3 : 0.4 - k * 1.2) * side;
      ctx.save();
      ctx.translate(x + side * 6, y - 8);
      ctx.rotate(ang);
      ctx.scale(0.7, 0.7);
      ctx.fillStyle = '#6e4424'; ctx.fillRect(-1, -10, 2, 10);
      ctx.fillStyle = '#b8b8c0'; ctx.fillRect(-2, -14, 4, 4);
      ctx.restore();
      return;
    }
    if (a.type === 'milk') {
      const [tx] = a.target ? this.S(a.target.x, a.target.y) : [x + side * 10];
      const bx = Math.round((x + tx) / 2);
      ctx.drawImage(art.bowl(k), bx - 5, y - 5);
      if (Math.floor(game.t * 12) % 2 && k < 0.8) { ctx.fillStyle = '#fff'; ctx.fillRect(bx, y - 9, 1, 3); }
      return;
    }
    if (a.type === 'draw') {
      const [wx, wy] = this.S(a.target.x, a.target.y + 2);
      const up = k < 0.5 ? k * 2 : 1 - (k - 0.5) * 2;
      const by = wy - 20 + Math.round((1 - up) * 10);
      ctx.fillStyle = '#caa46c';
      ctx.fillRect(wx, wy - 24, 1, by - (wy - 24));
      ctx.drawImage(art.bucket(), wx - 3, by);
    }
  }

  toolAt(ctx, tool, x, y, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = '#6e4424';
    ctx.fillRect(-1, -12, 2, 12);
    ctx.fillStyle = tool === 'staff' ? '#c9a060' : '#b8b8c0';
    if (tool === 'axe') ctx.fillRect(-1, -13, 5, 4);
    else if (tool === 'pick') ctx.fillRect(-5, -13, 10, 2);
    else if (tool === 'shovel') ctx.fillRect(-2, -15, 4, 4);
    else ctx.fillRect(-1, -16, 2, 5);
    ctx.restore();
  }

  drawTool(ctx, game, x, y) {
    const t = game.target;
    const tool = game.mode === 'dungeon' ? 'staff' : t && t.kind === 'rock' ? 'pick' : t && t.kind === 'clay' ? 'shovel' : t && t.kind === 'palm' ? 'axe' : null;
    if (!tool) return;
    const side = this.sideOf(game);
    this.toolAt(ctx, tool, x + side * 4, y - 12, (-1.6 + (1 - game.swing / 0.25) * 2.4) * side);
  }

  drawLighting(game, cam, lights) {
    const s = game.state;
    const dark = game.mode === 'dungeon' ? 0.9 : darkness(s.time.minute) * 0.78;
    if (dark <= 0.01) return;
    const l = this.l;
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, this.bw, this.bh);
    l.fillStyle = game.mode === 'dungeon' ? `rgba(6,4,10,${dark})` : `rgba(12,16,48,${dark})`;
    l.fillRect(0, 0, this.bw, this.bh);
    l.globalCompositeOperation = 'destination-out';
    const t = game.t;
    const pts = lights.map(li => { const [x, y] = this.S(li.x, li.y, li.lift || 0); return { ...li, sx: x, sy: y }; });
    for (const li of pts) {
      const { sx: x, sy: y } = li;
      if (x < -li.r || y < -li.r || x > this.bw + li.r || y > this.bh + li.r) continue;
      const r = li.r * (li.flicker ? 1 + Math.sin(t * 13 + li.x) * 0.04 : 1);
      const g = l.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.beginPath();
      l.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
      l.fill();
    }
    const ctx = this.w;
    ctx.drawImage(this.light, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const li of pts) {
      const { sx: x, sy: y } = li;
      if (x < -li.r || y < -li.r || x > this.bw + li.r || y > this.bh + li.r) continue;
      const r = li.r * 0.7;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, li.c + (0.22 * dark) + ')');
      g.addColorStop(1, li.c + '0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (game.mode === 'world' && dark > 0.4) {
      for (let i = 0; i < 24; i++) {
        const fx = 700 + ((i * 97.3 + Math.sin(t * 0.5 + i) * 30) % 300);
        const fy = 200 + ((i * 53.7 + Math.cos(t * 0.4 + i * 2) * 25) % 300);
        const [x, y] = this.S(fx, fy, 6 + Math.sin(t + i) * 4);
        if (x < 0 || y < 0 || x > this.bw || y > this.bh) continue;
        ctx.fillStyle = `rgba(210,255,140,${0.5 + Math.sin(t * 3 + i) * 0.5})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // الطبقة عالية الدقة: فقاعات، أسماء، أسهم، نصوص
  drawFx(game, cam) {
    const f = this.f;
    const sc = this.scale * this.dpr;
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.clearRect(0, 0, this.fc.width, this.fc.height);
    const toScreen = (x, y, lift = 0) => [(x - y + this.ox - cam.x) * sc, ((x + y) / 2 - lift - cam.y) * sc];
    const t = game.t;
    const s = game.state;
    f.textAlign = 'center';
    f.textBaseline = 'middle';
    if (game.mode === 'world') {
      for (const g of game.guestRt) {
        if (g.moving || g.leaving) continue;
        const [x, y] = toScreen(g.x, g.y, 32);
        this.bubble(f, x, y + Math.sin(t * 3 + g.x) * 2 * this.dpr, g.served ? '❤️' : ITEMS[g.want].icon, g.golden);
      }
      if (s.built.stable && game.camelRt) {
        for (const c of s.camels) {
          const rt = game.camelRt[c.id];
          if (!rt || !this.visible(rt.x, rt.y, 0)) continue;
          const [x, y] = toScreen(rt.x, rt.y, 28);
          if (c.rare) this.label(f, x, y - 14 * this.dpr, '✨ ' + c.name, '#ffe07a');
          const needs = camelSys.camelNeeds(c, s.time.day).filter(n => n !== 'milk');
          if (needs.length) { f.globalAlpha = 0.85; this.bubble(f, x + 10 * this.dpr, y + 4 * this.dpr, needs[0] === 'water' ? '💧' : '🌿', false, 0.7); f.globalAlpha = 1; }
          else if (c.pregnant) { f.font = `${12 * this.dpr}px sans-serif`; f.fillText('🤰', x + 10 * this.dpr, y); }
        }
      }
      if (s.built.sheepfold && game.sheepRt) {
        for (const sh of s.sheep) {
          const rt = game.sheepRt[sh.id];
          if (!rt || !this.visible(rt.x, rt.y, 0)) continue;
          const needs = sheepSys.sheepNeeds(sh, s.time.day);
          if (!needs.length) continue;
          const [x, y] = toScreen(rt.x, rt.y, 16);
          f.globalAlpha = 0.85;
          this.bubble(f, x + 6 * this.dpr, y, needs[0] === 'water' ? '💧' : needs[0] === 'food' ? '🌿' : '🧶', false, 0.6);
          f.globalAlpha = 1;
        }
      }
      for (const w of s.workers || []) {
        const rt = game.workerRt && game.workerRt[w.id];
        if (!rt || !this.visible(rt.x, rt.y, 0)) continue;
        const [x, y] = toScreen(rt.x, rt.y, 30);
        if (w.status === 'strike') {
          this.bubble(f, x, y + Math.sin(t * 4) * 2 * this.dpr, '✊', true, 0.8);
          this.label(f, x, y - 16 * this.dpr, 'مضرب!', '#ff9a8a');
        } else {
          f.font = `${12 * this.dpr}px sans-serif`;
          f.fillText(WORKER_TYPES[w.type].icon, x, y + 4 * this.dpr);
          if (w.late >= 2) this.label(f, x, y - 10 * this.dpr, '⚠️ الراتب!', '#ffd24a');
        }
      }
      for (const [id, pos] of Object.entries(game.world.npcSpots)) {
        if (!game.npcPresent(id)) continue;
        const [x, y] = toScreen(pos.x, pos.y, 30);
        this.label(f, x, y, NPCS[id].name, '#ffe9a8');
      }
      for (const o of game.world.objects) {
        if (o.kind === 'sign' && this.visible(o.x, o.y, 0)) {
          const [x, y] = toScreen(o.x, o.y, 22);
          this.label(f, x, y, o.text, '#fff3d6');
        }
      }
      // البسطة: دراهم جاهزة للاستلام
      if (s.built.stall_shop && s.stall.slots.some(x => x && x.sold)) {
        const o = game.worldObjById['spot:stall_shop'];
        const [x, y] = toScreen(o.x, o.y, 40);
        this.bubble(f, x, y + Math.sin(t * 5) * 3 * this.dpr, '🪙', true);
      }
    }
    const tg = game.target;
    if (tg) {
      const lift = tg.kind === 'palm' ? 50 : tg.kind === 'guest' || tg.kind === 'npc' ? 34 : 24;
      const [x, y] = toScreen(tg.x, tg.y, lift);
      const bob = Math.sin(t * 6) * 3 * this.dpr;
      f.fillStyle = '#ffffff';
      f.strokeStyle = 'rgba(40,20,5,0.9)';
      f.lineWidth = 2 * this.dpr;
      const a = 6 * this.dpr;
      f.beginPath();
      f.moveTo(x - a, y - a + bob); f.lineTo(x + a, y - a + bob); f.lineTo(x, y + bob);
      f.closePath(); f.fill(); f.stroke();
    }
    if (game.mode === 'world') this.questArrow(game, toScreen);
    game.fx.drawTexts(f, cam.x, cam.y, sc, this.dpr * 1.15);
  }

  questArrow(game, toScreen) {
    const q = currentQuest(game.state);
    if (!q || !q.target) return;
    let pos = null;
    const s = game.state;
    const p = s.player;
    if (q.target === 'lamp') pos = game.worldObjById.lamp;
    else if (q.target === 'workbench') pos = game.worldObjById.workbench;
    else if (q.target.startsWith('spot:')) pos = game.worldObjById[q.target];
    else if (q.target === 'crypt') pos = game.worldObjById['spot:crypt_door'];
    else if (q.target === 'palm' || q.target === 'plot') {
      let bd = 1e9;
      for (const o of game.world.objects) {
        if (o.kind !== q.target || game.depleted(o)) continue;
        if (o.kind === 'plot' && o.group === 2 && !s.built.farm2) continue;
        const d = Math.hypot(o.x - p.x, o.y - p.y);
        if (d < bd) { bd = d; pos = o; }
      }
    } else if (q.target === 'camel') {
      const c = s.camels[0];
      pos = c && game.camelRt && game.camelRt[c.id] ? game.camelRt[c.id] : game.worldObjById['spot:stable'];
    } else if (q.target === 'guest') {
      pos = game.guestRt.find(g => !g.served && !g.moving) || (game.guestRt.length ? null : game.worldObjById.hearth);
    }
    if (!pos) return;
    if (game.target && Math.hypot(game.target.x - pos.x, game.target.y - pos.y) < 4) return;
    const f = this.f;
    const t = game.t;
    const [sx, sy] = toScreen(pos.x, pos.y, 34);
    const W = this.fc.width, H = this.fc.height, m = 50 * this.dpr;
    const inside = sx > m && sx < W - m && sy > m && sy < H - m;
    f.save();
    if (inside) {
      f.font = `${22 * this.dpr}px sans-serif`;
      f.fillText('⭐', sx, sy - 10 * this.dpr + Math.sin(t * 5) * 4 * this.dpr);
    } else {
      const [px, py] = toScreen(p.x, p.y, 10);
      const ang = Math.atan2(sy - py, sx - px);
      const cx = Math.max(m, Math.min(W - m, px + Math.cos(ang) * W));
      const cy = Math.max(m * 1.6, Math.min(H - m * 1.6, py + Math.sin(ang) * H));
      f.translate(cx, cy);
      f.rotate(ang);
      f.fillStyle = '#ffd24a';
      f.strokeStyle = 'rgba(60,30,0,0.9)';
      f.lineWidth = 3 * this.dpr;
      const a = 12 * this.dpr;
      f.beginPath();
      f.moveTo(a, 0); f.lineTo(-a * 0.6, -a * 0.7); f.lineTo(-a * 0.3, 0); f.lineTo(-a * 0.6, a * 0.7);
      f.closePath(); f.stroke(); f.fill();
    }
    f.restore();
  }

  bubble(f, x, y, icon, golden, scale = 1) {
    const r = 14 * this.dpr * scale;
    f.fillStyle = golden ? '#ffe9a0' : '#fffaf0';
    f.strokeStyle = golden ? '#c08a10' : 'rgba(70,40,15,0.8)';
    f.lineWidth = 2 * this.dpr;
    f.beginPath();
    f.arc(x, y, r, 0, Math.PI * 2);
    f.moveTo(x - 4 * this.dpr, y + r - 2); f.lineTo(x, y + r + 6 * this.dpr); f.lineTo(x + 4 * this.dpr, y + r - 2);
    f.fill(); f.stroke();
    f.font = `${16 * this.dpr * scale}px sans-serif`;
    f.fillStyle = '#000';
    f.fillText(icon, x, y + 1);
  }

  label(f, x, y, text, color) {
    f.font = `700 ${11 * this.dpr}px Cairo, sans-serif`;
    f.lineWidth = 3 * this.dpr;
    f.strokeStyle = 'rgba(30,15,5,0.85)';
    f.strokeText(text, x, y);
    f.fillStyle = color;
    f.fillText(text, x, y);
  }
}
