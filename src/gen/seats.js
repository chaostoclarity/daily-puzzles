// Where's My Seet (seating logic puzzle): seat everyone in one row so every clue holds.
// Clues are generated from a hidden seating and trimmed until exactly one seating fits.

export const NAMES = ['Ava', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal'];

const SETTINGS = {
  easy: { n: 5, direct: 1, kinds: ['next', 'notnext', 'leftof', 'end', 'notend', 'gap', 'seat'] },
  medium: { n: 6, direct: 0, kinds: ['next', 'notnext', 'leftof', 'rightafter', 'end', 'notend', 'gap', 'between'] },
  hard: { n: 7, direct: 0, kinds: ['notnext', 'leftof', 'rightafter', 'notend', 'gap', 'between', 'farther'] },
};

/** Does clue c hold when seat[p] gives each person's seat (0 = leftmost)? */
export function holds(c, seat, n) {
  const s = (p) => seat[p];
  switch (c.t) {
    case 'seat': return s(c.a) === c.k;
    case 'next': return Math.abs(s(c.a) - s(c.b)) === 1;
    case 'notnext': return Math.abs(s(c.a) - s(c.b)) !== 1;
    case 'leftof': return s(c.a) < s(c.b);
    case 'rightafter': return s(c.b) === s(c.a) + 1;
    case 'end': return s(c.a) === 0 || s(c.a) === n - 1;
    case 'notend': return s(c.a) !== 0 && s(c.a) !== n - 1;
    case 'gap': return Math.abs(s(c.a) - s(c.b)) === c.k + 1;
    case 'between': return (s(c.b) < s(c.a) && s(c.a) < s(c.c)) || (s(c.c) < s(c.a) && s(c.a) < s(c.b));
    case 'farther': return Math.min(s(c.a), n - 1 - s(c.a)) > Math.min(s(c.b), n - 1 - s(c.b)); // a is closer to the middle
    default: return false;
  }
}

/** True when clue c can be checked: everyone it mentions has a seat. */
export const ready = (c, seat) => [c.a, c.b, c.c].every((p) => p === undefined || seat[p] !== undefined);

export function clueText(c, n) {
  const N = (p) => NAMES[p];
  const ord = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
  switch (c.t) {
    case 'seat': return `${N(c.a)} sits in the ${ord[c.k]} seat from the left.`;
    case 'next': return `${N(c.a)} sits next to ${N(c.b)}.`;
    case 'notnext': return `${N(c.a)} does not sit next to ${N(c.b)}.`;
    case 'leftof': return `${N(c.a)} sits somewhere to the left of ${N(c.b)}.`;
    case 'rightafter': return `${N(c.b)} sits directly to the right of ${N(c.a)}.`;
    case 'end': return `${N(c.a)} sits at one end of the row.`;
    case 'notend': return `${N(c.a)} does not sit at either end.`;
    case 'gap': return c.k === 1 ? `Exactly one person sits between ${N(c.a)} and ${N(c.b)}.` : `Exactly ${c.k} people sit between ${N(c.a)} and ${N(c.b)}.`;
    case 'between': return `${N(c.a)} sits somewhere between ${N(c.b)} and ${N(c.c)}.`;
    case 'farther': return `${N(c.a)} sits closer to the middle than ${N(c.b)}.`;
    default: return '';
  }
}

function permutations(n) {
  const out = [];
  const a = Array.from({ length: n }, (_, i) => i);
  const go = (k) => {
    if (k === n) { out.push(a.slice()); return; }
    for (let i = k; i < n; i++) { [a[k], a[i]] = [a[i], a[k]]; go(k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  };
  go(0);
  return out; // each entry: seat of person p
}

function candidates(seat, n, kinds) {
  const out = [];
  const people = [...Array(n).keys()];
  for (const t of kinds) {
    for (const a of people) {
      if (t === 'end' || t === 'notend') { out.push({ t, a }); continue; }
      if (t === 'seat') { out.push({ t, a, k: seat[a] }); continue; }
      for (const b of people) {
        if (b === a) continue;
        if (t === 'gap') { const d = Math.abs(seat[a] - seat[b]) - 1; if (a < b && d >= 1 && d <= 3) out.push({ t, a, b, k: d }); continue; }
        if (t === 'between') { for (const c of people) if (c > b && c !== a) out.push({ t, a, b, c }); continue; }
        if ((t === 'next' || t === 'notnext') && b < a) continue;
        out.push({ t, a, b });
      }
    }
  }
  return out.filter((c) => holds(c, seat, n));
}

const CAP = { gap: 1, between: 2, seat: 1, rightafter: 2, end: 1, farther: 2 };

export function generateSeats(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const n = s.n;
  const all = permutations(n);
  for (let attempt = 0; attempt < 200; attempt++) {
    const seat = rng.shuffle([...Array(n).keys()]); // seat[p]
    let pool = rng.shuffle(candidates(seat, n, s.kinds));
    // limit direct seat clues
    let directs = 0;
    pool = pool.filter((c) => c.t !== 'seat' || directs++ < s.direct);
    // add clues in random order, keeping any that rules something out, with a cap per kind
    // so no single kind of clue (like exact gaps) does all the work
    let alive = all;
    const clues = [];
    const per = {};
    for (const c of pool) {
      if (alive.length === 1) break;
      if ((per[c.t] || 0) >= (CAP[c.t] ?? 3)) continue;
      const next = alive.filter((x) => holds(c, x, n));
      if (next.length === alive.length) continue;
      clues.push(c); alive = next; per[c.t] = (per[c.t] || 0) + 1;
    }
    if (alive.length !== 1) continue;
    // drop clues that aren't needed
    for (let i = clues.length - 1; i >= 0; i--) {
      const rest = clues.filter((_, k) => k !== i);
      if (all.filter((x) => rest.every((c) => holds(c, x, n))).length === 1) clues.splice(i, 1);
    }
    return { n, names: NAMES.slice(0, n), seat, clues: rng.shuffle(clues).map((c) => ({ ...c, text: clueText(c, n) })) };
  }
  throw new Error('seats generation failed');
}
