// الرسم: طبقة العالم (بكسلات مكبّرة) + طبقة عالية الدقة للنصوص والفقاعات
import * as art from './engine/art.js';
import { TILE, MAP_W, MAP_H, T, KHAN, GATE, PEN, FOLD } from './data/map.js';
import { SHEEP_BREEDS } from './data/sheep.js';
import { WORKER_LOOKS, WORKER_TYPES } from './data/workers.js';
import * as sheepSys from './systems/sheep.js';
import { OW_W, OW_H, FARMS, owTile } from './data/openworld.js';
import * as farmsSys from './systems/farms.js';
import { camelColors as camelCol } from './data/camels.js';
import { camelColors, BREEDS } from './data/camels.js';
import * as camelSys from './systems/camels.js';
import { DW, DH, dTile, D } from './systems/dungeon.js';
import { NPCS, GUEST_LOOKS } from './data/npcs.js';
import { ITEMS, SEEDS } from './data/items.js';
import { BUILD_SPOTS } from './data/recipes.js';
import { darkness } from './systems/time.js';
import * as farming from './systems/farming.js';
import { currentQuest } from './systems/quests.js';
import { PostFX } from './engine/post.js';
import * as placement from './systems/placement.js';
import { PLACEABLES } from './data/buildings.js';

export class Renderer {
  constructor(worldCanvas, fxCanvas, postCanvas) {
    this.post = postCanvas ? new PostFX(postCanvas) : null;
    this.postCanvas = postCanvas;
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
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    // كل بكسل من الرسم = ds بكسل حقيقي بالشاشة (بكسلات أصغر = تفاصيل أكثر)
    const ds = Math.max(2, Math.round((ch * dpr) / 250));
    this.scale = ds / dpr;
    this.bw = Math.ceil((cw * dpr) / ds);
    this.bh = Math.ceil((ch * dpr) / ds);
    this.wc.width = this.bw;
    this.wc.height = this.bh;
    this.wc.style.width = (this.bw * ds) / dpr + 'px';
    this.wc.style.height = (this.bh * ds) / dpr + 'px';
    if (this.post && this.post.ok) {
      this.post.resize(Math.round(cw * dpr), Math.round(ch * dpr), this.bw, this.bh);
      this.postCanvas.style.width = cw + 'px';
      this.postCanvas.style.height = ch + 'px';
    }
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

  // من إحداثيات الشاشة لإحداثيات العالم
  screenToWorld(cx, cy) {
    const r = this.fc.getBoundingClientRect();
    const cam = this.cam || { x: 0, y: 0 };
    return [cam.x + (cx - r.left) / this.scale, cam.y + (cy - r.top) / this.scale];
  }

  camera(game) {
    const p = game.placing ? placement.anchor(game.placing) : game.state.player;
    const mw = (game.mode === 'dungeon' ? DW : game.mode === 'open' ? OW_W : MAP_W) * TILE;
    const mh = (game.mode === 'dungeon' ? DH : game.mode === 'open' ? OW_H : MAP_H) * TILE;
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
    } else if (game.mode === 'open') {
      if (!this.openLayer) this.buildOpenLayer(game);
      ctx.drawImage(this.openLayer, cam.x, cam.y, this.bw, this.bh, 0, 0, this.bw, this.bh);
      this.drawWater(game, cam, (x, y) => owTile(game.open.tiles, x, y));
      this.collectOpen(game, drawables, lights);
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
    this.postProcess(game);
    this.drawFx(game, cam);
  }

  postProcess(game) {
    const hq = game.state.settings.hq !== false && this.post && this.post.ok;
    if (this.postCanvas) this.postCanvas.style.display = hq ? 'block' : 'none';
    this.wc.style.visibility = hq ? 'hidden' : 'visible';
    if (!hq) return;
    const h = game.state.time.minute / 60;
    const band = (a, b, c, d) => (h <= a || h >= d ? 0 : h < b ? (h - a) / (b - a) : h <= c ? 1 : (d - h) / (d - c));
    const dungeon = game.mode === 'dungeon' ? 1 : 0;
    const warm = dungeon ? 0 : band(8, 11, 15, 17);
    const dusk = dungeon ? 0 : Math.max(band(16, 18, 18.8, 20.5), band(4.5, 6, 6.5, 8) * 0.7);
    const night = dungeon ? 0 : darkness(game.state.time.minute);
    const storm = game.eventMod && game.eventMod('storm') && game.mode === 'world' ? 1 : 0;
    const rain = game.rainLevel ? game.rainLevel() : 0;
    this.post.render(this.wc, {
      time: game.t, warm: warm * (1 - rain * 0.8), dusk, night, dungeon, rain,
      haze: Math.min(1, warm * 0.9 * (1 - rain) + storm * 0.8),
      bloom: 0.5 + night * 0.15 + dungeon * 0.2,
    });
  }

  buildOpenLayer(game) {
    const c = art.canvas(OW_W * TILE, OW_H * TILE);
    const ctx = c.getContext('2d');
    const getT = (x, y) => owTile(game.open.tiles, x, y);
    for (let y = 0; y < OW_H; y++) for (let x = 0; x < OW_W; x++) art.drawTile(ctx, getT(x, y), x, y, x * TILE, y * TILE, getT);
    this.openLayer = c;
  }

  collectOpen(game, list, lights) {
    const s = game.state;
    const t = game.t;
    const cam = this.cam;
    for (const o of game.open.objects) {
      if (!this.visible(o.x, o.y, cam)) continue;
      switch (o.kind) {
        case 'palm': this.sprite(list, art.palm(o.tx % 5, Math.round(Math.sin(t * 1.3 + o.tx) * 1.5), false), o.x, o.y + 2, o.y); break;
        case 'deco': this.sprite(list, art.deco(o.variant), o.x, o.y + 2, o.y - 6); break;
        case 'sign': this.sprite(list, art.woodSign(), o.x, o.y + 2, o.y); break;
        case 'farmsign': this.sprite(list, art.woodSign(), o.x, o.y + 2, o.y); break;
        case 'farmhouse': this.sprite(list, art.mudHouse(farmsSys.farmState(s, o.farm).owned ? 2 : 1), o.x, o.y + 6, o.y); lights.push({ x: o.x, y: o.y - 10, r: 40, c: 'rgba(255,190,90,' }); break;
        case 'crop': this.sprite(list, art.crop(o.crop, 3, 3), o.x, o.y + 1, o.y - 2); break;
        case 'gohome': this.sprite(list, art.buildSign(), o.x, o.y + 2, o.y); break;
        case 'owner': {
          const def = FARMS[o.farm];
          if (!farmsSys.farmState(s, o.farm).owned) this.sprite(list, art.character(def.look, 'down', 0, 'owner:' + o.farm), o.x, o.y + 2, o.y);
          break;
        }
        default: break;
      }
    }
    for (const [id, def] of Object.entries(FARMS)) this.fence(list, { x0: def.rect.x0, y0: def.rect.y0, x1: def.rect.x1 - 1, y1: def.rect.y1 - 1 });
    const rts = game.openRt || {};
    for (const [id] of Object.entries(FARMS)) {
      const f = s.farms && s.farms[id];
      if (!f || f.owned) continue;
      for (const a of f.animals) {
        if (a.closed) continue;
        const rt = rts[a.id];
        if (!rt || !this.visible(rt.x, rt.y, cam)) continue;
        const frame = rt.moving ? 1 + (Math.floor(t * 4 + rt.x) % 2) : 0;
        const img0 = a.kind === 'camel' ? art.camelSprite(camelCol(a.camel), frame, a.camel.rare || a.camel.breed) : art.sheepSprite(SHEEP_BREEDS[a.sheep.breed].body, SHEEP_BREEDS[a.sheep.breed].head, frame ? 1 : 0);
        const img = art.outlined(img0);
        list.push({ y: rt.y, draw: (ctx, c) => {
          ctx.save();
          ctx.translate(Math.round(rt.x - c.x), Math.round(rt.y - c.y));
          if (rt.dir < 0) ctx.scale(-1, 1);
          ctx.drawImage(img, Math.round(-img.width / 2), Math.round(-img.height + 2));
          ctx.restore();
        } });
      }
    }
    this.collectFencesDone = true;
  }

  drawWater(game, cam, getT) {
    getT = getT || ((x, y) => game.tileAtWorld(x, y));
    const ctx = this.w;
    const f = Math.floor(game.t * 2) % 4;
    const x0 = Math.floor(cam.x / TILE), y0 = Math.floor(cam.y / TILE);
    for (let y = y0; y <= y0 + Math.ceil(this.bh / TILE); y++) {
      for (let x = x0; x <= x0 + Math.ceil(this.bw / TILE); x++) {
        if (getT(x, y) === T.WATER) ctx.drawImage(art.waterFrame((f + x + y) % 4), x * TILE - cam.x, y * TILE - cam.y);
      }
    }
  }

  visible(x, y, cam, m = 48) {
    return x > cam.x - m && x < cam.x + this.bw + m && y > cam.y - m && y < cam.y + this.bh + m * 1.5;
  }

  sprite(list, img, x, y, sortY, opts = {}) {
    if (!opts.flat) img = art.outlined(img);
    else y -= 0;
    const oy = opts.flat ? 0 : 1;
    list.push({
      y: sortY,
      draw: (ctx, cam) => {
        const dx = Math.round(x - img.width / 2 - cam.x + (opts.ox || 0));
        const dy = Math.round(y - img.height - cam.y + (opts.oy || 0) + oy);
        if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
        if (opts.flip) {
          ctx.save();
          ctx.translate(dx + img.width, dy);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0);
          ctx.restore();
        } else ctx.drawImage(img, dx, dy);
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
        case 'sidr': {
          const dep = game.depleted(o);
          const sway = dep ? 0 : Math.round(Math.sin(t * 1.1 + o.ty) * 1.2);
          this.sprite(list, art.sidr(o.tx % 3, sway, dep), o.x, o.y + 2, o.y, { ox: sh });
          break;
        }
        case 'rock':
          if (!game.depleted(o)) this.sprite(list, o.variant === 'big' ? art.bigRock(o.tx % 2, game.nodeHits(o)) : art.rock(o.tx % 2, game.nodeHits(o)), o.x, o.y + 2, o.y, { ox: sh });
          else this.sprite(list, art.deco(1), o.x, o.y + 2, o.y - 8);
          break;
        case 'clay': this.sprite(list, art.clayPit(game.depleted(o)), o.x, o.y + 2, o.y - 8, { ox: sh }); break;
        case 'herb': this.sprite(list, art.herb(game.depleted(o)), o.x, o.y + 2, o.y - 4, { ox: sh }); break;
        case 'deco': if (!o.hidden) this.sprite(list, art.deco(o.variant), o.x, o.y + 2, o.y - 6); break;
        case 'placed': this.collectPlaced(game, o, list, lights); break;
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
    // كنوز العاصفة ولمعات القمر
    const buried = game.eventMod && game.eventMod('buried');
    for (const sp of game.eventSpots ? game.eventSpots() : []) {
      if (buried) {
        this.sprite(list, art.clayPit(false), sp.x, sp.y + 2, sp.y - 8);
        this.sprite(list, art.relicSparkle(t + sp.x), sp.x + 4, sp.y - 6, sp.y);
      } else {
        this.sprite(list, art.relicSparkle(t + sp.x), sp.x, sp.y - 4 + Math.round(Math.sin(t * 3 + sp.x) * 2), sp.y);
        lights.push({ x: sp.x, y: sp.y - 8, r: 26, c: 'rgba(180,210,255,' });
      }
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
      if (id === 'veggie') {
        // صناديق الخضار قدامه
        const cx = pos.x - 14, cy = pos.y + 12;
        list.push({ y: cy, draw: (ctx, cam) => {
          const x = Math.round(cx - cam.x), y = Math.round(cy - cam.y);
          const cols = [['#d9401a', '#f08a24'], ['#3f9a3a', '#6a3a8a'], ['#f0d040', '#c86a8a']];
          for (let i = 0; i < 3; i++) {
            const bx = x - 14 + i * 10, by = y - 8 + (i % 2);
            ctx.fillStyle = '#5e3a1f'; ctx.fillRect(bx, by, 9, 7);
            ctx.fillStyle = '#8a5a33'; ctx.fillRect(bx, by, 9, 2);
            for (let k = 0; k < 4; k++) { ctx.fillStyle = cols[i][k % 2]; ctx.fillRect(bx + 1 + (k % 2) * 4, by - 2 + Math.floor(k / 2) * 2, 3, 2); }
          }
        } });
      }
      if (id === 'shepherd') {
        for (let i = 0; i < 4; i++) this.sprite(list, art.sheep(Math.floor(t * 2 + i) % 2), pos.x - 26 + i * 14 + Math.round(Math.sin(t * 0.5 + i) * 4), pos.y + 10 + (i % 2) * 8, pos.y + 10 + (i % 2) * 8);
      }
    }
    // القافلة
    // نياق القافلة ونياق الجيران اللي ترعى حول الواحة
    if (game.wildRt) {
      const herds = game.guestRt.length ? game.wildRt.caravan.concat(game.wildRt.herd) : game.wildRt.herd;
      for (const rt of herds) {
        if (!this.visible(rt.x, rt.y, cam)) continue;
        const frame = rt.eating ? 3 + (Math.floor(t * 3 + rt.home.x) % 2) : rt.moving ? 1 + (Math.floor(t * 4 + rt.x) % 2) : 0;
        const img = art.outlined(art.camelSprite(BREEDS[rt.breed], frame, rt.breed));
        list.push({ y: rt.y, draw: (ctx, cam2) => {
          ctx.save();
          ctx.translate(Math.round(rt.x - cam2.x), Math.round(rt.y - cam2.y));
          if (rt.dir < 0) ctx.scale(-1, 1);
          ctx.drawImage(img, Math.round(-img.width / 2), Math.round(-img.height + 2));
          ctx.restore();
        } });
      }
    }
    if (s.built.stable) this.collectPen(game, list, lights);
    if (s.built.sheepfold) this.collectFold(game, list);
    this.collectGhost(game, list);
    this.collectWorkers(game, list);
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
        case 'kiln': this.sprite(list, art.station('kiln', t), o.x, o.y + 4, o.y, { flip: o.flip }); lights.push({ x: o.x, y: o.y - 4, r: 50, c: 'rgba(255,140,50,', flicker: true }); break;
        case 'mill': this.sprite(list, art.station('mill', t), o.x, o.y + 4, o.y, { flip: o.flip }); break;
        case 'loom': this.sprite(list, art.station('loom', t), o.x, o.y + 4, o.y, { flip: o.flip }); break;
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
        case 'workers_house': this.sprite(list, art.mudHouse(s.built.workers_house2 ? 2 : 1), o.x, o.y + 6, o.y, { flip: o.flip }); break;
        case 'stall_shop': this.sprite(list, art.shopStall(), o.x, o.y + 6, o.y, { flip: o.flip }); break;
        case 'orders_board': this.sprite(list, art.ordersBoard(), o.x, o.y + 4, o.y, { flip: o.flip }); break;
        default: break;
      }
      return;
    }
    if (o.dynamic) {
      // موقع بناء منحط باختيارك: حدود المبنى بالأرض ولوحة
      const f = o.fp;
      list.push({ y: -1e8 + o.y, draw: (ctx, cam) => {
        ctx.fillStyle = 'rgba(255,230,150,0.18)';
        ctx.fillRect(f.x0 * TILE - cam.x, f.y0 * TILE - cam.y, (f.x1 - f.x0 + 1) * TILE, (f.y1 - f.y0 + 1) * TILE);
        ctx.strokeStyle = 'rgba(140,90,40,0.9)';
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(f.x0 * TILE - cam.x + 0.5, f.y0 * TILE - cam.y + 0.5, (f.x1 - f.x0 + 1) * TILE - 1, (f.y1 - f.y0 + 1) * TILE - 1);
        ctx.setLineDash([]);
      } });
    }
    const job = s.workers && s.workers.find(w => w.job && w.job.spot === o.spot);
    if (job) { this.sprite(list, art.scaffold(job.job.progress / job.job.need), o.x, o.y + 4, o.y); return; }
    const st = game.state && spot;
    if (!st) return;
    const status = this.spotStatusCache(game, o.spot);
    if (status.hidden && !o.dynamic) return;
    const bob = Math.round(Math.sin(t * 3 + o.tx) * 1);
    this.sprite(list, art.buildSign(), o.x, o.y + 2, o.y, { alpha: status.needTech ? 0.55 : 1, oy: 0 });
    list.push({ y: o.y + 1, draw: (ctx, cam) => { ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.2; ctx.drawImage(art.ghostOutline(18, 12), Math.round(o.x - 9 - cam.x), Math.round(o.y - 10 - cam.y + bob * 0)); ctx.globalAlpha = 1; } });
  }

  // رسمة كل نوع (للمنحط والشبح)
  placedSprite(type, t, level = 1, seed = 0) {
    switch (type) {
      case 'kiln': case 'mill': case 'loom': return art.station(type, t);
      case 'stall_shop': return art.shopStall();
      case 'orders_board': return art.ordersBoard();
      case 'workers_house': return art.mudHouse(level);
      case 'trough': return art.trough(5);
      case 'fence': return art.fencePost();
      case 'flowers': return art.flowers(seed);
      case 'potpalm': return art.potPalm();
      case 'bench': return art.bench();
      case 'torch': return art.yardTorch(t);
      case 'chest': return art.storageChest(level);
      case 'f_cushion': return art.cushion();
      case 'f_lantern': return art.lanternPost(t);
      case 'f_jar': return art.heldJar(0);
      case 'f_bed': return art.guestBed();
      case 'f_dallah': return art.dallahStand(t);
      default: return null;
    }
  }

  collectPlaced(game, o, list, lights) {
    const s = game.state;
    const t = game.t;
    const f = o.fp;
    const type = o.ptype;
    if (type === 'path' || type === 'sandpath') {
      const img = art.pathTile(type === 'path' ? 'stone' : 'sand', f.x0 + f.y0);
      list.push({ y: -1e9 + o.y, draw: (ctx, cam) => ctx.drawImage(img, f.x0 * TILE - cam.x, f.y0 * TILE - cam.y) });
      return;
    }
    if (type === 'f_carpet') {
      const img = art.carpet((f.x1 - f.x0 + 1) * TILE - 2, (f.y1 - f.y0 + 1) * TILE - 4, '#8a2a3a');
      list.push({ y: -1e9 + o.y, draw: (ctx, cam) => ctx.drawImage(img, f.x0 * TILE + 1 - cam.x, f.y0 * TILE + 2 - cam.y) });
      return;
    }
    if (type === 'fence') {
      const post = art.fencePost();
      this.sprite(list, post, o.x - 6, o.y + 1, o.y);
      this.sprite(list, post, o.x + 6, o.y + 1, o.y);
      list.push({ y: o.y - 1, draw: (ctx, cam) => { ctx.fillStyle = '#8a5a33'; ctx.fillRect(Math.round(o.x - 8 - cam.x), Math.round(o.y - 8 - cam.y), 16, 1); ctx.fillRect(Math.round(o.x - 8 - cam.x), Math.round(o.y - 4 - cam.y), 16, 1); } });
      return;
    }
    const p = placement.placedById(s, o.pid);
    const img = this.placedSprite(type, t + o.x, placement.levelOf(s, p), f.x0 + f.y0);
    if (!img) return;
    this.sprite(list, img, o.x, o.y + 2, o.y, { flip: o.flip });
    if (PLACEABLES[type].light) lights.push({ x: o.x, y: o.y - 18, r: type === 'torch' ? 52 : 34, c: 'rgba(255,170,70,', flicker: true });
  }

  // شبح المبنى وقت الوضع: مربعات خضرا أو حمرا تحته
  collectGhost(game, list) {
    const pl = game.placing;
    if (!pl) return;
    const t = game.t;
    const ok = pl.check && pl.check.ok;
    const fp = placement.footprint(pl);
    const a = placement.anchor(pl);
    const img = this.placedSprite(pl.type, t, 1, fp.x0 + fp.y0);
    const pulse = 0.55 + Math.sin(t * 6) * 0.15;
    list.push({ y: 1e9, draw: (ctx, cam) => {
      ctx.fillStyle = ok ? `rgba(90,220,90,${pulse * 0.6})` : `rgba(230,60,50,${pulse * 0.7})`;
      for (let y = fp.y0; y <= fp.y1; y++) for (let x = fp.x0; x <= fp.x1; x++) ctx.fillRect(x * TILE - cam.x + 1, y * TILE - cam.y + 1, TILE - 2, TILE - 2);
      ctx.strokeStyle = ok ? '#b8ff9a' : '#ff8a80';
      ctx.lineWidth = 1;
      ctx.strokeRect(fp.x0 * TILE - cam.x + 0.5, fp.y0 * TILE - cam.y + 0.5, (fp.x1 - fp.x0 + 1) * TILE - 1, (fp.y1 - fp.y0 + 1) * TILE - 1);
      if (img) {
        ctx.globalAlpha = 0.75;
        const dx = Math.round(a.x - img.width / 2 - cam.x), dy = Math.round(a.y - img.height - cam.y + 2);
        if (pl.flip) { ctx.save(); ctx.translate(dx + img.width, dy); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore(); } else ctx.drawImage(img, dx, dy);
        ctx.globalAlpha = 1;
      }
    } });
  }

  collectFold(game, list) {
    const s = game.state;
    const t = game.t;
    this.fence(list, game.foldTiles());
    const rts = game.sheepRt || {};
    for (const sh of s.sheep) {
      const rt = rts[sh.id];
      if (!rt) continue;
      const b = SHEEP_BREEDS[sh.breed];
      const img = art.outlined(art.sheepSprite(sh.shornDay === s.time.day ? '#d8cbb0' : b.body, b.head, rt.moving ? Math.floor(t * 5) % 2 : 0));
      const sc = sh.ageDays >= 2 ? 1 : 0.7;
      list.push({ y: rt.y, draw: (ctx, cam) => {
        const w = img.width * sc, h = img.height * sc;
        ctx.save();
        ctx.translate(Math.round(rt.x - cam.x), Math.round(rt.y - cam.y));
        if (rt.dir < 0) ctx.scale(-1, 1);
        ctx.drawImage(img, Math.round(-w / 2), Math.round(-h + 2), Math.round(w), Math.round(h));
        ctx.restore();
      } });
    }
  }

  collectWorkers(game, list) {
    const t = game.t;
    for (const w of game.state.workers || []) {
      const rt = game.workerRt && game.workerRt[w.id];
      if (!rt) continue;
      const frame = rt.moving ? 1 + (Math.floor(t * 7) % 2) : 0;
      const img = art.character(WORKER_LOOKS[w.look % WORKER_LOOKS.length], rt.dir || 'down', frame, 'worker' + w.look);
      list.push({ y: rt.y, draw: (ctx, cam) => {
        const x = Math.round(rt.x - cam.x), y = Math.round(rt.y - cam.y);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x - 5, y, 10, 2);
        ctx.drawImage(art.outlined(img), x - 9, y - 22);
        if (rt.working) {
          const tool = { woodcutter: 'axe', farmer: 'shovel', builder: 'pick', herder: 'staff' }[w.type];
          this.toolAt(ctx, tool, x + 4, y - 12, -1.6 + ((t * 3) % 1) * 2.4);
        }
      } });
    }
  }

