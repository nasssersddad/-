// ساحات البناء: كل نوع مبنى له ساحته المحددة، وعلى كل ساحة لوحة «يمديك تبني هنا»
// rect بالبلاط (شامل الحدود). اخترناها بأماكن فاضية بعيد عن الوادي والواحة والطريق،
// وتشمل مواقع المباني بالحفظ القديم عشان ما يتغير شي
export const BUILD_ZONES = [
  { id: 'workshops', name: 'ساحة الورش', icon: '🔥', types: ['kiln', 'mill', 'loom', 'barn'], rect: { x0: 4, y0: 4, x1: 19, y1: 17 }, color: '#e08a3a' },
  { id: 'workers', name: 'ساحة العمّال', icon: '🏠', types: ['workers_house'], rect: { x0: 4, y0: 22, x1: 21, y1: 27 }, color: '#c8a060' },
  { id: 'market', name: 'ساحة السوق', icon: '🏪', types: ['stall_shop', 'orders_board'], rect: { x0: 4, y0: 30, x1: 39, y1: 32 }, color: '#e8c050' },
  { id: 'farm', name: 'ساحة المزرعة', icon: '🌾', types: ['field'], rect: { x0: 40, y0: 30, x1: 50, y1: 37 }, color: '#8fdc5a' },
  { id: 'livestock', name: 'ساحة الحلال', icon: '🐪', types: ['stable', 'trough', 'sheepfold', 'coop'], rect: { x0: 51, y0: 30, x1: 61, y1: 44 }, color: '#d8a878' },
  // ---------- توسعة الأرض: ساحات مسكّرة تنفتح بالمستوى والدراهم ----------
  { id: 'farm2', name: 'توسعة المزرعة', icon: '🌱', types: ['field'], rect: { x0: 40, y0: 38, x1: 50, y1: 44 }, color: '#8fdc5a', lock: { level: 5, coins: 800 } },
  { id: 'livestock2', name: 'ساحة الحلال ٢', icon: '🐑', types: ['stable', 'trough', 'sheepfold', 'coop'], rect: { x0: 21, y0: 34, x1: 39, y1: 44 }, color: '#d8a878', lock: { level: 6, coins: 1500 } },
  { id: 'north', name: 'ساحة الشمال', icon: '⛰️', types: ['kiln', 'mill', 'loom', 'barn', 'coop'], rect: { x0: 43, y0: 3, x1: 61, y1: 10 }, color: '#c8a060', lock: { level: 10, coins: 4000 } },
];

// الساحة مفتوحة؟ (اللي ما عليها قفل مفتوحة من البداية)
export function isZoneOpen(state, z) {
  return !z.lock || !!(state.zonesOpen && state.zonesOpen[z.id]);
}

export function zoneById(id) {
  return BUILD_ZONES.find(z => z.id === id) || null;
}

// يفتح ساحة: يحتاج المستوى والدراهم
export function unlockZone(state, id) {
  const z = zoneById(id);
  if (!z || !z.lock) return { ok: false, reason: 'مفتوحة' };
  if (isZoneOpen(state, z)) return { ok: false, reason: 'مفتوحة من قبل' };
  if ((state.player.level || 1) < z.lock.level) return { ok: false, reason: `تحتاج مستوى ${z.lock.level}` };
  if (state.player.coins < z.lock.coins) return { ok: false, reason: 'الدراهم ما تكفي' };
  state.player.coins -= z.lock.coins;
  state.zonesOpen = state.zonesOpen || {};
  state.zonesOpen[id] = true;
  state.stats.zonesOpened = (state.stats.zonesOpened || 0) + 1;
  return { ok: true };
}

export function zonesFor(type) {
  return BUILD_ZONES.filter(z => z.types.includes(type));
}

export function zoneAt(tx, ty) {
  return BUILD_ZONES.find(z => tx >= z.rect.x0 && tx <= z.rect.x1 && ty >= z.rect.y0 && ty <= z.rect.y1) || null;
}

export function inZone(z, f) {
  return f.x0 >= z.rect.x0 && f.x1 <= z.rect.x1 && f.y0 >= z.rect.y0 && f.y1 <= z.rect.y1;
}

export function zoneCenter(z) {
  return { x: Math.floor((z.rect.x0 + z.rect.x1) / 2), y: Math.floor((z.rect.y0 + z.rect.y1) / 2) };
}
