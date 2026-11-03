import './threads.css';
import { h, put, s, cellAt, shake } from '../lib/ui.js';
import { calm, centerOf } from '../lib/celebrate.js';
import { generateThreads, threadsNeighbors } from '../gen/threads.js';
import { isWord } from '../lib/words.js';

export default {
  id: 'threads',
  version: 3, // bump when the generator changes, so old saves don't load onto a new board
  name: 'Strends',
  tagline: 'Find the theme words that fill the grid',
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

    // The one bold thing: the thread. Tracing lays a thick rounded stroke from letter to letter;
    // a found word's thread draws itself in and its letters lock in one by one; the span sweeps
    // across the board in highlighter yellow. Winning sends a ripple through every letter.
    const cells = [];
    const gridEl = h('div', { class: 'weave-grid', style: { '--c': cols, '--r': rows }, role: 'grid', 'aria-label': 'Letter grid' });
    letters.forEach((ch, c) => {
      const el = h('div', { class: 'weave-cell', 'data-cell': c, role: 'gridcell', style: { '--row': Math.floor(c / cols), '--col': c % cols } }, h('span', { class: 'th-l' }, ch.toUpperCase()));
      cells.push(el); gridEl.append(el);
    });
    const svg = s('svg', { class: 'weave-svg', viewBox: `0 0 ${cols} ${rows}`, 'aria-hidden': 'true' });
    const foundLayer = s('g', {});
    const selLine = s('polyline', { class: 'weave-line sel' });
    const tipLine = s('line', { class: 'th-tip', pathLength: '1' });
    svg.append(foundLayer, selLine, tipLine);
    const board = h('div', { class: 'board weave-board threads-board', style: { aspectRatio: `${cols} / ${rows}`, '--c': cols, '--r': rows } }, gridEl, svg);
    const themeBox = h('div', { class: 'clue-bar th-theme' }, h('span', { class: 'clue-tag' }, 'Theme'), clue);
    const current = h('div', { class: 'weave-current th-current', 'aria-live': 'polite' });
    const status = h('p', { class: 'hint-line th-status', 'aria-live': 'polite' });
    const clearBtn = h('button', { class: 'btn small', type: 'button', onClick: (e) => { e.currentTarget.blur(); sel = []; render(); } }, 'Clear');
    root.append(themeBox, current, board, h('div', { class: 'th-foot' }, status, clearBtn));

    const adj = (a, b) => threadsNeighbors(rows, cols, a).includes(b);
    const usable = (c) => c !== null && !found.has(owner[c]);
    const pt = (c) => [(c % cols) + 0.5, Math.floor(c / cols) + 0.5];
    const pts = (list) => list.map((c) => pt(c).join(',')).join(' ');
    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    // a transient class that clears itself, so the next render can't strand it
    const flash = (el, cls, ms) => { replay(el, cls); clearTimeout(el['_' + cls]); el['_' + cls] = setTimeout(() => el.classList.remove(cls), ms); };

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
        fresh = match;
        if (words[match].span) ctx.toast('Span found!');
        sel = []; render();
        if (words[match].span && found.size < words.length && !calm()) ctx.celebrate?.({ cannons: false, count: 0.5, origin: centerOf(board) });
        if (found.size === words.length && !done) win();
        return;
      }
      const same = words.some((w, i) => !found.has(i) && w.word === word);
      ctx.toast(same ? 'Right word, different path' : isWord(word, 50) && word.length >= 4 ? 'A word, but not a theme word' : 'Not a word');
      sel.forEach((c) => flash(cells[c], 'nope', 420));
      current.classList.add('bad');
      shake(current); sel = []; render(true);
      setTimeout(() => { if (current.classList.contains('bad')) { current.classList.remove('bad'); render(); } }, 520);
    }

    function win() {
      done = true; board.classList.add('solved'); status.textContent = 'Theme complete.'; render();
      // the ripple waits for the last thread to finish drawing in
      setTimeout(() => replay(board, 'th-win'), calm() ? 0 : 420);
      ctx.solved();
    }

    let drag = null;
    gridEl.addEventListener('pointerdown', (e) => {
      if (done) return;
      const c = cellAt(e);
      if (c === null || !usable(c)) return;
      e.preventDefault();
      current.classList.remove('bad');
      gridEl.setPointerCapture(e.pointerId);
      const last = sel[sel.length - 1];
      if (sel.length && c === last) { drag = { tapSubmit: true }; return; }
      if (sel.length && adj(last, c) && !sel.includes(c)) { sel.push(c); drag = { moved: false }; render(); return; }
      sel = [c]; drag = { moved: false }; render();
    });
    gridEl.addEventListener('pointermove', (e) => { if (drag && !drag.tapSubmit && extend(cellAt(e))) drag.moved = true; });
    gridEl.addEventListener('pointerup', () => { if (!drag) return; const d = drag; drag = null; if (d.tapSubmit || (d.moved && sel.length >= 3)) submit(); });
    gridEl.addEventListener('pointercancel', () => { drag = null; });

    let fresh = null, shownSel = [], shownHint = { ...hinted };
    const lines = new Map(); // word index -> polyline
    function render(keepWord = false) {
      const selSet = new Set(sel);
      const prev = new Set(shownSel);
      cells.forEach((el, c) => {
        const o = owner[c];
        const f = found.has(o);
        const span = f && words[o].span;
        el.classList.toggle('found', f);
        el.classList.toggle('span', !!span);
        el.classList.toggle('theme', f && !span);
        el.classList.toggle('sel', selSet.has(c));
        const hintN = hinted[o] || 0;
        const isHint = !f && words[o].cells.indexOf(c) < hintN;
        el.classList.toggle('hinted', isHint);
        if (isHint && words[o].cells.indexOf(c) >= (shownHint[o] || 0)) flash(el, 'hint-in', 700);
        if (selSet.has(c) && !prev.has(c)) flash(el, 'pick', 300);
        if (o === fresh) { el.style.setProperty('--k', words[o].cells.indexOf(c)); flash(el, span ? 'sweep' : 'lock', 1100); }
      });
      // threads of found words: added once each, drawing themselves in when new
      for (const i of found) {
        if (lines.has(i)) continue;
        const line = s('polyline', { class: 'weave-line ' + (words[i].span ? 'span' : 'theme') + (i === fresh && !calm() ? ' draw' : ''), points: pts(words[i].cells), pathLength: '1' });
        lines.set(i, line); foundLayer.append(line);
      }
      fresh = null;
      // the thread being traced, with its newest stretch drawing out to the finger
      selLine.setAttribute('points', sel.length > 1 ? pts(sel) : '');
      const grew = sel.length > 1 && sel.length > shownSel.length && sel.slice(0, -1).every((c, k) => c === shownSel[k]);
      if (grew && !calm()) {
        const [x1, y1] = pt(sel[sel.length - 2]), [x2, y2] = pt(sel[sel.length - 1]);
        Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => tipLine.setAttribute(k, v));
        replay(tipLine, 'go');
        selLine.setAttribute('points', pts(sel.slice(0, -1)));
      } else tipLine.classList.remove('go');
      // the word being traced, a letter at a time
      let same = 0;
      while (same < sel.length && sel[same] === shownSel[same]) same++;
      if (!keepWord && !current.classList.contains('bad')) {
        if (!sel.length) put(current, h('span', { class: 'ph' }, done ? '' : 'Trace a word'));
        else put(current, sel.map((c, k) => h('span', { class: 'lt' + (k >= same ? ' in' : '') }, letters[c].toUpperCase())));
      }
      shownSel = sel.slice();
      shownHint = { ...hinted };
      if (!done) status.textContent = `${found.size} of ${words.length} theme words${[...found].some((i) => words[i].span) ? ', span found' : ''}`;
      ctx.save({ found: [...found], hinted, done });
    }
    // tip finished: fold it into the main line
    tipLine.addEventListener('animationend', () => { if (sel.length > 1) selLine.setAttribute('points', pts(sel)); tipLine.classList.remove('go'); });
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
          fresh = i;
          if (found.size === words.length) { win(); return 'Last word revealed'; }
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
