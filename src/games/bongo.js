import './bongo.css';
import { h, put } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateBongo, scoreBoard, VALUES } from '../gen/bongo.js';

// numbers tick from one value to the next instead of jumping
function tick(el, from, to, fmt = (v) => v.toLocaleString()) {
  if (calm() || from == null || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), ms = 480;
  el.textContent = fmt(from);
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms), e = 1 - (1 - t) ** 3;
    el.textContent = fmt(Math.round(from + (to - from) * e));
    if (t < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export default {
  id: 'bongo',
  name: 'Bango',
  tagline: 'Place letter tiles for the best words',
  version: 1,
  playsOn: true,
  generate: generateBongo,
  rules: [
    'Place 25 of the 26 tiles on the board. Tap a tile, then a square. Tap a placed tile to pick it back up.',
    'Each row scores its best word of 3 to 5 letters in a row: letter values, times 2× and 3× squares.',
    'The shaded squares, one per row, spell a bonus word scored at face value.',
    'Common words earn 30% more. Fill the board to finish, then keep tweaking to beat the goal.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const saved = ctx.load();
    const grid = saved?.grid || new Array(25).fill('');
    const used = saved?.used || new Array(p.tiles.length).fill(-1); // tile index -> cell, or -1
    const locked = new Set(saved?.locked || []);
    let done = !!saved?.done;
    let best = saved?.best || 0;
    let sel = null; // tile index

    // one-shot motion cues for the next render
    let cue = { fly: null, win: false, hint: null };

    const snakeCells = new Set(p.snake.map((c, r) => r * 5 + c));
    const totalNum = h('b', {}, '0');
    const totalRest = h('span');
    const goalFill = h('span', { class: 'bg-goal-fill' });
    const goalBar = h('div', { class: 'bg-goal', role: 'progressbar', 'aria-label': 'Points toward the goal', 'aria-valuemin': 0, 'aria-valuemax': p.target }, goalFill, h('i', { class: 'bg-goal-mark' }));
    const total = h('p', { class: 'bg-total' }, totalNum, totalRest);
    const said = h('p', { class: 'sr-only', 'aria-live': 'polite' });
    const board = h('div', { class: 'bg-grid' });
    const side = h('div', { class: 'bg-side', 'aria-label': 'Row scores' }, Array.from({ length: 5 }, () => h('span')));
    const snakeEl = h('p', { class: 'bg-snake' });
    const tray = h('div', { class: 'bg-tray', 'aria-label': 'Tiles' });
    root.append(h('div', { class: 'bg-head' }, total, goalBar), h('div', { class: 'board bg-board' }, board, side), snakeEl, tray, said);

    const tileAt = (cell) => used.findIndex((c) => c === cell);
    const rectOf = (el) => (el ? el.getBoundingClientRect() : null);
    const trayTile = (t) => tray.querySelector(`[data-t="${t}"]`);
    const cellTile = (i) => board.children[i]?.querySelector('.bg-face');

    function tapTile(t) { sel = sel === t ? null : t; render(); }
    function tapCell(i) {
      if (locked.has(i)) { const el = board.children[i]; el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); return; }
      const here = tileAt(i);
      if (sel === null) {
        if (here >= 0) { cue.fly = { from: rectOf(cellTile(i)), to: () => trayTile(here) }; used[here] = -1; grid[i] = ''; render(); } // pick it back up
        return;
      }
      cue.fly = { from: rectOf(used[sel] >= 0 ? cellTile(used[sel]) : trayTile(sel)), to: () => cellTile(i), land: true };
      if (here >= 0) used[here] = -1;
      if (used[sel] >= 0) grid[used[sel]] = '';
      used[sel] = i; grid[i] = p.tiles[sel];
      sel = null;
      if (!check()) render();
    }

    function check() {
      const s = scoreBoard(p, grid);
      best = Math.max(best, grid.every(Boolean) ? s.total : 0);
      if (!done && grid.every(Boolean)) {
        done = true;
        cue.win = true;
        render();
        ctx.solved(`${s.total.toLocaleString()} points (goal ${p.target.toLocaleString()})`, { value: s.total, higher: true, fmt: (v) => `${v.toLocaleString()} pts` });
        return true; // already rendered, with the win wave
      }
      return false;
    }

    // a tile slides from where it was to where it went, and lands with a little bump
    function flyFrom(from, el, land) {
      if (!from || !el || calm() || !el.animate) return;
      const b = el.getBoundingClientRect();
      if (!b.width) return;
      const dx = from.left + from.width / 2 - (b.left + b.width / 2), dy = from.top + from.height / 2 - (b.top + b.height / 2);
      const sc = from.width / b.width;
      el.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${sc * 1.08}) rotate(-4deg)`, boxShadow: '0 14px 18px -6px rgb(0 0 0 / 0.35)', zIndex: 6 },
        { transform: 'translate(0, -4px) scale(1.06)', offset: 0.7, zIndex: 6 },
        ...(land ? [{ transform: 'scale(0.94, 0.9)', offset: 0.86, zIndex: 6 }] : []),
        { transform: 'none', zIndex: 6 },
      ], { duration: land ? 340 : 280, easing: 'cubic-bezier(0.25, 0.8, 0.3, 1)' });
    }

    let prev = null; // last render's scores
    function render() {
      const s = scoreBoard(p, grid);
      const first = !prev;
      tick(totalNum, prev?.total, s.total);
      totalRest.textContent = ` points · goal ${p.target.toLocaleString()}` + (best ? ` · best ${best.toLocaleString()}` : '');
      goalFill.style.width = `${Math.min(100, (s.total / Math.max(1, p.target)) * 100)}%`;
      goalBar.setAttribute('aria-valuenow', s.total);
      goalBar.classList.toggle('met', s.total >= p.target);

      // rows whose word is new or better ripple; the bonus word shimmers when it forms
      const rowNew = s.rows.map((row, r) => !first && row && (!prev.rows[r] || prev.rows[r].word !== row.word || prev.rows[r].start !== row.start) && !calm());
      const snakeNew = !first && s.snake && (!prev.snake || prev.snake.word !== s.snake.word) && !calm();

      put(board, grid.map((ch, i) => {
        const r = Math.floor(i / 5), c = i % 5, row = s.rows[r];
        const inWord = row && c >= row.start && c < row.end;
        const cls = 'bg-cell' + (snakeCells.has(i) ? ' snake' : '') + (p.mult[i] > 1 ? ` x${p.mult[i]}` : '') +
          (inWord ? ' word' + (c === row.start ? ' ws' : '') + (c === row.end - 1 ? ' we' : '') : '') +
          (locked.has(i) ? ' locked' : '') + (ch ? ' full' : '') + (sel !== null && !locked.has(i) ? ' ready' : '') +
          (inWord && rowNew[r] ? ' ripple' : '') + (snakeCells.has(i) && snakeNew ? ' shimmer' : '') +
          (cue.hint === i ? ' hinted' : '') + (cue.win && !calm() ? ' won' : '');
        return h('button', {
          class: cls, type: 'button', onClick: () => tapCell(i),
          style: { '--k': inWord ? c - row.start : r, '--d': r + c, '--r': r },
          'aria-label': ch ? `${ch.toUpperCase()}, ${VALUES[ch]} points${p.mult[i] > 1 ? `, on a ${p.mult[i]}× square` : ''}${locked.has(i) ? ', locked' : ''}` : p.mult[i] > 1 ? `${p.mult[i]}× square` : 'Empty',
        }, ch
          ? h('span', { class: 'bg-face' }, h('b', {}, ch.toUpperCase()), h('small', {}, VALUES[ch]))
          : p.mult[i] > 1 ? h('em', {}, `${p.mult[i]}×`) : null);
      }));

      // row scores tick up beside the board
      s.rows.forEach((row, r) => {
        const el = side.children[r];
        el.className = row ? 'ok' : '';
        el.setAttribute('aria-label', row ? `Row ${r + 1}: ${row.word.toUpperCase()}, ${row.points} points` : `Row ${r + 1}: no word`);
        if (row) tick(el, prev?.rows[r]?.points ?? (first ? null : 0), row.points); else el.textContent = '·';
        if (rowNew[r] || (!first && row && prev.rows[r] && row.points !== prev.rows[r].points && !calm())) { void el.offsetWidth; el.classList.add('pop'); }
      });
      put(snakeEl, s.snake
        ? [h('span', {}, 'Bonus word '), h('b', { class: snakeNew ? 'shine' : '' }, s.snake.word.toUpperCase()), h('span', {}, ` +${s.snake.points}`)]
        : h('span', {}, 'Shaded squares spell a bonus word'));
      snakeEl.classList.toggle('on', !!s.snake);

      // spoken feedback for the moment that just happened
      const news = s.rows.map((row, r) => (rowNew[r] ? `Row ${r + 1}: ${row.word.toUpperCase()}, ${row.points}` : null)).filter(Boolean);
      if (snakeNew) news.push(`Bonus word ${s.snake.word.toUpperCase()}`);
      if (news.length) said.textContent = news.join('. ');

      // tray: unused tiles, sorted
      const free = p.tiles.map((ch, t) => ({ ch, t })).filter(({ t }) => used[t] < 0).sort((a, b) => (a.ch < b.ch ? -1 : a.ch > b.ch ? 1 : a.t - b.t));
      put(tray, free.map(({ ch, t }) => h('button', {
        class: 'bg-tile' + (sel === t ? ' sel' : ''), type: 'button', 'data-t': t, onClick: (e) => { e.currentTarget.blur(); tapTile(t); },
        'aria-pressed': sel === t ? 'true' : 'false', 'aria-label': `${ch.toUpperCase()}, ${VALUES[ch]} points`,
      }, h('span', { class: 'bg-face' }, h('b', {}, ch.toUpperCase()), h('small', {}, VALUES[ch])))));
      tray.classList.toggle('picking', sel !== null);
      board.classList.toggle('solved', done);

      if (cue.fly) { const f = cue.fly; flyFrom(f.from, f.to(), f.land); }
      cue = { fly: null, win: false, hint: null };
      prev = s;
      ctx.save({ grid, used, locked: [...locked], done, best });
    }
    render();

    return {
      hint() {
        // put one planted tile in its square and lock it
        const i = [...Array(25).keys()].find((c) => !locked.has(c) && grid[c] !== p.solution[c]);
        if (i === undefined) return false;
        const here = tileAt(i);
        if (here >= 0) { used[here] = -1; grid[i] = ''; }
        let t = p.tiles.findIndex((ch, k) => ch === p.solution[i] && used[k] < 0);
        let from = null;
        if (t < 0) {
          // the letter is on the board somewhere else; move it
          t = p.tiles.findIndex((ch, k) => ch === p.solution[i] && used[k] >= 0 && !locked.has(used[k]));
          if (t < 0) return false;
          from = rectOf(cellTile(used[t]));
          grid[used[t]] = '';
        } else from = rectOf(trayTile(t));
        cue.fly = { from, to: () => cellTile(i), land: true };
        cue.hint = i;
        used[t] = i; grid[i] = p.solution[i]; locked.add(i); sel = null;
        if (!check()) render();
        return `Placed ${p.solution[i].toUpperCase()}`;
      },
      reveal() {
        used.fill(-1); grid.fill('');
        for (let i = 0; i < 25; i++) { const t = p.tiles.findIndex((ch, k) => ch === p.solution[i] && used[k] < 0); used[t] = i; grid[i] = p.solution[i]; locked.add(i); }
        done = true; render();
      },
    };
  },
};
