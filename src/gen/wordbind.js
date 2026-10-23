// Wordbund (Wordbind-style): find words hidden in a long word, reading its letters left to
// right. You may skip letters, and a letter may be used twice in a row (BALON makes BALLOON).
// First reach the day's goals by word length, then keep going to fill the bonus bar.
import { wordsOf, tier } from '../lib/words.js';
import { getCategories } from './groups.js';

const SETTINGS = {
  easy: { len: [10, 13], min: 4, goals: { 4: 4, 5: 3, 6: 1 } },
  medium: { len: [13, 16], min: 5, goals: { 5: 4, 6: 2, 7: 1 } },
  hard: { len: [15, 18], min: 5, goals: { 6: 3, 7: 2, 8: 1 } },
};
export const ACCEPT_TIER = 50;
const COMMON_TIER = 35;

/** Can `w` be read from `src` left to right, skipping letters, reusing a letter at most twice in a row? */
export function bindable(w, src) {
  let i = 0, reuse = 0;
  for (let k = 0; k < w.length; k++) {
    const ch = w[k];
    if (k > 0 && src[i] === ch && reuse < 1 && w[k - 1] === ch) { reuse++; continue; } // use the same letter again
    let j = k === 0 ? 0 : i + 1;
    while (j < src.length && src[j] !== ch) j++;
    if (j >= src.length) return false;
    i = j; reuse = 0;
  }
  return true;
}

/** All accepted words of at least `min` letters hidden in `src`. */
export function wordsIn(src, min) {
  const out = [];
  for (let L = min; L <= Math.min(src.length + 3, 12); L++) for (const w of wordsOf(L, ACCEPT_TIER)) if (bindable(w, src)) out.push(w);
  return out;
}

const plainPlural = (w) => w.endsWith('s') && !w.endsWith('ss');

export function generateWordbind(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  // the day's phrase: two everyday words from the same category, like PELICAN FLAMINGO
  const pairs = [];
  const seen = new Set();
  for (const c of getCategories()) {
    if (c.k !== 'kind') continue;
    const ws = (c.f || c.w).filter((w) => /^[a-z]{5,9}$/.test(w) && (tier(w) ?? 99) <= COMMON_TIER && !plainPlural(w));
    for (let i = 0; i < ws.length; i++) for (let j = 0; j < ws.length; j++) {
      const L = ws[i].length + ws[j].length;
      if (i !== j && L >= s.len[0] && L <= s.len[1] && !seen.has(ws[i] + ws[j])) { seen.add(ws[i] + ws[j]); pairs.push([ws[i], ws[j], c.n]); }
    }
  }
  for (const [a, b, theme] of rng.deal(pairs, 9, 'src').slice(0, 80)) {
    const src = a + b;
    const all = wordsIn(src, s.min).filter((w) => w !== a && w !== b && w !== src);
    const common = all.filter((w) => (tier(w) ?? 99) <= COMMON_TIER && !plainPlural(w));
    // goals by length, scaled down if this phrase doesn't hide enough common words
    const goals = {};
    let ok = true;
    for (const [L, want] of Object.entries(s.goals)) {
      const have = common.filter((w) => w.length === Number(L)).length;
      const g = Math.min(want, Math.floor(have / 2));
      if (g < 1) { ok = false; break; }
      goals[L] = g;
    }
    if (!ok) continue;
    const bonus = Math.max(6, Math.round(all.length * 0.35));
    return { words: [a, b], src, theme, all, common, goals, bonus, min: s.min };
  }
  throw new Error('wordbind generation failed');
}
