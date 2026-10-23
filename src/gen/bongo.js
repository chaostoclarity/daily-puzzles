// Bango (Bongo-style): place 25 of 26 letter tiles on a 5x5 board. Each row scores its best
// word of three to five letters (letter values times square bonuses). The shaded snake,
// one square per row, spells a bonus word. Common words earn 30% more.
import { wordsOf, tier, isWord } from '../lib/words.js';

const SETTINGS = {
  easy: { tier: 20, bonus2: 2, bonus3: 1 },
  medium: { tier: 20, bonus2: 3, bonus3: 2 },
  hard: { tier: 35, bonus2: 3, bonus3: 2 },
};
export const ACCEPT_TIER = 50;
export const COMMON_TIER = 20;

// rarer letters are worth more (shape follows Bongo's published examples)
export const VALUES = {
  a: 5, e: 5, i: 6, o: 7, s: 5, r: 7, t: 10, n: 8, l: 10, u: 12,
  d: 30, c: 35, p: 35, m: 30, h: 40, g: 35, y: 35, b: 45, f: 45, w: 45,
  k: 60, v: 85, x: 90, j: 95, q: 100, z: 100,
};

const plainPlural = (w) => w.endsWith('s') && !w.endsWith('ss');

/** Best-scoring word in a row: any run of 3 to 5 placed tiles that spells an accepted word. */
export function rowWord(letters, mults) {
  let best = null;
  for (let a = 0; a < 5; a++) for (let b = a + 3; b <= 5; b++) {
    const run = letters.slice(a, b);
    if (run.some((ch) => !ch)) continue;
    const w = run.join('');
    if (!isWord(w, ACCEPT_TIER)) continue;
    let pts = 0;
    for (let k = a; k < b; k++) pts += VALUES[letters[k]] * mults[k];
    if ((tier(w) ?? 99) <= COMMON_TIER) pts = Math.round(pts * 1.3);
    if (!best || pts > best.points) best = { word: w, start: a, end: b, points: pts };
  }
  return best;
}

/** The snake's bonus word: no square bonuses, 30% more if common. */
export function snakeWord(letters) {
  if (letters.some((ch) => !ch)) return null;
  const w = letters.join('');
  if (!isWord(w, ACCEPT_TIER)) return null;
  let pts = [...w].reduce((a, ch) => a + VALUES[ch], 0);
  if ((tier(w) ?? 99) <= COMMON_TIER) pts = Math.round(pts * 1.3);
  return { word: w, points: pts };
}

export function scoreBoard(p, grid) {
  const rows = [0, 1, 2, 3, 4].map((r) => rowWord(grid.slice(r * 5, r * 5 + 5), p.mult.slice(r * 5, r * 5 + 5)));
  const snake = snakeWord(p.snake.map((c, r) => grid[r * 5 + c]));
  return { rows, snake, total: rows.reduce((a, x) => a + (x ? x.points : 0), 0) + (snake ? snake.points : 0) };
}

export function generateBongo(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const five = wordsOf(5, s.tier, { clued: true }).filter((w) => /^[a-z]{5}$/.test(w) && !plainPlural(w));
  const byPos = Array.from({ length: 5 }, () => new Map());
  for (const w of five) for (let k = 0; k < 5; k++) { const m = byPos[k]; if (!m.has(w[k])) m.set(w[k], []); m.get(w[k]).push(w); }
  for (const snakeW of rng.deal(five, 3, 'snake').slice(0, 100)) {
    // the snake wanders: each row's square is in the same column or one over
    const cols = [rng.int(5)];
    for (let r = 1; r < 5; r++) cols.push(Math.max(0, Math.min(4, cols[r - 1] + rng.pick([-1, 0, 1]))));
    const rows = [];
    let ok = true;
    for (let r = 0; r < 5; r++) {
      const opts = (byPos[cols[r]].get(snakeW[r]) || []).filter((w) => w !== snakeW && !rows.includes(w));
      if (!opts.length) { ok = false; break; }
      // prefer rows with a pricier letter or two, so placement matters
      const pick = rng.shuffle(opts).slice(0, 12).sort((a, b) => [...b].reduce((t, ch) => t + VALUES[ch], 0) - [...a].reduce((t, ch) => t + VALUES[ch], 0))[rng.int(3)];
      rows.push(pick || opts[0]);
    }
    if (!ok) continue;
    const solution = rows.join('').split('');
    const mult = new Array(25).fill(1);
    const free = rng.shuffle([...Array(25).keys()].filter((i) => cols[Math.floor(i / 5)] !== i % 5));
    free.slice(0, s.bonus2).forEach((i) => (mult[i] = 2));
    free.slice(s.bonus2, s.bonus2 + s.bonus3).forEach((i) => (mult[i] = 3));
    // one extra decoy tile, a common letter
    const extra = rng.pick('aeiorstnl'.split(''));
    const tiles = rng.shuffle([...solution, extra]);
    const p = { snake: cols, mult, tiles, solution, rows, snakeWord: snakeW };
    p.target = scoreBoard(p, solution).total;
    return p;
  }
  throw new Error('bongo generation failed');
}
