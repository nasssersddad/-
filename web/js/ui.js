// الواجهة: الشريط العلوي، الحوار، النوافذ، المكافآت
import { ITEMS, RELICS, RELIC_SETS, SEEDS, itemIcon, itemName } from './data/items.js';
import * as farming from './systems/farming.js';
import * as placement from './systems/placement.js';
import { PLACEABLES } from './data/buildings.js';
import { installHub, advice } from './hub.js';
import { RECIPES, STATIONS, BUILD_SPOTS } from './data/recipes.js';
import { TECH, TECH_BY_ID, KP_TYPES } from './data/tech.js';
import { NPCS, WEEKDAYS, WEEKDAY_ICONS } from './data/npcs.js';
import { MAIN_QUESTS } from './data/quests.js';
import { DAILY_CALENDAR, WHEEL, CHESTS, ACHIEVEMENTS, ACH_TIER_NAMES, ACH_TIER_REWARDS, DAILY_QUEST_BONUS, AD_PLACEMENTS, AD_SECONDS } from './data/rewards.js';
import { count, has, add, addStat, bagUsed, bagCap, stored } from './systems/inventory.js';
import { recipesFor, craft, spotStatus, techStatus, learnTech } from './systems/crafting.js';
import { xpForLevel, maxEnergy, maxHp, stars, rating, nextStarAt, completedSets, offlineMultiplier } from './systems/progression.js';
import { describeReward, applyReward } from './systems/rewards.js';
import * as retention from './systems/retention.js';
import { currentQuest } from './systems/quests.js';
import * as time from './systems/time.js';
import { SAVE_KEY } from './systems/state.js';
import { character, PLAYER_LOOK, DJINN_LOOK, SALEM_LOOK } from './engine/art.js';
import { setAdSimulator } from './systems/ads.js';
import * as workersSys from './systems/workers.js';
import * as shop from './systems/shop.js';
import * as sheepSys from './systems/sheep.js';
import { WORKER_TYPES, WORKER_LOOKS, STRIKE_AFTER } from './data/workers.js';
import { SHEEP_BREEDS, SHEEP_CAP } from './data/sheep.js';
import { FARMS } from './data/openworld.js';
import * as farmsSys from './systems/farms.js';
import { PERSONAS } from './systems/market.js';
import * as events from './systems/events.js';
import { EVENTS, TRACK_REWARDS, TRACK_COSTS } from './data/events.js';
import { camelSprite } from './engine/art.js';
import * as art from './engine/art.js';
import * as camels from './systems/camels.js';
import * as market from './systems/market.js';
import { BREEDS, RARES, camelColors, camelBreedName, GESTATION_DAYS, TROUGH_CAP, TRAITS } from './data/camels.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SPEAKERS = {
  lamp: { name: 'زعبول', look: DJINN_LOOK },
  salem: { name: 'العم سالم', look: SALEM_LOOK },
  player: { name: 'أنت', look: PLAYER_LOOK },
  narrator: { name: '', look: null },
};

export class UI {
  constructor(audio) {
    this.audio = audio;
    this.modals = [];
    this.dialogOpen = false;
    this.fading = false;
    this.speaker = null;
    this.last = {};
    this.dirty = true;
  }

