// Hive (Spelling Bee-style): make words from seven letters; every word uses the center letter.
import { allWords, isWord } from '../lib/words.js';

const SETTINGS = {
  easy: { tier: 20, pangramTier: 20, minWords: 12, maxWords: 40 },
  medium: { tier: 35, pangramTier: 20, minWords: 18, maxWords: 60 },
  hard: { tier: 50, pangramTier: 35, minWords: 25, maxWords: 90 },
};

const letterSet = (w) => [...new Set(w)].sort().join('');

export function generateHive(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const dict = allWords(s.tier).filter((w) => w.length >= 4 && !w.includes('s') && new Set(w).size <= 7);
  const pangrams = allWords(s.pangramTier).filter((w) => !w.includes('s') && new Set(w).size === 7);
  const sets = rng.shuffle([...new Set(pangrams.map(letterSet))]);
  const mask = (w) => { let m = 0; for (let i = 0; i < w.length; i++) m |= 1 << (w.charCodeAt(i) - 97); return m; };
  const masks = dict.map(mask);
  let best = null;
  for (const set of sets.slice(0, 200)) {
    const letters = set.split('');
    const sm = mask(set);
    const inSet = [];
    for (let i = 0; i < dict.length; i++) if ((masks[i] & ~sm) === 0) inSet.push(i);
    for (const center of rng.shuffle(letters)) {
      const cb = 1 << (center.charCodeAt(0) - 97);
      const words = inSet.filter((i) => masks[i] & cb).map((i) => dict[i]);
      if (words.length >= s.minWords && words.length <= s.maxWords) {
        best = { center, letters, words };
        break;
      }
    }
    if (best) break;
  }
  if (!best) throw new Error('hive generation failed');
  const outer = rng.shuffle(best.letters.filter((l) => l !== best.center));
  const words = best.words.sort();
  const isPangram = (w) => new Set(w).size === 7;
  const points = (w) => (w.length === 4 ? 1 : w.length) + (isPangram(w) ? 7 : 0);
  const max = words.reduce((a, w) => a + points(w), 0);
  return { center: best.center, outer, words, max };
}

export function hivePoints(w) {
  return (w.length === 4 ? 1 : w.length) + (new Set(w).size === 7 ? 7 : 0);
}
export const hiveIsPangram = (w) => new Set(w).size === 7;
export const hiveKnownWord = (w) => isWord(w, 60);

export const RANKS = [
  ['Starting', 0], ['Good', 0.05], ['Solid', 0.12], ['Nice', 0.2], ['Great', 0.33], ['Amazing', 0.5], ['Genius', 0.7], ['Perfect', 1],
];
export function rankFor(score, max) {
  let r = RANKS[0][0];
  for (const [name, f] of RANKS) if (score >= Math.ceil(f * max)) r = name;
  return r;
}
