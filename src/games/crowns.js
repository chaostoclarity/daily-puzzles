import { h, cellAt } from '../lib/ui.js';
import { generateCrowns, checkCrowns, crownConflicts } from '../gen/crowns.js';

const CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.6-9.5-4.9 4.3L12 5l-2.5 7.8-4.9-4.3z" fill="currentColor"/><rect x="3" y="19.2" width="18" height="2.2" rx="1" fill="currentColor"/></svg>';

export default {
  id: 'crowns',
  version: 2, // sizes changed to 7, 8 and 10, so older saves don't load onto a new board
  name: 'Queins',
  tagline: 'One crown per row, column and color',
  generate: generateCrowns,
  rules: [
    'Place one crown in every row, every column and every color region.',
    'Crowns can never touch, not even at a corner.',
    'Tap a square once to mark it with an X, twice for a crown, three times to clear.',
    'Drag across empty squares to mark several Xs at once.',
    'Placing a crown automatically Xs out every square it rules out. Remove the crown and those Xs go away.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const { n, region } = p;
    const showConflicts = ctx.difficulty !== 'hard';
    const saved = ctx.load();
    const mark = saved?.mark || new Array(n * n).fill(0); // 0 empty, 1 x, 2 crown
    let done = !!saved?.done;
    const history = [];

    const cells = [];
    const grid = h('div', { class: 'crown-grid', style: { '--n': n }, role: 'grid', 'aria-label': `Crowns board, ${n} by ${n}` });
    for (let c = 0; c < n * n; c++) {
      const r = Math.floor(c / n), k = c % n, g = region[c];
      const cls = ['crown-cell', `rg${g}`];
      if (k < n - 1 && region[c + 1] !== g) cls.push('edge-r');
      if (r < n - 1 && region[c + n] !== g) cls.push('edge-b');
      const el = h('button', { class: cls.join(' '), type: 'button', 'data-cell': c, 'aria-label': `Row ${r + 1}, column ${k + 1}` });
      cells.push(el);
      grid.append(el);
    }
    const board = h('div', { class: 'board' }, grid);
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    root.append(board,
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn', type: 'button', onClick: () => { if (history.length && !done) { mark.splice(0, mark.length, ...history.pop()); render(); } } }, 'Undo'),
        h('button', { class: 'btn', type: 'button', onClick: () => { if (!done) { commit(); mark.fill(0); render(); } } }, 'Clear')),
      status);

    const commit = () => { history.push(mark.slice()); if (history.length > 200) history.shift(); };

    let drag = null; // { start, moved }
    grid.addEventListener('pointerdown', (e) => {
      if (done) return;
      const c = cellAt(e);
      if (c === null) return;
      e.preventDefault();
      grid.setPointerCapture(e.pointerId);
      commit();
      drag = { start: c, moved: false, last: c };
    });
    grid.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const c = cellAt(e);
      if (c === null || c === drag.last) return;
      if (!drag.moved) {
        drag.moved = true;
        if (mark[drag.start] === 0) mark[drag.start] = 1;
      }
      drag.last = c;
      if (mark[c] === 0) mark[c] = 1;
      render();
    });
    const end = () => {
      if (!drag) return;
      if (!drag.moved) { mark[drag.start] = (mark[drag.start] + 1) % 3; render(); }
      drag = null;
    };
    grid.addEventListener('pointerup', end);
    grid.addEventListener('pointercancel', () => { drag = null; });
    // keyboard access on the buttons themselves
    grid.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const c = e.target.closest('[data-cell]');
      if (!c || done) return;
      e.preventDefault(); commit();
      mark[+c.dataset.cell] = (mark[+c.dataset.cell] + 1) % 3;
      render();
    });

    function render() {
      const crowns = new Set(mark.map((m, i) => (m === 2 ? i : -1)).filter((i) => i >= 0));
      const bad = showConflicts ? crownConflicts(p, crowns) : new Set();
      // squares a placed crown rules out get an automatic, lighter X
      const blocked = new Set();
      for (const q of crowns) {
        const qr = Math.floor(q / n), qc = q % n;
        for (let c = 0; c < n * n; c++) {
          const r = Math.floor(c / n), k = c % n;
          if (r === qr || k === qc || region[c] === region[q] || (Math.abs(r - qr) <= 1 && Math.abs(k - qc) <= 1)) blocked.add(c);
        }
      }
      cells.forEach((el, c) => {
        const auto = mark[c] === 0 && blocked.has(c);
        el.classList.toggle('x', mark[c] === 1 || auto);
        el.classList.toggle('crown', mark[c] === 2);
        el.classList.toggle('bad', bad.has(c));
        el.innerHTML = mark[c] === 2 ? CROWN : mark[c] === 1 ? '<span class="xmark" aria-hidden="true">×</span>' : auto ? '<span class="xmark auto" aria-hidden="true">×</span>' : '';
        el.setAttribute('aria-pressed', mark[c] === 2 ? 'true' : 'false');
      });
      if (!done) status.textContent = `${crowns.size} of ${n} crowns placed`;
      if (!done && checkCrowns(p, crowns)) {
        done = true;
        board.classList.add('solved');
        status.textContent = 'Every row, column and color has its crown.';
        ctx.solved();
      }
      ctx.save({ mark, done });
    }
    render();
    if (done) board.classList.add('solved');
    return {
      hint() {
        if (done) return false;
        const sol = new Set(p.solution.map((c, r) => r * n + c));
        commit();
        const wrong = mark.findIndex((m, i) => m === 2 && !sol.has(i));
        if (wrong !== -1) { mark[wrong] = 0; render(); return 'Removed a crown that doesn\'t belong there'; }
        const missing = [...sol].filter((c) => mark[c] !== 2);
        mark[missing[Math.floor(Math.random() * missing.length)]] = 2;
        render();
        return 'Placed one crown';
      },
      reveal() {
        mark.fill(0);
        p.solution.forEach((c, r) => (mark[r * n + c] = 2));
        done = true; board.classList.add('solved'); render(); status.textContent = 'Solution shown.';
        ctx.save({ mark, done, revealed: true });
      },
    };
  },
};
