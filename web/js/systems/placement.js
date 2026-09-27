// وضع المباني والديكور والأثاث باختيارك: التحقق من المكان، الوضع، النقل، الترقية، وتحويل الحفظ القديم
import { PLACEABLES, LEGACY_POS, WORKSHOP_YARD, CHEST_CAP, COMFORT_MAX, BEAUTY_STEP } from '../data/buildings.js';
import { BUILD_SPOTS } from '../data/recipes.js';
import { ITEMS } from '../data/items.js';
import { T, TILE, KHAN, MAP_W, MAP_H, tileAt } from '../data/map.js';
import { add, count, counts, bagFree, bagUsed, bagCap } from './inventory.js';

const OUT_TILES = new Set([T.SAND, T.SAND2, T.GRASS, T.WADI, T.ROCKY]);
const IN_TILES = new Set([T.FLOOR, T.ROOMFLOOR]);

// معلومات النوع: الاسم والتكلفة من BUILD_SPOTS إذا كان مبنى
export function info(type) {
  const d = PLACEABLES[type];
  if (!d) return null;
  const sp = d.spot ? BUILD_SPOTS[d.spot] : null;
  const name = d.name || (sp ? sp.name : type);
  const cost = d.cost || (sp ? sp.cost : {}) || {};
  return { type, ...d, name, cost, coins: d.coins || 0, desc: d.desc || (sp ? sp.desc : ''), rating: sp ? sp.rating : 0 };
}

export function isBuilding(type) {
  return !!(PLACEABLES[type] && PLACEABLES[type].cat === 'building');
}

export function dims(type, flip) {
  const d = PLACEABLES[type];
  return flip && d.w !== d.h ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
}

export function footprint(p) {
  const { w, h } = dims(p.type, p.flip);
  return { x0: p.tx, y0: p.ty, x1: p.tx + w - 1, y1: p.ty + h - 1 };
}

// نقطة الرسم: نص المبنى من تحت (نفس نظام كائنات العالم)
export function anchor(p) {
  const { w, h } = dims(p.type, p.flip);
  return { x: (p.tx + w / 2) * TILE, y: (p.ty + h) * TILE - 2 };
}

// مستطيل المراح أو الحظيرة بالبكسل (للحيوانات)
export function pxRect(p) {
  const f = footprint(p);
  return { x0: f.x0 * TILE + 10, x1: (f.x1 + 1) * TILE - 10, y0: f.y0 * TILE + 18, y1: (f.y1 + 1) * TILE - 6 };
}

export function placedOf(state, type) {
  return (state.placed || []).filter(p => p.type === type);
}

// المبنى مبني؟ (المباني من state.built عشان البنّاء والكود القديم يشتغلون زي ما هم)
export function isBuilt(state, p) {
  if (!p) return false;
  return isBuilding(p.type) ? !!state.built[PLACEABLES[p.type].spot] : true;
}

export function placedById(state, id) {
  return (state.placed || []).find(p => p.id === id) || null;
}

export function insideKhan(tx, ty) {
  return tx > KHAN.x0 && tx < KHAN.x1 && ty > KHAN.y0 && ty < KHAN.y1;
}

function nearKhan(tx, ty) {
  return tx >= KHAN.x0 - 1 && tx <= KHAN.x1 + 1 && ty >= KHAN.y0 - 1 && ty <= KHAN.y1 + 1;
}

// البلاطات اللي عليها كائنات ثابتة بالعالم (نخل، صخور، محطات، مواقع ترميم...)
const blockCache = new WeakMap();
export function worldBlockers(world) {
  if (blockCache.has(world)) return blockCache.get(world);
  const set = new Set();
  const rect = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set.add(x + ',' + y); };
  for (const o of world.objects) {
    if (o.dynamic || o.kind === 'deco') continue;
    const { tx, ty } = o;
    switch (o.kind) {
      case 'spot':
        if (o.spot === 'majlis') rect(tx - 2, ty - 1, tx + 2, ty);
        else if (o.spot === 'lamps') { rect(tx, ty, tx, ty); for (const [x, y] of [[29, 16], [34, 16], [29, 25], [34, 25]]) rect(x, y, x, y); }
        else rect(tx - 1, ty - 1, tx + 1, ty);
        break;
      case 'tent': rect(tx - 2, ty - 1, tx + 2, ty); break;
      case 'well': case 'station': case 'stall': case 'worldexit': rect(tx - 1, ty - 1, tx + 1, ty); break;
      case 'rock': if (o.variant === 'big') rect(tx - 1, ty, tx + 1, ty); else rect(tx, ty, tx, ty); break;
      default: rect(tx, ty, tx, ty);
    }
  }
  const pt = (p, r = 1) => { const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE); rect(tx - r, ty - r, tx + r, ty); };
  for (const p of Object.values(world.npcSpots || {})) pt(p);
  for (const p of world.guestSpots || []) pt(p, 0);
  if (world.caravanEntry) { const c = world.caravanEntry; const tx = Math.floor(c.x / TILE), ty = Math.floor(c.y / TILE); rect(tx - 3, ty - 2, tx + 3, ty + 2); }
  blockCache.set(world, set);
  return set;
}

