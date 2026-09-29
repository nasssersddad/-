// الفعاليات: تتبدل كل يومين حقيقيين، ولكل وحدة عملة ومسار جوايز
export const EVENT_DAYS = 2;
// إزاحة التدوير: لما أضفنا «أسبوع الورش» خلّينا فعالية اليوم نفسها عشان ما يضيع تقدّم اللاعبين
export const EVENT_OFFSET = 5;

export const EVENTS = [
  {
    id: 'camel_race', name: 'سباق الهجن', icon: '🐪', token: 'راية', tokenIcon: '🚩',
    desc: 'سابق بناقتك ضد أسرع هجن الديرة! اضغط بالتوقيت الصح عشان تسرّع. الناقة الأجمل أسرع.',
    game: 'race', how: 'كل سباق يعطيك رايات حسب مركزك.',
  },
  {
    id: 'dates_festival', name: 'مهرجان التمور', icon: '🌴', token: 'سلة', tokenIcon: '🧺',
    desc: 'النخل يطيّح تمر أكثر! جمّع التمر وسلّمه للمهرجان: كل 8 تمرات = سلة.',
    deliver: { item: 'dates', per: 8 }, mods: { datesBoost: true }, how: 'سلّم التمر من شاشة الفعالية.',
  },
  {
    id: 'falcon', name: 'صيد الصقور', icon: '🦅', token: 'ريشة', tokenIcon: '🪶',
    desc: 'أطلق صقرك على الحبارى وهي طايرة. التوقيت هو كل شي!',
    game: 'falcon', how: 'كل حبارى تصيدها = ريشة.',
  },
  {
    id: 'sandstorm', name: 'العاصفة الرملية', icon: '🌪️', token: 'كنز', tokenIcon: '💰',
    desc: 'العاصفة كشفت كنوز مدفونة بالرمل حول مزرعتك! دوّرها واحفرها قبل ما تنطمر.',
    mods: { storm: true, buried: 6 }, how: 'احفر الكنوز اللي تلمع بالرمل.',
  },
  {
    id: 'moon_night', name: 'ليلة القمر', icon: '🌕', token: 'نجمة', tokenIcon: '⭐',
    desc: 'بالليل تطلع لمعات بالمزرعة، اجمعها. ووحوش السرداب تعطيك نجوم زيادة.',
    mods: { moonSparkles: 8, dungeonTokens: true }, how: 'اجمع اللمعات بالليل واهزم وحوش السرداب.',
  },
  {
    id: 'friday_market', name: 'سوق الجمعة الكبير', icon: '🏪', token: 'ختم', tokenIcon: '🔖',
    desc: 'الزحمة بالسوق: البسطة تبيع أسرع، وطلبات القوافل تدفع +50%.',
    mods: { stallFast: true, ordersBonus: 0.5 }, how: 'كل بيعة من البسطة أو طلب تسلّمه = أختام.',
  },
  {
    id: 'workshop_week', name: 'أسبوع الورش', icon: '🔨', token: 'مطرقة', tokenIcon: '🔨',
    desc: 'الصنّاع بالديرة يساعدونك: الفرن والرحى والنول يخلصون الشغل أسرع (الوقت ×0.6)، وكل طلب تستلمه يعطيك مطارق.',
    mods: { workshopFast: 0.6, workshopTokens: true }, how: 'حط شغل بالفرن والرحى والنول واستلمه: كل طلب = مطرقتين.',
  },
];

// مسار الجوايز: 10 درجات، كل وحدة تحتاج عملة أكثر من اللي قبلها
export const TRACK_COSTS = [5, 10, 15, 22, 30, 40, 52, 66, 82, 100];
export const TRACK_REWARDS = [
  { coins: 60 },
  { items: { seed_wheat: 5, seed_tomato: 5 } },
  { kp: { c: 2, n: 2, s: 1 } },
  { chest: 'common' },
  { coins: 250 },
  { items: { lantern: 2, carpet: 1 } },
  { chest: 'rare' },
  { coins: 600, kp: { c: 3, n: 3, s: 3 } },
  { chest: 'rare', coins: 400 },
  { chest: 'legendary' },
];

export const DAILY_PLAYS = 3;
export const AD_PLAYS = 2;
