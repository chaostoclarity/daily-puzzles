// Runs every generator over many seeds and checks rules, uniqueness and speed. Run: npm test
import fs from 'node:fs';
import { initWords, isWord } from '../src/lib/words.js';
import { makeRng } from '../src/lib/rng.js';
import { generatePath, checkPath } from '../src/gen/path.js';
import { generateCrowns, solveCrowns, checkCrowns } from '../src/gen/crowns.js';
import { generateWeave } from '../src/gen/weave.js';
import { generateLadder, oneApart, initCompounds } from '../src/gen/ladder.js';
import { generateGuess, score } from '../src/gen/guess.js';
import { generateHive } from '../src/gen/hive.js';
import { generateMini } from '../src/gen/mini.js';
import { generateTrivia, initTrivia } from '../src/gen/trivia.js';
import { generateSudoku, countSolutions } from '../src/gen/sudoku.js';
import { generateDominoes, ruleOk } from '../src/gen/dominoes.js';
import { generateTiles, shared } from '../src/gen/tiles.js';
import { generateLetterbox, letterboxError } from '../src/gen/letterbox.js';
import { generateGroups, initCategories } from '../src/gen/groups.js';
import { generateThreads } from '../src/gen/threads.js';
import { generateMidi } from '../src/gen/mini.js';
import { generateWordscapes, fits as wsFits } from '../src/gen/wordscapes.js';
import { generateSeats, holds as seatHolds } from '../src/gen/seats.js';
import { generateTypeshift, wordsFrom, minCover } from '../src/gen/typeshift.js';
import { generateWaffle, minSwaps, colorsFor, LINES, CELLS } from '../src/gen/waffle.js';

initWords(JSON.parse(fs.readFileSync('src/data/words.json')), JSON.parse(fs.readFileSync('src/data/clues.json')));
initCompounds(JSON.parse(fs.readFileSync('src/data/compounds.json')));
initCategories(JSON.parse(fs.readFileSync('src/data/categories.json')));
if (fs.existsSync('src/data/trivia.json')) initTrivia(JSON.parse(fs.readFileSync('src/data/trivia.json')));

const SEEDS = +(process.env.SEEDS || 25);
const diffs = ['easy', 'medium', 'hard'];
let fail = 0;
const assert = (cond, msg) => { if (!cond) { fail++; console.log('FAIL', msg); } };

function run(name, fn) {
  for (const d of diffs) {
    let worst = 0, total = 0;
    for (let i = 0; i < SEEDS; i++) {
      const seed = `2026-10-${(i % 28) + 1}|${name}|${d}|${i}`;
      const t0 = performance.now();
      const p = fn.gen(makeRng(seed), d);
      const ms = performance.now() - t0;
      worst = Math.max(worst, ms); total += ms;
      fn.check(p, d, seed);
      // determinism
      if (i === 0) assert(JSON.stringify(fn.gen(makeRng(seed), d)) === JSON.stringify(p), `${name} ${d} not deterministic`);
    }
    console.log(`${name.padEnd(7)} ${d.padEnd(6)} avg ${(total / SEEDS).toFixed(1)}ms worst ${worst.toFixed(1)}ms`);
  }
}

