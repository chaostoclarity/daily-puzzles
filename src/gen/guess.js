// Word Guess (Wordle-style): find the hidden word in six tries with color feedback.
import { wordsOf, isWord } from '../lib/words.js';

const SETTINGS = {
  easy: { len: 4, tier: 20, tries: 6, strict: false },
  medium: { len: 5, tier: 20, tries: 6, strict: false },
  hard: { len: 5, tier: 35, tries: 6, strict: true },
};

export function generateGuess(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const pool = wordsOf(s.len, s.tier, { clued: true }).filter((w) => !(w.endsWith('s') && !w.endsWith('ss')));
  return { answer: rng.deal(pool, 1, 'a')[0], len: s.len, tries: s.tries, strict: s.strict };
}

export const validGuess = (w) => isWord(w, 60);

/** Per-letter result: 2 = right spot, 1 = in word elsewhere, 0 = not in word. Handles repeats. */
export function score(guess, answer) {
  const res = new Array(guess.length).fill(0);
  const counts = {};
  for (let i = 0; i < answer.length; i++) if (guess[i] !== answer[i]) counts[answer[i]] = (counts[answer[i]] || 0) + 1;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) res[i] = 2;
    else if (counts[guess[i]]) { res[i] = 1; counts[guess[i]]--; }
  }
  return res;
}

/** Strict mode: revealed hints must be used in later guesses. Returns an error message or null. */
export function strictError(guess, history) {
  for (const { word, marks } of history) {
    for (let i = 0; i < word.length; i++) {
      if (marks[i] === 2 && guess[i] !== word[i]) return `Letter ${i + 1} must be ${word[i].toUpperCase()}`;
    }
    for (let i = 0; i < word.length; i++) {
      if (marks[i] === 1) {
        const need = [...word].filter((ch, j) => ch === word[i] && marks[j] > 0).length;
        const have = [...guess].filter((ch) => ch === word[i]).length;
        if (have < need) return `Guess must contain ${word[i].toUpperCase()}`;
      }
    }
  }
  return null;
}
