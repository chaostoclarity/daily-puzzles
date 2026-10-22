// Ladder (Crossclimb-style): a chain of words where each rung changes one letter.
// Solve the clued middle rungs, put them in order, then solve the two ends.
import { wordsOf, clueFor } from '../lib/words.js';

const SETTINGS = {
  easy: { len: 4, rungs: 5, tier: 35, scramble: false, clue: 'def' },
  medium: { len: 4, rungs: 7, tier: 35, scramble: true, clue: 'def' },
  hard: { len: 4, rungs: 8, tier: 35, scramble: true, clue: 'syn' },
};

const oneApart = (a, b) => {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++d > 1) return false;
  return d === 1;
};

function buildGraph(words) {
  const buckets = new Map();
  for (const w of words) for (let i = 0; i < w.length; i++) {
    const k = w.slice(0, i) + '_' + w.slice(i + 1);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(w);
  }
  const adj = new Map(words.map((w) => [w, []]));
  for (const list of buckets.values()) for (const a of list) for (const b of list) if (a !== b) adj.get(a).push(b);
  return adj;
}

const graphs = new Map();
let compounds = [];
/** Compound words for the ends: [top, bottom, clue, closed]. */
export function initCompounds(data) { compounds = data; }

function graphFor(s) {
  const key = `${s.len}|${s.tier}`;
  if (!graphs.has(key)) {
    const words = wordsOf(s.len, s.tier, { clued: true }).filter((w) => !(w.endsWith('s') && !w.endsWith('ss')));
    graphs.set(key, buildGraph(words));
  }
  return graphs.get(key);
}

/** Neighbors of any word (in the graph or not) among the graph's words. */
function neighborsOf(adj, w) {
  if (adj.has(w)) return adj.get(w);
  const out = [];
  for (const x of adj.keys()) if (oneApart(w, x)) out.push(x);
  return out;
}

export function generateLadder(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const adj = graphFor(s);
  const mids = s.rungs - 2;
  const pool = rng.shuffle(compounds.filter((c) => c[0].length === s.len));
  for (const [top, bottom, compoundClue] of pool) {
    const nbTop = neighborsOf(adj, top).filter((w) => w !== bottom);
    const nbBottom = new Set(neighborsOf(adj, bottom).filter((w) => w !== top));
    if (!nbTop.length || !nbBottom.size) continue;
    // distance (in steps) from each word to the bottom word
    const dist = new Map();
    let frontier = [...nbBottom];
    frontier.forEach((w) => dist.set(w, 1));
    for (let d = 2; d <= mids && frontier.length; d++) {
      const next = [];
      for (const w of frontier) for (const x of adj.get(w) || []) if (!dist.has(x) && x !== top && x !== bottom) { dist.set(x, d); next.push(x); }
      frontier = next;
    }
    let budget = 3000;
    const chain = [];
    const used = new Set([top, bottom]);
    const clean = (w) => chain.every((x, i) => i >= chain.length - 1 || !oneApart(x, w)) && (chain.length === 0 || !oneApart(top, w)) ;
    const go = (prev) => {
      if (--budget < 0) return false;
      if (chain.length === mids) return nbBottom.has(prev);
      const left = mids - chain.length; // steps still to take before reaching bottom
      const opts = rng.shuffle((chain.length === 0 ? nbTop : adj.get(prev) || []).filter((w) => !used.has(w) && (dist.get(w) ?? 99) <= left));
      // prefer rungs that touch only their neighbors, so the order is unambiguous
      opts.sort((a, b) => (clean(b) ? 1 : 0) - (clean(a) ? 1 : 0));
      for (const w of opts) {
        chain.push(w); used.add(w);
        if (go(w)) return true;
        chain.pop(); used.delete(w);
      }
      return false;
    };
    if (!go(top)) continue;
    const middle = chain.map((w, i) => ({ word: w, clue: clueFor(w, s.clue), order: i }));
    const shown = s.scramble ? rng.shuffle(middle) : middle;
    if (s.scramble && shown.every((r, i) => r.order === i)) shown.reverse();
    return {
      len: s.len,
      top: { word: top, clue: compoundClue },
      bottom: { word: bottom, clue: compoundClue },
      compoundClue,
      middle: shown,
      scramble: s.scramble,
    };
  }
  throw new Error('ladder generation failed');
}

export { oneApart };
