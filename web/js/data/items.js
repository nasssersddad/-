// كل أغراض اللعبة. price = سعر البيع عند التاجر (الشراء = ضعفه تقريباً)
// food = كم يرجّع طاقة لما تاكله
export const ITEMS = {
  wood:      { name: 'خشب نخل',      icon: '🪵', price: 2 },
  frond:     { name: 'سعف',          icon: '🌿', price: 1 },
  stone:     { name: 'حجر',          icon: '🪨', price: 2 },
  clay:      { name: 'طين',          icon: '🟫', price: 2 },
  water:     { name: 'ماء',          icon: '💧', price: 1 },
  herb:      { name: 'أعشاب برية',   icon: '🌱', price: 3 },
  dates:     { name: 'تمر',          icon: '🟤', price: 3, food: 8 },
  wool:      { name: 'صوف',          icon: '🧶', price: 4 },
  beans:     { name: 'بن',           icon: '🫘', price: 4 },

  plank:     { name: 'ألواح',        icon: '🪚', price: 6 },
  rope:      { name: 'حبل',          icon: '🪢', price: 4 },
  brick:     { name: 'طوب',          icon: '🧱', price: 7 },
  jar:       { name: 'جرّة فخار',    icon: '🏺', price: 10 },
  lantern:   { name: 'سراج',         icon: '🏮', price: 16 },
  bed:       { name: 'سرير خشب',     icon: '🛏️', price: 30 },
  carpet:    { name: 'سجادة',        icon: '🟥', price: 28 },
  cushion:   { name: 'مسند',         icon: '🛋️', price: 18 },

  coffee:    { name: 'دلّة قهوة',    icon: '☕', price: 8, food: 12 },
  coffee2:   { name: 'قهوة الشيوخ',  icon: '🫖', price: 18, food: 20 },
  bread:     { name: 'خبز تنّور',    icon: '🫓', price: 9, food: 22 },
  pressed:   { name: 'تمر مكنوز',    icon: '🍫', price: 14, food: 30 },
  flour:     { name: 'طحين',         icon: '🥣', price: 5 },

  seed_tomato: { name: 'بذور طماطم', icon: '🌰', price: 1 },
  seed_wheat:  { name: 'بذور قمح',   icon: '🌾', price: 1 },
  seed_melon:  { name: 'بذور بطيخ',  icon: '🌰', price: 2 },
  seed_cardamom: { name: 'بذور هيل', icon: '🌰', price: 3 },
  tomato:    { name: 'طماطم',        icon: '🍅', price: 5, food: 6 },
  wheat:     { name: 'قمح',          icon: '🌾', price: 4 },
  melon:     { name: 'بطيخ',         icon: '🍉', price: 14, food: 15 },
  cardamom:  { name: 'هيل',          icon: '🫛', price: 8 },

  milk:      { name: 'حليب ناقة',    icon: '🥛', price: 12, food: 14 },
  alfalfa:   { name: 'برسيم',        icon: '🌿', price: 3 },
  seed_alfalfa: { name: 'بذور برسيم', icon: '🌰', price: 1 },
  oldcoin:   { name: 'درهم قديم',    icon: '🪙', price: 25 },
  bone:      { name: 'ناب غول',      icon: '🦴', price: 12 },
  stinger:   { name: 'إبرة عقرب',    icon: '🦂', price: 9 },

  seed_carrot:   { name: 'بذور جزر',    icon: '🌰', price: 2 },
  seed_onion:    { name: 'بصل للزراعة', icon: '🌰', price: 2 },
  seed_cucumber: { name: 'بذور خيار',   icon: '🌰', price: 3 },
  seed_eggplant: { name: 'بذور باذنجان', icon: '🌰', price: 4 },
  seed_corn:     { name: 'بذور ذرة',    icon: '🌰', price: 5 },
  carrot:    { name: 'جزر',          icon: '🥕', price: 6, food: 6 },
  onion:     { name: 'بصل',          icon: '🧅', price: 5 },
  cucumber:  { name: 'خيار',         icon: '🥒', price: 8, food: 7 },
  eggplant:  { name: 'باذنجان',      icon: '🍆', price: 11 },
  corn:      { name: 'ذرة',          icon: '🌽', price: 10, food: 10 },
  egg:       { name: 'بيض',          icon: '🥚', price: 6, food: 5 },
  shakshuka: { name: 'شكشوكة',       icon: '🍳', price: 24, food: 28 },
  faqa:      { name: 'فقع',          icon: '🍄', price: 45, food: 15 },
};

