// ساحات البناء: كل نوع مبنى له ساحته المحددة، وعلى كل ساحة لوحة «يمديك تبني هنا»
// rect بالبلاط (شامل الحدود). اخترناها بأماكن فاضية بعيد عن الوادي والواحة والطريق،
// وتشمل مواقع المباني بالحفظ القديم عشان ما يتغير شي
export const BUILD_ZONES = [
  { id: 'workshops', name: 'ساحة الورش', icon: '🔥', types: ['kiln', 'mill', 'loom', 'barn'], rect: { x0: 4, y0: 4, x1: 19, y1: 17 }, color: '#e08a3a' },
  { id: 'workers', name: 'ساحة العمّال', icon: '🏠', types: ['workers_house'], rect: { x0: 4, y0: 22, x1: 21, y1: 27 }, color: '#c8a060' },
  { id: 'market', name: 'ساحة السوق', icon: '🏪', types: ['stall_shop', 'orders_board'], rect: { x0: 4, y0: 30, x1: 39, y1: 32 }, color: '#e8c050' },
  { id: 'farm', name: 'ساحة المزرعة', icon: '🌾', types: ['field'], rect: { x0: 40, y0: 30, x1: 50, y1: 44 }, color: '#8fdc5a' },
  { id: 'livestock', name: 'ساحة الحلال', icon: '🐪', types: ['stable', 'trough', 'sheepfold'], rect: { x0: 51, y0: 30, x1: 61, y1: 44 }, color: '#d8a878' },
  { id: 'livestock2', name: 'ساحة الحلال ٢', icon: '🐑', types: ['stable', 'trough', 'sheepfold'], rect: { x0: 21, y0: 34, x1: 39, y1: 44 }, color: '#d8a878' },
];

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