function overlaps(a, b) {
  return a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
}

function contains(outer, inner) {
  return inner.x0 >= outer.x0 && inner.x1 <= outer.x1 && inner.y0 >= outer.y0 && inner.y1 <= outer.y1;
}

// هل يصير تحط هالشي هنا؟ يرجع { ok, reason }
export function canPlace(state, world, type, tx, ty, flip = false, ignoreId = null) {
  const d = PLACEABLES[type];
  if (!d) return { ok: false, reason: 'غير معروف' };
  const fp = footprint({ type, tx, ty, flip });
  for (let y = fp.y0; y <= fp.y1; y++) {
    for (let x = fp.x0; x <= fp.x1; x++) {
      if (x < 3 || y < 3 || x > MAP_W - 4 || y > MAP_H - 4) return { ok: false, reason: 'قريب من حد الخريطة' };
      const t = tileAt(world.tiles, x, y);
      if (d.zone === 'in') {
        if (!insideKhan(x, y) || !IN_TILES.has(t)) return { ok: false, reason: 'هذا يتحط داخل بيتك بس' };
      } else {
        if (nearKhan(x, y)) return { ok: false, reason: 'البناء برا البيت بس' };
        if (t === T.WATER) return { ok: false, reason: 'ما يصير على الماي' };
        if (t === T.ROAD) return { ok: false, reason: 'لا تسد الطريق' };
        if (t === T.SOIL) return { ok: false, reason: 'هذي أرض الزراعة' };
        if (!OUT_TILES.has(t)) return { ok: false, reason: 'الأرض ما تصلح' };
      }
      if (worldBlockers(world).has(x + ',' + y)) return { ok: false, reason: 'فيه شي بالمكان' };
    }
  }
  // التداخل مع اللي منحط قبل
  for (const p of state.placed || []) {
    if (p.id === ignoreId) continue;
    const pf = footprint(p);
    if (!overlaps(fp, pf)) continue;
    // الحوض يتحط داخل المراح
    if (d.inside && p.type === d.inside && contains(pf, fp)) continue;
    if (PLACEABLES[p.type].inside && type === PLACEABLES[p.type].inside && contains(fp, pf)) continue;
    return { ok: false, reason: 'يتداخل مع ' + info(p.type).name };
  }
  if (d.inside) {
    const host = placedOf(state, d.inside)[0];
    if (!host || !contains(footprint(host), fp)) return { ok: false, reason: `حطه داخل ${info(d.inside).name}` };
  }
  return { ok: true };
}

export function canAddMore(state, type) {
  const d = PLACEABLES[type];
  const max = d.max || (d.cat === 'building' ? 1 : 999);
  return placedOf(state, type).length < max;
}

function newId(state) {
  state.placedSeq = (state.placedSeq || 0) + 1;
  return 'p' + state.placedSeq;
}

// يحط (بدون دفع: اللي يناديها يدفع). المباني تنحط كموقع بناء، والباقي ينحط جاهز
export function place(state, world, type, tx, ty, flip = false) {
  state.placed = state.placed || [];
  if (!canAddMore(state, type)) return { ok: false, reason: 'وصلت الحد' };
  const v = canPlace(state, world, type, tx, ty, flip);
  if (!v.ok) return v;
  const p = { id: newId(state), type, tx, ty, flip: !!flip, level: 1 };
  state.placed.push(p);
  if (type === 'chest') { state.chests = state.chests || {}; state.chests[p.id] = { items: {} }; }
  return { ok: true, p };
}

