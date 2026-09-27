// الشخصيات وأيام حضورهم. أيام الأسبوع تبدأ من السبت (0)
export const WEEKDAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
export const WEEKDAY_ICONS = ['🌾', '☀️', '🐪', '🌴', '🌿', '🐑', '⭐'];

export const NPCS = {
  lamp: {
    name: 'زعبول', title: 'جني الفانوس', days: [0, 1, 2, 3, 4, 5, 6], hours: [0, 24],
    look: { robe: '#3a6fd8', head: '#2a4fa8', skin: '#6fa0ff' },
  },
  trader: {
    name: 'أبو فهد', title: 'التاجر', days: [0, 2, 4, 6], hours: [7, 19],
    look: { robe: '#f2ead8', head: '#c9302c', skin: '#c68a5a', beard: '#2b1d14' },
    sells: ['beans', 'seed_wheat', 'seed_tomato', 'wool', 'clay', 'stone', 'wood', 'jar', 'dates'],
    buyMul: 1,
    greet: ['هلا والله بجاري! وش عندك تبيع؟', 'البضاعة زينة والسعر أزين، لا تفوّتها!', 'يا شيخ السوق اليوم نار، تبي شي؟'],
  },
  herbalist: {
    name: 'أم ريم', title: 'العطّارة', days: [3, 5], hours: [8, 18],
    look: { robe: '#2b2b33', head: '#1a1a20', skin: '#c68a5a', veil: true },
    sells: ['seed_tomato', 'seed_wheat', 'seed_melon', 'seed_cardamom', 'herb', 'beans'],
    sellsTech: { seed_melon: 't_melon', seed_cardamom: 't_cardamom' },
    buyMul: 1, herbMul: 2,
    greet: ['يا ولدي الأعشاب دوا لكل شي، إلا الكسل.', 'عندي بذور ما لقيتها عند أحد!', 'تبي هيل؟ الهيل يعدّل المزاج والقهوة.'],
  },
  shepherd: {
    name: 'مبارك', title: 'الراعي', days: [1, 5], hours: [7, 17],
    look: { robe: '#8a6a45', head: '#e8e1cf', skin: '#9a6a44', beard: '#3a2a1a' },
    sells: ['wool', 'dates'],
    buyMul: 1, breadMul: 1.6,
    greet: ['الغنم تسلّم عليك! تبي صوف؟', 'الخبز اللي تسويه يسوى الدنيا، عندك منه؟', 'الله يعين، البر حار اليوم.'],
  },
};

export const GUEST_LOOKS = [
  { robe: '#efe6d2', head: '#b8292a', skin: '#c68a5a', beard: '#2b1d14' },
  { robe: '#e7e0ce', head: '#f4f0e6', skin: '#b67a4a', beard: '#1b120c' },
  { robe: '#7b5a3a', head: '#e8e1cf', skin: '#8f5f3c' },
  { robe: '#35506e', head: '#d9d2bf', skin: '#c68a5a', beard: '#555' },
  { robe: '#6e2d2d', head: '#2a2a2a', skin: '#d19a6a' },
];
export const GUEST_NAMES = ['أبو سعد', 'بو خالد', 'التاجر جاسم', 'أبو ناصر', 'العم حمد', 'بو عبدالله', 'الدكتور فيصل', 'مسافر من حايل', 'تاجر من صنعاء', 'حاج من الشام', 'أبو محمد'];
export const GUEST_WANTS = ['coffee', 'coffee', 'dates', 'bread', 'melon', 'coffee2', 'tomato', 'pressed'];
export const GUEST_LINES = {
  want: ['يا راعي الخان، أبي {x} الله يسلمك.', 'السفر هدّني... عندك {x}؟', 'والله إني مشتهي {x}!', 'لا تقول ما عندك {x}!'],
  thanks: ['الله يعطيك العافية! هذا حقك.', 'كفو والله، خان محترم!', 'تسلم يدك يا ولد الأجاويد.', 'بقول لكل القوافل عن خانك!'],
  noItem: ['ما عندك؟ عادي... بس لا تطوّل.', 'أنتظرك يا بعد حيي.', 'ترى الجوع كافر!'],
};
