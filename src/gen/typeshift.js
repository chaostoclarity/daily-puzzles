// Typeshaft (Typeshift-style): each column holds a few letters and slides up and down.
// Line up real words across the middle row until every letter has been used at least once.
import { wordsOf, isWord } from '../lib/words.js';

const SETTINGS = {
  easy: { len: 4, words: 4, tier: 20, letters: [11, 14] },
  medium: { len: 5, words: 5, tier: 20, letters: [16, 20] },
  hard: { len: 6, words: 5, tier: 35, letters: [19, 25] },
};
/** Words the game accepts: a big dictionary, so real words aren't rejected. */
export const ACCEPT_TIER = 50;

const plainPlural = (w) => w.endsWith('s') && !w.endsWith('ss');

/** Every accepted word the columns can make. */
export function wordsFrom(cols) {
  const out = [];
  const walk = (i, pre) => {
    if (i === cols.length) { if (isWord(pre, ACCEPT_TIER)) out.push(pre); return; }
    for (const ch of cols[i]) walk(i + 1, pre + ch);
  };
  walk(0, '');
  return out;
}

/** Fewest words that use every letter, searched exactly (boards are small). */
export function minCover(cols, words) {
  const cells = [];
  cols.forEach((c, i) => c.forEach((ch) => cells.push(i + ':' + ch)));
  const covers = words.map((w) => new Set([...w].map((ch, i) => i + ':' + ch)));
  let best = null, steps = 0;
  const go = (left, chosen) => {
    if (++steps > 200000) return;
    if (!left.size) { if (!best || chosen.length < best.length) best = chosen.slice(); return; }
    if (best && chosen.length + 1 >= best.length) return;
    // branch on the letter with the fewest words that use it
    let pick = null, opts = null;
    for (const cell of left) {
      const o = covers.map((c, k) => k).filter((k) => covers[k].has(cell));
      if (!opts || o.length < opts.length) { pick = cell; opts = o; }
      if (o.length <= 1) break;
    }
    if (!opts.length) return;
    opts.sort((a, b) => [...covers[b]].filter((x) => left.has(x)).length - [...covers[a]].filter((x) => left.has(x)).length);
    for (const k of opts) {
      const next = new Set(left);
      for (const x of covers[k]) next.delete(x);
      chosen.push(words[k]); go(next, chosen); chosen.pop();
    }
  };
  go(new Set(cells), []);
  return best;
}

export function generateTypeshift(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const pool = wordsOf(s.len, s.tier, { clued: true }).filter((w) => /^[a-z]+$/.test(w) && !plainPlural(w));
  let fallback = null;
  const seeds = rng.deal(pool, 6, 'seed');
  for (let attempt = 0; attempt < 400; attempt++) {
    const first = seeds[attempt % seeds.length];
    const picked = [first];
    // later words share at least one column letter with what's there, so columns stay compact
    for (const w of rng.shuffle(pool)) {
      if (picked.length === s.words) break;
      if (picked.includes(w)) continue;
      const shared = [...w].filter((ch, i) => picked.some((p) => p[i] === ch)).length;
      if (shared >= 1 && shared <= s.len - 2) picked.push(w);
    }
    if (picked.length < s.words) continue;
    const cols = Array.from({ length: s.len }, (_, i) => [...new Set(picked.map((w) => w[i]))]);
    const total = cols.reduce((a, c) => a + c.length, 0);
    if (cols.some((c) => c.length < 2) || total < s.letters[0] || total > s.letters[1]) continue;
    const valid = wordsFrom(cols);
    if (valid.length < s.words + 3) continue; // a few ways in, not just the planted words
    const cover = minCover(cols, valid);
    if (!cover) continue;
    // shuffle each column and pick a start row that doesn't already spell a word
    const shown = cols.map((c) => rng.shuffle(c));
    let start = shown.map((c) => rng.int(c.length));
    for (let t = 0; t < 20 && isWord(start.map((k, i) => shown[i][k]).join(''), ACCEPT_TIER); t++) start = shown.map((c) => rng.int(c.length));
    const puzzle = { cols: shown, start, par: cover.length, cover, planted: picked, count: valid.length };
    if (cover.length >= Math.min(3, s.words - 1)) return puzzle;
    fallback ||= puzzle;
  }
  if (fallback) return fallback;
  throw new Error('typeshift generation failed');
}
