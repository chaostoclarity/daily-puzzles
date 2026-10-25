// Pile-Up Pokar (Pile-Up Poker-style): cards are dealt in hands of five (six on Hard).
// Place all but one into the grid and the last onto the discard pile. Rows, columns,
// the corners and the discard pile each score as a poker hand.
//
// Rules follow Puzzmo's game as documented by players: 4x4 grid, a 36-card deck (6 to A),
// four deals of five, 4-card hands, corners x2, discard x3 (only when every other line
// scores), and a multiplier of floor(hands / 2) + 1. Hard is the 5x5 "Pro" version: full
// deck plus a joker, six-card deals, 5-card hands, the center joins the corners, and the
// multiplier is floor(hands / 2).

export const RANKS = '23456789TJQKA';
export const SUITS = ['s', 'h', 'd', 'c'];
export const JOKER = 'W*';

const SETTINGS = {
  easy: { size: 4, low: 4, joker: false, preview: true, runs: 40 },
  medium: { size: 4, low: 4, joker: false, preview: false, runs: 40 },
  hard: { size: 5, low: 0, joker: true, preview: false, runs: 20 },
};

export const POINTS = { pair: 5, twopair: 60, flush: 80, trips: 125, straight: 180, fullhouse: 230, quads: 325, straightflush: 450 };
export const LABEL = { pair: 'Pair', twopair: 'Two pair', flush: 'Flush', trips: 'Three of a kind', straight: 'Straight', fullhouse: 'Full house', quads: 'Four of a kind', straightflush: 'Straight flush' };

/** Best named hand for a full line of cards ('As', 'Td', 'W*'), or null. */
export function handOf(cards) {
  const j = cards.indexOf(JOKER);
  if (j >= 0) {
    let best = null;
    for (const r of RANKS) for (const s of SUITS) {
      const h = handOf(cards.map((c, k) => (k === j ? r + s : c)));
      if (h && (!best || POINTS[h] > POINTS[best])) best = h;
    }
    return best;
  }
  const ranks = cards.map((c) => RANKS.indexOf(c[0]));
  const flush = cards.every((c) => c[1] === cards[0][1]);
  const counts = Object.values(ranks.reduce((m, r) => ((m[r] = (m[r] || 0) + 1), m), {})).sort((a, b) => b - a);
  const distinct = new Set(ranks).size === ranks.length;
  const sorted = [...ranks].sort((a, b) => a - b);
  const run = (rs) => rs.every((r, i) => i === 0 || r === rs[i - 1] + 1);
  const aceLow = sorted.includes(12) && run([-1, ...sorted.filter((r) => r !== 12)]);
  const straight = distinct && (run(sorted) || aceLow);
  if (straight && flush) return 'straightflush';
  if (counts[0] === 4) return 'quads';
  if (counts[0] === 3 && counts[1] === 2) return 'fullhouse';
  if (straight) return 'straight';
  if (counts[0] === 3) return 'trips';
  if (flush) return 'flush';
  if (counts[0] === 2 && counts[1] === 2) return 'twopair';
  if (counts[0] === 2) return 'pair';
  return null;
}

/** The lines that score: rows, columns, corners (plus center on 5x5), then discards. */
export function linesOf(n) {
  const rows = Array.from({ length: n }, (_, r) => ({ kind: 'row', idx: r, cells: Array.from({ length: n }, (_, c) => r * n + c) }));
  const cols = Array.from({ length: n }, (_, c) => ({ kind: 'col', idx: c, cells: Array.from({ length: n }, (_, r) => r * n + c) }));
  const corners = [0, n - 1, n * (n - 1), n * n - 1];
  if (n === 5) corners.push(12);
  return [...rows, ...cols, { kind: 'corners', idx: 0, cells: corners }];
}

/** Scores a finished or partial board. grid: n*n cards ('' if empty); discards: up to n cards. */
export function scoreBoard(n, grid, discards) {
  const lines = linesOf(n).map((l) => {
    const cards = l.cells.map((i) => grid[i]);
    const hand = cards.every(Boolean) ? handOf(cards) : null;
    return { ...l, hand, base: hand ? POINTS[hand] : 0, mult: l.kind === 'corners' ? 2 : 1 };
  });
  const allOthers = lines.every((l) => l.hand);
  const dHand = discards.length === n ? handOf(discards) : null;
  lines.push({ kind: 'discard', idx: 0, hand: dHand, base: dHand && allOthers ? POINTS[dHand] : 0, mult: 3, blocked: !!dHand && !allOthers });
  const scored = lines.filter((l) => l.base > 0).length;
  const handMult = Math.max(1, n === 4 ? Math.floor(scored / 2) + 1 : Math.floor(scored / 2));
  for (const l of lines) l.points = l.base * l.mult * handMult;
  return { lines, handMult, total: lines.reduce((a, l) => a + l.points, 0) };
}

