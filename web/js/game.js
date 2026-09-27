// قلب اللعبة: الحركة، التفاعل، الضيوف، السرداب، الأيام
import { buildWorld, tileAt, SOLID_TILES, TILE, MAP_W, MAP_H, T, WALL_N, WALL_S, KHAN } from './data/map.js';
import { ITEMS, SEEDS, RELICS } from './data/items.js';
import { BUILD_SPOTS } from './data/recipes.js';
import { NPCS, GUEST_LOOKS, GUEST_NAMES, GUEST_WANTS, GUEST_LINES, WEEKDAYS } from './data/npcs.js';
import { INTRO, LAMP_IDLE, MAIN_QUESTS } from './data/quests.js';
import { GATHER_CHEST_CHANCE } from './data/rewards.js';
import { newState, saveToStorage, loadFromStorage } from './systems/state.js';
import { add, count, addStat } from './systems/inventory.js';
import { applyReward, rollChestRarity, rollChest, doubleReward } from './systems/rewards.js';
import { maxEnergy, maxHp, attackPower, coinMultiplier, stars, roomsBuilt } from './systems/progression.js';
import { build, spotStatus } from './systems/crafting.js';
import * as time from './systems/time.js';
import * as farming from './systems/farming.js';
import * as retention from './systems/retention.js';
import { checkQuest, currentQuest } from './systems/quests.js';
import { generateFloor, dTile, D, DW, DH, ENEMIES } from './systems/dungeon.js';
import { mulberry32, pick, randInt } from './systems/util.js';
import { showRewardedAd } from './systems/ads.js';
import * as camels from './systems/camels.js';
import * as market from './systems/market.js';
import { PEN } from './data/map.js';
import { camelBreedName, TRAITS } from './data/camels.js';
import * as workers from './systems/workers.js';
import * as shop from './systems/shop.js';
import * as sheepSys from './systems/sheep.js';
import { FOLD } from './data/map.js';
import { WORKER_TYPES } from './data/workers.js';
import { buildOpenWorld, owTile, FARMS } from './data/openworld.js';
import * as farmsSys from './systems/farms.js';
import * as events from './systems/events.js';
import * as weather from './systems/weather.js';

