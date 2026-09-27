// خريطة العالم: تنولد بنفس الشكل كل مرة (بذرة ثابتة)
import { mulberry32 } from '../systems/util.js';

export const TILE = 16;
export const MAP_W = 64;
export const MAP_H = 48;

export const T = {
  SAND: 0, SAND2: 1, GRASS: 2, WATER: 3, ROAD: 4, FLOOR: 5, WALL: 6, SOIL: 7,
  ROCKY: 8, WADI: 9, DUNE: 10, RUBBLE: 11, ROOMFLOOR: 12, GATE: 13,
};
export const SOLID_TILES = new Set([T.WATER, T.WALL, T.DUNE, T.RUBBLE]);

// الخان
export const KHAN = { x0: 22, y0: 12, x1: 41, y1: 27 };
export const WALL_N = { x0: 26, x1: 37, y: 12 };
export const WALL_S = [{ x0: 23, x1: 29 }, { x0: 34, x1: 40 }];
export const GATE = { x0: 31, x1: 32, y: 27 };
export const OASIS = { cx: 53, cy: 20, r: 3.6, grass: 8 };
export const PEN = { x0: 53, y0: 31, x1: 60, y1: 38 };

function px(tx) {
  return tx * TILE + TILE / 2;
}

export function buildWorld() {
  const rng = mulberry32(1337);
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const set = (x, y, t) => {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) tiles[y * MAP_W + x] = t;
  };
  const get = (x, y) => tiles[y * MAP_W + x];

  // رمل مع تنويع
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      set(x, y, rng() < 0.18 ? T.SAND2 : T.SAND);
    }
  }
  // حدود كثبان
  for (let x = 0; x < MAP_W; x++) {
    set(x, 0, T.DUNE); set(x, 1, T.DUNE); set(x, MAP_H - 1, T.DUNE);
    if (rng() < 0.5) set(x, 2, T.DUNE);
    if (rng() < 0.5) set(x, MAP_H - 2, T.DUNE);
  }
  for (let y = 0; y < MAP_H; y++) {
    set(0, y, T.DUNE); set(MAP_W - 1, y, T.DUNE);
    if (rng() < 0.5) set(1, y, T.DUNE);
    if (rng() < 0.5) set(MAP_W - 2, y, T.DUNE);
  }

  // المقلع شمال
  for (let y = 3; y <= 8; y++) for (let x = 25; x <= 41; x++) if (rng() < 0.85) set(x, y, T.ROCKY);
  // الوادي جنوب غرب
  for (let y = 33; y <= 43; y++) for (let x = 5; x <= 19; x++) {
    const d = Math.hypot((x - 12) / 8, (y - 38) / 5.5);
    if (d < 1) set(x, y, T.WADI);
  }
  // الواحة
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const d = Math.hypot(x + 0.5 - OASIS.cx, y + 0.5 - OASIS.cy);
    if (d < OASIS.grass + rng() * 1.2 && get(x, y) !== T.DUNE) set(x, y, T.GRASS);
  }
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const d = Math.hypot(x + 0.5 - OASIS.cx, (y + 0.5 - OASIS.cy) * 1.15);
    if (d < OASIS.r) set(x, y, T.WATER);
  }

  // الطريق
  for (let x = 2; x <= 61; x++) set(x, 29, T.ROAD);
  for (let y = 28; y <= 29; y++) { set(31, y, T.ROAD); set(32, y, T.ROAD); }

  // المزرعة (تربة)
  for (let y = 31; y <= 34; y++) for (let x = 42; x <= 51; x++) set(x, y, T.SOIL);

  // الخان: أرضية وجدران
  for (let y = KHAN.y0; y <= KHAN.y1; y++) for (let x = KHAN.x0; x <= KHAN.x1; x++) {
    const edge = x === KHAN.x0 || x === KHAN.x1 || y === KHAN.y0 || y === KHAN.y1;
    set(x, y, edge ? T.WALL : T.FLOOR);
  }
  // غرفتك وغرف الضيوف أرضية خشب
  for (let y = 13; y <= 16; y++) for (let x = 23; x <= 27; x++) set(x, y, T.ROOMFLOOR);
  for (let y = 13; y <= 25; y++) for (let x = 37; x <= 40; x++) set(x, y, T.ROOMFLOOR);
  for (let x = WALL_N.x0; x <= WALL_N.x1; x++) set(x, WALL_N.y, T.RUBBLE);
  for (const seg of WALL_S) for (let x = seg.x0; x <= seg.x1; x++) set(x, KHAN.y1, T.RUBBLE);
  for (let x = GATE.x0; x <= GATE.x1; x++) set(x, GATE.y, T.GATE);

  // ---------- الكائنات ----------
  const objects = [];
  const add = (o) => { objects.push(o); return o; };
  const occupied = new Set();
  const mark = (tx, ty) => occupied.add(tx + ',' + ty);
  const free = (tx, ty) => !occupied.has(tx + ',' + ty) && !SOLID_TILES.has(get(tx, ty));

  // داخل الخان
  add({ id: 'lamp', kind: 'lamp', tx: 24, ty: 14 });
  add({ id: 'spot:my_bed', kind: 'spot', spot: 'my_bed', tx: 26, ty: 14 });
  add({ id: 'hearth', kind: 'station', station: 'hearth', tx: 28, ty: 14 });
  add({ id: 'workbench', kind: 'station', station: 'workbench', tx: 24, ty: 19 });
  add({ id: 'spot:kiln', kind: 'spot', spot: 'kiln', tx: 24, ty: 23 });
  add({ id: 'spot:mill', kind: 'spot', spot: 'mill', tx: 27, ty: 25 });
  add({ id: 'spot:loom', kind: 'spot', spot: 'loom', tx: 28, ty: 19 });
  add({ id: 'well', kind: 'well', tx: 31, ty: 19 });
  add({ id: 'spot:fountain', kind: 'spot', spot: 'fountain', tx: 31, ty: 23 });
  add({ id: 'spot:lamps', kind: 'spot', spot: 'lamps', tx: 34, ty: 17 });
  add({ id: 'spot:majlis', kind: 'spot', spot: 'majlis', tx: 32, ty: 14 });
  add({ id: 'spot:room1', kind: 'spot', spot: 'room1', tx: 38, ty: 14 });
  add({ id: 'spot:room2', kind: 'spot', spot: 'room2', tx: 38, ty: 18 });
  add({ id: 'spot:room3', kind: 'spot', spot: 'room3', tx: 38, ty: 22 });
  add({ id: 'spot:crypt_door', kind: 'spot', spot: 'crypt_door', tx: 39, ty: 25 });
  add({ id: 'spot:wall_n', kind: 'spot', spot: 'wall_n', tx: 30, ty: 13 });
  add({ id: 'spot:wall_s', kind: 'spot', spot: 'wall_s', tx: 26, ty: 26 });
  add({ id: 'spot:gate', kind: 'spot', spot: 'gate', tx: 34, ty: 26 });
  // برا الخان
  add({ id: 'spot:stable', kind: 'spot', spot: 'stable', tx: 56, ty: 31 });
  add({ id: 'spot:trough', kind: 'spot', spot: 'trough', tx: 54, ty: 33 });
  add({ id: 'spot:pen2', kind: 'spot', spot: 'pen2', tx: 52, ty: 36 });
  add({ id: 'spot:pen3', kind: 'spot', spot: 'pen3', tx: 52, ty: 38 });
  add({ id: 'spot:farm2', kind: 'spot', spot: 'farm2', tx: 41, ty: 34 });
  add({ id: 'tent', kind: 'tent', tx: 15, ty: 20, solid: true });
  add({ id: 'stall', kind: 'stall', tx: 10, ty: 21, solid: true });
  add({ id: 'sign_farm', kind: 'sign', tx: 41, ty: 31, text: 'مزرعة العم سالم' });
  add({ id: 'sign_khan', kind: 'sign', tx: 30, ty: 28, text: 'خان الغروب' });

  for (let i = 0; i < 4; i++) add({ id: 'plot' + i, kind: 'plot', tx: 43 + i * 2, ty: 31, group: 1 });
  for (let i = 0; i < 4; i++) add({ id: 'plot' + (i + 4), kind: 'plot', tx: 43 + i * 2, ty: 33, group: 2 });

  for (const o of objects) mark(o.tx, o.ty);

  // نخل حول الواحة
  let pi = 0;
  const palmSpots = [];
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2 + rng() * 0.2;
    const r = OASIS.r + 1.6 + rng() * 2.8;
    palmSpots.push([Math.round(OASIS.cx + Math.cos(ang) * r), Math.round(OASIS.cy + Math.sin(ang) * r * 0.9)]);
  }
  palmSpots.push([44, 16], [46, 13], [58, 30], [60, 26], [20, 9], [12, 14], [8, 27]);
  for (const [tx, ty] of palmSpots) {
    if (!free(tx, ty) || get(tx, ty) === T.ROAD) continue;
    add({ id: 'palm' + pi++, kind: 'palm', tx, ty, solid: true });
    mark(tx, ty);
  }
  // صخور بالمقلع
  let ri = 0;
  for (let n = 0; n < 60 && ri < 11; n++) {
    const tx = 26 + Math.floor(rng() * 15), ty = 3 + Math.floor(rng() * 6);
    if (!free(tx, ty) || occupied.has(tx + 1 + ',' + ty) || occupied.has(tx - 1 + ',' + ty)) continue;
    add({ id: 'rock' + ri++, kind: 'rock', tx, ty, solid: true });
    mark(tx, ty);
  }
  // طين وأعشاب بالوادي
  let ci = 0, hi = 0;
  for (let n = 0; n < 80 && ci < 7; n++) {
    const tx = 7 + Math.floor(rng() * 11), ty = 34 + Math.floor(rng() * 8);
    if (get(tx, ty) !== T.WADI || !free(tx, ty)) continue;
    add({ id: 'clay' + ci++, kind: 'clay', tx, ty });
    mark(tx, ty);
  }
  const herbAreas = [[6, 18, 33, 42], [45, 60, 13, 27]];
  for (let n = 0; n < 200 && hi < 9; n++) {
    const [x0, x1, y0, y1] = herbAreas[n % 2];
    const tx = x0 + Math.floor(rng() * (x1 - x0)), ty = y0 + Math.floor(rng() * (y1 - y0));
    const t = get(tx, ty);
    if ((t !== T.WADI && t !== T.GRASS) || !free(tx, ty)) continue;
    add({ id: 'herb' + hi++, kind: 'herb', tx, ty });
    mark(tx, ty);
  }
  // ديكور الصحراء
  for (let n = 0; n < 70; n++) {
    const tx = 3 + Math.floor(rng() * (MAP_W - 6)), ty = 3 + Math.floor(rng() * (MAP_H - 6));
    const t = get(tx, ty);
    if ((t !== T.SAND && t !== T.SAND2) || !free(tx, ty)) continue;
    if (tx >= KHAN.x0 - 1 && tx <= KHAN.x1 + 1 && ty >= KHAN.y0 - 1 && ty <= KHAN.y1 + 2) continue;
    if (tx >= PEN.x0 - 2 && tx <= PEN.x1 + 1 && ty >= PEN.y0 - 1 && ty <= PEN.y1 + 1) continue;
    add({ id: 'deco' + n, kind: 'deco', variant: Math.floor(rng() * 4), tx, ty });
    mark(tx, ty);
  }

  for (const o of objects) {
    o.x = px(o.tx);
    o.y = o.ty * TILE + TILE - 2;
  }

  const npcSpots = {
    trader: { x: px(16), y: 22 * TILE + 8 },
    herbalist: { x: px(10), y: 22 * TILE + 10 },
    shepherd: { x: px(20), y: 35 * TILE },
  };
  const guestSpots = [
    [29, 21], [33, 21], [29, 17], [34, 20], [28, 22], [35, 23], [30, 25], [33, 25],
  ].map(([tx, ty]) => ({ x: px(tx), y: ty * TILE + 12 }));

  return {
    tiles, objects, npcSpots, guestSpots,
    spawn: { x: px(26), y: 17 * TILE + 8 },
    caravanEntry: { x: px(31) + 8, y: 31 * TILE },
    cryptExit: { x: px(38), y: 25 * TILE + 12 },
  };
}

export function tileAt(tiles, x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return T.DUNE;
  return tiles[y * MAP_W + x];
}
