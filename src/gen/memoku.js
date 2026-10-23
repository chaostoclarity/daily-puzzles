// Memaku (Memoku-style): a solved Sudoku hides under face-down tiles. Flip two at a time;
// matching numbers stay up. Sudoku rules (no repeats in a row, column or box) tell you
// where a number can't be, so memory and logic work together.

const SETTINGS = {
  easy: { n: 6, br: 2, bc: 3, givens: 2 }, // per number, so the rest pair up evenly
  medium: { n: 9, br: 3, bc: 3, givens: 3 },
  hard: { n: 9, br: 3, bc: 3, givens: 1 },
};

/** A random complete Sudoku of size n with boxes br x bc. */
export function fullGrid(rng, n, br, bc) {
  const g = new Array(n * n).fill(0);
  const ok = (i, v) => {
    const r = Math.floor(i / n), c = i % n;
    for (let k = 0; k < n; k++) if (g[r * n + k] === v || g[k * n + c] === v) return false;
    const r0 = r - (r % br), c0 = c - (c % bc);
    for (let a = 0; a < br; a++) for (let b = 0; b < bc; b++) if (g[(r0 + a) * n + c0 + b] === v) return false;
    return true;
  };
  const go = (i) => {
    if (i === n * n) return true;
    for (const v of rng.shuffle(Array.from({ length: n }, (_, k) => k + 1))) {
      if (!ok(i, v)) continue;
      g[i] = v;
      if (go(i + 1)) return true;
      g[i] = 0;
    }
    return false;
  };
  go(0);
  return g;
}

export function generateMemoku(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const grid = fullGrid(rng, s.n, s.br, s.bc);
  // show a few of each number face up; an odd count for 9x9 leaves an even number to pair
  const shown = new Array(s.n * s.n).fill(false);
  for (let v = 1; v <= s.n; v++) {
    const cells = rng.shuffle(grid.map((x, i) => (x === v ? i : -1)).filter((i) => i >= 0));
    cells.slice(0, s.givens).forEach((i) => (shown[i] = true));
  }
  return { n: s.n, br: s.br, bc: s.bc, grid, shown };
}
