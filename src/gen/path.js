// Path (Zip-style): one line through every cell, hitting numbered stops in order.
// Builds a random Hamiltonian path with backbite moves, then places stops and walls along it.

const SETTINGS = {
  easy: { n: 5, stopEvery: 3, walls: 0 },
  medium: { n: 6, stopEvery: 4, walls: 3 },
  hard: { n: 7, stopEvery: 6, walls: 6 },
};

function neighbors(n, c) {
  const r = Math.floor(c / n), k = c % n, out = [];
  if (r > 0) out.push(c - n);
  if (r < n - 1) out.push(c + n);
  if (k > 0) out.push(c - 1);
  if (k < n - 1) out.push(c + 1);
  return out;
}

function hamiltonianPath(n, rng) {
  // serpentine start
  let path = [];
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) path.push(r * n + (r % 2 ? n - 1 - k : k));
  const moves = n * n * 40;
  for (let m = 0; m < moves; m++) {
    if (rng.next() < 0.5) path.reverse();
    // backbite from the end of the path
    const end = path[path.length - 1];
    const prev = path[path.length - 2];
    const opts = neighbors(n, end).filter((x) => x !== prev);
    const nb = rng.pick(opts);
    const i = path.indexOf(nb);
    // reverse the tail after i
    const tail = path.slice(i + 1).reverse();
    path = path.slice(0, i + 1).concat(tail);
  }
  return path;
}

export function generatePath(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const n = s.n;
  const path = hamiltonianPath(n, rng);
  const total = n * n;
  // stops: first, last, and spaced with jitter between
  const idx = [0];
  let i = 0;
  while (true) {
    const step = Math.max(2, s.stopEvery + rng.range(-1, 2));
    i += step;
    if (i >= total - 2) break;
    idx.push(i);
  }
  idx.push(total - 1);
  const stops = {}; // cell -> number
  idx.forEach((p, k) => (stops[path[p]] = k + 1));
  // walls between neighboring cells that are not consecutive on the path
  const onPath = new Set();
  for (let j = 0; j < total - 1; j++) {
    const a = path[j], b = path[j + 1];
    onPath.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  }
  const candidates = [];
  for (let c = 0; c < total; c++) for (const d of neighbors(n, c)) if (d > c && !onPath.has(`${c}-${d}`)) candidates.push(`${c}-${d}`);
  const walls = rng.shuffle(candidates).slice(0, s.walls);
  return { n, stops, walls, solution: path, maxStop: idx.length };
}

/** Rule check: covers every cell once, moves between neighbors, avoids walls, hits stops in order. */
export function checkPath(puzzle, cells) {
  const { n, stops, walls, maxStop } = puzzle;
  if (cells.length !== n * n) return false;
  if (new Set(cells).size !== cells.length) return false;
  const wallSet = new Set(walls);
  let expect = 1;
  for (let j = 0; j < cells.length; j++) {
    const c = cells[j];
    if (j > 0) {
      const p = cells[j - 1];
      if (!neighbors(n, p).includes(c)) return false;
      if (wallSet.has(p < c ? `${p}-${c}` : `${c}-${p}`)) return false;
    }
    if (stops[c] !== undefined) {
      if (stops[c] !== expect) return false;
      expect++;
    }
  }
  return expect === maxStop + 1 && stops[cells[cells.length - 1]] === maxStop;
}

export { neighbors as gridNeighbors };
