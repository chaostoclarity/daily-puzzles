import { h, put, s, cellAt, shake } from '../lib/ui.js';
import { generateThreads, threadsNeighbors } from '../gen/threads.js';
import { isWord } from '../lib/words.js';

export default {
  id: 'threads',
  version: 2, // bump when the generator changes, so old saves don't load onto a new board
  name: 'Threads',
  tagline: 'Find the theme words that fill the grid',
  inspired: 'Strands',
  slow: true,
  generate: generateThreads,
  rules: [
    'Every letter belongs to a word that fits the theme. Words can bend in any direction, diagonals included, but never cross.',
    'One special word, the span, names the theme and stretches from the left edge to the right edge.',
    'Drag through letters to spell a word, or tap them one at a time and tap the last letter again.',
    'The clue at the top is a dictionary definition of the theme.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const { rows, cols, grid: letters, words } = p;
    const saved = ctx.load();
    const found = new Set(saved?.found || []);
    const hinted = { ...(saved?.hinted || {}) };
    let done = !!saved?.done;
    let sel = [];
    const owner = new Array(rows * cols).fill(-1);
    words.forEach((w, i) => w.cells.forEach((c) => (owner[c] = i)));
    const nameRe = new RegExp(`\\b${p.name.replace(/ /g, '\\s')}s?\\b`, 'gi');
    const clue = p.theme.replace(nameRe, '___');

    const cells = [];
    const gridEl = h('div', { class: 'weave-grid', style: { '--c': cols, '--r': rows }, role: 'grid', 'aria-label': 'Letter grid' });
    letters.forEach((ch, c) => { const el = h('div', { class: 'weave-cell', 'data-cell': c, role: 'gridcell' }, ch.toUpperCase()); cells.push(el); gridEl.append(el); });
    const svg = s('svg', { class: 'weave-svg', viewBox: `0 0 ${cols} ${rows}`, 'aria-hidden': 'true' });
    const board = h('div', { class: 'board weave-board threads-board', style: { aspectRatio: `${cols} / ${rows}` } }, gridEl, svg);
    const themeBox = h('div', { class: 'clue-bar' }, h('span', { class: 'clue-tag' }, 'Theme'), clue);
    const current = h('div', { class: 'weave-current', 'aria-live': 'polite' }, ' ');
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    root.append(themeBox, current, board, h('div', { class: 'row-actions' }, h('button', { class: 'btn', type: 'button', onClick: () => { sel = []; render(); } }, 'Clear selection')), status);

    const adj = (a, b) => threadsNeighbors(rows, cols, a).includes(b);
    const usable = (c) => c !== null && !found.has(owner[c]);

    function extend(c) {
      if (!usable(c)) return false;
      const last = sel[sel.length - 1];
      if (c === last) return false;
      if (c === sel[sel.length - 2]) { sel.pop(); render(); return true; }
      if (sel.includes(c) || !adj(last, c)) return false;
      sel.push(c); render(); return true;
    }

    function submit() {
      if (sel.length < 3) { sel = []; render(); return; }
      const word = sel.map((c) => letters[c]).join('');
      const match = words.findIndex((w, i) => !found.has(i) && w.cells.length === sel.length && w.cells.every((c, k) => c === sel[k]));
      if (match !== -1) {
        found.add(match);
        if (words[match].span) ctx.toast('Span found!');
        sel = []; render();
        if (found.size === words.length && !done) { done = true; board.classList.add('solved'); status.textContent = 'Theme complete.'; render(); ctx.solved(); }
        return;
      }
      const same = words.some((w, i) => !found.has(i) && w.word === word);
      ctx.toast(same ? 'Right word, different path' : isWord(word, 50) && word.length >= 4 ? 'A word, but not a theme word' : 'Not a word');
      shake(current); sel = []; render();
    }

    let drag = null;
    gridEl.addEventListener('pointerdown', (e) => {
      if (done) return;
      const c = cellAt(e);
      if (c === null || !usable(c)) return;
      e.preventDefault();
      gridEl.setPointerCapture(e.pointerId);
      const last = sel[sel.length - 1];
      if (sel.length && c === last) { drag = { tapSubmit: true }; return; }
      if (sel.length && adj(last, c) && !sel.includes(c)) { sel.push(c); drag = { moved: false }; render(); return; }
      sel = [c]; drag = { moved: false }; render();
    });
    gridEl.addEventListener('pointermove', (e) => { if (drag && !drag.tapSubmit && extend(cellAt(e))) drag.moved = true; });
    gridEl.addEventListener('pointerup', () => { if (!drag) return; const d = drag; drag = null; if (d.tapSubmit || (d.moved && sel.length >= 3)) submit(); });
    gridEl.addEventListener('pointercancel', () => { drag = null; });

    function render() {
      const selSet = new Set(sel);
      cells.forEach((el, c) => {
        const o = owner[c];
        const f = found.has(o);
        el.className = 'weave-cell' + (f ? (words[o].span ? ' found span' : ' found theme') : '') + (selSet.has(c) ? ' sel' : '')
          + (!f && words[o].cells.indexOf(c) < (hinted[o] || 0) ? ' hinted' : '');
      });
      svg.replaceChildren();
      const pt = (c) => `${(c % cols) + 0.5},${Math.floor(c / cols) + 0.5}`;
      for (const i of found) svg.append(s('polyline', { class: 'weave-line ' + (words[i].span ? 'span' : 'theme'), points: words[i].cells.map(pt).join(' ') }));
      if (sel.length > 1) svg.append(s('polyline', { class: 'weave-line sel', points: sel.map(pt).join(' ') }));
      current.textContent = sel.length ? sel.map((c) => letters[c]).join('').toUpperCase() : ' ';
      if (!done) status.textContent = `${found.size} of ${words.length} theme words found${[...found].some((i) => words[i].span) ? ', span included' : ''}`;
      ctx.save({ found: [...found], hinted, done });
    }
    render();
    if (done) board.classList.add('solved');
    return {
      hint() {
        if (done) return false;
        const open = words.map((_, i) => i).filter((i) => !found.has(i));
        const i = open.find((x) => (hinted[x] || 0) > 0) ?? open.sort((a, b) => words[a].word.length - words[b].word.length)[0];
        hinted[i] = (hinted[i] || 0) + 1;
        if (hinted[i] >= words[i].word.length) {
          found.add(i);
          if (found.size === words.length) { done = true; board.classList.add('solved'); status.textContent = 'Theme complete.'; render(); ctx.solved(); return 'Last word revealed'; }
          render();
          return `Revealed ${words[i].word.toUpperCase()}`;
        }
        render();
        return `Letter ${hinted[i]} of a ${words[i].word.length}-letter word`;
      },
      reveal() { words.forEach((_, i) => found.add(i)); done = true; sel = []; board.classList.add('solved'); render(); status.textContent = 'Solution shown.'; ctx.save({ found: [...found], hinted, done, revealed: true }); },
    };
  },
};
