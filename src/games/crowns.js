import './crowns.css';
import { h, put, cellAt } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateCrowns, checkCrowns, crownConflicts } from '../gen/crowns.js';

const CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.6-9.5-4.9 4.3L12 5l-2.5 7.8-4.9-4.3z" fill="currentColor"/><rect x="3" y="19.2" width="18" height="2.2" rx="1" fill="currentColor"/></svg>';

export default {
  id: 'crowns',
  version: 2, // sizes changed to 7, 8 and 10, so older saves don't load onto a new board
  name: 'Queens',
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
    // a tally of crowns under the board: one slot per crown the puzzle needs
    const tally = h('div', { class: 'cr-tally', 'aria-hidden': 'true' });
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    root.append(board,
      h('div', { class: 'cr-foot' },
        tally,
        h('div', { class: 'row-actions' },
          h('button', { class: 'btn', type: 'button', onClick: (e) => { e.currentTarget.blur(); if (history.length && !done) { mark.splice(0, mark.length, ...history.pop()); render(); } } }, 'Undo'),
          h('button', { class: 'btn', type: 'button', onClick: (e) => { e.currentTarget.blur(); if (!done) { commit(); mark.fill(0); sweep = true; render(); } } }, 'Clear'))),
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
      replay(cells[c], 'press');
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

    // ----- drawing: each square only changes when its mark does, so each change can animate -----
    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    const shown = new Array(n * n).fill(null); // what each square shows: '', 'x', 'auto' or 'crown'
    const wasBad = new Set();
    let sweep = false; // Clear: marks leave in a wave from the top left
    let hinted = -1;
    let shownCount = -1;
    const rc = (c) => [Math.floor(c / n), c % n];
    // a mark leaving: a copy of it shrinks away while the square takes its new state
    function leave(el, html) {
      if (calm()) return;
      const g = h('span', { class: 'cr-ghost', html, onAnimationend: (e) => e.currentTarget.remove() });
      el.append(g);
    }
    const X = (cls) => `<span class="xmark${cls}" aria-hidden="true">×</span>`;

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
      const first = shown[0] === null;
      // the crown just placed, if any: its automatic Xs ripple outward from it
      const placed = first ? -1 : [...crowns].find((c) => shown[c] !== 'crown') ?? -1;
      const [pr, pc] = placed >= 0 ? rc(placed) : [0, 0];
      cells.forEach((el, c) => {
        const auto = mark[c] === 0 && blocked.has(c);
        const now = mark[c] === 2 ? 'crown' : mark[c] === 1 ? 'x' : auto ? 'auto' : '';
        el.classList.toggle('x', mark[c] === 1 || auto);
        el.classList.toggle('crown', mark[c] === 2);
        el.classList.toggle('bad', bad.has(c));
        el.setAttribute('aria-pressed', mark[c] === 2 ? 'true' : 'false');
        const was = shown[c];
        if (now === was) return;
        shown[c] = now;
        const [r, k] = rc(c);
        let delay = 0;
        if (sweep) delay = (r + k) * 18;
        else if (placed >= 0 && now === 'auto') delay = 40 + Math.max(Math.abs(r - pr), Math.abs(k - pc)) * 32;
        else if (placed >= 0 && was === 'auto' && now === '') delay = 0;
        el.style.setProperty('--dl', `${delay}ms`);
        el.innerHTML = now === 'crown' ? CROWN : now === 'x' ? X('') : now === 'auto' ? X(' auto') : '';
        const kid = el.firstElementChild;
        if (!first && kid) kid.classList.add('in');
        if (!first && was === 'crown') leave(el, CROWN);
        else if (!first && (was === 'x' || was === 'auto') && !now) leave(el, X(was === 'auto' ? ' auto' : ''));
      });
      sweep = false;
      // a crown that newly clashes pulses so you see which ones collide
      for (const c of bad) if (!wasBad.has(c) && !first) replay(cells[c], 'clash');
      wasBad.clear(); bad.forEach((c) => wasBad.add(c));
      if (hinted >= 0) { replay(cells[hinted], 'hinted'); hinted = -1; }
      drawTally(crowns.size, first);
      if (!done) status.textContent = `${crowns.size} of ${n} crowns placed`;
      if (!done && checkCrowns(p, crowns)) {
        done = true;
        board.classList.add('solved');
        status.textContent = 'Every row, column and color has its crown.';
        win(placed >= 0 ? placed : null);
        ctx.solved();
      }
      ctx.save({ mark, done });
    }

    function drawTally(count, first) {
      if (count === shownCount) return;
      const prev = shownCount;
      shownCount = count;
      put(tally, Array.from({ length: n }, (_, i) => h('span', {
        class: 'cr-pip' + (i < count ? ' on' : '') + (!first && prev >= 0 && i >= prev && i < count ? ' pop' : ''),
        style: { '--i': i }, html: CROWN,
      })));
      tally.classList.toggle('full', count >= n);
    }

    // the win: a ripple of light runs out from the last crown across every region, and the crowns hop
    function win(from) {
      if (calm()) { grid.classList.add('won'); return; }
      const [fr, fc] = from != null ? rc(from) : [(n - 1) / 2, (n - 1) / 2];
      cells.forEach((el, c) => {
        const [r, k] = rc(c);
        el.style.setProperty('--w', `${Math.round(Math.hypot(r - fr, k - fc) * 55)}ms`);
        el.firstElementChild?.classList.remove('in');
      });
      grid.classList.remove('won', 'wave'); void grid.offsetWidth;
      grid.classList.add('won', 'wave');
      setTimeout(() => grid.classList.remove('wave'), 1600 + n * 60);
    }

    render();
    if (done) { board.classList.add('solved'); grid.classList.add('won'); }
    return {
      hint() {
        if (done) return false;
        const sol = new Set(p.solution.map((c, r) => r * n + c));
        commit();
        const wrong = mark.findIndex((m, i) => m === 2 && !sol.has(i));
        if (wrong !== -1) { mark[wrong] = 0; hinted = wrong; render(); return 'Removed a crown that doesn\'t belong there'; }
        const missing = [...sol].filter((c) => mark[c] !== 2);
        const c = missing[Math.floor(Math.random() * missing.length)];
        mark[c] = 2; hinted = c;
        render();
        return 'Placed one crown';
      },
      reveal() {
        mark.fill(0);
        p.solution.forEach((c, r) => (mark[r * n + c] = 2));
        done = true; board.classList.add('solved'); sweep = true; render(); grid.classList.add('won'); status.textContent = 'Solution shown.';
        ctx.save({ mark, done, revealed: true });
      },
    };
  },
};
