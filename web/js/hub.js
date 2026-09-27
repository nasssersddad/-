// شاشات واضحة زي كلاش أوف كلانس: المتجر (شراء وبيع)، الإدارة (كل شي تملكه)، بياع الخضار، والخريطة
import { ITEMS, SEEDS, itemIcon, itemName } from './data/items.js';
import { BUILD_SPOTS } from './data/recipes.js';
import { TECH_BY_ID } from './data/tech.js';
import { NPCS } from './data/npcs.js';
import { FARMS } from './data/openworld.js';
import { WORKER_TYPES } from './data/workers.js';
import { SHEEP_BREEDS } from './data/sheep.js';
import { TRAITS, camelBreedName } from './data/camels.js';
import { count, add, addStat } from './systems/inventory.js';
import { spotStatus } from './systems/crafting.js';
import { applyReward } from './systems/rewards.js';
import * as farming from './systems/farming.js';
import * as farmsSys from './systems/farms.js';
import * as camels from './systems/camels.js';
import * as sheepSys from './systems/sheep.js';
import * as workersSys from './systems/workers.js';
import * as shop from './systems/shop.js';
import * as events from './systems/events.js';
import * as market from './systems/market.js';
import * as time from './systems/time.js';
import { drawMap } from './minimap.js';
import { dayWeather } from './systems/weather.js';
import { TILE } from './data/map.js';

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => market.fmt(n);

// البذور اللي تحتاج معرفة قبل
const SEED_TECH = { seed_melon: 't_melon', seed_cardamom: 't_cardamom' };
// أغراض تنباع بالمتجر (غير البذور)
const STORE_ITEMS = ['water', 'alfalfa', 'dates', 'beans', 'wood', 'stone', 'clay', 'plank', 'rope', 'brick', 'wool', 'jar', 'lantern'];
const CROPS = new Set(Object.values(SEEDS).map(d => d.crop));
const PRODUCTS = new Set(['milk', 'wool', 'bread', 'coffee', 'coffee2', 'pressed', 'flour', 'dates', 'carpet', 'cushion', 'lantern', 'jar', 'bed']);

export function seedLock(state, id) {
  const d = SEEDS[id];
  if (d.level && state.player.level < d.level) return `🔒 مستوى ${d.level}`;
  if (SEED_TECH[id] && !state.tech[SEED_TECH[id]]) return `🔒 تعلّم ${TECH_BY_ID[SEED_TECH[id]].name}`;
  return null;
}

// سعر البيع المباشر بالمتجر (الجمعة +20%)
export function storeSellPrice(state, id) {
  const p = ITEMS[id] ? ITEMS[id].price : 0;
  return time.weekday(state) === 6 ? Math.round(p * 1.2) : p;
}

// كم يكلف شراء المواد الناقصة لبناء
export function missingCost(state, cost, buyPrice) {
  let coins = 0;
  const miss = {};
  for (const [id, n] of Object.entries(cost)) {
    const lack = n - count(state, id);
    if (lack > 0) { miss[id] = lack; coins += buyPrice(id) * lack; }
  }
  return { coins, miss };
}

