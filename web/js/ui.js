// الواجهة: الشريط العلوي، الحوار، النوافذ، المكافآت
import { ITEMS, RELICS, RELIC_SETS, itemIcon, itemName } from './data/items.js';
import { RECIPES, STATIONS, BUILD_SPOTS } from './data/recipes.js';
import { TECH, TECH_BY_ID, KP_TYPES } from './data/tech.js';
import { NPCS, WEEKDAYS, WEEKDAY_ICONS } from './data/npcs.js';
import { MAIN_QUESTS } from './data/quests.js';
import { DAILY_CALENDAR, WHEEL, CHESTS, ACHIEVEMENTS, ACH_TIER_NAMES, ACH_TIER_REWARDS, DAILY_QUEST_BONUS, AD_PLACEMENTS } from './data/rewards.js';
import { count, has, add, addStat } from './systems/inventory.js';
import { recipesFor, craft, spotStatus, techStatus, learnTech } from './systems/crafting.js';
import { xpForLevel, maxEnergy, maxHp, stars, rating, nextStarAt, completedSets, offlineMultiplier } from './systems/progression.js';
import { describeReward, applyReward } from './systems/rewards.js';
import * as retention from './systems/retention.js';
import { currentQuest } from './systems/quests.js';
import * as time from './systems/time.js';
import { SAVE_KEY } from './systems/state.js';
import { character, PLAYER_LOOK, DJINN_LOOK, SALEM_LOOK } from './engine/art.js';
import { setAdSimulator } from './systems/ads.js';

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
      });
      el.addEventListener('pointerdown', e => e.stopPropagation());
    });
    $('eatBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); this.quickEat(); });
    $('dialog').addEventListener('pointerdown', (e) => { e.stopPropagation(); this.advance(); });
    window.addEventListener('keydown', (e) => {
      if (this.dialogOpen && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) this.advance();
      if (e.code === 'Escape' || e.code === 'Backspace') this.back();
    });
    setAdSimulator((p) => this.adSimulator(p));
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
    set('clock', time.clockText(s));
    const st = stars(s);
    const starsHtml = '★'.repeat(st) + `<span class="off">${'★'.repeat(5 - st)}</span>`;
    if (this.last.stars !== starsHtml) { this.last.stars = starsHtml; $('stars').innerHTML = starsHtml; }
    document.getElementById('game').classList.toggle('dungeon', g.mode === 'dungeon');

    const info = g.actionInfo(g.target);
    set('actIcon', info.icon);
    set('actLabel', info.label);
    $('actionBtn').classList.toggle('pulse', !!g.target);

    if (this.dirty || (Math.floor(g.t * 2) !== this.last.halfSec)) {
      this.last.halfSec = Math.floor(g.t * 2);
      this.dirty = false;
      const now = g.now();
      const pend = retention.pendingRewardsCount(s, now);
      const b = $('badgeRewards');
      b.textContent = pend;
      b.classList.toggle('on', pend > 0);
      $('badgeTech').classList.toggle('on', TECH.some(t => techStatus(s, t.id) === 'ready'));
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

  costHtml(cost) {
    const s = this.g.state;
    return `<div class="cost">${Object.entries(cost).map(([id, n]) => {
      const c = count(s, id);
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
          this.audio.play('craft');
          g.fx.burst(s.player.x, s.player.y - 20, ['#ffd24a', '#fff'], 10, 50, 0.6);
          g.fx.float(s.player.x, s.player.y - 30, `${itemIcon(outId)} +${outN * made}`, '#fff3c4', 14);
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
          g.fx.float(s.player.x, s.player.y - 30, `🪙 +${earn}`, '#ffd24a', 14);
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
          this.g.fx.confetti(s.player.x, s.player.y - 20);
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
        m.body.innerHTML = `<div class="row" style="margin-bottom:8px"><button class="btn" data-a="music">${s.settings.music ? '🎵 الموسيقى: شغالة' : '🔇 الموسيقى: طافية'}</button>
          <button class="btn" data-a="sfx">${s.settings.sfx ? '🔊 المؤثرات: شغالة' : '🔈 المؤثرات: طافية'}</button></div>
          <p class="muted">المزارع — نسخة 1.0<br>إعلانات اليوم الباقية: ${retention.adsLeft(s, g.now())}</p>
          <div class="row"><button class="btn" data-a="reset" style="background:#e8b0a0">🗑️ ابدأ من جديد</button></div>`;
        m.handlers.music = () => { s.settings.music = !s.settings.music; this.audio.setMusic(s.settings.music); g.save(); m.rerender(); };
        m.handlers.sfx = () => { s.settings.sfx = !s.settings.sfx; this.audio.sfx = s.settings.sfx; g.save(); m.rerender(); };
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
            g.fx.confetti(g.state.player.x, g.state.player.y - 20);
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
      el.innerHTML = `<div>📺 إعلان تجريبي</div><div class="muted" style="color:#aaa">${esc(AD_PLACEMENTS[placement] || '')}</div><div class="count">5</div><div style="color:#aaa;font-size:12px">(بالجوال بيطلع إعلان AdMob حقيقي هنا)</div>`;
      document.getElementById('game').appendChild(el);
      el.addEventListener('pointerdown', e => e.stopPropagation());
      let n = 5;
      const iv = setInterval(() => {
        n--;
        el.querySelector('.count').textContent = n;
        if (n <= 0) { clearInterval(iv); el.remove(); resolve(true); }
      }, window.__fastAds ? 20 : 1000);
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