// النقل ببلاش. المراح ينقل الحوض اللي داخله معه
export function move(state, world, id, tx, ty, flip) {
  const p = placedById(state, id);
  if (!p) return { ok: false, reason: 'غير موجود' };
  const f = flip == null ? p.flip : flip;
  const inner = (state.placed || []).filter(q => PLACEABLES[q.type].inside === p.type && contains(footprint(p), footprint(q)));
  const v = canPlace(state, world, p.type, tx, ty, f, p.id);
  if (!v.ok) return v;
  const dx = tx - p.tx, dy = ty - p.ty;
  p.tx = tx; p.ty = ty; p.flip = !!f;
  for (const q of inner) {
    q.tx += dx; q.ty += dy;
    // لو المراح انقلب والحوض ما صار داخله، نرجّعه لزاوية المراح
    if (!contains(footprint(p), footprint(q))) { q.tx = p.tx + 1; q.ty = p.ty + 2; }
  }
  return { ok: true, p };
}

// يشيل الديكور والأثاث (المباني ما تنشال، تنقل بس). الصندوق لازم يكون فاضي
export function removePlaced(state, id) {
  const p = placedById(state, id);
  if (!p) return { ok: false, reason: 'غير موجود' };
  if (isBuilding(p.type) && isBuilt(state, p)) return { ok: false, reason: 'المباني تنقل بس' };
  if (state.workers && state.workers.some(w => w.job && w.job.spot === PLACEABLES[p.type].spot)) return { ok: false, reason: 'البنّاء شغال عليه' };
  if (p.type === 'chest' && chestUsed(state, id) > 0) return { ok: false, reason: 'فضّ الصندوق أول' };
  state.placed = state.placed.filter(q => q.id !== id);
  if (p.type === 'chest' && state.chests) delete state.chests[id];
  return { ok: true, p };
}

// ---------- المستويات ----------
export function levelOf(state, p) {
  if (!p) return 0;
  if (p.type === 'stable') return 1 + (state.built.pen2 ? 1 : 0) + (state.built.pen3 ? 1 : 0);
  if (p.type === 'workers_house') return 1 + (state.built.workers_house2 ? 1 : 0);
  return p.level || 1;
}

export function typeLevel(state, type) {
  const p = placedOf(state, type).find(x => isBuilt(state, x));
  return p ? levelOf(state, p) : 0;
}

// الترقية الجاية: { level, spot? , cost, coins } أو null
export function nextUpgrade(state, p) {
  const d = PLACEABLES[p.type];
  const lv = levelOf(state, p);
  const u = d.levels && d.levels[lv];
  if (!u || !isBuilt(state, p)) return null;
  if (u.spot) { const sp = BUILD_SPOTS[u.spot]; return { level: lv + 1, spot: u.spot, cost: sp.cost, coins: 0 }; }
  return { level: lv + 1, cost: u.cost || {}, coins: u.coins || 0 };
}

// يطبّق ترقية عادية (اللي فيها spot تنبني من BUILD_SPOTS عند المنادي)
export function applyUpgrade(state, p) {
  const u = nextUpgrade(state, p);
  if (!u || u.spot) return false;
  p.level = u.level;
  return true;
}

// منافع المستويات
export function doubleChance(state, station) {
  const lv = typeLevel(state, station);
  return lv >= 3 ? 0.5 : lv === 2 ? 0.25 : 0;
}
export function stallSpeed(state) {
  const lv = typeLevel(state, 'stall_shop');
  return lv >= 3 ? 1.5 : lv === 2 ? 1.25 : 1;
}
export function ordersBonus(state) {
  const lv = typeLevel(state, 'orders_board');
  return lv >= 3 ? 0.3 : lv === 2 ? 0.15 : 0;
}
export function sheepCapBonus(state) {
  return Math.max(0, typeLevel(state, 'sheepfold') - 1) * 3;
}

// ---------- الصناديق ----------
export function chestCap(state, id) {
  const p = placedById(state, id);
  return CHEST_CAP[Math.min(CHEST_CAP.length, levelOf(state, p) || 1) - 1];
}
export function chestUsed(state, id) {
  const c = state.chests && state.chests[id];
  return c ? Object.values(c.items).reduce((a, n) => a + n, 0) : 0;
}

// ---------- الراحة والجمال ----------
export function comfort(state) {
  const n = (state.placed || []).reduce((a, p) => a + (PLACEABLES[p.type].comfort || 0), 0);
  return Math.min(COMFORT_MAX, n);
}
export function beauty(state) {
  return (state.placed || []).reduce((a, p) => a + (PLACEABLES[p.type].beauty || 0), 0);
}
export function beautyBonus(state) {
  return Math.min(0.2, Math.floor(beauty(state) / BEAUTY_STEP) * 0.02);
}

