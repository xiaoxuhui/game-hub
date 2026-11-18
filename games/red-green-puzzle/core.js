export const MAX_SIZE = 10;
export const STORAGE_KEY = 'red-green-puzzle.parameters.v1';

export function validSize(size) { return Number.isInteger(size) && size >= 1 && size <= MAX_SIZE; }
export function gray(rank) { return rank ^ (rank >> 1); }
export function inverseGray(value) { let result = 0; while (value > 0) { result ^= value; value >>= 1; } return result; }
export function toBits(value, width) { return value.toString(2).padStart(width, '0'); }
export function canFlip(previous, next) {
  if (previous.length !== next.length) return false;
  const changed = [];
  for (let i = 0; i < previous.length; i++) if (previous[i] !== next[i]) changed.push(i);
  if (changed.length !== 1) return false;
  const index = changed[0];
  if (index === previous.length - 1) return true;
  if (previous[index + 1] !== '1') return false;
  for (let i = index + 2; i < previous.length; i++) if (previous[i] !== '0') return false;
  return true;
}
export function buildSolution(size) {
  if (!validSize(size)) throw new RangeError('数量须为1到10之间的整数');
  const targetRank = inverseGray(2 ** size - 1);
  return Array.from({ length: targetRank + 1 }, (_, rank) => toBits(gray(rank), size));
}
export function restoreSize(raw) {
  try { const saved = JSON.parse(raw); return saved?.schemaVersion === 1 && validSize(saved.size) ? saved.size : 6; }
  catch { return 6; }
}
export function flowText(states) { return states.map((state, index) => `${index}: ${state}`).join('\n'); }