  fence(list, rect) {
    const x0 = rect.x0 * TILE, x1 = (rect.x1 + 1) * TILE, y0 = rect.y0 * TILE + 8, y1 = (rect.y1 + 1) * TILE;
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
  }

  collectPen(game, list, lights) {
    const s = game.state;
    const t = game.t;
    const PR = game.penTiles();
    const x0 = PR.x0 * TILE, x1 = (PR.x1 + 1) * TILE, y0 = PR.y0 * TILE + 8, y1 = (PR.y1 + 1) * TILE;
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
      const frame = rt.eating ? 3 + (Math.floor(t * 3 + rt.x) % 2) : rt.moving ? 1 + (Math.floor(t * 4 + rt.x) % 2) : 0;
      const img = art.outlined(art.camelSprite(col, frame, c.rare || c.breed));
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
      const img = art.outlined(art.enemy(e.def.kind, Math.floor(t * 6) % 2, e.hurt > 0));
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
    const crouch = a && ['plant', 'milk', 'harvest', 'feed', 'shear'].includes(a.type);
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
            ctx.drawImage(art.outlined(img), x - 9, y - 23 + dip, 18, 26 - dip);
          } else ctx.drawImage(art.outlined(img), x - 9, y - 22);
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
    const tool = game.mode === 'dungeon' ? 'staff' : t && t.kind === 'rock' ? 'pick' : t && t.kind === 'clay' ? 'shovel' : t && (t.kind === 'palm' || t.kind === 'sidr') ? 'axe' : null;
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

