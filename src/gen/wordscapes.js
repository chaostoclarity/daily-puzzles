// Wordscopes (Wordscapes-style): a wheel of letters and a small crossword of words made
// from them. Swipe letters to spell words; each one fills its spot in the grid.
import { wordsOf, isWord } from '../lib/words.js';

const SETTINGS = {
  easy: { len: 5, tier: 20, min: 3, place: [5, 7], size: 9 },
  medium: { len: 6, tier: 20, min: 3, place: [7, 9], size: 10 },
  hard: { len: 7, tier: 35, min: 4, place: [8, 11], size: 11 },
};
export const ACCEPT_TIER = 50;

const counts = (w) => { const c = {}; for (const ch of w) c[ch] = (c[ch] || 0) + 1; return c; };
export const fits = (w, letters) => { const c = counts(letters); for (const ch of w) { if (!c[ch]) return false; c[ch]--; } return true; };
const plainPlural = (w) => w.endsWith('s') && !w.endsWith('ss');

/** Every accepted word the letters can spell, min length or longer. */
export function spellable(letters, min) {
  const out = [];
  for (let L = min; L <= letters.length; L++) for (const w of wordsOf(L, ACCEPT_TIER)) if (fits(w, letters)) out.push(w);
  return out;
}

/** Greedy crossword layout: every new word crosses one already placed, with clean edges. */
function layout(words, size, rng) {
  const grid = new Map(); // "r,c" -> letter
  const placed = [];
  const key = (r, c) => r + ',' + c;
  const can = (w, r, c, dir) => {
    const dr = dir === 'down' ? 1 : 0, dc = dir === 'down' ? 0 : 1;
    let crosses = 0;
    const er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
    if (r < 0 || c < 0 || er >= size || ec >= size) return false;
    if (grid.has(key(r - dr, c - dc)) || grid.has(key(er + dr, ec + dc))) return false;
    for (let i = 0; i < w.length; i++) {
      const rr = r + dr * i, cc = c + dc * i;
      const g = grid.get(key(rr, cc));
      if (g) { if (g !== w[i]) return false; crosses++; continue; }
      // no side-by-side neighbors along the word
      if (grid.has(key(rr + dc, cc + dr)) || grid.has(key(rr - dc, cc - dr))) return false;
    }
    return crosses > 0 && crosses < w.length;
  };
  const put = (w, r, c, dir) => {
    const dr = dir === 'down' ? 1 : 0, dc = dir === 'down' ? 0 : 1;
    for (let i = 0; i < w.length; i++) grid.set(key(r + dr * i, c + dc * i), w[i]);
    placed.push({ word: w, r, c, dir });
  };
  const first = words[0];
  put(first, Math.floor(size / 2), Math.floor((size - first.length) / 2), 'across');
  for (const w of words.slice(1)) {
    const spots = [];
    for (const p of placed) {
      const dir = p.dir === 'across' ? 'down' : 'across';
      for (let i = 0; i < p.word.length; i++) for (let j = 0; j < w.length; j++) {
        if (p.word[i] !== w[j]) continue;
        const r = p.dir === 'across' ? p.r - j : p.r + i;
        const c = p.dir === 'across' ? p.c + i : p.c - j;
        if (can(w, r, c, dir)) spots.push([r, c, dir]);
      }
    }
    if (spots.length) put(w, ...rng.pick(spots));
  }
  return placed;
}

export function generateWordscapes(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const bases = wordsOf(s.len, s.tier, { clued: true }).filter((w) => /^[a-z]+$/.test(w) && !plainPlural(w));
  let best = null;
  for (const base of rng.deal(bases, 3, 'base').slice(0, 60)) {
    // grid words: common, clued words the letters spell
    const common = [];
    for (let L = s.min; L <= s.len; L++) for (const w of wordsOf(L, s.tier, { clued: true })) if (w !== base && fits(w, base) && !plainPlural(w)) common.push(w);
    if (common.length < s.place[0]) continue;
    const order = [base, ...rng.shuffle(common).sort((a, b) => b.length - a.length).slice(0, s.place[1] * 2)];
    for (let t = 0; t < 6; t++) {
      const placed = layout([order[0], ...rng.shuffle(order.slice(1)).sort((a, b) => b.length - a.length)], s.size, rng).slice(0, s.place[1]);
      if (placed.length < s.place[0]) continue;
      // trim the grid to its used area
      const r0 = Math.min(...placed.map((p) => p.r)), c0 = Math.min(...placed.map((p) => p.c));
      const r1 = Math.max(...placed.map((p) => p.r + (p.dir === 'down' ? p.word.length - 1 : 0)));
      const c1 = Math.max(...placed.map((p) => p.c + (p.dir === 'across' ? p.word.length - 1 : 0)));
      const puzzle = {
        letters: rng.shuffle([...base]), base,
        rows: r1 - r0 + 1, cols: c1 - c0 + 1,
        words: placed.map((p) => ({ ...p, r: p.r - r0, c: p.c - c0 })).sort((a, b) => a.word.length - b.word.length || (a.word < b.word ? -1 : 1)),
        min: s.min,
      };
      if (!best || puzzle.words.length > best.words.length) best = puzzle;
      if (puzzle.words.length >= s.place[0] + 1) return puzzle;
    }
  }
  if (best) return best;
  throw new Error('wordscapes generation failed');
}

export { isWord };
