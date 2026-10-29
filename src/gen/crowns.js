// Crowns (Queens-style): one crown per row, column and color region; crowns never touch.
// Places a hidden solution, grows color regions around it, then reshapes regions until
// the solution is the only one.

const SIZES = { easy: 7, medium: 8, hard: 10 };

function placeCrowns(n, rng) {
  const cols = new Array(n);
  const used = new Array(n).fill(false);
  const go = (r) => {
    if (r === n) return true;
    for (const c of rng.shuffle([...Array(n).keys()])) {
      if (used[c]) continue;
      if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
      cols[r] = c; used[c] = true;
      if (go(r + 1)) return true;
      used[c] = false;
    }
    return false;
  };
  go(0);
  return cols;
}

function orth(n, cell) {
  const r = Math.floor(cell / n), c = cell % n, out = [];
  if (r > 0) out.push(cell - n);
  if (r < n - 1) out.push(cell + n);
  if (c > 0) out.push(cell - 1);
  if (c < n - 1) out.push(cell + 1);
  return out;
}

function growRegions(n, crowns, rng) {
  const region = new Array(n * n).fill(-1);
  crowns.forEach((c, r) => (region[r * n + c] = r));
  // uneven growth weights make more interesting shapes
  const weight = crowns.map(() => 0.3 + rng.next() * 1.7);
  let left = n * n - n;
  while (left > 0) {
    // weighted pick of a region that still has room to grow
    const frontier = [];
    for (let cell = 0; cell < n * n; cell++) {
      if (region[cell] !== -1) continue;
      for (const nb of orth(n, cell)) if (region[nb] !== -1) frontier.push([cell, region[nb]]);
    }
    let total = 0;
    for (const [, g] of frontier) total += weight[g];
    let x = rng.next() * total;
    let chosen = frontier[0];
    for (const f of frontier) { x -= weight[f[1]]; if (x <= 0) { chosen = f; break; } }
    region[chosen[0]] = chosen[1];
    left--;
  }
  return region;
}

/** Returns up to `limit` solutions as arrays of column per row. */
export function solveCrowns(n, region, limit = 2) {
  const sols = [];
  const cols = new Array(n);
  const usedC = new Array(n).fill(false);
  const usedR = new Array(n).fill(false);
  const go = (r) => {
    if (sols.length >= limit) return;
    if (r === n) { sols.push(cols.slice()); return; }
    for (let c = 0; c < n; c++) {
      if (usedC[c]) continue;
      const g = region[r * n + c];
      if (usedR[g]) continue;
      if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
      cols[r] = c; usedC[c] = true; usedR[g] = true;
      go(r + 1);
      usedC[c] = false; usedR[g] = false;
    }
  };
  go(0);
  return sols;
}

function connectedWithout(n, region, g, removed) {
  const cells = [];
  for (let i = 0; i < n * n; i++) if (region[i] === g && i !== removed) cells.push(i);
  if (cells.length === 0) return false;
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const x = stack.pop();
    for (const nb of orth(n, x)) if (nb !== removed && region[nb] === g && !seen.has(nb)) { seen.add(nb); stack.push(nb); }
  }
  return seen.size === cells.length;
}

export function generateCrowns(rng, difficulty = 'medium') {
  const n = SIZES[difficulty] || 7;
  for (let attempt = 0; attempt < 60; attempt++) {
    const crowns = placeCrowns(n, rng);
    const crownCells = new Set(crowns.map((c, r) => r * n + c));
    const region = growRegions(n, crowns, rng);
    for (let iter = 0; iter < 300; iter++) {
      const sols = solveCrowns(n, region, 2);
      if (sols.length === 1) return { n, region, solution: crowns };
      const alt = sols.find((s) => s.some((c, r) => c !== crowns[r]));
      // move one of the alternate solution's crown cells into a neighboring region
      const altCells = rng.shuffle(alt.map((c, r) => r * n + c).filter((x) => !crownCells.has(x)));
      let moved = false;
      for (const cell of altCells) {
        const g = region[cell];
        const targets = rng.shuffle([...new Set(orth(n, cell).map((x) => region[x]))].filter((t) => t !== g));
        if (!targets.length || !connectedWithout(n, region, g, cell)) continue;
        region[cell] = targets[0];
        moved = true;
        break;
      }
      if (!moved) break;
    }
  }
  // fallback: should be rare; accept a multi-solution board rather than hang
  const crowns = placeCrowns(n, rng);
  return { n, region: growRegions(n, crowns, rng), solution: crowns };
}

/** Rule check on a board of crowns given as a Set of cells. */
export function checkCrowns(puzzle, crownSet) {
  const { n, region } = puzzle;
  if (crownSet.size !== n) return false;
  const rows = new Set(), cols = new Set(), regs = new Set();
  const list = [...crownSet];
  for (const cell of list) {
    rows.add(Math.floor(cell / n)); cols.add(cell % n); regs.add(region[cell]);
  }
  if (rows.size !== n || cols.size !== n || regs.size !== n) return false;
  for (const a of list) for (const b of list) {
    if (a === b) continue;
    if (Math.abs(Math.floor(a / n) - Math.floor(b / n)) <= 1 && Math.abs((a % n) - (b % n)) <= 1) return false;
  }
  return true;
}

/** Cells that conflict with another crown, for live highlighting. */
export function crownConflicts(puzzle, crownSet) {
  const { n, region } = puzzle;
  const bad = new Set();
  const list = [...crownSet];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    const ra = Math.floor(a / n), rb = Math.floor(b / n), ca = a % n, cb = b % n;
    const clash = ra === rb || ca === cb || region[a] === region[b] || (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1);
    if (clash) { bad.add(a); bad.add(b); }
  }
  return bad;
}
