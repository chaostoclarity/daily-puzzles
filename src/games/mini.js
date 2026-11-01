import './mini.css';
import { h, put, keyboard } from '../lib/ui.js';
import { generateMini } from '../gen/mini.js';

export default {
  id: 'mini',
  name: 'Mini Crossword',
  tagline: 'A small grid with dictionary clues',
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
    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

    // The grid is printed: ruled squares on paper with solid ink blocks. Under the squares sit two
    // highlights that glide from entry to entry and square to square as you move.
    const band = h('div', { class: 'mc-band', 'aria-hidden': 'true' });
    const cursor = h('div', { class: 'mc-cursor', 'aria-hidden': 'true' });
    const cells = [];
    const grid = h('div', { class: 'mini-grid', style: { '--n': n }, role: 'grid', 'aria-label': 'Crossword grid' }, band, cursor);
    for (let c = 0; c < n * n; c++) {
      const edge = (c % n === n - 1 ? ' lc' : '') + (c >= n * (n - 1) ? ' lr' : '');
      const el = blocks.has(c)
        ? h('div', { class: 'mini-cell block' + edge, 'aria-hidden': 'true' })
        : h('div', { class: 'mini-cell' + edge, 'data-cell': c, role: 'gridcell', onClick: () => select(c) },
          numAt[c] ? h('span', { class: 'mini-num' }, numAt[c]) : null, h('span', { class: 'mini-letter' }));
      el.style.setProperty('--d', Math.floor(c / n) + (c % n)); // diagonal, for the win cascade
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
      // wrong squares shake; the right ones give a quick nod
      for (let c = 0; c < n * n; c++) if (fill[c] && !done) replay(cells[c], wrong.has(c) ? 'nope' : 'okay');
    }
    function revealWord() {
      if (done) return;
      for (const c of activeClue().cells) { fill[c] = solution[c]; wrong.delete(c); }
      render();
    }

    let popCell = -1;
    function onKey(k) {
      if (done) return;
      const ac = activeClue();
      const idx = ac.cells.indexOf(pos);
      if (k.length === 1) {
        fill[pos] = k; wrong.delete(pos); popCell = pos;
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

    // where a highlight sits, in squares
    function place(el, list) {
      const rs = list.map((c) => Math.floor(c / n)), cs = list.map((c) => c % n);
      const r0 = Math.min(...rs), c0 = Math.min(...cs);
      el.style.setProperty('--r', r0); el.style.setProperty('--c', c0);
      el.style.setProperty('--w', Math.max(...cs) - c0 + 1); el.style.setProperty('--h', Math.max(...rs) - r0 + 1);
    }

    const isFull = (cl) => cl.cells.every((x) => fill[x]);
    let full = new Set(clues.filter(isFull)); // entries already filled, so only new ones sweep
    let shownClue = null;
    function render() {
      const ac = activeClue();
      place(band, ac.cells);
      place(cursor, [pos]);
      cells.forEach((el, c) => {
        if (blocks.has(c)) return;
        el.classList.toggle('word', ac.cells.includes(c));
        el.classList.toggle('cur', c === pos);
        el.classList.toggle('wrong', wrong.has(c));
        el.classList.toggle('hinted', hinted.has(c));
        el.querySelector('.mini-letter').textContent = fill[c].toUpperCase();
      });
      if (popCell >= 0) { replay(cells[popCell], 'pop'); popCell = -1; }
      // an entry that has just been filled in gets a sweep along its squares
      const nowFull = new Set(clues.filter(isFull));
      for (const cl of nowFull) if (!full.has(cl)) cl.cells.forEach((x, i) => { cells[x].style.setProperty('--k', i); replay(cells[x], 'sweep'); });
      full = nowFull;
      if (ac !== shownClue) {
        // the clue bar slides to the new clue: forward when moving on, back when moving back
        const back = shownClue && clues.indexOf(ac) < clues.indexOf(shownClue);
        put(bar, h('span', { class: 'mc-clue' + (shownClue ? (back ? ' in-back' : ' in') : '') },
          h('span', { class: 'clue-tag' }, `${ac.num} ${ac.dir === 'across' ? 'Across' : 'Down'}`), h('span', {}, ac.clue)));
        shownClue = ac;
      }
      put(lists, ...['across', 'down'].map((d) => h('div', { class: 'mini-list' },
        h('h3', {}, d === 'across' ? 'Across' : 'Down'),
        h('ol', {}, clues.filter((c) => c.dir === d).map((c) => h('li', {
          class: (c === ac ? 'on' : '') + (c.cells.every((x) => fill[x]) ? ' filled' : ''),
          onClick: () => { dir = c.dir; pos = c.cells.find((x) => !fill[x]) ?? c.cells[0]; render(); },
        }, h('b', {}, c.num), ' ', c.clue))))));
      if (!done && fill.every((v, c) => blocks.has(c) || v === solution[c])) {
        done = true;
        grid.classList.add('solved', 'done');
        replay(grid, 'win');
        status.textContent = 'Grid complete.';
        ctx.solved();
      } else if (!done && fill.every((v, c) => blocks.has(c) || v)) status.textContent = 'The grid is full but something is off. Try Check.';
      else if (!done) status.textContent = '';
      ctx.save({ fill, wrong: [...wrong], hinted: [...hinted], done, pos });
    }
    // one-shot effects clear themselves once played, so the next one can play on the same square
    const ONCE = { 'mc-pop': 'pop', 'mc-hop': 'sweep', 'mc-nope': 'nope', 'mc-okay': 'okay' };
    grid.addEventListener('animationend', (e) => { const cls = ONCE[e.animationName]; if (cls) e.target.closest('.mini-cell')?.classList.remove(cls); });
    render();
    if (done) grid.classList.add('solved', 'done');
    return {
      onKey,
      hint() {
        if (done) return false;
        const ac = activeClue();
        let c = fill[pos] !== solution[pos] ? pos : ac.cells.find((x) => fill[x] !== solution[x]);
        if (c === undefined) c = [...Array(n * n).keys()].find((x) => !blocks.has(x) && fill[x] !== solution[x]);
        fill[c] = solution[c]; wrong.delete(c); hinted.add(c); pos = c;
        popCell = c;
        render();
        return `Filled in ${solution[c].toUpperCase()}`;
      },
      reveal() {
        for (let c = 0; c < n * n; c++) fill[c] = blocks.has(c) ? '' : solution[c];
        wrong.clear(); done = true; grid.classList.add('solved', 'done'); replay(grid, 'shown');
        render(); status.textContent = 'Solution shown.'; ctx.save({ fill, done, revealed: true });
      },
    };
  },
};
