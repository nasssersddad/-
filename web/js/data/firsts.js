// «أول مرة!» لحظات تستاهل احتفال صغير وجايزة، عشان اللاعب يحس إن كل خطوة جديدة لها قيمة
export const FIRSTS = [
  { id: 'harvest', stat: 'harvested', icon: '🧺', title: 'أول حصاد!', text: 'زرعتها وسقيتها وحصدتها بيدك.', reward: { coins: 20, xp: 10 } },
  { id: 'storeSold', stat: 'storeSold', icon: '💰', title: 'أول بيعة!', text: 'صرت تاجر. كل ما زرعت أكثر، كسبت أكثر.', reward: { coins: 25 } },
  { id: 'guest', stat: 'guests', icon: '☕', title: 'أول ضيف!', text: 'القوافل بتحكي عن كرم خانك.', reward: { coins: 20, items: { dates: 3 } } },
  { id: 'milk', stat: 'milked', icon: '🥛', title: 'أول حليب!', text: 'ناقتك تعطيك خيرها كل يوم.', reward: { xp: 15 } },
  { id: 'egg', stat: 'eggs', icon: '🥚', title: 'أول بيض!', text: 'دجاجك بدأ يبيض. أكّله ويعطيك أكثر.', reward: { coins: 20 } },
  { id: 'craft', stat: 'crafted', icon: '🔨', title: 'أول صنعة!', text: 'من المواد الخام لشي له قيمة.', reward: { xp: 10 } },
  { id: 'build', stat: 'built', icon: '🏗️', title: 'أول بناء!', text: 'مزرعتك بدت تكبر.', reward: { coins: 30 } },
  { id: 'order', stat: 'ordersDone', icon: '📋', title: 'أول طلب قافلة!', text: 'القوافل بترجع لك بطلبات أكبر.', reward: { coins: 30 } },
  { id: 'request', stat: 'requests', icon: '📜', title: 'أول خدمة لجارك!', text: 'الجيرة الطيبة تجيب خصومات.', reward: { coins: 25 } },
  { id: 'calf', stat: 'camelsBorn', icon: '🐣', title: 'أول حوار!', text: 'ناقتك ولدت! يمكن الجاي يطلع نادر ✨', reward: { coins: 60, xp: 20 } },
  { id: 'trip', stat: 'trips', icon: '🗺️', title: 'أول طلعة للقرية!', text: 'الجيران عندهم بضاعة وحلال ومزارع للبيع.', reward: { coins: 15 } },
  { id: 'combo', stat: 'combos', icon: '🔥', title: 'أول كومبو ×5!', text: 'اشتغل بسرعة ورا بعض والجوايز تزيد.', reward: { xp: 10 } },
  { id: 'lucky', stat: 'lucky', icon: '🍀', title: 'أول حظ ذهبي!', text: 'أحياناً الأرض تعطيك ضعف.', reward: { coins: 15 } },
  { id: 'chest', stat: 'chests', icon: '🎁', title: 'أول صندوق!', text: 'الصناديق تطيح وأنت تشتغل، دوّرها.', reward: { xp: 10 } },
];

// اللي تحقق وما انعطى للحين
export function pendingFirsts(state) {
  const got = state.flags.firsts || {};
  return FIRSTS.filter(f => !got[f.id] && (state.stats[f.stat] || 0) > 0);
}

export function markFirst(state, id) {
  state.flags.firsts = state.flags.firsts || {};
  state.flags.firsts[id] = true;
}

// الحفظ القديم: اللي سواه قبل ما ننزل الميزة ما نحتفل فيه (ولا نكرر جوايز)
export function seedFirsts(state) {
  if (state.flags.firsts) return;
  state.flags.firsts = {};
  for (const f of FIRSTS) if ((state.stats[f.stat] || 0) > 0) state.flags.firsts[f.id] = true;
}