  bind(game) {
    this.g = game;
    document.querySelectorAll('[data-open]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audio.play('ui');
        const k = el.dataset.open;
        if (k === 'rewards') this.openRewards();
        else if (k === 'rewards-dq') this.openRewards('dq');
        else if (k === 'inventory') this.openInventory();
        else if (k === 'tech') this.openTech();
        else if (k === 'relics') this.openRelics();
        else if (k === 'settings') this.openSettings();
        else if (k === 'quest') this.openQuests();
        else if (k === 'camels') this.openCamels();
        else if (k === 'workers') this.openWorkers();
        else if (k === 'trade') this.openTrade();
        else if (k === 'events') this.openEvents();
        else if (k === 'store') this.openStore();
        else if (k === 'store-sell') this.openStore('seeds');
        else if (k === 'manage') this.openManage();
        else if (k === 'map') this.openMap();
        else if (k === 'help') this.openHelp();
      });
      el.addEventListener('pointerdown', e => e.stopPropagation());
    });
    $('eatBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); this.quickEat(); });
    $('bldChip').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (this.chipPid) this.openPlacedMenu(this.chipPid); });
    const pb = (id, fn) => { $(id).addEventListener('pointerdown', e => e.stopPropagation()); $(id).addEventListener('click', (e) => { e.stopPropagation(); fn(); }); };
    pb('pbOk', () => this.g.confirmPlacing());
    pb('pbFlip', () => { this.audio.play('ui'); this.g.flipPlacing(); });
    pb('pbCancel', () => { this.audio.play('ui'); this.g.stopPlacing(); });
    $('placeBar').addEventListener('pointerdown', e => e.stopPropagation());
    $('seedChip').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const id = farming.cycleSeed(this.g.state);
      if (id) { this.audio.play('ui'); this.toast(`🌰 الحين تزرع: ${SEEDS[id].name} (عندك ${count(this.g.state, id)})`, '', 1.6); }
      else this.openVeggie();
    });
    $('dialog').addEventListener('pointerdown', (e) => { e.stopPropagation(); this.advance(); });
    window.addEventListener('keydown', (e) => {
      if (this.dialogOpen && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) this.advance();
      if (e.code === 'Escape' || e.code === 'Backspace') this.back();
    });
    setAdSimulator((p) => this.adSimulator(p));
    this.applyTextSize();
    this.refresh();
  }

  blocking() {
    return this.modals.length > 0 || this.dialogOpen || this.fading;
  }

  // زر الرجوع بالأندرويد: يسكّر النافذة المفتوحة. يرجع true إذا تعامل معه
  back() {
    if (this.dialogOpen) { this.advance(); return true; }
    const top = this.modals[this.modals.length - 1];
    if (top && top.closable) { top.close(); return true; }
    return !!top;
  }

  refresh() { this.dirty = true; }

  vibrate(ms) {
    if (this.g && this.g.state && this.g.state.settings.vibrate === false) return;
    try {
      if (window.MuzareNative && window.MuzareNative.vibrate) window.MuzareNative.vibrate(ms);
      else if (navigator.vibrate) navigator.vibrate(ms);
    } catch { /* ما يهم */ }
  }

  // ---------- الشريط العلوي (كل إطار) ----------
  hud() {
    const g = this.g;
    const s = g.state;
    const p = s.player;
    const set = (id, v) => { if (this.last[id] !== v) { this.last[id] = v; $(id).textContent = v; } };
    const width = (id, v) => { if (this.last[id] !== v) { this.last[id] = v; $(id).style.width = v; } };
    set('lvl', p.level);
    const need = xpForLevel(p.level);
    width('xpFill', Math.min(100, (p.xp / need) * 100) + '%');
    set('xpText', `${p.xp}/${need}`);
    const me = maxEnergy(s);
    width('enFill', Math.max(0, (p.energy / me) * 100) + '%');
    set('enText', `⚡ ${Math.floor(p.energy)}/${me}`);
    const mh = maxHp(s);
    width('hpFill', Math.max(0, (p.hp / mh) * 100) + '%');
    set('hpText', `❤️ ${Math.max(0, p.hp)}/${mh}`);
    if (this.last.coinsVal !== p.coins) {
      if (this.last.coinsVal !== undefined && p.coins > this.last.coinsVal) {
        $('coins').parentElement.classList.remove('pop');
        void $('coins').offsetWidth;
        $('coins').parentElement.classList.add('pop');
      }
      this.last.coinsVal = p.coins;
      $('coins').textContent = p.coins.toLocaleString('en');
    }
    const wd = time.weekday(s);
    set('dayName', `${WEEKDAY_ICONS[wd]} ${WEEKDAYS[wd]}`);
    const rainy = g.rainLevel && g.rainLevel() > 0;
    const wxIcon = g.mode === 'dungeon' ? '' : rainy ? ' 🌧️' : g.rainbowLevel && g.rainbowLevel() > 0 ? ' 🌈' : time.isNight(s) ? ' 🌙' : ' ☀️';
    set('clock', time.clockText(s) + wxIcon);
    const st = stars(s);
    const starsHtml = '★'.repeat(st) + `<span class="off">${'★'.repeat(5 - st)}</span>`;
    if (this.last.stars !== starsHtml) { this.last.stars = starsHtml; $('stars').innerHTML = starsHtml; }
    document.getElementById('game').classList.toggle('dungeon', g.mode === 'dungeon');

    const info = g.actionInfo(g.target);
    set('actIcon', info.icon);
    set('actLabel', info.label);
    $('actionBtn').classList.toggle('pulse', !!g.target);
    if (g.placing) {
      const pl = g.placing;
      set('pbName', `${PLACEABLES[pl.type].icon} ${placement.info(pl.type).name}`);
      const ok = pl.check && pl.check.ok;
      set('pbReason', ok ? '✅ المكان يصلح' : '❌ ' + (pl.check ? pl.check.reason : ''));
      $('pbReason').className = ok ? 'ok' : 'bad';
    }
    // زر 🔧 لإدارة المبنى أو الديكور اللي جنبك
    let chip = null;
    if (g.mode === 'world' && !g.placing) {
      const tg = g.target;
      if (tg && tg.ref && tg.ref.dynamic && (tg.kind !== 'spot')) chip = tg.ref.pid;
      else {
        const px = Math.floor(s.player.x / 16), py = Math.floor(s.player.y / 16);
        const near = (s.placed || []).find(q => { const f = placement.footprint(q); return px >= f.x0 - 1 && px <= f.x1 + 1 && py >= f.y0 - 1 && py <= f.y1 + 1 && (placement.isBuilt(s, q)); });
        if (near) chip = near.id;
      }
    }
    this.chipPid = chip;
    $('bldChip').classList.toggle('show', !!chip);
    const nearPlot = g.mode === 'world' && g.target && g.target.kind === 'plot' && !s.plots[g.target.ref.id];
    $('seedChip').classList.toggle('show', !!nearPlot);
    if (nearPlot) {
      const sd = farming.firstSeed(s);
      set('seedIcon', sd ? ITEMS[SEEDS[sd].crop].icon : '🛒');
      set('seedName', sd ? `${SEEDS[sd].name} ×${count(s, sd)} 🔄` : 'اشترِ بذور');
    }

    const bu = bagUsed(s), bc = bagCap(s);
    set('bagTxt', `${bu}/${bc}`);
    $('bagBtn').classList.toggle('full', bu >= bc * 0.9);
    if (this.dirty || (Math.floor(g.t * 2) !== this.last.halfSec)) {
      this.last.halfSec = Math.floor(g.t * 2);
      this.dirty = false;
      const now = g.now();
      const pend = retention.pendingRewardsCount(s, now);
      const b = $('badgeRewards');
      b.textContent = pend;
      b.classList.toggle('on', pend > 0);
      $('badgeTech').classList.toggle('on', TECH.some(t => techStatus(s, t.id) === 'ready'));
      const strikers = s.workers.filter(w => w.status === 'strike' || w.late >= 2).length;
      $('badgeWorkers').textContent = strikers ? '!' : '';
      $('badgeWorkers').classList.toggle('on', strikers > 0);
      const nowMin = g.absMinutes();
      const tradeReady = s.stall.slots.filter(x => x && x.sold).length + (s.built.orders_board ? s.orders.filter(o => shop.canFulfill(s, o, nowMin)).length : 0);
      $('badgeTrade').textContent = tradeReady;
      $('badgeTrade').classList.toggle('on', tradeReady > 0);
      events.ensureEvent(s, g.now());
      const evReady = events.canClaimTier(s) || (EVENTS.find(e => e.id === s.event.id).game && events.playsLeft(s, g.now()) > 0);
      $('badgeEvents').textContent = evReady ? '!' : '';
      $('badgeEvents').classList.toggle('on', !!evReady);
      const adv = advice(g).filter(a => !a.go.travel).length;
      $('badgeManage').textContent = adv;
      $('badgeManage').classList.toggle('on', adv > 0);
      const offers = market.openOffersCount(s);
      $('badgeCamels').textContent = offers;
      $('badgeCamels').classList.toggle('on', offers > 0);
      const q = currentQuest(s);
      const qt = q ? q.title : 'خلصت القصة! 🎉';
      if (this.last.qTitle !== qt) {
        this.last.qTitle = qt;
        $('qTitle').textContent = qt;
        $('quest').classList.remove('flash'); void $('quest').offsetWidth; $('quest').classList.add('flash');
      }
      set('qDesc', q ? q.desc : 'كمّل المكافآت اليومية والتحف والإنجازات.');
      const dq = s.daily.dq.map(d => {
        const pr = retention.dqProgress(s, d);
        const done = pr >= d.target;
        return `<div class="${done ? 'done' : ''}">${d.claimed ? '✅' : done ? '🎁' : '▫️'} ${esc(d.name)} <b>${pr}/${d.target}</b></div>`;
      }).join('');
      const dqHtml = s.quest.index >= 3 ? dq : '';
      if (this.last.dq !== dqHtml) { this.last.dq = dqHtml; $('dqMini').innerHTML = dqHtml; $('dqMini').style.display = dqHtml ? '' : 'none'; }
      if (s.quest.index >= 1 && !s.flags.helpSeen && !this.blocking() && g.mode === 'world') { s.flags.helpSeen = true; this.openHelp(); }
      const lowEnergy = p.energy < me * 0.25 && Object.keys(s.inv).some(id => ITEMS[id] && ITEMS[id].food);
      $('eatBtn').classList.toggle('show', lowEnergy && g.mode === 'world');
    }
  }

  // ---------- تنبيهات ----------
  toast(text, cls = '', life = 3) {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.style.setProperty('--life', life + 's');
    el.textContent = text;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), (life + 0.5) * 1000);
  }

  gainToast(gains) {
    if (!gains.length) return;
    this.toast(gains.map(x => `${x.icon} ${x.text}`).join('  '), 'gain');
  }

  achievementToast(ach, tier) {
    this.audio.play('chest');
    this.toast(`🏅 إنجاز ${ACH_TIER_NAMES[tier]}: ${ach.name}! استلمه من المكافآت`, 'ach', 4);
    this.refresh();
  }

  // ---------- الحوار ----------
  dialogue(lines) {
    return new Promise((resolve) => {
      this.dq = [...lines];
      this.dResolve = resolve;
      this.dialogOpen = true;
      $('dialog').classList.remove('hidden');
      this.nextLine();
    });
  }

  nextLine() {
    if (!this.dq.length) {
      this.dialogOpen = false;
      this.speaker = null;
      $('dialog').classList.add('hidden');
      clearInterval(this.typer);
      const r = this.dResolve;
      this.dResolve = null;
      if (r) r();
      return;
    }
    const [who, text] = this.dq.shift();
    this.speaker = who;
    const sp = SPEAKERS[who] || (NPCS[who] ? { name: NPCS[who].name, look: NPCS[who].look } : { name: who });
    $('dName').textContent = sp.name;
    this.drawPortrait(sp.look, who);
    this.fullText = text;
    this.shown = 0;
    clearInterval(this.typer);
    const el = $('dText');
    el.textContent = '';
    this.typer = setInterval(() => {
      this.shown += 2;
      el.textContent = this.fullText.slice(0, this.shown);
      if (this.shown % 6 === 0) this.audio.play('talk');
      if (this.shown >= this.fullText.length) clearInterval(this.typer);
    }, 28);
  }

  advance() {
    if (!this.dialogOpen) return;
    if (this.shown < this.fullText.length) {
      this.shown = this.fullText.length;
      $('dText').textContent = this.fullText;
      clearInterval(this.typer);
      return;
    }
    this.nextLine();
  }

  drawPortrait(look, who) {
    const c = $('portrait');
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 64, 64);
    if (!look) {
      ctx.font = '40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📜', 32, 34);
      return;
    }
    const img = character(look, 'down', 0, who === 'lamp' ? 'djinn' : who);
    ctx.drawImage(img, 1, 0, 14, 16, 4, 4, 56, 64);
  }

  // ---------- نظام النوافذ ----------
  modal({ title, cls = '', closable = true, onClose, render }) {
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="panel ${cls}"><div class="phead"><h2></h2>${closable ? '<button class="close" data-a="close">✕</button>' : ''}</div><div class="tabs" hidden></div><div class="pbody"></div></div>`;
    el.querySelector('h2').textContent = title;
    $('modals').appendChild(el);
    const m = {
      el, closable,
      body: el.querySelector('.pbody'),
      tabsEl: el.querySelector('.tabs'),
      handlers: {},
      close: () => {
        if (m.closed) return;
        m.closed = true;
        el.remove();
        this.modals = this.modals.filter(x => x !== m);
        if (onClose) onClose();
        this.refresh();
      },
      setTitle: (t) => { el.querySelector('h2').textContent = t; },
      rerender: () => { const st = m.body.scrollTop; render(m); m.body.scrollTop = st; },
    };
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) { if (e.target === el && closable) m.close(); return; }
      const act = a.dataset.a;
      if (act === 'close') { this.audio.play('ui'); m.close(); return; }
      const h = m.handlers[act];
      if (h) h(a.dataset.v, a);
    });
    this.modals.push(m);
    render(m);
    return m;
  }

  tabs(m, list, active, onPick) {
    m.tabsEl.hidden = false;
    m.tabsEl.innerHTML = list.map(t => `<button class="tab ${t.id === active ? 'on' : ''}" data-a="tab" data-v="${t.id}">${t.label}${t.badge ? `<span class="badge on">${t.badge}</span>` : ''}</button>`).join('');
    m.handlers.tab = (v) => { this.audio.play('ui'); onPick(v); };
  }

  placingUI(on) {
    document.getElementById('game').classList.toggle('placing', !!on);
    $('placeBar').classList.toggle('hidden', !on);
    this.refresh();
  }

  costHtml(cost) {
    const s = this.g.state;
    return `<div class="cost">${Object.entries(cost).map(([id, n]) => {
      const c = count(s, id) + stored(s, id);
      return `<span class="${c >= n ? 'have' : 'miss'}">${itemIcon(id)} ${itemName(id)} ${c}/${n}</span>`;
    }).join('')}</div>`;
  }

  gainsHtml(list) {
    return `<div class="gains">${list.map((x, i) => `<span style="animation-delay:${i * 0.08}s">${x.icon} ${esc(x.text)}</span>`).join('')}</div>`;
  }

  // ---------- الصناعة ----------
  openCraft(station) {
    const g = this.g;
    const s = g.state;
    this.modal({
      title: `${STATIONS[station].icon} ${STATIONS[station].name}`,
      render: (m) => {
        const list = recipesFor(s, station);
        m.body.innerHTML = `<div class="grid">${list.map(r => {
          const [outId, outN] = Object.entries(r.out)[0];
          const times5 = !r.locked && has(s, Object.fromEntries(Object.entries(r.in).map(([k, v]) => [k, v * 5])));
          return `<div class="card ${r.locked ? 'locked' : r.affordable ? 'ready' : ''}">
            <h3><span class="ic">${itemIcon(outId)}</span>${itemName(outId)} ×${outN} <small class="muted">(عندك ${count(s, outId)})</small></h3>
            ${this.costHtml(r.in)}
            ${r.locked ? `<p class="muted">🔒 تحتاج تتعلم: ${TECH_BY_ID[r.tech].name}</p>` : `<div class="row"><button class="btn green" data-a="craft" data-v="${r.id}" ${r.affordable ? '' : 'disabled'}>اصنع</button>${times5 ? `<button class="btn" data-a="craft5" data-v="${r.id}">×5</button>` : ''}</div>`}
          </div>`;
        }).join('')}</div>`;
        const doCraft = (id, n) => {
          let made = 0;
          for (let i = 0; i < n; i++) if (craft(s, id)) made++;
          if (!made) { this.audio.play('deny'); return; }
          const r = RECIPES.find(x => x.id === id);
          const [outId, outN] = Object.entries(r.out)[0];
          // الورشة المرقّاة: فرصة ضعف الإنتاج
          const dbl = placement.doubleChance(s, station);
          let bonusN = 0;
          for (let i = 0; i < made; i++) if (dbl && g.rng() < dbl) { add(s, outId, outN); bonusN += outN; }
          if (bonusN) { this.toast(`✨ الورشة المرقّاة عطتك زيادة: ${itemIcon(outId)} +${bonusN}`, 'gain', 2.5); this.audio.play('chest'); }
          this.audio.play('craft');
          g.fx.burst(...g.fx.at(s.player.x, s.player.y, 20), ['#ffd24a', '#fff'], 10, 50, 0.6);
          g.fx.float(...g.fx.at(s.player.x, s.player.y, 30), `${itemIcon(outId)} +${outN * made}`, '#fff3c4', 14);
          g.gainXp(r.xp * made, s.player.x, s.player.y - 40);
          this.toast(`${itemIcon(outId)} صنعت ${itemName(outId)} ×${outN * made}`, 'gain', 1.6);
          m.rerender();
          this.refresh();
        };
        m.handlers.craft = (v) => doCraft(v, 1);
        m.handlers.craft5 = (v) => doCraft(v, 5);
      },
    });
  }

  // ---------- البناء ----------
  openBuild(spotId) {
    const g = this.g;
    const s = g.state;
    const sp = BUILD_SPOTS[spotId];
    this.modal({
      title: `🏗️ ${sp.name}`, cls: 'small',
      render: (m) => {
        const st = spotStatus(s, spotId);
        m.body.innerHTML = `<p>${esc(sp.desc)}</p>
          ${sp.rating ? `<p><b>⭐ سمعة الخان +${sp.rating}</b> <span class="muted">(السمعة الحين ${rating(s)}${nextStarAt(s) ? ` / النجمة الجاية عند ${nextStarAt(s)}` : ''})</span></p>` : ''}
          ${this.costHtml(sp.cost)}
          <p class="muted">⚡ يحتاج 5 طاقة</p>
          ${st.needTech ? `<p>🔒 تحتاج تتعلم <b>${TECH_BY_ID[st.needTech].name}</b> من المعرفة</p><div class="row center"><button class="btn blue" data-a="tech">افتح المعرفة 🔮</button></div>` :
            `<div class="row center"><button class="btn green big" data-a="build" ${st.ok ? '' : 'disabled'}>ابنِ 🔨</button></div>`}
          ${!st.ok && !st.needTech ? `<p class="muted center">${esc(st.reason)}</p>` : ''}`;
        const site = g.worldObjById['spot:' + spotId];
        if (site && site.dynamic) {
          const builder = s.workers.find(w => w.type === 'builder' && !w.job && w.status !== 'strike');
          m.body.innerHTML += `<div class="row center" style="margin-top:6px">
            ${builder && st.ok ? `<button class="btn blue" data-a="worker">👷 خلّ ${esc(builder.name)} يبنيه</button>` : ''}
            <button class="btn" data-a="move">🔀 انقل الموقع</button>
            <button class="btn" data-a="del" style="background:#e8b0a0">❌ شيل الموقع</button></div>
            <p class="muted center">تقدر تخلي الموقع ينتظر لين تجمع المواد، وتبنيه بعدين من جنبه.</p>`;
          m.handlers.worker = () => {
            const r = workersSys.assignBuild(s, builder.id, spotId);
            if (!r.ok) { this.toast(r.reason); return; }
            this.audio.play('build');
            this.toast(`🏗️ ${builder.name} بدأ يبني ${sp.name}`, 'gain', 3);
            g.save(); m.close();
          };
          m.handlers.move = () => { m.close(); g.startPlacing(Object.keys(PLACEABLES).find(k => PLACEABLES[k].spot === spotId), site.pid); };
          m.handlers.del = () => { if (g.removePlacedItem(site.pid)) { this.toast('شلت الموقع'); m.close(); } };
        }
        m.handlers.build = () => { if (g.doBuild(spotId)) m.close(); };
        m.handlers.tech = () => { m.close(); this.openTech(); };
      },
    });
  }

  // ---------- البيع والشراء ----------
  buyPrice(id) {
    const p = ITEMS[id].price;
    return Math.max(2, Math.round(p * (id.startsWith('seed_') ? 3 : 2.2)));
  }

  sellPrice(npc, id) {
    let p = ITEMS[id] ? ITEMS[id].price : 0;
    if (npc.herbMul && id === 'herb') p *= npc.herbMul;
    if (npc.breadMul && id === 'bread') p = Math.round(p * npc.breadMul);
    if (time.weekday(this.g.state) === 6) p = Math.round(p * 1.2); // الجمعة يوم السوق
    return p;
  }

  openShop(npcId) {
    const g = this.g;
    const s = g.state;
    const npc = NPCS[npcId];
    let tab = 'buy';
    const greet = npc.greet[Math.floor(Math.random() * npc.greet.length)];
    this.modal({
      title: `${npc.name} — ${npc.title}`,
      render: (m) => {
        this.tabs(m, [{ id: 'buy', label: 'اشترِ' }, { id: 'sell', label: 'بيع' }], tab, (v) => { tab = v; m.rerender(); });
        const friday = time.weekday(s) === 6;
        let rows = '';
        if (tab === 'buy') {
          const list = npc.sells.filter(id => !(npc.sellsTech && npc.sellsTech[id] && !s.tech[npc.sellsTech[id]]));
          rows = list.map(id => {
            const pr = this.buyPrice(id);
            return `<div class="shop-row"><span class="ic">${itemIcon(id)}</span><span class="nm">${itemName(id)}<br><small class="muted">عندك ${count(s, id)}</small></span>
              <button class="btn" data-a="buy" data-v="${id}:1" ${s.player.coins >= pr ? '' : 'disabled'}>🪙${pr}</button>
              <button class="btn" data-a="buy" data-v="${id}:5" ${s.player.coins >= pr * 5 ? '' : 'disabled'}>×5</button></div>`;
          }).join('');
          const locked = npc.sellsTech ? Object.entries(npc.sellsTech).filter(([, t]) => !s.tech[t]).map(([id, t]) => `${itemIcon(id)} ${itemName(id)} (تحتاج ${TECH_BY_ID[t].name})`) : [];
          if (locked.length) rows += `<p class="muted">🔒 ${locked.join(' • ')}</p>`;
        } else {
          const list = Object.keys(s.inv).filter(id => ITEMS[id] && s.inv[id] > 0);
          rows = list.length ? list.map(id => {
            const pr = this.sellPrice(npc, id);
            return `<div class="shop-row"><span class="ic">${itemIcon(id)}</span><span class="nm">${itemName(id)} ×${s.inv[id]}</span>
              <button class="btn green" data-a="sell" data-v="${id}:1">🪙${pr}</button>
              <button class="btn green" data-a="sell" data-v="${id}:all">الكل</button></div>`;
          }).join('') : '<p class="muted">حقيبتك فاضية.</p>';
        }
        m.body.innerHTML = `<p>💬 ${esc(greet)}${friday ? ' <b>(الجمعة يوم السوق: البيع +20%)</b>' : ''}</p><div class="shop-list">${rows}</div>`;
        m.handlers.buy = (v) => {
          const [id, nStr] = v.split(':');
          const n = Number(nStr);
          const cost = this.buyPrice(id) * n;
          if (s.player.coins < cost) { this.audio.play('deny'); return; }
          s.player.coins -= cost;
          add(s, id, n);
          this.audio.play('coin');
          m.rerender();
          this.refresh();
        };
        m.handlers.sell = (v) => {
          const [id, nStr] = v.split(':');
          const n = nStr === 'all' ? count(s, id) : Math.min(1, count(s, id));
          if (!n) return;
          const earn = this.sellPrice(npc, id) * n;
          add(s, id, -n);
          applyReward(s, { coins: earn }, Math.random);
          this.audio.play('coin');
          g.fx.float(...g.fx.at(s.player.x, s.player.y, 30), `🪙 +${earn}`, '#ffd24a', 14);
          m.rerender();
          this.refresh();
        };
      },
    });
  }

  // ---------- الحقيبة ----------
  openInventory() {
    const g = this.g;
    const s = g.state;
    this.modal({
      title: '🎒 الحقيبة',
      render: (m) => {
        const ids = Object.keys(s.inv).filter(id => s.inv[id] > 0 && ITEMS[id]);
        m.body.innerHTML = `<div class="row" style="margin-bottom:8px"><div class="kp">${Object.entries(KP_TYPES).map(([k, t]) => `<span style="color:${t.color}">${t.icon} ${t.name}: ${s.kp[k] || 0}</span>`).join('')}</div></div>
          ${ids.length ? `<div class="inv">${ids.map(id => `<button class="slot ${ITEMS[id].food ? 'food' : ''}" data-a="${ITEMS[id].food ? 'eat' : 'info'}" data-v="${id}">${ITEMS[id].icon}<small>${ITEMS[id].name}</small><b>${s.inv[id]}</b></button>`).join('')}</div>` : '<p class="muted">فاضية... روح اجمع!</p>'}
          <p class="muted">💡 الأغراض بإطار أخضر أكل: اضغطها عشان ترجع طاقتك.</p>`;
        m.handlers.eat = (id) => { if (g.eat(id)) m.rerender(); };
        m.handlers.info = (id) => this.toast(`${ITEMS[id].icon} ${ITEMS[id].name} — يتباع بـ ${ITEMS[id].price} درهم`, '', 2);
      },
    });
  }

  quickEat() {
    const g = this.g;
    const s = g.state;
    const foods = Object.keys(s.inv).filter(id => ITEMS[id] && ITEMS[id].food && s.inv[id] > 0).sort((a, b) => ITEMS[a].price - ITEMS[b].price);
    if (foods.length) g.eat(foods[0]);
  }

  // ---------- المعرفة ----------
  openTech() {
    const s = this.g.state;
    this.modal({
      title: '🔮 شجرة المعرفة',
      render: (m) => {
        const order = { ready: 0, poor: 1, locked: 2, learned: 3 };
        const list = [...TECH].sort((a, b) => order[techStatus(s, a.id)] - order[techStatus(s, b.id)]);
        m.body.innerHTML = `<div class="kp" style="margin-bottom:8px">${Object.entries(KP_TYPES).map(([k, t]) => `<span style="color:${t.color}">${t.icon} ${t.name}: ${s.kp[k] || 0}</span>`).join('')}</div>
          <p class="muted">النقاط تجمعها من شغلك: الحرفة من الصناعة والتكسير، الطبيعة من الزراعة والنخل، الأسرار من السرداب وزعبول.</p>
          <div class="grid">${list.map(t => {
            const st = techStatus(s, t.id);
            const cost = Object.entries(t.cost).map(([k, n]) => `<span class="${(s.kp[k] || 0) >= n ? 'have' : 'miss'}">${KP_TYPES[k].icon} ${n}</span>`).join('');
            const req = t.req.length ? `<p class="muted">يحتاج: ${t.req.map(r => TECH_BY_ID[r].name).join('، ')}</p>` : '';
            return `<div class="card tech ${st === 'learned' ? 'learned' : st === 'ready' ? 'ready' : st === 'locked' ? 'locked' : ''}">
              <h3>${st === 'learned' ? '✅' : st === 'locked' ? '🔒' : '📘'} ${t.name}</h3><p>${t.desc}</p>
              ${st === 'learned' ? '<span class="st" style="color:var(--green)">متعلّم</span>' : `<div class="cost">${cost}</div>${req}<button class="btn blue" data-a="learn" data-v="${t.id}" ${st === 'ready' ? '' : 'disabled'}>تعلّم</button>`}
            </div>`;
          }).join('')}</div>`;
        m.handlers.learn = (id) => {
          if (!learnTech(s, id)) { this.audio.play('deny'); return; }
          this.audio.play('magic');
          this.g.fx.confetti(...g.fx.at(s.player.x, s.player.y, 20));
          this.toast(`📘 تعلّمت: ${TECH_BY_ID[id].name}`, 'gain');
          if (id === 't_stamina' || id === 't_armor') { s.player.energy = maxEnergy(s); s.player.hp = maxHp(s); }
          this.g.save();
          m.rerender();
          this.refresh();
        };
      },
    });
  }

  // ---------- التحف ----------
  openRelics() {
    const s = this.g.state;
    this.modal({
      title: '🏺 ألبوم التحف',
      render: (m) => {
        const done = completedSets(s);
        m.body.innerHTML = `<p class="muted">التحف تلقاها بالسرداب والصناديق. كمّل المجموعة وتاخذ ميزة دائمة!</p>` +
          Object.entries(RELIC_SETS).map(([sid, set]) => {
            const items = Object.entries(RELICS).filter(([, r]) => r.set === sid);
            const have = items.filter(([id]) => s.relics[id]).length;
            return `<div class="set ${done.includes(sid) ? 'done' : ''}"><h3>${done.includes(sid) ? '✅' : '▫️'} ${set.name} (${have}/${items.length}) — <small>${set.bonus}</small></h3>
              <div class="relics">${items.map(([id, r]) => `<div class="relic ${s.relics[id] ? '' : 'missing'}"><div class="i">${r.icon}</div>${s.relics[id] ? r.name : '؟؟؟'}</div>`).join('')}</div></div>`;
          }).join('');
      },
    });
  }

  // ---------- المهام ----------
  openQuests() {
    const s = this.g.state;
    this.modal({
      title: '📜 القصة والمهام', cls: 'small',
      render: (m) => {
        m.body.innerHTML = MAIN_QUESTS.map((q, i) => {
          if (i > s.quest.index) return i === s.quest.index + 1 ? '<div class="dq"><span class="t">🔒 ...</span></div>' : '';
          const done = i < s.quest.index;
          return `<div class="dq"><span class="t">${done ? '✅' : '👉'} ${q.title}<br><small class="muted">${q.desc}</small></span></div>`;
        }).join('');
      },
    });
  }

  // ---------- الإعدادات ----------
  openSettings() {
    const g = this.g;
    const s = g.state;
    this.modal({
      title: '⚙️ الإعدادات', cls: 'small',
      render: (m) => {
        const st = s.settings;
        const card = (id, icon, name, on, onTxt, offTxt) => `<button class="setcard ${on ? 'on' : ''}" data-a="${id}"><span class="si">${icon}</span><b>${name}</b><span class="sv">${on ? '✅ ' + onTxt : '⛔ ' + offTxt}</span></button>`;
        m.body.innerHTML = `<div class="setgrid">
            ${card('sfx', '🔊', 'الأصوات', st.sfx, 'شغالة', 'طافية')}
            ${card('music', '🎵', 'الموسيقى', st.music, 'شغالة', 'طافية')}
            ${card('hq', '✨', 'جودة الرسم', st.hq !== false, 'عالية', 'عادية (أخف)')}
            ${card('big', '🔤', 'حجم الكلام', !!st.bigText, 'كبير', 'عادي')}
            ${card('vib', '📳', 'الاهتزاز', st.vibrate !== false, 'شغال', 'طافي')}
            ${card('arrow', '🧭', 'سهم المهام', st.arrow !== false, 'يطلع', 'مخفي')}
          </div>
          <button class="btn green big wide" data-a="help">📖 كيف ألعب؟</button>
          <p class="muted center">المزارع — نسخة 1.1 • إعلانات اليوم الباقية: ${retention.adsLeft(s, g.now())}</p>
          <div class="row center"><button class="btn tiny" data-a="reset" style="background:#e8b0a0">🗑️ ابدأ من جديد</button></div>`;
        const flip = (fn) => () => { fn(); this.audio.play('ui'); g.save(); m.rerender(); };
        m.handlers.music = flip(() => { st.music = !st.music; this.audio.setMusic(st.music); });
        m.handlers.sfx = flip(() => { st.sfx = !st.sfx; this.audio.sfx = st.sfx; });
        m.handlers.hq = flip(() => { st.hq = st.hq === false; });
        m.handlers.big = flip(() => { st.bigText = !st.bigText; this.applyTextSize(); });
        m.handlers.vib = flip(() => { st.vibrate = st.vibrate === false; });
        m.handlers.arrow = flip(() => { st.arrow = st.arrow === false; });
        m.handlers.help = () => { m.close(); this.openHelp(); };
        m.handlers.reset = async () => {
          const ok = await this.confirm('متأكد؟ كل تقدمك بينمسح ومايرجع!');
          if (!ok) return;
          try { g.storage.removeItem(SAVE_KEY); } catch { /* ما يهم */ }
          g.state = null;
          location.reload();
        };
      },
    });
  }

  applyTextSize() {
    const big = !!(this.g && this.g.state && this.g.state.settings.bigText);
    document.getElementById('game').classList.toggle('bigtext', big);
  }

  confirm(text) {
    return new Promise((resolve) => {
      const m = this.modal({
        title: 'تأكيد', cls: 'small', closable: false,
        render: (mm) => {
          mm.body.innerHTML = `<p>${esc(text)}</p><div class="row center"><button class="btn" data-a="no">لا</button><button class="btn green" data-a="yes">إيه</button></div>`;
          mm.handlers.yes = () => { mm.close(); resolve(true); };
          mm.handlers.no = () => { mm.close(); resolve(false); };
        },
      });
      return m;
    });
  }

  // ---------- المكافآت ----------
  openRewards(tab) {
    const g = this.g;
    const s = g.state;
    const now = g.now();
    retention.ensureDailyQuests(s, now);
    if (!tab) {
      if (retention.dailyStatus(s, now).available) tab = 'daily';
      else if (retention.wheelStatus(s, now).free) tab = 'wheel';
      else if (s.daily.dq.some(q => !q.claimed && retention.dqProgress(s, q) >= q.target) || retention.dqBonusReady(s)) tab = 'dq';
      else if (retention.claimableAchievements(s).length) tab = 'ach';
      else tab = 'daily';
    }
    this.modal({
      title: '🎁 المكافآت',
      render: (m) => {
        const ds = retention.dailyStatus(s, now);
        const ws = retention.wheelStatus(s, now);
        const dqReady = s.daily.dq.filter(q => !q.claimed && retention.dqProgress(s, q) >= q.target).length + (retention.dqBonusReady(s) ? 1 : 0);
        const achReady = retention.claimableAchievements(s).length;
        this.tabs(m, [
          { id: 'daily', label: '📅 اليومية', badge: ds.available ? '!' : 0 },
          { id: 'wheel', label: '🎡 العجلة', badge: ws.free ? '!' : 0 },
          { id: 'dq', label: '✅ مهام اليوم', badge: dqReady },
          { id: 'ach', label: '🏅 الإنجازات', badge: achReady },
        ], tab, (v) => { tab = v; m.rerender(); });
        if (tab === 'daily') this.renderDaily(m, ds);
        else if (tab === 'wheel') this.renderWheel(m, ws);
        else if (tab === 'dq') this.renderDQ(m);
        else this.renderAch(m);
      },
    });
  }

  renderDaily(m, ds) {
    const g = this.g;
    const s = g.state;
    const claimedIdx = ds.available ? ds.dayIndex - 1 : ds.dayIndex;
    m.body.innerHTML = `<p class="streak center">🔥 سلسلة الدخول: ${ds.available ? ds.streak - 1 : ds.streak} يوم ${ds.broken ? '<small class="muted">(انقطعت السلسلة، ابدأ من جديد!)</small>' : ''}</p>
      <div class="calendar">${DAILY_CALENDAR.map((r, i) => {
        const icon = describeReward(r)[0].icon;
        return `<div class="cday ${i <= claimedIdx ? 'got' : ''} ${ds.available && i === ds.dayIndex ? 'today' : ''} ${i === 6 ? 'big' : ''}"><div class="n">اليوم ${i + 1}</div><div class="i">${icon}</div>${r.label}</div>`;
      }).join('')}</div>
      <div class="row center" style="margin-top:10px">${ds.available ? '<button class="btn green big" data-a="claimDaily">استلم هدية اليوم 🎁</button>' : '<p class="muted">استلمت هدية اليوم ✔ ارجع بكرة عشان ما تنقطع السلسلة!</p>'}</div>`;
    m.handlers.claimDaily = async () => {
      const r = retention.claimDaily(s, g.now());
      if (!r) return;
      m.close();
      const choice = await this.offer({ title: `🎁 هدية اليوم ${r.dayIndex + 1}`, subtitle: `سلسلة ${r.streak} يوم 🔥`, reward: r.reward, ad: 'daily_x2' });
      g.claimReward(choice === 'x2' ? doubleIt(r.reward) : r.reward, null, true);
      this.openRewards();
    };
  }

  renderWheel(m, ws) {
    const g = this.g;
    const s = g.state;
    m.body.innerHTML = `<div class="row center" style="gap:18px">
      <div class="wheel-wrap"><div class="wheel-pin">🔻</div><canvas id="wheelC" width="500" height="500"></canvas></div>
      <div style="text-align:center">
        <p><b>لفة مجانية كل يوم!</b><br><span class="muted">وتقدر تلف ${ws.adSpinsLeft} لفات زيادة بإعلان</span></p>
        ${ws.free ? '<button class="btn green big" data-a="spin" data-v="free">لف مجاناً 🎡</button>' : `<button class="btn ad" data-a="spin" data-v="ad" ${ws.adSpinsLeft > 0 ? '' : 'disabled'}>لفة زيادة</button>`}
      </div></div>`;
    const c = m.body.querySelector('#wheelC');
    drawWheel(c);
    if (this.wheelAngle) c.style.transition = 'none', c.style.transform = `rotate(${this.wheelAngle % 360}deg)`;
    m.handlers.spin = async (kind) => {
      if (this.spinning) return;
      if (kind === 'ad') {
        const ok = await g.watchAd('wheel');
        if (!ok) return;
      }
      const res = retention.spinWheel(s, g.now(), g.rng, kind);
      if (!res) return;
      this.spinning = true;
      m.closable = false;
      const seg = 360 / WHEEL.length;
      const base = Math.ceil((this.wheelAngle || 0) / 360) * 360 + 360 * 5;
      const target = base + (360 - (res.index + 0.5) * seg);
      this.wheelAngle = target;
      c.style.transition = 'transform 4s cubic-bezier(.12,.8,.18,1)';
      requestAnimationFrame(() => { c.style.transform = `rotate(${target}deg)`; });
      let ticks = 0;
      const ticker = setInterval(() => { if (ticks++ < 30) this.audio.play('spin'); }, 110);
      setTimeout(async () => {
        clearInterval(ticker);
        this.spinning = false;
        m.closable = true;
        this.audio.play('chest');
        g.claimReward(res.reward, `🎡 طلع لك: ${WHEEL[res.index].label}`);
        m.rerender();
      }, 4200);
    };
  }

  renderDQ(m) {
    const g = this.g;
    const s = g.state;
    const bonus = retention.dqBonusReady(s);
    m.body.innerHTML = `<p class="muted">ثلاث مهام تتجدد كل يوم. خلّصها كلها وتاخذ <b>${DAILY_QUEST_BONUS.label}</b>!</p>` +
      s.daily.dq.map((q, i) => {
        const pr = retention.dqProgress(s, q);
        const done = pr >= q.target;
        return `<div class="dq"><div class="t">${q.claimed ? '✅' : '🎯'} ${esc(q.name)}<div class="prog"><i style="width:${(pr / q.target) * 100}%"></i></div><small class="muted">${pr}/${q.target} — 🪙${q.reward.coins} ✨${q.reward.xp}</small></div>
          ${q.claimed ? '<span class="muted">مستلمة</span>' : `<button class="btn green" data-a="claimDQ" data-v="${i}" ${done ? '' : 'disabled'}>استلم</button>`}</div>`;
      }).join('') +
      `<div class="row center">${s.daily.dqBonus ? '<p class="muted">استلمت صندوق اليوم ✔</p>' : `<button class="btn big ${bonus ? 'green' : ''}" data-a="bonus" ${bonus ? '' : 'disabled'}>💎 صندوق المهام</button>`}</div>`;
    m.handlers.claimDQ = (v) => {
      const r = retention.claimDailyQuest(s, Number(v));
      if (!r) return;
      g.claimReward(r, null, true);
      m.rerender();
    };
    m.handlers.bonus = async () => {
      if (!retention.dqBonusReady(s)) return;
      s.daily.dqBonus = true;
      m.close();
      await g.openChestFlow(DAILY_QUEST_BONUS.chest);
    };
  }

  renderAch(m) {
    const g = this.g;
    const s = g.state;
    m.body.innerHTML = ACHIEVEMENTS.map(a => {
      const got = s.ach[a.stat] || 0;
      const val = s.stats[a.stat] || 0;
      const next = a.tiers[got];
      const can = got < a.tiers.length && val >= next;
      const medals = ['🥉', '🥈', '🥇'].map((md, i) => `<span class="${i < got ? '' : 'off'}">${md}</span>`).join('');
      return `<div class="ach"><span class="medals">${medals}</span><div style="flex:1"><b>${a.name}</b>
        ${next ? `<div class="prog"><i style="width:${Math.min(100, (val / next) * 100)}%"></i></div><small class="muted">${Math.min(val, next)}/${next} — الجائزة: ${describeReward(ACH_TIER_REWARDS[got]).map(x => x.icon + ' ' + x.text).join('، ')}</small>` : '<small class="muted">خلّصت كل الدرجات 👑</small>'}</div>
        ${can ? `<button class="btn green" data-a="claimAch" data-v="${a.stat}">استلم</button>` : ''}</div>`;
    }).join('');
    m.handlers.claimAch = (stat) => {
      const r = retention.claimAchievement(s, stat);
      if (!r) return;
      const a = ACHIEVEMENTS.find(x => x.stat === stat);
      g.claimReward(r.reward, `🏅 ${a.name} — ${ACH_TIER_NAMES[r.tier]}`);
      m.rerender();
    };
  }

  // ---------- الفعاليات ----------
  openEvents() {
    const g = this.g;
    const s = g.state;
    this.modal({
      title: '🎪 الفعاليات',
      render: (m) => {
        const now = g.now();
        const cur = events.ensureEvent(s, now);
        const def = cur.def;
        const ev = s.event;
        const tier = events.nextTier(s);
        const lb = events.leaderboard(s, now);
        const myRank = lb.findIndex(r => r.me) + 1;
        const cost = tier < TRACK_COSTS.length ? events.tierCost(s, tier) : 0;
        let action = '';
        if (def.game) {
          const left = events.playsLeft(s, now), adLeft = events.adPlaysLeft(s, now);
          action = `<div class="row center"><button class="btn green big" data-a="play" ${left ? '' : 'disabled'}>${def.game === 'race' ? '🏁 ابدأ السباق' : '🦅 ابدأ الصيد'} (${left} محاولات)</button>${!left && adLeft ? `<button class="btn ad" data-a="playad">محاولة زيادة (${adLeft})</button>` : ''}</div>`;
        } else if (def.deliver) {
          const have = count(s, def.deliver.item);
          action = `<div class="row center"><span>عندك ${ITEMS[def.deliver.item].icon} ${have}</span><button class="btn green big" data-a="deliver" ${have >= def.deliver.per ? '' : 'disabled'}>سلّم التمر (${def.deliver.per} = ${def.tokenIcon})</button></div>`;
        }
        m.body.innerHTML = `<div class="evhead"><div class="evicon">${def.icon}</div><div><h3>${def.name}</h3><p>${esc(def.desc)}</p><p class="muted">⏳ باقي ${events.timeLeftText(now)} • ${esc(def.how)}</p></div>
            <div class="evtok">${def.tokenIcon}<b>${ev.tokens}</b><small>${def.token}</small></div></div>
          ${action}
          <h3 style="margin:10px 0 4px">🎁 مسار الجوايز</h3>
          <div class="track">${TRACK_REWARDS.map((r, i) => `<div class="tstep ${i < tier ? 'got' : i === tier ? 'next' : ''}"><small>${events.tierCost(s, i)}${def.tokenIcon}</small><div>${describeReward(r).map(x => x.icon).join('')}</div></div>`).join('')}</div>
          <div class="row center" style="margin-top:6px">${tier < TRACK_COSTS.length ? `<button class="btn green" data-a="claim" ${events.canClaimTier(s) ? '' : 'disabled'}>استلم الدرجة ${tier + 1} (${cost}${def.tokenIcon})</button>` : '<b>👑 خلّصت المسار كامل!</b>'}</div>
          <h3 style="margin:10px 0 4px">🏆 الترتيب — مركزك ${myRank}</h3>
          <ol class="board">${lb.slice(0, 6).map(r => `<li class="${r.me ? 'me' : ''}">${esc(r.name)} — ${r.score}</li>`).join('')}${myRank > 6 ? `<li class="me" value="${myRank}">أنت — ${ev.earned}</li>` : ''}</ol>
          <p class="muted">الفعاليات الجاية: ${EVENTS.filter(e => e.id !== def.id).map(e => e.icon + ' ' + e.name).join(' • ')}</p>`;
        m.handlers.claim = () => {
          const r = events.claimTier(s);
          if (!r) return;
          g.claimReward(r.reward, `🎁 ${def.name} — الدرجة ${r.tier + 1}`);
          m.rerender();
        };
        m.handlers.deliver = () => { const n = events.deliver(s, now); if (n) { this.audio.play('deal'); this.toast(`${def.tokenIcon} +${n}`, 'gain'); g.save(); } m.rerender(); };
        const start = (viaAd) => {
          if (!events.usePlay(s, now, viaAd)) return;
          m.close();
          if (def.game === 'race') this.playRace(); else this.playFalcon();
        };
        m.handlers.play = () => start(false);
        m.handlers.playad = async () => { if (await g.watchAd('energy')) start(true); };
      },
    });
  }

  // لعبة سباق الهجن
  playRace() {
    const g = this.g;
    const s = g.state;
    const power = (c) => (c.beauty + (c.rare ? 40 : 0)) * camels.speedMul(c);
    const best = [...s.camels].filter(c => camels.isAdult(c)).sort((a, b) => power(b) - power(a))[0];
    const myBeauty = best ? best.beauty + (best.rare ? 40 : 0) + (camels.isFed(best, s.time.day) ? 8 : 0) : 25;
    const rivals = events.raceRivals((s.seed + s.time.day * 31 + (s.event.earned || 0)) >>> 0);
    const lanes = [{ name: best ? best.name : 'ناقة مستأجرة', me: true, x: 0, speed: events.raceBaseSpeed(myBeauty) * (best ? camels.speedMul(best) : 1), boost: 0, col: best ? camelColors(best) : BREEDS.shual }]
      .concat(rivals.map((r, i) => ({ name: r.name, x: 0, speed: r.speed, jitter: r.jitter, col: Object.values(BREEDS)[i % 6] })));
    let t = 0, marker = 0, dir = 1, cd = 0, done = false, raf;
    const finish = {};
    this.modal({
      title: '🏁 سباق الهجن', closable: false,
      render: (m) => {
        m.body.innerHTML = `<canvas class="mg" width="640" height="240"></canvas>
          <div class="tbar"><i class="zone"></i><i class="mark"></i></div>
          <div class="row center"><button class="btn green big" data-a="tap">🐪 اضغط بالتوقيت!</button></div><p class="muted center">اضغط لما يكون المؤشر بالمنطقة الخضرا عشان ناقتك تسرّع. الغلط يبطّئها!</p>`;
        const cv = m.body.querySelector('canvas');
        const ctx = cv.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        const markEl = m.body.querySelector('.mark');
        const tap = () => {
          if (done || cd > 0) return;
          cd = 0.35;
          const q = 1 - Math.min(1, Math.abs(marker - 0.5) * 2);
          const b = events.boostFor(q);
          lanes[0].boost = b;
          lanes[0].boostT = 0.9;
          this.audio.play(b > 0 ? 'coin' : 'deny');
          g.fx.float(0, 0, '', '#fff');
        };
        m.handlers.tap = tap;
        cv.addEventListener('pointerdown', tap);
        let last = performance.now();
        const loop = (now) => {
          const dt = Math.min(0.05, (now - last) / 1000) * (window.__fastAds ? 8 : 1);
          last = now;
          t += dt;
          cd = Math.max(0, cd - dt);
          marker += dir * dt * 1.25;
          if (marker > 1) { marker = 1; dir = -1; }
          if (marker < 0) { marker = 0; dir = 1; }
          markEl.style.left = `calc(${marker * 100}% - 3px)`;
          for (const [i, l] of lanes.entries()) {
            if (finish[i] !== undefined) continue;
            let v = l.speed;
            if (l.me) { if (l.boostT > 0) { v += l.boost; l.boostT -= dt; } }
            else v += Math.sin(t * 1.7 + i) * l.jitter;
            l.x += Math.max(8, v) * dt;
            if (l.x >= events.RACE_LEN) finish[i] = t;
          }
          // الرسم
          ctx.fillStyle = '#e4bb76'; ctx.fillRect(0, 0, 640, 240);
          for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#dcae66' : '#e8c07c'; ctx.fillRect(0, 20 + i * 42, 640, 42); }
          ctx.fillStyle = '#fff'; for (let y = 20; y < 230; y += 12) ctx.fillRect(600, y, 6, 6);
          for (const [i, l] of lanes.entries()) {
            const img = art.camelSprite(l.col, Math.floor(t * 8) % 2 + 1, 'race' + i);
            const x = 10 + (Math.min(l.x, events.RACE_LEN) / events.RACE_LEN) * 570;
            ctx.drawImage(img, Math.round(x), 22 + i * 42, 45, 39);
            ctx.font = '700 12px Cairo'; ctx.fillStyle = l.me ? '#b8292a' : '#3a2418';
            ctx.fillText(l.me ? `⭐ ${l.name}` : l.name, 4, 34 + i * 42);
          }
          if (finish[0] !== undefined && !done) {
            done = true;
            // نكمل وقت الباقين حسابياً
            const times = lanes.slice(1).map((l, i) => finish[i + 1] !== undefined ? finish[i + 1] : t + (events.RACE_LEN - l.x) / l.speed);
            const place = events.racePlace(finish[0], times);
            const tokens = events.addTokens(s, events.raceTokens(place));
            addStat(s, 'races', 1);
            if (place === 1) addStat(s, 'raceWins', 1);
            this.audio.play(place === 1 ? 'rare' : 'deal');
            m.body.innerHTML = `<div class="reveal shine"><div class="big-ic">${place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : '🏁'}</div><h2>المركز ${place}</h2><p>كسبت ${tokens} 🚩</p></div><div class="row center"><button class="btn green big" data-a="close">تمام</button></div>`;
            m.closable = true;
            g.save();
            return;
          }
          if (!m.closed) raf = requestAnimationFrame(loop);
        };
        if (!done) raf = requestAnimationFrame(loop);
      },
    });
  }

  // لعبة صيد الصقور
  playFalcon() {
    const g = this.g;
    const s = g.state;
    let round = 0, hits = 0, t = 0, raf;
    let prey = null, falcon = null, perchX = 320, perchDir = 1;
    const TOTAL = 10;
    this.modal({
      title: '🦅 صيد الصقور', closable: false,
      render: (m) => {
        m.body.innerHTML = `<canvas class="mg" width="640" height="260"></canvas><div class="row center"><b class="fstat">0/${TOTAL}</b><button class="btn green big" data-a="tap">🦅 أطلق الصقر!</button></div><p class="muted center">الصقر يتحرك تحت، والحبارى تطير فوق. أطلقه بحيث يوصلها بالوقت الصح.</p>`;
        const cv = m.body.querySelector('canvas');
        const ctx = cv.getContext('2d');
        const stat = m.body.querySelector('.fstat');
        const spawn = () => { round += 1; const fromLeft = Math.random() < 0.5; prey = { x: fromLeft ? -20 : 660, y: 40 + Math.random() * 50, vx: (fromLeft ? 1 : -1) * (120 + round * 12 + Math.random() * 60) }; };
        const tap = () => {
          if (falcon || !prey) return;
          falcon = { x: perchX, y: 230, vy: -420 };
          this.audio.play('swing');
        };
        m.handlers.tap = tap;
        cv.addEventListener('pointerdown', tap);
        spawn();
        let last = performance.now();
        const loop = (now) => {
          if (m.closed) return;
          const dt = Math.min(0.05, (now - last) / 1000) * (window.__fastAds ? 8 : 1);
          last = now;
          t += dt;
          perchX += perchDir * dt * 220;
          if (perchX > 600) { perchX = 600; perchDir = -1; }
          if (perchX < 40) { perchX = 40; perchDir = 1; }
          if (prey) prey.x += prey.vx * dt;
          if (falcon) {
            falcon.y += falcon.vy * dt;
            if (prey && falcon.y <= prey.y + 8) {
              if (events.falconHit(falcon.x, prey.x)) { hits++; this.audio.play('coin'); prey = null; }
              else this.audio.play('deny');
              falcon = null;
            } else if (falcon.y < 0) falcon = null;
          }
          if (prey && (prey.x < -40 || prey.x > 680)) prey = null;
          if (!prey && !falcon) {
            if (round >= TOTAL) {
              const tokens = events.addTokens(s, hits);
              addStat(s, 'falconHunts', 1);
              this.audio.play(hits >= 7 ? 'rare' : 'deal');
              m.body.innerHTML = `<div class="reveal shine"><div class="big-ic">🦅</div><h2>صدت ${hits} من ${TOTAL}</h2><p>كسبت ${tokens} 🪶</p></div><div class="row center"><button class="btn green big" data-a="close">تمام</button></div>`;
              m.closable = true;
              g.save();
              return;
            }
            spawn();
          }
          stat.textContent = `${hits} صيد • ${round}/${TOTAL}`;
          const sky = ctx.createLinearGradient(0, 0, 0, 260);
          sky.addColorStop(0, '#f4a860'); sky.addColorStop(0.7, '#f8d9a0'); sky.addColorStop(1, '#e4bb76');
          ctx.fillStyle = sky; ctx.fillRect(0, 0, 640, 260);
          ctx.fillStyle = '#d09a55'; ctx.fillRect(0, 236, 640, 24);
          ctx.font = '30px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          if (prey) { ctx.save(); ctx.translate(prey.x, prey.y); if (prey.vx < 0) ctx.scale(-1, 1); ctx.fillText('🐦', 0, 0); ctx.restore(); }
          ctx.fillText('🧤', perchX, 238);
          if (falcon) ctx.fillText('🦅', falcon.x, falcon.y);
          else ctx.fillText('🦅', perchX, 214);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      },
    });
  }

  // ---------- شاشة التحميل ----------
  loading(title, tip) {
    return new Promise((resolve) => {
      this.fading = true;
      const el = document.createElement('div');
      el.className = 'loading';
      el.innerHTML = `<div class="ltitle">${esc(title)}</div><div class="lbar"><i></i></div><div class="ltip">${esc(tip || '')}</div><div class="lcamel">🐪</div>`;
      document.getElementById('game').appendChild(el);
      const bar = el.querySelector('.lbar i');
      let k = 0;
      const dur = window.__fastAds ? 60 : 1600;
      const t0 = performance.now();
      const step = () => {
        k = Math.min(1, (performance.now() - t0) / dur);
        bar.style.width = Math.round(k * 100) + '%';
        if (k < 1) { requestAnimationFrame(step); return; }
        resolve();
        el.classList.add('out');
        setTimeout(() => { el.remove(); this.fading = false; }, 350);
      };
      requestAnimationFrame(step);
    });
  }

  // ---------- مزارع الجيران ----------
  openFarm(farmId, tab = 'animals') {
    const g = this.g;
    const s = g.state;
    const def = FARMS[farmId];
    const f = farmsSys.refreshFarm(s, farmId, s.time.day);
    this.modal({
      title: `🏡 ${def.name}`,
      render: (m) => {
        if (f.owned) {
          m.tabsEl.hidden = true;
          const st = Object.entries(f.storage).filter(([, v]) => v > 0);
          m.body.innerHTML = `<p>✔ هذي المزرعة <b>لك</b>. كل يوم تنتج: ${Object.entries(def.produce).map(([k, v]) => `${ITEMS[k].icon}×${v}`).join(' ')} + 🪙${def.income}.</p>
            <p>📦 بالمخزن: ${st.length ? st.map(([k, v]) => `${k === 'coins' ? '🪙' : ITEMS[k].icon}×${v}`).join(' ') : 'فاضي'}</p>
            <div class="row center"><button class="btn green big" data-a="collect" ${st.length ? '' : 'disabled'}>استلم المخزن</button></div>`;
          m.handlers.collect = () => { g.collectFarm(farmId); m.rerender(); };
          return;
        }
        this.tabs(m, [
          { id: 'animals', label: '🐪 حلاله' },
          { id: 'goods', label: '🧺 بضاعته' },
          { id: 'sell', label: '💰 بيعه حلالك' },
          { id: 'farm', label: '🏡 اشترِ المزرعة' },
        ], tab, (v) => { tab = v; m.rerender(); });
        const head = `<p>💬 <b>${esc(def.owner)}</b>: ${esc(def.greet)} <span class="ctag">طبعه: ${PERSONAS[def.persona].name}</span> <span class="ctag">اختصاصه: ${esc(def.specialty)}</span></p>`;
        if (tab === 'goods') {
          m.body.innerHTML = head + `<div class="shop-list">${f.stock.filter(d => !d.closed).map(d => `<div class="shop-row"><span class="ic">${ITEMS[d.item].icon}</span><span class="nm">${ITEMS[d.item].name} ×${d.qty}<br><small class="muted">🪙${d.ask} للحبة${d.angry ? ' • 😤 زعلان' : ''}</small></span>
            <button class="btn" data-a="buyg" data-v="${d.id}" ${s.player.coins >= d.ask ? '' : 'disabled'}>اشترِ</button>${d.angry ? '' : `<button class="btn blue" data-a="hagg" data-v="${d.id}">ساوم 💬</button>`}</div>`).join('') || '<p class="muted">خلصت بضاعته اليوم.</p>'}</div>`;
        } else if (tab === 'animals') {
          const list = f.animals.filter(a => !a.closed);
          m.body.innerHTML = head + `<div class="camels">${list.map(a => {
            const name = a.kind === 'camel' ? `${esc(a.camel.name)} — ${camelBreedName(a.camel)}` : `🐑 ${SHEEP_BREEDS[a.sheep.breed].name}`;
            const pic = a.kind === 'camel' ? this.camelImg(a.camel) : '<span style="font-size:36px">🐑</span>';
            const tags = a.kind === 'camel' ? this.camelTag(a.camel) : `<span class="ctag">${a.sheep.ageDays >= 2 ? 'بالغ' : 'طلي'}</span>`;
            return `<div class="ccard"><div class="cpic">${pic}</div><div class="cinfo"><h3>${name}</h3><div class="ctags">${tags}</div>
              <div class="row"><b class="price">🪙 ${market.fmt(a.ask)}</b>${a.angry ? '<span class="muted">😤 زعلان منك</span>' : `<button class="btn green" data-a="buya" data-v="${a.id}" ${s.player.coins >= a.ask ? '' : 'disabled'}>اشترِ</button><button class="btn blue" data-a="haga" data-v="${a.id}">ساوم 💬</button>`}</div></div></div>`;
          }).join('') || '<p class="muted">ما عنده حلال للبيع اليوم.</p>'}</div>`;
        } else if (tab === 'sell') {
          const mine = [...s.camels.map(c => ({ kind: 'camel', a: c })), ...s.sheep.map(x => ({ kind: 'sheep', a: x }))];
          m.body.innerHTML = head + `<p class="muted">${esc(def.owner)} يشتري حلالك. يعطيك عرض، وتقدر تساوم عليه.</p><div class="shop-list">${mine.map(({ kind, a }) => `<div class="shop-row"><span class="ic">${kind === 'camel' ? '🐪' : '🐑'}</span><span class="nm">${kind === 'camel' ? esc(a.name) + ' — ' + camelBreedName(a) : SHEEP_BREEDS[a.breed].name}</span><button class="btn" data-a="sell" data-v="${kind}:${a.id}">اعرضه عليه</button></div>`).join('') || '<p class="muted">ما عندك حلال.</p>'}</div>`;
        } else {
          const d = f.sale;
          m.body.innerHTML = head + `<div class="card ready"><h3>🏡 ${esc(def.name)}</h3><p>إذا اشتريتها تصير لك، وتنتج كل يوم: ${Object.entries(def.produce).map(([k, v]) => `${ITEMS[k].icon}×${v}`).join(' ')} + 🪙${def.income}، وتستلمها من مخزنها.</p>
            <div class="row"><b class="price">🪙 ${market.fmt(d.ask)}</b>${d.angry ? '<span class="muted">😤 رفض يكمل معك اليوم</span>' : `<button class="btn green big" data-a="buyf" ${s.player.coins >= d.ask ? '' : 'disabled'}>اشترها</button><button class="btn blue" data-a="hagf">ساوم 💬</button>`}</div>
            <p class="muted">دراهمك: 🪙${market.fmt(s.player.coins)}</p></div>`;
        }
        const after = (res, what) => {
          const msgs = { poor: 'الدراهم ما تكفي 💸', full: 'ما عندك مكان، وسّع المراح أو الحظيرة', nostable: 'ابنِ المراح أول 🐪', nofold: 'ابنِ حظيرة الغنم أول 🐑', gone: 'الصفقة خلصت' };
          if (res.result === 'bought') {
            this.audio.play('deal');
            g.fx.confetti(...g.fx.at(s.player.x, s.player.y, 20));
            this.toast(`🤝 ${what} بـ ${market.fmt(res.price)}`, 'gain', 3);
            if (res.kind) this.toast(res.kind === 'camel' ? '🐪 الناقة بتلحقك، تلقاها بالمراح أول ما ترجع مزرعتك' : '🐑 الغنمة بتلحقك، تلقاها بالحظيرة أول ما ترجع مزرعتك', '', 4);
            g.save();
          } else if (msgs[res.result]) this.toast(msgs[res.result]);
          m.rerender();
          this.refresh();
        };
        const chat = (d, label, buy, what) => this.haggleChat({
          title: `💬 ${def.owner}`, sub: label,
          log: () => d.log, current: () => d.ask, start: Math.round(d.ask * 0.7), acceptLabel: () => `اشترِ بـ ${market.fmt(d.ask)}`,
          send: (n) => farmsSys.haggle(d, n, g.rng),
          accept: () => buy(),
          onResult: (res) => {
            if (!res) return true;
            if (res.result === 'accept') { after(buy(), what); return true; }
            if (res.result === 'bought' || ['poor', 'full', 'nostable', 'nofold', 'gone'].includes(res.result)) { after(res, what); return true; }
            return res.result === 'leave';
          },
          done: () => m.rerender(),
        });
        m.handlers.buyg = (id) => after(farmsSys.buyGoods(s, farmId, id, 1), 'اشتريت');
        m.handlers.hagg = (id) => { const d = f.stock.find(x => x.id === id); chat(d, `${ITEMS[d.item].name} (سعر الحبة)`, () => farmsSys.buyGoods(s, farmId, id, 1), 'اشتريت'); };
        m.handlers.buya = (id) => after(farmsSys.buyAnimal(s, farmId, id), 'اشتريت الحلال');
        m.handlers.haga = (id) => { const d = f.animals.find(x => x.id === id); chat(d, d.kind === 'camel' ? d.camel.name : 'غنمة', () => farmsSys.buyAnimal(s, farmId, id), 'اشتريت الحلال'); };
        m.handlers.buyf = () => { const r = farmsSys.buyFarm(s, farmId); after(r, `🏡 صارت ${def.name} لك`); if (r.result === 'bought') { this.audio.play('rare'); g.fx.goldRain(s.player.x, s.player.y - 60, 220); g.checkProgress(); } };
        m.handlers.hagf = () => chat(f.sale, def.name, () => { const r = farmsSys.buyFarm(s, farmId); if (r.result === 'bought') { this.audio.play('rare'); g.fx.goldRain(s.player.x, s.player.y - 60, 220); } return r; }, `🏡 صارت ${def.name} لك`);
        m.handlers.sell = (v) => {
          const [kind, id] = v.split(':');
          const o = farmsSys.sellOffer(s, farmId, kind, id, g.rng);
          if (!o) return;
          this.haggleChat({
            title: `💬 ${def.owner}`, sub: 'يبي يشتري حلالك',
            log: () => o.log, current: () => o.amount, start: Math.round(o.value * 1.2), acceptLabel: () => `بيع بـ ${market.fmt(o.amount)}`, sendLabel: 'اطلب',
            send: (n) => farmsSys.counterSell(o, n, g.rng),
            accept: () => farmsSys.completeSell(s, o),
            onResult: (res) => {
              if (!res) return true;
              if (res.price !== undefined) { this.audio.play('deal'); this.toast(`🤝 بعت على ${def.owner} بـ ${market.fmt(res.price)}`, 'gain', 3); g.save(); return true; }
              if (res.result === 'accept') { const r2 = farmsSys.completeSell(s, o); if (r2) { this.audio.play('deal'); this.toast(`🤝 بعت بـ ${market.fmt(r2.price)}`, 'gain', 3); g.save(); } return true; }
              return res.result === 'leave';
            },
            done: () => { m.rerender(); this.refresh(); },
          });
        };
      },
    });
  }

  // ---------- العمّال ----------
  openWorkers(tab = 'mine') {
    const g = this.g;
    const s = g.state;
    this.modal({
      title: '👷 العمّال',
      render: (m) => {
        this.tabs(m, [{ id: 'mine', label: '👷 عمّالي' }, { id: 'hire', label: '📝 وظّف' }], tab, (v) => { tab = v; m.rerender(); });
        if (tab === 'hire') return this.renderHire(m);
        const owed = workersSys.totalOwed(s);
        const hour = time.hour(s);
        m.body.innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:6px">
            <span>💸 الرواتب المستحقة: <b class="price" style="color:${owed ? '#b00' : '#1a6a10'}">${owed}</b> • العمال ${s.workers.length}/${workersSys.workerCap(s)} • ${workersSys.isWorkHour(hour) ? '🕐 وقت دوام' : '🌙 راحة (الدوام 6 الصبح لين 8 بالليل)'}</span>
            <span class="row"><button class="btn green" data-a="pay" ${owed && s.player.coins >= owed ? '' : 'disabled'}>سدد الرواتب</button>
            <button class="btn ${s.payroll.auto ? 'blue' : ''}" data-a="auto">${s.payroll.auto ? '✔ دفع تلقائي' : 'دفع تلقائي'}</button></span></div>
          <p class="muted">الراتب ينحسب كل ساعة دوام باللعبة. إذا تأخرت <b>${STRIKE_AFTER} ساعات</b> يضرب العامل ويوقف، وما يرجع إلا إذا دفعت راتبه <b>+ غرامة</b>.</p>
          <div class="camels">${s.workers.map(w => {
            const T = WORKER_TYPES[w.type];
            const rt = g.workerRt && g.workerRt[w.id];
            const doing = w.status === 'strike' ? '✊ مضرب عن الشغل' : !workersSys.isWorkHour(hour) ? '😴 يرتاح' : w.type === 'builder' ? (w.job ? `🔨 يبني ${BUILD_SPOTS[w.job.spot].name}` : '⏳ ينتظر تحدد له بناء') : rt && rt.task ? `${T.icon} يشتغل` : '🤷 ما لقى شغل';
            return `<div class="ccard ${w.status === 'strike' ? 'strike' : ''}"><div class="cpic" style="font-size:36px">${T.icon}</div><div class="cinfo">
              <h3>${esc(w.name)} <small class="muted">— ${T.name}</small></h3>
              <div class="ctags"><span class="ctag">راتب ${w.wage}/ساعة</span><span class="ctag">سرعة ×${w.speed}</span><span class="ctag ${w.owed ? 'warn' : ''}">دين ${w.owed}</span>${w.late ? `<span class="ctag warn">متأخر ${w.late} ساعة</span>` : ''}</div>
              <div class="muted">${doing}</div>
              ${w.job ? `<div class="prog"><i style="width:${Math.min(100, (w.job.progress / w.job.need) * 100)}%"></i></div>` : ''}
              <div class="row">${w.status === 'strike' ? `<button class="btn green" data-a="back" data-v="${w.id}" ${s.player.coins >= workersSys.reinstateCost(w) ? '' : 'disabled'}>ادفع ${w.owed} + غرامة ${w.fine} وارجعه</button>` : ''}
                ${w.type === 'builder' && !w.job && w.status !== 'strike' ? `<button class="btn blue" data-a="assign" data-v="${w.id}">حدد بناء 🏗️</button>` : ''}
                ${w.job ? `<button class="btn mini2" data-a="cancel" data-v="${w.id}">ألغِ البناء</button>` : ''}
                <button class="btn mini2" data-a="fire" data-v="${w.id}">اطرده</button></div></div></div>`;
          }).join('') || '<p class="muted">ما عندك عمّال. روح لتبويب "وظّف" 📝</p>'}</div>`;
        m.handlers.pay = () => { const n = workersSys.payAll(s); if (n) { this.audio.play('coin'); this.toast(`💸 سددت الرواتب: ${n} درهم`, 'gain'); g.save(); } m.rerender(); this.refresh(); };
        m.handlers.auto = () => { s.payroll.auto = !s.payroll.auto; g.save(); m.rerender(); };
        m.handlers.back = (id) => { const n = workersSys.reinstate(s, id); if (n) { this.audio.play('deal'); this.toast(`🤝 رجع للشغل بعد ما دفعت ${n}`, 'gain'); g.save(); } m.rerender(); this.refresh(); };
        m.handlers.fire = async (id) => { if (await this.confirm('متأكد تبي تطرده؟')) { workersSys.fire(s, id); g.save(); } m.rerender(); };
        m.handlers.cancel = (id) => { workersSys.cancelBuild(s, id); g.save(); m.rerender(); };
        m.handlers.assign = (id) => this.pickBuild(id, () => m.rerender());
      },
    });
  }

  renderHire(m) {
    const g = this.g;
    const s = g.state;
    const cands = workersSys.candidates(s, s.time.day);
    m.body.innerHTML = `<p class="muted">مرشحين اليوم (يتغيرون كل يوم باللعبة). الحد ${workersSys.workerCap(s)} عمّال — ابنِ "بيت العمّال" عشان توظف أكثر.</p>
      <div class="camels">${cands.map(c => {
        const T = WORKER_TYPES[c.type];
        const hired = s.workers.some(w => w.cid === c.cid);
        return `<div class="ccard"><div class="cpic" style="font-size:36px">${T.icon}</div><div class="cinfo"><h3>${esc(c.name)} <small class="muted">— ${T.name}</small></h3>
          <p>${T.desc}</p><div class="ctags"><span class="ctag">راتب ${c.wage}/ساعة</span><span class="ctag">سرعة ×${c.speed}</span><span class="ctag money">توظيف 🪙${c.hire}</span></div>
          <div class="row">${hired ? '<span class="muted">✔ توظّف</span>' : `<button class="btn green" data-a="hire" data-v="${c.cid}" ${s.player.coins >= c.hire && s.workers.length < workersSys.workerCap(s) ? '' : 'disabled'}>وظّفه</button>`}</div></div></div>`;
      }).join('')}</div>`;
    m.handlers.hire = (cid) => {
      const c = cands.find(x => x.cid === cid);
      const r = workersSys.hire(s, c);
      if (!r.ok) { this.audio.play('deny'); this.toast(r.reason === 'full' ? 'وصلت الحد، ابنِ بيت العمّال' : 'الدراهم ما تكفي'); return; }
      this.audio.play('deal');
      this.toast(`👷 ${c.name} صار يشتغل عندك! لا تنسى راتبه كل ساعة`, 'gain', 4);
      g.save();
      m.rerender();
    };
  }

  pickBuild(workerId, done) {
    const g = this.g;
    const s = g.state;
    const spots = Object.keys(BUILD_SPOTS).filter(id => g.worldObjById['spot:' + id] && !s.built[id] && (!spotStatus(s, id).hidden || g.worldObjById['spot:' + id].dynamic) && !s.workers.some(w => w.job && w.job.spot === id));
    this.modal({
      title: '🏗️ وش يبني؟', cls: 'small',
      render: (mm) => {
        mm.body.innerHTML = spots.map(id => {
          const st = spotStatus(s, id);
          return `<div class="shop-row"><span class="nm">${BUILD_SPOTS[id].name}<br>${this.costHtml(BUILD_SPOTS[id].cost)}</span>${st.ok ? `<button class="btn green" data-a="go" data-v="${id}">ابنِ</button>` : `<small class="muted">${esc(st.reason)}</small>`}</div>`;
        }).join('') || '<p class="muted">ما فيه شي تقدر تبنيه الحين.</p>';
        mm.handlers.go = (id) => {
          const r = workersSys.assignBuild(s, workerId, id);
          if (!r.ok) { this.toast(r.reason); return; }
          this.audio.play('build');
          this.toast(`🏗️ بدأ البناء: ${BUILD_SPOTS[id].name}`, 'gain');
          g.save(); mm.close(); done();
        };
      },
    });
  }

  // ---------- التجارة: البسطة، الطلبات، الجريدة، الغنم ----------
  openTrade(tab = 'stall') {
    const g = this.g;
    this.modal({
      title: '🏪 التجارة',
      render: (m) => {
        const s = g.state;
        const nowMin = g.absMinutes();
        this.tabs(m, [
          { id: 'stall', label: '🏪 البسطة', badge: s.stall.slots.filter(x => x && x.sold).length },
          { id: 'orders', label: '📋 الطلبات', badge: s.built.orders_board ? s.orders.filter(o => shop.canFulfill(s, o, nowMin)).length : 0 },
          { id: 'paper', label: '📰 الجريدة' },
          { id: 'sheep', label: '🐑 الغنم' },
        ], tab, (v) => { tab = v; m.rerender(); });
        if (tab === 'stall') this.renderStall(m);
        else if (tab === 'orders') this.renderOrders(m);
        else if (tab === 'paper') this.renderPaper(m);
        else this.renderSheep(m);
      },
    });
  }

  renderStall(m) {
    const g = this.g;
    const s = g.state;
    if (!s.built.stall_shop) { m.body.innerHTML = '<p>ابنِ <b>البسطة</b> على الطريق قدام الخان (موقع البناء جنب البوابة)، وتقدر تعرض فيها زرعك ومنتجاتك وغنمك، والمارّة يشترون حتى وأنت تشتغل. 🏪</p>'; return; }
    m.body.innerHTML = `<p class="muted">اعرض أي شي بالسعر اللي تبيه. كل ما رخّصت انباع أسرع، وإذا غليته ممكن ما أحد يشتريه.</p><div class="stall">${s.stall.slots.map((x, i) => {
      if (!x) return `<button class="slot sslot empty" data-a="add" data-v="${i}">＋<small>اعرض</small></button>`;
      const icon = x.kind === 'item' ? ITEMS[x.item].icon : '🐑';
      const name = x.kind === 'item' ? `${ITEMS[x.item].name} ×${x.qty}` : SHEEP_BREEDS[x.sheep.breed].name;
      if (x.sold) return `<button class="slot sslot sold" data-a="collect" data-v="${i}">${icon}<small>انباع لـ ${esc(x.buyer)}</small><b>🪙${x.price}</b></button>`;
      return `<button class="slot sslot" data-a="remove" data-v="${i}">${icon}<small>${name}</small><b>🪙${x.price}</b></button>`;
    }).join('')}</div>`;
    m.handlers.collect = (i) => { const n = shop.collect(s, Number(i)); if (n) { this.audio.play('coin'); g.fx.float(...g.fx.at(s.player.x, s.player.y, 30), `🪙 +${n}`, '#ffd24a', 15); g.save(); } m.rerender(); this.refresh(); };
    m.handlers.remove = async (i) => { if (await this.confirm('تسحب الغرض من البسطة؟')) { shop.unlistSlot(s, Number(i)); g.save(); } m.rerender(); };
    m.handlers.add = (i) => this.pickForStall(Number(i), () => m.rerender());
  }

  pickForStall(idx, done) {
    const g = this.g;
    const s = g.state;
    const items = Object.keys(s.inv).filter(id => ITEMS[id] && s.inv[id] > 0);
    this.modal({
      title: '🏪 وش تعرض؟', cls: 'small',
      render: (mm) => {
        mm.body.innerHTML = `<div class="inv">${items.map(id => `<button class="slot" data-a="it" data-v="${id}">${ITEMS[id].icon}<small>${ITEMS[id].name}</small><b>${s.inv[id]}</b></button>`).join('')}
          ${s.sheep.map(sh => `<button class="slot food" data-a="sh" data-v="${sh.id}">🐑<small>${SHEEP_BREEDS[sh.breed].name}</small></button>`).join('')}</div>`;
        mm.handlers.it = (id) => {
          mm.close();
          const max = s.inv[id];
          const qty = Math.min(max, 10);
          const base = ITEMS[id].price * qty;
          const r = shop.priceRange(base);
          this.numberPrompt({
            title: `${ITEMS[id].icon} ${ITEMS[id].name} ×${qty}`,
            text: `السعر المقترح: <b>🪙${r.suggested}</b> (المسموح ${r.min} إلى ${r.max}). الكمية ${qty} من ${max}.`,
            value: r.suggested, presets: [r.min, base, r.suggested, Math.round(base * 2)], ok: 'اعرض بالبسطة',
            onOk: (price) => { shop.listItem(s, idx, id, qty, price); this.audio.play('coin'); g.save(); done(); },
          });
        };
        mm.handlers.sh = (id) => {
          mm.close();
          const sh = s.sheep.find(x => x.id === id);
          const r = shop.priceRange(shop.sheepValue(sh));
          this.numberPrompt({
            title: `🐑 ${SHEEP_BREEDS[sh.breed].name}`, text: `السعر المقترح: <b>🪙${r.suggested}</b> (المسموح ${r.min} إلى ${r.max}).`,
            value: r.suggested, presets: [r.min, r.suggested, r.max], ok: 'اعرض بالبسطة',
            onOk: (price) => { shop.listSheep(s, idx, id, price); g.save(); done(); },
          });
        };
      },
    });
  }

  renderOrders(m) {
    const g = this.g;
    const s = g.state;
    if (!s.built.orders_board) { m.body.innerHTML = '<p>ابنِ <b>لوحة قافلة الطلبات</b> جنب الطريق. القوافل تطلب منك أغراض، وتدفع لك دراهم وخبرة وأحياناً صناديق! 📋</p>'; return; }
    const nowMin = g.absMinutes();
    shop.ensureOrders(s, g.rng, nowMin);
    m.body.innerHTML = `<div class="grid">${s.orders.map(o => {
      if (nowMin < o.readyAt) {
        const left = Math.ceil(o.readyAt - nowMin);
        return `<div class="card locked"><h3>🐪 قافلة جاية...</h3><p class="muted">توصل بعد ${left} دقيقة لعبة</p><button class="btn ad" data-a="rush" data-v="${o.id}">سرّعها</button></div>`;
      }
      const ok = shop.canFulfill(s, o, nowMin);
      return `<div class="card ${ok ? 'ready' : ''}"><h3>📋 طلب</h3>${this.costHtml(o.items)}
        <div class="ctags"><span class="ctag money">🪙${o.coins}</span><span class="ctag">✨${o.xp}</span>${o.chest ? '<span class="ctag gold">📦 صندوق</span>' : ''}</div>
        <div class="row"><button class="btn green" data-a="done" data-v="${o.id}" ${ok ? '' : 'disabled'}>سلّم 🐪</button><button class="btn mini2" data-a="drop" data-v="${o.id}">🗑️</button></div></div>`;
    }).join('')}</div>`;
    m.handlers.done = (id) => {
      const r = shop.fulfill(s, id, g.rng, g.absMinutes());
      if (!r) return;
      const bonus = events.mod(s, g.now(), 'ordersBonus');
      if (bonus) { r.coins = Math.round(r.coins * (1 + bonus)); events.addTokens(s, 3); }
      const up = placement.ordersBonus(s);
      if (up) r.coins = Math.round(r.coins * (1 + up));
      this.audio.play('deal');
      g.claimReward(r, null, true);
      m.rerender();
    };
    m.handlers.drop = (id) => { shop.discard(s, id, g.rng, g.absMinutes()); m.rerender(); };
    m.handlers.rush = async (id) => { if (await g.watchAd('energy')) { const o = s.orders.find(x => x.id === id); if (o) o.readyAt = 0; m.rerender(); } };
  }

  renderPaper(m) {
    const g = this.g;
    const s = g.state;
    const list = shop.newspaper(s, s.time.day);
    m.body.innerHTML = `<p class="muted">📰 جريدة السوق: بسطات تجّار ثانيين اليوم. اشترِ اللي ناقصك.</p><div class="shop-list">${list.map(p => `<div class="shop-row"><span class="ic">${ITEMS[p.item].icon}</span><span class="nm">${ITEMS[p.item].name} ×${p.qty}<br><small class="muted">بسطة ${esc(p.seller)}</small></span>
      ${p.sold ? '<span class="muted">انباعت</span>' : `<button class="btn" data-a="buy" data-v="${p.id}" ${s.player.coins >= p.price ? '' : 'disabled'}>🪙${p.price}</button>`}</div>`).join('')}</div>`;
    m.handlers.buy = (id) => { if (shop.buyFromPaper(s, id)) { this.audio.play('coin'); g.save(); } m.rerender(); this.refresh(); };
  }

  renderSheep(m) {
    const g = this.g;
    const s = g.state;
    if (!s.built.sheepfold) { m.body.innerHTML = '<p>ابنِ <b>حظيرة الغنم</b> جنب المزرعة، وبعدها تشتري طليان تربيها وتجز صوفها وتبيعها بالبسطة. 🐑</p>'; return; }
    const day = s.time.day;
    m.body.innerHTML = `<p>🐑 بالحظيرة ${s.sheep.length}/${SHEEP_CAP + placement.sheepCapBonus(s)}. يطعمون برسيم أو قمح أو أعشاب، والصوف كل يومين.</p>
      <div class="row">${Object.entries(SHEEP_BREEDS).map(([b, d]) => `<button class="btn" data-a="buy" data-v="${b}" ${s.player.coins >= sheepSys.lambPrice(b) ? '' : 'disabled'}>اشترِ طلي ${d.name} 🪙${sheepSys.lambPrice(b)}</button>`).join('')}</div>
      <div class="camels" style="margin-top:8px">${s.sheep.map(sh => `<div class="shop-row"><span class="ic">🐑</span><span class="nm">${SHEEP_BREEDS[sh.breed].name} — ${sh.ageDays >= 2 ? 'بالغ' : 'طلي'}<br><small class="muted">${sh.wateredDay === day ? '💧✔' : '💧✖'} ${sh.fedDay === day ? '🌿✔' : '🌿✖'} ${sheepSys.canShear(sh, day) ? '🧶 جاهز للجز' : ''} • ≈🪙${shop.sheepValue(sh)}</small></span></div>`).join('')}</div>`;
    m.handlers.buy = (b) => {
      const r = sheepSys.buyLamb(s, b, g.rng);
      if (!r.ok) { this.toast(r.reason); return; }
      this.audio.play('deal');
      this.toast(`🐑 اشتريت طلي ${SHEEP_BREEDS[b].name}!`, 'gain');
      g.save();
      m.rerender();
      this.refresh();
    };
  }

  // ---------- الحلال: المراح والسوق ----------
  camelImg(c, size = 60) {
    this.camelCache = this.camelCache || {};
    const key = (c.rare || c.breed);
    if (!this.camelCache[key]) this.camelCache[key] = camelSprite(camelColors(c), 0, key).toDataURL();
    const sc = camels.isAdult(c) ? 1 : 0.7;
    return `<img class="cimg ${c.rare ? 'rare' : ''}" src="${this.camelCache[key]}" style="width:${Math.round(size * sc)}px" alt="">`;
  }

  traitChips(c) {
    camels.ensureTraits(c);
    return c.traits.filter(t => TRAITS[t]).map(t => `<span class="ctag trait ${TRAITS[t].tier}" title="${esc(TRAITS[t].desc)}">${TRAITS[t].icon} ${TRAITS[t].name}</span>`).join('');
  }

  camelTag(c) {
    const s = this.g.state;
    camels.ensureTraits(c);
    const v = market.valueOf(s, c);
    return this.traitChips(c) + `<span class="ctag">${c.sex === 'f' ? '♀ ناقة' : '♂ فحل'}</span><span class="ctag ${c.rare ? 'gold' : ''}">${c.rare ? '✨ ' : ''}${camelBreedName(c)}</span><span class="ctag">جمال ${c.beauty}</span><span class="ctag">${camels.isAdult(c) ? 'بالغ' : 'حوار'}</span><span class="ctag money">≈ 🪙${market.fmt(v)}</span>`;
  }

  openCamels(focusId, tab) {
    const g = this.g;
    const s = g.state;
    market.refreshDaily(s, s.time.day);
    tab = tab || (market.openOffersCount(s) ? 'mine' : 'pen');
    this.modal({
      title: '🐪 الحلال',
      render: (m) => {
        const friday = time.weekday(s) === 6;
        this.tabs(m, [
          { id: 'pen', label: '🏠 مراحي' },
          { id: 'market', label: '🛒 سوق الحلال' },
          { id: 'mine', label: '📩 عروضي', badge: market.openOffersCount(s) },
          { id: 'barter', label: '🔁 مقايضة', badge: s.market.barters.filter(b => !b.closed).length },
          { id: 'mazayen', label: friday ? '🏆 مزاين (اليوم!)' : '🏆 مزاين' },
        ], tab, (v) => { tab = v; m.rerender(); });
        if (tab === 'pen') this.renderPen(m, focusId);
        else if (tab === 'market') this.renderMarket(m);
        else if (tab === 'mine') this.renderMine(m);
        else if (tab === 'barter') this.renderBarter(m);
        else this.renderMazayen(m);
      },
    });
  }

  renderPen(m, focusId) {
    const g = this.g;
    const s = g.state;
    const day = s.time.day;
    if (!s.built.stable) {
      m.body.innerHTML = `<p>ما عندك مراح للحين. تعلّم <b>مراح الإبل</b> من المعرفة وابنه جنب المزرعة، والراعي بيهديك ناقة وفحل! 🐪</p><p class="muted">تقدر تتفرج على سوق الحلال من الحين.</p>`;
      return;
    }
    const cap = camels.capacity(s);
    const blessAvail = !s.blessNext && s.blessDay !== day;
    const list = [...s.camels].sort((a, b) => (b.id === focusId) - (a.id === focusId) || (b.rare ? 1 : 0) - (a.rare ? 1 : 0));
    m.body.innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:6px">
        <span><b>${s.camels.length}/${cap}</b> بالمراح • 🏺 الحوض ${s.built.trough ? `${s.trough.water}/${TROUGH_CAP}` : '(ما انبنى)'} • 🌿 برسيم ${count(s, 'alfalfa')}</span>
        ${s.blessNext ? '<span class="ctag gold">🙏 البركة مفعّلة: 4% للولادة الجاية</span>' : blessAvail ? '<button class="btn ad" data-a="bless">بركة: فرصة النادرة ×2</button>' : ''}
      </div>
      <p class="muted">كل يوم: اسقِ وأطعم كل ناقة (اقرب منها واضغط زر الفعل). التلقيح يحتاج فحل وناقة بالغين شابعين وشاربين، والحمل ${GESTATION_DAYS} أيام، وفيه فرصة <b>2%</b> تطلع نادرة!</p>
      <div class="camels">${list.map(c => {
        const listed = s.market.myListings.find(l => l.camelId === c.id);
        const st = [];
        st.push(camels.isWatered(c, day) ? '💧✔' : '💧✖');
        st.push(camels.isFed(c, day) ? '🌿✔' : '🌿✖');
        if (c.pregnant) st.push(`🤰 باقي ${camels.gestationDays(c) - c.pregnant.days} يوم`);
        if (camels.canMilk(c, day)) st.push('🥛 جاهزة للحلب');
        const canBreed = c.sex === 'f' && camels.isAdult(c) && !c.pregnant;
        return `<div class="ccard ${c.rare ? 'rare' : ''} ${c.id === focusId ? 'focus' : ''}">
          <div class="cpic">${this.camelImg(c)}</div>
          <div class="cinfo"><h3>${esc(c.name)} <button class="mini" data-a="rename" data-v="${c.id}">✏️</button></h3>
            <div class="ctags">${this.camelTag(c)}</div>
            <div class="muted">${st.join(' • ')}</div>
            <div class="row">${canBreed ? `<button class="btn green" data-a="breed" data-v="${c.id}">لقّح 💞</button>` : ''}
              ${listed ? `<span class="ctag">معروضة بـ 🪙${market.fmt(listed.ask)}</span><button class="btn" data-a="unlist" data-v="${listed.id}">اسحبها</button>` : `<button class="btn" data-a="list" data-v="${c.id}">اعرضها بالسوق 🏷️</button>`}
            </div></div></div>`;
      }).join('') || '<p class="muted">المراح فاضي. اشترِ من سوق الحلال!</p>'}</div>`;
    m.handlers.bless = async () => {
      const ok = await g.watchAd('bless');
      if (!ok) return;
      s.blessNext = true;
      s.blessDay = day;
      this.toast('🙏 البركة! فرصة النادرة صارت 4% للولادة الجاية', 'ach', 3);
      m.rerender();
    };
    m.handlers.breed = (fid) => this.pickMale(fid, () => m.rerender());
    m.handlers.list = (id) => this.listPrompt(id, () => m.rerender());
    m.handlers.unlist = (id) => { market.unlist(s, id); m.rerender(); };
    m.handlers.rename = (id) => this.renamePrompt(id, () => m.rerender());
  }

  pickMale(fid, done) {
    const g = this.g;
    const s = g.state;
    const day = s.time.day;
    const males = s.camels.filter(c => c.sex === 'm' && camels.isAdult(c));
    this.modal({
      title: '💞 اختر الفحل', cls: 'small',
      render: (mm) => {
        mm.body.innerHTML = males.length ? males.map(c => {
          const why = camels.breedBlocker(s, c.id, fid, day);
          return `<div class="shop-row">${this.camelImg(c, 40)}<span class="nm">${esc(c.name)}<br><small class="muted">${camelBreedName(c)} • جمال ${c.beauty}</small></span>
            ${why ? `<small class="muted">${why}</small>` : `<button class="btn green" data-a="go" data-v="${c.id}">لقّح</button>`}</div>`;
        }).join('') : '<p class="muted">ما عندك فحل بالغ. اشترِ واحد من السوق.</p>';
        mm.handlers.go = (mid) => {
          if (!camels.breed(s, mid, fid, day, s.blessNext)) { this.audio.play('deny'); return; }
          s.blessNext = false;
          this.audio.play('camel');
          g.fx.burst(...g.fx.at(s.player.x, s.player.y, 20), ['#ff6a8a', '#ffd24a'], 14, 60, 0.8);
          this.toast(`💞 تم التلقيح! الحوار يوصل بعد ${camels.gestationDays(camels.camelById(s, fid))} أيام`, 'gain', 3);
          g.save();
          mm.close();
          done();
        };
      },
    });
  }

  listPrompt(camelId, done) {
    const g = this.g;
    const s = g.state;
    const c = camels.camelById(s, camelId);
    const v = market.valueOf(s, c);
    this.numberPrompt({
      title: `🏷️ اعرض ${c.name} بالسوق`,
      text: `القيمة التقديرية حسب السوق اليوم: <b>🪙${market.fmt(v)}</b>. إذا طلبت أعلى بكثير، العروض بتجي أقل وتحتاج مساومة.`,
      value: Math.round(v * 1.15), presets: [Math.round(v), Math.round(v * 1.2), Math.round(v * 1.5)],
      ok: 'اعرض',
      onOk: (price) => {
        market.listCamel(s, camelId, price, g.now());
        this.toast('🏷️ انعرضت! المشترين بيراسلونك بعد شوي', 'gain', 3);
        g.save();
        done();
      },
    });
  }

  renamePrompt(id, done) {
    const c = camels.camelById(this.g.state, id);
    this.modal({
      title: '✏️ سمّها', cls: 'small',
      render: (mm) => {
        mm.body.innerHTML = `<input id="nameIn" class="numin" maxlength="16" value="${esc(c.name)}"><div class="row center" style="margin-top:8px"><button class="btn green" data-a="ok">حفظ</button></div>`;
        mm.handlers.ok = () => { const v = mm.body.querySelector('#nameIn').value.trim(); if (v) c.name = v; this.g.save(); mm.close(); done(); };
      },
    });
  }

  numberPrompt({ title, text, value, presets = [], ok, onOk }) {
    this.modal({
      title, cls: 'small',
      render: (mm) => {
        mm.body.innerHTML = `<p>${text}</p><div class="row center"><button class="btn" data-a="dec">−10%</button><input id="numIn" class="numin" type="number" inputmode="numeric" value="${value}"><button class="btn" data-a="inc">+10%</button></div>
          <div class="row center" style="margin-top:6px">${presets.map(p => `<button class="btn mini2" data-a="set" data-v="${p}">${market.fmt(p)}</button>`).join('')}</div>
          <div class="row center" style="margin-top:8px"><button class="btn green big" data-a="ok">${ok}</button></div>`;
        const inp = mm.body.querySelector('#numIn');
        inp.addEventListener('keydown', e => e.stopPropagation());
        mm.handlers.dec = () => { inp.value = Math.max(1, Math.round(Number(inp.value) * 0.9)); };
        mm.handlers.inc = () => { inp.value = Math.round(Number(inp.value) * 1.1); };
        mm.handlers.set = (v) => { inp.value = v; };
        mm.handlers.ok = () => { const n = Math.round(Number(inp.value)); if (!(n > 0)) return; mm.close(); onOk(n); };
      },
    });
  }

  renderMarket(m) {
    const g = this.g;
    const s = g.state;
    const mk = s.market;
    const idxRow = Object.entries(BREEDS).map(([b, d]) => {
      const now = mk.index[b] || 1, prev = (mk.prevIndex && mk.prevIndex[b]) || now;
      const up = now >= prev;
      return `<span class="ctag"><b>${d.name}</b> ${Math.round(now * 100)}% <span style="color:${up ? '#2a8a2a' : '#c0302a'}">${up ? '▲' : '▼'}</span></span>`;
    }).join('');
    const open = mk.listings.filter(l => !l.closed);
    m.body.innerHTML = `<div class="ctags" style="margin-bottom:6px">📈 مؤشر السوق: ${idxRow}</div>
      <p class="muted">العروض تتجدد كل يوم باللعبة. كل بياع له طبعه: فيه الكريم وفيه المفاصل وفيه النصّاب. ساوم بذكاء!</p>
      <div class="camels">${open.map(l => `<div class="ccard ${l.camel.rare ? 'rare' : ''}"><div class="cpic">${this.camelImg(l.camel)}</div>
        <div class="cinfo"><h3>${esc(l.camel.name)} <small class="muted">— البياع: ${esc(l.seller)}</small></h3><div class="ctags">${this.camelTag(l.camel)}</div>
        <div class="row"><b class="price">🪙 ${market.fmt(l.ask)}</b>${l.angry ? '<span class="muted">😤 زعلان منك</span>' : `<button class="btn green" data-a="buy" data-v="${l.id}" ${s.player.coins >= l.ask ? '' : 'disabled'}>اشترِ</button><button class="btn" data-a="haggle" data-v="${l.id}">ساوم 💬</button>`}</div></div></div>`).join('') || '<p class="muted">خلصت عروض اليوم. ارجع بكرة!</p>'}</div>`;
    const after = (res) => {
      if (res.result === 'bought') {
        this.audio.play('deal');
        g.fx.confetti(...g.fx.at(s.player.x, s.player.y, 20));
        this.toast(`🤝 اشتريت ${res.camel.name} بـ ${market.fmt(res.price)}! تلقاها بالمراح`, 'gain', 4);
        g.save();
      } else if (res.result === 'poor') this.toast('ما عندك دراهم تكفي 💸');
      else if (res.result === 'full') this.toast('المراح مليان! وسّعه أو بيع');
      else if (res.result === 'nostable') this.toast('ابنِ المراح أول 🐪');
      m.rerender();
      this.refresh();
    };
    m.handlers.buy = (id) => after(market.buyAtAsk(s, id));
    m.handlers.haggle = (id) => {
      const l = mk.listings.find(x => x.id === id);
      if (!l.log.length) l.log.push({ who: 'them', text: market.LINES.sellerOpen[0].replace('{x}', market.fmt(l.ask)) });
      this.haggleChat({
        title: `💬 ${l.seller}`, sub: `${l.camel.name} — ${camelBreedName(l.camel)}`,
        log: () => l.log, current: () => l.ask, start: Math.round(l.ask * 0.75), acceptLabel: () => `اشترِ بـ ${market.fmt(l.ask)}`,
        send: (n) => market.haggleBuy(s, id, n, g.rng),
        accept: () => market.buyAtAsk(s, id),
        onResult: (res) => { if (res.result === 'bought' || res.result === 'poor' || res.result === 'full' || res.result === 'nostable') { after(res); return true; } return res.result === 'leave'; },
        done: () => m.rerender(),
      });
    };
  }

  renderMine(m) {
    const g = this.g;
    const s = g.state;
    const mk = s.market;
    m.body.innerHTML = mk.myListings.length ? mk.myListings.map(l => {
      const c = camels.camelById(s, l.camelId);
      if (!c) return '';
      const offers = mk.offers.filter(o => o.listingId === l.id && !o.closed).sort((a, b) => b.amount - a.amount);
      return `<div class="ccard ${c.rare ? 'rare' : ''}"><div class="cpic">${this.camelImg(c)}</div><div class="cinfo">
        <h3>${esc(c.name)} <small class="muted">— طالب 🪙${market.fmt(l.ask)}</small></h3>
        ${offers.length ? offers.map(o => `<div class="offer"><span>📩 <b>${esc(o.buyer)}</b>: 🪙 <b class="price">${market.fmt(o.amount)}</b></span>
          <button class="btn green" data-a="accept" data-v="${o.id}">بيع 🤝</button><button class="btn" data-a="counter" data-v="${o.id}">ساوم 💬</button><button class="btn mini2" data-a="reject" data-v="${o.id}">✖</button></div>`).join('') : '<p class="muted">⏳ ننتظر المشترين... العروض تجي مع الوقت.</p>'}
        <button class="btn mini2" data-a="unlist" data-v="${l.id}">اسحب العرض</button></div></div>`;
    }).join('') + (mk.history.length ? `<h3>📜 آخر الصفقات</h3>${mk.history.slice(0, 6).map(h => `<div class="muted">${h.type === 'sell' ? '💰 بعت' : h.type === 'buy' ? '🛒 شريت' : '🔁 قايضت'} ${esc(h.name)}${h.got ? ' بـ ' + esc(h.got) : ''} ${h.price ? '🪙' + market.fmt(h.price) : ''} — ${esc(h.to)}</div>`).join('')}` : '')
      : '<p class="muted">ما عرضت شي. روح لـ "مراحي" واضغط "اعرضها بالسوق" 🏷️</p>';
    m.handlers.accept = (id) => this.sellDone(market.acceptOffer(s, id), m);
    m.handlers.reject = (id) => { market.rejectOffer(s, id); m.rerender(); this.refresh(); };
    m.handlers.unlist = (id) => { market.unlist(s, id); m.rerender(); this.refresh(); };
    m.handlers.counter = (id) => {
      const o = mk.offers.find(x => x.id === id);
      const l = mk.myListings.find(x => x.id === o.listingId);
      this.haggleChat({
        title: `💬 ${o.buyer}`, sub: 'يبي يشتري ناقتك',
        log: () => o.log, current: () => o.amount, start: Math.round(Math.max(o.amount * 1.25, l ? l.ask : 0)), acceptLabel: () => `بيع بـ ${market.fmt(o.amount)}`, sendLabel: 'اطلب',
        send: (n) => market.counterOffer(s, id, n, g.rng),
        accept: () => market.acceptOffer(s, id),
        onResult: (res) => {
          if (res && res.price !== undefined) { this.sellDone(res, m); return true; }
          if (res && res.result === 'accept') { this.sellDone(market.acceptOffer(s, id), m); return true; }
          return !res || res.result === 'leave';
        },
        done: () => { m.rerender(); this.refresh(); },
      });
    };
  }

  sellDone(res, m) {
    const g = this.g;
    if (!res) return;
    const s = g.state;
    this.audio.play(res.camel && res.camel.rare ? 'rare' : 'deal');
    g.fx.confetti(...g.fx.at(s.player.x, s.player.y, 20));
    if (res.price >= 20000) g.fx.goldRain(...g.fx.at(s.player.x, s.player.y, 60), 200);
    this.toast(`🤝 بعت ${res.camel ? res.camel.name : ''} على ${res.buyer} بـ ${market.fmt(res.price)} درهم!`, res.price >= 20000 ? 'ach' : 'gain', 4);
    g.save();
    if (m) m.rerender();
    this.refresh();
  }

  renderBarter(m) {
    const g = this.g;
    const s = g.state;
    const list = s.market.barters.filter(b => !b.closed);
    m.body.innerHTML = `<p class="muted">مقايضة: تاجر يبي وحدة من نياقك، ويعطيك ناقته مع فرق دراهم. تقدر تطلب فرق أكثر.</p>` + (list.map(b => {
      const mine = camels.camelById(s, b.wantId);
      if (!mine) return '';
      return `<div class="barter"><div class="bside">${this.camelImg(mine, 50)}<b>${esc(mine.name)}</b><small>${camelBreedName(mine)} • جمال ${mine.beauty}</small><small>≈🪙${market.fmt(market.valueOf(s, mine))}</small></div>
        <div class="barrow">⇄<br><b>${b.coins ? '+ 🪙' + market.fmt(b.coins) : 'بدون فرق'}</b><br><small>${esc(b.trader)}</small></div>
        <div class="bside">${this.camelImg(b.give, 50)}<b>${esc(b.give.name)}</b><small>${camelBreedName(b.give)} • جمال ${b.give.beauty}</small><small>≈🪙${market.fmt(market.valueOf(s, b.give))}</small></div>
        <div class="bact"><button class="btn green" data-a="acc" data-v="${b.id}">قايض 🔁</button><button class="btn" data-a="hag" data-v="${b.id}">زِد الفرق 💬</button></div></div>`;
    }).join('') || '<p class="muted">ما فيه عروض مقايضة اليوم. (تحتاج يكون عندك نياق)</p>');
    m.handlers.acc = (id) => {
      const r = market.acceptBarter(s, id);
      if (!r) return;
      this.audio.play('deal');
      this.toast(`🔁 قايضت ${r.gave.name} بـ ${r.got.name}${r.coins ? ' + ' + market.fmt(r.coins) + ' درهم' : ''}`, 'gain', 4);
      g.save();
      m.rerender();
    };
    m.handlers.hag = (id) => {
      const b = s.market.barters.find(x => x.id === id);
      this.haggleChat({
        title: `💬 ${b.trader}`, sub: 'مقايضة: كم الفرق؟',
        log: () => b.log, current: () => b.coins, start: Math.round(Math.max(100, b.coins * 1.5)), acceptLabel: () => `قايض + ${market.fmt(b.coins)}`, sendLabel: 'اطلب فرق',
        send: (n) => market.haggleBarter(s, id, n, g.rng),
        accept: () => market.acceptBarter(s, id),
        onResult: (res) => {
          if (res && res.got) { this.audio.play('deal'); this.toast(`🔁 تمت المقايضة! جتك ${res.got.name}`, 'gain', 3); g.save(); return true; }
          if (res && res.result === 'accept') { const r2 = market.acceptBarter(s, id); if (r2) { this.audio.play('deal'); this.toast(`🔁 تمت المقايضة + ${market.fmt(r2.coins)}`, 'gain', 3); g.save(); } return true; }
          return !res || res.result === 'leave';
        },
        done: () => m.rerender(),
      });
    };
  }

  // نافذة مساومة على شكل محادثة
  haggleChat({ title, sub, log, current, start, acceptLabel, sendLabel = 'أرسل عرضي', send, accept, onResult, done }) {
    let value = start;
    let finished = false;
    this.modal({
      title, cls: 'small', onClose: done,
      render: (mm) => {
        mm.body.innerHTML = `<p class="muted">${esc(sub)}</p><div class="chat">${log().map(x => `<div class="msg ${x.who}">${esc(x.text)}</div>`).join('')}</div>
          ${finished ? '<div class="row center"><button class="btn big" data-a="close">تمام</button></div>' : `<div class="row center"><button class="btn" data-a="dec">−10%</button><input id="hagIn" class="numin" type="number" inputmode="numeric" value="${value}"><button class="btn" data-a="inc">+10%</button></div>
          <div class="row center" style="margin-top:6px"><button class="btn blue" data-a="send">${sendLabel} 💬</button><button class="btn green" data-a="acc">${acceptLabel()} 🤝</button></div>`}`;
        const chat = mm.body.querySelector('.chat');
        chat.scrollTop = chat.scrollHeight;
        const inp = mm.body.querySelector('#hagIn');
        if (inp) inp.addEventListener('keydown', e => e.stopPropagation());
        mm.handlers.dec = () => { inp.value = Math.max(1, Math.round(Number(inp.value) * 0.9)); };
        mm.handlers.inc = () => { inp.value = Math.round(Number(inp.value) * 1.1); };
        mm.handlers.send = () => {
          value = Math.round(Number(inp.value));
          if (!(value > 0)) return;
          this.audio.play('talk');
          const res = send(value);
          if (onResult(res)) finished = true;
          if (res && res.result === 'leave') this.audio.play('deny');
          mm.rerender();
        };
        mm.handlers.acc = () => {
          const res = accept();
          if (onResult(res)) { finished = true; mm.close(); return; }
          mm.rerender();
        };
      },
    });
  }

  renderMazayen(m) {
    const g = this.g;
    const s = g.state;
    const friday = time.weekday(s) === 6;
    const week = Math.floor((s.time.day - 1) / 7);
    const adults = s.camels.filter(c => camels.isAdult(c));
    if (!friday) { m.body.innerHTML = '<p>🏆 مزاين الإبل تنقام <b>كل جمعة</b> باللعبة. جهّز أجمل ناقة عندك! الجمال يتورّث من الأبوين، والنادرة لها بونص كبير.</p>'; return; }
    if (s.mazayenWeek === week) { m.body.innerHTML = '<p>شاركت بمزاين هالأسبوع ✔ ارجع الجمعة الجاية.</p>'; return; }
    m.body.innerHTML = `<p>🏆 اختر ناقة تشارك فيها بمزاين الجمعة:</p>` + (adults.map(c => `<div class="shop-row">${this.camelImg(c, 44)}<span class="nm">${esc(c.name)}<br><small class="muted">${camelBreedName(c)} • جمال ${c.beauty}</small></span><button class="btn green" data-a="enter" data-v="${c.id}">شارك</button></div>`).join('') || '<p class="muted">ما عندك نياق بالغة.</p>');
    m.handlers.enter = (id) => {
      const c = camels.camelById(s, id);
      s.mazayenWeek = week;
      const rng = g.rng;
      const my = c.beauty + (c.rare ? 40 : 0) + Math.round(rng() * 25);
      const rivals = market.TRADER_NAMES.slice().sort(() => rng() - 0.5).slice(0, 5).map(n => ({ n, sc: 30 + Math.round(rng() * 70) }));
      const board = [...rivals, { n: 'أنت: ' + c.name, sc: my, me: true }].sort((a, b) => b.sc - a.sc);
      const rank = board.findIndex(x => x.me) + 1;
      const prize = [null, { coins: 800, chest: 'rare', xp: 50 }, { coins: 400, xp: 30 }, { coins: 200, xp: 20 }][rank] || { coins: 50, xp: 10 };
      if (rank === 1) addStat(s, 'mazayenWins', 1);
      m.body.innerHTML = `<h3>${rank === 1 ? '🥇 فزت بالمركز الأول!' : `المركز ${rank}`}</h3><ol class="board">${board.map(x => `<li class="${x.me ? 'me' : ''}">${esc(x.n)} — ${x.sc}</li>`).join('')}</ol><div class="row center"><button class="btn green big" data-a="close">استلم الجائزة</button></div>`;
      g.claimReward(prize, null, true);
      if (rank === 1) g.fx.confetti(...g.fx.at(s.player.x, s.player.y, 20));
    };
  }

  rareBirth(calf) {
    const g = this.g;
    const s = g.state;
    const v = market.valueOf(s, calf);
    g.fx.goldRain(...g.fx.at(s.player.x, s.player.y, 80), 260);
    g.shake = 6;
    this.modal({
      title: '✨ ناقة نادرة! ✨', cls: 'small rarebirth',
      render: (m) => {
        m.body.innerHTML = `<div class="reveal shine rarity-legendary"><div class="rare-pic">${this.camelImg(calf, 100)}</div>
          <h2 class="rare-title">مبروك! ${esc(RARES[calf.rare].name)}</h2>
          <p>ولدت لك <b>${esc(calf.name)}</b> — نادرة <b>1 من 50</b>!</p>
          <p class="rare-value">قيمتها التقديرية: 🪙 ${market.fmt(v)}</p></div>
          <div class="row center"><button class="btn big" data-a="close">خلها بالمراح</button><button class="btn green big" data-a="sell">اعرضها بالسوق 🏷️</button></div>`;
        m.handlers.sell = () => { m.close(); this.listPrompt(calf.id, () => {}); };
      },
    });
  }

  // ---------- نوافذ المكافأة ----------
  // عرض مكافأة مع خيار المضاعفة بإعلان
  offer({ title, subtitle, reward, ad }) {
    const g = this.g;
    return new Promise((resolve) => {
      this.audio.play('chest');
      this.modal({
        title, cls: 'small', closable: false,
        render: (m) => {
          const canAd = ad && retention.adsLeft(g.state, g.now()) > 0;
          m.body.innerHTML = `<div class="reveal shine"><div class="big-ic">🎁</div><p>${esc(subtitle || '')}</p>${this.gainsHtml(describeReward(reward))}</div>
            <div class="row center">${canAd ? `<button class="btn ad big" data-a="x2">ضاعفها ×2</button>` : ''}<button class="btn green big" data-a="x1">استلم</button></div>`;
          m.handlers.x1 = () => { m.close(); resolve('x1'); };
          m.handlers.x2 = async () => {
            const ok = await g.watchAd(ad);
            m.close();
            resolve(ok ? 'x2' : 'x1');
          };
        },
      });
    });
  }

  chest(rarity, contents) {
    const g = this.g;
    return new Promise((resolve) => {
      const def = CHESTS[rarity];
      this.modal({
        title: def.name, cls: 'small', closable: false,
        render: (m) => {
          const icon = rarity === 'legendary' ? '👑' : rarity === 'rare' ? '💎' : '📦';
          m.body.innerHTML = `<div class="reveal shine rarity-${rarity}"><div class="big-ic">${icon}</div><p class="muted">جاري الفتح...</p></div>`;
          setTimeout(() => {
            if (m.closed) return;
            this.audio.play('chest');
            g.fx.confetti(...g.fx.at(g.state.player.x, g.state.player.y, 20));
            const canAd = retention.adsLeft(g.state, g.now()) > 0;
            m.body.innerHTML = `<div class="reveal shine rarity-${rarity}"><div class="big-ic">✨${icon}✨</div>${this.gainsHtml(describeReward(contents))}</div>
              <div class="row center">${canAd ? '<button class="btn ad big" data-a="x2">ضاعف الصندوق</button>' : ''}<button class="btn green big" data-a="x1">خذها</button></div>`;
          }, 900);
          m.handlers.x1 = () => { m.close(); resolve('x1'); };
          m.handlers.x2 = async () => {
            const ok = await g.watchAd('chest_x2');
            m.close();
            resolve(ok ? 'x2' : 'x1');
          };
        },
      });
    });
  }

  gains(title, res) {
    const all = [...res.gains];
    for (const c of res.chests) {
      all.push({ icon: c.rarity === 'legendary' ? '👑' : c.rarity === 'rare' ? '💎' : '📦', text: CHESTS[c.rarity].name + ':' });
      all.push(...c.gains);
    }
    if (!title) { this.gainToast(all.slice(0, 6)); return; }
    this.modal({
      title, cls: 'small',
      render: (m) => {
        m.body.innerHTML = `<div class="reveal shine"><div class="big-ic">🎉</div>${this.gainsHtml(all)}</div><div class="row center"><button class="btn green big" data-a="close">حلو!</button></div>`;
      },
    });
  }

  levelUp(level, gains, chests) {
    const all = [...gains];
    for (const c of chests || []) all.push(...c.gains);
    this.modal({
      title: '⬆️ مستوى جديد!', cls: 'small',
      render: (m) => {
        m.body.innerHTML = `<div class="reveal shine"><div class="big-ic">🎉</div><h2 style="font:700 30px Kufi,Cairo;margin:4px 0;color:var(--red)">المستوى ${level}</h2>${this.gainsHtml(all)}</div><div class="row center"><button class="btn green big" data-a="close">يا سلام!</button></div>`;
      },
    });
  }

  energyPrompt() {
    const g = this.g;
    const s = g.state;
    if (this.modals.some(m => m.kind === 'energy')) return;
    const m = this.modal({
      title: '😩 طاقتك خلصت', cls: 'small',
      render: (mm) => {
        const foods = Object.keys(s.inv).filter(id => ITEMS[id] && ITEMS[id].food && s.inv[id] > 0);
        const canAd = retention.adsLeft(s, g.now()) > 0;
        mm.body.innerHTML = `<p>تعبت يا بطل! كل شي، أو نام بفراشك، أو خذ دفعة طاقة.</p>
          ${foods.length ? `<div class="inv">${foods.map(id => `<button class="slot food" data-a="eat" data-v="${id}">${ITEMS[id].icon}<small>+${ITEMS[id].food}⚡</small><b>${s.inv[id]}</b></button>`).join('')}</div>` : '<p class="muted">ما عندك أكل. التمر يطيح من النخل، والقهوة من الموقد.</p>'}
          <div class="row center" style="margin-top:8px">${canAd ? '<button class="btn ad big" data-a="ad">عبّي الطاقة كاملة</button>' : ''}</div>`;
        mm.handlers.eat = (id) => { g.eat(id); if (s.player.energy >= maxEnergy(s) * 0.5) mm.close(); else mm.rerender(); };
        mm.handlers.ad = async () => {
          const ok = await g.watchAd('energy');
          if (ok) { s.player.energy = maxEnergy(s); this.toast('⚡ طاقة كاملة!', 'gain'); }
          mm.close();
        };
      },
    });
    m.kind = 'energy';
  }

  chooseFloor(max) {
    return new Promise((resolve) => {
      this.modal({
        title: '🕯️ السرداب', cls: 'small', onClose: () => resolve(0),
        render: (m) => {
          const names = ['', 'الطابق الأول', 'الطابق الثاني', 'الطابق الثالث'];
          m.body.innerHTML = `<p>أي طابق تبي تنزل؟</p><div class="row center">${[1, 2, 3].filter(f => f <= max).map(f => `<button class="btn big" data-a="f" data-v="${f}">${names[f]}</button>`).join('')}</div>`;
          m.handlers.f = (v) => { resolve(Number(v)); m.close(); };
        },
      });
    });
  }

  downPrompt() {
    const g = this.g;
    return new Promise((resolve) => {
      this.modal({
        title: '💫 طحت!', cls: 'small', closable: false,
        render: (m) => {
          const canAd = retention.adsLeft(g.state, g.now()) > 0;
          m.body.innerHTML = `<p>الوحوش غلبتك هالمرة...</p><div class="row center">${canAd ? '<button class="btn ad big" data-a="revive">كمّل بصحة كاملة</button>' : ''}<button class="btn big" data-a="wake">ارجع لفراشك</button></div>`;
          m.handlers.revive = async () => {
            const ok = await g.watchAd('revive');
            m.close();
            resolve(ok ? 'revive' : 'wake');
          };
          m.handlers.wake = () => { m.close(); resolve('wake'); };
        },
      });
    });
  }

  fadeSleep() {
    return new Promise((resolve) => {
      this.fading = true;
      const f = $('fade');
      f.textContent = '💤 تصبح على خير...';
      f.classList.add('on');
      setTimeout(() => {
        resolve();
        f.textContent = '🌅';
        setTimeout(() => { f.classList.remove('on'); this.fading = false; }, 700);
      }, 1300);
    });
  }

  adSimulator(placement) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'adsim';
      const total = AD_SECONDS;
      el.innerHTML = `<button class="adclose" data-x>✕</button><div>📺 إعلان تجريبي</div><div class="muted" style="color:#aaa">${esc(AD_PLACEMENTS[placement] || '')}</div>
        <div class="count">${total}</div><div class="adbar"><i></i></div>
        <div style="color:#aaa;font-size:12px">كمّل الإعلان لآخره عشان تاخذ المكافأة • (بالجوال يطلع إعلان AdMob حقيقي)</div>`;
      document.getElementById('game').appendChild(el);
      el.addEventListener('pointerdown', e => e.stopPropagation());
      let n = total;
      const bar = el.querySelector('.adbar i');
      const iv = setInterval(() => {
        n--;
        el.querySelector('.count').textContent = n;
        bar.style.width = ((total - n) / total) * 100 + '%';
        if (n <= 0) { clearInterval(iv); el.remove(); resolve(true); }
      }, window.__fastAds ? 20 : 1000);
      el.querySelector('[data-x]').addEventListener('click', () => {
        if (n <= 0) return;
        clearInterval(iv);
        el.remove();
        this.toast('سكّرت الإعلان قبل لا يخلص، ما في مكافأة');
        resolve(false);
      });
    });
  }
}

function doubleIt(r) {
  const d = { ...r };
  if (d.coins) d.coins *= 2;
  if (d.items) d.items = Object.fromEntries(Object.entries(d.items).map(([k, v]) => [k, v * 2]));
  if (d.kp) d.kp = Object.fromEntries(Object.entries(d.kp).map(([k, v]) => [k, v * 2]));
  if (d.chest) d.xp = (d.xp || 0) + 30;
  return d;
}

function drawWheel(c) {
  const ctx = c.getContext('2d');
  const n = WHEEL.length;
  const cx = 250, cy = 250, r = 240;
  const seg = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + i * seg, a1 = a0 + seg;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = WHEEL[i].color;
    ctx.fill();
    ctx.strokeStyle = '#f6e7c8';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a0 + seg / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.font = '700 44px Cairo, sans-serif';
    ctx.translate(r * 0.66, 0);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(WHEEL[i].label, 0, 0);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#6b3f1f';
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.fillStyle = '#e8b53a';
  ctx.fill();
  ctx.font = '40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🌴', cx, cy + 2);
}

installHub(UI);