// يدوّر أقرب مكان يصلح حول نقطة (بالبلاط)
export function findFreeSpot(state, world, type, near, flip = false, avoid = null) {
  for (let r = 0; r < 30; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = near.x + dx, ty = near.y + dy;
        if (avoid) { const f = footprint({ type, tx, ty, flip }); if (avoid.x >= f.x0 - 1 && avoid.x <= f.x1 + 1 && avoid.y >= f.y0 - 1 && avoid.y <= f.y1 + 1) continue; }
        if (canPlace(state, world, type, tx, ty, flip).ok) return { tx, ty };
      }
    }
  }
  return null;
}

// أي مبنى مبني بس ما له مكان (حفظ قديم)
export function needsMigrate(state) {
  return Object.keys(PLACEABLES).some(t => PLACEABLES[t].cat === 'building' && state.built[PLACEABLES[t].spot] && !placedOf(state, t).length);
}

// الحفظ القديم: المباني اللي برا تنحط بنفس مكانها، والورش اللي داخل البيت تطلع برا
export function migrate(state, world) {
  state.placed = state.placed || [];
  state.chests = state.chests || {};
  const moved = [];
  const order = ['stable', 'trough', 'sheepfold', 'stall_shop', 'orders_board', 'workers_house', 'kiln', 'mill', 'loom'];
  for (const type of order) {
    const d = PLACEABLES[type];
    if (!state.built[d.spot] || placedOf(state, type).length) continue;
    let pos = LEGACY_POS[type] ? { tx: LEGACY_POS[type][0], ty: LEGACY_POS[type][1] } : null;
    if (!pos || state.placedVersion >= 1) {
      pos = (pos && canPlace(state, world, type, pos.tx, pos.ty).ok) ? pos : (findFreeSpot(state, world, type, pos ? { x: pos.tx, y: pos.ty } : WORKSHOP_YARD) || { tx: WORKSHOP_YARD.x, ty: WORKSHOP_YARD.y });
      if (!state.placedVersion) moved.push(type);
    }
    state.placed.push({ id: newId(state), type, tx: pos.tx, ty: pos.ty, flip: false, level: 1 });
  }
  state.placedVersion = 1;
  return { moved };
}

// كم يشيل الأثاث من الحقيبة (الأثاث يستهلك الغرض نفسه)
export function furnitureItem(type) {
  const d = PLACEABLES[type];
  return d && d.item && ITEMS[d.item] ? d.item : null;
}

// ---------- التخزين: الحقيبة ثم الصناديق ----------
function chestsWithSpace(state) {
  return placedOf(state, 'chest').map(p => ({ id: p.id, free: chestCap(state, p.id) - chestUsed(state, p.id) })).filter(c => c.free > 0);
}

export function chestFree(state) {
  return chestsWithSpace(state).reduce((a, c) => a + c.free, 0);
}

// يحط الغنايم: الحقيبة لين تمتلي، والباقي للصناديق، واللي ما له مكان يضيع. يرجع التفاصيل
export function stow(state, loot) {
  const out = { bag: {}, chest: {}, lost: {} };
  for (const [id, n0] of Object.entries(loot)) {
    let n = n0;
    if (!counts(id)) { add(state, id, n); out.bag[id] = n; continue; }
    const k = Math.min(n, bagFree(state));
    if (k > 0) { add(state, id, k); out.bag[id] = k; n -= k; }
    for (const c of chestsWithSpace(state)) {
      if (n <= 0) break;
      const m = Math.min(n, c.free);
      const items = state.chests[c.id].items;
      items[id] = (items[id] || 0) + m;
      out.chest[id] = (out.chest[id] || 0) + m;
      n -= m;
    }
    if (n > 0) out.lost[id] = n;
  }
  return out;
}

// هل فيه مكان لـ n أغراض (الحقيبة أو الصناديق)؟
export function roomFor(state, n = 1) {
  return bagFree(state) + chestFree(state) >= n;
}

export function deposit(state, chestId, id, n) {
  const c = state.chests && state.chests[chestId];
  if (!c) return 0;
  const k = Math.min(n, count(state, id), chestCap(state, chestId) - chestUsed(state, chestId));
  if (k <= 0) return 0;
  add(state, id, -k);
  c.items[id] = (c.items[id] || 0) + k;
  return k;
}

export function withdraw(state, chestId, id, n) {
  const c = state.chests && state.chests[chestId];
  if (!c) return 0;
  const k = Math.min(n, c.items[id] || 0, counts(id) ? bagFree(state) : Infinity);
  if (k <= 0) return 0;
  c.items[id] -= k;
  if (c.items[id] <= 0) delete c.items[id];
  add(state, id, k);
  return k;
}

// كم الحقيبة متعدّية سعتها
export function bagOver(state) {
  return Math.max(0, bagUsed(state) - bagCap(state));
}