  // المطر (خطوط بكسل مايلة ورشّات بالأرض) وقوس قزح بعده
  drawRain(game) {
    if (game.mode === 'dungeon' || !game.rainLevel) return;
    const r = game.rainLevel(), rb = game.rainbowLevel();
    const ctx = this.w;
    const t = game.t;
    const W = this.bw, H = this.bh;
    if (r > 0) {
      ctx.fillStyle = `rgba(30,50,80,${0.2 * r})`;
      ctx.fillRect(0, 0, W, H);
      const n = Math.round(220 * r);
      ctx.fillStyle = 'rgba(200,222,255,0.6)';
      for (let i = 0; i < n; i++) {
        const sp = 230 + (i % 5) * 35;
        const y = ((i * 41.7 + t * sp) % (H + 24)) - 12;
        const x = ((i * 73.13 + t * 55 + y * 0.25) % (W + 20)) - 10;
        ctx.fillRect(Math.round(x), Math.round(y), 1, 3);
        ctx.fillRect(Math.round(x) - 1, Math.round(y) + 3, 1, 2);
      }
      // رشّات
      ctx.fillStyle = 'rgba(215,232,255,0.7)';
      for (let i = 0; i < n / 3; i++) {
        const ph = (t * 3 + i * 0.37) % 1;
        if (ph > 0.35) continue;
        const cyc = Math.floor(t * 3 + i * 0.37);
        const x = (i * 97.31 + cyc * 57.7) % W, y = (i * 53.9 + cyc * 31.3) % H;
        const w = ph < 0.15 ? 1 : 3;
        ctx.fillRect(Math.round(x - w / 2), Math.round(y), w, 1);
        if (ph >= 0.15) { ctx.fillRect(Math.round(x - 2), Math.round(y - 1), 1, 1); ctx.fillRect(Math.round(x + 2), Math.round(y - 1), 1, 1); }
      }
    }
    if (rb > 0) {
      ctx.save();
      ctx.globalAlpha = 0.28 * rb;
      ctx.lineWidth = 2;
      const cols = ['#ff5a5a', '#ffa040', '#ffe060', '#6ad060', '#50a0ff', '#8a60e0'];
      cols.forEach((c, k) => {
        ctx.strokeStyle = c;
        ctx.beginPath();
        ctx.arc(W * 0.65, H * 1.15, H * 0.95 - k * 2, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
      });
      ctx.restore();
    }
  }

  // غبار العاصفة الرملية
  drawStorm(game) {
    if (game.mode !== 'world' || !(game.eventMod && game.eventMod('storm'))) return;
    const ctx = this.w;
    const t = game.t;
    ctx.fillStyle = 'rgba(214,160,80,0.28)';
    ctx.fillRect(0, 0, this.bw, this.bh);
    ctx.fillStyle = 'rgba(245,215,160,0.55)';
    for (let i = 0; i < 90; i++) {
      const x = ((i * 53.3 + t * (120 + (i % 7) * 25)) % (this.bw + 40)) - 20;
      const y = (i * 37.7 + Math.sin(t * 2 + i) * 6) % this.bh;
      ctx.fillRect(Math.round(x), Math.round(y), 3 + (i % 3), 1);
    }
  }

  drawLighting(game, cam, lights) {
    this.drawStorm(game);
    this.drawRain(game);
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
          else if (rt.fresh > 0) this.label(f, x, y - 14 * this.dpr, c.name + ' — جديدة', '#bff5a0');
          const needs = camelSys.camelNeeds(c, s.time.day).filter(n => n !== 'milk');
          if (needs.length) { f.globalAlpha = 0.85; this.bubble(f, x + 10 * this.dpr, y + 4 * this.dpr, needs[0] === 'water' ? '💧' : '🌿', false, 0.7); f.globalAlpha = 1; }
          else if (c.pregnant) { f.font = `${12 * this.dpr}px sans-serif`; f.fillText('🤰', x + 10 * this.dpr, y); }
        }
      }
      if (s.built.sheepfold && game.sheepRt) {
        for (const sh of s.sheep) {
          const rt = game.sheepRt[sh.id];
          if (!rt || !this.visible(rt.x, rt.y, cam, 0)) continue;
          const needs = sheepSys.sheepNeeds(sh, s.time.day);
          const [x, y] = toScreen(rt.x, rt.y - 16);
          if (rt.fresh > 0) this.label(f, x, y - 12 * this.dpr, 'غنمة جديدة', '#bff5a0');
          if (!needs.length) continue;
          f.globalAlpha = 0.85;
          this.bubble(f, x + 6 * this.dpr, y, needs[0] === 'water' ? '💧' : needs[0] === 'food' ? '🌿' : '🧶', false, 0.6);
          f.globalAlpha = 1;
        }
      }
      for (const w of s.workers || []) {
        const rt = game.workerRt && game.workerRt[w.id];
        if (!rt || !this.visible(rt.x, rt.y, cam, 0)) continue;
        const [x, y] = toScreen(rt.x, rt.y - 30);
        if (w.status === 'strike') {
          this.bubble(f, x, y + Math.sin(t * 4) * 2 * this.dpr, '✊', true, 0.8);
          this.label(f, x, y - 16 * this.dpr, 'مضرب!', '#ff9a8a');
        } else {
          f.font = `${12 * this.dpr}px sans-serif`;
          f.fillText(WORKER_TYPES[w.type].icon, x, y + 4 * this.dpr);
          if (w.late >= 2) this.label(f, x, y - 10 * this.dpr, '⚠️ الراتب!', '#ffd24a');
        }
      }
      if (s.built.stall_shop && s.stall.slots.some(x => x && x.sold)) {
        const o = game.worldObjById['spot:stall_shop'];
        const [x, y] = toScreen(o.x, o.y - 42);
        this.bubble(f, x, y + Math.sin(t * 5) * 3 * this.dpr, '🪙', true);
      }
      for (const [id, pos] of Object.entries(game.world.npcSpots)) {
        if (!game.npcPresent(id)) continue;
        const [x, y] = toScreen(pos.x, pos.y - 28);
        this.label(f, x, y, NPCS[id].veggie ? '🥕 ' + NPCS[id].name + ' — بذور وخضار' : NPCS[id].name, '#ffe9a8');
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
      const [x, y] = toScreen(tg.x, tg.y - (tg.kind === 'palm' ? 50 : tg.kind === 'sidr' ? 42 : tg.kind === 'guest' || tg.kind === 'npc' ? 44 : 26));
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
    // لو المكان بالعالم الثاني، السهم يدلّك على الطريق له
    let guide = null;
    if (game.guide && game.mode !== 'dungeon') {
      if (game.guide.mode === game.mode) guide = game.guide;
      else if (game.mode === 'world') guide = game.worldObjById.exit_world;
      else guide = game.open.objects.find(o => o.kind === 'gohome');
    }
    if (guide) {
      const via = guide !== game.guide;
      this.pointArrow(game, guide, toScreen, { label: via ? (game.mode === 'world' ? 'طريق القرية' : 'طريق مزرعتك') : (game.guide.label || 'هنا') });
    } else if (game.mode === 'world') {
      const fresh = this.freshAnimal(game);
      if (fresh) this.pointArrow(game, fresh, toScreen, { label: 'حلالك الجديد', offOnly: true });
      else if (s.settings.arrow !== false) this.questArrow(game, cam, toScreen);
    }
    if (game.mode === 'open') {
      for (const o of game.open.objects) {
        if (!this.visible(o.x, o.y, cam, 0)) continue;
        if (o.kind === 'farmsign') {
          const own = farmsSys.farmState(s, o.farm).owned;
          const [x, y] = toScreen(o.x, o.y - 24);
          this.label(f, x, y, own ? `✔ ${FARMS[o.farm].name} (لك)` : FARMS[o.farm].name, own ? '#9ff07a' : '#fff3d6');
        } else if (o.kind === 'owner' && !farmsSys.farmState(s, o.farm).owned) {
          const [x, y] = toScreen(o.x, o.y - 30);
          this.label(f, x, y, FARMS[o.farm].owner, '#ffe9a8');
        } else if (o.kind === 'sign') {
          const [x, y] = toScreen(o.x, o.y - 24);
          this.label(f, x, y, o.text, '#fff3d6');
        } else if (o.kind === 'farmhouse' && farmsSys.farmState(s, o.farm).owned && Object.values(farmsSys.farmState(s, o.farm).storage).some(v => v > 0)) {
          const [x, y] = toScreen(o.x, o.y - 44);
          this.bubble(f, x, y + Math.sin(t * 5) * 3 * this.dpr, '📦', true);
        }
      }
    }
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
    if (!pos) {
      // المبنى ما انحط للحين: نذكّرك تفتح المتجر
      if (q.target.startsWith('spot:') && Object.values(PLACEABLES).some(d => d.spot === q.target.slice(5))) {
        const f = this.f, dpr = this.dpr, W = this.fc.width, H = this.fc.height;
        const bob = Math.sin(game.t * 4) * 3 * dpr;
        f.save();
        f.font = `700 ${13 * dpr}px Cairo, sans-serif`;
        const txt = '👇 افتح 🛒 المتجر ← مباني ← «📍 ضعه»';
        const w = f.measureText(txt).width + 20 * dpr;
        f.fillStyle = 'rgba(43,26,14,0.9)'; f.strokeStyle = '#e8b53a'; f.lineWidth = 2 * dpr;
        f.beginPath(); f.roundRect(W / 2 - w / 2, H - 118 * dpr + bob, w, 26 * dpr, 13 * dpr); f.fill(); f.stroke();
        f.fillStyle = '#fff3c4'; f.textAlign = 'center'; f.textBaseline = 'middle';
        f.fillText(txt, W / 2, H - 105 * dpr + bob);
        f.restore();
      }
      return;
    }
    if (game.target && Math.hypot(game.target.x - pos.x, game.target.y - pos.y) < 4) return;
    this.pointArrow(game, pos, toScreen, { label: q.title });
  }