// اتجاه الحركة ← وجه الشخصية
export function screenDir(dx, dy) {
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

const SPEED = 64;
const ACTION_REPEAT = 0.34;

export class Game {
  constructor({ ui, audio, input, particles, storage }) {
    this.ui = ui;
    this.audio = audio;
    this.input = input;
    this.fx = particles;
    this.storage = storage;
    this.rng = Math.random;
    this.clock = () => Date.now();
    this.world = buildWorld();
    this.worldObjById = Object.fromEntries(this.world.objects.map(o => [o.id, o]));
    this.open = buildOpenWorld();
    this.t = 0;
    this.actionCd = 0;
    this.swing = 0;
    this.shake = 0;
    this.hurtT = 0;
    this.moving = false;
    this.animT = 0;
    this.target = null;
    this.saveTimer = 0;
    this.questTimer = 0;
    this.tileDirty = true;
    this.mode = 'world';
    this.dungeon = null;
    this.guestRt = [];
    this.pausedBy = 0;
    this.notifiedAch = new Set();
  }

  now() { return this.clock(); }

  // حالة موقع البناء، ونخفي اللي يحتاج تقنية ما تعلمتها (إلا إذا كان هدف المهمة) عشان ما تزحم الشاشة
  spotStatusFor(id) {
    const st = spotStatus(this.state, id);
    if (st.needTech) {
      const q = currentQuest(this.state);
      if (!q || q.target !== 'spot:' + id) return { ...st, hidden: true };
    }
    return st;
  }

  // ---------- البداية ----------
  start() {
    const loaded = loadFromStorage(this.storage, this.now());
    this.state = loaded || newState(this.now());
    for (const c of this.state.camels) camels.ensureTraits(c);
    const s = this.state;
    if (!loaded) {
      s.player.x = this.world.spawn.x;
      s.player.y = this.world.spawn.y;
    }
    s.player.energy = Math.min(s.player.energy, maxEnergy(s));
    s.player.hp = maxHp(s);
    if (s.location === 'open') { s.location = 'world'; const ex = this.worldObjById.exit_world; this.placeAt({ x: ex.x + 18, y: ex.y }); }
    else if (s.location !== 'world') { s.location = 'world'; this.placeAt(this.world.cryptExit); }
    this.audio.music = s.settings.music;
    this.audio.sfx = s.settings.sfx;
    retention.ensureDailyQuests(s, this.now());
    this.restoreGuests();
    this.ui.bind(this);
    this.welcome(!loaded);
  }

  async welcome(isNew) {
    const s = this.state;
    if (isNew || !s.introSeen) {
      await this.ui.dialogue(INTRO);
      s.introSeen = true;
    } else {
      const off = retention.offlineEarnings(s, this.now());
      if (off) await this.offerOffline(off);
    }
    s.lastSeen = this.now();
    const ds = retention.dailyStatus(s, this.now());
    if (ds.available && s.quest.index >= 2) this.ui.openRewards('daily');
    this.save();
  }

  async offerOffline(off) {
    const hours = off.hours >= 1 ? `${Math.floor(off.hours)} ساعة` : `${Math.round(off.hours * 60)} دقيقة`;
    const choice = await this.ui.offer({
      title: 'رجعت؟ 🏜️',
      subtitle: `الخان اشتغل وأنت غايب ${hours}${off.capped ? ' (الحد 8 ساعات)' : ''}، والضيوف دفعوا:`,
      reward: { coins: off.coins },
      ad: 'offline_x2',
    });
    this.claimReward({ coins: off.coins * (choice === 'x2' ? 2 : 1) }, null);
  }

  // ---------- الحفظ ----------
  save() {
    if (!this.state) return;
    this.state.lastSeen = this.now();
    this.state.guests.list = this.guestRt.map(g => ({ ...g }));
    saveToStorage(this.state, this.storage);
  }

  // ---------- الحلقة ----------
  update(dt) {
    this.t += dt;
    this.animT += dt;
    this.fx.update(dt);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.saveTimer += dt;
    if (this.saveTimer > 10) { this.saveTimer = 0; this.save(); }

    if (this.ui.blocking()) { this.input.endFrame(); return; }
    const s = this.state;

    const newDays = time.advance(s, dt);
    if (newDays) this.onNewDay(newDays);
    this.clockTick();
    this.audio.night = time.isNight(s) || this.mode === 'dungeon';

    if (this.anim) this.updateAnim(dt);
    else this.movePlayer(dt);
    this.actionCd = Math.max(0, this.actionCd - dt);
    this.swing = Math.max(0, this.swing - dt);

    if (this.mode === 'world') this.updateWorld(dt);
    else if (this.mode === 'open') { this.updateWorld(dt); this.updateOpen(dt); }
    else this.updateDungeon(dt);

    this.updateGuide();
    this.target = this.findTarget();
    if ((this.input.actionPressed || this.input.action) && this.actionCd <= 0 && !this.anim) {
      this.actionCd = ACTION_REPEAT;
      this.doAction(this.target, this.input.actionPressed);
      if (this.anim) this.actionCd = Math.max(ACTION_REPEAT, this.anim.dur);
    }
    this.marketTimer = (this.marketTimer || 0) + dt;
    if (this.marketTimer > 2) { this.marketTimer = 0; this.marketTick(); }
    this.input.endFrame();

    this.questTimer += dt;
    if (this.questTimer > 0.5) { this.questTimer = 0; this.checkProgress(); }
  }

  updateWorld(dt) {
    const s = this.state;
    const h = time.hour(s);
    if (s.guests.day !== s.time.day && h >= 7 && h < 17) this.spawnCaravan();
    for (const g of this.guestRt) {
      if (h >= 19 && !g.leaving) g.leaving = true;
      const tgt = g.leaving ? this.world.caravanEntry : g.spot;
      const dx = tgt.x - g.x, dy = tgt.y - g.y;
      const d = Math.hypot(dx, dy);
      g.moving = d > 2;
      if (g.moving) {
        const sp = 34 * dt;
        g.x += (dx / d) * Math.min(sp, d);
        g.y += (dy / d) * Math.min(sp, d);
        g.dir = screenDir(dx, dy);
      } else if (!g.leaving) g.dir = 'down';
      if (g.leaving && !g.moving) g.gone = true;
    }
    if (this.guestRt.some(g => g.gone)) this.guestRt = this.guestRt.filter(g => !g.gone);
    this.updateCamels(dt);
    this.updateWildCamels(dt);
    this.updateSheep(dt);
    this.updateWorkers(dt);
  }

  // ---------- ساعات اللعبة ----------
  absMinutes() {
    return this.state.time.day * 1440 + this.state.time.minute;
  }

  // طقس اليوم (ثابت لكل يوم)، وتقدر تفرضه للاختبار بـ wxOverride
  weatherNow() {
    const s = this.state;
    if (this.wxOverride) return this.wxOverride;
    if (!this.wx || this.wx.day !== s.time.day) this.wx = { day: s.time.day, w: weather.dayWeather(s.seed, s.time.day, !!this.eventMod('storm')) };
    return this.wx.w;
  }

  rainLevel() {
    if (this.mode === 'dungeon') return 0;
    return weather.rainIntensity(this.weatherNow(), this.state.time.minute / 60);
  }

  rainbowLevel() {
    if (this.mode === 'dungeon') return 0;
    return weather.rainbowAt(this.weatherNow(), this.state.time.minute / 60);
  }

  weatherTick() {
    const s = this.state;
    const w = this.weatherNow();
    const raining = weather.rainAt(w, s.time.minute / 60);
    if (raining && s.rainDay !== s.time.day) {
      s.rainDay = s.time.day;
      const n = weather.applyRain(s, s.time.day);
      this.audio.play('thunder');
      this.ui.toast(n ? `🌧️ نزل المطر! انسقى زرعك (${n} حوض) والحلال شرب` : '🌧️ نزل المطر! أي شي تزرعه الحين ينسقى من نفسه', 'gain', 5);
      this.ui.refresh();
    }
    this.audio.setRain(this.rainLevel());
  }

  clockTick() {
    const s = this.state;
    this.weatherTick();
    const nowMin = this.absMinutes();
    const absHour = Math.floor(nowMin / 60);
    if (s.payroll.lastHour == null) s.payroll.lastHour = absHour;
    while (s.payroll.lastHour < absHour) {
      s.payroll.lastHour += 1;
      for (const ev of workers.hourTick(s, (s.payroll.lastHour - 1) % 24)) {
        if (ev.type === 'strike') { this.audio.play('deny'); this.ui.toast(`✊ ${ev.worker.name} مضرب عن الشغل! ادفع راتبه والغرامة عشان يرجع`, 'ach', 5); }
        else if (ev.type === 'late') this.ui.toast(`⚠️ راتب ${ev.worker.name} متأخر! ساعة وحدة ويضرب`, '', 4);
        else if (ev.type === 'autopay') this.fx.float(...this.fx.at(s.player.x, s.player.y, 34), `💸 رواتب −${ev.amount}`, '#ffb0a0', 11);
      }
      this.ui.refresh();
    }
    // البسطة كل 10 دقايق لعبة
    s.stallMin = s.stallMin || nowMin;
    if (nowMin - s.stallMin >= 10) {
      const fast = this.eventMod('stallFast');
      const sold = shop.stallTick(s, (nowMin - s.stallMin) * (fast ? 2.5 : 1), this.rng);
      if (fast && sold.length) events.addTokens(s, sold.length * 2);
      s.stallMin = nowMin;
      for (const x of sold) {
        this.audio.play('coin');
        this.ui.toast(`🏪 ${x.buyer} اشترى ${x.kind === 'item' ? ITEMS[x.item].icon + ' ×' + x.qty : '🐑'} من بسطتك بـ ${x.price} — استلم الدراهم!`, 'gain', 4);
      }
      if (sold.length) this.ui.refresh();
    }
    if (s.built.orders_board) shop.ensureOrders(s, this.rng, nowMin);
  }

  // ---------- العالم المفتوح ----------
  async travel(to) {
    const s = this.state;
    const tips = ['نصيحة: ساوم زين، كل صاحب مزرعة له طبعه.', 'نصيحة: تقدر تشتري مزرعة جارك وتصير تنتج لك كل يوم.', 'نصيحة: العمّال يكملون شغلهم وأنت برا مزرعتك.', 'نصيحة: النياق النادرة تنباع بمئات الألوف!'];
    await this.ui.loading(to === 'open' ? '🐪 طالع للقرية...' : '🏠 راجع لمزرعتك...', pick(this.rng, tips));
    if (to === 'open') {
      this.mode = 'open';
      s.location = 'open';
      for (const id of Object.keys(FARMS)) farmsSys.refreshFarm(s, id, s.time.day);
      this.placeAt(this.open.spawn);
      addStat(s, 'trips', 1);
    } else {
      this.mode = 'world';
      s.location = 'world';
      const ex = this.worldObjById.exit_world;
      this.placeAt({ x: ex.x + 18, y: ex.y });
      if (s.arrivals && s.arrivals.length) this.ui.toast(`🐾 حلالك الجديد (${s.arrivals.length}) وصل معك وماشي للمراح، اتبع السهم`, 'gain', 5);
    }
    s.player.dir = to === 'open' ? 'up' : 'right';
    this.ui.refresh();
    this.save();
  }

  updateOpen(dt) {
    const s = this.state;
    this.openRt = this.openRt || {};
    for (const [id, def] of Object.entries(FARMS)) {
      const f = farmsSys.refreshFarm(s, id, s.time.day);
      const r = def.rect;
      const box = { x0: (r.x0 + 2) * TILE, x1: (r.x1 - 1) * TILE, y0: (r.y0 + 5) * TILE, y1: (r.y1 - 3) * TILE };
      const herd = f.owned ? [] : f.animals.filter(a => !a.closed);
      for (const a of herd) {
        let rt = this.openRt[a.id];
        if (!rt) { rt = this.openRt[a.id] = { x: box.x0 + this.rng() * (box.x1 - box.x0), y: box.y0 + this.rng() * (box.y1 - box.y0), wait: this.rng() * 3, dir: 1 }; rt.tx = rt.x; rt.ty = rt.y; }
        const dx = rt.tx - rt.x, dy = rt.ty - rt.y, d = Math.hypot(dx, dy);
        rt.moving = d > 1;
        if (rt.moving) { const sp = 12 * dt; rt.x += (dx / d) * Math.min(sp, d); rt.y += (dy / d) * Math.min(sp, d); if (Math.abs(dx) > 0.5) rt.dir = dx > 0 ? 1 : -1; }
        else if ((rt.wait -= dt) <= 0) { rt.wait = 2 + this.rng() * 5; rt.tx = box.x0 + this.rng() * (box.x1 - box.x0); rt.ty = box.y0 + this.rng() * (box.y1 - box.y0); }
      }
    }
  }

  collectFarm(id) {
    const got = farmsSys.collectStorage(this.state, id);
    const list = Object.entries(got).filter(([, v]) => v > 0);
    if (!list.length) { this.ui.toast('المخزن فاضي، ارجع بكرة 📦'); return; }
    this.audio.play('coin');
    this.ui.gainToast(list.map(([k, v]) => ({ icon: k === 'coins' ? '🪙' : ITEMS[k].icon, text: `+${v}` })));
    this.fx.confetti(...this.fx.at(this.state.player.x, this.state.player.y, 20));
    this.ui.refresh();
    this.save();
  }

  // ---------- العمّال ----------
  workerHome() {
    const o = this.worldObjById['spot:workers_house'];
    return this.state.built.workers_house ? { x: o.x, y: o.y + 14 } : { x: this.world.cryptExit.x - 60, y: this.world.cryptExit.y + 20 };
  }

  updateWorkers(dt) {
    const s = this.state;
    this.workerRt = this.workerRt || {};
    const home = this.workerHome();
    const ids = new Set(s.workers.map(w => w.id));
    for (const id of Object.keys(this.workerRt)) if (!ids.has(id)) delete this.workerRt[id];
    const workHour = workers.isWorkHour(time.hour(s));
    const reserved = new Set(Object.values(this.workerRt).map(r => r.task && r.task.key).filter(Boolean));
    for (const w of s.workers) {
      let rt = this.workerRt[w.id];
      if (!rt) rt = this.workerRt[w.id] = { x: home.x + (this.rng() - 0.5) * 30, y: home.y + this.rng() * 20, dir: 'down', task: null, t: 0 };
      rt.working = false;
      if (w.status === 'strike' || !workHour) {
        rt.task = null;
        this.walkTo(rt, { x: home.x + ((w.look * 13) % 40) - 20, y: home.y + 10 }, 30 * dt);
        continue;
      }
      if (!rt.task || !this.taskValid(w, rt.task)) {
        if (rt.task) reserved.delete(rt.task.key);
        rt.task = this.pickTask(w, rt, reserved);
        rt.t = 0;
        if (rt.task) reserved.add(rt.task.key);
      }
      const task = rt.task;
      if (!task) { this.walkTo(rt, { x: home.x, y: home.y + 16 }, 26 * dt); continue; }
      const arrived = this.walkTo(rt, task.at, 44 * w.speed * dt);
      if (!arrived) continue;
      rt.working = true;
      rt.t += dt * w.speed;
      if (task.kind === 'build') {
        const done = workers.progressBuild(s, w, dt * time.GAME_MIN_PER_SEC / 60);
        if (done) this.onWorkerBuilt(w, done);
        continue;
      }
      if (rt.t >= task.dur) {
        rt.t = 0;
        const again = this.doTask(w, task, rt);
        if (!again) { reserved.delete(task.key); rt.task = null; }
      }
    }
  }

  walkTo(rt, p, step) {
    const dx = p.x - rt.x, dy = p.y - rt.y;
    const d = Math.hypot(dx, dy);
    rt.moving = d > 6;
    if (!rt.moving) return true;
    rt.x += (dx / d) * Math.min(step, d);
    rt.y += (dy / d) * Math.min(step, d);
    rt.dir = screenDir(dx, dy);
    return false;
  }

  near(rt, list) {
    let best = null, bd = 1e9;
    for (const it of list) {
      const d = Math.hypot(it.x - rt.x, it.y - rt.y);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  activePlots() {
    return this.world.objects.filter(o => o.kind === 'plot' && (o.group === 1 || this.state.built.farm2));
  }

  pickTask(w, rt, reserved) {
    const s = this.state;
    const free = (key) => !reserved.has(key);
    const well = this.worldObjById.well;
    const fetchWater = { kind: 'well', key: 'well:' + w.id, at: { x: well.x + 10, y: well.y + 10 }, dur: 1.2 };
    if (w.type === 'builder') {
      if (!w.job) return null;
      const o = this.worldObjById['spot:' + w.job.spot];
      return { kind: 'build', key: 'build:' + w.job.spot, at: { x: o.x + 12, y: o.y + 8 }, dur: 999 };
    }
    if (w.type === 'woodcutter') {
      const nodes = this.world.objects.filter(o => (o.kind === 'palm' || o.kind === 'sidr' || o.kind === 'rock') && !this.depleted(o) && free('node:' + o.id));
      const o = this.near(rt, nodes);
      return o ? { kind: 'node', key: 'node:' + o.id, obj: o, at: { x: o.x + 10, y: o.y + 8 }, dur: 1.1 } : null;
    }
    if (w.type === 'farmer') {
      const plots = this.activePlots().filter(o => free('plot:' + o.id));
      const ready = plots.filter(o => s.plots[o.id] && farming.isReady(s.plots[o.id]));
      const dry = plots.filter(o => s.plots[o.id] && !s.plots[o.id].watered && !farming.isReady(s.plots[o.id]));
      const empty = plots.filter(o => !s.plots[o.id]);
      let o = this.near(rt, ready);
      if (o) return { kind: 'harvest', key: 'plot:' + o.id, obj: o, at: { x: o.x, y: o.y + 10 }, dur: 1.2 };
      if (dry.length) {
        if (count(s, 'water') < 1) return fetchWater;
        o = this.near(rt, dry);
        return { kind: 'waterPlot', key: 'plot:' + o.id, obj: o, at: { x: o.x, y: o.y + 10 }, dur: 1.4 };
      }
      if (empty.length && farming.firstSeed(s)) {
        o = this.near(rt, empty);
        return { kind: 'plant', key: 'plot:' + o.id, obj: o, at: { x: o.x, y: o.y + 10 }, dur: 1.4 };
      }
      return null;
    }
    if (w.type === 'herder') {
      const day = s.time.day;
      const rts = this.camelRt || {};
      const thirsty = s.camels.filter(c => !camels.isWatered(c, day) && rts[c.id] && free('camel:' + c.id));
      const hungry = s.camels.filter(c => !camels.isFed(c, day) && rts[c.id] && free('camel:' + c.id));
      if (thirsty.length) {
        if (count(s, 'water') < 1) return fetchWater;
        const c = thirsty[0];
        return { kind: 'waterCamel', key: 'camel:' + c.id, id: c.id, at: rts[c.id], dur: 1.2 };
      }
      if (hungry.length && camels.feedItem(s)) {
        const c = hungry[0];
        return { kind: 'feedCamel', key: 'camel:' + c.id, id: c.id, at: rts[c.id], dur: 1.2 };
      }
      const srts = this.sheepRt || {};
      const sThirsty = s.sheep.filter(x => x.wateredDay !== day && srts[x.id] && free('sheep:' + x.id));
      if (sThirsty.length) {
        if (count(s, 'water') < 1) return fetchWater;
        return { kind: 'waterSheep', key: 'sheep:' + sThirsty[0].id, id: sThirsty[0].id, at: srts[sThirsty[0].id], dur: 1 };
      }
      const sHungry = s.sheep.filter(x => x.fedDay !== day && srts[x.id] && free('sheep:' + x.id));
      if (sHungry.length && sheepSys.sheepFeedItem(s)) return { kind: 'feedSheep', key: 'sheep:' + sHungry[0].id, id: sHungry[0].id, at: srts[sHungry[0].id], dur: 1 };
      if (s.built.trough && s.trough.water < 10 && (s.camels.length || s.sheep.length)) {
        if (count(s, 'water') < 1) return fetchWater;
        const o = this.worldObjById['spot:trough'];
        return { kind: 'trough', key: 'trough', obj: o, at: { x: o.x - 12, y: o.y + 6 }, dur: 1 };
      }
      return null;
    }
    return null;
  }

  taskValid(w, task) {
    const s = this.state;
    if (task.kind === 'node') return !this.depleted(task.obj);
    if (task.kind === 'build') return !!w.job;
    if (task.kind === 'harvest') return !!(s.plots[task.obj.id] && farming.isReady(s.plots[task.obj.id]));
    if (task.kind === 'waterPlot') return !!(s.plots[task.obj.id] && !s.plots[task.obj.id].watered);
    if (task.kind === 'plant') return !s.plots[task.obj.id];
    return true;
  }

  // ينفّذ خطوة شغل. يرجع true إذا المهمة تبي تكمل
  doTask(w, task, rt) {
    const s = this.state;
    const day = s.time.day;
    const at = (lift) => this.fx.at(rt.x, rt.y, lift);
    switch (task.kind) {
      case 'node': {
        const o = task.obj;
        o.shakeT = 0.15;
        const tree = o.kind !== 'rock';
        this.fx.burst(...this.fx.at(o.x, o.y, 8), tree ? ['#8a5a33', '#4f8a2f'] : ['#9c948a', '#c4bcb0'], 5, 40, 0.4);
        if (this.visibleNear(o)) this.audio.play(tree ? 'chop' : 'mine');
        const n = s.nodes[o.id] && !(s.nodes[o.id].respawnDay > day) ? s.nodes[o.id] : { hits: 0 };
        n.hits = (n.hits || 0) + 1;
        s.nodes[o.id] = n;
        if (n.hits < 3) return true;
        n.hits = 0;
        n.respawnDay = day + 2;
        this.boxVersion = (this.boxVersion || 0) + 1;
        const loot = o.kind === 'palm' ? { wood: 2, frond: randInt(this.rng, 1, 2) } : o.kind === 'sidr' ? { wood: 3 } : { stone: o.variant === 'big' ? 4 : 2 };
        addStat(s, o.kind === 'palm' ? 'palms' : o.kind === 'sidr' ? 'sidr' : 'rocks', 1);
        this.gainItems(loot, o.x, o.y, 16);
        return false;
      }
      case 'well':
        add(s, 'water', 3);
        this.fx.float(...at(26), '💧 +3', '#b9f0ff', 11);
        return false;
      case 'harvest': {
        const h = farming.harvest(s, task.obj.id, this.rng);
        if (h) this.fx.float(...this.fx.at(task.obj.x, task.obj.y, 16), `${ITEMS[h.crop].icon} +${h.n}`, '#fff3c4', 12);
        this.ui.refresh();
        return false;
      }
      case 'waterPlot':
        if (farming.water(s, task.obj.id)) this.fx.burst(...this.fx.at(task.obj.x, task.obj.y, 4), ['#57a9cf', '#a6def0'], 8, 30, 0.4);
        return false;
      case 'plant': {
        const seed = farming.firstSeed(s);
        if (seed && farming.plant(s, task.obj.id, seed)) { task.obj.popT = this.t; if (this.rainLevel() > 0) s.plots[task.obj.id].watered = true; this.fx.float(...this.fx.at(task.obj.x, task.obj.y, 14), '🌱', '#d8ffb0', 12); }
        return false;
      }
      case 'waterCamel': camels.waterCamel(s, task.id, day); this.fx.float(...at(24), '💧', '#b9f0ff', 12); return false;
      case 'feedCamel': camels.feed(s, task.id, day); this.fx.float(...at(24), '🌿', '#d8ffb0', 12); return false;
      case 'waterSheep': sheepSys.waterSheep(s, task.id, day); this.fx.float(...at(20), '💧', '#b9f0ff', 11); return false;
      case 'feedSheep': sheepSys.feedSheep(s, task.id, day); this.fx.float(...at(20), '🌿', '#d8ffb0', 11); return false;
      case 'trough': camels.fillTrough(s, 1); return s.trough.water < 10 && count(s, 'water') > 0;
      default: return false;
    }
  }

  visibleNear(o) {
    const p = this.state.player;
    return Math.hypot(o.x - p.x, o.y - p.y) < 200;
  }

  onWorkerBuilt(w, spotId) {
    const o = this.worldObjById['spot:' + spotId];
    this.audio.play('build');
    this.fx.burst(...this.fx.at(o.x, o.y, 8), ['#d4a46b', '#b07e4c', '#fff3c4'], 30, 90, 0.9);
    this.fx.float(...this.fx.at(o.x, o.y, 30), `🔨 ${w.name} خلّص البناء!`, '#ffd24a', 14);
    this.ui.toast(`🔨 ${w.name} بنى ${BUILD_SPOTS[spotId].name}`, 'gain', 4);
    this.tileDirty = true;
    this.boxVersion = (this.boxVersion || 0) + 1;
    if (spotId === 'stable') this.giftStarterCamels();
    this.save();
    this.checkProgress();
  }

  // ---------- الغنم ----------
  // سهم يدلّك على مكان (من شاشة الإدارة أو النصايح)
  guideTo(pos, label = '', mode = 'world') {
    this.guide = pos ? { x: pos.x, y: pos.y, label, mode } : null;
  }

  updateGuide() {
    const g = this.guide;
    if (!g) return;
    const p = this.state.player;
    if (g.mode === this.mode && Math.hypot(p.x - g.x, p.y - g.y) < 36) { this.guide = null; this.fx.float(...this.fx.at(p.x, p.y, 30), '📍 وصلت', '#ffe07a', 12); }
  }

  // مكان حيوان جديد: عادي يطلع بمكان عشوائي بالحظيرة، والمشترى من القرية يدخل من طريق القرية ويمشي لها
  newAnimalRt(id, r) {
    const s = this.state;
    const i = s.arrivals ? s.arrivals.indexOf(id) : -1;
    if (i >= 0) {
      if (this.mode !== 'world') return null;
      s.arrivals.splice(i, 1);
      const ex = this.worldObjById.exit_world;
      const rt = { x: ex.x + 20, y: ex.y + (this.rng() - 0.5) * 16, wait: 1, dir: 1, arrive: true, fresh: 40 };
      rt.tx = r.x0 + (0.3 + this.rng() * 0.4) * (r.x1 - r.x0);
      rt.ty = r.y0 + (0.3 + this.rng() * 0.4) * (r.y1 - r.y0);
      return rt;
    }
    const rt = { x: r.x0 + this.rng() * (r.x1 - r.x0), y: r.y0 + this.rng() * (r.y1 - r.y0), wait: this.rng() * 3, dir: 1 };
    rt.tx = rt.x; rt.ty = rt.y;
    return rt;
  }

  updateSheep(dt) {
    const s = this.state;
    this.sheepRt = this.sheepRt || {};
    const r = { x0: FOLD.x0 * TILE + 10, x1: (FOLD.x1 + 1) * TILE - 10, y0: FOLD.y0 * TILE + 18, y1: (FOLD.y1 + 1) * TILE - 6 };
    const ids = new Set(s.sheep.map(x => x.id));
    for (const id of Object.keys(this.sheepRt)) if (!ids.has(id)) delete this.sheepRt[id];
    for (const sh of s.sheep) {
      let rt = this.sheepRt[sh.id];
      if (!rt) { rt = this.newAnimalRt(sh.id, r); if (!rt) continue; this.sheepRt[sh.id] = rt; }
      if (rt.fresh > 0) rt.fresh -= dt;
      if (rt.arrive) {
        const dx = rt.tx - rt.x, dy = rt.ty - rt.y, d = Math.hypot(dx, dy);
        rt.moving = d > 1;
        if (rt.moving) { const sp = 65 * dt; rt.x += (dx / d) * Math.min(sp, d); rt.y += (dy / d) * Math.min(sp, d); if (Math.abs(dx) > 0.5) rt.dir = dx > 0 ? 1 : -1; }
        else rt.arrive = false;
      } else this.grazeUpdate(rt, dt, r, 14, () => ({ x: r.x0 + this.rng() * (r.x1 - r.x0), y: r.y0 + this.rng() * (r.y1 - r.y0) }));
    }
  }

  sheepAction(sh, rt) {
    const s = this.state;
    const day = s.time.day;
    const tgt = { x: rt.x, y: rt.y };
    this.input.action = false;
    if (sh.wateredDay !== day && count(s, 'water') > 0) {
      if (!this.spendEnergy(1)) return;
      this.startAnim('water', tgt, 0.8, 0.6, () => { sheepSys.waterSheep(s, sh.id, day); this.audio.play('water'); this.fx.float(...this.fx.at(rt.x, rt.y, 20), '💧', '#b9f0ff', 12); this.gainXp(1, rt.x, rt.y, 30); });
      return;
    }
    if (sh.fedDay !== day && sheepSys.sheepFeedItem(s)) {
      if (!this.spendEnergy(1)) return;
      this.startAnim('feed', tgt, 0.6, 0.45, () => { sheepSys.feedSheep(s, sh.id, day); this.audio.play('eat'); this.fx.float(...this.fx.at(rt.x, rt.y, 20), '🌿', '#d8ffb0', 12); this.gainXp(1, rt.x, rt.y, 30); });
      return;
    }
    if (sheepSys.canShear(sh, day)) {
      if (!this.spendEnergy(2)) return;
      this.startAnim('shear', tgt, 1.0, 0.8, () => {
        const n = sheepSys.shear(s, sh.id, day);
        this.audio.play('pick');
        this.fx.burst(...this.fx.at(rt.x, rt.y, 6), ['#f4f0e6', '#ffffff'], 14, 40, 0.8);
        this.fx.float(...this.fx.at(rt.x, rt.y, 22), `🧶 +${n}`, '#ffffff', 13);
        this.gainXp(3, rt.x, rt.y, 32);
        this.ui.refresh();
      });
      return;
    }
    this.ui.toast(`🐑 ${sheepSys.SHEEP_BREEDS[sh.breed].name} — ${sh.ageDays >= 2 ? 'بالغ' : 'طلي صغير'}. الصوف يطلع كل يومين.`, '', 2.5);
  }

  // ---------- الأنيميشن ----------
  // الفعل ياخذ وقته: يبدأ، وعند hitAt يصير التأثير، وينتهي عند dur
  startAnim(type, target, dur, hitAt, onHit) {
    const p = this.state.player;
    if (target && Math.abs(target.x - p.x) > 3) p.dir = target.x > p.x ? 'right' : 'left';
    this.anim = { type, target, dur, hitAt, onHit, t: 0, hit: false };
    this.swing = 0;
  }

  updateAnim(dt) {
    const a = this.anim;
    a.t += dt;
    const p = this.state.player;
    const k = a.t / a.dur;
    // خيط الماء من الجرة
    if ((a.type === 'water' || a.type === 'pour') && k > 0.25 && k < 0.85 && a.target) {
      const side = p.dir === 'left' ? -1 : 1;
      const [sx, sy] = this.fx.at(p.x, p.y, 17);
      const x0 = sx + side * 12, y0 = sy;
      const T = 0.3, g = 320;
      for (let i = 0; i < 2; i++) {
        const [tx, ty] = this.fx.at(a.target.x + (Math.random() - 0.5) * 6, a.target.y, 3);
        this.fx.emit(x0, y0, (tx - x0) / T, (ty - y0) / T - 0.5 * g * T, Math.random() < 0.5 ? '#6fb8e0' : '#b6e6f6', T, g, i ? 1 : 2);
      }
    }
    if (a.type === 'feed' && !a.hit && k > 0.3 && a.target) {
      const [x0, y0] = this.fx.at(p.x, p.y, 14);
      const [tx, ty] = this.fx.at(a.target.x, a.target.y, 10);
      this.fx.emit(x0, y0, (tx - x0) / 0.35, (ty - y0) / 0.35 - 50, '#7fb846', 0.35, 280, 2);
    }
    if (!a.hit && a.t >= a.hitAt) {
      a.hit = true;
      if (a.onHit) a.onHit();
    }
    if (a.t >= a.dur) this.anim = null;
  }

  // ---------- النياق ----------
  penRect() {
    return { x0: PEN.x0 * TILE + 10, x1: (PEN.x1 + 1) * TILE - 10, y0: PEN.y0 * TILE + 18, y1: (PEN.y1 + 1) * TILE - 6 };
  }

  updateCamels(dt) {
    const s = this.state;
    this.camelRt = this.camelRt || {};
    const r = this.penRect();
    const ids = new Set(s.camels.map(c => c.id));
    for (const id of Object.keys(this.camelRt)) if (!ids.has(id)) delete this.camelRt[id];
    for (const c of s.camels) {
      let rt = this.camelRt[c.id];
      if (!rt) {
        rt = this.newAnimalRt(c.id, r);
        if (!rt) continue;
        this.camelRt[c.id] = rt;
      }
      if (rt.fresh > 0) rt.fresh -= dt;
      if (rt.arrive) {
        // جايّة من طريق القرية: تمشي على طول للمراح
        const dx = rt.tx - rt.x, dy = rt.ty - rt.y, d = Math.hypot(dx, dy);
        rt.moving = d > 1;
        if (rt.moving) { const sp = 75 * dt; rt.x += (dx / d) * Math.min(sp, d); rt.y += (dy / d) * Math.min(sp, d); if (Math.abs(dx) > 0.5) rt.dir = dx > 0 ? 1 : -1; }
        else rt.arrive = false;
      } else {
        // ترعى داخل المراح، وأحياناً تروح للحوض تشرب
        const trough = s.built.trough ? this.worldObjById['spot:trough'] : null;
        this.grazeUpdate(rt, dt, r, camels.isAdult(c) ? 11 : 16, () => {
          if (trough && this.rng() < 0.25) return { x: trough.x + 14 + this.rng() * 6, y: trough.y + 2, drink: true };
          return { x: r.x0 + this.rng() * (r.x1 - r.x0), y: r.y0 + this.rng() * (r.y1 - r.y0) };
        });
      }
      if (c.rare && this.rng() < dt * 3) this.fx.emit(...this.fx.at(rt.x + (this.rng() - 0.5) * 16, rt.y, 8 + this.rng() * 14), 0, -12, '#fff0a0', 0.8, 0, 1);
    }
  }

  // حركة الرعي: تتمشى، تختار مكان أكل، تمشي له، تنزل راسها تاكل شوي، وترجع تتمشى
  grazeUpdate(rt, dt, box, speed, pickSpot) {
    if (rt.eatT > 0) {
      rt.eatT -= dt;
      rt.moving = false;
      rt.eating = true;
      if (this.rng() < dt * 1.5) this.fx.emit(...this.fx.at(rt.x + rt.dir * 12, rt.y, 2), (this.rng() - 0.5) * 16, -14, rt.drinking ? '#9fd8f0' : '#7fb846', 0.6, 30, 1.5);
      if (rt.eatT <= 0) { rt.eating = false; rt.drinking = false; rt.wait = 1 + this.rng() * 3; }
      return;
    }
    rt.eating = false;
    const dx = rt.tx - rt.x, dy = rt.ty - rt.y, d = Math.hypot(dx, dy);
    rt.moving = d > 1;
    if (rt.moving) {
      const sp = speed * dt;
      rt.x += (dx / d) * Math.min(sp, d);
      rt.y += (dy / d) * Math.min(sp, d);
      if (Math.abs(dx) > 0.5) rt.dir = dx > 0 ? 1 : -1;
      return;
    }
    if (rt.goEat) {
      rt.goEat = false;
      rt.eatT = 3 + this.rng() * 4;
      return;
    }
    rt.wait = (rt.wait || 0) - dt;
    if (rt.wait > 0) return;
    if (this.rng() < 0.6) {
      const sp = pickSpot();
      if (sp) { rt.tx = sp.x; rt.ty = sp.y; rt.goEat = true; rt.drinking = !!sp.drink; return; }
    }
    rt.tx = Math.max(box.x0, Math.min(box.x1, rt.x + (this.rng() - 0.5) * 90));
    rt.ty = Math.max(box.y0, Math.min(box.y1, rt.y + (this.rng() - 0.5) * 60));
    rt.wait = 1 + this.rng() * 3;
  }

  // أماكن الرعي البرية: عشب الواحة والأعشاب والسدر والشجيرات، بعيد عن الأحواض والماي
  grazeSpots() {
    if (this.grazeCache) return this.grazeCache;
    const list = [];
    for (const o of this.world.objects) {
      if (o.kind === 'herb' || o.kind === 'sidr' || (o.kind === 'deco' && (o.variant === 0 || o.variant === 2))) list.push({ x: o.x + (o.kind === 'sidr' ? 14 : 8), y: o.y + 2 });
    }
    for (let ty = 0; ty < MAP_H; ty += 2) for (let tx = 0; tx < MAP_W; tx += 2) {
      if (tileAt(this.world.tiles, tx, ty) === T.GRASS) list.push({ x: tx * TILE + 8, y: ty * TILE + 10 });
    }
    this.grazeCache = list.filter(p => !(p.x > 40 * TILE && p.x < 53 * TILE && p.y > 29 * TILE && p.y < 36 * TILE));
    return this.grazeCache;
  }

  nearSpot(x, y, radius) {
    const c = this.grazeSpots().filter(p => Math.hypot(p.x - x, p.y - y) < radius);
    return c.length ? c[Math.floor(this.rng() * c.length)] : null;
  }

  // نياق القافلة ونياق الجيران البرية حول الواحة: زينة وحياة بالخريطة
  updateWildCamels(dt) {
    if (!this.wildRt) {
      const e = this.world.caravanEntry;
      const mk = (x, y, breed) => ({ x, y, tx: x, ty: y, wait: this.rng() * 2, dir: this.rng() < 0.5 ? 1 : -1, breed, home: { x, y } });
      this.wildRt = {
        caravan: [mk(e.x - 30, e.y + 22, 'shual'), mk(e.x + 36, e.y + 26, 'sufr')],
        herd: [mk(48 * TILE, 24 * TILE, 'wadh'), mk(50 * TILE, 26 * TILE, 'humr'), mk(58 * TILE, 15 * TILE, 'majaheem')],
      };
    }
    const water = (x, y) => SOLID_TILES.has(tileAt(this.world.tiles, Math.floor(x / TILE), Math.floor(y / TILE)));
    const step = (rt, rad, spotRad) => {
      const box = { x0: rt.home.x - rad, x1: rt.home.x + rad, y0: rt.home.y - rad * 0.6, y1: rt.home.y + rad * 0.6 };
      this.grazeUpdate(rt, dt, box, 12, () => this.nearSpot(rt.home.x, rt.home.y, spotRad));
      if (water(rt.tx, rt.ty)) { rt.tx = rt.x; rt.ty = rt.y; rt.goEat = false; }
    };
    if (this.guestRt.length) for (const rt of this.wildRt.caravan) step(rt, 70, 130);
    for (const rt of this.wildRt.herd) step(rt, 110, 150);
  }

  camelAction(c, rt) {
    const s = this.state;
    const day = s.time.day;
    const tgt = { x: rt.x, y: rt.y };
    this.input.action = false;
    if (!camels.isWatered(c, day) && count(s, 'water') > 0) {
      if (!this.spendEnergy(1)) return;
      this.startAnim('water', tgt, 0.8, 0.6, () => {
        camels.waterCamel(s, c.id, day);
        this.audio.play('water');
        this.fx.float(...this.fx.at(rt.x, rt.y, 28), '💧 شربت', '#b9f0ff', 12);
        this.gainXp(1, rt.x, rt.y, 38);
      });
      return;
    }
    if (!camels.isFed(c, day) && camels.feedItem(s)) {
      if (!this.spendEnergy(1)) return;
      this.startAnim('feed', tgt, 0.6, 0.45, () => {
        const it = camels.feed(s, c.id, day);
        this.audio.play('eat');
        this.fx.float(...this.fx.at(rt.x, rt.y, 28), it === 'alfalfa' ? '🌿 كلت برسيم' : '🟤 كلت تمر', '#d8ffb0', 12);
        this.fx.burst(...this.fx.at(rt.x + 8, rt.y, 8), ['#7fb846', '#4f8a2f'], 6, 30, 0.5);
        this.gainXp(2, rt.x, rt.y, 38);
      });
      return;
    }
    if (camels.canMilk(c, day)) {
      if (!this.spendEnergy(1)) return;
      this.startAnim('milk', tgt, 1.0, 0.8, () => {
        const n = camels.milk(s, c.id, day);
        this.audio.play('pick');
        this.fx.float(...this.fx.at(rt.x, rt.y, 28), `🥛 +${n}`, '#ffffff', 14);
        this.gainXp(3, rt.x, rt.y, 38);
        this.ui.refresh();
      });
      return;
    }
    this.audio.play('camel');
    this.ui.openCamels(c.id);
  }

  troughAction(o) {
    const s = this.state;
    if (s.trough.water >= 10) { this.input.action = false; this.fx.float(...this.fx.at(o.x, o.y, 20), 'الحوض مليان ✔', '#b9f0ff', 12); return; }
    if (count(s, 'water') < 1) { this.input.action = false; this.say('ما معك ماء! اسحب من البير واكبه بالحوض.'); return; }
    if (!this.spendEnergy(1)) return;
    this.startAnim('pour', { x: o.x, y: o.y - 2 }, 0.8, 0.62, () => {
      camels.fillTrough(s, 1);
      this.audio.play('water');
      this.fx.burst(...this.fx.at(o.x, o.y, 6), ['#6fb8e0', '#b6e6f6'], 8, 35, 0.4);
      this.fx.float(...this.fx.at(o.x, o.y, 22), `🏺 ${s.trough.water}/10`, '#b9f0ff', 12);
      this.gainXp(1, o.x, o.y, 32);
    });
  }

  giftStarterCamels() {
    const s = this.state;
    if (s.camels.length || s.flags.starterCamels) return;
    s.flags.starterCamels = true;
    s.camels.push(camels.makeCamel(s, this.rng, { sex: 'f', beauty: 45 }), camels.makeCamel(s, this.rng, { sex: 'm', beauty: 40 }));
    this.ui.dialogue([
      ['shepherd', 'مبروك المراح! هذي هدية مني: ناقة وفحل. اسقهم وأطعمهم كل يوم، ولقّح الناقة من "الحلال".'],
      ['lamp', 'وتدري؟ كل حوار يولد فيه فرصة 1 من 50 يطلع نادر... والنادرة تنباع بمئات الألوف! 🤑'],
    ]);
  }

  // ---------- السوق ----------
  // ---------- الفعاليات ----------
  eventMod(name) {
    return events.mod(this.state, this.now(), name);
  }

  // كنوز العاصفة ولمعات القمر: تنولد كل يوم لعبة بأماكن رمل حول المزرعة
  eventSpots() {
    const s = this.state;
    if (!s.event) return [];
    const buried = this.eventMod('buried');
    const moon = this.eventMod('moonSparkles');
    if (!buried && !(moon && time.isNight(s))) return [];
    const ev = s.event;
    if (ev.day !== s.time.day) {
      ev.day = s.time.day;
      const rng = mulberry32((s.seed ^ (s.time.day * 7919)) >>> 0);
      const list = [];
      for (let tries = 0; tries < 400 && list.length < (buried || moon); tries++) {
        const tx = 3 + Math.floor(rng() * (MAP_W - 6)), ty = 3 + Math.floor(rng() * (MAP_H - 6));
        const t = tileAt(this.world.tiles, tx, ty);
        if (t !== T.SAND && t !== T.SAND2) continue;
        list.push({ x: tx * TILE + 8, y: ty * TILE + 12, got: false });
      }
      ev.spots = { list };
    }
    return (ev.spots.list || []).filter(x => !x.got);
  }

  digTreasure(spot) {
    if (!this.spendEnergy(3)) return;
    this.startAnim('dig', spot, 0.9, 0.6, () => {
      spot.got = true;
      this.audio.play('chest');
      const n = events.addTokens(this.state, 1 + (this.rng() < 0.35 ? 1 : 0));
      this.fx.burst(...this.fx.at(spot.x, spot.y, 4), ['#e4bb76', '#ffd24a'], 16, 60, 0.7);
      this.fx.float(...this.fx.at(spot.x, spot.y, 24), `💰 +${n}`, '#ffd24a', 14);
      const loot = this.rng() < 0.3 ? { oldcoin: 1 } : { [pick(this.rng, ['stone', 'clay', 'dates', 'beans'])]: 2 };
      this.gainItems(loot, spot.x, spot.y, 36);
      this.ui.refresh();
    });
  }

  collectSparkle(spot) {
    spot.got = true;
    this.audio.play('magic');
    const n = events.addTokens(this.state, 1);
    this.fx.burst(...this.fx.at(spot.x, spot.y, 8), ['#fff6c0', '#b9d8ff'], 18, 50, 0.8);
    this.fx.float(...this.fx.at(spot.x, spot.y, 24), `⭐ +${n}`, '#fff6c0', 14);
    this.ui.refresh();
  }

  marketTick() {
    const s = this.state;
    const prevKey = s.event && s.event.key;
    const ev = events.ensureEvent(s, this.now());
    if (prevKey && prevKey !== ev.key) this.ui.toast(`🎪 فعالية جديدة: ${ev.def.icon} ${ev.def.name}!`, 'ach', 5);
    market.refreshDaily(s, s.time.day);
    const fresh = market.tick(s, this.now(), this.rng);
    for (const o of fresh) {
      const c = camels.camelById(s, o.camelId);
      this.audio.play('coin');
      this.ui.toast(`📩 ${o.buyer} يبي ${c ? c.name : 'ناقتك'} بـ ${market.fmt(o.amount)} درهم!`, o.amount > 20000 ? 'ach' : '', 4);
    }
    if (fresh.length) this.ui.refresh();
  }

  // ---------- الحركة والتصادم ----------
  movePlayer(dt) {
    const p = this.state.player;
    const m = this.input.move();
    this.moving = Math.hypot(m.x, m.y) > 0.1;
    if (!this.moving) return;
    const tired = p.energy <= 0 && this.mode === 'world';
    const sp = SPEED * (tired ? 0.6 : 1) * Math.min(1, Math.hypot(m.x, m.y) * 1.3);
    const len = Math.hypot(m.x, m.y) || 1;
    const vx = (m.x / len) * sp * dt, vy = (m.y / len) * sp * dt;
    if (Math.abs(m.x) > Math.abs(m.y)) p.dir = m.x > 0 ? 'right' : 'left';
    else p.dir = m.y > 0 ? 'down' : 'up';
    if (!this.blocked(p.x + vx, p.y)) p.x += vx;
    if (!this.blocked(p.x, p.y + vy)) p.y += vy;
  }

  blocked(x, y) {
    const pts = [[x - 4, y - 3], [x + 4, y - 3], [x - 4, y + 1], [x + 4, y + 1]];
    if (this.mode === 'dungeon') {
      return pts.some(([px, py]) => dTile(this.dungeon.tiles, Math.floor(px / TILE), Math.floor(py / TILE)) !== D.FLOOR);
    }
    if (this.mode === 'open') {
      if (pts.some(([px, py]) => SOLID_TILES.has(owTile(this.open.tiles, Math.floor(px / TILE), Math.floor(py / TILE))))) return true;
      for (const o of this.open.objects) {
        if (!o.solid) continue;
        const w = o.kind === 'farmhouse' ? 40 : 8, h = o.kind === 'farmhouse' ? 12 : 6;
        if (x + 4 > o.x - w / 2 && x - 4 < o.x + w / 2 && y + 1 > o.y - h + 4 && y - 3 < o.y + 4) return true;
      }
      return false;
    }
    for (const [px, py] of pts) {
      if (SOLID_TILES.has(this.tileAtWorld(Math.floor(px / TILE), Math.floor(py / TILE)))) return true;
    }
    for (const b of this.solidBoxes()) {
      if (x + 4 > b.x0 && x - 4 < b.x1 && y + 1 > b.y0 && y - 3 < b.y1) return true;
    }
    return false;
  }

  tileAtWorld(tx, ty) {
    const t = tileAt(this.world.tiles, tx, ty);
    if (t === T.RUBBLE) {
      if (ty === WALL_N.y && this.state.built.wall_n) return T.WALL;
      if (ty === KHAN.y1 && this.state.built.wall_s) return T.WALL;
    }
    return t;
  }

  solidBoxes() {
    const s = this.state;
    const key = Object.keys(s.built).length + ':' + s.time.day + ':' + Object.keys(s.nodes).length + ':' + (this.boxVersion || 0);
    if (this._boxKey === key) return this._boxes;
    const boxes = [];
    const box = (o, w, h, dy = 0) => boxes.push({ x0: o.x - w / 2, x1: o.x + w / 2, y0: o.y - h + dy, y1: o.y + dy });
    for (const o of this.world.objects) {
      switch (o.kind) {
        case 'palm': if (!this.depleted(o)) box(o, 8, 6); break;
        case 'rock': if (!this.depleted(o)) box(o, o.variant === 'big' ? 22 : 14, o.variant === 'big' ? 9 : 7); break;
        case 'sidr': if (!this.depleted(o)) box(o, 8, 6); break;
        case 'well': box(o, 20, 8); break;
        case 'station': box(o, o.station === 'hearth' ? 16 : 20, 6); break;
        case 'tent': box(o, 40, 10); break;
        case 'stall': box(o, 26, 7); break;
        case 'spot':
          if (s.built[o.spot] && ['kiln', 'mill', 'loom'].includes(o.spot)) box(o, 20, 7);
          if (s.built[o.spot] && o.spot === 'fountain') box(o, 30, 9);
          break;
        default: break;
      }
    }
    this._boxKey = key;
    this._boxes = boxes;
    return boxes;
  }

  placeAt(p) {
    this.state.player.x = p.x;
    this.state.player.y = p.y;
  }

  // ---------- الموارد ----------
  depleted(o) {
    const n = this.state.nodes[o.id];
    return !!(n && n.respawnDay && n.respawnDay > this.state.time.day);
  }

  nodeHits(o) {
    const n = this.state.nodes[o.id];
    return n && !(n.respawnDay > this.state.time.day) ? n.hits || 0 : 0;
  }

  // ---------- الهدف ----------
  interactables() {
    const s = this.state;
    const list = [];
    if (this.mode === 'dungeon') {
      const dg = this.dungeon;
      for (const e of dg.enemies) if (e.hp > 0) list.push({ kind: 'enemy', ref: e, x: e.x, y: e.y, r: 26 });
      for (const c of dg.chests) if (!c.opened) list.push({ kind: 'dchest', ref: c, x: c.x, y: c.y + 4 });
      list.push({ kind: 'stairsUp', x: dg.up.x, y: dg.up.y + 6 });
      if (dg.bossDead && dg.floor < 3) list.push({ kind: 'stairsDown', x: dg.down.x, y: dg.down.y + 6 });
      return list;
    }
    if (this.mode === 'open') {
      for (const o of this.open.objects) {
        if (o.kind === 'owner' || o.kind === 'gohome') list.push({ kind: o.kind, ref: o, x: o.x, y: o.y, r: 22 });
        if (o.kind === 'farmhouse' && farmsSys.farmState(s, o.farm).owned) list.push({ kind: 'farmstore', ref: o, x: o.x, y: o.y + 6, r: 26 });
      }
      return list;
    }
    for (const o of this.world.objects) {
      switch (o.kind) {
        case 'worldexit': list.push({ kind: 'worldexit', ref: o, x: o.x, y: o.y, r: 22 }); break;
        case 'palm': case 'sidr': case 'rock': case 'clay': case 'herb':
          if (!this.depleted(o)) list.push({ kind: o.kind, ref: o, x: o.x, y: o.y });
          break;
        case 'well': case 'station': case 'lamp':
          list.push({ kind: o.kind, ref: o, x: o.x, y: o.y });
          break;
        case 'plot':
          if (o.group === 1 || s.built.farm2) list.push({ kind: 'plot', ref: o, x: o.x, y: o.y });
          break;
        case 'spot': {
          const built = s.built[o.spot];
          if (built && o.spot === 'my_bed') list.push({ kind: 'bed', ref: o, x: o.x, y: o.y });
          else if (built && o.spot === 'crypt_door') list.push({ kind: 'crypt', ref: o, x: o.x, y: o.y });
          else if (built && BUILD_SPOTS[o.spot].station) list.push({ kind: 'station', ref: { ...o, station: BUILD_SPOTS[o.spot].station }, x: o.x, y: o.y });
          else if (!built) {
            const st = this.spotStatusFor(o.spot);
            if (o.spot === 'crypt_door' && st.hidden) list.push({ kind: 'sealed', ref: o, x: o.x, y: o.y });
            else if (!st.hidden) list.push({ kind: 'spot', ref: o, x: o.x, y: o.y });
          }
          break;
        }
        default: break;
      }
    }
    for (const c of s.groundChests || []) list.push({ kind: 'gchest', ref: c, x: c.x, y: c.y + 2 });
    for (const sp of this.eventSpots()) list.push({ kind: this.eventMod('buried') ? 'buried' : 'sparkle', ref: sp, x: sp.x, y: sp.y, r: 20 });
    if (s.built.trough) { const o = this.worldObjById['spot:trough']; list.push({ kind: 'trough', ref: o, x: o.x, y: o.y }); }
    for (const [spot, kind] of [['stall_shop', 'shop'], ['orders_board', 'orders'], ['workers_house', 'whouse']]) {
      if (s.built[spot]) { const o = this.worldObjById['spot:' + spot]; list.push({ kind, ref: o, x: o.x, y: o.y }); }
    }
    if (s.built.sheepfold && this.sheepRt) {
      for (const sh of s.sheep) { const rt = this.sheepRt[sh.id]; if (rt) list.push({ kind: 'sheep', ref: sh, rt, x: rt.x, y: rt.y, r: 18 }); }
    }
    if (s.built.stable && this.camelRt) {
      for (const c of s.camels) { const rt = this.camelRt[c.id]; if (rt) list.push({ kind: 'camel', ref: c, rt, x: rt.x, y: rt.y, r: 22 }); }
    }
    for (const [id, pos] of Object.entries(this.world.npcSpots)) {
      if (this.npcPresent(id)) list.push({ kind: 'npc', id, x: pos.x, y: pos.y });
    }
    if (this.wildRt) for (const rt of this.wildRt.herd) list.push({ kind: 'wildcamel', ref: rt, x: rt.x, y: rt.y, r: 22 });
    for (const g of this.guestRt) if (!g.leaving && !g.moving) list.push({ kind: 'guest', ref: g, x: g.x, y: g.y });
    return list;
  }

  findTarget() {
    const p = this.state.player;
    const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const [dx, dy] = dirs[p.dir];
    const probe = { x: p.x + dx * 10, y: p.y - 3 + dy * 10 };
    let best = null, bd = 1e9;
    for (const it of this.interactables()) {
      const d = Math.hypot(it.x - probe.x, it.y - 4 - probe.y);
      const dp = Math.hypot(it.x - p.x, it.y - p.y);
      const lim = it.r || 20;
      if ((d < lim || dp < 14) && Math.min(d, dp) < bd) { bd = Math.min(d, dp); best = it; }
    }
    return best;
  }

  npcPresent(id) {
    const n = NPCS[id];
    const s = this.state;
    const h = time.hour(s);
    return n.days.includes(time.weekday(s)) && h >= n.hours[0] && h < n.hours[1];
  }

  actionInfo(t) {
    if (!t) return this.mode === 'dungeon' ? { icon: '⚔️', label: 'اضرب' } : { icon: '✋', label: '' };
    const s = this.state;
    switch (t.kind) {
      case 'palm': return { icon: '🪓', label: 'اقطع النخلة' };
      case 'sidr': return { icon: '🪓', label: 'اقطع السدر' };
      case 'rock': return { icon: '⛏️', label: t.ref.variant === 'big' ? 'اكسر الصخرة' : 'اكسر' };
      case 'clay': return { icon: '🪏', label: 'احفر' };
      case 'herb': return { icon: '🌿', label: 'اقطف' };
      case 'well': return { icon: '🪣', label: 'اسحب ماء' };
      case 'station': return { icon: '🔨', label: 'اصنع' };
      case 'spot': return { icon: '🏗️', label: 'ابنِ' };
      case 'sealed': return { icon: '🔒', label: 'شوف' };
      case 'lamp': return { icon: '💬', label: 'كلّم' };
      case 'bed': return { icon: '😴', label: 'نام' };
      case 'crypt': return { icon: '⬇️', label: 'انزل' };
      case 'npc': return { icon: '🛒', label: 'بيع وشراء' };
      case 'wildcamel': return { icon: '🐪', label: 'ناقة الجيران' };
      case 'guest': return { icon: t.ref.served ? '💬' : '☕', label: 'قدّم' };
      case 'gchest': case 'dchest': return { icon: '📦', label: 'افتح' };
      case 'enemy': return { icon: '⚔️', label: 'اضرب' };
      case 'shop': return { icon: '🏪', label: 'البسطة' };
      case 'worldexit': return { icon: '🗺️', label: 'اطلع للقرية' };
      case 'buried': return { icon: '⛏️', label: 'احفر الكنز' };
      case 'sparkle': return { icon: '✨', label: 'اجمع' };
      case 'gohome': return { icon: '🏠', label: 'ارجع مزرعتي' };
      case 'owner': return { icon: '🤝', label: farmsSys.farmState(s, t.ref.farm).owned ? 'مزرعتك' : 'تفاوض' };
      case 'farmstore': return { icon: '📦', label: 'المخزن' };
      case 'orders': return { icon: '📋', label: 'الطلبات' };
      case 'whouse': return { icon: '👷', label: 'العمّال' };
      case 'sheep': {
        const sh = t.ref, day = s.time.day;
        if (sh.wateredDay !== day && count(s, 'water') > 0) return { icon: '💧', label: 'اسقِ' };
        if (sh.fedDay !== day && sheepSys.sheepFeedItem(s)) return { icon: '🌿', label: 'أطعم' };
        if (sheepSys.canShear(sh, day)) return { icon: '✂️', label: 'جز الصوف' };
        return { icon: '🐑', label: 'شوف' };
      }
      case 'trough': return s.trough.water >= 10 ? { icon: '✔', label: 'مليان' } : { icon: '🏺', label: 'كب ماء' };
      case 'camel': {
        const c = t.ref, day = s.time.day;
        if (!camels.isWatered(c, day) && count(s, 'water') > 0) return { icon: '💧', label: 'اسقِ' };
        if (!camels.isFed(c, day) && camels.feedItem(s)) return { icon: '🌿', label: 'أطعم' };
        if (camels.canMilk(c, day)) return { icon: '🥛', label: 'احلب' };
        return { icon: '🐪', label: c.name };
      }
      case 'stairsUp': return { icon: '⬆️', label: 'اطلع' };
      case 'stairsDown': return { icon: '⬇️', label: 'انزل' };
      case 'plot': {
        const p = s.plots[t.ref.id];
        if (!p) return { icon: '🌱', label: 'ازرع' };
        if (farming.isReady(p)) return { icon: '🧺', label: 'احصد' };
        if (!p.watered) return { icon: '💧', label: 'اسقِ' };
        return { icon: '⏳', label: 'يكبر' };
      }
      default: return { icon: '✋', label: '' };
    }
  }

  // ---------- الفعل ----------
  spendEnergy(n) {
    const p = this.state.player;
    if (p.energy < n) {
      this.audio.play('deny');
      this.ui.energyPrompt();
      this.input.action = false;
      return false;
    }
    p.energy -= n;
    return true;
  }

  doAction(t, fresh) {
    if (this.mode === 'dungeon' && (!t || t.kind === 'enemy')) { this.attack(t); return; }
    if (!t) return;
    // الأفعال اللي تفتح قوائم ما تتكرر بالضغط المطوّل
    const repeatable = ['palm', 'sidr', 'rock', 'clay', 'herb', 'well', 'plot', 'trough'].includes(t.kind);
    if (!fresh && !repeatable) return;
    switch (t.kind) {
      case 'palm': case 'sidr': case 'rock': case 'clay': case 'herb': this.gather(t.ref); break;
      case 'well': this.drawWater(t.ref); break;
      case 'station': this.input.action = false; this.ui.openCraft(t.ref.station); break;
      case 'spot': this.input.action = false; this.ui.openBuild(t.ref.spot); break;
      case 'sealed': this.input.action = false; this.ui.dialogue([['lamp', 'هذا باب السرداب... مقفول بطلاسم. لا تستعجل، أقول لك متى.']]); break;
      case 'lamp': this.input.action = false; this.talkLamp(); break;
      case 'bed': this.input.action = false; this.trySleep(); break;
      case 'crypt': this.input.action = false; this.enterCrypt(); break;
      case 'npc': this.input.action = false; this.talkNpc(t.id); break;
      case 'wildcamel': this.input.action = false; this.audio.play('camel'); this.ui.toast(t.ref.eating ? '🐪 ناقة الجيران ترعى… تبي نياق لك؟ اشترِ من 🛒 المتجر أو من القرية' : '🐪 هذي نياق الجيران. نياقك تشتريها من 🛒 المتجر أو من مزارع القرية', '', 3); break;
      case 'guest': this.input.action = false; this.serveGuest(t.ref); break;
      case 'gchest': this.input.action = false; this.openGroundChest(t.ref); break;
      case 'dchest': this.input.action = false; this.openDungeonChest(t.ref); break;
      case 'stairsUp': this.input.action = false; this.exitDungeon(); break;
      case 'stairsDown': this.input.action = false; this.enterFloor(this.dungeon.floor + 1); break;
      case 'plot': this.plotAction(t.ref); break;
      case 'trough': this.troughAction(t.ref); break;
      case 'sheep': this.sheepAction(t.ref, t.rt); break;
      case 'worldexit': this.input.action = false; this.travel('open'); break;
      case 'buried': this.input.action = false; this.digTreasure(t.ref); break;
      case 'sparkle': this.input.action = false; this.collectSparkle(t.ref); break;
      case 'gohome': this.input.action = false; this.travel('world'); break;
      case 'owner': this.input.action = false; this.audio.play('talk'); this.ui.openFarm(t.ref.farm); break;
      case 'farmstore': this.input.action = false; this.collectFarm(t.ref.farm); break;
      case 'shop': this.input.action = false; this.ui.openTrade('stall'); break;
      case 'orders': this.input.action = false; this.ui.openTrade('orders'); break;
      case 'whouse': this.input.action = false; this.ui.openWorkers(); break;
      case 'camel': this.camelAction(t.ref, t.rt); break;
      default: break;
    }
  }

  hitFx(o, color, n = 6) {
    this.swing = 0.25;
    this.shake = Math.max(this.shake, 2);
    o.shakeT = 0.15;
    this.fx.burst(...this.fx.at(o.x, o.y, 8), color, n, 50, 0.5);
    this.ui.vibrate(15);
  }

  gather(o) {
    const s = this.state;
    const tools = s.tech.t_tools ? 1 : 0;
    const specs = {
      palm: { hits: 3 - tools, cost: 3, sound: 'chop', color: ['#8a5a33', '#4f8a2f'], respawn: 2, stat: 'palms', kp: { n: 1 }, xp: 2 },
      sidr: { hits: 3 - tools, cost: 3, sound: 'chop', color: ['#6a4a2a', '#5a8a32'], respawn: 2, stat: 'sidr', kp: { n: 1 }, xp: 2 },
      rock: { hits: (o.variant === 'big' ? 4 : 3) - tools, cost: 3, sound: 'mine', color: ['#9c948a', '#c4bcb0'], respawn: 2, stat: 'rocks', kp: { c: 1 }, xp: o.variant === 'big' ? 3 : 2 },
      clay: { hits: 1, cost: 3, sound: 'dig', color: ['#9a5a35', '#5a3620'], respawn: 1, stat: 'clay', kp: {}, xp: 2 },
      herb: { hits: 1, cost: 1, sound: 'pick', color: ['#4f8a2f', '#e8e0f0'], respawn: 1, stat: 'herbs', kp: { n: 1 }, xp: 1 },
    }[o.kind];
    if (!this.spendEnergy(specs.cost)) return;
    const type = { palm: 'chop', sidr: 'chop', rock: 'mine', clay: 'dig', herb: 'pick' }[o.kind];
    this.startAnim(type, o, 0.32, 0.16, () => this.gatherHit(o, specs));
  }

  gatherHit(o, specs) {
    const s = this.state;
    this.audio.play(specs.sound);
    this.hitFx(o, specs.color);
    const n = s.nodes[o.id] && !(s.nodes[o.id].respawnDay > s.time.day) ? s.nodes[o.id] : { hits: 0 };
    n.hits = (n.hits || 0) + 1;
    s.nodes[o.id] = n;
    if (n.hits < specs.hits) return;
    // خلص المورد
    n.hits = 0;
    n.respawnDay = s.time.day + specs.respawn;
    this.boxVersion = (this.boxVersion || 0) + 1;
    const loot = {};
    if (o.kind === 'palm') { loot.wood = 2; loot.frond = randInt(this.rng, 1, 3); if (this.eventMod('datesBoost')) loot.dates = randInt(this.rng, 3, 5); else if (this.rng() < 0.45) loot.dates = randInt(this.rng, 1, 2); }
    if (o.kind === 'sidr') { loot.wood = randInt(this.rng, 2, 3); if (this.rng() < 0.4) loot.herb = 1; if (this.rng() < 0.35) loot.dates = randInt(this.rng, 1, 2); }
    if (o.kind === 'rock') { loot.stone = randInt(this.rng, 2, 3) + (o.variant === 'big' ? 2 : 0); if (this.rng() < (o.variant === 'big' ? 0.15 : 0.08)) loot.oldcoin = 1; }
    if (o.kind === 'clay') loot.clay = randInt(this.rng, 1, 2);
    if (o.kind === 'herb') { loot.herb = randInt(this.rng, 1, 2); if (this.rng() < 0.25) loot[pick(this.rng, ['seed_tomato', 'seed_wheat'])] = 1; }
    addStat(s, specs.stat, 1);
    for (const [k, v] of Object.entries(specs.kp)) s.kp[k] = (s.kp[k] || 0) + v;
    this.gainItems(loot, o.x, o.y, 14);
    this.gainXp(specs.xp, o.x, o.y, 24);
    if (this.rng() < GATHER_CHEST_CHANCE || (!s.flags.firstChest && (s.stats.palms || 0) + (s.stats.rocks || 0) >= 4)) {
      s.flags.firstChest = true;
      this.dropChest(o.x + 10, o.y + 4, rollChestRarity(this.rng));
    }
  }

  gainItems(loot, x, y, lift = 14) {
    let i = 0;
    for (const [id, n] of Object.entries(loot)) {
      add(this.state, id, n);
      this.fx.float(...this.fx.at(x, y, lift + i * 9), `${ITEMS[id].icon} +${n}`, '#fff3c4', 13);
      i++;
    }
    this.ui.refresh();
  }

  gainXp(n, x, y, lift = 24) {
    const res = applyReward(this.state, { xp: n }, this.rng);
    this.fx.float(...this.fx.at(x, y, lift), `+${n} ✨`, '#b9f0ff', 11);
    this.handleLevelUps(res);
  }

  handleLevelUps(res) {
    if (!res.levelUps.length) return;
    const p = this.state.player;
    this.audio.play('level');
    this.fx.confetti(...this.fx.at(p.x, p.y, 20));
    this.shake = 4;
    this.ui.levelUp(res.levelUps[res.levelUps.length - 1], res.levelGains || [], res.chests);
  }

  drawWater(o) {
    if (!this.spendEnergy(1)) return;
    this.startAnim('draw', o, 0.7, 0.55, () => {
      this.audio.play('water');
      this.hitFx(o, ['#57a9cf', '#a6def0'], 7);
      addStat(this.state, 'water', 1);
      this.gainItems({ water: 1 }, o.x, o.y, 26);
      if (this.rng() < 0.5) this.gainXp(1, o.x, o.y, 34);
    });
  }

  plotAction(o) {
    const s = this.state;
    const p = s.plots[o.id];
    if (!p) {
      const seed = farming.firstSeed(s);
      if (!seed) { this.say('ما عندك بذور! اشترِ من أبو سالم 🥕 جنب الأحواض، أو من 🛒 المتجر.'); this.input.action = false; return; }
      if (!this.spendEnergy(1)) return;
      this.startAnim('plant', o, 0.75, 0.5, () => {
        if (!farming.plant(s, o.id, seed)) return;
        if (this.rainLevel() > 0) { s.plots[o.id].watered = true; this.fx.float(...this.fx.at(o.x, o.y, 26), '🌧️ انسقى من المطر', '#b9f0ff', 11); }
        o.popT = this.t;
        this.audio.play('plant');
        this.fx.burst(...this.fx.at(o.x, o.y, 6), ['#7a4f2e', '#5e3b21'], 8, 30, 0.4);
        this.fx.burst(...this.fx.at(o.x, o.y, 8), ['#6cc24a'], 5, 25, 0.5);
        this.fx.float(...this.fx.at(o.x, o.y, 16), `🌱 ${SEEDS[seed].name}`, '#d8ffb0', 12);
        this.gainXp(2, o.x, o.y, 26);
      });
      return;
    }
    if (farming.isReady(p)) {
      if (!this.spendEnergy(1)) return;
      this.startAnim('harvest', o, 0.55, 0.35, () => {
        const h = farming.harvest(s, o.id, this.rng);
        if (!h) return;
        this.audio.play('pick');
        this.hitFx(o, ['#e6c050', '#d9401a', '#6cc24a'], 10);
        this.fx.float(...this.fx.at(o.x, o.y, 16), `${ITEMS[h.crop].icon} +${h.n}`, '#fff3c4', 13);
        s.kp.n = (s.kp.n || 0) + 1;
        this.gainXp(6, o.x, o.y, 28);
        this.ui.refresh();
      });
      return;
    }
    if (!p.watered) {
      if (count(s, 'water') < 1) { this.say('تحتاج ماء! اسحب من البير اللي بنص الخان.'); this.input.action = false; return; }
      if (!this.spendEnergy(1)) return;
      this.startAnim('water', o, 0.85, 0.65, () => {
        if (!farming.water(s, o.id)) return;
        o.wetT = this.t;
        this.audio.play('water');
        this.fx.burst(...this.fx.at(o.x, o.y, 6), ['#57a9cf', '#a6def0'], 10, 40, 0.5);
        this.gainXp(1, o.x, o.y, 20);
        this.ui.refresh();
      });
      return;
    }
    this.input.action = false;
    this.fx.float(...this.fx.at(o.x, o.y, 16), 'انسقى اليوم ✔', '#b9f0ff', 11);
  }

  say(text, who = 'lamp') {
    this.ui.toast(`${who === 'lamp' ? '🪔 زعبول: ' : ''}${text}`);
  }

  dropChest(x, y, rarity) {
    const s = this.state;
    s.groundChests = s.groundChests || [];
    s.groundChests.push({ x, y, rarity, t: this.t });
    this.audio.play('chest');
    this.fx.burst(...this.fx.at(x, y, 6), ['#ffd24a', '#fff6c0'], 16, 70, 0.8);
    this.fx.float(...this.fx.at(x, y, 22), 'صندوق كنز! 📦', '#ffd24a', 14);
  }

  async openGroundChest(c) {
    const s = this.state;
    s.groundChests = s.groundChests.filter(x => x !== c);
    await this.openChestFlow(c.rarity);
  }

  async openChestFlow(rarity) {
    const contents = rollChest(this.state, rarity, this.rng);
    this.audio.play('chest');
    const choice = await this.ui.chest(rarity, contents);
    const final = choice === 'x2' ? doubleReward(contents) : contents;
    addStat(this.state, 'chests', 1);
    this.claimReward(final, null, true);
  }

  // يطبق مكافأة ويعرضها
  claimReward(reward, title, quiet = false) {
    const res = applyReward(this.state, reward, this.rng);
    const p = this.state.player;
    if (reward.coins) this.audio.play('coin');
    this.fx.burst(...this.fx.at(p.x, p.y, 16), ['#ffd24a', '#fff6c0'], 14, 70, 0.7);
    if (!quiet || res.chests.length) this.ui.gains(title, res);
    else this.ui.gainToast(res.gains);
    this.handleLevelUps(res);
    this.ui.refresh();
    this.save();
    return res;
  }

  // ---------- الشخصيات ----------
  async talkLamp() {
    const s = this.state;
    const q = currentQuest(s);
    this.audio.play('magic');
    if (!s.flags.talked_lamp) {
      s.flags.talked_lamp = true;
      this.checkProgress();
      return;
    }
    const lines = [];
    if (q) lines.push(['lamp', `المهمة الحين: "${q.title}" — ${q.desc}`]);
    lines.push(['lamp', pick(this.rng, LAMP_IDLE)]);
    await this.ui.dialogue(lines);
    if (s.flags.lampGiftDay !== s.time.day) {
      s.flags.lampGiftDay = s.time.day;
      this.claimReward({ kp: { s: 1 } }, null, true);
      this.say('خذ نقطة أسرار... ولا تقول لأحد 🤫');
    }
  }

  talkNpc(id) {
    this.audio.play('talk');
    if (NPCS[id].veggie) { this.ui.openVeggie(); return; }
    this.ui.openShop(id);
  }

  serveGuest(g) {
    const s = this.state;
    if (g.served) { this.ui.toast(`${g.name}: ${pick(this.rng, GUEST_LINES.thanks)}`); return; }
    if (count(s, g.want) < 1) {
      this.audio.play('deny');
      this.ui.toast(`${g.name}: ${pick(this.rng, GUEST_LINES.noItem)} (يبي ${ITEMS[g.want].icon} ${ITEMS[g.want].name})`);
      return;
    }
    add(s, g.want, -1);
    g.served = true;
    const pay = Math.round(ITEMS[g.want].price * 2.4 * coinMultiplier(s) * (g.golden ? 3 : 1)) + stars(s) * 2;
    addStat(s, 'guests', 1);
    this.audio.play('coin');
    this.fx.burst(...this.fx.at(g.x, g.y, 20), ['#ff6a8a', '#ffd24a'], 12, 60, 0.7);
    this.fx.float(...this.fx.at(g.x, g.y, 30), '❤️', '#ff6a8a', 16);
    const res = applyReward(s, { coins: pay, xp: 3 }, this.rng);
    this.fx.float(...this.fx.at(g.x, g.y, 42), `🪙 +${pay}`, '#ffd24a', 15);
    if (this.rng() < 0.3) s.kp.c = (s.kp.c || 0) + 1;
    this.ui.toast(`${g.name}: ${pick(this.rng, GUEST_LINES.thanks)}`);
    this.handleLevelUps(res);
    setTimeout(() => { g.leaving = true; }, 2500);
    this.ui.refresh();
  }

  // ---------- القوافل ----------
  guestWantPool() {
    const s = this.state;
    return GUEST_WANTS.filter(w => {
      if (w === 'bread') return !!s.tech.t_bread;
      if (w === 'melon') return !!s.tech.t_melon;
      if (w === 'coffee2') return !!s.tech.t_coffee2;
      if (w === 'pressed') return !!s.tech.t_pressed;
      if (w === 'tomato') return (s.stats.planted || 0) > 0;
      return true;
    });
  }

  spawnCaravan() {
    const s = this.state;
    s.guests.day = s.time.day;
    const st = stars(s);
    const golden = s.quest.index > 5 && this.rng() < 0.12;
    const n = Math.min(this.world.guestSpots.length, 2 + st + (s.built.stable ? 1 : 0));
    const spots = [...this.world.guestSpots].sort(() => this.rng() - 0.5).slice(0, n);
    const pool = this.guestWantPool();
    this.guestRt = spots.map((spot, i) => ({
      id: 'g' + s.time.day + '_' + i,
      name: golden && i === 0 ? '✨ تاجر القافلة الذهبية' : pick(this.rng, GUEST_NAMES),
      look: Math.floor(this.rng() * GUEST_LOOKS.length),
      want: pick(this.rng, pool),
      served: false, golden: golden && i === 0,
      x: this.world.caravanEntry.x + (i % 3) * 8, y: this.world.caravanEntry.y + Math.floor(i / 3) * 8,
      spot, dir: 'up',
    }));
    if (s.quest.index >= 4) this.ui.toast(golden ? '🐪✨ قافلة ذهبية وصلت! تاجرها يدفع ثلاث أضعاف!' : `🐪 قافلة وصلت فيها ${n} ضيوف!`);
  }

  restoreGuests() {
    const s = this.state;
    this.guestRt = (s.guests.list || []).filter(g => !g.gone).map(g => ({ ...g, x: g.spot.x, y: g.spot.y, leaving: g.leaving }));
  }

  // ---------- النوم والأيام ----------
  async trySleep() {
    const s = this.state;
    const h = time.hour(s);
    const tired = s.player.energy < maxEnergy(s) * 0.4;
    if (!(h >= 17 || h < 5 || tired)) {
      this.ui.toast('🪔 زعبول: النوم الحين؟ الشمس فوق راسك! نام بعد العصر أو إذا تعبت.');
      return;
    }
    await this.ui.fadeSleep();
    const nd = time.sleepUntilMorning(s);
    if (nd) this.onNewDay(nd);
    s.player.energy = maxEnergy(s);
    s.player.hp = maxHp(s);
    this.fx.float(...this.fx.at(s.player.x, s.player.y, 24), '⚡ طاقة كاملة', '#ffe07a', 14);
    this.save();
  }

  onNewDay(n) {
    const s = this.state;
    farming.growPlots(s, n);
    addStat(s, 'days', n);
    const births = [];
    for (let d = s.time.day - n + 1; d <= s.time.day; d++) births.push(...camels.dailyUpdate(s, d, this.rng));
    for (let d = s.time.day - n + 1; d <= s.time.day; d++) sheepSys.sheepDaily(s, d);
    let lucky = 0;
    for (let i = 0; i < n; i++) lucky += camels.luckyIncome(s, this.rng);
    if (lucky) this.ui.toast(`🍀 ناقتك المبروكة جابت لك رزق: 🪙${lucky}`, 'gain', 4);
    if (farmsSys.farmDaily(s, s.time.day).length) this.ui.toast('🏡 مزارعك أنتجت! روح لمخازنها بالقرية واستلم', 'gain', 4);
    for (const calf of births) {
      if (calf.rare) {
        this.audio.play('rare');
        this.claimReward({ chest: 'rare' }, null, true);
        this.ui.rareBirth(calf);
      } else {
        const rt = (calf.traits || []).find(t => TRAITS[t] && TRAITS[t].tier === 'rare');
        if (rt) {
          this.audio.play('rare');
          this.ui.toast(`🌟 حوار بخاصية نادرة! ${calf.name}: ${TRAITS[rt].icon} ${TRAITS[rt].name} — ${TRAITS[rt].desc}`, 'gain', 6);
          addStat(s, 'rareTraits', 1);
        } else {
          this.audio.play('camel');
          this.ui.toast(`🐪 مبروك! ولد لك حوار (${camelBreedName(calf)}): ${calf.name}`, 'gain', 4);
        }
      }
    }
    if (s.camels.length && s.built.trough && s.trough.water <= 0) this.ui.toast('🏺 حوض الماء نشف! النياق عطشانة', '', 4);
    this.guestRt.forEach(g => { g.gone = true; });
    this.guestRt = [];
    s.guests.list = [];
    const rooms = roomsBuilt(s);
    if (rooms) {
      const coins = Math.round(rooms * (14 + stars(s) * 5) * coinMultiplier(s) * n);
      const res = applyReward(s, { coins }, this.rng);
      this.ui.toast(`🛏️ ضيوف الغرف باتوا عندك ودفعوا ${coins} درهم`);
      this.handleLevelUps(res);
    }
    retention.ensureDailyQuests(s, this.now());
    this.ui.toast(`🌅 صباح الخير! اليوم ${WEEKDAYS[time.weekday(s)]}`);
    this.ui.refresh();
  }

  // ---------- المهام والإنجازات ----------
  async checkProgress() {
    if (this.checking) return;
    const s = this.state;
    const q = checkQuest(s);
    if (q) {
      this.checking = true;
      this.audio.play('magic');
      await this.ui.dialogue(q.end);
      this.claimReward(q.reward, `✅ ${q.title}`);
      this.checking = false;
      const nxt = currentQuest(s);
      if (nxt) this.ui.toast(`📜 مهمة جديدة: ${nxt.title}`);
      this.ui.refresh();
    }
    for (const c of retention.claimableAchievements(s)) {
      const k = c.ach.stat + c.tier;
      if (!this.notifiedAch.has(k)) {
        this.notifiedAch.add(k);
        this.ui.achievementToast(c.ach, c.tier);
      }
    }
  }

  // ---------- الطاقة والإعلانات ----------
  async watchAd(placement) {
    const s = this.state;
    if (!retention.consumeAd(s, this.now())) { this.ui.toast('خلصت إعلانات اليوم، ارجع بكرة 🌙'); return false; }
    this.audio.suspend();
    const ok = await showRewardedAd(placement);
    this.audio.resume();
    if (!ok) { s.daily.adsCount = Math.max(0, s.daily.adsCount - 1); this.ui.toast('الإعلان ما كمل، ما صارت المكافأة'); }
    this.save();
    return ok;
  }

  eat(id) {
    const s = this.state;
    const it = ITEMS[id];
    if (!it || !it.food || count(s, id) < 1) return false;
    add(s, id, -1);
    s.player.energy = Math.min(maxEnergy(s), s.player.energy + it.food);
    this.audio.play('eat');
    this.fx.float(...this.fx.at(s.player.x, s.player.y, 24), `⚡ +${it.food}`, '#ffe07a', 14);
    this.ui.refresh();
    return true;
  }

  // ---------- البناء ----------
  doBuild(spotId) {
    const s = this.state;
    if (!this.spendEnergy(5)) return false;
    const b = build(s, spotId);
    if (!b) { s.player.energy += 5; return false; }
    const o = this.worldObjById['spot:' + spotId];
    this.audio.play('build');
    this.shake = 5;
    this.fx.burst(...this.fx.at(o.x, o.y, 8), ['#d4a46b', '#b07e4c', '#fff3c4'], 30, 90, 0.9);
    this.fx.float(...this.fx.at(o.x, o.y, 30), b.rating ? `⭐ سمعة +${b.rating}` : '🔨 تم البناء', '#ffd24a', 15);
    this.tileDirty = true;
    this.boxVersion = (this.boxVersion || 0) + 1;
    this.gainXp(10 + b.rating, o.x, o.y, 42);
    if (spotId === 'stable') this.giftStarterCamels();
    this.ui.refresh();
    this.save();
    this.checkProgress();
    return true;
  }

  // ---------- السرداب ----------
  maxFloorAllowed() {
    const s = this.state;
    if (s.flags.boss2 && s.tech.t_crypt3) return 3;
    if (s.flags.boss1 && s.tech.t_crypt2) return 2;
    return 1;
  }

  async enterCrypt() {
    const max = this.maxFloorAllowed();
    let floor = 1;
    if (max > 1) floor = await this.ui.chooseFloor(max);
    if (!floor) return;
    this.enterFloor(floor);
  }

  enterFloor(floor) {
    const s = this.state;
    if (floor > this.maxFloorAllowed()) {
      const need = floor === 2 ? 'طلاسم الطابق الثاني' : 'طلاسم الطابق الثالث';
      this.ui.toast(`🔒 تحتاج تتعلم "${need}" من المعرفة`);
      return;
    }
    const bossDead = !!s.flags['boss' + floor];
    const seed = (s.seed + floor * 7919 + (s.stats.dives || 0) * 104729) >>> 0;
    const fl = generateFloor(floor, seed, bossDead);
    addStat(s, 'dives', 1);
    this.dungeon = {
      floor, ...fl, bossDead,
      enemies: fl.enemies.map(e => {
        const def = ENEMIES[e.type];
        return { ...e, def, hp: def.hp + (floor - 1) * (def.boss ? 0 : 2), maxHp: def.hp + (floor - 1) * (def.boss ? 0 : 2), cd: 0, hurt: 0, vx: 0, vy: 0, wander: 0 };
      }),
      chests: fl.chests.map(c => ({ ...c, opened: false })),
    };
    this.mode = 'dungeon';
    s.location = 'dungeon';
    this.placeAt(fl.start);
    s.player.hp = Math.max(s.player.hp, Math.ceil(maxHp(s) / 2));
    this.audio.play('magic');
    this.ui.toast(`🕯️ السرداب — الطابق ${['', 'الأول', 'الثاني', 'الثالث'][floor]}`);
    this.ui.refresh();
  }

  exitDungeon() {
    const s = this.state;
    this.mode = 'world';
    s.location = 'world';
    this.dungeon = null;
    this.placeAt(this.world.cryptExit);
    s.player.dir = 'down';
    this.ui.refresh();
    this.save();
  }

  attack(t) {
    const s = this.state;
    this.swing = 0.22;
    this.audio.play('swing');
    const p = s.player;
    let e = t && t.kind === 'enemy' ? t.ref : null;
    if (!e) {
      let bd = 26;
      for (const en of this.dungeon.enemies) {
        const d = Math.hypot(en.x - p.x, en.y - p.y);
        if (en.hp > 0 && d < bd + en.def.r) { bd = d; e = en; }
      }
    }
    if (!e) return;
    const dmg = attackPower(s);
    e.hp -= dmg;
    e.hurt = 0.15;
    const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
    const kb = e.def.boss ? 4 : 8;
    this.tryMoveEnemy(e, ((e.x - p.x) / d) * kb, ((e.y - p.y) / d) * kb);
    this.audio.play('hit');
    this.shake = 2;
    this.fx.burst(...this.fx.at(e.x, e.y, 8), ['#ffffff', '#ffd24a'], 6, 60, 0.4);
    this.fx.float(...this.fx.at(e.x, e.y, 22), `-${dmg}`, '#ff8080', 13);
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    const s = this.state;
    addStat(s, 'kills', 1);
    this.fx.burst(...this.fx.at(e.x, e.y, 8), ['#5a2a1a', '#8f8a70', '#fff6c0'], 18, 80, 0.8);
    this.gainXp(e.def.xp, e.x, e.y, 30);
    const loot = {};
    if (e.def.drop && !e.def.boss && this.rng() < 0.5) loot[e.def.drop] = 1;
    if (this.rng() < 0.3) loot.oldcoin = 1;
    if (Object.keys(loot).length) this.gainItems(loot, e.x, e.y, 16);
    if (this.rng() < 0.45) s.kp.s = (s.kp.s || 0) + 1;
    if (this.eventMod('dungeonTokens')) { events.addTokens(s, e.def.boss ? 5 : 1); this.fx.float(...this.fx.at(e.x, e.y, 40), '⭐ +1', '#fff6c0', 12); }
    if (!e.def.boss && this.rng() < 0.06) {
      const missing = Object.keys(RELICS).filter(id => !s.relics[id] && RELICS[id].set !== 'salem');
      if (missing.length) this.claimReward({ relic: pick(this.rng, missing) }, '🏺 لقيت تحفة!');
    }
    if (e.def.boss) {
      s.flags['boss' + e.def.boss] = true;
      this.dungeon.bossDead = true;
      this.shake = 8;
      this.fx.confetti(...this.fx.at(e.x, e.y, 10));
      this.dungeon.chests.push({ x: e.x, y: e.y, rarity: 'rare', opened: false });
      this.claimReward({ relic: e.def.drop, coins: 60 * e.def.boss }, `🏆 هزمت ${e.def.name}!`);
      this.checkProgress();
    }
  }

  async openDungeonChest(c) {
    c.opened = true;
    await this.openChestFlow(c.rarity);
  }

  tryMoveEnemy(e, vx, vy) {
    const r = 4;
    const free = (x, y) => [[x - r, y - r], [x + r, y - r], [x - r, y], [x + r, y]].every(([px, py]) => dTile(this.dungeon.tiles, Math.floor(px / TILE), Math.floor(py / TILE)) === D.FLOOR);
    if (free(e.x + vx, e.y)) e.x += vx;
    if (free(e.x, e.y + vy)) e.y += vy;
  }

  updateDungeon(dt) {
    const s = this.state;
    const p = s.player;
    for (const e of this.dungeon.enemies) {
      if (e.hp <= 0) continue;
      e.hurt = Math.max(0, e.hurt - dt);
      e.cd = Math.max(0, e.cd - dt);
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d < 120) {
        const sp = e.def.speed * dt * (e.hurt > 0 ? 0.2 : 1);
        this.tryMoveEnemy(e, (dx / d) * sp, (dy / d) * sp);
        e.face = dx > 0 ? 1 : -1;
      } else {
        e.wander -= dt;
        if (e.wander <= 0) { e.wander = 1 + this.rng() * 2; const a = this.rng() * Math.PI * 2; e.vx = Math.cos(a) * 12; e.vy = Math.sin(a) * 12; }
        this.tryMoveEnemy(e, e.vx * dt, e.vy * dt);
      }
      if (d < e.def.r + 6 && e.cd <= 0 && this.hurtT <= 0) {
        e.cd = 0.9;
        this.hurtT = 0.7;
        p.hp -= e.def.dmg;
        this.audio.play('hurt');
        this.shake = 5;
        this.ui.vibrate(60);
        this.fx.float(...this.fx.at(p.x, p.y, 26), `-${e.def.dmg} ❤️`, '#ff5050', 14);
        const k = 18 / (d || 1);
        const ox = p.x, oy = p.y;
        if (!this.blocked(p.x + dx * k, p.y)) p.x += dx * k;
        if (!this.blocked(p.x, p.y + dy * k)) p.y += dy * k;
        if (Number.isNaN(p.x) || Number.isNaN(p.y)) { p.x = ox; p.y = oy; }
        if (p.hp <= 0) this.playerDown();
      }
    }
  }

  async playerDown() {
    const s = this.state;
    s.player.hp = 0;
    const choice = await this.ui.downPrompt();
    if (choice === 'revive') {
      s.player.hp = maxHp(s);
      this.hurtT = 2;
      this.fx.burst(...this.fx.at(s.player.x, s.player.y, 10), ['#7fb2ff', '#fff'], 30, 80, 1);
      this.ui.refresh();
      return;
    }
    this.exitDungeon();
    this.placeAt({ x: this.worldObjById['spot:my_bed'].x, y: this.worldObjById['spot:my_bed'].y + 10 });
    const nd = time.sleepUntilMorning(s);
    if (nd) this.onNewDay(nd);
    s.player.hp = maxHp(s);
    s.player.energy = Math.round(maxEnergy(s) * 0.5);
    this.ui.dialogue([['lamp', 'لقيتك طايح بالسرداب وسحبتك لفراشك. لا تشكرني... بس لا تعيدها.']]);
  }
}

export { MAIN_QUESTS, MAP_W, MAP_H, DW, DH, TILE };
