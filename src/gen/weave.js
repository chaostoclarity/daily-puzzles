// Weave (Wend-style): a letter grid split into hidden words. Each word is a chain of
// side-by-side cells and every letter belongs to exactly one word.
import { wordsOf } from '../lib/words.js';

const SETTINGS = {
  easy: { rows: 4, cols: 4, min: 3, max: 5, tier: 20 },
  medium: { rows: 5, cols: 5, min: 4, max: 6, tier: 35 },
  hard: { rows: 6, cols: 6, min: 4, max: 6, tier: 35 },
};

function orth(rows, cols, cell) {
  const r = Math.floor(cell / cols), c = cell % cols, out = [];
  if (r > 0) out.push(cell - cols);
  if (r < rows - 1) out.push(cell + cols);
  if (c > 0) out.push(cell - 1);
  if (c < cols - 1) out.push(cell + 1);
  return out;
}

function componentsOk(rows, cols, owner, min) {
  const seen = new Uint8Array(rows * cols);
  for (let i = 0; i < rows * cols; i++) {
    if (owner[i] !== -1 || seen[i]) continue;
    let size = 0;
    const stack = [i]; seen[i] = 1;
    while (stack.length) {
      const x = stack.pop(); size++;
      for (const nb of orth(rows, cols, x)) if (owner[nb] === -1 && !seen[nb]) { seen[nb] = 1; stack.push(nb); }
    }
    if (size < min) return false;
  }
  return true;
}

function partition(rows, cols, min, max, rng) {
  const total = rows * cols;
  const owner = new Array(total).fill(-1);
  const paths = [];
  let budget = 20000;
  const place = () => {
    if (--budget < 0) return false;
    const start = owner.indexOf(-1);
    if (start === -1) return true;
    const remaining = owner.filter((x) => x === -1).length;
    const lengths = rng.shuffle([...Array(max - min + 1).keys()].map((k) => k + min)).filter((L) => L <= remaining && (remaining - L === 0 || remaining - L >= min));
    for (const L of lengths) {
      // random self-avoiding walks from start
      for (let t = 0; t < 6; t++) {
        const p = [start];
        owner[start] = paths.length;
        let ok = true;
        while (p.length < L) {
          const opts = rng.shuffle(orth(rows, cols, p[p.length - 1]).filter((x) => owner[x] === -1));
          if (!opts.length) { ok = false; break; }
          owner[opts[0]] = paths.length;
          p.push(opts[0]);
        }
        if (ok && componentsOk(rows, cols, owner, min)) {
          paths.push(p);
          if (place()) return true;
          paths.pop();
        }
        for (const x of p) owner[x] = -1;
        if (budget < 0) return false;
      }
    }
    return false;
  };
  return place() ? paths : null;
}

export function generateWeave(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  let paths = null;
  for (let i = 0; i < 50 && !paths; i++) paths = partition(s.rows, s.cols, s.min, s.max, rng);
  const used = new Set();
  const words = paths.map((p) => {
    const pool = wordsOf(p.length, s.tier, { clued: true }).filter((w) => !(w.endsWith('s') && !w.endsWith('ss')));
    let w;
    for (let k = 0; k < 50; k++) { w = rng.pick(pool); if (!used.has(w)) break; }
    used.add(w);
    return { word: w, cells: p };
  });
  const grid = new Array(s.rows * s.cols);
  for (const { word, cells } of words) cells.forEach((c, i) => (grid[c] = word[i]));
  return { rows: s.rows, cols: s.cols, grid, words };
}

export { orth as weaveNeighbors };
