// الأشياء اللي تنحط باختيارك: مباني برا البيت، وديكور وطرق، وصناديق وأثاث داخل البيت
// w,h = المساحة بالبلاط. zone: out = برا البيت بس، in = داخل البيت بس
// spot = اسمها في BUILD_SPOTS (التكلفة والتقنية والسمعة من هناك)
// levels[i] = ترقية للمستوى i+1: { spot } (من BUILD_SPOTS) أو { cost, coins }
export const PLACEABLES = {
  // ---------- مباني برا ----------
  kiln: { spot: 'kiln', icon: '🔥', w: 2, h: 2, zone: 'out', cat: 'building', solid: true,
    levels: [null, { cost: { brick: 4, stone: 6 }, coins: 150 }, { cost: { brick: 8, stone: 10 }, coins: 400 }], perk: 'فرصة ضعف الإنتاج' },
  mill: { spot: 'mill', icon: '🥣', w: 2, h: 2, zone: 'out', cat: 'building', solid: true,
    levels: [null, { cost: { stone: 8, plank: 3 }, coins: 150 }, { cost: { stone: 12, plank: 6 }, coins: 400 }], perk: 'فرصة ضعف الإنتاج' },
  loom: { spot: 'loom', icon: '🧶', w: 2, h: 2, zone: 'out', cat: 'building', solid: true,
    levels: [null, { cost: { plank: 6, rope: 4 }, coins: 150 }, { cost: { plank: 10, rope: 6 }, coins: 400 }], perk: 'فرصة ضعف الإنتاج' },
  stall_shop: { spot: 'stall_shop', icon: '🏪', w: 3, h: 2, zone: 'out', cat: 'building', solid: true,
    levels: [null, { cost: { plank: 6, frond: 8 }, coins: 200 }, { cost: { plank: 10, carpet: 1 }, coins: 500 }], perk: 'تبيع أسرع' },
  orders_board: { spot: 'orders_board', icon: '📋', w: 2, h: 1, zone: 'out', cat: 'building', solid: true,
    levels: [null, { cost: { plank: 4, rope: 3 }, coins: 200 }, { cost: { plank: 8, lantern: 1 }, coins: 500 }], perk: 'جوايز الطلبات أكثر' },
  workers_house: { spot: 'workers_house', icon: '🏠', w: 3, h: 2, zone: 'out', cat: 'building', solid: true,
    levels: [null, { spot: 'workers_house2' }], perk: 'عمّال أكثر' },
  stable: { spot: 'stable', icon: '🐪', w: 7, h: 7, zone: 'out', cat: 'building', area: true,
    levels: [null, { spot: 'pen2' }, { spot: 'pen3' }], perk: 'نياق أكثر' },
  trough: { spot: 'trough', icon: '🏺', w: 2, h: 1, zone: 'out', cat: 'building', solid: true, inside: 'stable' },
  barn: { spot: 'barn', icon: '🏚️', w: 3, h: 3, zone: 'out', cat: 'building', solid: true, storage: 'mats',
    levels: [null, { cost: { plank: 10, stone: 10 }, coins: 300 }, { cost: { plank: 16, brick: 10 }, coins: 800 }], perk: 'يشيل مواد أكثر' },
  sheepfold: { spot: 'sheepfold', icon: '🐑', w: 6, h: 5, zone: 'out', cat: 'building', area: true,
    levels: [null, { cost: { wood: 8, rope: 4 }, coins: 200 }, { cost: { wood: 12, plank: 6 }, coins: 500 }], perk: 'غنم أكثر (+3)' },

  // ---------- حقول زراعة (برا، تنحط على الرمل أو التربة) ----------
  field: { name: 'حقل زراعة', icon: '🌱', w: 1, h: 1, zone: 'out', cat: 'field', repeat: true, soil: true },

  // ---------- ديكور وطرق (برا) ----------
  path: { name: 'ممر حجر', icon: '🪨', w: 1, h: 1, zone: 'out', cat: 'deco', cost: { stone: 1 }, beauty: 1, repeat: true, flat: true },
  sandpath: { name: 'ممر رملي مرصوف', icon: '🟫', w: 1, h: 1, zone: 'out', cat: 'deco', cost: { clay: 1 }, beauty: 1, repeat: true, flat: true },
  fence: { name: 'سياج خشب', icon: '🪵', w: 1, h: 1, zone: 'out', cat: 'deco', cost: { wood: 1 }, beauty: 1, repeat: true, solid: true },
  flowers: { name: 'حوض ورد', icon: '🌺', w: 1, h: 1, zone: 'out', cat: 'deco', coins: 15, beauty: 3, repeat: true },
  potpalm: { name: 'نخلة زينة', icon: '🌴', w: 1, h: 1, zone: 'out', cat: 'deco', cost: { jar: 1 }, coins: 30, beauty: 4, solid: true },
  bench: { name: 'كرسي خشب', icon: '🪑', w: 2, h: 1, zone: 'out', cat: 'deco', cost: { plank: 2 }, beauty: 3, solid: true },
  torch: { name: 'مشعل', icon: '🔥', w: 1, h: 1, zone: 'out', cat: 'deco', cost: { wood: 2, frond: 2 }, beauty: 2, solid: true, light: true },

  // ---------- داخل البيت ----------
  chest: { name: 'صندوق خشب', icon: '📦', w: 1, h: 1, zone: 'in', cat: 'storage', cost: { plank: 4, rope: 1 }, solid: true, max: 8,
    levels: [null, { cost: { plank: 6, rope: 2 }, coins: 150 }, { cost: { plank: 8, brick: 4 }, coins: 400 }], perk: 'يشيل أكثر' },
  f_carpet: { name: 'سجادة', icon: '🟥', w: 2, h: 1, zone: 'in', cat: 'furniture', item: 'carpet', comfort: 3, flat: true },
  f_cushion: { name: 'مسند', icon: '🛋️', w: 1, h: 1, zone: 'in', cat: 'furniture', item: 'cushion', comfort: 2 },
  f_lantern: { name: 'سراج', icon: '🏮', w: 1, h: 1, zone: 'in', cat: 'furniture', item: 'lantern', comfort: 2, solid: true, light: true },
  f_jar: { name: 'جرّة زينة', icon: '🏺', w: 1, h: 1, zone: 'in', cat: 'furniture', item: 'jar', comfort: 1, solid: true },
  f_bed: { name: 'سرير', icon: '🛏️', w: 2, h: 1, zone: 'in', cat: 'furniture', item: 'bed', comfort: 4, solid: true },
  f_dallah: { name: 'دلّة على منقلة', icon: '☕', w: 1, h: 1, zone: 'in', cat: 'furniture', item: 'coffee', comfort: 2, solid: true, light: true },
};

