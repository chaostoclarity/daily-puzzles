// Waffle: six five-letter words woven into a 5x5 grid with four holes.
// Rows 0, 2, 4 read across and columns 0, 2, 4 read down. The letters start scrambled
// and the player swaps tiles back into place within a limited number of swaps.
import { wordsOf } from '../lib/words.js';

export const SIZE = 5;
/** Cells that hold letters: everything except (1,1), (1,3), (3,1), (3,3). */
export const CELLS = Array.from({ length: 25 }, (_, i) => i).filter((i) => !(Math.floor(i / 5) % 2 === 1 && (i % 5) % 2 === 1));
/** The six words, as lists of cell indexes. */
export const LINES = [
  ...[0, 2, 4].map((r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c)),
  ...[0, 2, 4].map((c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c)),
];

const SETTINGS = {
  easy: { tier: 20, swaps: 6, cycles: [3, 4], extra: 6 },
  medium: { tier: 20, swaps: 10, cycles: [3, 5], extra: 5 },
  hard: { tier: 35, swaps: 10, cycles: [4, 6], extra: 5 },
};

const indexes = new Map();
function indexFor(tier) {
  if (!indexes.has(tier)) {
    // real dictionary words, no plain plurals, so the board reads like a real puzzle
    const words = wordsOf(5, tier, { clued: true }).filter((w) => /^[a-z]{5}$/.test(w) && !(w.endsWith('s') && !w.endsWith('ss')));
    const byFirst = new Map(), byOdd = new Map();
    for (const w of words) {
      (byFirst.get(w[0]) || byFirst.set(w[0], []).get(w[0])).push(w);
      const k = w[0] + w[2] + w[4];
      (byOdd.get(k) || byOdd.set(k, []).get(k)).push(w);
    }
    indexes.set(tier, { words, byFirst, byOdd });
  }
  return indexes.get(tier);
}

/** Finds six distinct words that interlock. Returns the 25-cell solution ('' for holes) or null. */
function fill(rng, tier) {
  const { words, byFirst, byOdd } = indexFor(tier);
  let budget = 40000;
  for (const r0 of rng.deal(words, 4, 'w')) {
    const c0s = rng.shuffle(byFirst.get(r0[0]) || []), c2s = rng.shuffle(byFirst.get(r0[2]) || []), c4s = rng.shuffle(byFirst.get(r0[4]) || []);
    for (const c0 of c0s) for (const c2 of c2s) {
      if (--budget < 0) return null;
      for (const c4 of c4s.slice(0, 12)) {
        const r2s = byOdd.get(c0[2] + c2[2] + c4[2]);
        const r4s = byOdd.get(c0[4] + c2[4] + c4[4]);
        if (!r2s || !r4s) continue;
        const used = new Set([r0, c0, c2, c4]);
        if (used.size < 4) continue;
        const r2 = rng.shuffle(r2s).find((w) => !used.has(w));
        if (!r2) continue;
        const r4 = rng.shuffle(r4s).find((w) => !used.has(w) && w !== r2);
        if (!r4) continue;
        const sol = new Array(25).fill('');
        [r0, r2, r4].forEach((w, i) => [...w].forEach((ch, c) => (sol[i * 2 * 5 + c] = ch)));
        [c0, c2, c4].forEach((w, i) => [...w].forEach((ch, r) => (sol[r * 5 + i * 2] = ch)));
        return { sol, words: [r0, r2, r4, c0, c2, c4] };
      }
    }
  }
  return null;
}

/**
 * Fewest swaps to turn `cur` into `sol`. Every misplaced tile is an edge from the letter
 * sitting there to the letter that belongs there; the answer is edges minus the most
 * cycles those edges split into. Small boards make an exact search cheap.
 */
export function minSwaps(cur, sol) {
  const edges = [];
  for (const i of CELLS) if (cur[i] !== sol[i]) edges.push([cur[i], sol[i]]);
  // two-letter swaps first: taking one never hurts
  const pool = edges.slice();
  let cycles = 0;
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i]) continue;
    const j = pool.findIndex((e, k) => k > i && e && e[0] === pool[i][1] && e[1] === pool[i][0]);
    if (j > 0) { pool[i] = null; pool[j] = null; cycles++; }
  }
  const rest = pool.filter(Boolean);
  let best = 0, steps = 0;
  // exact search over the rest: always close a cycle through the first remaining edge
  const search = (es, found) => {
    if (++steps > 20000) return;
    if (!es.length) { best = Math.max(best, found); return; }
    if (found + Math.floor(es.length / 3) + (es.length % 3 ? 1 : 0) <= best) return;
    const [a, b] = es[0];
    const walk = (left, at, used) => {
      if (at === a) { search(left, found + 1); return; }
      const tried = new Set();
      for (let k = 0; k < left.length; k++) {
        const e = left[k];
        if (e[0] !== at || tried.has(e[1])) continue;
        tried.add(e[1]);
        walk(left.slice(0, k).concat(left.slice(k + 1)), e[1], used + 1);
      }
    };
    walk(es.slice(1), b, 1);
  };
  search(rest, 0);
  return edges.length - (cycles + best);
}

export function generateWaffle(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  let fallback = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const f = fill(rng, s.tier);
    if (!f) continue;
    const { sol } = f;
    for (let tries = 0; tries < 40; tries++) {
      // scramble = a permutation made of k cycles over swaps + k cells, so it takes `swaps` swaps
      const k = rng.range(s.cycles[0], s.cycles[1]);
      const m = s.swaps + k;
      const moved = rng.shuffle(CELLS).slice(0, m);
      const sizes = Array(k).fill(2);
      for (let left = m - 2 * k; left > 0; left--) sizes[rng.int(k)]++;
      const cur = sol.slice();
      let at = 0, ok = true;
      for (const len of sizes) {
        const cyc = moved.slice(at, at + len); at += len;
        // rotate letters around the cycle
        for (let i = 0; i < len; i++) cur[cyc[(i + 1) % len]] = sol[cyc[i]];
      }
      for (const i of moved) if (cur[i] === sol[i]) ok = false; // a moved tile must look wrong
      if (!ok) continue;
      const need = minSwaps(cur, sol);
      const puzzle = { sol, start: cur, words: f.words, par: need, swaps: need + s.extra };
      if (need === s.swaps) return puzzle;
      if (!fallback || Math.abs(need - s.swaps) < Math.abs(fallback.par - s.swaps)) fallback = puzzle;
    }
  }
  if (fallback) return fallback;
  throw new Error('waffle generation failed');
}

/**
 * Colors for each cell: 'hit' (right spot), 'near' (belongs elsewhere in a word this tile
 * is part of), 'miss'. Duplicate letters only count as often as the word still needs them.
 */
export function colorsFor(cur, sol) {
  const out = new Array(25).fill('');
  for (const i of CELLS) out[i] = cur[i] === sol[i] ? 'hit' : 'miss';
  for (const line of LINES) {
    const need = {};
    for (const i of line) if (cur[i] !== sol[i]) need[sol[i]] = (need[sol[i]] || 0) + 1;
    for (const i of line) {
      if (cur[i] === sol[i] || out[i] === 'near') continue;
      if (need[cur[i]] > 0) { need[cur[i]]--; out[i] = 'near'; }
    }
  }
  return out;
}
