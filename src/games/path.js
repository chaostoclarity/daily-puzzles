import './path.css';
import { h, s, cellAt } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generatePath, checkPath, gridNeighbors } from '../gen/path.js';

export default {
  id: 'path',
  name: 'Zap',
  tagline: 'Draw one line through every square',
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
    const stopEls = new Map(); // cell -> its number disc
    // the line is drawn in layers: a soft glow, the line, a bright core, and the win pulse;
    // its spark rides at the head
    const svg = s('svg', { class: 'path-svg', viewBox: `0 0 ${n} ${n}`, 'aria-hidden': 'true' });
    const layers = ['path-glow', 'path-line', 'path-core'].map((cls) => s('polyline', { class: cls, points: '' }));
    const pulse = s('polyline', { class: 'path-pulse', points: '' });
    const ring = s('circle', { class: 'path-ring', r: '0.3', cx: '-1', cy: '-1' });
    const spark = s('circle', { class: 'path-spark', r: '0.11', cx: '-1', cy: '-1' });
    svg.append(...layers, pulse, ring, spark);
    const grid = h('div', { class: 'path-grid', style: { '--n': n }, role: 'grid', 'aria-label': `Trail board, ${n} by ${n}` });
    for (let c = 0; c < n * n; c++) {
      const right = c % n < n - 1 && wallSet.has(`${c}-${c + 1}`);
      const bottom = c < n * (n - 1) && wallSet.has(`${c}-${c + n}`);
      const stop = p.stops[c] ? h('span', { class: 'path-stop' }, p.stops[c]) : null;
      if (stop) stopEls.set(c, stop);
      const cell = h('div', { class: 'path-cell' + (right ? ' wall-r' : '') + (bottom ? ' wall-b' : ''), 'data-cell': c, role: 'gridcell' }, stop);
      cells.push(cell);
      grid.append(cell);
    }
    const board = h('div', { class: 'board path-board' }, grid, svg);
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    const undoBtn = h('button', { class: 'btn', type: 'button', onClick: (e) => { e.currentTarget.blur(); if (history.length && !done) { path = history.pop(); render(); } } }, 'Undo');
    const clearBtn = h('button', { class: 'btn', type: 'button', onClick: (e) => { e.currentTarget.blur(); if (!done) { commit(); path = []; render(); } } }, 'Clear');
    root.append(board, h('div', { class: 'row-actions' }, undoBtn, clearBtn), status);

    const nextStop = () => path.filter((c) => p.stops[c]).length + 1;
    const commit = () => { history.push(path.slice()); if (history.length > 200) history.shift(); };
    const blocked = (a, b) => wallSet.has(a < b ? `${a}-${b}` : `${b}-${a}`);
    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

    let nope = -1;
    function tryExtend(c) {
      if (c === null || done) return;
      const last = path[path.length - 1];
      if (c === last) return;
      const i = path.indexOf(c);
      if (i !== -1) { path = path.slice(0, i + 1); return render(); }
      if (last === undefined) return;
      if (!gridNeighbors(n, last).includes(c)) return;
      // a wall or an out-of-order number in the way: the square flinches, once per attempt
      if (blocked(last, c) || (p.stops[c] && p.stops[c] !== nextStop())) { if (nope !== c) { nope = c; replay(cells[c], 'nope'); } return; }
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
      nope = -1;
      commit();
      if (!path.length) {
        if (p.stops[c] === 1) { path = [c]; render(); }
        else { status.textContent = 'Start on 1.'; const one = [...stopEls].find(([k]) => p.stops[k] === 1); if (one) replay(one[1], 'nudge'); }
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

    // ----- the line: it grows and shrinks smoothly toward the path rather than jumping -----
    let drawn = [];   // the cells the drawn line runs through (lags the path while it shrinks)
    let shown = 0;    // how much of it is drawn, in squares
    let raf = 0, lastT = 0;
    const pt = (c) => [(c % n) + 0.5, Math.floor(c / n) + 0.5];
    const pts = (list) => list.map((c) => pt(c).join(',')).join(' ');
    function setLine(list) {
      drawn = list.slice();
      const v = pts(drawn);
      layers.forEach((l) => l.setAttribute('points', v));
    }
    function paint() {
      const dash = `${shown.toFixed(3)} ${n * n + 2}`;
      layers.forEach((l) => l.style.strokeDasharray = dash);
      const has = drawn.length > 0;
      // the spark sits at the tip of the drawn line
      let x = -1, y = -1;
      if (has) {
        const k = Math.min(Math.floor(shown), drawn.length - 1), f = shown - k;
        const [x0, y0] = pt(drawn[k]);
        const [x1, y1] = k + 1 < drawn.length ? pt(drawn[k + 1]) : [x0, y0];
        x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f;
      }
      for (const el of [spark, ring]) { el.setAttribute('cx', x); el.setAttribute('cy', y); }
      svg.classList.toggle('live', has && !done);
    }
    function step(now) {
      const target = Math.max(0, path.length - 1);
      const dt = Math.min(64, now - lastT); lastT = now;
      shown += (target - shown) * (1 - Math.exp(-dt / 55));
      if (Math.abs(target - shown) < 0.02) shown = target;
      if (shown <= target && drawn.length !== path.length) setLine(path); // finished shrinking
      paint();
      raf = shown === target && drawn.length === path.length ? 0 : requestAnimationFrame(step);
    }
    function drawLine() {
      const target = Math.max(0, path.length - 1);
      let k = 0;
      while (k < drawn.length && k < path.length && drawn[k] === path[k]) k++;
      if (calm() || !drawn.length) { setLine(path); shown = target; paint(); return; }
      if (k === path.length && path.length > 0) { /* cut back: keep the old line and draw it shorter */ }
      else { setLine(path); shown = Math.min(shown, Math.max(0, k - 1)); }
      if (!path.length) { setLine([]); shown = 0; paint(); return; }
      if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(step); }
    }

    let first = true;
    function render() {
      const inPath = new Set(path);
      cells.forEach((el, c) => {
        el.classList.toggle('on', inPath.has(c));
        el.classList.toggle('head', c === path[path.length - 1]);
      });
      // numbers light up as the line reaches them; the next one to reach glows
      const next = nextStop();
      for (const [c, el] of stopEls) {
        const hit = inPath.has(c);
        if (hit && !el.classList.contains('hit') && !first) replay(el, 'reach');
        el.classList.toggle('hit', hit);
        el.classList.toggle('due', !done && !hit && p.stops[c] === next);
      }
      drawLine();
      first = false;
      const filled = path.length;
      if (!done) status.textContent = filled ? `${filled} of ${n * n} squares` : 'Start on 1 and drag.';
      if (!done && checkPath(p, path)) {
        done = true;
        board.classList.add('solved');
        status.textContent = 'Every square, in order.';
        zap();
        ctx.solved();
      }
      ctx.save({ path, done });
    }

    // the win: a bolt of light runs the whole line from 1 to the end, lighting each number as it passes
    function zap() {
      svg.classList.remove('live');
      for (const el of stopEls.values()) el.classList.remove('due');
      if (calm() || !pulse.animate) return;
      const len = path.length - 1;
      const ms = Math.min(1700, Math.max(800, len * 40));
      pulse.setAttribute('points', pts(path));
      pulse.style.strokeDasharray = `2.2 ${len + 4}`;
      const run = pulse.animate([{ strokeDashoffset: 2.2, opacity: 1 }, { strokeDashoffset: -len, opacity: 1, offset: 0.92 }, { strokeDashoffset: -len - 1, opacity: 0 }], { duration: ms, easing: 'cubic-bezier(0.45, 0.05, 0.55, 0.95)', fill: 'forwards' });
      run.onfinish = () => { pulse.setAttribute('points', ''); run.cancel(); };
      for (const [c, el] of stopEls) {
        el.style.setProperty('--pd', `${Math.round((path.indexOf(c) / len) * ms * 0.92)}ms`);
        replay(el, 'zapped');
      }
      cells.forEach((el) => el.style.setProperty('--pd', `${Math.round((path.indexOf(+el.dataset.cell) / len) * ms * 0.92)}ms`));
      replay(grid, 'zapping');
      setTimeout(() => grid.classList.remove('zapping'), ms + 700);
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
        nope = -1;
        if (c === path[path.length - 2]) { path.pop(); render(); } else tryExtend(c);
      },
      hint() {
        if (done) return false;
        const sol = p.solution;
        let k = 0;
        while (k < path.length && path[k] === sol[k]) k++;
        commit();
        const fixed = k < path.length;
        path = sol.slice(0, k + 1);
        replay(cells[path[path.length - 1]], 'hinted');
        render();
        return fixed ? 'Trimmed your line back to the right track and added one square' : 'Added one square';
      },
      reveal() { path = p.solution.slice(); done = true; board.classList.add('solved'); render(); status.textContent = 'Solution shown.'; ctx.save({ path, done, revealed: true }); },
      destroy() { cancelAnimationFrame(raf); },
    };
  },
};
