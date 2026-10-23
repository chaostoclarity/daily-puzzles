// Knatwords (Knotwords-style): a crossword with no clues. The board is split into small
// regions and each region lists the letters that go in it. Fill every square so each
// row and column run spells a word. Puzzles are checked to have exactly one answer.
import { TEMPLATES, fillTemplate, slotsOf } from './mini.js';
import { wordsOf, isWord } from '../lib/words.js';

const SETTINGS = {
  easy: { size: 4, tier: 20, region: [2, 3] },
  medium: { size: 5, tier: 35, region: [2, 4] },
  hard: { size: 5, tier: 35, region: [3, 5] },
};
/** The dictionary for checking uniqueness and accepting answers. */
export const ACCEPT_TIER = 50;

const prefixCache = new Map();
function prefixes(len) {
  if (!prefixCache.has(len)) {
    const set = new Set();
    for (const w of wordsOf(len, ACCEPT_TIER)) for (let k = 1; k <= len; k++) set.add(w.slice(0, k));
    prefixCache.set(len, set);
  }
  return prefixCache.get(len);
}

/**
 * Counts fillings (stopping at `limit`) where every region uses exactly its letters and
 * every run is an accepted word. Fills in reading order so each run is checked as a prefix.
 */
export function countSolutions(n, open, regionOf, regionLetters, slots, limit = 2, budget = 200000) {
  const cells = [];
  for (let i = 0; i < n * n; i++) if (open[i]) cells.push(i);
  const grid = new Array(n * n).fill('');
  const left = regionLetters.map((ls) => { const m = {}; for (const ch of ls) m[ch] = (m[ch] || 0) + 1; return m; });
  const slotsAt = cells.map(() => []);
  const pos = new Map(cells.map((c, k) => [c, k]));
  for (const s of slots) for (const c of s.cells) slotsAt[pos.get(c)].push(s);
  let count = 0;
  const go = (k) => {
    if (count >= limit || --budget < 0) return;
    if (k === cells.length) { count++; return; }
    const c = cells[k];
    const m = left[regionOf[c]];
    for (const ch of Object.keys(m)) {
      if (!m[ch]) continue;
      grid[c] = ch;
      let ok = true;
      for (const s of slotsAt[k]) {
        const upto = s.cells.indexOf(c) + 1;
        if (!prefixes(s.cells.length).has(s.cells.slice(0, upto).map((x) => grid[x]).join(''))) { ok = false; break; }
      }
      if (ok) { m[ch]--; go(k + 1); m[ch]++; }
      grid[c] = '';
    }
  };
  go(0);
  return budget < 0 ? -1 : count;
}

/** Splits the open squares into connected regions of the given sizes. */
function partition(n, open, rng, [lo, hi]) {
  const regionOf = new Array(n * n).fill(-1);
  const nbrs = (i) => [i - n, i + n, i % n ? i - 1 : -1, (i + 1) % n ? i + 1 : -1].filter((j) => j >= 0 && j < n * n && open[j]);
  let id = 0;
  for (const start of rng.shuffle([...Array(n * n).keys()].filter((i) => open[i]))) {
    if (regionOf[start] !== -1) continue;
    const want = rng.range(lo, hi);
    const cells = [start]; regionOf[start] = id;
    while (cells.length < want) {
      const edge = cells.flatMap(nbrs).filter((j) => regionOf[j] === -1);
      if (!edge.length) break;
      const j = rng.pick(edge); regionOf[j] = id; cells.push(j);
    }
    id++;
  }
  // fold any single squares into a neighboring region
  const sizes = {};
  regionOf.forEach((r) => { if (r >= 0) sizes[r] = (sizes[r] || 0) + 1; });
  for (let i = 0; i < n * n; i++) {
    if (!open[i] || sizes[regionOf[i]] !== 1) continue;
    const nb = nbrs(i).sort((a, b) => sizes[regionOf[a]] - sizes[regionOf[b]])[0];
    if (nb === undefined) continue;
    sizes[regionOf[i]]--; regionOf[i] = regionOf[nb]; sizes[regionOf[nb]]++;
  }
  // renumber 0..k-1
  const map = new Map();
  return regionOf.map((r) => (r < 0 ? -1 : (map.has(r) ? map.get(r) : (map.set(r, map.size), map.size - 1))));
}

export function generateKnotwords(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const n = s.size;
  for (let attempt = 0; attempt < 40; attempt++) {
    const tpl = rng.pick(TEMPLATES[n]);
    const filled = fillTemplate(tpl, s.tier, rng, 3000);
    if (!filled) continue;
    const { grid } = filled;
    const open = grid.map((ch) => !!ch);
    const slots = slotsOf(tpl);
    if (!slots.every((sl) => isWord(sl.cells.map((c) => grid[c]).join(''), ACCEPT_TIER))) continue;
    for (let t = 0; t < 12; t++) {
      const regionOf = partition(n, open, rng, s.region);
      const k = Math.max(...regionOf) + 1;
      const regionLetters = Array.from({ length: k }, () => []);
      for (let i = 0; i < n * n; i++) if (open[i]) regionLetters[regionOf[i]].push(grid[i]);
      regionLetters.forEach((ls) => ls.sort());
      if (countSolutions(n, open, regionOf, regionLetters, slots) === 1) {
        return { n, open, regionOf, regions: regionLetters, solution: grid, words: slots.map((sl) => ({ dir: sl.dir, cells: sl.cells })) };
      }
    }
  }
  throw new Error('knotwords generation failed');
}
