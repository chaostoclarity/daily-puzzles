// Threads (Strands-style): every letter in the grid belongs to a theme word. One special
// word, the span, names the theme and stretches from the left edge to the right edge.
// Words bend in any of eight directions but never cross.
import { tier } from '../lib/words.js';
import { getCategories } from './groups.js';

const SETTINGS = {
  easy: { cols: 5, rows: 6, tier: 35, first: true },
  medium: { cols: 6, rows: 7, tier: 50, first: true },
  hard: { cols: 6, rows: 8, tier: 50, first: false },
};

const plural = (w) => (/(s|x|z|ch|sh)$/.test(w) ? w + 'es' : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : w + 's');

function nbrs8(rows, cols, c) {
  const r = Math.floor(c / cols), k = c % cols, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dk = -1; dk <= 1; dk++) {
    if (!dr && !dk) continue;
    const rr = r + dr, kk = k + dk;
    if (rr >= 0 && rr < rows && kk >= 0 && kk < cols) out.push(rr * cols + kk);
  }
  return out;
}

/** Board bookkeeping for non-crossing paths. */
function makeBoard(rows, cols) {
  const owner = new Array(rows * cols).fill(-1);
  const diag = new Set(); // "a-b" diagonal links in use
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const crosses = (a, b) => {
    const ra = Math.floor(a / cols), ka = a % cols, rb = Math.floor(b / cols), kb = b % cols;
    if (ra === rb || ka === kb) return false;
    return diag.has(key(ra * cols + kb, rb * cols + ka));
  };
  const link = (a, b) => { if (Math.floor(a / cols) !== Math.floor(b / cols) && a % cols !== b % cols) diag.add(key(a, b)); };
  const unlink = (a, b) => diag.delete(key(a, b));
  return { owner, crosses, link, unlink };
}

function componentsOk(rows, cols, owner, min) {
  const seen = new Uint8Array(rows * cols);
  for (let i = 0; i < rows * cols; i++) {
    if (owner[i] !== -1 || seen[i]) continue;
    let size = 0; const st = [i]; seen[i] = 1;
    while (st.length) { const x = st.pop(); size++; for (const nb of nbrs8(rows, cols, x)) if (owner[nb] === -1 && !seen[nb]) { seen[nb] = 1; st.push(nb); } }
    if (size < min) return false;
  }
  return true;
}

function layout(rows, cols, spanLen, lengths, rng) {
  const b = makeBoard(rows, cols);
  const paths = [];
  let budget = 6000;
  // 1. the span: left edge to right edge
  const spanTry = () => {
    for (let t = 0; t < 60; t++) {
      const start = rng.range(0, rows - 1) * cols;
      const p = [start]; b.owner[start] = 0;
      let ok = true;
      while (p.length < spanLen) {
        const cur = p[p.length - 1];
        const left = spanLen - p.length; // letters still to place
        const opts = rng.shuffle(nbrs8(rows, cols, cur).filter((x) => b.owner[x] === -1 && !b.crosses(cur, x)
          && (cols - 1 - (x % cols)) <= left - 1 && (p.length + 1 < spanLen || x % cols === cols - 1)));
        // mostly head right
        opts.sort((x, y) => (y % cols) - (x % cols) + (rng.next() - 0.5) * 2);
        if (!opts.length) { ok = false; break; }
        b.link(cur, opts[0]); b.owner[opts[0]] = 0; p.push(opts[0]);
      }
      if (ok && p[p.length - 1] % cols === cols - 1 && componentsOk(rows, cols, b.owner, 4)) { paths.push(p); return true; }
      for (let i = 1; i < p.length; i++) b.unlink(p[i - 1], p[i]);
      for (const x of p) b.owner[x] = -1;
    }
    return false;
  };
  if (!spanTry()) return null;
  // 2. fill the rest with theme-word paths
  const place = () => {
    if (--budget < 0) return false;
    const start = b.owner.indexOf(-1);
    if (start === -1) return true;
    const remaining = b.owner.filter((x) => x === -1).length;
    const lens = rng.shuffle(lengths).filter((L) => L <= remaining && (remaining - L === 0 || remaining - L >= 4));
    for (const L of [...new Set(lens)]) {
      for (let t = 0; t < 5; t++) {
        const p = [start]; b.owner[start] = paths.length;
        let ok = true;
        while (p.length < L) {
          const cur = p[p.length - 1];
          const opts = rng.shuffle(nbrs8(rows, cols, cur).filter((x) => b.owner[x] === -1 && !b.crosses(cur, x)));
          if (!opts.length) { ok = false; break; }
          b.link(cur, opts[0]); b.owner[opts[0]] = paths.length; p.push(opts[0]);
        }
        if (ok && componentsOk(rows, cols, b.owner, 4)) {
          paths.push(p);
          if (place()) return true;
          paths.pop();
        }
        for (let i = 1; i < p.length; i++) b.unlink(p[i - 1], p[i]);
        for (const x of p) b.owner[x] = -1;
        if (budget < 0) return false;
      }
    }
    return false;
  };
  return place() ? paths : null;
}

export function generateThreads(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const cats = getCategories().filter((c) => c.k === 'kind');
  const total = s.rows * s.cols;
  for (const c of rng.shuffle(cats)) {
    const span = plural(c.n.replace(/ /g, ''));
    if (span.length < s.cols || span.length > Math.min(12, total - 8)) continue;
    const pool = (s.first ? c.f : c.w).filter((w) => (tier(w) ?? 99) <= s.tier && w.length >= 4 && w.length <= 8 && !span.includes(w));
    if (pool.length < Math.ceil((total - span.length) / 6) + 2) continue;
    const byLen = {};
    for (const w of pool) (byLen[w.length] ||= []).push(w);
    const lengths = Object.keys(byLen).map(Number);
    for (let attempt = 0; attempt < 6; attempt++) {
      const paths = layout(s.rows, s.cols, span.length, lengths, rng);
      if (!paths) continue;
      // assign distinct words by length
      const left = Object.fromEntries(Object.entries(byLen).map(([k, v]) => [k, rng.shuffle(v)]));
      const words = [{ word: span, cells: paths[0], span: true }];
      let ok = true;
      for (const p of paths.slice(1)) {
        const w = left[p.length]?.pop();
        if (!w) { ok = false; break; }
        words.push({ word: w, cells: p, span: false });
      }
      if (!ok) continue;
      const grid = new Array(total);
      for (const { word, cells } of words) cells.forEach((cell, i) => (grid[cell] = word[i]));
      return { rows: s.rows, cols: s.cols, grid, words, theme: c.g ? c.g[0].toUpperCase() + c.g.slice(1) : `Kinds of ${c.n}`, name: c.n };
    }
  }
  throw new Error('threads generation failed');
}

export { nbrs8 as threadsNeighbors };
