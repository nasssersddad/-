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
