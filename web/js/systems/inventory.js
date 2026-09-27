export function count(state, id) {
  return state.inv[id] || 0;
}

export function has(state, cost) {
  for (const [id, n] of Object.entries(cost)) {
    if (count(state, id) < n) return false;
  }
  return true;
}

export function add(state, id, n = 1) {
  state.inv[id] = count(state, id) + n;
  if (state.inv[id] <= 0) delete state.inv[id];
}

export function remove(state, cost) {
  if (!has(state, cost)) return false;
  for (const [id, n] of Object.entries(cost)) add(state, id, -n);
  return true;
}

export function addStat(state, key, n = 1) {
  state.stats[key] = (state.stats[key] || 0) + n;
}

export function stat(state, key) {
  return state.stats[key] || 0;
}
