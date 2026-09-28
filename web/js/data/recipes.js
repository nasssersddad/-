// المحطات والوصفات. tech = تقنية لازم تكون مفتوحة. kp = نقاط معرفة تنكسب من الصناعة
export const STATIONS = {
  workbench: { name: 'المنجرة', icon: '🪚' },
  kiln:      { name: 'فرن الفخّار', icon: '🔥' },
  hearth:    { name: 'موقد القهوة', icon: '☕' },
  loom:      { name: 'النول', icon: '🧵' },
  mill:      { name: 'الرحى', icon: '⚙️' },
};

export const RECIPES = [
  { id: 'plank',   station: 'workbench', out: { plank: 1 },   in: { wood: 2 },               xp: 2, kp: { c: 1 } },
  { id: 'rope',    station: 'workbench', out: { rope: 1 },    in: { frond: 3 },              xp: 2, kp: { c: 1, n: 1 } },
  { id: 'bed',     station: 'workbench', out: { bed: 1 },     in: { plank: 4, rope: 2 },     xp: 6, kp: { c: 2 }, tech: 't_bed' },
  { id: 'cushion', station: 'workbench', out: { cushion: 1 }, in: { plank: 1, wool: 2 },     xp: 5, kp: { c: 2 }, tech: 't_carpet' },

  { id: 'brick',   station: 'kiln', out: { brick: 1 },  in: { clay: 2, water: 1, wood: 1 }, time: 60, xp: 3, kp: { c: 1 }, tech: 't_brick' },
  { id: 'jar',     station: 'kiln', out: { jar: 1 },    in: { clay: 3, wood: 1 },           time: 90, xp: 4, kp: { c: 2 } },
  { id: 'lantern', station: 'kiln', out: { lantern: 1 },in: { jar: 1, frond: 2 },           time: 120, xp: 5, kp: { c: 1, s: 1 }, tech: 't_lantern' },

  { id: 'coffee',  station: 'hearth', out: { coffee: 2 }, in: { beans: 1, water: 1, wood: 1 },                xp: 3, kp: { c: 1 } },
  { id: 'coffee2', station: 'hearth', out: { coffee2: 2 },in: { beans: 1, cardamom: 1, water: 1, wood: 1 },   xp: 5, kp: { c: 2 }, tech: 't_coffee2' },
  { id: 'bread',   station: 'hearth', out: { bread: 2 },  in: { flour: 1, water: 1, wood: 1 },                xp: 4, kp: { c: 1, n: 1 }, tech: 't_bread' },
  { id: 'pressed', station: 'hearth', out: { pressed: 1 },in: { dates: 4, jar: 1 },                           xp: 5, kp: { c: 1, n: 1 }, tech: 't_pressed' },

  { id: 'flour',   station: 'mill', out: { flour: 1 }, in: { wheat: 2 }, time: 45, xp: 2, kp: { n: 1 } },

  { id: 'carpet',  station: 'loom', out: { carpet: 1 }, in: { wool: 3, herb: 1 }, time: 180, xp: 6, kp: { c: 2, n: 1 }, tech: 't_carpet' },
];

