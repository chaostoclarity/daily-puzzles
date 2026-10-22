// Tiles: each tile stacks a few design layers (a color, a shape, a pattern). Tap two tiles that
// share a layer to clear what they share. Clear the board; keep matching without a miss to build
// your combo. Every layer value comes in pairs, so the board can always be cleared.

const SETTINGS = {
  easy: { rows: 4, cols: 4, layers: ['bg', 'shape'], values: 4 },
  medium: { rows: 5, cols: 4, layers: ['bg', 'shape', 'mark'], values: 5 },
  hard: { rows: 6, cols: 5, layers: ['bg', 'shape', 'mark'], values: 6 },
};

export const LAYER_VALUES = {
  bg: ['coral', 'sky', 'mint', 'sun', 'lilac', 'sand'],
  shape: ['circle', 'square', 'diamond', 'triangle', 'ring', 'cross'],
  mark: ['dots', 'stripes', 'corner', 'bar', 'wave', 'grid'],
};

export function generateTiles(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const count = s.rows * s.cols;
  const tiles = Array.from({ length: count }, () => ({}));
  for (const layer of s.layers) {
    const order = rng.shuffle([...Array(count).keys()]);
    for (let i = 0; i < count; i += 2) {
      const v = rng.pick(LAYER_VALUES[layer].slice(0, s.values));
      tiles[order[i]][layer] = v;
      tiles[order[i + 1]][layer] = v;
    }
  }
  return { rows: s.rows, cols: s.cols, layers: s.layers, tiles };
}

/** Layers two tiles share right now. */
export function shared(a, b) {
  return Object.keys(a).filter((k) => a[k] && a[k] === b[k]);
}
