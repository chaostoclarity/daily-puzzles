// Weave (Wend-style): hidden words snake through a grid. Each word is a chain of
// side-by-side letters, every letter belongs to exactly one word, and the squares
// no word uses are blocked. Word lengths differ from each other.
import { wordsOf } from '../lib/words.js';

const SETTINGS = {
  easy: { rows: 5, cols: 5, lengths: [3, 4, 5, 6], tier: 20 },
  medium: { rows: 6, cols: 6, lengths: [4, 5, 6, 7, 8], tier: 35 },
  hard: { rows: 7, cols: 7, lengths: [4, 5, 6, 7, 8, 9], tier: 35 },
};

function orth(rows, cols, cell) {
  const r = Math.floor(cell / cols), c = cell % cols, out = [];
  if (r > 0) out.push(cell - cols);
  if (r < rows - 1) out.push(cell + cols);
  if (c > 0) out.push(cell - 1);
  if (c < cols - 1) out.push(cell + 1);
  return out;
}

/** Places chains of the given lengths; returns arrays of cells or null. */
function layout(rows, cols, lengths, rng) {
  const total = rows * cols;
  const owner = new Array(total).fill(-1);
  const paths = [];
  let budget = 4000;
  const freeNb = (c) => orth(rows, cols, c).filter((x) => owner[x] === -1);

  const walk = (start, L) => {
    const p = [start];
    owner[start] = paths.length;
    while (p.length < L) {
      const opts = freeNb(p[p.length - 1]);
      if (!opts.length) break;
      // mostly hug walls and other words (fewest free neighbors), sometimes wander
      opts.sort((a, b) => freeNb(a).length - freeNb(b).length + (rng.next() - 0.5) * 2.2);
      owner[opts[0]] = paths.length;
      p.push(opts[0]);
    }
    if (p.length === L) return p;
    for (const x of p) owner[x] = -1;
    return null;
  };

  const go = (i) => {
    if (i === lengths.length) return true;
    if (--budget < 0) return false;
    let starts;
    if (i === 0) starts = rng.shuffle([...Array(total).keys()]).slice(0, 10);
    else {
      // start next to an existing word so the board stays compact
      const near = new Set();
      for (const p of paths) for (const c of p) for (const nb of orth(rows, cols, c)) if (owner[nb] === -1) near.add(nb);
      starts = rng.shuffle([...near]).slice(0, 10);
    }
    for (const st of starts) {
      for (let t = 0; t < 4; t++) {
        const p = walk(st, lengths[i]);
        if (!p) continue;
        paths.push(p);
        if (go(i + 1)) return true;
        paths.pop();
        for (const x of p) owner[x] = -1;
      }
    }
    return false;
  };
  return go(0) ? paths : null;
}

export function generateWeave(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const lengths = s.lengths.slice().sort((a, b) => b - a); // longest first packs best
  let paths = null;
  for (let i = 0; i < 40 && !paths; i++) paths = layout(s.rows, s.cols, lengths, rng);
  const used = new Set();
  const words = paths.map((p) => {
    const pool = wordsOf(p.length, s.tier).filter((w) => !(w.endsWith('s') && !w.endsWith('ss')));
    let w;
    for (let k = 0; k < 50; k++) { w = rng.pick(pool); if (!used.has(w)) break; }
    used.add(w);
    return { word: w, cells: p };
  });
  const grid = new Array(s.rows * s.cols).fill(null);
  for (const { word, cells } of words) cells.forEach((c, i) => (grid[c] = word[i]));
  return { rows: s.rows, cols: s.cols, grid, words };
}

export { orth as weaveNeighbors };
