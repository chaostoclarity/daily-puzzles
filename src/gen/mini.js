// Mini crossword: fills a small grid template with real words, then clues each entry.
import { wordsOf, clueFor } from '../lib/words.js';

const TEMPLATES = {
  7: [
    ['...#...', '...#...', '.......', '##...##', '.......', '...#...', '...#...'],
    ['##...##', '#.....#', '.......', '...#...', '.......', '#.....#', '##...##'],
    ['#...###', '#....##', '.......', '...#...', '.......', '##....#', '###...#'],
  ],
  4: [
    ['#...', '....', '....', '...#'],
    ['....', '....', '....', '....'],
    ['....', '....', '....', '...#'],
    ['...#', '....', '....', '#...'],
    ['#...', '....', '....', '....'],
  ],
  5: [
    ['#....', '.....', '.....', '.....', '....#'],
    ['##...', '#....', '.....', '....#', '...##'],
    ['#...#', '.....', '.....', '.....', '#...#'],
    ['...##', '....#', '.....', '#....', '##...'],
    ['##...', '.....', '.....', '.....', '...##'],
    ['#....', '#....', '.....', '....#', '....#'],
  ],
};

const MIDI = {
  easy: { size: 7, tier: 35, clue: 'def' },
  medium: { size: 7, tier: 35, clue: 'def' },
  hard: { size: 7, tier: 50, clue: 'syn' },
};

const SETTINGS = {
  easy: { size: 4, tier: 35, clue: 'def' },
  medium: { size: 5, tier: 35, clue: 'def' },
  hard: { size: 5, tier: 50, clue: 'syn' },
};

function slotsOf(tpl) {
  const n = tpl.length;
  const open = (r, c) => r >= 0 && c >= 0 && r < n && c < n && tpl[r][c] === '.';
  const slots = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!open(r, c)) continue;
    if (!open(r, c - 1) && open(r, c + 1)) {
      const cells = []; let k = c;
      while (open(r, k)) cells.push(r * n + k++);
      slots.push({ dir: 'across', cells, r, c });
    }
    if (!open(r - 1, c) && open(r + 1, c)) {
      const cells = []; let k = r;
      while (open(k, c)) cells.push(k++ * n + c);
      slots.push({ dir: 'down', cells, r, c });
    }
  }
  return slots;
}

function buildIndex(words) {
  // index[pos][letter] = Set of word indices
  const len = words.length ? words[0].length : 0;
  const idx = Array.from({ length: len }, () => new Map());
  words.forEach((w, i) => {
    for (let p = 0; p < len; p++) {
      const m = idx[p];
      if (!m.has(w[p])) m.set(w[p], []);
      m.get(w[p]).push(i);
    }
  });
  return idx;
}

const indexCache = new Map();
function lexicon(len, tier) {
  const key = `${len}|${tier}`;
  if (!indexCache.has(key)) {
    const words = wordsOf(len, tier, { clued: true });
    indexCache.set(key, { words, idx: buildIndex(words) });
  }
  return indexCache.get(key);
}

function candidates(lex, pattern) {
  let best = null;
  for (let p = 0; p < pattern.length; p++) {
    const ch = pattern[p];
    if (!ch) continue;
    const list = lex.idx[p].get(ch) || [];
    if (!best || list.length < best.length) best = list;
  }
  const base = best || lex.words.map((_, i) => i);
  const out = [];
  for (const i of base) {
    const w = lex.words[i];
    let ok = true;
    for (let p = 0; p < pattern.length; p++) if (pattern[p] && pattern[p] !== w[p]) { ok = false; break; }
    if (ok) out.push(w);
  }
  return out;
}

function fill(tpl, tier, rng, budget) {
  // step budget (not a clock) keeps results identical on fast and slow devices
  const n = tpl.length;
  const slots = slotsOf(tpl);
  const grid = new Array(n * n).fill('');
  const assigned = new Array(slots.length).fill(null);
  const used = new Set();
  const lexFor = (s) => lexicon(s.cells.length, tier);
  const pattern = (s) => s.cells.map((c) => grid[c]);
  const go = () => {
    if (--budget < 0) return false;
    // most constrained open slot
    let bestI = -1, bestC = null;
    for (let i = 0; i < slots.length; i++) {
      if (assigned[i]) continue;
      const c = candidates(lexFor(slots[i]), pattern(slots[i])).filter((w) => !used.has(w));
      if (c.length === 0) return false;
      if (!bestC || c.length < bestC.length) { bestI = i; bestC = c; }
    }
    if (bestI === -1) return true;
    const s = slots[bestI];
    const tries = rng.shuffle(bestC).slice(0, 40);
    for (const w of tries) {
      const prev = s.cells.map((c) => grid[c]);
      s.cells.forEach((c, k) => (grid[c] = w[k]));
      assigned[bestI] = w; used.add(w);
      if (go()) return true;
      used.delete(w); assigned[bestI] = null;
      s.cells.forEach((c, k) => (grid[c] = prev[k]));
    }
    return false;
  };
  if (!go()) return null;
  return { slots, assigned, grid };
}

export function generateMidi(rng, difficulty = 'medium') {
  return build(rng, MIDI[difficulty] || MIDI.medium, 12000);
}

export function generateMini(rng, difficulty = 'medium') {
  return build(rng, SETTINGS[difficulty] || SETTINGS.medium, 3000);
}

function build(rng, s, stepBudget) {
  const templates = TEMPLATES[s.size];
  for (let attempt = 0; attempt < 30; attempt++) {
    const tpl = rng.pick(templates);
    const res = fill(tpl, s.tier, rng, stepBudget);
    if (!res) continue;
    const n = tpl.length;
    // numbering in reading order
    const numAt = {};
    let num = 0;
    const order = res.slots.map((sl, i) => ({ ...sl, word: res.assigned[i] })).sort((a, b) => a.cells[0] - b.cells[0]);
    for (const sl of order) if (numAt[sl.cells[0]] === undefined) numAt[sl.cells[0]] = ++num;
    const clues = order.map((sl) => ({ num: numAt[sl.cells[0]], dir: sl.dir, cells: sl.cells, answer: sl.word, clue: clueFor(sl.word, s.clue) }));
    clues.sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === 'across' ? -1 : 1));
    const blocks = [];
    for (let i = 0; i < n * n; i++) if (tpl[Math.floor(i / n)][i % n] === '#') blocks.push(i);
    return { n, blocks, solution: res.grid, numAt, clues };
  }
  throw new Error('mini generation failed');
}

/** Shared with Knatwords, which fills the same templates and hides the clues. */
export { TEMPLATES, fill as fillTemplate, slotsOf };
