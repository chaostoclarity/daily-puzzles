import { h, put } from '../lib/ui.js';
import { generateBongo, scoreBoard, VALUES } from '../gen/bongo.js';

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

    const snakeCells = new Set(p.snake.map((c, r) => r * 5 + c));
    const total = h('p', { class: 'bg-total', 'aria-live': 'polite' });
    const board = h('div', { class: 'bg-grid' });
    const side = h('div', { class: 'bg-side' });
    const snakeEl = h('p', { class: 'bg-snake' });
    const tray = h('div', { class: 'bg-tray', 'aria-label': 'Tiles' });
    root.append(total, h('div', { class: 'board bg-board' }, board, side), snakeEl, tray);

    const tileAt = (cell) => used.findIndex((c) => c === cell);

    function tapTile(t) { sel = sel === t ? null : t; render(); }
    function tapCell(i) {
      if (locked.has(i)) return;
      const here = tileAt(i);
      if (sel === null) {
        if (here >= 0) { used[here] = -1; grid[i] = ''; render(); } // pick it back up
        return;
      }
      if (here >= 0) used[here] = -1;
      if (used[sel] >= 0) grid[used[sel]] = '';
      used[sel] = i; grid[i] = p.tiles[sel];
      sel = null;
      check();
      render();
    }

    function check() {
      const s = scoreBoard(p, grid);
      best = Math.max(best, grid.every(Boolean) ? s.total : 0);
      if (!done && grid.every(Boolean)) {
        done = true;
        ctx.solved(`${s.total.toLocaleString()} points (goal ${p.target.toLocaleString()})`);
      }
    }

    function render() {
      const s = scoreBoard(p, grid);
      put(total, h('b', {}, s.total.toLocaleString()), h('span', {}, ` points · goal ${p.target.toLocaleString()}` + (best ? ` · best ${best.toLocaleString()}` : '')));
      put(board, grid.map((ch, i) => {
        const r = Math.floor(i / 5), row = s.rows[r];
        const inWord = row && i % 5 >= row.start && i % 5 < row.end;
        return h('button', {
          class: 'bg-cell' + (snakeCells.has(i) ? ' snake' : '') + (p.mult[i] > 1 ? ` x${p.mult[i]}` : '') + (inWord ? ' word' : '') + (locked.has(i) ? ' locked' : ''),
          type: 'button', onClick: () => tapCell(i), 'aria-label': ch ? ch.toUpperCase() : p.mult[i] > 1 ? `${p.mult[i]}× square` : 'Empty',
        }, ch ? [h('b', {}, ch.toUpperCase()), h('small', {}, VALUES[ch])] : p.mult[i] > 1 ? h('em', {}, `${p.mult[i]}×`) : null);
      }));
      put(side, s.rows.map((row) => h('span', { class: row ? 'ok' : '' }, row ? row.points : '·')));
      put(snakeEl, s.snake ? [h('span', {}, 'Bonus word '), h('b', {}, s.snake.word.toUpperCase()), h('span', {}, ` +${s.snake.points}`)] : h('span', {}, 'Shaded squares spell a bonus word'));
      // tray: unused tiles, sorted
      const free = p.tiles.map((ch, t) => ({ ch, t })).filter(({ t }) => used[t] < 0).sort((a, b) => (a.ch < b.ch ? -1 : a.ch > b.ch ? 1 : a.t - b.t));
      put(tray, free.map(({ ch, t }) => h('button', { class: 'bg-tile' + (sel === t ? ' sel' : ''), type: 'button', onClick: () => tapTile(t) }, h('b', {}, ch.toUpperCase()), h('small', {}, VALUES[ch]))));
      board.classList.toggle('solved', done);
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
        if (t < 0) {
          // the letter is on the board somewhere else; move it
          t = p.tiles.findIndex((ch, k) => ch === p.solution[i] && used[k] >= 0 && !locked.has(used[k]));
          if (t < 0) return false;
          grid[used[t]] = '';
        }
        used[t] = i; grid[i] = p.solution[i]; locked.add(i); sel = null;
        check();
        render();
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