run('path', {
  gen: generatePath,
  check: (p, d, s) => assert(checkPath(p, p.solution), `path ${s}`),
});
let multi = 0;
run('crowns', {
  gen: generateCrowns,
  check: (p, d, s) => {
    const sols = solveCrowns(p.n, p.region, 2);
    if (sols.length !== 1) multi++;
    assert(checkCrowns(p, new Set(p.solution.map((c, r) => r * p.n + c))), `crowns ${s}`);
    assert(new Set(p.region).size === p.n, `crowns regions ${s}`);
  },
});
console.log('crowns boards with more than one solution:', multi);
run('weave', {
  gen: generateWeave,
  check: (p, d, s) => {
    assert(p.words.reduce((a, w) => a + w.cells.length, 0) === p.grid.filter(Boolean).length, `weave cover ${s}`);
    assert(new Set(p.words.map((w) => w.word.length)).size === p.words.length, `weave distinct lengths ${s}`);
    for (const w of p.words) assert(w.cells.map((c) => p.grid[c]).join('') === w.word, `weave spell ${s}`);
  },
});
run('ladder', {
  gen: generateLadder,
  check: (p, d, s) => {
    const chain = [p.top, ...[...p.middle].sort((a, b) => a.order - b.order), p.bottom].map((r) => r.word);
    for (let i = 1; i < chain.length; i++) assert(oneApart(chain[i - 1], chain[i]), `ladder ${s} ${chain}`);
    assert([p.top, p.bottom, ...p.middle].every((r) => r.clue), `ladder clue ${s}`);
  },
});
run('guess', {
  gen: generateGuess,
  check: (p, d, s) => assert(isWord(p.answer) && score(p.answer, p.answer).every((x) => x === 2), `guess ${s}`),
});
run('hive', {
  gen: generateHive,
  check: (p, d, s) => assert(p.words.length >= 10 && p.words.some((w) => new Set(w).size === 7), `hive ${s}`),
});
run('mini', {
  gen: generateMini,
  check: (p, d, s) => {
    for (const c of p.clues) {
      assert(c.cells.map((x) => p.solution[x]).join('') === c.answer, `mini answer ${s}`);
      assert(c.clue, `mini clue ${s} ${c.answer}`);
    }
  },
});
if (fs.existsSync('src/data/trivia.json')) run('trivia', {
  gen: generateTrivia,
  check: (p, d, s) => assert(p.questions.length === 10 && p.questions.every((q) => q.choices.includes(q.answer)), `trivia ${s}`),
});

