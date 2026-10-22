// Ladder (Crossclimb-style): a chain of words where each rung changes one letter.
// Solve the clued middle rungs, put them in order, then solve the two ends.
import { wordsOf, clueFor } from '../lib/words.js';

const SETTINGS = {
  easy: { len: 4, rungs: 5, tier: 20, scramble: false, clue: 'def' },
  medium: { len: 4, rungs: 7, tier: 35, scramble: true, clue: 'def' },
  hard: { len: 5, rungs: 7, tier: 35, scramble: true, clue: 'syn' },
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

export function generateLadder(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const key = `${s.len}|${s.tier}`;
  if (!graphs.has(key)) {
    const words = wordsOf(s.len, s.tier, { clued: true }).filter((w) => !(w.endsWith('s') && !w.endsWith('ss')));
    graphs.set(key, buildGraph(words));
  }
  const adj = graphs.get(key);
  const starts = [...adj.keys()].filter((w) => adj.get(w).length >= 2);
  for (let attempt = 0; attempt < 400; attempt++) {
    const chain = [rng.pick(starts)];
    const seen = new Set(chain);
    let lastPos = -1;
    while (chain.length < s.rungs) {
      const cur = chain[chain.length - 1];
      // prefer changing a different letter position than last time
      const opts = rng.shuffle(adj.get(cur).filter((w) => !seen.has(w)));
      const posOf = (w) => [...w].findIndex((ch, i) => ch !== cur[i]);
      const nonAdjacent = (w) => chain.every((x, i) => i >= chain.length - 1 || !oneApart(x, w));
      const pick = opts.find((w) => posOf(w) !== lastPos && nonAdjacent(w)) || opts.find(nonAdjacent);
      if (!pick) break;
      lastPos = posOf(pick);
      chain.push(pick); seen.add(pick);
    }
    if (chain.length < s.rungs) continue;
    const rungs = chain.map((w) => ({ word: w, clue: clueFor(w, s.clue) }));
    const middle = rungs.slice(1, -1).map((r, i) => ({ ...r, order: i }));
    const shown = s.scramble ? rng.shuffle(middle) : middle;
    if (s.scramble && shown.every((r, i) => r.order === i)) shown.reverse();
    return { len: s.len, top: rungs[0], bottom: rungs[rungs.length - 1], middle: shown, scramble: s.scramble };
  }
  throw new Error('ladder generation failed');
}

export { oneApart };
