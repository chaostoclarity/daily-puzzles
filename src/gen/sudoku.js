// Sudoku: fill the 9x9 grid so every row, column and 3x3 box holds 1 to 9.
// Builds a full grid, then removes numbers while the answer stays unique.

const SETTINGS = { easy: { clues: 40 }, medium: { clues: 32 }, hard: { clues: 26 } };

const ROW = (i) => Math.floor(i / 9), COL = (i) => i % 9, BOX = (i) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);
const PEERS = Array.from({ length: 81 }, (_, i) => {
  const s = new Set();
  for (let j = 0; j < 81; j++) if (j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) s.add(j);
  return [...s];
});

/** Counts solutions up to `limit`. grid: array of 81 numbers, 0 = empty. Optionally fills `out` with the first. */
export function countSolutions(grid, limit = 2, out = null) {
  const g = grid.slice();
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) if (g[i]) { const b = 1 << g[i]; rows[ROW(i)] |= b; cols[COL(i)] |= b; boxes[BOX(i)] |= b; }
  let count = 0;
  const go = () => {
    // most constrained empty cell
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = ~(rows[ROW(i)] | cols[COL(i)] | boxes[BOX(i)]) & 0x3fe;
      let n = 0; for (let x = m; x; x &= x - 1) n++;
      if (n < bestN) { best = i; bestMask = m; bestN = n; if (n <= 1) break; }
    }
    if (best === -1) { if (count === 0 && out) out.splice(0, 81, ...g); count++; return count >= limit; }
    if (bestN === 0) return false;
    for (let d = 1; d <= 9; d++) {
      if (!(bestMask & (1 << d))) continue;
      const b = 1 << d;
      g[best] = d; rows[ROW(best)] |= b; cols[COL(best)] |= b; boxes[BOX(best)] |= b;
      if (go()) return true;
      g[best] = 0; rows[ROW(best)] &= ~b; cols[COL(best)] &= ~b; boxes[BOX(best)] &= ~b;
    }
    return false;
  };
  go();
  return count;
}

function fullGrid(rng) {
  const g = new Array(81).fill(0);
  const go = (i) => {
    if (i === 81) return true;
    for (const d of rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (PEERS[i].some((j) => g[j] === d)) continue;
      g[i] = d;
      if (go(i + 1)) return true;
    }
    g[i] = 0;
    return false;
  };
  go(0);
  return g;
}

export function generateSudoku(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const solution = fullGrid(rng);
  const givens = solution.slice();
  let filled = 81;
  for (const i of rng.shuffle([...Array(81).keys()])) {
    if (filled <= s.clues) break;
    const keep = givens[i];
    givens[i] = 0;
    if (countSolutions(givens, 2) !== 1) givens[i] = keep;
    else filled--;
  }
  return { givens, solution };
}

export { PEERS as sudokuPeers };