// مواقع البناء والترميم. rating = كم ترفع سمعة الخان
export const BUILD_SPOTS = {
  my_bed:     { name: 'فراشك', desc: 'مكان تنام فيه وترجّع طاقتك. ما يصير حارس بلا فراش!', cost: { plank: 2, rope: 1 }, rating: 0 },
  kiln:       { name: 'فرن الفخّار', desc: 'تشوي فيه الطين وتسوي طوب وجرار.', cost: { stone: 6, clay: 4 }, rating: 3, tech: 't_kiln', station: 'kiln' },
  mill:       { name: 'الرحى', desc: 'تطحن فيها القمح وتسوي طحين.', cost: { stone: 8, plank: 2 }, rating: 2, tech: 't_bread', station: 'mill' },
  loom:       { name: 'النول', desc: 'تنسج فيه السجاد من الصوف.', cost: { plank: 5, rope: 3 }, rating: 3, tech: 't_loom', station: 'loom' },
  wall_n:     { name: 'الجدار الشمالي', desc: 'رمّم الجدار الطايح عشان الضيوف يحسون بالأمان.', cost: { brick: 6, plank: 2 }, rating: 8, tech: 't_brick' },
  wall_s:     { name: 'الجدار الجنوبي', desc: 'جدار ثاني يبي له ترميم.', cost: { brick: 8, stone: 4 }, rating: 8, after: 'wall_n' },
  gate:       { name: 'بوابة الخان', desc: 'بوابة خشب محترمة تستقبل فيها القوافل.', cost: { plank: 8, rope: 2, stone: 4 }, rating: 10, after: 'wall_s' },
  lamps:      { name: 'سُرج الساحة', desc: 'إضاءة للساحة بالليل. تجذب ضيوف أكثر.', cost: { lantern: 3 }, rating: 7, tech: 't_lantern' },
  room1:      { name: 'غرفة ضيوف ١', desc: 'غرفة فيها سرير وسجادة. تجيب لك دخل كل ليلة.', cost: { bed: 1, carpet: 1 }, rating: 10, room: true, tech: 't_bed' },
  room2:      { name: 'غرفة ضيوف ٢', desc: 'غرفة ثانية = دخل أكثر.', cost: { bed: 1, carpet: 1, lantern: 1 }, rating: 10, room: true, after: 'room1' },
  room3:      { name: 'غرفة ضيوف ٣', desc: 'غرفة فخمة للتجار الكبار.', cost: { bed: 1, carpet: 2, lantern: 1 }, rating: 12, room: true, after: 'room2' },
  majlis:     { name: 'المجلس', desc: 'مجلس عربي بسجاد ومساند. الضيوف يدفعون أكثر.', cost: { carpet: 2, cushion: 3, coffee2: 2 }, rating: 15, tech: 't_hospitality' },
  fountain:   { name: 'حوض الساحة', desc: 'حوض ماء بارد بنص الساحة.', cost: { stone: 12, brick: 6, water: 5 }, rating: 10, after: 'wall_n' },
  stable:     { name: 'مراح الإبل', desc: 'مراح تربي فيه نياقك: تسقيها وتطعمها وتحلبها وتلقّحها. والقوافل تحب الخان اللي فيه مراح.', cost: { plank: 6, rope: 4, wood: 6 }, rating: 8, tech: 't_stable' },
  trough:     { name: 'حوض الماء', desc: 'جرة/حوض كبير تكب فيه ماء، والنياق تشرب منه كل صباح لحالها.', cost: { clay: 6, brick: 3, jar: 1 }, rating: 3, after: 'stable' },
  pen2:       { name: 'توسعة المراح', desc: 'المراح يشيل 8 نياق.', cost: { wood: 10, rope: 4, plank: 4 }, rating: 4, after: 'stable' },
  workers_house: { name: 'بيت العمّال', desc: 'سكن للعمال: تقدر توظف لين 4 عمّال.', cost: { plank: 8, brick: 6, rope: 3 }, rating: 4 },
  workers_house2: { name: 'توسعة بيت العمّال', desc: 'لين 6 عمّال.', cost: { plank: 10, brick: 10, carpet: 1 }, rating: 4, after: 'workers_house' },
  sheepfold:  { name: 'حظيرة الغنم', desc: 'تربي فيها غنم: تطعمها وتسقيها وتجز صوفها، وتبيعها بالبسطة.', cost: { wood: 8, rope: 4, plank: 3 }, rating: 4 },
  stall_shop: { name: 'البسطة', desc: 'بسطة على الطريق تعرض فيها زرعك ومنتجاتك وغنمك، والمارّة يشترون.', cost: { plank: 4, frond: 6 }, rating: 3 },
  orders_board: { name: 'لوحة قافلة الطلبات', desc: 'طلبات من القوافل: جهّز الأغراض واستلم دراهم وخبرة.', cost: { plank: 3, rope: 2 }, rating: 2 },
  pen3:       { name: 'مراح كبير', desc: 'المراح يشيل 12 ناقة.', cost: { plank: 8, rope: 6, brick: 6 }, rating: 5, after: 'pen2' },
  farm2:      { name: 'توسعة المزرعة', desc: 'أربع أحواض زراعة زيادة.', cost: { wood: 6, stone: 4, water: 4 }, rating: 2, tech: 't_farm2' },
  barn:       { name: 'المخزن', desc: 'مخزن كبير برا يشيل مواد البناء: خشب وحجر وطين وألواح وحبال وطوب... اللي تجمعه وحقيبتك مليانة يروح له أول.', cost: { wood: 10, plank: 8, stone: 6 }, rating: 3 },
  crypt_door: { name: 'باب السرداب', desc: 'باب قديم مقفول بطلاسم... زعبول يعرف سالفته.', cost: { lantern: 1, rope: 2 }, rating: 0, flag: 'q_crypt' },
};

// أول ما تنبني هذي الأشياء تزيد سمعة الخان. النجوم:
export const STAR_THRESHOLDS = [0, 10, 28, 50, 75, 100];
