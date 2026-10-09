// الأزرار تنفتح وحدة وحدة مع التقدم، عشان اللاعب الجديد ما يضيع بزحمة القوائم
// كل شرط يقرأ من الحالة الموجودة (مهام، مباني، مستوى)، فالحفظ القديم يطلع له كل شي مثل ما هو
import { MAIN_QUESTS } from '../data/quests.js';

const qi = (id) => MAIN_QUESTS.findIndex(q => q.id === id);
const past = (s, id) => s.quest.index >= qi(id);      // وصل لهالمهمة (صارت الحالية أو خلصها)
const done = (s, id) => s.quest.index > qi(id);       // خلّص هالمهمة
const lvl = (s) => s.player.level || 1;

export const UNLOCKS = [
  { id: 'inventory', icon: '🎒', name: 'الحقيبة', when: () => true },
  { id: 'store', icon: '🛒', name: 'المتجر', when: () => true },
  { id: 'help', icon: '❓', name: 'كيف ألعب', when: () => true },
  { id: 'rewards', icon: '🎁', name: 'المكافآت', hint: 'خلّص أول مهمة', when: (s) => done(s, 'q_wake') || lvl(s) >= 2 },
  { id: 'manage', icon: '📋', name: 'إدارتي', hint: 'ابنِ فراشك', when: (s) => done(s, 'q_bed') || lvl(s) >= 3 },
  { id: 'tech', icon: '🔮', name: 'المعرفة', hint: 'وصّل لمهمة الفخّار', when: (s) => past(s, 'q_kiln') || Object.keys(s.tech).length > 0 || lvl(s) >= 4 },
  { id: 'workers', icon: '👷', name: 'العمّال', hint: 'وصّل لمهمة أول عامل', when: (s) => past(s, 'q_worker') || s.workers.length > 0 || lvl(s) >= 5 },
  { id: 'trade', icon: '🏪', name: 'التجارة', hint: 'ابنِ البسطة', when: (s) => past(s, 'q_stall') || !!s.built.stall_shop || !!s.built.orders_board || !!s.built.sheepfold || lvl(s) >= 5 },
  { id: 'camels', icon: '🐪', name: 'الحلال', hint: 'وصّل لمهمة المراح', when: (s) => past(s, 'q_stable') || !!s.built.stable || s.camels.length > 0 || s.sheep.length > 0 || lvl(s) >= 6 },
  { id: 'events', icon: '🎪', name: 'الفعاليات', hint: 'مستوى 4', when: (s) => lvl(s) >= 4 },
  { id: 'relics', icon: '🏺', name: 'التحف', hint: 'لاقِ أول تحفة', when: (s) => Object.keys(s.relics || {}).length > 0 || lvl(s) >= 6 },
];

const BY_ID = Object.fromEntries(UNLOCKS.map(u => [u.id, u]));

export function isUnlocked(state, id) {
  const u = BY_ID[id];
  return !u || !!u.when(state);
}

export function unlockInfo(id) {
  return BY_ID[id] || null;
}

// الأشياء اللي انفتحت من آخر مرة (ونحفظ إنها انشافت عشان "جديد!" ما يتكرر)
export function newlyUnlocked(state) {
  state.flags.seenUnlocks = state.flags.seenUnlocks || {};
  const seen = state.flags.seenUnlocks;
  const out = [];
  for (const u of UNLOCKS) {
    if (seen[u.id] || !u.when(state)) continue;
    seen[u.id] = true;
    out.push(u);
  }
  return out;
}

// وش انفتح بهالمستوى (أزرار، بذور، ساحات) عشان نعرضه بشاشة الاحتفال
export function unlocksAtLevel(state, level, { seeds = {}, zones = [] } = {}) {
  const out = [];
  const prev = { ...state, player: { ...state.player, level: level - 1 } };
  for (const u of UNLOCKS) if (u.when(state) && !u.when(prev)) out.push({ icon: u.icon, name: u.name });
  for (const d of Object.values(seeds)) if (d.level === level) out.push({ icon: '🌱', name: 'بذور ' + d.name });
  for (const z of zones) if (z.lock && z.lock.level === level) out.push({ icon: '🔓', name: z.name + ' (تقدر تفتحها)' });
  return out;
}

// أول تشغيل: اللي مفتوح من البداية ما نحتفل فيه
export function markAllSeen(state) {
  state.flags.seenUnlocks = state.flags.seenUnlocks || {};
  for (const u of UNLOCKS) if (u.when(state)) state.flags.seenUnlocks[u.id] = true;
}