// نصايح: وش تسوي الحين؟
export function advice(g) {
  const s = g.state;
  const day = s.time.day;
  const out = [];
  const plots = g.world.objects.filter(o => o.kind === 'plot' && (o.group !== 2 || s.built.farm2));
  const ripe = plots.filter(o => s.plots[o.id] && farming.isReady(s.plots[o.id]));
  const dry = plots.filter(o => s.plots[o.id] && !farming.isReady(s.plots[o.id]) && !s.plots[o.id].watered);
  const empty = plots.filter(o => !s.plots[o.id]);
  if (ripe.length) out.push({ icon: '🧺', text: `عندك ${ripe.length} محصول جاهز للحصاد!`, btn: '📍 وديني', go: { guide: ripe[0], label: 'احصد' } });
  const w = g.weatherNow ? g.weatherNow() : null;
  const hr = s.time.minute / 60;
  const rainLater = w && w.rain && hr < w.start;
  if (dry.length) {
    if (rainLater) out.push({ icon: '🌦️', text: `${dry.length} حوض عطشان، بس المطر جاي الساعة ${w.start}:00 ويسقيها عنك!`, btn: '🌱 ازرع أكثر', go: { store: 'seeds' } });
    else out.push({ icon: '💧', text: `${dry.length} حوض عطشان، اسقه عشان يكبر بكرة.`, btn: '📍 وديني', go: { guide: dry[0], label: 'اسق' } });
  }
  if (empty.length) {
    const seed = farming.firstSeed(s);
    if (seed) out.push({ icon: '🌱', text: `${empty.length} حوض فاضي. ازرع ${SEEDS[seed].name} (عندك ${count(s, seed)}).`, btn: '📍 وديني', go: { guide: empty[0], label: 'ازرع' } });
    else out.push({ icon: '🛒', text: 'أحواضك فاضية وما عندك بذور. اشترِ بذور من أبو سالم أو المتجر.', btn: '🌱 اشترِ بذور', go: { store: 'seeds' } });
  }
  const thirsty = s.built.stable ? s.camels.filter(c => camels.camelNeeds(c, day).some(n => n !== 'milk')) : [];
  const sheepNeed = s.built.sheepfold ? s.sheep.filter(sh => sheepSys.sheepNeeds(sh, day).some(n => n !== 'wool')) : [];
  if (thirsty.length + sheepNeed.length) out.push({ icon: '🐪', text: `${thirsty.length + sheepNeed.length} من حلالك يبي أكل أو ماي.`, btn: '🌿 اعتنِ بالكل', go: { tend: true } });
  const milkable = s.camels.filter(c => camels.canMilk(c, day));
  if (milkable.length) out.push({ icon: '🥛', text: `${milkable.length} ناقة جاهزة للحلب.`, btn: '📍 وديني', go: { guideRt: 'camel', id: milkable[0].id, label: 'احلب' } });
  const cropsHave = Object.keys(s.inv).filter(id => CROPS.has(id) && s.inv[id] > 0).reduce((a, id) => a + s.inv[id], 0);
  if (cropsHave >= 6) out.push({ icon: '💰', text: `عندك ${cropsHave} خضار ومحصول. بعها وخذ دراهم!`, btn: '💰 بيع', go: { store: 'sell' } });
  const sold = s.stall.slots.filter(x => x && x.sold).length;
  if (sold) out.push({ icon: '🏪', text: `بسطتك باعت ${sold} غرض، استلم فلوسك.`, btn: '🏪 البسطة', go: { trade: 'stall' } });
  const buildable = Object.keys(BUILD_SPOTS).filter(id => spotStatus(s, id).ok);
  if (buildable.length) out.push({ icon: '🏗️', text: `تقدر تبني الحين: ${BUILD_SPOTS[buildable[0]].name}${buildable.length > 1 ? ` و${buildable.length - 1} غيره` : ''}.`, btn: '🔨 المباني', go: { store: 'build' } });
  const stores = Object.keys(FARMS).filter(id => s.farms && s.farms[id] && s.farms[id].owned && farmsSys.storageValue(s.farms[id]) > 0);
  if (stores.length) out.push({ icon: '🏡', text: `مخازن مزارعك فيها إنتاج.`, btn: '📦 استلم', go: { manage: 'property' } });
  if (s.workers.some(w => w.status === 'strike' || w.late >= 2)) out.push({ icon: '✊', text: 'عمّالك زعلانين! ادفع رواتبهم.', btn: '👷 العمّال', go: { workers: true } });
  events.ensureEvent(s, g.now());
  if (events.canClaimTier(s)) out.push({ icon: '🎪', text: 'فيه جايزة فعالية جاهزة!', btn: '🎁 استلم', go: { events: true } });
  if (g.weatherNow && dayWeather(s.seed, day + 1).rain && !rainLater) out.push({ icon: '☁️', text: 'بكرة فيه مطر 🌧️! ازرع أحواضك وخلّ المطر يسقيها عنك.', btn: '🌱 بذور', go: { store: 'seeds' } });
  if (!out.length) out.push({ icon: '🗺️', text: 'كل شي تمام! اطلع للقرية: اشترِ نياق وغنم، وساوم على مزارع الجيران.', btn: '🗺️ القرية', go: { travel: true } });
  return out;
}

