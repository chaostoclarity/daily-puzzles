// Word lists by commonness tier (10 = most common, 60 = rare) plus dictionary clues.
// Call initWords() once with the JSON data before using anything else here.

const TIERS = [10, 20, 35, 40, 50, 55, 60];
let tierOf = new Map();
let clueMap = {};
const cache = new Map();

export function initWords(wordsJson, cluesJson) {
  tierOf = new Map();
  for (const t of TIERS) {
    const s = wordsJson[t];
    if (!s) continue;
    for (const w of s.split(' ')) tierOf.set(w, t);
  }
  clueMap = cluesJson;
  cache.clear();
}

export const tier = (w) => tierOf.get(w);
export const isWord = (w, maxTier = 60) => {
  const t = tierOf.get(w);
  return t !== undefined && t <= maxTier;
};

/** Words of a length up to a tier. opts.clued limits to dictionary headwords that have a clue. */
export function wordsOf(len, maxTier, opts = {}) {
  const key = `${len}|${maxTier}|${opts.clued ? 1 : 0}`;
  if (cache.has(key)) return cache.get(key);
  const out = [];
  for (const [w, t] of tierOf) {
    if (w.length !== len || t > maxTier) continue;
    if (opts.clued && !clueMap[w]) continue;
    out.push(w);
  }
  out.sort();
  cache.set(key, out);
  return out;
}

export function allWords(maxTier) {
  const key = `all|${maxTier}`;
  if (cache.has(key)) return cache.get(key);
  const out = [];
  for (const [w, t] of tierOf) if (t <= maxTier) out.push(w);
  cache.set(key, out);
  return out;
}

/** A clue for a word. style 'syn' prefers a one-word synonym when the dictionary has one. */
export function clueFor(w, style = 'def') {
  const c = clueMap[w];
  if (!c) return null;
  if (style === 'syn' && c[1]) return c[1];
  return c[0];
}
export const hasClue = (w) => !!clueMap[w];