// مواقع الحفظ القديم (قبل الوضع باختيارك): [tx, ty] بالبلاط لأعلى يسار المبنى
export const LEGACY_POS = {
  stable: [53, 31], sheepfold: [34, 34], trough: [54, 33],
  stall_shop: [26, 30], orders_board: [34, 31], workers_house: [19, 24],
};

// الورش اللي كانت داخل البيت: تنتقل برا قريب من هنا
export const WORKSHOP_YARD = { x: 16, y: 32 };

export const CHEST_CAP = [80, 140, 220];
export const BARN_CAP = [200, 350, 500];
// مواد البناء: هذي بس اللي تنحط بالمخزن الكبير
export const MATS = new Set(['wood', 'frond', 'stone', 'clay', 'plank', 'rope', 'brick', 'herb', 'oldcoin', 'bone', 'stinger', 'wool', 'water', 'beans', 'alfalfa', 'flour', 'jar', 'lantern']);
// الحقول: السعر يزيد مع كل حقل، والحد يكبر مع المستوى
export const FIELD_BASE = 20, FIELD_STEP = 15, FIELD_MAX = 24;
export const BAG_CAPS = [150, 200, 250, 300, 400];
export const BAG_UPGRADE_COINS = [300, 800, 1600, 3000];
export const COMFORT_MAX = 30;
export const BEAUTY_STEP = 20; // كل 20 جمال = +2% دراهم الضيوف