export function installHub(UI) {
  const P = UI.prototype;

  // تنفيذ زر من النصايح أو الإدارة
  P.hubGo = function (go, m) {
    const g = this.g;
    if (!go) return;
    const close = () => { if (m) m.close(); };
    if (go.guide) { close(); g.guideTo(go.guide, go.label || '', go.mode || 'world'); this.toast(`📍 اتبع السهم${go.label ? ': ' + go.label : ''}`, '', 2.5); }
    else if (go.guideRt) {
      const rt = go.guideRt === 'camel' ? (g.camelRt || {})[go.id] : (g.sheepRt || {})[go.id];
      close();
      if (rt) { g.guideTo({ x: rt.x, y: rt.y }, go.label || ''); this.toast('📍 اتبع السهم', '', 2.5); }
      else this.toast('ما لقيتها، يمكن المراح مو مبني');
    }
    else if (go.store) { close(); this.openStore(go.store); }
    else if (go.manage) { close(); this.openManage(go.manage); }
    else if (go.trade) { close(); this.openTrade(go.trade); }
    else if (go.workers) { close(); this.openWorkers(); }
    else if (go.events) { close(); this.openEvents(); }
    else if (go.travel) { close(); if (g.mode === 'world') g.travel('open'); }
    else if (go.tend) { this.tendAll(); if (m) m.rerender(); }
  };

  // ---------- بطاقات البذور (أبو سالم والمتجر) ----------
  P.seedCards = function (m) {
    const s = this.g.state;
    const sel = farming.firstSeed(s);
    const cards = Object.entries(SEEDS).map(([id, d]) => {
      const lock = seedLock(s, id);
      const pr = this.buyPrice(id);
      const crop = ITEMS[d.crop];
      const profit = farming.seedProfit(id, pr, crop.price);
      const have = count(s, id);
      return `<div class="scard ${lock ? 'locked' : ''} ${have && sel === id ? 'sel' : ''}">
        <div class="sbig">${crop.icon}</div>
        <b>${esc(d.name)}</b>
        <div class="sinfo">⏱️ ${d.days} ${d.days > 2 ? 'أيام' : 'يوم'} • 🧺 ${d.yield[0]}–${d.yield[1]} ${crop.icon}</div>
        <div class="sinfo">تنباع بـ 🪙${crop.price} • <b class="profit">ربح ≈ 🪙${profit}</b></div>
        ${lock ? `<div class="lock">${lock}</div>` : `<div class="row center"><button class="btn" data-a="bseed" data-v="${id}:1" ${s.player.coins >= pr ? '' : 'disabled'}>🪙${pr}</button><button class="btn" data-a="bseed" data-v="${id}:5" ${s.player.coins >= pr * 5 ? '' : 'disabled'}>×5</button><button class="btn" data-a="bseed" data-v="${id}:10" ${s.player.coins >= pr * 10 ? '' : 'disabled'}>×10</button></div>`}
        <div class="sfoot">عندك <b>${have}</b>${have ? (sel === id ? ' • <span class="selok">✔ هذي اللي تنزرع</span>' : ` • <button class="link" data-a="pseed" data-v="${id}">ازرع هذي</button>`) : ''}</div>
      </div>`;
    }).join('');
    m.handlers.bseed = (v) => {
      const [id, n] = v.split(':');
      const cost = this.buyPrice(id) * Number(n);
      if (s.player.coins < cost || seedLock(s, id)) { this.audio.play('deny'); return; }
      s.player.coins -= cost;
      add(s, id, Number(n));
      addStat(s, 'seedsBought', Number(n));
      if (!s.selectedSeed || !count(s, s.selectedSeed)) s.selectedSeed = id;
      this.audio.play('coin');
      this.toast(`🌱 اشتريت ${n} ${itemName(id)}`, 'gain', 2);
      m.rerender(); this.refresh();
    };
    m.handlers.pseed = (id) => { s.selectedSeed = id; this.audio.play('ui'); m.rerender(); this.refresh(); };
    return `<p class="howto">🌱 <b>كيف تزرع:</b> اشترِ بذور ← روح للأحواض واضغط ✋ ← اسقها كل يوم 💧 ← بعد الأيام احصد 🧺 وبع المحصول 💰</p><div class="sgrid">${cards}</div>`;
  };

  // ---------- قائمة البيع ----------
  P.sellList = function (m, filter = 'all', onlyCrops = false) {
    const s = this.g.state;
    const friday = time.weekday(s) === 6;
    const ids = Object.keys(s.inv).filter(id => ITEMS[id] && s.inv[id] > 0 && !id.startsWith('seed_'))
      .filter(id => onlyCrops ? CROPS.has(id) : filter === 'all' || (filter === 'crops' ? CROPS.has(id) : filter === 'goods' ? PRODUCTS.has(id) : !CROPS.has(id) && !PRODUCTS.has(id)))
      .sort((a, b) => storeSellPrice(s, b) * s.inv[b] - storeSellPrice(s, a) * s.inv[a]);
    const total = ids.reduce((a, id) => a + storeSellPrice(s, id) * s.inv[id], 0);
    m.handlers.sell = (v) => {
      const [id, n] = v.split(':');
      const k = n === 'all' ? count(s, id) : Math.min(Number(n), count(s, id));
      if (!k) return;
      const earn = storeSellPrice(s, id) * k;
      add(s, id, -k);
      applyReward(s, { coins: earn }, Math.random);
      addStat(s, 'storeSold', k);
      this.audio.play('coin');
      this.toast(`💰 بعت ${k} ${itemName(id)} بـ 🪙${earn}`, 'gain', 2);
      m.rerender(); this.refresh();
    };
    m.handlers.sellall = () => {
      let earn = 0;
      for (const id of ids) { earn += storeSellPrice(s, id) * s.inv[id]; s.inv[id] = 0; }
      if (!earn) return;
      applyReward(s, { coins: earn }, Math.random);
      this.audio.play('coin');
      this.toast(`💰 بعت الكل بـ 🪙${earn}`, 'gain', 3);
      m.rerender(); this.refresh();
    };
    const rows = ids.map(id => `<div class="shop-row"><span class="ic">${itemIcon(id)}</span><span class="nm">${itemName(id)} <small class="muted">×${s.inv[id]}</small><br><small class="muted">الحبة بـ 🪙${storeSellPrice(s, id)}</small></span>
      <button class="btn green" data-a="sell" data-v="${id}:1">بيع 1</button><button class="btn green" data-a="sell" data-v="${id}:all">الكل 🪙${storeSellPrice(s, id) * s.inv[id]}</button></div>`).join('');
    return `${friday ? '<p class="howto">🎉 اليوم الجمعة: البيع +20%!</p>' : ''}
      ${rows ? `<div class="shop-list">${rows}</div><div class="row center" style="margin-top:8px"><button class="btn green big" data-a="sellall">بيع كل اللي فوق 🪙${fmt(total)}</button></div>` : '<p class="muted center">ما عندك شي تبيعه هنا.</p>'}
      <p class="muted center">💡 تبي سعر أعلى؟ حط أغراضك بـ<b>البسطة</b> وحدد سعرك، أو سلّمها لـ<b>طلبات القوافل</b>.</p>`;
  };

  // ---------- أبو سالم بياع الخضار ----------
  P.openVeggie = function (tab = 'seeds') {
    const s = this.g.state;
    const npc = NPCS.veggie;
    const greet = npc.greet[Math.floor(Math.random() * npc.greet.length)];
    this.modal({
      title: `🥕 ${npc.name} — ${npc.title}`,
      render: (m) => {
        this.tabs(m, [{ id: 'seeds', label: '🌱 اشترِ بذور' }, { id: 'sell', label: '💰 بيع محصولك' }], tab, (v) => { tab = v; m.rerender(); });
        m.body.innerHTML = `<p>💬 ${esc(greet)} <span class="muted">— دراهمك: 🪙${fmt(s.player.coins)}</span></p>` + (tab === 'seeds' ? this.seedCards(m) : this.sellList(m, 'crops', true));
      },
    });
  };

  // ---------- المتجر ----------
  P.openStore = function (tab = 'seeds') {
    const g = this.g;
    const s = g.state;
    this.modal({
      title: '🛒 المتجر',
      cls: 'store',
      render: (m) => {
        const buildReady = Object.keys(BUILD_SPOTS).filter(id => spotStatus(s, id).ok).length;
        this.tabs(m, [
          { id: 'seeds', label: '🌱 بذور' },
          { id: 'animals', label: '🐪 حلال' },
          { id: 'build', label: '🏗️ مباني', badge: buildReady },
          { id: 'items', label: '🧰 أغراض' },
          { id: 'sell', label: '💰 بيع' },
        ], tab, (v) => { tab = v; m.rerender(); });
        const head = `<div class="storehead">🪙 <b>${fmt(s.player.coins)}</b> <span class="muted">دراهمك</span></div>`;
        let body = '';
        if (tab === 'seeds') body = this.seedCards(m);
        else if (tab === 'sell') body = this.sellList(m, 'all');
        else if (tab === 'items') body = this.storeItems(m);
        else if (tab === 'build') body = this.storeBuild(m);
        else body = this.storeAnimals(m);
        m.body.innerHTML = head + body;
      },
    });
  };

  P.storeItems = function (m) {
    const s = this.g.state;
    m.handlers.bitem = (v) => {
      const [id, n] = v.split(':');
      const cost = this.buyPrice(id) * Number(n);
      if (s.player.coins < cost) { this.audio.play('deny'); return; }
      s.player.coins -= cost; add(s, id, Number(n));
      this.audio.play('coin'); m.rerender(); this.refresh();
    };
    const use = { water: 'تسقي فيه الزرع والحلال', alfalfa: 'أكل النياق والغنم', dates: 'أكل لك وللنياق', beans: 'تسوي منه قهوة للضيوف', wood: 'للبناء والصناعة', stone: 'للبناء', clay: 'للفخار والطوب', plank: 'للبناء', rope: 'للبناء', brick: 'للجدران', wool: 'تنسج منه سجاد', jar: 'ديكور وطلبات', lantern: 'إضاءة وسمعة' };
    return `<div class="sgrid">${STORE_ITEMS.map(id => {
      const pr = this.buyPrice(id);
      return `<div class="scard"><div class="sbig">${itemIcon(id)}</div><b>${itemName(id)}</b><div class="sinfo">${esc(use[id] || '')}</div>
        <div class="row center"><button class="btn" data-a="bitem" data-v="${id}:1" ${s.player.coins >= pr ? '' : 'disabled'}>🪙${pr}</button><button class="btn" data-a="bitem" data-v="${id}:5" ${s.player.coins >= pr * 5 ? '' : 'disabled'}>×5</button></div>
        <div class="sfoot">عندك <b>${count(s, id)}</b></div></div>`;
    }).join('')}</div>`;
  };

  P.storeBuild = function (m) {
    const g = this.g;
    const s = g.state;
    const list = Object.entries(BUILD_SPOTS).filter(([id]) => g.worldObjById['spot:' + id] && !spotStatus(s, id).hidden);
    list.sort((a, b) => (s.built[a[0]] ? 1 : 0) - (s.built[b[0]] ? 1 : 0));
    m.handlers.bbuild = (id) => { if (g.doBuild(id)) { this.toast(`🔨 بنيت ${BUILD_SPOTS[id].name}!`, 'gain', 3); m.rerender(); } else this.audio.play('deny'); };
    m.handlers.bmiss = (id) => {
      const mc = missingCost(s, BUILD_SPOTS[id].cost, (x) => this.buyPrice(x));
      if (s.player.coins < mc.coins) { this.audio.play('deny'); this.toast('الدراهم ما تكفي 💸'); return; }
      s.player.coins -= mc.coins;
      for (const [x, n] of Object.entries(mc.miss)) add(s, x, n);
      this.audio.play('coin');
      m.rerender(); this.refresh();
    };
    m.handlers.bwhere = (id) => this.hubGo({ guide: g.worldObjById['spot:' + id], label: BUILD_SPOTS[id].name }, m);
    m.handlers.btech = () => { m.close(); this.openTech(); };
    return `<p class="howto">🏗️ كل مبنى له مكان بمزرعتك. إذا المواد ناقصة تقدر تشتريها من هنا، وبعدين اضغط «ابنِ».</p><div class="sgrid">${list.map(([id, sp]) => {
      const st = spotStatus(s, id);
      const built = !!s.built[id];
      const mc = missingCost(s, sp.cost, (x) => this.buyPrice(x));
      let act;
      if (built) act = '<div class="lock ok">✅ مبني</div>';
      else if (st.needTech) act = `<button class="btn blue" data-a="btech">🔒 ${esc(TECH_BY_ID[st.needTech].name)}</button>`;
      else if (st.ok) act = `<button class="btn green big" data-a="bbuild" data-v="${id}">ابنِ 🔨</button>`;
      else act = `<button class="btn" data-a="bmiss" data-v="${id}" ${s.player.coins >= mc.coins ? '' : 'disabled'}>اشترِ الناقص 🪙${fmt(mc.coins)}</button>`;
      return `<div class="scard ${built ? 'done' : st.ok ? 'ready' : ''}"><b>${esc(sp.name)}</b>${sp.rating ? `<div class="sinfo">⭐ سمعة +${sp.rating}</div>` : ''}<div class="sinfo">${esc(sp.desc)}</div>
        ${built ? '' : this.costHtml(sp.cost)}<div class="row center">${act}${built ? '' : `<button class="link" data-a="bwhere" data-v="${id}">📍 وين؟</button>`}</div></div>`;
    }).join('')}</div>`;
  };

  P.storeAnimals = function (m) {
    const g = this.g;
    const s = g.state;
    m.handlers.acamel = () => { m.close(); this.openCamels(null, 'market'); };
    m.handlers.asheep = () => { m.close(); this.openTrade('sheep'); };
    m.handlers.avillage = () => { m.close(); if (g.mode === 'world') g.travel('open'); else this.toast('أنت بالقرية! روح لأصحاب المزارع'); };
    m.handlers.abuild = (id) => this.hubGo({ store: 'build' }, m);
    const traitList = Object.values(TRAITS);
    return `<div class="sgrid">
      <div class="scard"><div class="sbig">🐪</div><b>سوق النياق</b><div class="sinfo">نياق وفحول من البياعين، وتقدر تساوم وتقايض.</div>${s.built.stable ? '<button class="btn green" data-a="acamel">افتح السوق</button>' : '<div class="lock">🔒 ابنِ المراح أول</div><button class="link" data-a="abuild">🏗️ المباني</button>'}</div>
      <div class="scard"><div class="sbig">🐑</div><b>الغنم</b><div class="sinfo">اشترِ طليان، تجيب صوف وتنباع.</div>${s.built.sheepfold ? '<button class="btn green" data-a="asheep">اشترِ غنم</button>' : '<div class="lock">🔒 ابنِ حظيرة الغنم أول</div><button class="link" data-a="abuild">🏗️ المباني</button>'}</div>
      <div class="scard"><div class="sbig">🏡</div><b>مزارع القرية</b><div class="sinfo">أصحاب المزارع يبيعون نياق وغنم وبضاعة، وتقدر تشتري مزرعتهم كلها.</div><button class="btn blue" data-a="avillage">🗺️ روح القرية</button></div>
    </div>
    <h4 class="sub">✨ خواص النياق</h4>
    <p class="muted">كل ناقة لها خاصية أو ثنتين، والنادرة تطلع قليل. الحوار يورث خواص أبوه وأمه، فربِّ النياق اللي خواصها زينة!</p>
    <div class="traits">${traitList.map(t => `<span class="ctag trait ${t.tier}">${t.icon} <b>${t.name}</b> — ${esc(t.desc)}</span>`).join('')}</div>`;
  };

  // ---------- الإدارة ----------
  P.openManage = function (tab = 'now') {
    const g = this.g;
    const s = g.state;
    this.modal({
      title: '📋 إدارة أملاكي',
      cls: 'store',
      render: (m) => {
        const adv = advice(g);
        const owned = Object.keys(FARMS).filter(id => s.farms && s.farms[id] && s.farms[id].owned);
        this.tabs(m, [
          { id: 'now', label: '💡 وش أسوي؟', badge: adv[0] && adv[0].go.travel ? 0 : adv.length },
          { id: 'farm', label: '🌾 مزرعتي' },
          { id: 'animals', label: '🐪 حلالي' },
          { id: 'property', label: `🏡 عقاراتي (${owned.length})` },
          { id: 'workers', label: `👷 عمّالي (${s.workers.length})` },
        ], tab, (v) => { tab = v; m.rerender(); });
        m.handlers.go = (i) => this.hubGo(m.gos[Number(i)], m);
        m.gos = [];
        const btn = (go, label, cls = '') => { m.gos.push(go); return `<button class="btn ${cls}" data-a="go" data-v="${m.gos.length - 1}">${label}</button>`; };
        let html = '';
        if (tab === 'now') {
          html = `<div class="advice">${adv.map(a => `<div class="arow"><span class="ic">${a.icon}</span><span class="nm">${esc(a.text)}</span>${btn(a.go, a.btn, 'green')}</div>`).join('')}</div>`;
        } else if (tab === 'farm') html = this.manageFarm(m, btn);
        else if (tab === 'animals') html = this.manageAnimals(m, btn);
        else if (tab === 'property') html = this.manageProperty(m, btn);
        else html = this.manageWorkers(m, btn);
        m.body.innerHTML = html;
      },
    });
  };

  P.manageFarm = function (m, btn) {
    const g = this.g;
    const s = g.state;
    const plots = g.world.objects.filter(o => o.kind === 'plot');
    const cards = plots.map((o, i) => {
      if (o.group === 2 && !s.built.farm2) return `<div class="pcard locked"><b>حوض ${i + 1}</b><span>🔒 وسّع المزرعة</span></div>`;
      const p = s.plots[o.id];
      let st, cls = '';
      if (!p) { st = '🟫 فاضي'; cls = 'empty'; }
      else if (farming.isReady(p)) { st = `${ITEMS[SEEDS[p.seed].crop].icon} جاهز للحصاد!`; cls = 'ready'; }
      else st = `${ITEMS[SEEDS[p.seed].crop].icon} ${SEEDS[p.seed].name} • باقي ${SEEDS[p.seed].days - p.stage} يوم ${p.watered ? '💧✔' : '<b class="warn">💧 يبي سقي</b>'}`;
      return `<div class="pcard ${cls}"><b>حوض ${i + 1}</b><span>${st}</span>${btn({ guide: o, label: 'الحوض' }, '📍')}</div>`;
    }).join('');
    const built = Object.keys(BUILD_SPOTS).filter(id => s.built[id]);
    const seeds = farming.ownedSeeds(s);
    m.handlers.cyc = () => { farming.cycleSeed(s); m.rerender(); this.refresh(); };
    return `<h4 class="sub">🌾 الأحواض</h4><div class="pgrid">${cards}</div>
      <p>🌰 البذرة اللي تنزرع: <b>${farming.firstSeed(s) ? SEEDS[farming.firstSeed(s)].name : 'ما عندك بذور'}</b> ${seeds.length > 1 ? `<button class="link" data-a="cyc">🔄 بدّل</button>` : ''} ${btn({ store: 'seeds' }, '🌱 اشترِ بذور')}</p>
      <h4 class="sub">🏠 مبانيك (${built.length})</h4><div class="traits">${built.map(id => `<span class="ctag">✅ ${esc(BUILD_SPOTS[id].name)}</span>`).join('') || '<span class="muted">ما بنيت شي للحين</span>'}</div>
      <div class="row center" style="margin-top:6px">${btn({ store: 'build' }, '🏗️ ابنِ أكثر', 'blue')}</div>`;
  };

  P.tendAll = function () {
    const g = this.g;
    const s = g.state;
    const day = s.time.day;
    let done = 0, lack = false;
    const list = [];
    if (s.built.stable) for (const c of s.camels) list.push(['c', c]);
    if (s.built.sheepfold) for (const sh of s.sheep) list.push(['s', sh]);
    for (const [k, a] of list) {
      if (s.player.energy < 1) break;
      let did = false;
      if (k === 'c') {
        if (!camels.isWatered(a, day)) { if (camels.waterCamel(s, a.id, day)) did = true; else lack = true; }
        if (!camels.isFed(a, day)) { if (camels.feed(s, a.id, day)) did = true; else lack = true; }
      } else {
        if (a.wateredDay !== day) { if (sheepSys.waterSheep(s, a.id, day)) did = true; else lack = true; }
        if (a.fedDay !== day) { if (sheepSys.feedSheep(s, a.id, day)) did = true; else lack = true; }
      }
      if (did) { done++; s.player.energy -= 1; }
    }
    if (done) { this.audio.play('water'); this.toast(`🌿💧 اعتنيت بـ ${done} من حلالك (⚡-${done})`, 'gain', 3); g.save(); }
    if (lack) this.toast('ناقصك ماء 💧 أو أكل 🌿 (برسيم/تمر/قمح). اشترِ من المتجر ← أغراض', '', 4);
    if (!done && !lack) this.toast('حلالك كله شبعان وريّان 👍');
    this.refresh();
  };

  P.manageAnimals = function (m, btn) {
    const s = this.g.state;
    const day = s.time.day;
    m.handlers.cdet = (id) => { m.close(); this.openCamels(id, 'pen'); };
    const needTxt = (n) => n.map(x => ({ water: '💧 عطشان', food: '🌿 جوعان', milk: '🥛 احلبها', wool: '🧶 جزّه' }[x])).join(' ');
    const cam = s.camels.map(c => {
      camels.ensureTraits(c);
      const n = camels.camelNeeds(c, day);
      return `<div class="acard ${c.rare ? 'rare' : ''}">${this.camelImg(c, 44)}<div class="ainfo"><b>${esc(c.name)}</b> <small class="muted">${c.sex === 'f' ? '♀' : '♂'} ${esc(camelBreedName(c))} • ≈🪙${fmt(market.valueOf(s, c))}</small>
        <div class="ctags">${this.traitChips(c)}</div><small>${needTxt(n) || '👍 مرتاحة'}${c.pregnant ? ' • 🤰 حامل' : ''}</small></div>
        <div class="acol">${btn({ guideRt: 'camel', id: c.id, label: c.name }, '📍')}<button class="btn" data-a="cdet" data-v="${c.id}">تفاصيل</button></div></div>`;
    }).join('');
    const sh = s.sheep.map(x => {
      const n = sheepSys.sheepNeeds(x, day);
      return `<div class="acard"><span class="sbig" style="font-size:28px">🐑</span><div class="ainfo"><b>${esc(SHEEP_BREEDS[x.breed].name)}</b><small>${needTxt(n) || '👍 مرتاحة'}</small></div><div class="acol">${btn({ guideRt: 'sheep', id: x.id }, '📍')}</div></div>`;
    }).join('');
    return `<div class="row center">${btn({ tend: true }, '🌿💧 اسقِ وأطعم الكل', 'green big')}${btn({ store: 'animals' }, '🛒 اشترِ حلال')}</div>
      <h4 class="sub">🐪 النياق (${s.camels.length})</h4>${s.built.stable ? (cam || '<p class="muted">ما عندك نياق.</p>') : '<p class="muted">🔒 ابنِ المراح أول.</p>'}
      <h4 class="sub">🐑 الغنم (${s.sheep.length})</h4>${s.built.sheepfold ? (sh || '<p class="muted">ما عندك غنم.</p>') : '<p class="muted">🔒 ابنِ حظيرة الغنم أول.</p>'}`;
  };

  P.manageProperty = function (m, btn) {
    const g = this.g;
    const s = g.state;
    m.handlers.pcol = (id) => {
      const r = farmsSys.collectRemote(s, id);
      const list = Object.entries(r.got).filter(([, v]) => v > 0);
      if (!list.length) { this.toast('المخزن فاضي، ارجع بكرة 📦'); return; }
      this.audio.play('coin');
      this.gainToast(list.map(([k, v]) => ({ icon: k === 'coins' ? '🪙' : ITEMS[k].icon, text: `+${v}` })));
      if (r.fee) this.toast(`🚚 المندوب أخذ 🪙${r.fee}`, '', 2);
      g.save(); m.rerender(); this.refresh();
    };
    m.handlers.pup = (id) => {
      const r = farmsSys.upgradeFarm(s, id);
      if (r.result === 'upgraded') { this.audio.play('build'); this.toast(`⬆️ ${FARMS[id].name} صارت مستوى ${r.level}! الإنتاج زاد`, 'gain', 3); g.save(); }
      else if (r.result === 'poor') this.toast('الدراهم ما تكفي 💸');
      m.rerender(); this.refresh();
    };
    const cards = Object.entries(FARMS).map(([id, def]) => {
      const f = farmsSys.farmState(s, id);
      if (!f.owned) return `<div class="acard dim"><span class="sbig">🏚️</span><div class="ainfo"><b>${esc(def.name)}</b><small>لـ${esc(def.owner || '')} • تنباع بحوالي 🪙${fmt(def.price)}</small></div><div class="acol">${btn({ guide: g.open.farmObjs[id].owner, label: def.name, mode: 'open' }, '🗺️ روح لها')}</div></div>`;
      const y = farmsSys.dailyYield(id, f);
      const lvl = farmsSys.farmLevel(f);
      const stor = Object.entries(f.storage || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k === 'coins' ? '🪙' : ITEMS[k].icon}${v}`).join(' ') || 'فاضي';
      const up = lvl < farmsSys.FARM_MAX_LEVEL ? `<button class="btn blue" data-a="pup" data-v="${id}" ${s.player.coins >= farmsSys.upgradeCost(id, f) ? '' : 'disabled'}>⬆️ طوّر 🪙${fmt(farmsSys.upgradeCost(id, f))}</button>` : '<span class="ctag gold">أعلى مستوى</span>';
      return `<div class="acard owned"><span class="sbig">🏡</span><div class="ainfo"><b>${esc(def.name)}</b> <span class="ctag gold">مستوى ${lvl}</span>
        <small>كل يوم: 🪙${y.coins} ${Object.entries(y.items).map(([k, n]) => `${ITEMS[k].icon}${n}`).join(' ')}</small><small>📦 المخزن: ${stor}</small></div>
        <div class="acol"><button class="btn green" data-a="pcol" data-v="${id}">📦 استلم</button>${up}</div></div>`;
    }).join('');
    return `<p class="howto">🏡 المزارع اللي تشتريها بالقرية تنتج كل يوم. استلم من هنا (المندوب ياخذ 10% من الدراهم) أو روح لمخزنها ببلاش. طوّرها عشان تنتج أكثر.</p>${cards}`;
  };

  P.manageWorkers = function (m, btn) {
    const s = this.g.state;
    m.handlers.wopen = () => { m.close(); this.openWorkers(); };
    m.handlers.wpay = () => { const r = workersSys.payAll(s); if (r) { this.audio.play('coin'); this.toast(`💵 دفعت 🪙${r}`, 'gain', 2); } else this.toast('الدراهم ما تكفي أو ما عليك شي'); m.rerender(); this.refresh(); };
    const owed = workersSys.totalOwed(s);
    const rows = s.workers.map(w => {
      const t = WORKER_TYPES[w.type];
      const st = w.status === 'strike' ? '✊ مضرب!' : w.job ? `🔨 يبني ${esc(BUILD_SPOTS[w.job.spot] ? BUILD_SPOTS[w.job.spot].name : '')}` : '✅ يشتغل';
      return `<div class="acard ${w.status === 'strike' ? 'dim' : ''}"><span class="sbig">${t.icon}</span><div class="ainfo"><b>${esc(w.name)}</b> <small class="muted">${t.name} • 🪙${w.wage}/ساعة</small><small>${st}${w.owed ? ` • عليك 🪙${w.owed}` : ''}</small></div></div>`;
    }).join('');
    return `<div class="row center"><button class="btn green" data-a="wpay" ${owed ? '' : 'disabled'}>💵 ادفع الرواتب 🪙${fmt(owed)}</button><button class="btn blue" data-a="wopen">👷 وظّف / تفاصيل</button></div>${rows || '<p class="muted center">ما عندك عمّال. وظّف حطّاب أو مزارع أو بنّاء أو راعي.</p>'}`;
  };

  // ---------- كيف ألعب ----------
  P.openHelp = function (topic = 0) {
    const g = this.g;
    const TOPICS = [
      { icon: '🕹️', title: 'الحركة والفعل', steps: ['حرّك إصبعك يسار الشاشة عشان تمشي.', 'اقرب من أي شي (نخلة، حوض، ناقة، شخص) وزر ✋ يتغير لاسمه.', 'اضغط ✋ وسوّ الفعل. تقدر تضغط مطوّل للجمع والزراعة.', 'السهم الذهبي 🧭 يدلّك على مهمتك، والرقم جنبه هو المسافة.'], go: null },
      { icon: '🌱', title: 'الزراعة', steps: ['اشترِ بذور من أبو سالم 🥕 (جنب الأحواض) أو من 🛒 المتجر.', 'اوقف جنب حوض فاضي واضغط ✋ «ازرع». زر البذرة 🔄 يبدّل وش تزرع.', 'اسقِ الحوض كل يوم 💧 (الماء من البير بالخان)، أو خلّ 🌧️ المطر يسقيه عنك!', 'بعد الأيام يطلع المحصول: احصده 🧺 وبعه 💰.'], go: { store: 'seeds' }, btn: '🌱 اشترِ بذور' },
      { icon: '🐪', title: 'الحلال', steps: ['ابنِ المراح 🏗️ وتجيك ناقتين هدية.', 'كل يوم اسقها وأطعمها (برسيم أو تمر)، أو اضغط «اسقِ وأطعم الكل» من 📋 إدارتي.', 'احلب النياق 🥛، ولقّح الفحل مع الناقة، وفيه فرصة يطلع لك حوار نادر!', 'كل ناقة لها خواص ✨، والحوار يورثها. النادرة تسوى ثروة.'], go: { manage: 'animals' }, btn: '🐪 حلالي' },
      { icon: '💰', title: 'البيع والتجارة', steps: ['أسرع طريقة: 🛒 المتجر ← «💰 بيع»، وتبيع أي شي على طول.', 'تبي سعر أعلى؟ ابنِ البسطة 🏪 وحط أغراضك بسعرك، والمارّة يشترون.', 'لوحة الطلبات 📋 تجيك طلبات قوافل بجوايز حلوة.', 'بالحلال تقدر تساوم وتقايض من 🐪 الحلال ← السوق.'], go: { store: 'sell' }, btn: '💰 بيع الحين' },
      { icon: '🏗️', title: 'البناء', steps: ['اجمع خشب 🪵 وحجر 🪨 وطين 🟫 من النخل والسدر والصخور.', 'اصنع ألواح وحبال وطوب من المنجرة والفرن.', 'افتح 🛒 المتجر ← «🏗️ مباني»: يبيّن لك الناقص، وتقدر تشتريه وتبني بضغطة.', 'كل مبنى يرفع سمعة الخان ⭐ لين توصل 5 نجوم.'], go: { store: 'build' }, btn: '🏗️ المباني' },
      { icon: '👷', title: 'العمّال', steps: ['وظّف حطّاب، مزارع، بنّاء، أو راعي من 👷 العمّال.', 'يشتغلون لحالهم، وراتبهم بالساعة.', 'لا تتأخر بالراتب! إذا تأخرت يضربون ✊ ويبون غرامة.', 'فعّل الدفع التلقائي وارتاح.'], go: { workers: true }, btn: '👷 العمّال' },
      { icon: '🗺️', title: 'القرية والعقارات', steps: ['اطلع من «طريق القرية» يسار مزرعتك.', 'فيها 5 مزارع جيران: تشتري منهم بضاعة ونياق وغنم وتساومهم.', 'تقدر تشتري مزرعة كاملة 🏡 وتصير تنتج لك كل يوم.', 'من 📋 إدارتي ← عقاراتي: طوّرها واستلم إنتاجها.'], go: { manage: 'property' }, btn: '🏡 عقاراتي' },
      { icon: '🎁', title: 'المكافآت والفعاليات', steps: ['كل يوم ادخل وخذ مكافأتك اليومية 🎁، والسلسلة تكبر الجوايز.', '3 مهام يومية، وعجلة حظ، وإنجازات.', 'فعالية جديدة كل يومين 🎪: سباق هجن، صقور، مهرجان تمور، وغيرها.', 'الصعوبة تزيد مع كل مرحلة، فالجوايز تحتاج شغل!'], go: { events: true }, btn: '🎪 الفعاليات' },
    ];
    let cur = topic;
    this.modal({
      title: '📖 كيف ألعب؟',
      cls: 'store',
      render: (m) => {
        const tp = TOPICS[cur];
        m.body.innerHTML = `<div class="helpnav">${TOPICS.map((x, i) => `<button class="hbtn2 ${i === cur ? 'on' : ''}" data-a="tp" data-v="${i}"><span>${x.icon}</span><small>${x.title}</small></button>`).join('')}</div>
          <div class="helpcard"><div class="hbig">${tp.icon}</div><h3>${tp.title}</h3>
            <ol>${tp.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
            <div class="row center">${cur > 0 ? '<button class="btn" data-a="prev">→ السابق</button>' : ''}${tp.go ? `<button class="btn green" data-a="go">${tp.btn}</button>` : ''}${cur < TOPICS.length - 1 ? '<button class="btn blue" data-a="next">التالي ←</button>' : '<button class="btn blue" data-a="close">يلا نلعب! 🎉</button>'}</div>
          </div>`;
        m.handlers.tp = (v) => { cur = Number(v); this.audio.play('ui'); m.rerender(); };
        m.handlers.next = () => { cur = Math.min(TOPICS.length - 1, cur + 1); this.audio.play('ui'); m.rerender(); };
        m.handlers.prev = () => { cur = Math.max(0, cur - 1); this.audio.play('ui'); m.rerender(); };
        m.handlers.go = () => this.hubGo(tp.go, m);
      },
    });
    g.state.flags.helpSeen = true;
  };

  // ---------- الخريطة الكبيرة ----------
  P.openMap = function () {
    const g = this.g;
    this.modal({
      title: g.mode === 'open' ? '🗺️ خريطة القرية' : '🗺️ خريطة مزرعتي',
      cls: 'store',
      render: (m) => {
        m.body.innerHTML = `<canvas class="bigmap"></canvas><div class="legend"><span><i style="background:#fff"></i> أنت</span><span><i style="background:#ffb03a"></i> نياق</span><span><i style="background:#f4f0e6;border:1px solid #999"></i> غنم</span><span><i style="background:#ffe04a"></i> عمّال</span><span><i style="background:#4ad0ff"></i> أشخاص</span><span><i style="background:#6cc24a"></i> زرع جاهز</span><span><i style="background:#ff4a4a"></i> 📍 السهم</span></div>`;
        const cv = m.body.querySelector('canvas');
        const dims = g.mode === 'open' ? [g.open.W, g.open.H] : [64, 48];
        const maxH = Math.max(160, window.innerHeight * 0.92 - 150);
        const w = Math.min(m.body.clientWidth - 8, maxH * dims[0] / dims[1]);
        cv.style.width = Math.round(w) + 'px'; cv.style.margin = '0 auto';
        cv.width = Math.round(w * 2); cv.height = Math.round(w * 2 * dims[1] / dims[0]);
        drawMap(cv, g, { labels: true });
        cv.onclick = (e) => {
          const r = cv.getBoundingClientRect();
          const tx = (e.clientX - r.left) / r.width * dims[0], ty = (e.clientY - r.top) / r.height * dims[1];
          g.guideTo({ x: tx * TILE, y: ty * TILE }, '', g.mode);
          this.toast('📍 حطيت علامة، اتبع السهم', '', 2);
          m.close();
        };
      },
    });
  };
}
