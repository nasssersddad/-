// شاشات واضحة زي كلاش أوف كلانس: المتجر (شراء وبيع)، الإدارة (كل شي تملكه)، بياع الخضار، والخريطة
import { ITEMS, SEEDS, itemIcon, itemName } from './data/items.js';
import { BUILD_SPOTS } from './data/recipes.js';
import { TECH_BY_ID } from './data/tech.js';
import { NPCS } from './data/npcs.js';
import { FARMS } from './data/openworld.js';
import { WORKER_TYPES } from './data/workers.js';
import { SHEEP_BREEDS } from './data/sheep.js';
import { TRAITS, camelBreedName } from './data/camels.js';
import { count, add, addStat, has, bagUsed, bagCap, bagFree, counts } from './systems/inventory.js';
import * as placement from './systems/placement.js';
import * as production from './systems/production.js';
import * as coopSys from './systems/coop.js';
import { PLACEABLES, BAG_CAPS, BAG_UPGRADE_COINS, MATS } from './data/buildings.js';
import { BUILD_ZONES, zonesFor, zoneCenter, isZoneOpen, zoneById } from './data/zones.js';
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
  const seedsHave = Object.keys(s.inv).filter(id => id.startsWith('seed_')).reduce((a, id) => a + s.inv[id], 0);
  if (!empty.length && seedsHave >= 5 && placement.canAddMore(s, 'field') && s.player.coins >= placement.fieldPrice(s)) out.push({ icon: '🌾', text: `كل أحواضك مزروعة وعندك ${seedsHave} بذرة. اشترِ حقل جديد بـ🪙${placement.fieldPrice(s)} وحطه وين ما تبي.`, btn: '🌱 حقل جديد', go: { store: 'build:field' } });
  const thirsty = s.built.stable ? s.camels.filter(c => camels.camelNeeds(c, day).some(n => n !== 'milk')) : [];
  const sheepNeed = s.built.sheepfold ? s.sheep.filter(sh => sheepSys.sheepNeeds(sh, day).some(n => n !== 'wool')) : [];
  if (thirsty.length + sheepNeed.length) out.push({ icon: '🐪', text: `${thirsty.length + sheepNeed.length} من حلالك يبي أكل أو ماي.`, btn: '🌿 اعتنِ بالكل', go: { tend: true } });
  const milkable = s.camels.filter(c => camels.canMilk(c, day));
  if (milkable.length) out.push({ icon: '🥛', text: `${milkable.length} ناقة جاهزة للحلب.`, btn: '📍 وديني', go: { guideRt: 'camel', id: milkable[0].id, label: 'احلب' } });
  if (bagUsed(s) >= bagCap(s) * 0.85) out.push({ icon: '🎒', text: `حقيبتك قرّبت تتعبّى (${bagUsed(s)}/${bagCap(s)}). حط أغراضك بصندوق داخل بيتك أو بعها.`, btn: '📦 صندوق', go: { store: 'build:in' } });
  const cropsHave = Object.keys(s.inv).filter(id => CROPS.has(id) && s.inv[id] > 0).reduce((a, id) => a + s.inv[id], 0);
  if (cropsHave >= 6) out.push({ icon: '💰', text: `عندك ${cropsHave} خضار ومحصول. بعها وخذ دراهم!`, btn: '💰 بيع', go: { store: 'sell' } });
  // الورش اللي بالوقت
  const nowMin = g.absMinutes();
  for (const st of Object.keys(production.TIMED)) {
    const o = g.worldObjById['spot:' + st];
    if (!o || !s.built[st]) continue;
    const name = BUILD_SPOTS[st].name;
    const rd = production.readyCount(s, nowMin, st);
    const isDay = production.workshopDay(s) === st;
    if (rd) out.push({ icon: '📥', text: `${name} خلّص ${rd} طلب، استلمه!`, btn: '📍 وديني', go: { guide: o, label: name } });
    else if (isDay && production.queue(s, st).length < production.slots(s, st)) out.push({ icon: '📅', text: `اليوم يوم ${name}! الشغل فيه أسرع ×2، عبّ طابوره.`, btn: '📍 وديني', go: { guide: o, label: name } });
    else if (!production.queue(s, st).length) out.push({ icon: '⏱️', text: `${name} فاضي، حط له شغل عشان ينتج وأنت تمشي.`, btn: '📍 وديني', go: { guide: o, label: name } });
  }
  // القن
  const co = s.built.coop && g.worldObjById['spot:coop'];
  if (co) {
    const c = coopSys.coop(s);
    if (c.eggs) out.push({ icon: '🥚', text: `القن فيه ${c.eggs} بيض، استلمه!`, btn: '📍 وديني', go: { guide: co, label: 'القن' } });
    if (coopSys.hungry(s)) out.push({ icon: '🐔', text: coopSys.feedItem(s) ? 'الدجاج جوعان وما يبيض! حط له أكل (قمح، برسيم، ذرة).' : 'الدجاج جوعان وما عندك أكل له. ازرع قمح أو اشترِ برسيم.', btn: coopSys.feedItem(s) ? '📍 وديني' : '🛒 برسيم', go: coopSys.feedItem(s) ? { guide: co, label: 'القن' } : { store: 'items' } });
  }
  const sold = s.stall.slots.filter(x => x && x.sold).length;
  if (sold) out.push({ icon: '🏪', text: `بسطتك باعت ${sold} غرض، استلم فلوسك.`, btn: '🏪 البسطة', go: { trade: 'stall' } });
  // طلبات الجيران اللي تقدر تسلّمها
  for (const id of Object.keys(FARMS)) {
    const rq = farmsSys.ensureRequest(s, id, day);
    if (!rq || rq.done) continue;
    if (has(s, { [rq.item]: rq.qty })) {
      const go = g.mode === 'open' ? { guide: g.open.farmObjs[id].owner, label: FARMS[id].owner, mode: 'open' } : { travel: true };
      out.push({ icon: '📜', text: `${FARMS[id].owner} يبي ${rq.qty} ${ITEMS[rq.item].icon} ${ITEMS[rq.item].name} (عندك!) — الجايزة 🪙${rq.coins} ومودّة.`, btn: g.mode === 'open' ? '📍 وديني' : '🗺️ القرية', go });
      break;
    }
  }
  const canOpen = BUILD_ZONES.find(z => !isZoneOpen(s, z) && (s.player.level || 1) >= z.lock.level && s.player.coins >= z.lock.coins);
  if (canOpen) out.push({ icon: '🗺️', text: `تقدر تفتح ${canOpen.icon} ${canOpen.name} بـ🪙${fmt(canOpen.lock.coins)} وتكبّر أرضك!`, btn: '🔓 التوسعة', go: { store: 'build:land' } });
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
    else if (go.coop) { close(); this.openCoop(); }
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
    let sub = null;
    if (tab.includes(':')) [tab, sub] = tab.split(':');
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
        else if (tab === 'build') { if (sub) { m.bcat = sub; sub = null; } body = this.storeBuild(m); }
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
      if (counts(id) && bagFree(s) < Number(n)) { this.audio.play('deny'); this.toast('🎒 حقيبتك ما تشيل! حط أغراضك بصندوق أو كبّر حقيبتك'); return; }
      s.player.coins -= cost; add(s, id, Number(n));
      this.audio.play('coin'); m.rerender(); this.refresh();
    };
    const use = { water: 'تسقي فيه الزرع والحلال', alfalfa: 'أكل النياق والغنم', dates: 'أكل لك وللنياق', beans: 'تسوي منه قهوة للضيوف', wood: 'للبناء والصناعة', stone: 'للبناء', clay: 'للفخار والطوب', plank: 'للبناء', rope: 'للبناء', brick: 'للجدران', wool: 'تنسج منه سجاد', jar: 'ديكور وطلبات', lantern: 'إضاءة وسمعة' };
    const lv = s.bagLevel || 0;
    const upCost = BAG_UPGRADE_COINS[lv];
    m.handlers.bagup = () => {
      if (upCost == null || s.player.coins < upCost) { this.audio.play('deny'); return; }
      s.player.coins -= upCost;
      s.bagLevel = lv + 1;
      this.audio.play('build');
      this.toast(`🎒 حقيبتك صارت تشيل ${bagCap(s)}!`, 'gain', 3);
      m.rerender(); this.refresh();
    };
    const bagCard = `<div class="scard ready"><div class="sbig">🎒</div><b>حقيبة أكبر</b><div class="sinfo">الحين تشيل ${bagCap(s)} غرض (مستعمل ${bagUsed(s)})</div>
      ${upCost != null ? `<div class="sinfo">تصير ${BAG_CAPS[lv + 1]}</div><button class="btn green" data-a="bagup" ${s.player.coins >= upCost ? '' : 'disabled'}>🪙${fmt(upCost)}</button>` : '<div class="lock ok">أكبر حقيبة ✨</div>'}</div>`;
    return `<div class="sgrid">${bagCard}${STORE_ITEMS.map(id => {
      const pr = this.buyPrice(id);
      return `<div class="scard"><div class="sbig">${itemIcon(id)}</div><b>${itemName(id)}</b><div class="sinfo">${esc(use[id] || '')}</div>
        <div class="row center"><button class="btn" data-a="bitem" data-v="${id}:1" ${s.player.coins >= pr ? '' : 'disabled'}>🪙${pr}</button><button class="btn" data-a="bitem" data-v="${id}:5" ${s.player.coins >= pr * 5 ? '' : 'disabled'}>×5</button></div>
        <div class="sfoot">عندك <b>${count(s, id)}</b></div></div>`;
    }).join('')}</div>`;
  };

  P.storeBuild = function (m) {
    const g = this.g;
    const s = g.state;
    m.bcat = m.bcat || 'out';
    const cats = [['out', '🏗️ مباني برا'], ['field', '🌾 حقول'], ['deco', '🌺 ديكور وطرق'], ['land', '🗺️ توسعة الأرض'], ['in', '🛋️ داخل البيت'], ['home', '🏠 ترميم البيت']];
    m.handlers.arrange = () => { m.close(); g.startArrange(); };
    m.handlers.zgo = (type) => { const z = zonesFor(type).find(q => isZoneOpen(s, q)) || zonesFor(type)[0]; const c = zoneCenter(z); this.hubGo({ guide: { x: c.x * TILE, y: c.y * TILE }, label: z.name }, m); };
    const zoneLine = (type) => { const zs = zonesFor(type); return zs.length ? `<div class="sinfo">📍 مكانه: <b>${zs.map(z => z.icon + ' ' + z.name + (isZoneOpen(s, z) ? '' : ' 🔒')).join(' أو ')}</b> <button class="link" data-a="zgo" data-v="${type}">وديني</button></div>` : ''; };
    m.handlers.zopen = (id) => { if (g.unlockZone(id)) m.rerender(); };
    m.handlers.zgo2 = (id) => { const z = zoneById(id); const c = zoneCenter(z); this.hubGo({ guide: { x: c.x * TILE, y: c.y * TILE }, label: z.name }, m); };
    const arrangeBtn = '<div class="row center" style="margin:4px 0 8px"><button class="btn blue" data-a="arrange">🧩 رتّب مزرعتك (انقل أي شي)</button></div>';
    m.handlers.bcat = (v) => { m.bcat = v; this.audio.play('ui'); m.rerender(); };
    const buyMissing = (cost) => {
      const mc = missingCost(s, cost, (x) => this.buyPrice(x));
      if (s.player.coins < mc.coins) { this.audio.play('deny'); this.toast('الدراهم ما تكفي 💸'); return; }
      s.player.coins -= mc.coins;
      for (const [x, n] of Object.entries(mc.miss)) add(s, x, n);
      this.audio.play('coin');
      m.rerender(); this.refresh();
    };
    m.handlers.bmiss = (id) => buyMissing(BUILD_SPOTS[id].cost);
    m.handlers.pmiss = (type) => buyMissing(placement.info(type).cost);
    m.handlers.bbuild = (id) => { if (g.doBuild(id)) { this.toast(`🔨 بنيت ${BUILD_SPOTS[id].name}!`, 'gain', 3); m.rerender(); } else this.audio.play('deny'); };
    m.handlers.bwhere = (id) => this.hubGo({ guide: g.worldObjById['spot:' + id], label: BUILD_SPOTS[id].name }, m);
    m.handlers.btech = () => { m.close(); this.openTech(); };
    m.handlers.place = (type) => { m.close(); g.startPlacing(type); };
    m.handlers.pbuild = (id) => { m.close(); this.openBuild(id); };
    m.handlers.pmenu = (pid) => { m.close(); this.openPlacedMenu(pid); };
    const chips = `<div class="helpnav">${cats.map(([id, label]) => `<button class="hbtn2 ${m.bcat === id ? 'on' : ''}" data-a="bcat" data-v="${id}"><small>${label}</small></button>`).join('')}</div>`;
    const miss = (cost) => { const mc = missingCost(s, cost, (x) => this.buyPrice(x)); return mc.coins ? `<button class="btn" data-a="MISS" ${s.player.coins >= mc.coins ? '' : 'disabled'}>اشترِ الناقص 🪙${fmt(mc.coins)}</button>` : ''; };
    let body = '';
    if (m.bcat === 'land') {
      body = `<p class="howto">🗺️ أرضك تكبر معك! الساحات المسكّرة 🔒 تنفتح لما توصل مستواها وتدفع دراهمها، وبعدها تبني فيها حقول ومباني زيادة.</p><div class="sgrid">${[...BUILD_ZONES].sort((a, b) => (isZoneOpen(s, a) ? 1 : 0) - (isZoneOpen(s, b) ? 1 : 0) || ((a.lock || {}).level || 0) - ((b.lock || {}).level || 0)).map(z => {
        const open = isZoneOpen(s, z);
        const r = z.rect;
        const size = `${r.x1 - r.x0 + 1}×${r.y1 - r.y0 + 1}`;
        const what = [...new Set(z.types.map(t => placement.info(t).name))].join('، ');
        let act;
        if (open) act = `<div class="lock ok">✅ مفتوحة</div>`;
        else if ((s.player.level || 1) < z.lock.level) act = `<div class="lock">🔒 مستوى ${z.lock.level} (أنت ${s.player.level || 1})</div><div class="sinfo">🪙${fmt(z.lock.coins)}</div>`;
        else act = `<button class="btn green big" data-a="zopen" data-v="${z.id}" ${s.player.coins >= z.lock.coins ? '' : 'disabled'}>🔓 افتحها 🪙${fmt(z.lock.coins)}</button>`;
        return `<div class="scard ${open ? 'done' : (s.player.level || 1) >= z.lock.level && s.player.coins >= z.lock.coins ? 'ready' : ''}"><div class="sbig">${open ? z.icon : '🔒'}</div><b>${esc(z.name)}</b>
          <div class="sinfo">📐 ${size} • تبني فيها: ${esc(what)}</div><div class="row center">${act}<button class="link" data-a="zgo2" data-v="${z.id}">📍 وديني</button></div></div>`;
      }).join('')}</div>`;
    } else if (m.bcat === 'field') {
      const n = placement.placedOf(s, 'field').length, max = placement.maxFields(s), price = placement.fieldPrice(s);
      const empty = placement.placedOf(s, 'field').filter(p => !s.plots[placement.fieldId(p)]).length;
      body = `<p class="howto">🌾 اشترِ حقول وحطها داخل <b>🌾 ساحة المزرعة</b> (جنب الأحواض).${zoneLine('field')} كل حقل تزرع فيه زي الأحواض، ولو نقلته <b>الزرع ينتقل معه</b>. عدد الحقول يزيد كل ما كبر مستواك.</p>
        <div class="sgrid"><div class="scard ${n < max && s.player.coins >= price ? 'ready' : ''}"><div class="sbig">🌱</div><b>حقل زراعة</b>
          <div class="sinfo">عندك ${n}/${max} حقل${empty ? ` • ${empty} فاضي` : ''}</div><div class="sinfo">السعر: 🪙${price} (يزيد مع كل حقل)</div>
          <div class="row center">${n < max ? `<button class="btn green big" data-a="place" data-v="field" ${s.player.coins >= price ? '' : 'disabled'}>📍 ضعه</button>` : `<div class="lock">🔒 الحقل الجاي بمستوى ${(max - 3) * 2}</div>`}</div></div>
          <div class="scard"><div class="sbig">🧩</div><b>رتّب حقولك</b><div class="sinfo">انقل أي حقل أو مبنى لمكان ثاني</div><button class="btn blue" data-a="arrange">🧩 رتّب</button></div></div>`;
    } else if (m.bcat === 'home') {
      const list = Object.entries(BUILD_SPOTS).filter(([id]) => g.worldObjById['spot:' + id] && !g.worldObjById['spot:' + id].dynamic && !spotStatus(s, id).hidden);
      list.sort((x, y) => (s.built[x[0]] ? 1 : 0) - (s.built[y[0]] ? 1 : 0));
      body = `<p class="howto">🏠 هذي تصليحات لبيتك نفسه (الجدران والغرف والمجلس...). مكانها ثابت داخل البيت.</p><div class="sgrid">${list.map(([id, sp]) => {
        const st = spotStatus(s, id);
        const built = !!s.built[id];
        let act;
        if (built) act = '<div class="lock ok">✅ مبني</div>';
        else if (st.needTech) act = `<button class="btn blue" data-a="btech">🔒 ${esc(TECH_BY_ID[st.needTech].name)}</button>`;
        else if (st.ok) act = `<button class="btn green big" data-a="bbuild" data-v="${id}">ابنِ 🔨</button>`;
        else act = miss(sp.cost).replace('MISS', 'bmiss" data-v="' + id);
        return `<div class="scard ${built ? 'done' : st.ok ? 'ready' : ''}"><b>${esc(sp.name)}</b>${sp.rating ? `<div class="sinfo">⭐ سمعة +${sp.rating}</div>` : ''}<div class="sinfo">${esc(sp.desc)}</div>
          ${built ? '' : this.costHtml(sp.cost)}<div class="row center">${act}${built ? '' : `<button class="link" data-a="bwhere" data-v="${id}">📍 وين؟</button>`}</div></div>`;
      }).join('')}</div>`;
    } else if (m.bcat === 'out') {
      const types = Object.keys(PLACEABLES).filter(t => PLACEABLES[t].cat === 'building');
      body = `<p class="howto">🏗️ كل مبنى له <b>ساحة بناء</b> محددة عليها لوحة «يمديك تبني هنا». اضغط <b>«📍 ضعه»</b> وحرّكه داخل ساحته (الساحة تلمع بالأخضر). بعدين ابنه بنفسك أو خلّ البنّاء يبنيه.</p>${arrangeBtn}<div class="sgrid">${types.map(type => {
        const d = PLACEABLES[type];
        const inf = placement.info(type);
        const st = spotStatus(s, d.spot);
        const p = placement.placedOf(s, type)[0];
        const built = placement.isBuilt(s, p);
        let act;
        if (built) act = `<div class="lock ok">✅ مستوى ${placement.levelOf(s, p)}</div><button class="btn blue" data-a="pmenu" data-v="${p.id}">🔧 إدارة</button>`;
        else if (p) act = `<button class="btn green" data-a="pbuild" data-v="${d.spot}">🔨 ابنِه</button><button class="link" data-a="bwhere" data-v="${d.spot}">📍 وين؟</button>`;
        else if (st.hidden && st.reason) act = `<div class="lock">🔒 ${esc(st.reason)}</div>`;
        else if (st.needTech) act = `<button class="btn blue" data-a="btech">🔒 ${esc(TECH_BY_ID[st.needTech].name)}</button>`;
        else if (d.inside && !placement.placedOf(s, d.inside).length) act = `<div class="lock">🔒 حط ${esc(placement.info(d.inside).name)} أول</div>`;
        else act = `<button class="btn green big" data-a="place" data-v="${type}">📍 ضعه</button>${miss(inf.cost).replace('MISS', 'pmiss" data-v="' + type)}`;
        return `<div class="scard ${built ? 'done' : !p && !st.hidden && !st.needTech ? 'ready' : ''}"><div class="sbig">${d.icon}</div><b>${esc(inf.name)}</b>
          <div class="sinfo">${esc(inf.desc)}</div><div class="sinfo">📐 ${d.w}×${d.h}${inf.rating ? ` • ⭐ سمعة +${inf.rating}` : ''}${d.perk ? ` • ⬆️ ${esc(d.perk)}` : ''}</div>${zoneLine(type)}
          ${built ? '' : this.costHtml(inf.cost)}<div class="row center">${act}</div></div>`;
      }).join('')}</div>`;
    } else {
      const zone = m.bcat === 'deco' ? 'out' : 'in';
      const types = Object.keys(PLACEABLES).filter(t => PLACEABLES[t].cat !== 'building' && PLACEABLES[t].zone === zone);
      const head = zone === 'out'
        ? `<p class="howto">🌺 زيّن مزرعتك: ممرات وسياج وورد. كل قطعة ترفع <b>جمال المزرعة</b> (الحين ${placement.beauty(s)} 🌸 = دراهم الضيوف +${Math.round(placement.beautyBonus(s) * 100)}%).</p>`
        : `<p class="howto">🛋️ داخل بيتك: <b>صناديق 📦</b> تخزّن فيها أغراضك (حقيبتك تشيل ${bagCap(s)} بس)، و<b>أثاث</b> يرفع راحة البيت (الحين ${placement.comfort(s)} 🛋️ = طاقتك القصوى +${placement.comfort(s)}).</p>`;
      body = head + `<div class="sgrid">${types.map(type => {
        const d = PLACEABLES[type];
        const inf = placement.info(type);
        const item = placement.furnitureItem(type);
        const n = placement.placedOf(s, type).length;
        const can = item ? count(s, item) > 0 : (has(s, inf.cost) && s.player.coins >= inf.coins);
        const full = !placement.canAddMore(s, type);
        const price = item ? `<div class="sinfo">يحتاج ${ITEMS[item].icon} ${ITEMS[item].name} من حقيبتك (عندك ${count(s, item)})</div>` : `${Object.keys(inf.cost).length ? this.costHtml(inf.cost) : ''}${inf.coins ? `<div class="sinfo">🪙${inf.coins}</div>` : ''}`;
        const perk = (d.beauty ? `🌸 جمال +${d.beauty}` : d.comfort ? `🛋️ راحة +${d.comfort}` : type === 'chest' ? `📦 يشيل ${80} غرض (يترقّى)` : '') + (d.speed ? ' • 🏃 يسرّع المشي +35%' : '');
        return `<div class="scard ${can && !full ? 'ready' : ''}"><div class="sbig">${d.icon}</div><b>${esc(inf.name)}</b><div class="sinfo">${perk}${n ? ` • عندك ${n}` : ''}</div>${price}
          <div class="row center">${full ? '<div class="lock">وصلت الحد</div>' : `<button class="btn green" data-a="place" data-v="${type}" ${can ? '' : 'disabled'}>📍 ضعه</button>${!item && !can ? miss(inf.cost).replace('MISS', 'pmiss" data-v="' + type) : ''}`}</div></div>`;
      }).join('')}</div>`;
    }
    return chips + body;
  };

  // ---------- إدارة مبنى أو قطعة منحطة ----------
  P.openPlacedMenu = function (pid) {
    const g = this.g;
    const s = g.state;
    const p0 = placement.placedById(s, pid);
    if (!p0) return;
    const d = PLACEABLES[p0.type];
    const inf = placement.info(p0.type);
    this.modal({
      title: `${d.icon} ${inf.name}`, cls: 'small',
      render: (m) => {
        const p = placement.placedById(s, pid);
        if (!p) { m.close(); return; }
        const built = placement.isBuilt(s, p);
        const lv = placement.levelOf(s, p);
        const u = placement.nextUpgrade(s, p);
        const opener = { kiln: 1, mill: 1, loom: 1, stall_shop: 1, orders_board: 1, workers_house: 1, stable: 1, sheepfold: 1, chest: 1, coop: 1 }[p.type];
        const extra = d.beauty ? `🌸 جمال +${d.beauty}` : d.comfort ? `🛋️ راحة +${d.comfort}` : p.type === 'chest' ? `📦 ${placement.chestUsed(s, pid)}/${placement.chestCap(s, pid)}` : '';
        m.body.innerHTML = `<div class="bmenu"><div class="big">${d.icon}</div>
          ${d.levels ? `<p class="center"><b>المستوى ${lv}/${d.levels.length}</b>${d.perk ? ` — ${esc(d.perk)}` : ''}</p>` : ''}
          ${extra ? `<p class="center">${extra}</p>` : ''}
          ${u ? `<div class="card"><b>⬆️ الترقية للمستوى ${u.level}</b>${this.costHtml(u.cost)}${u.coins ? `<div>🪙${fmt(u.coins)}</div>` : ''}<div class="row center"><button class="btn green" data-a="up" ${has(s, u.cost) && s.player.coins >= u.coins ? '' : 'disabled'}>⬆️ رقِّه</button>${missingCost(s, u.cost, (x) => this.buyPrice(x)).coins ? `<button class="btn" data-a="upmiss">اشترِ الناقص 🪙${fmt(missingCost(s, u.cost, (x) => this.buyPrice(x)).coins)}</button>` : ''}</div></div>` : d.levels && built ? '<p class="center muted">وصل أعلى مستوى ✨</p>' : ''}
          <div class="row center" style="margin-top:8px">
            ${opener && built ? '<button class="btn blue" data-a="open">📂 افتح</button>' : ''}
            <button class="btn" data-a="move">🔀 انقل</button>
            ${!placement.isBuilding(p.type) ? '<button class="btn" data-a="del" style="background:#e8b0a0">🗑️ شيله</button>' : ''}
          </div></div>`;
        m.handlers.up = () => { if (g.upgradePlaced(pid)) { this.toast(`⬆️ ${inf.name} صار مستوى ${placement.levelOf(s, placement.placedById(s, pid))}!`, 'gain', 3); m.rerender(); this.refresh(); } };
        m.handlers.upmiss = () => {
          const mc = missingCost(s, u.cost, (x) => this.buyPrice(x));
          if (s.player.coins < mc.coins) { this.audio.play('deny'); return; }
          s.player.coins -= mc.coins;
          for (const [x, n] of Object.entries(mc.miss)) add(s, x, n);
          this.audio.play('coin'); m.rerender(); this.refresh();
        };
        m.handlers.move = () => { m.close(); g.startPlacing(p.type, pid); };
        m.handlers.del = () => { if (g.removePlacedItem(pid)) { this.toast('🗑️ شلته' + (placement.furnitureItem(p.type) ? '، ورجع لحقيبتك' : '')); m.close(); } };
        m.handlers.open = () => {
          m.close();
          if (p.type === 'chest') this.openChest(pid);
          else if (p.type === 'stall_shop') this.openTrade('stall');
          else if (p.type === 'orders_board') this.openTrade('orders');
          else if (p.type === 'workers_house') this.openWorkers();
          else if (p.type === 'stable') this.openCamels(null, 'pen');
          else if (p.type === 'sheepfold') this.openTrade('sheep');
          else if (p.type === 'coop') this.openCoop();
          else this.openCraft(BUILD_SPOTS[d.spot].station);
        };
      },
    });
  };

  // ---------- الصندوق ----------
  P.openChest = function (pid) {
    const g = this.g;
    const s = g.state;
    const isBarn = !!(s.chests[pid] && s.chests[pid].only);
    this.modal({
      title: isBarn ? '🏚️ المخزن (مواد البناء)' : '📦 الصندوق',
      cls: 'store',
      render: (m) => {
        const box = s.chests[pid];
        if (!box) { m.close(); return; }
        const cap = placement.chestCap(s, pid), used = placement.chestUsed(s, pid);
        const bu = bagUsed(s), bc = bagCap(s);
        const bagIds = Object.keys(s.inv).filter(id => ITEMS[id] && s.inv[id] > 0 && (!isBarn || MATS.has(id))).sort();
        const boxIds = Object.keys(box.items).filter(id => box.items[id] > 0).sort();
        const row = (id, n, a) => `<div class="shop-row"><span class="ic">${itemIcon(id)}</span><span class="nm">${itemName(id)} <small class="muted">×${n}</small></span><button class="btn" data-a="${a}" data-v="${id}:1">1</button><button class="btn green" data-a="${a}" data-v="${id}:all">الكل</button></div>`;
        m.body.innerHTML = `<div class="row center" style="margin-bottom:6px">
            <button class="btn" data-a="depcat" data-v="mats">⬅️ حط كل المواد</button>
            ${isBarn ? '' : `<button class="btn" data-a="depcat" data-v="crops">⬅️ حط كل المحاصيل</button>
            <button class="btn" data-a="depcat" data-v="all">⬅️ حط الكل</button>`}</div>
          ${isBarn ? '<p class="muted center">المخزن يشيل مواد البناء بس: خشب، حجر، طين، ألواح، حبال، طوب، صوف...</p>' : ''}
          <div class="chestwrap">
            <div class="chestcol"><h4><span>${isBarn ? '🏚️ المخزن' : '📦 الصندوق'}</span><span>${used}/${cap}</span></h4><div class="bar"><i style="width:${Math.min(100, used / cap * 100)}%"></i></div>
              ${boxIds.map(id => row(id, box.items[id], 'wd')).join('') || '<p class="muted center">فاضي</p>'}</div>
            <div class="chestcol"><h4><span>🎒 حقيبتك</span><span>${bu}/${bc}</span></h4><div class="bar"><i style="width:${Math.min(100, bu / bc * 100)}%"></i></div>
              ${bagIds.map(id => row(id, s.inv[id], 'dep')).join('') || '<p class="muted center">فاضية</p>'}</div>
          </div>`;
        const moveIt = (fn, v) => { const [id, n] = v.split(':'); const k = fn(s, pid, id, n === 'all' ? 9999 : 1); if (!k) { this.audio.play('deny'); this.toast(fn === placement.deposit ? 'الصندوق مليان' : 'حقيبتك مليانة'); } else this.audio.play('ui'); m.rerender(); this.refresh(); };
        m.handlers.dep = (v) => moveIt(placement.deposit, v);
        m.handlers.wd = (v) => moveIt(placement.withdraw, v);
        m.handlers.depcat = (v) => {
          let k = 0;
          for (const id of Object.keys(s.inv)) {
            if (!ITEMS[id]) continue;
            if (v === 'mats' && !MATS.has(id)) continue;
            if (v === 'crops' && !CROPS.has(id)) continue;
            k += placement.deposit(s, pid, id, 9999);
          }
          this.toast(k ? `📦 حطيت ${k} غرض بالصندوق` : 'ما فيه شي ينحط أو الصندوق مليان', k ? 'gain' : '', 2);
          m.rerender(); this.refresh();
        };
      },
    });
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
          { id: 'now', label: '💡 وش أسوي؟', badge: adv[0] && adv[0].go.travel ? 0 : Math.min(3, adv.length) },
          { id: 'farm', label: '🌾 مزرعتي' },
          { id: 'animals', label: '🐪 حلالي' },
          { id: 'property', label: `🏡 عقاراتي (${owned.length})` },
          { id: 'workers', label: `👷 عمّالي (${s.workers.length})` },
          { id: 'storage', label: `📦 المخزن` },
        ], tab, (v) => { tab = v; m.rerender(); });
        m.handlers.go = (i) => this.hubGo(m.gos[Number(i)], m);
        m.gos = [];
        const btn = (go, label, cls = '') => { m.gos.push(go); return `<button class="btn ${cls}" data-a="go" data-v="${m.gos.length - 1}">${label}</button>`; };
        let html = '';
        if (tab === 'now') {
          // أهم 3 بس عشان ما يضيع، والباقي بزر «المزيد»
          const shown = m.showAll ? adv : adv.slice(0, 3);
          m.handlers.more = () => { m.showAll = true; m.rerender(); };
          html = `<div class="advice">${shown.map((a, i) => `<div class="arow ${i === 0 ? 'top' : ''}"><span class="ic">${a.icon}</span><span class="nm">${esc(a.text)}</span>${btn(a.go, a.btn, 'green')}</div>`).join('')}</div>${!m.showAll && adv.length > 3 ? `<div class="row center"><button class="btn" data-a="more">⬇️ المزيد (${adv.length - 3})</button></div>` : ''}`;
        } else if (tab === 'farm') html = this.manageFarm(m, btn);
        else if (tab === 'animals') html = this.manageAnimals(m, btn);
        else if (tab === 'property') html = this.manageProperty(m, btn);
        else if (tab === 'storage') html = this.manageStorage(m, btn);
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
    m.handlers.pm = (pid) => { m.close(); this.openPlacedMenu(pid); };
    m.handlers.arr = () => { m.close(); this.g.startArrange(); };
    const blds = (s.placed || []).filter(p => placement.isBuilding(p.type)).map(p => {
      const d = PLACEABLES[p.type];
      const b = placement.isBuilt(s, p);
      return `<div class="acard"><span class="sbig">${d.icon}</span><div class="ainfo"><b>${esc(placement.info(p.type).name)}</b><small>${b ? `مستوى ${placement.levelOf(s, p)}` : '🚧 موقع بناء'}</small></div><div class="acol">${btn({ guide: { x: placement.anchor(p).x, y: placement.anchor(p).y }, label: placement.info(p.type).name }, '📍')}<button class="btn" data-a="pm" data-v="${p.id}">🔧</button></div></div>`;
    }).join('');
    return `<h4 class="sub">🌾 الأحواض</h4><div class="pgrid">${cards}</div>
      <h4 class="sub">🏗️ مبانيك برا (تنقلها وترقيها)</h4>
      <div class="row center" style="margin-bottom:6px"><button class="btn blue" data-a="arr">🧩 رتّب مزرعتك</button>${btn({ store: 'build:field' }, '🌱 حقول أكثر', 'green')}</div>
      ${blds || '<p class="muted">ما حطيت مباني للحين. افتح 🛒 المتجر ← مباني.</p>'}
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
      <h4 class="sub">🐑 الغنم (${s.sheep.length})</h4>${s.built.sheepfold ? (sh || '<p class="muted">ما عندك غنم.</p>') : '<p class="muted">🔒 ابنِ حظيرة الغنم أول.</p>'}
      <h4 class="sub">🐔 الدجاج (${coopSys.coop(s).hens})</h4>${this.coopCard(btn)}`;
  };

  P.coopCard = function (btn) {
    const g = this.g;
    const s = g.state;
    const co = g.worldObjById['spot:coop'];
    if (!s.built.coop || !co) return `<p class="muted">🔒 ابنِ قن الدجاج (بساحة الحلال) عشان يجيك بيض كل يوم.</p><div class="row center">${btn({ store: 'build:out' }, '🏗️ ابنِ القن', 'blue')}</div>`;
    const c = coopSys.coop(s);
    const hrs = Math.floor(c.feedMin / 60);
    return `<div class="acard"><span class="sbig">🐔</span><div class="ainfo"><b>قن الدجاج</b> <small class="muted">${c.hens}/${coopSys.henCap(s)} دجاجة • 🥚 ${c.eggs}/${coopSys.eggCap(s)}</small>
      <small>${coopSys.hungry(s) ? '<b class="warn">🌾 جوعان وما يبيض</b>' : `🌾 أكل يكفي ${hrs} ساعة`}</small></div>
      <div class="acol">${btn({ guide: co, label: 'القن' }, '📍')}${btn({ coop: true }, '🐔 افتح', 'green')}</div></div>`;
  };

  // ---------- فتح ساحة مسكّرة ----------
  P.openZoneUnlock = function (id) {
    const g = this.g;
    const s = g.state;
    const z = zoneById(id);
    if (!z) return;
    this.modal({
      title: `🔒 ${z.icon} ${z.name}`, cls: 'small',
      render: (m) => {
        if (isZoneOpen(s, z)) { m.close(); return; }
        const lvOk = (s.player.level || 1) >= z.lock.level;
        const coinOk = s.player.coins >= z.lock.coins;
        const what = [...new Set(z.types.map(t => placement.info(t).name))].join('، ');
        m.body.innerHTML = `<div class="bmenu">
          <p class="center">🗺️ ساحة جديدة تكبّر أرضك. تبني فيها: <b>${esc(what)}</b></p>
          <div class="row center zreq"><span class="ctag ${lvOk ? 'ok' : 'warn'}">⭐ المستوى ${z.lock.level} ${lvOk ? '✔' : `(أنت ${s.player.level || 1})`}</span><span class="ctag ${coinOk ? 'ok' : 'warn'}">🪙 ${fmt(z.lock.coins)} ${coinOk ? '✔' : `(عندك ${fmt(s.player.coins)})`}</span></div>
          <div class="row center"><button class="btn green" data-a="open" ${lvOk && coinOk ? '' : 'disabled'}>🔓 افتحها</button><button class="btn" data-a="all">🗺️ كل الساحات</button></div></div>`;
        m.handlers.open = () => { if (g.unlockZone(id)) { m.close(); if (g.placing) g.validatePlacing(); } };
        m.handlers.all = () => { m.close(); this.openStore('build:land'); };
      },
    });
  };

  // ---------- قن الدجاج ----------
  P.openCoop = function () {
    const g = this.g;
    const s = g.state;
    this.modal({
      title: '🐔 قن الدجاج', cls: 'small',
      render: (m) => {
        if (!s.built.coop) { m.close(); return; }
        const c = coopSys.coop(s);
        const cap = coopSys.henCap(s);
        const feedMax = coopSys.FEED_PER_ITEM * 12;
        const hrs = Math.floor(c.feedMin / 60);
        const perDay = Math.round(c.hens * 1440 / coopSys.LAY_EVERY);
        const feeds = coopSys.FEEDS.filter(id => count(s, id) > 0);
        m.body.innerHTML = `<div class="bmenu">
          <div class="coopstat"><div><span class="sbig">🐔</span><b>${c.hens}/${cap}</b><small>دجاجة</small></div><div><span class="sbig">🥚</span><b>${c.eggs}/${coopSys.eggCap(s)}</b><small>بيض</small></div><div><span class="sbig">🌾</span><b>${hrs} س</b><small>أكل</small></div></div>
          <div class="bar coopbar"><i style="width:${Math.min(100, c.feedMin / feedMax * 100)}%"></i></div>
          <p class="howto">${coopSys.hungry(s) ? '⚠️ <b>الدجاج جوعان وما يبيض!</b> ' : ''}كل دجاجة تبيض بيضة كل ${coopSys.LAY_EVERY / 60} ساعات لعب وهي شبعانة (≈${perDay} بيضة باليوم). كل حبة أكل تكفي القن كله ${coopSys.FEED_PER_ITEM / 60} ساعات. البيض ينباع أو تطبخ فيه 🍳 شكشوكة بالموقد.</p>
          <div class="row center">
            <button class="btn green" data-a="eggs" ${c.eggs ? '' : 'disabled'}>🥚 استلم البيض (${c.eggs})</button>
          </div>
          <h4 class="sub">🌾 حط أكل</h4>
          <div class="row center">${feeds.length ? feeds.map(id => `<button class="btn" data-a="feed" data-v="${id}:1">${itemIcon(id)} ×1 <small>(${count(s, id)})</small></button><button class="btn" data-a="feed" data-v="${id}:5">×5</button>`).join('') : '<span class="muted">ما عندك قمح ولا برسيم ولا ذرة. ازرعها أو اشترِ برسيم من المتجر.</span>'}</div>
          <h4 class="sub">🐣 دجاج أكثر</h4>
          <div class="row center"><button class="btn blue" data-a="hen" ${c.hens < cap && s.player.coins >= coopSys.HEN_PRICE ? '' : 'disabled'}>🐔 اشترِ دجاجة 🪙${coopSys.HEN_PRICE}</button>${c.hens >= cap ? '<button class="btn" data-a="pm">⬆️ رقِّ القن</button>' : ''}</div>
          <div class="row center" style="margin-top:8px"><button class="btn" data-a="pm">🔧 انقل / رقِّ</button>${feeds.length ? '' : '<button class="btn" data-a="buy">🛒 اشترِ برسيم</button>'}</div>
        </div>`;
        m.handlers.eggs = () => {
          const n = c.eggs;
          if (!g.hasRoom(n, 'egg')) return;
          coopSys.collectEggs(s);
          const co = g.worldObjById['spot:coop'];
          g.gainItems({ egg: n }, co ? co.x : s.player.x, co ? co.y : s.player.y, 26);
          this.audio.play('pick'); m.rerender(); this.refresh();
        };
        m.handlers.feed = (v) => {
          const [id, n] = v.split(':');
          const k = coopSys.addFeed(s, id, Number(n));
          if (!k) { this.audio.play('deny'); return; }
          this.audio.play('eat');
          this.toast(`🌾 حطيت ${k} ${itemName(id)} للدجاج (+${k * coopSys.FEED_PER_ITEM / 60} ساعة أكل)`, 'gain', 2);
          m.rerender(); this.refresh();
        };
        m.handlers.hen = () => {
          const r = coopSys.buyHen(s);
          if (!r.ok) { this.audio.play('deny'); this.toast(r.reason); return; }
          this.audio.play('coin'); this.toast('🐔 دجاجة جديدة بالقن!', 'gain', 2);
          m.rerender(); this.refresh();
        };
        m.handlers.pm = () => { const p = placement.placedOf(s, 'coop')[0]; m.close(); if (p) this.openPlacedMenu(p.id); };
        m.handlers.buy = () => { m.close(); this.openStore('items'); };
      },
    });
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

  P.manageStorage = function (m, btn) {
    const s = this.g.state;
    const chests = placement.placedOf(s, 'barn').concat(placement.placedOf(s, 'chest'));
    const bu = bagUsed(s), bc = bagCap(s);
    const rows = chests.map((p, i) => {
      const used = placement.chestUsed(s, p.id), cap = placement.chestCap(s, p.id);
      const top = Object.entries(s.chests[p.id].items).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${itemIcon(k)}${n}`).join(' ');
      if (!s.chests[p.id]) return '';
      if (p.type === 'barn') return `<div class="acard owned"><span class="sbig">🏚️</span><div class="ainfo"><b>المخزن الكبير</b> <small class="muted">${placement.isBuilt(s, p) ? `مستوى ${placement.levelOf(s, p)} • ${used}/${cap}` : '🚧 ما انبنى للحين'}</small><small>${top || 'فاضي'}</small></div><div class="acol">${btn({ guide: placement.anchor(p), label: 'المخزن' }, '📍 وديني')}</div></div>`;
      return `<div class="acard"><span class="sbig">📦</span><div class="ainfo"><b>صندوق ${i + 1 - (placement.placedOf(s, 'barn').length)}</b> <small class="muted">مستوى ${placement.levelOf(s, p)} • ${used}/${cap}</small><small>${top || 'فاضي'}</small></div><div class="acol">${btn({ guide: placement.anchor(p), label: 'الصندوق' }, '📍 وديني')}</div></div>`;
    }).join('');
    return `<p class="howto">🎒 حقيبتك: <b>${bu}/${bc}</b>. إذا امتلت، اللي تجمعه يروح للصناديق تلقائياً. البناء والصناعة ياخذون من الصناديق بعد.</p>
      <div class="row center">${placement.placedOf(s, 'barn').length ? '' : btn({ store: 'build' }, '🏚️ ابنِ المخزن الكبير', 'blue')}${btn({ store: 'build:in' }, '📦 صندوق جديد', 'green')}${btn({ store: 'items' }, '🎒 كبّر حقيبتك')}</div>
      ${rows || '<p class="muted center">ما عندك صناديق. ابنِ صندوق داخل بيتك من 🛒 المتجر ← مباني ← داخل البيت.</p>'}`;
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
      { icon: '🐪', title: 'الحلال', steps: ['ابنِ المراح 🏗️ وتجيك ناقتين هدية.', 'كل يوم اسقها وأطعمها (برسيم أو تمر)، أو اضغط «اسقِ وأطعم الكل» من 📋 إدارتي.', 'احلب النياق 🥛، ولقّح الفحل مع الناقة، وفيه فرصة يطلع لك حوار نادر!', 'كل ناقة لها خواص ✨، والحوار يورثها. النادرة تسوى ثروة.', 'ابنِ 🐔 قن الدجاج وتجيك 3 دجاجات هدية. أكّلهم قمح أو برسيم أو ذرة ويبيضون 🥚 كل ساعتين، والبيض ينباع أو تطبخ فيه 🍳 شكشوكة.'], go: { manage: 'animals' }, btn: '🐪 حلالي' },
      { icon: '💰', title: 'البيع والتجارة', steps: ['أسرع طريقة: 🛒 المتجر ← «💰 بيع»، وتبيع أي شي على طول.', 'تبي سعر أعلى؟ ابنِ البسطة 🏪 وحط أغراضك بسعرك، والمارّة يشترون.', 'لوحة الطلبات 📋 تجيك طلبات قوافل بجوايز حلوة.', 'بالحلال تقدر تساوم وتقايض من 🐪 الحلال ← السوق.'], go: { store: 'sell' }, btn: '💰 بيع الحين' },
      { icon: '🏗️', title: 'البناء', steps: ['اجمع خشب 🪵 وحجر 🪨 وطين 🟫 من النخل والسدر والصخور.', '🛒 المتجر ← «🏗️ مباني» ← «📍 ضعه»: كل مبنى له <b>ساحة بناء</b> عليها لوحة «يمديك تبني هنا». الساحة الصح تلمع بالأخضر، حرّكه داخلها واضغط «ضعه هنا».', 'الفرن والرحى والنول تشتغل بالوقت: حط طلبات بالطابور ⏱️، وارجع استلمها لما تخلص 📥.', 'ابنه بنفسك أو خلّ البنّاء 👷 يبنيه. بعدين تقدر 🔀 تنقله أو ⬆️ ترقّيه من زر 🔧.', 'داخل بيتك حط 📦 صناديق تخزّن فيها أغراضك (حقيبتك لها سعة)، وأثاث يرفع راحتك وطاقتك.', 'كل ورشة لها يوم بالأسبوع 📅 شغلها فيه أسرع ×2: السبت الرحى، الاثنين النول، الخميس الفرن.', 'زيّن برا بممرات وسياج وورد 🌺، الجمال يزيد دراهم الضيوف. والمشي على 🪨 الممرات أسرع +35% 🏃.', 'أرضك تكبر! الساحات المسكّرة 🔒 تفتحها بالمستوى والدراهم من 🛒 المتجر ← مباني ← «🗺️ توسعة الأرض».'], go: { store: 'build' }, btn: '🏗️ المباني' },
      { icon: '👷', title: 'العمّال', steps: ['وظّف حطّاب، مزارع، بنّاء، أو راعي من 👷 العمّال.', 'يشتغلون لحالهم، وراتبهم بالساعة.', 'لا تتأخر بالراتب! إذا تأخرت يضربون ✊ ويبون غرامة.', 'فعّل الدفع التلقائي وارتاح.'], go: { workers: true }, btn: '👷 العمّال' },
      { icon: '🗺️', title: 'القرية والعقارات', steps: ['اطلع من «طريق القرية» يسار مزرعتك.', 'فيها 5 مزارع جيران: تشتري منهم بضاعة ونياق وغنم وتساومهم.', 'كل جار عنده 📜 طلب يومي: سلّمه وخذ دراهم و❤️ مودّة. المودّة تعطيك خصم على بضاعته (5% ← 10% ← 15%).', 'تقدر تشتري مزرعة كاملة 🏡 وتصير تنتج لك كل يوم.', 'من 📋 إدارتي ← عقاراتي: طوّرها واستلم إنتاجها.'], go: { manage: 'property' }, btn: '🏡 عقاراتي' },
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
            <ol>${tp.steps.map(x => `<li>${esc(x).replace(/&lt;(\/?)b&gt;/g, '<$1b>')}</li>`).join('')}</ol>
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