export const SEEDS = {
  seed_tomato: { crop: 'tomato', days: 2, yield: [2, 3], name: 'طماطم' },
  seed_wheat: { crop: 'wheat', days: 3, yield: [3, 4], name: 'قمح' },
  seed_melon: { crop: 'melon', days: 4, yield: [1, 2], name: 'بطيخ' },
  seed_cardamom: { crop: 'cardamom', days: 3, yield: [2, 3], name: 'هيل' },
  seed_alfalfa: { crop: 'alfalfa', days: 2, yield: [3, 5], name: 'برسيم' },
  seed_carrot: { crop: 'carrot', days: 2, yield: [2, 4], name: 'جزر', level: 3 },
  seed_onion: { crop: 'onion', days: 3, yield: [3, 4], name: 'بصل', level: 5 },
  seed_cucumber: { crop: 'cucumber', days: 2, yield: [2, 3], name: 'خيار', level: 7 },
  seed_eggplant: { crop: 'eggplant', days: 3, yield: [2, 3], name: 'باذنجان', level: 9 },
  seed_corn: { crop: 'corn', days: 4, yield: [3, 4], name: 'ذرة', level: 12 },
};

// التحف الأثرية (الألبوم)
export const RELICS = {
  r_dagger:  { name: 'خنجر فضّي',       icon: '🗡️', set: 'caravan' },
  r_censer:  { name: 'مبخرة نحاس',      icon: '🪔', set: 'caravan' },
  r_goldcoin:{ name: 'دينار ذهب',        icon: '🥇', set: 'caravan' },
  r_tablet:  { name: 'لوح طيني منقوش',  icon: '📜', set: 'crypt' },
  r_statue:  { name: 'تمثال صغير',       icon: '🗿', set: 'crypt' },
  r_necklace:{ name: 'قلادة عقيق',       icon: '📿', set: 'crypt' },
  r_anklet:  { name: 'خلخال فضة',        icon: '⭕', set: 'bedouin' },
  r_dallah:  { name: 'دلّة جدّ جدّك',    icon: '🫖', set: 'bedouin' },
  r_mirror:  { name: 'مرآة عروس',        icon: '🪞', set: 'bedouin' },
  r_ring:    { name: 'خاتم العم سالم',   icon: '💍', set: 'salem' },
  r_letter:  { name: 'رسالة مختومة',     icon: '✉️', set: 'salem' },
  r_key:     { name: 'مفتاح الخزنة',     icon: '🗝️', set: 'salem' },
};

export const RELIC_SETS = {
  caravan: { name: 'كنوز القوافل',  bonus: 'دراهم الضيوف +10%', effect: { coinMul: 0.10 } },
  crypt:   { name: 'أسرار السرداب', bonus: 'الصحة القصوى +3',   effect: { maxHp: 3 } },
  bedouin: { name: 'حلي البادية',   bonus: 'الطاقة القصوى +20', effect: { maxEnergy: 20 } },
  salem:   { name: 'أغراض العم سالم', bonus: 'أرباح الغياب +25%', effect: { offlineMul: 0.25 } },
};

export function itemName(id) {
  return (ITEMS[id] || RELICS[id] || { name: id }).name;
}
export function itemIcon(id) {
  return (ITEMS[id] || RELICS[id] || { icon: '❔' }).icon;
}
