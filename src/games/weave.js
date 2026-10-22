import { h, put, s, cellAt, shake } from '../lib/ui.js';
import { generateWeave, weaveNeighbors } from '../gen/weave.js';
import { isWord } from '../lib/words.js';

export default {
  id: 'weave',
  name: 'Weave',
  tagline: 'Split the grid into hidden words',
  inspired: 'Wend',
  generate: generateWeave,
  rules: [
    'The grid hides several words. Every letter belongs to exactly one of them.',
    'Spell a word by dragging through letters that sit side by side: up, down, left or right.',
    'You can also tap letters one at a time, then tap the last letter again to submit.',
    'The slots show how many letters each word has. Find them all to clear the board.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const { rows, cols, grid: letters, words } = p;
    const saved = ctx.load();
    const found = new Set(saved?.found || []); // indices into words
    const hinted = new Set(saved?.hinted || []);
    let done = !!saved?.done;
    let sel = [];
    const owner = new Array(rows * cols).fill(-1);
    words.forEach((w, i) => w.cells.forEach((c) => (owner[c] = i)));
    const slotOrder = [...words.keys()].sort((a, b) => words[a].word.length - words[b].word.length || a - b);

    const cells = [];
    const gridEl = h('div', { class: 'weave-grid', style: { '--c': cols, '--r': rows }, role: 'grid', 'aria-label': 'Letter grid' });
    letters.forEach((ch, c) => {
      const el = h('div', { class: 'weave-cell', 'data-cell': c, role: 'gridcell' }, ch.toUpperCase());
      cells.push(el); gridEl.append(el);
    });
    const svg = s('svg', { class: 'weave-svg', viewBox: `0 0 ${cols} ${rows}`, 'aria-hidden': 'true' });
    const board = h('div', { class: 'board weave-board', style: { aspectRatio: `${cols} / ${rows}` } }, gridEl, svg);
    const current = h('div', { class: 'weave-current', 'aria-live': 'polite' }, ' ');
    const slots = h('div', { class: 'weave-slots' });
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    root.append(current, board,
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn', type: 'button', onClick: hint }, 'Hint'),
        h('button', { class: 'btn', type: 'button', onClick: () => { sel = []; render(); } }, 'Clear selection')),
      slots, status);

    const adj = (a, b) => weaveNeighbors(rows, cols, a).includes(b);
    const usable = (c) => owner[c] === -1 || !found.has(owner[c]);

    function extend(c) {
      if (c === null || !usable(c)) return false;
      const last = sel[sel.length - 1];
      if (c === last) return false;
      if (c === sel[sel.length - 2]) { sel.pop(); render(); return true; }
      if (sel.includes(c) || !adj(last, c)) return false;
      sel.push(c); render(); return true;
    }

    function submit() {
      if (sel.length < 2) { sel = []; render(); return; }
      const word = sel.map((c) => letters[c]).join('');
      const match = words.findIndex((w, i) => !found.has(i) && w.cells.length === sel.length && w.cells.every((c, k) => c === sel[k]));
      if (match !== -1) {
        found.add(match);
        sel = [];
        render();
        if (found.size === words.length && !done) {
          done = true; board.classList.add('solved');
          status.textContent = 'Every letter placed.';
          ctx.solved();
          ctx.save(state());
        }
        return;
      }
      const sameWord = words.some((w, i) => !found.has(i) && w.word === word);
      ctx.toast(sameWord ? 'That word is in here, on a different path' : isWord(word, 50) && word.length >= 3 ? 'A real word, but not one of the hidden ones' : 'Not a word');
      shake(current);
      sel = []; render();
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
    gridEl.addEventListener('pointermove', (e) => {
      if (!drag || drag.tapSubmit) return;
      if (extend(cellAt(e))) drag.moved = true;
    });
    gridEl.addEventListener('pointerup', () => {
      if (!drag) return;
      const d = drag; drag = null;
      if (d.tapSubmit || (d.moved && sel.length >= 3)) submit();
    });
    gridEl.addEventListener('pointercancel', () => { drag = null; });

    function hint() {
      if (done) return;
      const left = slotOrder.filter((i) => !found.has(i) && !hinted.has(i));
      if (!left.length) { ctx.toast('Every remaining word already has a hint'); return; }
      hinted.add(left[0]);
      render();
    }

    const state = () => ({ found: [...found], hinted: [...hinted], done });

    function render() {
      const selSet = new Set(sel);
      cells.forEach((el, c) => {
        const o = owner[c];
        const isFound = found.has(o);
        el.className = 'weave-cell' + (isFound ? ` found w${slotOrder.indexOf(o) % 8}` : '') + (selSet.has(c) ? ' sel' : '') + (hinted.has(o) && !isFound && words[o].cells[0] === c ? ' hinted' : '');
      });
      put(svg, );
      const pt = (c) => `${(c % cols) + 0.5},${Math.floor(c / cols) + 0.5}`;
      for (const i of found) svg.append(s('polyline', { class: `weave-line w${slotOrder.indexOf(i) % 8}`, points: words[i].cells.map(pt).join(' ') }));
      if (sel.length > 1) svg.append(s('polyline', { class: 'weave-line sel', points: sel.map(pt).join(' ') }));
      current.textContent = sel.length ? sel.map((c) => letters[c]).join('').toUpperCase() : ' ';
      put(slots, ...slotOrder.map((i) => {
        const w = words[i];
        const f = found.has(i);
        return h('div', { class: 'weave-slot' + (f ? ` found w${slotOrder.indexOf(i) % 8}` : ''), 'aria-label': f ? w.word : `${w.word.length} letters` },
          [...w.word].map((ch, k) => h('span', {}, f || (k === 0 && hinted.has(i)) ? ch.toUpperCase() : '')));
      }));
      if (!done) status.textContent = `${found.size} of ${words.length} words found`;
      ctx.save(state());
    }
    render();
    if (done) board.classList.add('solved');
    return {
      reveal() { words.forEach((_, i) => found.add(i)); done = true; sel = []; board.classList.add('solved'); render(); status.textContent = 'Solution shown.'; ctx.save({ ...state(), revealed: true }); },
    };
  },
};
