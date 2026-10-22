import { h, put, keyboard } from '../lib/ui.js';
import { generateMini } from '../gen/mini.js';

export default {
  id: 'mini',
  name: 'Mini Crossword',
  tagline: 'A small grid with dictionary clues',
  inspired: 'The Mini',
  generate: generateMini,
  rules: [
    'Fill the grid so every across and down entry answers its clue.',
    'Tap a square to choose it. Tap it again to switch between across and down.',
    'Tap the clue bar or a clue in the list to jump to that entry.',
    'Check marks wrong letters in red. Reveal fills in the current entry.',
    'Clues come from a dictionary. Hard swaps definitions for one-word synonyms where it can.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const { n, solution, clues, numAt } = p;
    const blocks = new Set(p.blocks);
    const saved = ctx.load();
    const fill = saved?.fill || new Array(n * n).fill('');
    const wrong = new Set(saved?.wrong || []);
    const hinted = new Set(saved?.hinted || []);
    let done = !!saved?.done;
    let dir = 'across';
    let pos = saved?.pos ?? [...Array(n * n).keys()].find((c) => !blocks.has(c));

    const clueOf = (cell, d) => clues.find((c) => c.dir === d && c.cells.includes(cell));
    const activeClue = () => clueOf(pos, dir) || clueOf(pos, dir === 'across' ? 'down' : 'across');

    const cells = [];
    const grid = h('div', { class: 'mini-grid', style: { '--n': n }, role: 'grid', 'aria-label': 'Crossword grid' });
    for (let c = 0; c < n * n; c++) {
      const el = blocks.has(c)
        ? h('div', { class: 'mini-cell block', 'aria-hidden': 'true' })
        : h('div', { class: 'mini-cell', 'data-cell': c, role: 'gridcell', onClick: () => select(c) },
          numAt[c] ? h('span', { class: 'mini-num' }, numAt[c]) : null, h('span', { class: 'mini-letter' }));
      cells.push(el); grid.append(el);
    }
    const bar = h('button', { class: 'clue-bar mini-bar', type: 'button', onClick: () => step(1) });
    const lists = h('div', { class: 'mini-lists' });
    const kb = keyboard(onKey);
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    root.append(bar, h('div', { class: 'board' }, grid),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn', type: 'button', onClick: check }, 'Check'),
        h('button', { class: 'btn', type: 'button', onClick: revealWord }, 'Reveal word')),
      status, kb.el, lists);

    function select(c) {
      if (c === pos) {
        const other = dir === 'across' ? 'down' : 'across';
        if (clueOf(c, other)) dir = other;
      } else {
        pos = c;
        if (!clueOf(c, dir)) dir = dir === 'across' ? 'down' : 'across';
      }
      render();
    }

    function step(d) {
      const ac = activeClue();
      const i = clues.indexOf(ac);
      const next = clues[(i + d + clues.length) % clues.length];
      dir = next.dir;
      pos = next.cells.find((c) => !fill[c]) ?? next.cells[0];
      render();
    }

    function check() {
      wrong.clear();
      for (let c = 0; c < n * n; c++) if (fill[c] && fill[c] !== solution[c]) wrong.add(c);
      ctx.toast(wrong.size ? `${wrong.size} square${wrong.size > 1 ? 's' : ''} wrong` : 'Everything filled in so far is right');
      render();
    }
    function revealWord() {
      if (done) return;
      for (const c of activeClue().cells) { fill[c] = solution[c]; wrong.delete(c); }
      render();
    }

    function onKey(k) {
      if (done) return;
      const ac = activeClue();
      const idx = ac.cells.indexOf(pos);
      if (k.length === 1) {
        fill[pos] = k; wrong.delete(pos);
        // next empty in this entry, else next entry
        const after = ac.cells.slice(idx + 1).find((c) => !fill[c]);
        if (after !== undefined) pos = after;
        else if (ac.cells.some((c) => !fill[c])) pos = ac.cells.find((c) => !fill[c]);
        else if (idx < ac.cells.length - 1) pos = ac.cells[idx + 1];
        else { render(); return step(1); }
      } else if (k === 'back') {
        if (fill[pos]) fill[pos] = '';
        else if (idx > 0) { pos = ac.cells[idx - 1]; fill[pos] = ''; }
        wrong.delete(pos);
      } else if (k === 'enter' || k === 'tab') return step(1);
      else if (k === 'shifttab') return step(-1);
      else if (k === 'space') return select(pos);
      else if (['up', 'down', 'left', 'right'].includes(k)) {
        const want = k === 'left' || k === 'right' ? 'across' : 'down';
        if (dir !== want && clueOf(pos, want)) { dir = want; return render(); }
        const d = { up: -n, down: n, left: -1, right: 1 }[k];
        let c = pos;
        while (true) {
          const r0 = Math.floor(c / n);
          c += d;
          if (c < 0 || c >= n * n || ((k === 'left' || k === 'right') && Math.floor(c / n) !== r0)) break;
          if (!blocks.has(c)) { pos = c; break; }
        }
      } else return;
      render();
    }

    function render() {
      const ac = activeClue();
      const inWord = new Set(ac.cells);
      cells.forEach((el, c) => {
        if (blocks.has(c)) return;
        el.classList.toggle('word', inWord.has(c));
        el.classList.toggle('cur', c === pos);
        el.classList.toggle('wrong', wrong.has(c));
        el.classList.toggle('hinted', hinted.has(c));
        el.querySelector('.mini-letter').textContent = fill[c].toUpperCase();
      });
      put(bar, h('span', { class: 'clue-tag' }, `${ac.num} ${ac.dir === 'across' ? 'Across' : 'Down'}`), h('span', {}, ac.clue));
      put(lists, ...['across', 'down'].map((d) => h('div', { class: 'mini-list' },
        h('h3', {}, d === 'across' ? 'Across' : 'Down'),
        h('ol', {}, clues.filter((c) => c.dir === d).map((c) => h('li', {
          class: (c === ac ? 'on' : '') + (c.cells.every((x) => fill[x]) ? ' filled' : ''),
          onClick: () => { dir = c.dir; pos = c.cells.find((x) => !fill[x]) ?? c.cells[0]; render(); },
        }, h('b', {}, c.num), ' ', c.clue))))));
      if (!done && fill.every((v, c) => blocks.has(c) || v === solution[c])) {
        done = true;
        grid.classList.add('solved');
        status.textContent = 'Grid complete.';
        ctx.solved();
      } else if (!done && fill.every((v, c) => blocks.has(c) || v)) status.textContent = 'The grid is full but something is off. Try Check.';
      else if (!done) status.textContent = '';
      ctx.save({ fill, wrong: [...wrong], hinted: [...hinted], done, pos });
    }
    render();
    if (done) grid.classList.add('solved');
    return {
      onKey,
      hint() {
        if (done) return false;
        const ac = activeClue();
        let c = fill[pos] !== solution[pos] ? pos : ac.cells.find((x) => fill[x] !== solution[x]);
        if (c === undefined) c = [...Array(n * n).keys()].find((x) => !blocks.has(x) && fill[x] !== solution[x]);
        fill[c] = solution[c]; wrong.delete(c); hinted.add(c); pos = c;
        render();
        return `Filled in ${solution[c].toUpperCase()}`;
      },
      reveal() { for (let c = 0; c < n * n; c++) fill[c] = blocks.has(c) ? '' : solution[c]; wrong.clear(); done = true; grid.classList.add('solved'); render(); status.textContent = 'Solution shown.'; ctx.save({ fill, done, revealed: true }); },
    };
  },
};