/** Rough promise of a line still being filled, used by the practice bot and hints. */
function lineHope(cards, n) {
  const have = cards.filter(Boolean);
  if (have.length === n) { const hnd = handOf(have); return hnd ? POINTS[hnd] : -40; }
  if (have.length < 2) return 0;
  const real = have.filter((c) => c !== JOKER);
  const counts = {};
  for (const c of real) counts[c[0]] = (counts[c[0]] || 0) + 1;
  const vals = Object.values(counts).sort((a, b) => b - a);
  let v = 0;
  if (vals[0] >= 4) v += 250; else if (vals[0] === 3) v += 90; else if (vals[0] === 2) v += vals[1] === 2 ? 45 : 12;
  if (real.every((c) => c[1] === real[0][1])) v += 14 * have.length;
  const ranks = real.map((c) => RANKS.indexOf(c[0]));
  if (new Set(ranks).size === ranks.length && Math.max(...ranks) - Math.min(...ranks) <= n - 1) v += 12 * have.length;
  if (have.length > real.length) v += 30;
  return v;
}

/** Potential of a whole board: every line, corners doubled, discards tripled. */
export function boardHope(n, grid, discards) {
  let v = 0;
  for (const l of linesOf(n)) v += lineHope(l.cells.map((i) => grid[i]), n) * (l.kind === 'corners' ? 2 : 1);
  return v + lineHope(discards, n) * 1.5;
}

/** One noisy greedy playthrough of the deals; returns the final score. Only lines touched by a
 *  move are re-scored, which keeps a few dozen playthroughs fast enough for phones. */
function botGame(n, deals, rng, noise) {
  const grid = new Array(n * n).fill('');
  const discards = [];
  const lines = linesOf(n);
  const byCell = Array.from({ length: n * n }, () => []);
  lines.forEach((l) => l.cells.forEach((c) => byCell[c].push(l)));
  const lineVal = (l) => lineHope(l.cells.map((i) => grid[i]), n) * (l.kind === 'corners' ? 2 : 1);
  for (const deal of deals) {
    const hand = deal.slice();
    let toGrid = n, discarded = false;
    while (hand.length) {
      let best = null;
      const dBase = lineHope(discards, n) * 1.5;
      hand.forEach((card, k) => {
        if (toGrid > 0) grid.forEach((c, i) => {
          if (c) return;
          const ls = byCell[i];
          let before = 0, after = 0;
          for (const l of ls) before += lineVal(l);
          grid[i] = card;
          for (const l of ls) after += lineVal(l);
          grid[i] = '';
          const v = after - before + rng.next() * noise;
          if (!best || v > best.v) best = { v, k, i };
        });
        if (!discarded) {
          discards.push(card); const v = lineHope(discards, n) * 1.5 - dBase + rng.next() * noise - (toGrid > 0 && hand.length > 1 ? 6 : -1000); discards.pop();
          if (!best || v > best.v) best = { v, k, i: -1 };
        }
      });
      const card = hand.splice(best.k, 1)[0];
      if (best.i < 0) { discards.push(card); discarded = true; } else { grid[best.i] = card; toGrid--; }
    }
  }
  return scoreBoard(n, grid, discards).total;
}

export function generatePileup(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const deck = [];
  for (const r of RANKS.slice(s.low)) for (const su of SUITS) deck.push(r + su);
  if (s.joker) deck.push(JOKER);
  const per = s.size + 1;
  const cards = rng.shuffle(deck).slice(0, per * s.size);
  const deals = Array.from({ length: s.size }, (_, t) => cards.slice(t * per, t * per + per));
  // stars: a practice bot plays today's deals many times; its best run sets the bar
  const bot = rng.fork('bot');
  let best = 0;
  for (let run = 0; run < s.runs; run++) best = Math.max(best, botGame(s.size, deals, bot, run === 0 ? 0 : 40));
  const round = (v) => Math.max(5, Math.round(v / 5) * 5);
  const stars = [round(best * 0.3), round(best * 0.6), round(best)];
  return { n: s.size, deals, preview: s.preview, deckSize: deck.length, stars };
}
