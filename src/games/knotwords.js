import { h, put, shake } from '../lib/ui.js';
import { generateKnotwords, ACCEPT_TIER } from '../gen/knotwords.js';
import { isWord } from '../lib/words.js';

export default {
  id: 'knotwords',
  name: 'Knatwords',
  tagline: 'A crossword with no clues',
  version: 1,
  generate: generateKnotwords,
  rules: [
    'The board is split into outlined regions. Each region lists the letters that go inside it, in any order.',
    'Fill every square so each run of letters across and down spells a word.',
    'Tap a square, then tap a letter below it (or type). Tap a filled square again to clear it.',
    'There is exactly one way to fill the board.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const n = p.n;
    const saved = ctx.load();
    const grid = saved?.grid || new Array(n * n).fill('');
    const locked = new Set(saved?.locked || []);
    let done = !!saved?.done;
    let sel = p.open.indexOf(true);

    const firstCell = p.regions.map((_, r) => p.regionOf.indexOf(r));
    const board = h('div', { class: 'kw-grid', style: { '--n': n }, role: 'grid', 'aria-label': 'Board' });
    const els = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n, reg = p.regionOf[i];
      if (!p.open[i]) { const el = h('div', { class: 'kw-hole' }); els.push(el); board.append(el); continue; }
      const edge = (j) => j < 0 || j >= n * n || p.regionOf[j] !== reg;
      const cls = ['kw-cell',
        c === n - 1 || edge(i + 1) ? 'er' : '', r === n - 1 || edge(i + n) ? 'eb' : '',
        c === 0 || edge(i - 1) ? 'el' : '', r === 0 || edge(i - n) ? 'et' : ''].join(' ');
      const el = h('button', { class: cls, type: 'button', onClick: () => tap(i) });
      els.push(el); board.append(el);
    }
    const tray = h('div', { class: 'kw-tray', 'aria-label': 'Letters for this region' });
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    root.append(h('div', { class: 'board kw-board' }, board), tray, status);

    const leftIn = (reg) => {
      const m = {};
      for (const ch of p.regions[reg]) m[ch] = (m[ch] || 0) + 1;
      for (let i = 0; i < n * n; i++) if (p.regionOf[i] === reg && grid[i]) m[grid[i]]--;
      return m;
    };

    function tap(i) {
      if (done) return;
      if (sel === i && grid[i] && !locked.has(i)) { grid[i] = ''; }
      sel = i;
      render();
    }
    function place(ch) {
      if (done || sel < 0 || locked.has(sel)) return;
      const reg = p.regionOf[sel];
      const m = leftIn(reg);
      if (grid[sel]) m[grid[sel]]++;
      if (!m[ch]) { shake(els[sel]); return; }
      grid[sel] = ch;
      // move to the next empty square in the same region, else the next empty square
      const order = [...Array(n * n).keys()];
      const next = order.find((j) => p.regionOf[j] === reg && !grid[j]) ?? order.find((j) => j > sel && p.open[j] && !grid[j]) ?? order.find((j) => p.open[j] && !grid[j]);
      if (next !== undefined) sel = next;
      check();
      render();
    }

    const runs = p.words.map((w) => w.cells);
    const runOk = (cells) => cells.every((c) => grid[c]) && isWord(cells.map((c) => grid[c]).join(''), ACCEPT_TIER);
    function check() {
      if (!p.open.every((o, i) => !o || grid[i])) return;
      if (runs.every(runOk)) { done = true; ctx.solved('board filled'); }
      else ctx.toast('Every square is filled, but some runs are not words');
    }

    function render() {
      const good = new Set(runs.filter(runOk).flat());
      for (let i = 0; i < n * n; i++) {
        if (!p.open[i]) continue;
        const reg = p.regionOf[i];
        const kids = [];
        if (firstCell[reg] === i) {
          const m = leftIn(reg);
          const shown = p.regions[reg].map((ch) => { const avail = m[ch] > 0; if (avail) m[ch]--; return h('i', { class: avail ? '' : 'gone' }, ch.toUpperCase()); });
          kids.push(h('span', { class: 'kw-key' }, shown));
        }
        kids.push(h('b', {}, (grid[i] || '').toUpperCase()));
        put(els[i], kids);
        els[i].classList.toggle('sel', i === sel && !done);
        els[i].classList.toggle('same', !done && sel >= 0 && p.regionOf[sel] === reg && i !== sel);
        els[i].classList.toggle('good', good.has(i));
        els[i].classList.toggle('locked', locked.has(i));
      }
      const reg = sel >= 0 ? p.regionOf[sel] : -1;
      if (done || reg < 0) put(tray, null);
      else {
        const m = leftIn(reg);
        if (grid[sel]) m[grid[sel]]++;
        const letters = [...new Set(p.regions[reg])];
        put(tray, letters.map((ch) => h('button', { class: 'kw-letter', type: 'button', disabled: !m[ch] || locked.has(sel), onClick: () => place(ch) }, ch.toUpperCase())));
      }
      const empty = p.open.filter((o, i) => o && !grid[i]).length;
      put(status, done ? 'Every run is a word.' : `${empty} square${empty === 1 ? '' : 's'} to fill`);
      board.classList.toggle('solved', done);
      ctx.save({ grid, locked: [...locked], done });
    }
    render();

    return {
      onKey(key) {
        if (done) return false;
        if (/^[a-z]$/.test(key)) { place(key); return true; }
        if (key === 'back') { if (sel >= 0 && !locked.has(sel)) { grid[sel] = ''; render(); } return true; }
        const d = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[key];
        if (d) {
          let r = Math.floor(sel / n) + d[0], c = (sel % n) + d[1];
          while (r >= 0 && c >= 0 && r < n && c < n && !p.open[r * n + c]) { r += d[0]; c += d[1]; }
          if (r >= 0 && c >= 0 && r < n && c < n) sel = r * n + c;
          render(); return true;
        }
        return false;
      },
      hint() {
        if (done) return false;
        // fix the selected square if it's wrong or empty, else the first such square
        const bad = (i) => p.open[i] && grid[i] !== p.solution[i];
        const i = bad(sel) ? sel : [...Array(n * n).keys()].find(bad);
        if (i === undefined) return false;
        // free the right letter if another square in the region is holding it
        const reg = p.regionOf[i];
        const m = leftIn(reg);
        if (grid[i]) m[grid[i]]++;
        if (!m[p.solution[i]]) {
          const j = [...Array(n * n).keys()].find((x) => p.regionOf[x] === reg && x !== i && grid[x] === p.solution[i] && !locked.has(x));
          if (j !== undefined) grid[j] = '';
        }
        grid[i] = p.solution[i];
        locked.add(i); sel = i;
        check();
        render();
        return `Placed ${p.solution[i].toUpperCase()}`;
      },
      reveal() {
        for (let i = 0; i < n * n; i++) if (p.open[i]) grid[i] = p.solution[i];
        done = true; render();
      },
    };
  },
};
