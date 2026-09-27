// النياق: السلالات والألوان والأسعار
export const BREEDS = {
  majaheem: { name: 'مجاهيم', body: '#2e2622', dark: '#17120f', hump: '#3c322c', base: 650 },
  wadh:     { name: 'وضح',   body: '#f1ebdc', dark: '#cbbfa6', hump: '#fbf7ee', base: 700 },
  shual:    { name: 'شعل',   body: '#b8743a', dark: '#8a5226', hump: '#c98a4e', base: 480 },
  sufr:     { name: 'صفر',   body: '#d9b56a', dark: '#b08e48', hump: '#e6c888', base: 420 },
  humr:     { name: 'حمر',   body: '#9a4a2a', dark: '#6e3018', hump: '#b05a36', base: 450 },
  shugh:    { name: 'شقح',   body: '#c9b89a', dark: '#a0906e', hump: '#d8c9ae', base: 400 },
};

// النوادر: تطلع بنسبة 2% عند الولادة
export const RARES = {
  golden: { name: 'الذهبية',         body: '#f2c230', dark: '#b8860b', hump: '#ffe07a', glow: 'rgba(255,220,90,', base: 120000 },
  royal:  { name: 'الوضحاء الملكية', body: '#ffffff', dark: '#c8dcf8', hump: '#ffffff', glow: 'rgba(170,210,255,', base: 180000 },
  fire:   { name: 'الشعلاء النارية', body: '#e0502a', dark: '#9a2a10', hump: '#ff8a4a', glow: 'rgba(255,140,60,', base: 150000 },
};

export const RARE_CHANCE = 0.02;
export const BLESSED_RARE_CHANCE = 0.04;
export const GESTATION_DAYS = 3;
export const ADULT_AGE = 3;
export const TROUGH_CAP = 10;
export const PEN_CAPACITY = { base: 4, pen2: 8, pen3: 12 };

export const FEMALE_NAMES = ['الغالية', 'شيخة', 'الوضحى', 'هيفاء', 'مزنة', 'نورة', 'الحمرا', 'جوهرة', 'ريم', 'العنود', 'غزيل', 'الشقحا', 'موضي', 'دانة', 'فرحة', 'سمحة'];
export const MALE_NAMES = ['هدّاج', 'مزعل', 'سلطان', 'الأدهم', 'شاهين', 'فهّاد', 'زعّاق', 'مشعل', 'الجزلان', 'نمر', 'عنتر', 'ذيبان'];

export function camelColors(c) {
  return c.rare ? RARES[c.rare] : BREEDS[c.breed];
}

export function camelBreedName(c) {
  return c.rare ? RARES[c.rare].name : BREEDS[c.breed].name;
}

// خواص النياق: كل ناقة لها خاصية عادية أو ثنتين، وبعضها يطلع لها خاصية نادرة تغيّر اللعب
// tier: common = تجي للكل، rare = نادرة
export const TRAITS = {
  fast:     { tier: 'common', icon: '💨', name: 'سريعة',     desc: 'أسرع بالسباق +8%', speed: 0.08 },
  milky:    { tier: 'common', icon: '🍼', name: 'حلوب',      desc: 'تعطي حليب +1 كل حلبة', milk: 1 },
  fertile:  { tier: 'common', icon: '🤱', name: 'ولود',      desc: 'حملها يومين بدل ثلاثة', gestation: -1 },
  pretty:   { tier: 'common', icon: '🌸', name: 'مزيونة',    desc: 'قيمتها أعلى +15%', value: 0.15 },
  hardy:    { tier: 'common', icon: '🏜️', name: 'صبورة',     desc: 'تقدر تنحلب بدون ما تشرب', hardy: true },
  lightning:{ tier: 'rare',   icon: '⚡', name: 'البرق',      desc: 'سرعة خارقة بالسباق +25%', speed: 0.25 },
  fountain: { tier: 'rare',   icon: '⛲', name: 'نبع الحليب', desc: 'حليبها دبل ×2', milkMul: 2 },
  royal:    { tier: 'rare',   icon: '👑', name: 'دم ملكي',    desc: 'عيالها فرصتهم يطلعون نوادر ×3', rareMul: 3 },
  treasure: { tier: 'rare',   icon: '💎', name: 'كنز',        desc: 'قيمتها ×1.8', value: 0.8 },
  lucky:    { tier: 'rare',   icon: '🍀', name: 'المبروكة',   desc: 'تجيب لك رزق كل يوم: 40–120 درهم', lucky: [40, 120] },
};
export const COMMON_TRAITS = Object.keys(TRAITS).filter(k => TRAITS[k].tier === 'common');
export const RARE_TRAITS = Object.keys(TRAITS).filter(k => TRAITS[k].tier === 'rare');
export const RARE_TRAIT_CHANCE = 0.06;      // ناقة عادية يطلع لها خاصية نادرة
export const SECOND_TRAIT_CHANCE = 0.45;    // خاصية عادية ثانية
export const INHERIT_COMMON = 0.4;          // الحوار يورث خاصية عادية من أبوه أو أمه
export const INHERIT_RARE = 0.3;            // ويورث النادرة
