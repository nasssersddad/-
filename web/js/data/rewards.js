// المكافآت: التقويم اليومي، عجلة الحظ، الصناديق، المهام اليومية، الإنجازات
// شكل المكافأة: { coins, xp, energy:'full', items:{}, kp:{}, chest:'common'|'rare'|'legendary', relic:true }

export const DAILY_CALENDAR = [
  { coins: 50, label: '50 درهم' },
  { items: { wood: 6, stone: 6 }, label: 'خشب وحجر' },
  { coins: 120, label: '120 درهم' },
  { chest: 'common', label: 'صندوق' },
  { kp: { c: 3, n: 3, s: 2 }, label: 'نقاط معرفة' },
  { coins: 250, items: { coffee: 4 }, label: '250 + قهوة' },
  { chest: 'legendary', label: 'صندوق أسطوري' },
];

export const WHEEL = [
  { w: 24, reward: { coins: 40 },            label: '40',   color: '#c98a3c' },
  { w: 16, reward: { coins: 100 },           label: '100',  color: '#8a4b2a' },
  { w: 12, reward: { energy: 'full' },       label: '⚡',    color: '#d9b35b' },
  { w: 12, reward: { items: { wood: 8, frond: 6 } }, label: '🪵', color: '#6b8f3a' },
  { w: 10, reward: { kp: { c: 2, n: 2, s: 2 } },     label: '🔮', color: '#5d3f8f' },
  { w: 12, reward: { chest: 'common' },      label: '📦',   color: '#b0643a' },
  { w: 8,  reward: { chest: 'rare' },        label: '💎',   color: '#2f6f8f' },
  { w: 4,  reward: { coins: 500 },           label: '500',  color: '#e0b030' },
  { w: 2,  reward: { chest: 'legendary' },   label: '👑',   color: '#9a2a2a' },
];

export const CHESTS = {
  common:    { name: 'صندوق عادي',   color: '#b98a52', coins: [20, 60],   items: 2, kp: 1, relic: 0.03 },
  rare:      { name: 'صندوق نادر',   color: '#4aa3d8', coins: [80, 180],  items: 3, kp: 3, relic: 0.25 },
  legendary: { name: 'صندوق أسطوري', color: '#f0c040', coins: [250, 450], items: 4, kp: 6, relic: 0.9 },
};

// الأغراض اللي ممكن تطلع من الصناديق
export const CHEST_ITEMS = ['wood', 'stone', 'clay', 'frond', 'beans', 'dates', 'wool', 'plank', 'rope', 'brick', 'coffee', 'seed_wheat', 'seed_tomato', 'jar', 'lantern', 'carpet'];

// احتمال طيحة صندوق وأنت تجمع
export const GATHER_CHEST_CHANCE = 0.035;
export const CHEST_RARITY = [
  { rarity: 'common', w: 78 },
  { rarity: 'rare', w: 19 },
  { rarity: 'legendary', w: 3 },
];

export const DAILY_QUEST_POOL = [
  { id: 'palm',    stat: 'palms',   name: 'اقطع {n} نخلات',       range: [6, 12], coins: 40 },
  { id: 'rock',    stat: 'rocks',   name: 'اكسر {n} صخور',         range: [5, 10], coins: 40 },
  { id: 'guest',   stat: 'guests',  name: 'قدّم لـ {n} ضيوف',       range: [3, 6],  coins: 60 },
  { id: 'craft',   stat: 'crafted', name: 'اصنع {n} أغراض',        range: [5, 12], coins: 50 },
  { id: 'harvest', stat: 'harvested', name: 'احصد {n} محاصيل',     range: [3, 6],  coins: 50 },
  { id: 'water',   stat: 'water',   name: 'اسحب ماء {n} مرات',     range: [5, 10], coins: 30 },
  { id: 'enemy',   stat: 'kills',   name: 'اهزم {n} وحوش بالسرداب', range: [3, 8],  coins: 70 },
  { id: 'clay',    stat: 'clay',    name: 'احفر طين {n} مرات',     range: [4, 8],  coins: 35 },
  { id: 'coins',   stat: 'coinsEarned', name: 'اكسب {n} درهم',     range: [100, 250], coins: 50 },
  { id: 'milk',    stat: 'milked',  name: 'احلب {n} مرات',         range: [2, 4],  coins: 50, needs: 'stable' },
  { id: 'cfeed',   stat: 'camelFed', name: 'أطعم النياق {n} مرات', range: [3, 6],  coins: 45, needs: 'stable' },
  { id: 'trough',  stat: 'troughFilled', name: 'كب {n} ماء بالحوض', range: [4, 8], coins: 40, needs: 'trough' },
];
export const DAILY_QUEST_BONUS = { chest: 'rare', label: 'صندوق نادر' };

// الإنجازات: كل إحصائية لها ثلاث درجات (برونزي، فضي، ذهبي)
export const ACHIEVEMENTS = [
  { stat: 'palms',     name: 'حطّاب النخل',   tiers: [10, 60, 250] },
  { stat: 'rocks',     name: 'كسّار الصخر',   tiers: [10, 60, 250] },
  { stat: 'guests',    name: 'راعي الكرم',    tiers: [5, 40, 150] },
  { stat: 'crafted',   name: 'صاحب صنعة',    tiers: [10, 80, 300] },
  { stat: 'harvested', name: 'المزارع الشاطر', tiers: [5, 40, 150] },
  { stat: 'kills',     name: 'فارس السرداب',  tiers: [5, 40, 150] },
  { stat: 'coinsEarned', name: 'تاجر الطريق', tiers: [500, 5000, 30000] },
  { stat: 'chests',    name: 'صيّاد الكنوز',  tiers: [3, 20, 80] },
  { stat: 'days',      name: 'ولد الخان',     tiers: [3, 15, 60] },
  { stat: 'stars',     name: 'نجم القوافل',   tiers: [1, 3, 5] },
  { stat: 'relics',    name: 'جامع التحف',    tiers: [2, 6, 12] },
  { stat: 'level',     name: 'خبرة سنين',     tiers: [5, 15, 30] },
  { stat: 'camelsBorn', name: 'مربي الإبل',   tiers: [1, 10, 40] },
  { stat: 'rareCamels', name: 'صياد النوادر', tiers: [1, 3, 8] },
  { stat: 'marketSales', name: 'تاجر الحلال', tiers: [1, 10, 40] },
  { stat: 'milked',    name: 'حلّاب الخير',   tiers: [5, 40, 150] },
  { stat: 'mazayenWins', name: 'شيخ المزاين', tiers: [1, 5, 15] },
];
export const ACH_TIER_NAMES = ['برونزي', 'فضي', 'ذهبي'];
export const ACH_TIER_REWARDS = [
  { coins: 50, xp: 20 },
  { coins: 200, xp: 60, kp: { c: 2, n: 2, s: 2 } },
  { coins: 600, chest: 'legendary' },
];

export const AD_DAILY_CAP = 12;

export const AD_PLACEMENTS = {
  daily_x2:   'ضاعف المكافأة اليومية',
  offline_x2: 'ضاعف أرباح الغياب',
  wheel:      'لفة زيادة بالعجلة',
  revive:     'كمّل بالسرداب',
  energy:     'عبّي الطاقة',
  chest_x2:   'ضاعف الصندوق',
  bless:      'بركة: فرصة النادرة ×2',
};
