// العمّال: الأنواع والرواتب والأسماء
export const WORKER_TYPES = {
  woodcutter: { name: 'حطّاب', icon: '🪓', wage: 4, hire: 60, desc: 'يقطع النخل ويكسر الحجر ويحط الخشب والحجر بحقيبتك.' },
  farmer:     { name: 'مزارع', icon: '🌾', wage: 4, hire: 60, desc: 'يزرع الأحواض ويسقيها ويحصدها. يجيب ماء من البير لحاله.' },
  builder:    { name: 'بنّاء', icon: '🔨', wage: 6, hire: 100, desc: 'يبني مواقع البناء اللي تحددها له من موادك.' },
  herder:     { name: 'راعي',  icon: '🐑', wage: 3, hire: 50, desc: 'يسقي النياق والغنم ويطعمها ويعبّي الحوض.' },
};

export const WORKER_NAMES = ['سعيد', 'مبروك', 'فرج', 'جابر', 'عيضة', 'سالم', 'مرزوق', 'حمدان', 'دخيل', 'زايد', 'شنّان', 'عبيد', 'هزّاع', 'بخيت'];
export const WORKER_LOOKS = [
  { robe: '#c9b28a', head: '#e8e1cf', skin: '#9a6a44' },
  { robe: '#8a6a45', head: '#f4f0e6', skin: '#b67a4a', beard: '#2b1d14' },
  { robe: '#5a6e8a', head: '#d9d2bf', skin: '#8f5f3c' },
  { robe: '#7a4a2a', head: '#c9302c', skin: '#c68a5a', beard: '#1b120c' },
  { robe: '#6a7a4a', head: '#e8e1cf', skin: '#a0704a' },
];

export const WORK_START = 6;   // العمال يشتغلون من 6 الصبح
export const WORK_END = 20;    // لين 8 بالليل
export const STRIKE_AFTER = 3; // ساعات تأخير قبل الإضراب
export const FINE_RATE = 0.5;
export const FINE_MIN = 30;
export const WORKER_CAP = { base: 2, workers_house: 4, workers_house2: 6 };