  // أقرب حيوان جديد لسه ماشي أو واصل توه
  freshAnimal(game) {
    const s = game.state;
    for (const c of s.camels) { const rt = game.camelRt && game.camelRt[c.id]; if (rt && rt.fresh > 0 && s.built.stable) return rt; }
    for (const sh of s.sheep) { const rt = game.sheepRt && game.sheepRt[sh.id]; if (rt && rt.fresh > 0 && s.built.sheepfold) return rt; }
    return null;
  }

  // سهم على طرف الشاشة يأشر على مكان، أو علامة فوقه إذا كان ظاهر
  // سهم إرشاد واضح: برا الشاشة سهم ذهبي كبير على الطرف مع الاسم والمسافة ونقاط أثر،
  // وإذا المكان ظاهر سهم ينطط فوقه وحلقة تنبض بالأرض
  pointArrow(game, pos, toScreen, opts = {}) {
    const p = game.state.player;
    const f = this.f;
    const t = game.t;
    const dpr = this.dpr;
    const [sx, sy] = toScreen(pos.x, pos.y - 30);
    const [gx, gy] = toScreen(pos.x, pos.y);
    const W = this.fc.width, H = this.fc.height;
    const mx = 60 * dpr, myTop = 110 * dpr, myBot = 100 * dpr;
    const inside = sx > mx && sx < W - mx && sy > myTop * 0.6 && sy < H - myBot * 0.6;
    const dist = Math.round(Math.hypot(pos.x - p.x, pos.y - p.y) / TILE);
    const text = `${opts.label || ''}${opts.label ? ' • ' : ''}${dist} خطوة`;
    const pulse = 1 + Math.sin(t * 6) * 0.08;
    const arrowPath = (a) => {
      f.beginPath();
      f.moveTo(a, 0);
      f.lineTo(a * 0.05, -a * 0.72);
      f.lineTo(a * 0.05, -a * 0.3);
      f.lineTo(-a * 0.85, -a * 0.3);
      f.lineTo(-a * 0.85, a * 0.3);
      f.lineTo(a * 0.05, a * 0.3);
      f.lineTo(a * 0.05, a * 0.72);
      f.closePath();
    };
    const paint = (a) => {
      const gr = f.createLinearGradient(0, -a, 0, a);
      gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.5, '#ffc83a'); gr.addColorStop(1, '#e0801a');
      f.shadowColor = 'rgba(255,200,60,0.9)'; f.shadowBlur = 14 * dpr;
      arrowPath(a); f.fillStyle = gr; f.fill();
      f.shadowBlur = 0;
      f.lineWidth = 3.5 * dpr; f.strokeStyle = '#3a1a06'; f.lineJoin = 'round'; arrowPath(a); f.stroke();
      f.lineWidth = 1.2 * dpr; f.strokeStyle = 'rgba(255,255,255,0.7)'; arrowPath(a * 0.8); f.stroke();
    };
    const pill = (x, y, str) => {
      f.font = `700 ${12 * dpr}px Cairo, sans-serif`;
      const w = f.measureText(str).width + 16 * dpr, h = 20 * dpr;
      f.fillStyle = 'rgba(43,26,14,0.88)';
      f.strokeStyle = '#e8b53a'; f.lineWidth = 2 * dpr;
      const r = h / 2, x0 = x - w / 2, y0 = y - h / 2;
      f.beginPath(); f.moveTo(x0 + r, y0); f.arcTo(x0 + w, y0, x0 + w, y0 + h, r); f.arcTo(x0 + w, y0 + h, x0, y0 + h, r); f.arcTo(x0, y0 + h, x0, y0, r); f.arcTo(x0, y0, x0 + w, y0, r); f.closePath();
      f.fill(); f.stroke();
      f.fillStyle = '#fff3c4'; f.textAlign = 'center'; f.textBaseline = 'middle';
      f.fillText(str, x, y + 1 * dpr);
    };
    f.save();
    if (inside) {
      if (opts.offOnly) { f.restore(); return; }
      // حلقة بالأرض
      const rr = 15 * dpr * (1 + ((t * 1.5) % 1) * 0.6);
      f.globalAlpha = 1 - ((t * 1.5) % 1);
      f.strokeStyle = '#ffd84a'; f.lineWidth = 3 * dpr;
      f.beginPath(); f.ellipse(gx, gy, rr, rr * 0.45, 0, 0, Math.PI * 2); f.stroke();
      f.globalAlpha = 1;
      // سهم ينطط ويأشر لتحت
      const bob = Math.abs(Math.sin(t * 4)) * 8 * dpr;
      f.save();
      f.translate(sx, sy - 18 * dpr - bob);
      f.rotate(Math.PI / 2);
      paint(20 * dpr * pulse);
      f.restore();
      if (opts.label) pill(sx, sy - 52 * dpr - bob, opts.label);
    } else {
      const [px, py] = toScreen(p.x, p.y - 10);
      const ang = Math.atan2(sy - py, sx - px);
      // نقاط أثر من اللاعب باتجاه الهدف
      for (let i = 0; i < 5; i++) {
        const k = ((t * 1.4) % 1 + i) / 5;
        const d = 24 * dpr + k * 110 * dpr;
        f.globalAlpha = 0.85 * (1 - k);
        f.fillStyle = '#ffe07a';
        f.beginPath(); f.arc(px + Math.cos(ang) * d, py + Math.sin(ang) * d, 3.2 * dpr, 0, Math.PI * 2); f.fill();
      }
      f.globalAlpha = 1;
      // السهم على طرف الشاشة
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const tx = cos > 0 ? (W - mx - px) / cos : cos < 0 ? (mx - px) / cos : Infinity;
      const ty = sin > 0 ? (H - myBot - py) / sin : sin < 0 ? (myTop - py) / sin : Infinity;
      const k = Math.min(tx, ty);
      const cx = px + cos * k, cy = py + sin * k;
      f.save();
      f.translate(cx, cy);
      f.rotate(ang);
      paint(26 * dpr * pulse);
      f.restore();
      pill(cx - cos * 42 * dpr, cy - sin * 30 * dpr + (sin > 0.5 ? -8 : 14) * dpr, text);
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
