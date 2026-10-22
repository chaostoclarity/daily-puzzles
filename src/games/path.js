import { h, s, cellAt } from '../lib/ui.js';
import { generatePath, checkPath, gridNeighbors } from '../gen/path.js';

export default {
  id: 'path',
  name: 'Trail',
  tagline: 'Draw one line through every square',
  inspired: 'Zip',
  generate: generatePath,
  rules: [
    'Start on 1 and draw a single line through every square on the board.',
    'Pass the numbers in order and finish on the highest number.',
    'Move up, down, left or right. Thick walls block the way.',
    'Drag back over your line to undo, or tap any square on it to cut the line there.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const { n } = p;
    const wallSet = new Set(p.walls);
    const saved = ctx.load();
    let path = saved?.path || [];
    let done = !!saved?.done;
    const history = [];

    const cells = [];
    const svg = s('svg', { class: 'path-svg', viewBox: `0 0 ${n} ${n}`, 'aria-hidden': 'true' });
    const line = s('polyline', { class: 'path-line', points: '' });
    svg.append(line);
    const grid = h('div', { class: 'path-grid', style: { '--n': n }, role: 'grid', 'aria-label': `Trail board, ${n} by ${n}` });
    for (let c = 0; c < n * n; c++) {
      const right = c % n < n - 1 && wallSet.has(`${c}-${c + 1}`);
      const bottom = c < n * (n - 1) && wallSet.has(`${c}-${c + n}`);
      const cell = h('div', { class: 'path-cell' + (right ? ' wall-r' : '') + (bottom ? ' wall-b' : ''), 'data-cell': c, role: 'gridcell' },
        p.stops[c] ? h('span', { class: 'path-stop' }, p.stops[c]) : null);
      cells.push(cell);
      grid.append(cell);
    }
    const board = h('div', { class: 'board path-board' }, grid, svg);
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    const undoBtn = h('button', { class: 'btn', type: 'button', onClick: () => { if (history.length && !done) { path = history.pop(); render(); } } }, 'Undo');
    const clearBtn = h('button', { class: 'btn', type: 'button', onClick: () => { if (!done) { commit(); path = []; render(); } } }, 'Clear');
    root.append(board, h('div', { class: 'row-actions' }, undoBtn, clearBtn), status);

    const nextStop = () => path.filter((c) => p.stops[c]).length + 1;
    const commit = () => { history.push(path.slice()); if (history.length > 200) history.shift(); };
    const blocked = (a, b) => wallSet.has(a < b ? `${a}-${b}` : `${b}-${a}`);

    function tryExtend(c) {
      if (c === null || done) return;
      const last = path[path.length - 1];
      if (c === last) return;
      const i = path.indexOf(c);
      if (i !== -1) { path = path.slice(0, i + 1); return render(); }
      if (last === undefined) return;
      if (!gridNeighbors(n, last).includes(c) || blocked(last, c)) return;
      if (p.stops[c] && p.stops[c] !== nextStop()) return;
      path.push(c);
      render();
    }

    let dragging = false;
    grid.addEventListener('pointerdown', (e) => {
      if (done) return;
      const c = cellAt(e);
      if (c === null) return;
      e.preventDefault();
      grid.setPointerCapture(e.pointerId);
      dragging = true;
      commit();
      if (!path.length) {
        if (p.stops[c] === 1) { path = [c]; render(); }
        else status.textContent = 'Start on 1.';
        return;
      }
      const i = path.indexOf(c);
      if (i !== -1) { path = path.slice(0, i + 1); render(); }
      else tryExtend(c);
    });
    grid.addEventListener('pointermove', (e) => { if (dragging) tryExtend(cellAt(e)); });
    const end = () => { dragging = false; };
    grid.addEventListener('pointerup', end);
    grid.addEventListener('pointercancel', end);

    function render() {
      const inPath = new Set(path);
      cells.forEach((el, c) => {
        el.classList.toggle('on', inPath.has(c));
        el.classList.toggle('head', c === path[path.length - 1]);
      });
      line.setAttribute('points', path.map((c) => `${(c % n) + 0.5},${Math.floor(c / n) + 0.5}`).join(' '));
      const filled = path.length;
      if (!done) status.textContent = filled ? `${filled} of ${n * n} squares` : 'Start on 1 and drag.';
      if (!done && checkPath(p, path)) {
        done = true;
        board.classList.add('solved');
        status.textContent = 'Every square, in order.';
        ctx.solved();
      }
      ctx.save({ path, done });
    }
    render();
    if (done) board.classList.add('solved');
    return {
      onKey(k) {
        if (done) return;
        const last = path[path.length - 1];
        if (k === 'back') { if (path.length) { commit(); path.pop(); render(); } return; }
        if (last === undefined) return;
        const d = { up: -n, down: n, left: -1, right: 1 }[k];
        if (d === undefined) return;
        if ((k === 'left' && last % n === 0) || (k === 'right' && last % n === n - 1)) return;
        const c = last + d;
        if (c < 0 || c >= n * n) return;
        commit();
        if (c === path[path.length - 2]) { path.pop(); render(); } else tryExtend(c);
      },
      reveal() { path = p.solution.slice(); done = true; board.classList.add('solved'); render(); status.textContent = 'Solution shown.'; ctx.save({ path, done, revealed: true }); },
    };
  },
};
