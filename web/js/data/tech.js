// شجرة المعرفة: c = حِرفة، n = طبيعة، s = أسرار
export const KP_TYPES = {
  c: { name: 'حِرفة', color: '#e8903a', icon: '🔶' },
  n: { name: 'طبيعة', color: '#6cc24a', icon: '🟢' },
  s: { name: 'أسرار', color: '#9b6cf0', icon: '🔮' },
};

export const TECH = [
  { id: 't_kiln',     name: 'الفخّار',         desc: 'تقدر تبني فرن الفخّار.',               cost: { c: 2, n: 2 },        req: [] },
  { id: 't_brick',    name: 'صناعة الطوب',     desc: 'وصفة الطوب بالفرن.',                    cost: { c: 3 },              req: ['t_kiln'] },
  { id: 't_lantern',  name: 'السُّرُج',         desc: 'وصفة السراج بالفرن.',                   cost: { c: 3, s: 1 },        req: ['t_kiln'] },
  { id: 't_bed',      name: 'نجارة الأسرّة',    desc: 'تصنع سرير خشب للضيوف.',                 cost: { c: 4, n: 1 },        req: [] },
  { id: 't_farm2',    name: 'توسعة المزرعة',   desc: 'تبني أحواض زراعة زيادة.',               cost: { n: 4 },              req: [] },
  { id: 't_melon',    name: 'البطيخ',          desc: 'أم ريم تبيع لك بذور بطيخ.',             cost: { n: 4, c: 1 },        req: ['t_farm2'] },
  { id: 't_bread',    name: 'الخبز',           desc: 'تبني الرحى وتخبز خبز تنّور.',           cost: { c: 2, n: 3 },        req: [] },
  { id: 't_pressed',  name: 'التمر المكنوز',    desc: 'تكنز التمر بالجرار. يبيع زين!',        cost: { c: 3, n: 3 },        req: ['t_kiln'] },
  { id: 't_cardamom', name: 'الهيل',           desc: 'أم ريم تبيع لك بذور هيل.',              cost: { n: 5 },              req: ['t_farm2'] },
  { id: 't_coffee2',  name: 'قهوة الشيوخ',      desc: 'قهوة بالهيل. الضيوف يدفعون ضعف.',      cost: { c: 4, n: 2 },        req: ['t_cardamom'] },
  { id: 't_loom',     name: 'النسيج',          desc: 'تبني النول.',                           cost: { c: 5, n: 3 },        req: ['t_bed'] },
  { id: 't_carpet',   name: 'السجاد والمساند', desc: 'تنسج سجاد وتسوي مساند.',                cost: { c: 4, n: 2 },        req: ['t_loom'] },
  { id: 't_tools',    name: 'أدوات أقوى',      desc: 'فاس وعتلة أقوى: ضربة أقل لكل مورد.',   cost: { c: 6, n: 4 },        req: ['t_brick'] },
  { id: 't_stamina',  name: 'نفَس طويل',        desc: 'الطاقة القصوى +25.',                    cost: { n: 6 },              req: ['t_tools'] },
  { id: 't_staff',    name: 'عصا الخيزران',    desc: 'ضربتك بالسرداب أقوى (+1).',            cost: { c: 3, s: 3 },        req: [] },
  { id: 't_crypt2',   name: 'طلاسم الطابق الثاني', desc: 'تفتح الطابق الثاني من السرداب.',   cost: { s: 6 },              req: ['t_staff'] },
  { id: 't_crypt3',   name: 'طلاسم الطابق الثالث', desc: 'تفتح أعمق طابق... على مسؤوليتك.', cost: { s: 10, c: 2 },       req: ['t_crypt2'] },
  { id: 't_armor',    name: 'درع جلد',         desc: 'الصحة القصوى +4.',                      cost: { c: 4, s: 4 },        req: ['t_staff'] },
  { id: 't_stable',   name: 'مراح الإبل',      desc: 'تبني مراح للإبل.',                      cost: { c: 5, n: 5 },        req: ['t_farm2'] },
  { id: 't_hospitality', name: 'الكرم العربي', desc: 'تبني المجلس. الضيوف +25% دراهم.',       cost: { c: 6, n: 4, s: 2 },  req: ['t_carpet', 't_coffee2'] },
];

export const TECH_BY_ID = Object.fromEntries(TECH.map(t => [t.id, t]));