run('sudoku', {
  gen: generateSudoku,
  check: (p, d, s) => { assert(countSolutions(p.givens, 2) === 1, `sudoku unique ${s}`); assert(p.givens.every((g, i) => !g || g === p.solution[i]), `sudoku givens ${s}`); },
});
run('domino', {
  gen: generateDominoes,
  check: (p, d, s) => {
    const val = {}; for (const x of p.solution) x.cells.forEach((c, k) => (val[c] = x.values[k]));
    assert(Object.keys(val).length === p.cells.length, `dominoes cover ${s}`);
    for (const r of p.regions) assert(ruleOk(r.rule, r.cells.map((c) => val[c])), `dominoes rule ${s}`);
  },
});
run('tiles', {
  gen: generateTiles,
  check: (p, d, s) => {
    // greedy clear must always finish
    const t = p.tiles.map((x) => ({ ...x }));
    for (let guard = 0; guard < 500; guard++) {
      const live = t.map((_, i) => i).filter((i) => Object.values(t[i]).some(Boolean));
      if (!live.length) break;
      let moved = false;
      for (const a of live) { for (const b of live) if (a !== b) { const sh = shared(t[a], t[b]); if (sh.length) { sh.forEach((k) => { t[a][k] = null; t[b][k] = null; }); moved = true; break; } } if (moved) break; }
      if (!moved) { assert(false, `tiles stuck ${s}`); break; }
    }
  },
});
run('wordscapes', {
  gen: generateWordscapes,
  check: (p, d, s) => {
    const letters = p.letters.join('');
    assert(p.words.every((w) => wsFits(w.word, letters) && isWord(w.word)), `wordscapes words ${s}`);
    // every grid cell agrees between crossing words, and words connect
    const cell = new Map();
    for (const w of p.words) for (let i = 0; i < w.word.length; i++) {
      const k = (w.r + (w.dir === 'down' ? i : 0)) + ',' + (w.c + (w.dir === 'across' ? i : 0));
      assert(!cell.has(k) || cell.get(k) === w.word[i], `wordscapes clash ${s}`);
      cell.set(k, w.word[i]);
    }
    assert(p.words.length >= (d === 'easy' ? 5 : d === 'medium' ? 7 : 8), `wordscapes only ${p.words.length} words ${s}`);
  },
});
run('seats', {
  gen: generateSeats,
  check: (p, d, s) => {
    assert(p.clues.every((c) => seatHolds(c, p.seat, p.n)), `seats clues false ${s}`);
    // exactly one seating fits
    let fits = 0;
    const perm = (k, used, seat) => {
      if (k === p.n) { if (p.clues.every((c) => seatHolds(c, seat, p.n))) fits++; return; }
      for (let x = 0; x < p.n; x++) if (!used[x]) { used[x] = 1; seat[k] = x; perm(k + 1, used, seat); used[x] = 0; }
    };
    perm(0, [], {});
    assert(fits === 1, `seats has ${fits} answers ${s}`);
  },
});
run('typeshift', {
  gen: generateTypeshift,
  check: (p, d, s) => {
    for (const w of p.planted) assert([...w].every((ch, i) => p.cols[i].includes(ch)), `typeshift planted ${w} ${s}`);
    const cells = new Set(p.cover.flatMap((w) => [...w].map((ch, i) => i + ':' + ch)));
    assert(cells.size === p.cols.reduce((a, c) => a + c.length, 0), `typeshift cover ${s}`);
    assert(p.cover.every((w) => isWord(w, 50)) && p.par === p.cover.length, `typeshift words ${s}`);
    assert(p.cols.every((c) => new Set(c).size === c.length && c.length >= 2), `typeshift columns ${s}`);
  },
});
run('waffle', {
  gen: generateWaffle,
  check: (p, d, s) => {
    const words = LINES.map((l) => l.map((i) => p.sol[i]).join(''));
    assert(words.every((w) => isWord(w)) && new Set(words).size === 6, `waffle words ${s}`);
    assert([...p.start].sort().join('') === [...p.sol].sort().join(''), `waffle letters ${s}`);
    assert(minSwaps(p.start, p.sol) === p.par && p.par === (d === 'easy' ? 6 : 10), `waffle par ${p.par} ${s}`);
    assert(!colorsFor(p.start, p.sol).every((c, i) => !CELLS.includes(i) || c === 'hit'), `waffle starts solved ${s}`);
  },
});
run('letbox', {
  gen: generateLetterbox,
  check: (p, d, s) => {
    assert(!letterboxError(p, p.solution[0], null) && !letterboxError(p, p.solution[1], p.solution[0]), `letterbox words ${s}`);
    assert(new Set(p.solution.join('')).size === 12 && p.sides.every((x) => x.length === 3), `letterbox letters ${s}`);
  },
});
run('groups', {
  gen: generateGroups,
  check: (p, d, s) => { assert(new Set(p.words).size === 16 && p.groups.every((g) => g.words.length === 4), `groups shape ${s}`); },
});
run('threads', {
  gen: generateThreads,
  check: (p, d, s) => {
    assert(p.grid.every(Boolean), `threads full ${s}`);
    const sp = p.words.find((w) => w.span);
    assert(sp.cells.some((c) => c % p.cols === 0) && sp.cells.some((c) => c % p.cols === p.cols - 1), `threads span edges ${s}`);
    for (const w of p.words) assert(w.cells.map((c) => p.grid[c]).join('') === w.word, `threads spell ${s}`);
  },
});
run('midi', {
  gen: generateMidi,
  check: (p, d, s) => { for (const c of p.clues) assert(c.clue && c.cells.map((x) => p.solution[x]).join('') === c.answer, `midi ${s}`); },
});

// samples
const r = makeRng('sample');
console.log('\nSample ladder:', JSON.stringify(generateLadder(r, 'medium')));
console.log('Sample mini:', generateMini(r, 'medium').clues.map((c) => `${c.num}${c.dir[0]} ${c.answer}: ${c.clue}`).join(' | '));
const h = generateHive(r, 'medium');
console.log('Sample hive:', h.center, h.outer.join(''), h.words.length, h.words.slice(0, 15).join(' '));
console.log('Sample weave:', generateWeave(r, 'hard').words.map((w) => w.word).join(' '));
console.log(fail ? `\n${fail} failures` : '\nall checks passed');
process.exit(fail ? 1 : 0);
