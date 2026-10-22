// Letter Square (Letter Boxed-style): twelve letters, three on each side of a square.
// Make words by jumping between sides (never two letters in a row from the same side).
// Each word starts with the last letter of the one before. Use every letter.
import { allWords, isWord } from '../lib/words.js';

const SETTINGS = {
  easy: { tier: 20, par: 6 },
  medium: { tier: 20, par: 5 },
  hard: { tier: 35, par: 4 },
};

const mask = (w) => { let m = 0; for (let i = 0; i < w.length; i++) m |= 1 << (w.charCodeAt(i) - 97); return m; };
const bits = (m) => { let n = 0; for (; m; m &= m - 1) n++; return n; };

function assignSides(letters, words, rng) {
  // letters on the same side may never sit next to each other in a word
  const conflict = new Map(letters.map((l) => [l, new Set()]));
  for (const w of words) for (let i = 1; i < w.length; i++) {
    if (w[i] === w[i - 1]) return null;
    conflict.get(w[i]).add(w[i - 1]); conflict.get(w[i - 1]).add(w[i]);
  }
  const order = rng.shuffle(letters).sort((a, b) => conflict.get(b).size - conflict.get(a).size);
  const side = {};
  const count = [0, 0, 0, 0];
  const go = (i) => {
    if (i === order.length) return true;
    const l = order[i];
    for (const sd of rng.shuffle([0, 1, 2, 3])) {
      if (count[sd] >= 3) continue;
      if ([...conflict.get(l)].some((x) => side[x] === sd)) continue;
      side[l] = sd; count[sd]++;
      if (go(i + 1)) return true;
      delete side[l]; count[sd]--;
    }
    return false;
  };
  if (!go(0)) return null;
  const sides = [[], [], [], []];
  for (const l of letters) sides[side[l]].push(l);
  return sides.map((sd) => rng.shuffle(sd));
}

export function generateLetterbox(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const cands = allWords(s.tier).filter((w) => w.length >= 5 && w.length <= 10 && !/(.)\1/.test(w) && bits(mask(w)) >= 5 && !(w.endsWith('s') && !w.endsWith('ss')));
  const byFirst = new Map();
  for (const w of cands) { if (!byFirst.has(w[0])) byFirst.set(w[0], []); byFirst.get(w[0]).push(w); }
  let budget = 40000;
  for (const w1 of rng.shuffle(cands).slice(0, 4000)) {
    const m1 = mask(w1);
    if (bits(m1) > 11) continue;
    for (const w2 of rng.shuffle(byFirst.get(w1[w1.length - 1]) || [])) {
      if (--budget < 0) break;
      if (w2 === w1) continue;
      const m = m1 | mask(w2);
      if (bits(m) !== 12 || bits(m1 & mask(w2)) > 2) continue;
      const letters = [...new Set(w1 + w2)];
      const sides = assignSides(letters, [w1, w2], rng);
      if (!sides) continue;
      return { sides, solution: [w1, w2], par: s.par };
    }
    if (budget < 0) break;
  }
  throw new Error('letterbox generation failed');
}

/** Why a word can't be played, or null when it can. */
export function letterboxError(puzzle, word, prevWord) {
  const sideOf = {};
  puzzle.sides.forEach((sd, i) => sd.forEach((l) => (sideOf[l] = i)));
  if (word.length < 3) return 'Words need at least 3 letters';
  for (let i = 0; i < word.length; i++) {
    if (sideOf[word[i]] === undefined) return 'Uses a letter that isn\'t on the square';
    if (i > 0 && sideOf[word[i]] === sideOf[word[i - 1]]) return 'Two letters in a row from the same side';
  }
  if (prevWord && word[0] !== prevWord[prevWord.length - 1]) return `Must start with ${prevWord[prevWord.length - 1].toUpperCase()}`;
  if (!isWord(word, 50)) return 'Not in the word list';
  return null;
}
