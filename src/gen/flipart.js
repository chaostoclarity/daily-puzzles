// Flipert (Flipart-style): blocky pieces each turn around a fixed pivot square.
// They start rotated and overlapping; turn them until they fill the frame exactly.

const SETTINGS = {
  easy: { w: 4, h: 4, size: [3, 5] },
  medium: { w: 5, h: 5, size: [3, 5] },
  hard: { w: 6, h: 6, size: [3, 6] },
};

/** Cells of a piece after `turns` quarter turns clockwise around its pivot (as [x, y]). */
export function rotated(piece, turns) {
  const [px, py] = piece.pivot;
  return piece.cells.map(([x, y]) => {
    let dx = x - px, dy = y - py;
    for (let t = 0; t < ((turns % 4) + 4) % 4; t++) [dx, dy] = [-dy, dx];
    return [px + dx, py + dy];
  });
}

/** True when every piece sits inside the frame with no overlaps. */
export function solvedBy(p, turns) {
  const seen = new Set();
  for (let k = 0; k < p.pieces.length; k++) {
    for (const [x, y] of rotated(p.pieces[k], turns[k])) {
      if (x < 0 || y < 0 || x >= p.w || y >= p.h) return false;
      const key = x + ',' + y;
      if (seen.has(key)) return false;
      seen.add(key);
    }
  }
  return true;
}

export function generateFlipart(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const { w, h } = s;
  for (let attempt = 0; attempt < 200; attempt++) {
    // grow pieces to cover the frame
    const owner = new Array(w * h).fill(-1);
    const pieces = [];
    for (const start of rng.shuffle([...Array(w * h).keys()])) {
      if (owner[start] !== -1) continue;
      const id = pieces.length, want = rng.range(s.size[0], s.size[1]);
      const cells = [start]; owner[start] = id;
      while (cells.length < want) {
        const edge = [];
        for (const c of cells) {
          const x = c % w, y = Math.floor(c / w);
          for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (nx >= 0 && ny >= 0 && nx < w && ny < h && owner[ny * w + nx] === -1) edge.push(ny * w + nx);
        }
        if (!edge.length) break;
        const c = rng.pick(edge); owner[c] = id; cells.push(c);
      }
      pieces.push(cells);
    }
    // tiny leftovers make dull pieces; try again
    if (pieces.some((c) => c.length < 2)) continue;
    const out = pieces.map((cells) => {
      const xy = cells.map((c) => [c % w, Math.floor(c / w)]);
      // pivot on the square nearest the middle, so turning doesn't fling the piece far away
      const mx = xy.reduce((a, [x]) => a + x, 0) / xy.length, my = xy.reduce((a, [, y]) => a + y, 0) / xy.length;
      const d = ([x, y]) => (x - mx) ** 2 + (y - my) ** 2;
      const best = Math.min(...xy.map(d));
      return { cells: xy, pivot: rng.pick(xy.filter((c) => d(c) <= best + 1e-9)) };
    });
    // scramble: every piece turned 1 to 3 quarter turns (a 2x2 square can't hide, so it turns too)
    const turns = out.map(() => rng.range(1, 3));
    if (solvedBy({ w, h, pieces: out }, turns)) continue;
    const par = turns.reduce((a, t) => a + ((4 - t) % 4), 0);
    // how far pieces can reach, so the board leaves room around the frame
    let pad = 0;
    for (const pc of out) for (let t = 0; t < 4; t++) for (const [x, y] of rotated(pc, t)) pad = Math.max(pad, -x, -y, x - (w - 1), y - (h - 1));
    if (pad > 2) continue;
    return { w, h, pieces: out, start: turns, par, pad };
  }
  throw new Error('flipart generation failed');
}
