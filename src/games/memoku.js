import './memoku.css';
import { h, put } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateMemoku } from '../gen/memoku.js';

export default {
  id: 'memoku',
  name: 'Memaku',
  tagline: 'Memory pairs on a Sudoku grid',
  version: 1,
  generate: generateMemoku,
  rules: [
    'A finished Sudoku is hidden under the tiles. A few numbers start face up.',
    'Flip two tiles. If they match, they stay up. If not, they flip back over.',
    'No number repeats in a row, column or box, so the face-up numbers tell you where a number can\'t be.',
    'Find every pair with as few misses as you can.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const n = p.n;
    const saved = ctx.load();
    const up = saved?.up || p.shown.slice(); // face up for good
    let misses = saved?.misses || 0;
    let done = !!saved?.done;
    let open = []; // flipped this turn (max 2)
    let timer = null;

    // boxes laid out in a grid, each holding equal squares, so every square is the same size
    const grid = h('div', { class: 'mk-grid', style: { '--bx': n / p.bc, '--by': n / p.br } });
    const boxes = Array.from({ length: n }, () => h('div', { class: 'mk-box', style: { '--bc': p.bc, '--br': p.br } }));
    boxes.forEach((b) => grid.append(b));
    // each tile is a two-sided card: a patterned back, and a face that only gets its number while it's turned up
    const els = [], fronts = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n;
      const box = Math.floor(r / p.br) * (n / p.bc) + Math.floor(c / p.bc);
      const front = h('span', { class: 'mk-face mk-front' });
      const el = h('button', { class: 'mk-cell', type: 'button', 'data-i': i, style: { '--w': `${(r + c) * 32}ms` }, onClick: (e) => { e.currentTarget.blur(); flip(i); } },
        h('span', { class: 'mk-card', 'aria-hidden': 'true' }, h('span', { class: 'mk-face mk-back' }), front));
      els.push(el); fronts.push(front);
      boxes[box].append(el); // cells arrive in reading order, so each box fills row by row
    }
    const meter = h('p', { class: 'hint-line mk-meter', 'aria-live': 'polite' });
    root.append(h('div', { class: 'board mk-board' }, grid), meter);

    function settle() {
      clearTimeout(timer); timer = null;
      if (open.length === 2) open = [];
    }

    let matched = null; // the pair just matched, for its moment
    let hintPair = null;
    function flip(i) {
      if (done || up[i] || open.includes(i)) return;
      if (open.length === 2) settle();
      open.push(i);
      if (open.length === 2) {
        const [a, b] = open;
        if (p.grid[a] === p.grid[b]) {
          up[a] = up[b] = true; open = [];
          matched = [a, b];
          if (up.every(Boolean)) { done = true; render(); win(b); ctx.solved(`${misses} miss${misses === 1 ? '' : 'es'}`, { value: misses, higher: false, fmt: (v) => `${v} miss${v === 1 ? '' : 'es'}` }); return; }
        } else {
          misses++;
          timer = setTimeout(() => { settle(); render(); }, 900);
        }
      }
      render();
    }

    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    const clearAt = new Array(n * n).fill(0);
    let shownMisses = misses;
    function render() {
      for (let i = 0; i < n * n; i++) {
        const show = up[i] || open.includes(i);
        const el = els[i], r = Math.floor(i / n), c = i % n;
        // the number goes on the face as it turns up, and comes off once it has turned away
        if (show) { clearTimeout(clearAt[i]); fronts[i].textContent = p.grid[i]; }
        else if (fronts[i].textContent) {
          clearTimeout(clearAt[i]);
          if (calm()) fronts[i].textContent = '';
          else clearAt[i] = setTimeout(() => { if (!up[i] && !open.includes(i)) fronts[i].textContent = ''; }, 450);
        }
        el.classList.toggle('show', show);
        el.classList.toggle('up', !!up[i]);
        el.classList.toggle('given', !!p.shown[i]);
        el.classList.toggle('peek', !up[i] && open.includes(i));
        el.classList.toggle('miss', open.length === 2 && open.includes(i) && p.grid[open[0]] !== p.grid[open[1]]);
        el.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}, ${show ? p.grid[i] : 'face down'}`);
        el.disabled = done;
      }
      if (matched) { matched.forEach((i) => replay(els[i], 'match')); matched = null; }
      if (hintPair) { hintPair.forEach((i) => replay(els[i], 'hinted')); hintPair = null; }
      const left = up.filter((x) => !x).length / 2;
      const missText = `${misses} miss${misses === 1 ? '' : 'es'}`;
      if (done) put(meter, h('span', { class: 'mk-stat done' }, `All pairs found with ${missText}`));
      else {
        const missEl = h('span', { class: 'mk-stat miss' + (misses > shownMisses ? ' bump' : '') }, h('b', {}, misses), ` miss${misses === 1 ? '' : 'es'}`);
        put(meter, h('span', { class: 'mk-stat' }, h('b', {}, left), ` pair${left === 1 ? '' : 's'} left`), h('span', { class: 'mk-dot', 'aria-hidden': 'true' }, '·'), missEl);
      }
      shownMisses = misses;
      grid.classList.toggle('solved', done);
      ctx.save({ up, misses, done });
    }

    // the win: a wave of cards spins over from the last pair outward
    function win(from) {
      if (calm()) return;
      const fr = Math.floor(from / n), fc = from % n;
      els.forEach((el, i) => el.style.setProperty('--w', `${Math.round(Math.hypot(Math.floor(i / n) - fr, (i % n) - fc) * 50) + 300}ms`));
      replay(grid, 'wave');
      setTimeout(() => grid.classList.remove('wave'), 1900);
    }

    // a fresh board deals its cards in
    if (!done && !calm()) { grid.classList.add('deal'); setTimeout(() => grid.classList.remove('deal'), 1100); }
    render();

    return {
      destroy() { clearTimeout(timer); clearAt.forEach(clearTimeout); },
      hint() {
        if (done) return false;
        settle();
        // turn up one pair of the number with the fewest left hidden
        const hidden = {};
        p.grid.forEach((v, i) => { if (!up[i]) (hidden[v] ||= []).push(i); });
        const v = Object.keys(hidden).sort((a, b) => hidden[a].length - hidden[b].length)[0];
        if (!v) return false;
        const [a, b] = hidden[v];
        up[a] = up[b] = true;
        hintPair = [a, b];
        if (up.every(Boolean)) { done = true; render(); win(b); ctx.solved(`${misses} miss${misses === 1 ? '' : 'es'}`, { value: misses, higher: false, fmt: (v) => `${v} miss${v === 1 ? '' : 'es'}` }); return `Found a pair of ${v}s`; }
        render();
        return `Found a pair of ${v}s`;
      },
      reveal() {
        settle(); up.fill(true); done = true;
        // the rest turn over in a wave from the top left
        grid.classList.add('cascade');
        setTimeout(() => grid.classList.remove('cascade'), 1400);
        render();
      },
    };
  },
};
