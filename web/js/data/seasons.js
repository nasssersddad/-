// المواسم الحقيقية: تشتغل بتاريخها (هجري أو ميلادي)، وكل واحد له زينة وطعم خاص
// مرتبة بالأولوية: لو تداخلت مواسم، يطلع اللي فوق
export const SEASONS = [
  {
    id: 'eid_fitr', name: 'عيد الفطر', icon: '🎉', greet: 'عيدكم مبارك! 🎉',
    when: { hijri: { month: 10, from: 1, to: 3 } },
    desc: 'كل يوم من أيام العيد تجيك عيدية أول ما تدخل، وبشت العيد الجديد ينفتح لك. والخان متزين بالأضواء والبالونات!',
    mods: { eidiya: true, outfit: true, lights: 'eid' },
  },
  {
    id: 'eid_adha', name: 'عيد الأضحى', icon: '🐑', greet: 'عيد أضحى مبارك! 🐑',
    when: { hijri: { month: 12, from: 10, to: 13 } },
    desc: 'عيدية كل يوم، وبشت العيد، والغنم يغلى سعرها ×1.5، والجيران يطلبون أضحية!',
    mods: { eidiya: true, outfit: true, lights: 'eid', sheepPrice: 1.5, adhaRequest: true },
  },
  {
    id: 'ramadan', name: 'رمضان', icon: '🌙', greet: 'رمضان كريم! 🌙',
    when: { hijri: { month: 9, from: 1, to: 30 } },
    desc: 'ضيوف الفطور يوصلون قبل المغرب ويبون تمر وقهوة وحليب وخبز، ويدفعون ضعف. فطّر الصايمين وخذ جوايز، والخان متزين بالفوانيس.',
    mods: { iftar: true, guestPay: 2, lights: 'ramadan', moon: true },
  },
  {
    id: 'winter', name: 'موسم الشتاء', icon: '❄️', greet: 'هلا بالشتاء! ❄️',
    when: { months: [12, 1, 2] },
    desc: 'المطر يكثر، وبعد المطر يطلع الفقع 🍄 بالرمل: احفره وبعه غالي. وجنب الخان شبّة نار (كشتة) تدفّي فيها وترجع طاقتك.',
    mods: { rainChance: 0.5, truffles: 5, campfire: true },
  },
];

// جوايز رمضان: عدد الصايمين اللي فطّرتهم
export const IFTAR_MILESTONES = [
  { at: 5, reward: { coins: 150, items: { dates: 10 } }, label: '🪙150 + 🌴10' },
  { at: 15, reward: { coins: 400, chest: 'rare' }, label: '🪙400 + 💎 صندوق نادر' },
  { at: 30, reward: { coins: 900, chest: 'legendary' }, label: '🪙900 + 👑 صندوق أسطوري' },
];

// اللي يطلبونه ضيوف الفطور
export const IFTAR_WANTS = ['dates', 'dates', 'coffee', 'milk', 'bread'];

// لبس العيد للاعب: بشت بني وغترة بيضا (يفرق عن لبسه العادي: ثوب أبيض وشماغ أحمر)
export const EID_LOOK = { robe: '#4a2c14', head: '#fbf8f0', skin: '#c68a5a' };
