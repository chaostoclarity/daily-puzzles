import { h, put } from '../lib/ui.js';
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

    const grid = h('div', { class: 'mk-grid', style: { '--n': n } });
    const els = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n;
      const cls = ['mk-cell', (c + 1) % p.bc === 0 && c < n - 1 ? 'br' : '', (r + 1) % p.br === 0 && r < n - 1 ? 'bb' : ''].join(' ');
      const el = h('button', { class: cls, type: 'button', onClick: () => flip(i) });
      els.push(el); grid.append(el);
    }
    const meter = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    root.append(h('div', { class: 'board mk-board' }, grid), meter);

    function settle() {
      clearTimeout(timer); timer = null;
      if (open.length === 2) open = [];
    }

    function flip(i) {
      if (done || up[i] || open.includes(i)) return;
      if (open.length === 2) settle();
      open.push(i);
      if (open.length === 2) {
        const [a, b] = open;
        if (p.grid[a] === p.grid[b]) {
          up[a] = up[b] = true; open = [];
          if (up.every(Boolean)) { done = true; render(); ctx.solved(`${misses} miss${misses === 1 ? '' : 'es'}`); return; }
        } else {
          misses++;
          timer = setTimeout(() => { settle(); render(); }, 900);
        }
      }
      render();
    }

    function render() {
      for (let i = 0; i < n * n; i++) {
        const show = up[i] || open.includes(i);
        els[i].textContent = show ? p.grid[i] : '';
        els[i].classList.toggle('up', !!up[i]);
        els[i].classList.toggle('given', !!p.shown[i]);
        els[i].classList.toggle('peek', !up[i] && open.includes(i));
        els[i].classList.toggle('miss', open.length === 2 && open.includes(i) && p.grid[open[0]] !== p.grid[open[1]]);
        els[i].disabled = done;
      }
      const left = up.filter((x) => !x).length / 2;
      put(meter, done ? `All pairs found with ${misses} miss${misses === 1 ? '' : 'es'}` : `${left} pair${left === 1 ? '' : 's'} left · ${misses} miss${misses === 1 ? '' : 'es'}`);
      grid.classList.toggle('solved', done);
      ctx.save({ up, misses, done });
    }
    render();

    return {
      destroy() { clearTimeout(timer); },
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
        if (up.every(Boolean)) { done = true; render(); ctx.solved(`${misses} miss${misses === 1 ? '' : 'es'}`); return `Found a pair of ${v}s`; }
        render();
        return `Found a pair of ${v}s`;
      },
      reveal() {
        settle(); up.fill(true); done = true; render();
      },
    };
  },
};
