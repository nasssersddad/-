// الرسم: طبقة العالم (بكسلات مكبّرة) + طبقة عالية الدقة للنصوص والفقاعات
import * as art from './engine/art.js';
import { TILE, MAP_W, MAP_H, T, KHAN, GATE, PEN } from './data/map.js';
import { camelColors } from './data/camels.js';
import * as camelSys from './systems/camels.js';
import { DW, DH, dTile, D } from './systems/dungeon.js';
import { NPCS, GUEST_LOOKS } from './data/npcs.js';
import { ITEMS, SEEDS } from './data/items.js';
import { BUILD_SPOTS } from './data/recipes.js';
import { darkness } from './systems/time.js';
import * as farming from './systems/farming.js';
import { currentQuest } from './systems/quests.js';

export class Renderer {
  constructor(worldCanvas, fxCanvas) {
    this.wc = worldCanvas;
    this.fc = fxCanvas;
    this.w = this.wc.getContext('2d');
    this.f = this.fc.getContext('2d');
    this.light = document.createElement('canvas');
    this.l = this.light.getContext('2d');
    this.tileLayer = null;
    this.scale = 2;
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

  buildTileLayer(game) {
    const c = art.canvas(MAP_W * TILE, MAP_H * TILE);
    const ctx = c.getContext('2d');
    const getT = (x, y) => game.tileAtWorld(x, y);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        art.drawTile(ctx, getT(x, y), x, y, x * TILE, y * TILE, getT);
      }
    }
    this.tileLayer = c;
    game.tileDirty = false;
  }

  buildDungeonLayer(dg) {
    const c = art.canvas(DW * TILE, DH * TILE);
    const ctx = c.getContext('2d');
    for (let y = 0; y < DH; y++) {
      for (let x = 0; x < DW; x++) {
        const wall = dTile(dg.tiles, x, y) !== D.FLOOR;
        const below = wall && dTile(dg.tiles, x, y + 1) === D.FLOOR;
        ctx.drawImage(art.dungeonTile(wall, below, x, y), x * TILE, y * TILE);
      }
    }
    dg.layer = c;
  }

  camera(game) {
    const p = game.state.player;
    const mw = (game.mode === 'dungeon' ? DW : MAP_W) * TILE;
    const mh = (game.mode === 'dungeon' ? DH : MAP_H) * TILE;
    let cx = Math.round(p.x - this.bw / 2);
    let cy = Math.round(p.y - 10 - this.bh / 2);
    cx = Math.max(0, Math.min(mw - this.bw, cx));
    cy = Math.max(0, Math.min(mh - this.bh, cy));
    if (mw < this.bw) cx = Math.round((mw - this.bw) / 2);
    if (mh < this.bh) cy = Math.round((mh - this.bh) / 2);
    if (game.shake > 0) {
      cx += Math.round((Math.random() - 0.5) * game.shake);
      cy += Math.round((Math.random() - 0.5) * game.shake);
    }
    return { x: cx, y: cy };
  }

  draw(game) {
    const ctx = this.w;
    const cam = this.camera(game);
    this.cam = cam;
    ctx.fillStyle = '#1a1310';
    ctx.fillRect(0, 0, this.bw, this.bh);
    const lights = [];
    const drawables = [];
    if (game.mode === 'world') {
      if (!this.tileLayer || game.tileDirty) this.buildTileLayer(game);
      ctx.drawImage(this.tileLayer, cam.x, cam.y, this.bw, this.bh, 0, 0, this.bw, this.bh);
      this.drawWater(game, cam);
      this.collectWorld(game, drawables, lights);
    } else {
      const dg = game.dungeon;
      if (!dg.layer) this.buildDungeonLayer(dg);
      ctx.drawImage(dg.layer, cam.x, cam.y, this.bw, this.bh, 0, 0, this.bw, this.bh);
      this.collectDungeon(game, drawables, lights);
    }
    this.collectPlayer(game, drawables, lights);
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw(ctx, cam);
    game.fx.draw(ctx, cam.x, cam.y);
    this.drawLighting(game, cam, lights);
    this.drawFx(game, cam);
  }

  drawWater(game, cam) {
    const ctx = this.w;
    const f = Math.floor(game.t * 2) % 4;
    const x0 = Math.floor(cam.x / TILE), y0 = Math.floor(cam.y / TILE);
    for (let y = y0; y <= y0 + Math.ceil(this.bh / TILE); y++) {
      for (let x = x0; x <= x0 + Math.ceil(this.bw / TILE); x++) {
        if (game.tileAtWorld(x, y) === T.WATER) ctx.drawImage(art.waterFrame((f + x + y) % 4), x * TILE - cam.x, y * TILE - cam.y);
      }
    }
  }

  visible(x, y, cam, m = 48) {
    return x > cam.x - m && x < cam.x + this.bw + m && y > cam.y - m && y < cam.y + this.bh + m * 1.5;
  }

  sprite(list, img, x, y, sortY, opts = {}) {
    list.push({
      y: sortY,
      draw: (ctx, cam) => {
        const dx = Math.round(x - img.width / 2 - cam.x + (opts.ox || 0));
        const dy = Math.round(y - img.height - cam.y + (opts.oy || 0));
        if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
        ctx.drawImage(img, dx, dy);
        ctx.globalAlpha = 1;
      },
    });
  }

  collectWorld(game, list, lights) {
    const s = game.state;
    const t = game.t;
    const cam = this.cam;
    for (const o of game.world.objects) {
      if (!this.visible(o.x, o.y, cam)) continue;
      const sh = o.shakeT > 0 ? Math.round(Math.sin(t * 80) * 1.5) : 0;
      if (o.shakeT > 0) o.shakeT -= 1 / 60;
      switch (o.kind) {
        case 'palm': {
          const dep = game.depleted(o);
          const sway = dep ? 0 : Math.round(Math.sin(t * 1.3 + o.tx) * 1.5);
          const hitsDone = game.nodeHits(o);
          this.sprite(list, art.palm(o.tx % 5, sway, dep), o.x, o.y + 2, o.y, { ox: sh + (hitsDone ? 0 : 0) });
          break;
        }
        case 'rock':
          if (!game.depleted(o)) this.sprite(list, art.rock(o.tx % 2, game.nodeHits(o)), o.x, o.y + 2, o.y, { ox: sh });
          else this.sprite(list, art.deco(1), o.x, o.y + 2, o.y - 8);
          break;
        case 'clay': this.sprite(list, art.clayPit(game.depleted(o)), o.x, o.y + 2, o.y - 8, { ox: sh }); break;
        case 'herb': this.sprite(list, art.herb(game.depleted(o)), o.x, o.y + 2, o.y - 4, { ox: sh }); break;
        case 'deco': this.sprite(list, art.deco(o.variant), o.x, o.y + 2, o.y - 6); break;
        case 'well': this.sprite(list, art.well(), o.x, o.y + 4, o.y, { ox: sh }); break;
        case 'tent': this.sprite(list, art.tent(), o.x, o.y + 4, o.y); break;
        case 'stall': this.sprite(list, art.stall(), o.x, o.y + 4, o.y); break;
        case 'sign': this.sprite(list, art.woodSign(), o.x, o.y + 2, o.y); break;
        case 'lamp': {
          this.sprite(list, art.brassLamp(t), o.x, o.y + Math.round(Math.sin(t * 2) * 0.6), o.y);
          lights.push({ x: o.x, y: o.y - 6, r: 26, c: 'rgba(120,170,255,' });
          break;
        }
        case 'station': {
          const img = art.station(o.station, t);
          this.sprite(list, img, o.x, o.y + 4, o.y);
          if (o.station === 'hearth') lights.push({ x: o.x, y: o.y - 6, r: 58, c: 'rgba(255,160,60,', flicker: true });
          break;
        }
        case 'plot': {
          if (o.group === 2 && !s.built.farm2) break;
          const p = s.plots[o.id];
          list.push({ y: o.y - 14, draw: (ctx, cam) => ctx.drawImage(art.soilPlot(!!(p && p.watered)), Math.round(o.x - 9 - cam.x), Math.round(o.y - 13 - cam.y)) });
          if (p) {
            const def = SEEDS[p.seed];
            const img = art.crop(def.crop, p.stage, def.days);
            const pk = o.popT ? Math.min(1, (t - o.popT) / 0.35) : 1;
            const sc = pk < 1 ? 0.3 + pk * 0.9 - Math.max(0, pk - 0.75) * 0.8 : 1;
            list.push({ y: o.y - 2, draw: (ctx, cam) => {
              const w = img.width * sc, h = img.height * sc;
              ctx.drawImage(img, Math.round(o.x - w / 2 - cam.x + sh), Math.round(o.y + 1 - h - cam.y), Math.round(w), Math.round(h));
            } });
          }
          break;
        }
        case 'spot': this.collectSpot(game, o, list, lights); break;
        default: break;
      }
    }
    // جدار الخان والبوابة
    if (s.built.gate) {
      const gx = (GATE.x0 + 1) * TILE, gy = (KHAN.y1 + 1) * TILE;
      if (this.visible(gx, gy, cam)) this.sprite(list, art.gateArch(), gx, gy, gy - 1);
    }
    // صناديق على الأرض
    for (const c of s.groundChests || []) {
      const bob = Math.round(Math.sin(t * 4) * 1);
      this.sprite(list, art.chest(c.rarity, false), c.x, c.y + bob, c.y);
      lights.push({ x: c.x, y: c.y - 6, r: 22, c: 'rgba(255,220,120,' });
    }
    // الشخصيات
    for (const [id, pos] of Object.entries(game.world.npcSpots)) {
      if (!game.npcPresent(id)) continue;
      const n = NPCS[id];
      this.sprite(list, art.character(n.look, 'down', 0, id), pos.x, pos.y, pos.y);
      if (id === 'shepherd') {
        for (let i = 0; i < 4; i++) this.sprite(list, art.sheep(Math.floor(t * 2 + i) % 2), pos.x - 26 + i * 14 + Math.round(Math.sin(t * 0.5 + i) * 4), pos.y + 10 + (i % 2) * 8, pos.y + 10 + (i % 2) * 8);
      }
    }
    // القافلة
    if (game.guestRt.length) {
      const e = game.world.caravanEntry;
      this.sprite(list, art.camel(0), e.x - 30, e.y + 22, e.y + 22);
      this.sprite(list, art.camel(1), e.x + 36, e.y + 26, e.y + 26);
    }
    if (s.built.stable) this.collectPen(game, list, lights);
    for (const g of game.guestRt) {
      const frame = g.moving ? 1 + (Math.floor(t * 6) % 2) : 0;
      this.sprite(list, art.character(GUEST_LOOKS[g.look], g.dir || 'down', frame, 'guest' + g.look), g.x, g.y, g.y);
    }
  }

  collectSpot(game, o, list, lights) {
    const s = game.state;
    const built = s.built[o.spot];
    const t = game.t;
    const spot = BUILD_SPOTS[o.spot];
    if (o.spot === 'crypt_door') {
      this.sprite(list, art.cryptDoor(!!built, t), o.x, o.y + 2, o.y - 12);
      if (!built) lights.push({ x: o.x, y: o.y - 6, r: 18, c: 'rgba(100,150,255,' });
      if (built) return;
    }
    if (built) {
      switch (o.spot) {
        case 'my_bed': this.sprite(list, art.floorBed('#b8292a'), o.x, o.y + 2, o.y - 12); break;
        case 'kiln': this.sprite(list, art.station('kiln', t), o.x, o.y + 4, o.y); lights.push({ x: o.x, y: o.y - 4, r: 50, c: 'rgba(255,140,50,', flicker: true }); break;
        case 'mill': this.sprite(list, art.station('mill', t), o.x, o.y + 4, o.y); break;
        case 'loom': this.sprite(list, art.station('loom', t), o.x, o.y + 4, o.y); break;
        case 'fountain': this.sprite(list, art.fountain(t), o.x, o.y + 6, o.y); break;
        case 'lamps': {
          const pts = [[29, 16], [34, 16], [29, 25], [34, 25]];
          for (const [tx, ty] of pts) {
            const x = tx * TILE + 8, y = ty * TILE + 14;
            this.sprite(list, art.lanternPost(t + tx), x, y, y);
            lights.push({ x, y: y - 20, r: 60, c: 'rgba(255,190,90,', flicker: true });
          }
          break;
        }
        case 'room1': case 'room2': case 'room3': {
          list.push({ y: o.y - 20, draw: (ctx, cam) => ctx.drawImage(art.carpet(40, 22, o.spot === 'room3' ? '#2a4f8a' : '#9a2a2a'), Math.round(o.x - 12 - cam.x), Math.round(o.y - 24 - cam.y)) });
          this.sprite(list, art.guestBed(), o.x + 6, o.y + 2, o.y);
          lights.push({ x: o.x, y: o.y - 8, r: 30, c: 'rgba(255,190,90,' });
          break;
        }
        case 'majlis': {
          list.push({ y: o.y - 30, draw: (ctx, cam) => ctx.drawImage(art.carpet(64, 26, '#7a1f2a'), Math.round(o.x - 32 - cam.x), Math.round(o.y - 22 - cam.y)) });
          for (let i = 0; i < 5; i++) this.sprite(list, art.cushion(), o.x - 26 + i * 13, o.y - 16, o.y - 25);
          break;
        }
        case 'stable': break;
        case 'pen2': case 'pen3': break;
        case 'trough': this.sprite(list, art.trough(s.trough.water), o.x, o.y + 4, o.y); break;
        default: break;
      }
      return;
    }
    const st = game.state && spot;
    if (!st) return;
    const status = this.spotStatusCache(game, o.spot);
    if (status.hidden) return;
    const bob = Math.round(Math.sin(t * 3 + o.tx) * 1);
    this.sprite(list, art.buildSign(), o.x, o.y + 2, o.y, { alpha: status.needTech ? 0.55 : 1, oy: 0 });
    list.push({ y: o.y + 1, draw: (ctx, cam) => { ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.2; ctx.drawImage(art.ghostOutline(18, 12), Math.round(o.x - 9 - cam.x), Math.round(o.y - 10 - cam.y + bob * 0)); ctx.globalAlpha = 1; } });
  }

  collectPen(game, list, lights) {
    const s = game.state;
    const t = game.t;
    const x0 = PEN.x0 * TILE, x1 = (PEN.x1 + 1) * TILE, y0 = PEN.y0 * TILE + 8, y1 = (PEN.y1 + 1) * TILE;
    const post = art.fencePost();
    const rail = (ax, ay, bx, by) => list.push({ y: Math.max(ay, by) - 1, draw: (ctx, cam) => {
      ctx.fillStyle = '#8a5a33';
      if (ay === by) { ctx.fillRect(Math.round(ax - cam.x), Math.round(ay - 8 - cam.y), bx - ax, 1); ctx.fillRect(Math.round(ax - cam.x), Math.round(ay - 4 - cam.y), bx - ax, 1); }
      else { ctx.fillRect(Math.round(ax - cam.x), Math.round(ay - 8 - cam.y), 1, by - ay); }
    } });
    for (let x = x0; x <= x1; x += 12) { this.sprite(list, post, x, y0, y0 - 1); this.sprite(list, post, x, y1, y1); }
    for (let y = y0 + 12; y < y1; y += 12) { this.sprite(list, post, x1, y, y); if (y < y0 + 30 || y > y0 + 62) this.sprite(list, post, x0, y, y); }
    rail(x0, y0, x1, y0); rail(x0, y1, x1, y1); rail(x1, y0, x1, y1);
    rail(x0, y0, x0, y0 + 30); rail(x0, y0 + 62, x0, y1);
    // مظلة
    list.push({ y: y0 + 2, draw: (ctx, cam) => {
      const sx = Math.round(x1 - 50 - cam.x), sy = Math.round(y0 - 16 - cam.y);
      ctx.fillStyle = '#c8b080'; ctx.fillRect(sx, sy, 46, 5);
      ctx.fillStyle = '#a89060'; ctx.fillRect(sx, sy + 5, 46, 1);
      ctx.fillStyle = '#5e3a1f'; ctx.fillRect(sx + 2, sy + 5, 2, 12); ctx.fillRect(sx + 42, sy + 5, 2, 12);
    } });
    const rts = game.camelRt || {};
    for (const c of s.camels) {
      const rt = rts[c.id];
      if (!rt) continue;
      const col = camelColors(c);
      const frame = rt.moving ? 1 + (Math.floor(t * 4 + rt.x) % 2) : 0;
      const img = art.camelSprite(col, frame, c.rare || c.breed);
      const sc = camelSys.isAdult(c) ? 1 : 0.62;
      list.push({ y: rt.y, draw: (ctx, cam) => {
        const w = img.width * sc, h = img.height * sc;
        ctx.save();
        ctx.translate(Math.round(rt.x - cam.x), Math.round(rt.y - cam.y));
        if (rt.dir < 0) ctx.scale(-1, 1);
        ctx.drawImage(img, Math.round(-w / 2), Math.round(-h + 2), Math.round(w), Math.round(h));
        ctx.restore();
      } });
      if (c.rare) lights.push({ x: rt.x, y: rt.y - 10, r: 34, c: col.glow });
    }
  }

  spotStatusCache(game, id) {
    return game.spotStatusFor ? game.spotStatusFor(id) : { hidden: false };
  }

  collectDungeon(game, list, lights) {
    const dg = game.dungeon;
    const t = game.t;
    this.sprite(list, art.stairs(false), dg.up.x, dg.up.y + 8, dg.up.y - 8);
    if (dg.bossDead && dg.floor < 3) this.sprite(list, art.stairs(true), dg.down.x, dg.down.y + 8, dg.down.y - 8);
    for (const tr of dg.torches) {
      this.sprite(list, art.torch(t + tr.x), tr.x, tr.y - 2, tr.y - 16);
      lights.push({ x: tr.x, y: tr.y - 8, r: 64, c: 'rgba(255,150,60,', flicker: true });
    }
    for (const c of dg.chests) {
      this.sprite(list, art.chest(c.rarity, c.opened), c.x, c.y + 6, c.y);
      if (!c.opened) lights.push({ x: c.x, y: c.y - 2, r: 20, c: 'rgba(255,220,120,' });
    }
    for (const e of dg.enemies) {
      if (e.hp <= 0) continue;
      const img = art.enemy(e.def.kind, Math.floor(t * 6) % 2, e.hurt > 0);
      const sc = e.def.scale || 1;
      list.push({
        y: e.y,
        draw: (ctx, cam) => {
          const w = img.width * sc, h = img.height * sc;
          ctx.save();
          const x = Math.round(e.x - cam.x), y = Math.round(e.y - cam.y);
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
      lights.push(e.def.boss ? { x: e.x, y: e.y - 10, r: 38, c: 'rgba(200,80,255,' } : { x: e.x, y: e.y - 6, r: 16, c: 'rgba(255,90,60,' });
    }
  }

  collectPlayer(game, list, lights) {
    const s = game.state;
    const p = s.player;
    const t = game.t;
    const frame = game.moving ? 1 + (Math.floor(t * 8) % 2) : 0;
    const blink = game.hurtT > 0 && Math.floor(t * 20) % 2 === 0;
    const a = game.anim;
    const crouch = a && ['plant', 'milk', 'harvest', 'feed'].includes(a.type);
    const img = art.character(art.PLAYER_LOOK, a && (a.type === 'water' || a.type === 'pour' || crouch) ? (p.dir === 'up' || p.dir === 'down' ? p.dir : p.dir) : p.dir, frame, 'player');
    list.push({
      y: p.y,
      draw: (ctx, cam) => {
        const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
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
    if (game.mode === 'dungeon') lights.push({ x: p.x, y: p.y - 10, r: 78, c: 'rgba(255,200,120,', flicker: true });
    else lights.push({ x: p.x, y: p.y - 10, r: 36, c: 'rgba(255,200,120,' });
    // الجني يطلع جنب الفانوس لما تكلمه
    if (game.ui.speaker === 'lamp' && game.mode === 'world') {
      const lamp = game.worldObjById.lamp;
      const dj = art.character(art.DJINN_LOOK, 'down', 0, 'djinn');
      list.push({ y: lamp.y + 1, draw: (ctx, cam) => { ctx.globalAlpha = 0.85; ctx.drawImage(dj, Math.round(lamp.x - 8 - cam.x), Math.round(lamp.y - 34 - cam.y + Math.sin(t * 3) * 2)); ctx.globalAlpha = 1; } });
    }
  }

  drawAction(ctx, game, x, y) {
    const a = game.anim;
    const p = game.state.player;
    const k = Math.min(1, a.t / a.dur);
    const side = p.dir === 'left' ? -1 : 1;
    if (a.type === 'chop' || a.type === 'mine' || a.type === 'dig' || a.type === 'pick') {
      if (a.type === 'pick') return;
      const tool = { chop: 'axe', mine: 'pick', dig: 'shovel' }[a.type];
      const ang = (-1.8 + Math.min(1, k * 1.8) * 2.6) * side;
      this.toolAt(ctx, tool, x + side * 4, y - 12, ang);
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
    if (a.type === 'plant' || a.type === 'harvest') {
      const ang = (a.type === 'plant' ? 2.2 + Math.sin(k * Math.PI * 4) * 0.6 : 0.4 - k * 1.2) * side;
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
      const tx = a.target ? Math.round(a.target.x - this.cam.x) : x + side * 10;
      ctx.drawImage(art.bowl(k), Math.round((x + tx) / 2) - 5, y - 5);
      if (Math.floor(game.t * 12) % 2 && k < 0.8) { ctx.fillStyle = '#fff'; ctx.fillRect(Math.round((x + tx) / 2), y - 9, 1, 3); }
      return;
    }
    if (a.type === 'draw') {
      const w = a.target;
      const wx = Math.round(w.x - this.cam.x), wy = Math.round(w.y - this.cam.y);
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
    const p = game.state.player;
    const k = 1 - game.swing / 0.25;
    const t = game.target;
    const tool = game.mode === 'dungeon' ? 'staff' : t && t.kind === 'rock' ? 'pick' : t && t.kind === 'clay' ? 'shovel' : t && t.kind === 'palm' ? 'axe' : null;
    if (!tool) return;
    const side = p.dir === 'left' ? -1 : 1;
    const ang = (-1.6 + k * 2.4) * side;
    ctx.save();
    ctx.translate(x + side * 4, y - 12);
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
    for (const li of lights) {
      const x = li.x - cam.x, y = li.y - cam.y;
      if (x < -li.r || y < -li.r || x > this.bw + li.r || y > this.bh + li.r) continue;
      const r = li.r * (li.flicker ? 1 + Math.sin(t * 13 + li.x) * 0.04 : 1);
      const g = l.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.beginPath();
      l.arc(x, y, r, 0, Math.PI * 2);
      l.fill();
    }
    const ctx = this.w;
    ctx.drawImage(this.light, 0, 0);
    // توهج دافي
    ctx.globalCompositeOperation = 'lighter';
    for (const li of lights) {
      const x = li.x - cam.x, y = li.y - cam.y;
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
    // حباحب الليل
    if (game.mode === 'world' && dark > 0.4) {
      for (let i = 0; i < 18; i++) {
        const fx = (i * 97.3 + Math.sin(t * 0.5 + i) * 30) % (MAP_W * TILE);
        const fy = 150 + ((i * 53.7 + Math.cos(t * 0.4 + i * 2) * 25) % 500);
        const x = Math.round(fx - cam.x), y = Math.round(fy - cam.y);
        if (x < 0 || y < 0 || x > this.bw || y > this.bh) continue;
        const a = 0.5 + Math.sin(t * 3 + i) * 0.5;
        ctx.fillStyle = `rgba(210,255,140,${a})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // الطبقة عالية الدقة: فقاعات الضيوف، الأسهم، النصوص
  drawFx(game, cam) {
    const f = this.f;
    const sc = this.scale * this.dpr;
    const ox = 0;
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.clearRect(0, 0, this.fc.width, this.fc.height);
    const toScreen = (x, y) => [(x - cam.x) * sc + ox, (y - cam.y) * sc];
    const t = game.t;
    const s = game.state;
    f.textAlign = 'center';
    f.textBaseline = 'middle';
    // فقاعات الطلب
    if (game.mode === 'world') {
      for (const g of game.guestRt) {
        if (g.moving || g.leaving) continue;
        const [x, y] = toScreen(g.x, g.y - 30);
        this.bubble(f, x, y + Math.sin(t * 3 + g.x) * 2 * this.dpr, g.served ? '❤️' : ITEMS[g.want].icon, g.golden);
      }
      if (s.built.stable && game.camelRt) {
        for (const c of s.camels) {
          const rt = game.camelRt[c.id];
          if (!rt || !this.visible(rt.x, rt.y, cam, 0)) continue;
          const [x, y] = toScreen(rt.x, rt.y - 26);
          if (c.rare) this.label(f, x, y - 14 * this.dpr, '✨ ' + c.name, '#ffe07a');
          const needs = camelSys.camelNeeds(c, s.time.day).filter(n => n !== 'milk');
          if (needs.length) { f.globalAlpha = 0.85; this.bubble(f, x + 10 * this.dpr, y + 4 * this.dpr, needs[0] === 'water' ? '💧' : '🌿', false, 0.7); f.globalAlpha = 1; }
          else if (c.pregnant) { f.font = `${12 * this.dpr}px sans-serif`; f.fillText('🤰', x + 10 * this.dpr, y); }
        }
      }
      for (const [id, pos] of Object.entries(game.world.npcSpots)) {
        if (!game.npcPresent(id)) continue;
        const [x, y] = toScreen(pos.x, pos.y - 28);
        this.label(f, x, y, NPCS[id].name, '#ffe9a8');
      }
      // لوحات
      for (const o of game.world.objects) {
        if (o.kind === 'sign' && this.visible(o.x, o.y, cam, 0)) {
          const [x, y] = toScreen(o.x, o.y - 24);
          this.label(f, x, y, o.text, '#fff3d6');
        }
      }
    }
    // سهم الهدف
    const tg = game.target;
    if (tg) {
      const [x, y] = toScreen(tg.x, tg.y - (tg.kind === 'palm' ? 50 : tg.kind === 'guest' || tg.kind === 'npc' ? 44 : 26));
      const bob = Math.sin(t * 6) * 3 * this.dpr;
      f.fillStyle = '#ffffff';
      f.strokeStyle = 'rgba(40,20,5,0.9)';
      f.lineWidth = 2 * this.dpr;
      const a = 6 * this.dpr;
      f.beginPath();
      f.moveTo(x - a, y - a + bob); f.lineTo(x + a, y - a + bob); f.lineTo(x, y + bob);
      f.closePath(); f.fill(); f.stroke();
    }
    // سهم المهمة
    if (game.mode === 'world') this.questArrow(game, cam, toScreen);
    game.fx.drawTexts(f, cam.x, cam.y, sc, this.dpr * 1.15);
  }

  questArrow(game, cam, toScreen) {
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
    const [sx, sy] = toScreen(pos.x, pos.y - 34);
    const W = this.fc.width, H = this.fc.height, m = 50 * this.dpr;
    const inside = sx > m && sx < W - m && sy > m && sy < H - m;
    f.save();
    if (inside) {
      const bob = Math.sin(t * 5) * 4 * this.dpr;
      f.font = `${22 * this.dpr}px sans-serif`;
      f.fillText('⭐', sx, sy - 10 * this.dpr + bob);
    } else {
      const [px, py] = toScreen(p.x, p.y - 10);
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
