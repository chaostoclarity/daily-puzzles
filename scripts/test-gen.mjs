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

initWords(JSON.parse(fs.readFileSync('src/data/words.json')), JSON.parse(fs.readFileSync('src/data/clues.json')));
initCompounds(JSON.parse(fs.readFileSync('src/data/compounds.json')));
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

// samples
const r = makeRng('sample');
console.log('\nSample ladder:', JSON.stringify(generateLadder(r, 'medium')));
console.log('Sample mini:', generateMini(r, 'medium').clues.map((c) => `${c.num}${c.dir[0]} ${c.answer}: ${c.clue}`).join(' | '));
const h = generateHive(r, 'medium');
console.log('Sample hive:', h.center, h.outer.join(''), h.words.length, h.words.slice(0, 15).join(' '));
console.log('Sample weave:', generateWeave(r, 'hard').words.map((w) => w.word).join(' '));
console.log(fail ? `\n${fail} failures` : '\nall checks passed');
process.exit(fail ? 1 : 0);
