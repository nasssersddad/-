// تقدم سلسلة المهام الرئيسية
import { MAIN_QUESTS } from '../data/quests.js';
import { stars } from './progression.js';

export function currentQuest(state) {
  return state.quest.index < MAIN_QUESTS.length ? MAIN_QUESTS[state.quest.index] : null;
}

// إذا خلصت المهمة الحالية ترجعها (وتنقل للي بعدها)
export function checkQuest(state) {
  const q = currentQuest(state);
  if (!q) return null;
  if (q.check(state, { stars: stars(state) })) {
    state.quest.index += 1;
    if (q.id === 'q_star2') state.flags.crypt_unlocked = true;
    return q;
  }
  return null;
}
