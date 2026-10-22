// Dominoes (Pips-style): place every domino on the board so each colored region meets its rule:
// a total, all equal, all different, or more/less than a number.

const SETTINGS = {
  easy: { dominoes: 5, size: 5, maxRegion: 3, blank: 0.1, ineq: 0.15 },
  medium: { dominoes: 7, size: 6, maxRegion: 4, blank: 0.2, ineq: 0.25 },
  hard: { dominoes: 9, size: 6, maxRegion: 4, blank: 0.3, ineq: 0.35 },
};

const orth = (n, c) => {
  const r = Math.floor(c / n), k = c % n, o = [];
  if (r > 0) o.push(c - n); if (r < n - 1) o.push(c + n); if (k > 0) o.push(c - 1); if (k < n - 1) o.push(c + 1);
  return o;
};

export function generateDominoes(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const n = s.size;
  for (let attempt = 0; attempt < 50; attempt++) {
    // grow a board out of domino placements
    const used = new Set();
    const placed = []; // [cellA, cellB]
    const mid = Math.floor(n / 2) * n + Math.floor(n / 2) - 1;
    placed.push([mid, mid + 1]); used.add(mid); used.add(mid + 1);
    let guard = 0;
    while (placed.length < s.dominoes && guard++ < 500) {
      const frontier = [];
      for (const c of used) for (const nb of orth(n, c)) if (!used.has(nb)) frontier.push(nb);
      const a = rng.pick(frontier);
      const opts = orth(n, a).filter((x) => !used.has(x));
      if (!opts.length) continue;
      const b = rng.pick(opts);
      placed.push([a, b]); used.add(a); used.add(b);
    }
    if (placed.length < s.dominoes) continue;
    // distinct dominoes from a double-six set
    const set = [];
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) set.push([a, b]);
    const tiles = rng.shuffle(set).slice(0, s.dominoes);
    const value = {};
    placed.forEach(([ca, cb], i) => {
      const [x, y] = rng.next() < 0.5 ? tiles[i] : [tiles[i][1], tiles[i][0]];
      value[ca] = x; value[cb] = y;
    });
    // regions with rules derived from the hidden solution
    const cells = [...used];
    const region = {};
    const regions = [];
    for (const c of rng.shuffle(cells)) {
      if (region[c] !== undefined) continue;
      const size = rng.range(1, s.maxRegion);
      const group = [c]; region[c] = regions.length;
      while (group.length < size) {
        const opts = group.flatMap((x) => orth(n, x)).filter((x) => used.has(x) && region[x] === undefined);
        if (!opts.length) break;
        const x = rng.pick(opts); region[x] = regions.length; group.push(x);
      }
      const vals = group.map((x) => value[x]);
      const sum = vals.reduce((a, b) => a + b, 0);
      let rule = null;
      const roll = rng.next();
      if (roll < s.blank) rule = null;
      else if (group.length > 1 && vals.every((v) => v === vals[0])) rule = { t: 'eq' };
      else if (group.length > 1 && new Set(vals).size === vals.length && roll < s.blank + 0.25) rule = { t: 'neq' };
      else if (roll < s.blank + s.ineq && group.length <= 2) {
        rule = rng.next() < 0.5 && sum < 12 ? { t: 'lt', v: sum + rng.range(1, 2) } : sum > 0 ? { t: 'gt', v: sum - rng.range(1, Math.min(2, sum)) } : { t: 'sum', v: sum };
      } else rule = { t: 'sum', v: sum };
      regions.push({ cells: group, rule });
    }
    if (regions.filter((r) => r.rule).length < Math.ceil(regions.length / 2)) continue;
    const tray = rng.shuffle(tiles.map((t, i) => ({ id: i, a: t[0], b: t[1] })));
    return {
      n, cells: cells.sort((a, b) => a - b), regions,
      tray, // dominoes to place
      solution: placed.map(([ca, cb], i) => ({ id: i, cells: [ca, cb], values: [value[ca], value[cb]] })),
    };
  }
  throw new Error('dominoes generation failed');
}

/** True when a region's values satisfy its rule. */
export function ruleOk(rule, vals) {
  if (!rule) return true;
  const sum = vals.reduce((a, b) => a + b, 0);
  if (rule.t === 'sum') return sum === rule.v;
  if (rule.t === 'eq') return vals.every((v) => v === vals[0]);
  if (rule.t === 'neq') return new Set(vals).size === vals.length;
  if (rule.t === 'lt') return sum < rule.v;
  if (rule.t === 'gt') return sum > rule.v;
  return true;
}

export const ruleLabel = (rule) => !rule ? '' : rule.t === 'sum' ? String(rule.v) : rule.t === 'eq' ? '=' : rule.t === 'neq' ? '≠' : rule.t === 'lt' ? `<${rule.v}` : `>${rule.v}`;
export { orth as dominoNeighbors };
