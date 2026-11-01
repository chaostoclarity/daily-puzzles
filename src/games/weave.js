import './weave.css';
import { h, put, s, cellAt, shake } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateWeave, weaveNeighbors } from '../gen/weave.js';
import { isWord } from '../lib/words.js';

export default {
  id: 'weave',
  name: 'Wand',
  tagline: 'Split the grid into hidden words',
  generate: generateWeave,
  rules: [
    'The grid hides several words, each a different length. Every letter belongs to exactly one of them. Dark squares are blocked.',
    'Spell a word by dragging through letters that sit side by side: up, down, left or right.',
    'You can also tap letters one at a time, then tap the last letter again to submit.',
    'The slots show how many letters each word has. Find them all to clear the board.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const { rows, cols, grid: letters, words } = p;
    const saved = ctx.load();
    const found = new Set(saved?.found || []); // indices into words
    // letters revealed per word index; older saves stored a list of word indexes
    const hinted = Array.isArray(saved?.hinted) ? Object.fromEntries(saved.hinted.map((i) => [i, 1])) : { ...(saved?.hinted || {}) };
    let done = !!saved?.done;
    let sel = [];
    const owner = new Array(rows * cols).fill(-1);
    words.forEach((w, i) => w.cells.forEach((c) => (owner[c] = i)));
    const slotOrder = [...words.keys()].sort((a, b) => words[a].word.length - words[b].word.length || a - b);
    const tint = (i) => `w${slotOrder.indexOf(i) % 8}`;

    // The one bold thing: the wand's stroke. Tracing draws a glowing rounded path with a bright
    // tip at the finger; a found word paints its letters in its own color one after another,
    // and the letters lift off the board and fly down into the word's slot. Winning sends a
    // shimmer across the board and the slots bounce in turn.
    const cells = [];
    const gridEl = h('div', { class: 'weave-grid', style: { '--c': cols, '--r': rows }, role: 'grid', 'aria-label': 'Letter grid' });
    letters.forEach((ch, c) => {
      const pos = { '--row': Math.floor(c / cols), '--col': c % cols };
      const el = ch
        ? h('div', { class: 'weave-cell', 'data-cell': c, role: 'gridcell', style: pos }, h('span', { class: 'wv-l' }, ch.toUpperCase()))
        : h('div', { class: 'weave-cell block', 'aria-hidden': 'true', style: pos });
      cells.push(el); gridEl.append(el);
    });
    const svg = s('svg', { class: 'weave-svg', viewBox: `0 0 ${cols} ${rows}`, 'aria-hidden': 'true' });
    const foundLayer = s('g', {});
    const selLine = s('polyline', { class: 'weave-line sel' });
    const tipLine = s('line', { class: 'wv-tip', pathLength: '1' });
    const spark = s('circle', { class: 'wv-spark', r: '0.47' });
    svg.append(foundLayer, selLine, tipLine, spark);
    const board = h('div', { class: 'board weave-board', style: { aspectRatio: `${cols} / ${rows}`, '--c': cols, '--r': rows } }, gridEl, svg);
    const current = h('div', { class: 'weave-current wv-current', 'aria-live': 'polite' });
    const slots = h('div', { class: 'weave-slots' });
    const status = h('p', { class: 'hint-line wv-status', 'aria-live': 'polite' });
    const clearBtn = h('button', { class: 'btn small', type: 'button', onClick: (e) => { e.currentTarget.blur(); sel = []; render(); } }, 'Clear');
    root.append(current, board, h('div', { class: 'wv-foot' }, status, clearBtn), slots);

    // slots are built once; their letters fill in as words are found
    const slotEls = new Map();
    slotOrder.forEach((i, n) => {
      const spans = [...words[i].word].map((_, k) => h('span', { style: { '--k': k } }));
      const el = h('div', { class: 'weave-slot', style: { '--n': n } }, spans);
      slotEls.set(i, { el, spans });
      slots.append(el);
    });

    const adj = (a, b) => weaveNeighbors(rows, cols, a).includes(b);
    const usable = (c) => c !== null && !!letters[c] && !found.has(owner[c]);
    const pt = (c) => [(c % cols) + 0.5, Math.floor(c / cols) + 0.5];
    const pts = (list) => list.map((c) => pt(c).join(',')).join(' ');
    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    const flash = (el, cls, ms) => { replay(el, cls); clearTimeout(el['_' + cls]); el['_' + cls] = setTimeout(() => el.classList.remove(cls), ms); };

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
        fresh = match;
        sel = [];
        render();
        if (found.size === words.length && !done) {
          done = true; board.classList.add('solved');
          status.textContent = 'Every letter placed.';
          winFx();
          ctx.solved();
          ctx.save(state());
        }
        return;
      }
      const sameWord = words.some((w, i) => !found.has(i) && w.word === word);
      ctx.toast(sameWord ? 'That word is in here, on a different path' : isWord(word, 50) && word.length >= 3 ? 'A real word, but not one of the hidden ones' : 'Not a word');
      sel.forEach((c) => flash(cells[c], 'nope', 420));
      current.classList.add('bad');
      shake(current);
      sel = []; render(true);
      setTimeout(() => { if (current.classList.contains('bad')) { current.classList.remove('bad'); render(); } }, 520);
    }

    // win: a shimmer crosses the board, then the slots bounce one after another
    function winFx() { setTimeout(() => { replay(board, 'wv-win'); replay(slots, 'wv-win'); }, calm() ? 0 : 560); }

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
      if (done) return false;
      const open = slotOrder.filter((i) => !found.has(i));
      // keep building the word already started, otherwise start the shortest
      const i = open.find((x) => (hinted[x] || 0) > 0) ?? open[0];
      hinted[i] = (hinted[i] || 0) + 1;
      if (hinted[i] >= words[i].word.length) {
        found.add(i);
        fresh = i;
        if (found.size === words.length) {
          done = true; board.classList.add('solved'); status.textContent = 'Every letter placed.';
          render(); winFx(); ctx.solved(); return 'Last word revealed';
        }
        render();
        return `Revealed ${words[i].word.toUpperCase()}`;
      }
      render();
      return `Letter ${hinted[i]} of a ${words[i].word.length}-letter word`;
    }

    const state = () => ({ found: [...found], hinted, done });

    // a found word's letters lift off the board and drop into its slot
    function fly(i) {
      const { spans } = slotEls.get(i);
      if (calm() || !document.body.animate) return;
      words[i].cells.forEach((c, k) => {
        const a = cells[c].getBoundingClientRect(), b = spans[k].getBoundingClientRect();
        if (!b.width) return;
        spans[k].classList.add('landing');
        const ghost = h('span', { class: `wv-fly ${tint(i)}` }, letters[c].toUpperCase());
        root.append(ghost);
        const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
        const anim = ghost.animate([
          { transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) scale(1.3)`, opacity: 0 },
          { transform: `translate(${x0}px, ${y0 - 14}px) translate(-50%, -50%) scale(1.25)`, opacity: 1, offset: 0.2 },
          { transform: `translate(${x1}px, ${y1}px) translate(-50%, -50%) scale(0.9)`, opacity: 1 },
        ], { duration: 520, delay: 160 + k * 45, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'backwards' });
        const end = () => { ghost.remove(); spans[k].classList.remove('landing'); flash(spans[k], 'land', 400); };
        anim.onfinish = end; anim.oncancel = end;
      });
    }

    let fresh = null, shownSel = [], shownHint = { ...hinted };
    const lines = new Map();
    function render(keepWord = false) {
      const selSet = new Set(sel);
      const prev = new Set(shownSel);
      cells.forEach((el, c) => {
        if (!letters[c]) return;
        const o = owner[c];
        const isFound = found.has(o);
        for (let t = 0; t < 8; t++) el.classList.toggle(`w${t}`, isFound && tint(o) === `w${t}`);
        el.classList.toggle('found', isFound);
        el.classList.toggle('sel', selSet.has(c));
        const k = o === -1 ? -1 : words[o].cells.indexOf(c);
        const isHint = o !== -1 && !isFound && k < (hinted[o] || 0);
        el.classList.toggle('hinted', isHint);
        if (isHint && k >= (shownHint[o] || 0)) flash(el, 'hint-in', 700);
        if (selSet.has(c) && !prev.has(c)) flash(el, 'pick', 300);
        if (o === fresh) { el.style.setProperty('--k', k); flash(el, 'paint', 900); }
      });
      for (const i of found) {
        if (lines.has(i)) continue;
        const line = s('polyline', { class: `weave-line ${tint(i)}` + (i === fresh && !calm() ? ' draw' : ''), points: pts(words[i].cells), pathLength: '1' });
        lines.set(i, line); foundLayer.append(line);
      }
      // the traced path, its newest stretch drawing out, a spark at the tip
      selLine.setAttribute('points', sel.length > 1 ? pts(sel) : '');
      const grew = sel.length > 1 && sel.length > shownSel.length && sel.slice(0, -1).every((c, k) => c === shownSel[k]);
      if (grew && !calm()) {
        const [x1, y1] = pt(sel[sel.length - 2]), [x2, y2] = pt(sel[sel.length - 1]);
        Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => tipLine.setAttribute(k, v));
        replay(tipLine, 'go');
        selLine.setAttribute('points', pts(sel.slice(0, -1)));
      } else tipLine.classList.remove('go');
      if (sel.length) { const [x, y] = pt(sel[sel.length - 1]); spark.setAttribute('cx', x); spark.setAttribute('cy', y); }
      spark.classList.toggle('on', sel.length > 0);
      if (sel.length && sel.length !== shownSel.length) replay(spark, 'jump');
      let same = 0;
      while (same < sel.length && sel[same] === shownSel[same]) same++;
      if (!keepWord && !current.classList.contains('bad')) {
        if (!sel.length) put(current, h('span', { class: 'ph' }, done ? '' : 'Trace a word'));
        else put(current, sel.map((c, k) => h('span', { class: 'lt' + (k >= same ? ' in' : '') }, letters[c].toUpperCase())));
      }
      shownSel = sel.slice();
      for (const i of slotOrder) {
        const w = words[i];
        const f = found.has(i);
        const { el, spans } = slotEls.get(i);
        el.className = 'weave-slot' + (f ? ` found ${tint(i)}` : '');
        el.setAttribute('aria-label', f ? w.word : `${w.word.length} letters`);
        spans.forEach((sp, k) => {
          const show = f || k < (hinted[i] || 0);
          sp.textContent = show ? w.word[k].toUpperCase() : '';
          if (!f && show && k >= (shownHint[i] || 0)) flash(sp, 'land', 400);
        });
      }
      shownHint = { ...hinted };
      const flyNow = fresh;
      fresh = null;
      if (flyNow !== null) fly(flyNow);
      if (!done) status.textContent = `${found.size} of ${words.length} words found`;
      ctx.save(state());
    }
    tipLine.addEventListener('animationend', () => { if (sel.length > 1) selLine.setAttribute('points', pts(sel)); tipLine.classList.remove('go'); });
    render();
    if (done) board.classList.add('solved');
    return {
      hint,
      reveal() { words.forEach((_, i) => found.add(i)); done = true; sel = []; board.classList.add('solved'); render(); status.textContent = 'Solution shown.'; ctx.save({ ...state(), revealed: true }); },
    };
  },
};
