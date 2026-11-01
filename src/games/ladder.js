import './ladder.css';
import { h, put, keyboard, shake } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateLadder, oneApart } from '../gen/ladder.js';

export default {
  id: 'ladder',
  version: 2, // bump when the generator changes, so old saves don't load onto a new board
  name: 'Crissclimb',
  tagline: 'Climb a chain of one-letter changes',
  generate: generateLadder,
  rules: [
    'Each rung is a word that differs from the rung next to it by exactly one letter.',
    'Tap a rung to see its clue, then type the answer.',
    'When the rungs are out of order, drag them up or down until each step changes one letter.',
    'Solve every middle rung in order to unlock the top and bottom words. Together they make a compound word, like FIRE + WORK.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const { len } = p;
    const saved = ctx.load();
    const mids = p.middle;
    let order = saved?.order || mids.map((_, i) => i); // display order of middle rungs
    const entry = saved?.entry || {}; // key -> string
    let active = saved?.active ?? 'm' + order[0];
    let done = !!saved?.done;

    const keyFor = (k) => (k === 'top' || k === 'bottom' ? k : 'm' + k);
    const midSolved = (i) => (entry['m' + i] || '') === mids[i].word;
    const allMidSolved = () => mids.every((_, i) => midSolved(i));
    const ordered = () => order.every((idx, j) => j === 0 || oneApart(mids[order[j - 1]].word, mids[idx].word));
    const unlocked = () => allMidSolved() && ordered();
    // if the player built the chain upside down, the ends swap places
    const reversed = () => mids[order[0]].order !== 0;
    const endWord = (k) => ((k === 'top') !== reversed() ? p.top : p.bottom);

    const clueBox = h('div', { class: 'clue-bar', 'aria-live': 'polite' });
    const list = h('div', { class: 'ladder', role: 'list', style: { '--rungs': mids.length + 2 } });
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    const kb = keyboard(onKey);
    root.append(clueBox, list, status, kb.el);

    // Motion. Rows are rebuilt on every render, so a moment (a rung solved, a letter typed, the
    // ends unlocking) is kept as a timed mark and replayed on whichever row element is current,
    // with a negative delay so a re-render mid-animation picks it up where it was.
    const marks = new Map(); // key -> { cls, t0, ms }
    const mark = (key, cls, ms = 900) => { if (!calm()) marks.set(key + ':' + cls, { key, cls, t0: performance.now(), ms }); };
    const marksFor = (key) => [...marks.values()].filter((m) => m.key === key && performance.now() - m.t0 < m.ms);
    let typed = null; // { key, i, t0 } the letter just typed
    let shownActive = active, shownOpen = null;

    function rowEl(key, word, opts = {}) {
      const val = entry[key] || '';
      const solved = val === word;
      const fx = marksFor(key);
      const row = h('div', {
        class: 'rung' + (key === active ? ' active' : '') + (solved ? ' solved' : '') + (opts.locked ? ' locked' : '') + (opts.end ? ' end' : '') + (opts.move && !done ? ' draggable' : '') + fx.map((m) => ' ' + m.cls).join(''),
        style: fx.length ? { '--t0': `${-Math.round(performance.now() - fx[0].t0)}ms` } : null,
        role: 'listitem', 'data-key': key, 'data-pos': opts.move ? opts.pos : null,
        onClick: () => { if (justDragged) return; if (!opts.locked && !done) { active = key; render(); } },
      },
      h('div', { class: 'rung-letters', 'aria-label': opts.locked ? 'Locked' : val || 'Empty' },
        Array.from({ length: len }, (_, i) => h('span', {
          class: 'tile' + (val[i] ? ' filled' : '') + (typed && typed.key === key && typed.i === i && performance.now() - typed.t0 < 250 ? ' in' : ''),
          style: { '--i': i },
        }, opts.locked ? '' : (val[i] || '').toUpperCase()))),
      opts.move && !done ? h('span', { class: 'rung-grip', 'aria-hidden': 'true' }, '⠿') : null);
      return row;
    }

    // drag a middle rung up or down to reorder; a short press still just selects it
    let drag = null, justDragged = false;
    list.addEventListener('pointerdown', (e) => {
      const row = e.target.closest('.rung.draggable');
      if (!row || done) return;
      const rows = [...list.querySelectorAll('.rung.draggable')];
      const pitch = rows.length > 1 ? rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top : row.offsetHeight;
      drag = { row, rows, from: +row.dataset.pos, to: +row.dataset.pos, y0: e.clientY, pitch, on: false, id: e.pointerId };
    });
    list.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dy = e.clientY - drag.y0;
      if (!drag.on) {
        if (Math.abs(dy) < 8) return;
        drag.on = true; drag.row.classList.add('dragging'); list.setPointerCapture(drag.id);
      }
      e.preventDefault();
      const n = drag.rows.length;
      const minDy = -drag.from * drag.pitch, maxDy = (n - 1 - drag.from) * drag.pitch;
      const d = Math.max(minDy, Math.min(maxDy, dy));
      drag.to = Math.max(0, Math.min(n - 1, drag.from + Math.round(d / drag.pitch)));
      drag.row.style.transform = `translateY(${d}px)`;
      drag.rows.forEach((r, j) => {
        if (r === drag.row) return;
        const shift = drag.from < drag.to && j > drag.from && j <= drag.to ? -drag.pitch : drag.to < drag.from && j >= drag.to && j < drag.from ? drag.pitch : 0;
        r.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    });
    const endDrag = () => {
      if (!drag) return;
      const { on, from, to } = drag;
      drag = null;
      if (!on) return;
      justDragged = true; setTimeout(() => { justDragged = false; }, 0);
      if (to !== from) { const [x] = order.splice(from, 1); order.splice(to, 0, x); }
      render();
    };
    list.addEventListener('pointerup', endDrag);
    list.addEventListener('pointercancel', endDrag);

    function clueText() {
      if (active === 'top' || active === 'bottom') {
        return h('div', {}, h('span', { class: 'clue-tag' }, 'Top + bottom'), `${p.compoundClue || endWord(active).clue} (two ${len}-letter words that join into one)`);
      }
      const i = +active.slice(1);
      return h('div', {}, h('span', { class: 'clue-tag' }, `${len} letters`), mids[i].clue);
    }

    function render() {
      // once the rungs are solved, flip a ladder built upside down so the ends read top to bottom
      if (allMidSolved() && ordered() && reversed()) order.reverse();
      const open = unlocked();
      // the ends unlock: their tiles flip open and the rails light up
      if (open && shownOpen === false) { mark('top', 'unlock', 1000); mark('bottom', 'unlock', 1000); }
      shownOpen = open;
      // FLIP: rows that change places (a drop, a hint, the ladder turning right side up) spring there
      const before = new Map([...list.children].map((el) => [el.dataset.key, el.getBoundingClientRect().top]));
      const rows = [rowEl('top', endWord('top').word, { locked: !open, end: true })];
      order.forEach((idx, pos) => rows.push(rowEl('m' + idx, mids[idx].word, { move: p.scramble, pos, first: pos === 0, last: pos === order.length - 1 })));
      rows.push(rowEl('bottom', endWord('bottom').word, { locked: !open, end: true }));
      rows.forEach((el, j) => el.style.setProperty('--up', rows.length - 1 - j));
      put(list, ...rows);
      if (!calm() && before.size) rows.forEach((el) => {
        const y0 = before.get(el.dataset.key);
        if (y0 == null) return;
        const dy = y0 - el.getBoundingClientRect().top;
        if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(0.25, 1.45, 0.45, 1)' });
      });
      put(clueBox, clueText());
      if (active !== shownActive && !calm()) clueBox.firstChild?.classList.add('swap');
      shownActive = active;
      if (!done) {
        if (!allMidSolved()) status.textContent = `${mids.filter((_, i) => midSolved(i)).length} of ${mids.length} rungs solved`;
        else if (!ordered()) status.textContent = 'All rungs solved. Now order them so each step changes one letter.';
        else status.textContent = 'Ladder in order. Solve the top and bottom.';
      }
      if (!done && open && entry.top === endWord('top').word && entry.bottom === endWord('bottom').word) {
        done = true;
        list.classList.add('solved');
        status.textContent = 'Top to bottom, one letter at a time.';
        // win: the rungs light up one after another, climbing from the bottom
        if (!calm()) { list.classList.add('climb'); setTimeout(() => list.classList.remove('climb'), 1600); }
        ctx.solved();
      }
      ctx.save({ order, entry, active, done });
    }

    function nextOpen() {
      const keys = order.map((i) => 'm' + i);
      if (unlocked()) keys.unshift('top'), keys.push('bottom');
      const target = (k) => (k === 'top' || k === 'bottom' ? endWord(k).word : mids[+k.slice(1)].word);
      const start = keys.indexOf(active);
      for (let s2 = 1; s2 <= keys.length; s2++) {
        const k = keys[(start + s2) % keys.length];
        if ((entry[k] || '') !== target(k)) return k;
      }
      return active;
    }

    function onKey(k) {
      if (done) return;
      const target = active === 'top' || active === 'bottom' ? endWord(active).word : mids[+active.slice(1)].word;
      let v = entry[active] || '';
      if (k === 'back') v = v.slice(0, -1);
      else if (k === 'up' || k === 'down') {
        const keys = (unlocked() ? ['top'] : []).concat(order.map((i) => 'm' + i), unlocked() ? ['bottom'] : []);
        const j = keys.indexOf(active) + (k === 'up' ? -1 : 1);
        if (j >= 0 && j < keys.length) active = keys[j];
        return render();
      } else if (k === 'enter') {
        if (v.length === len && v !== target) { const el = list.querySelector(`[data-key="${active}"]`); if (el) shake(el); }
        return;
      } else if (k.length === 1) {
        if (v === target) return;
        if (v.length >= len) v = '';
        v += k;
      } else return;
      entry[active] = v;
      if (k.length === 1) typed = { key: active, i: v.length - 1, t0: performance.now() };
      if (v.length === len) {
        if (v === target) { mark(active, 'just'); render(); active = nextOpen(); }
        else { mark(active, 'nope', 450); render(); const el = list.querySelector(`[data-key="${active}"]`); if (el) shake(el); ctx.toast('Not quite'); return; }
      }
      render();
    }

    render();
    if (done) list.classList.add('solved');
    function hint() {
      if (done) return false;
      const target = (k) => (k === 'top' || k === 'bottom' ? endWord(k).word : mids[+k.slice(1)].word);
      const unsolvedMid = order.map((i) => 'm' + i).filter((k) => (entry[k] || '') !== target(k));
      // all rungs solved but out of order: move one rung into its place
      if (!unsolvedMid.length && !ordered()) {
        for (let j = 0; j < order.length; j++) {
          if (mids[order[j]].order !== j) {
            const from = order.findIndex((i) => mids[i].order === j);
            const [x] = order.splice(from, 1);
            order.splice(j, 0, x);
            break;
          }
        }
        render();
        return 'Moved one rung into place';
      }
      let key = active;
      const locked = (k) => (k === 'top' || k === 'bottom') && !unlocked();
      if (locked(key) || (entry[key] || '') === target(key)) {
        key = unsolvedMid[0] || ['top', 'bottom'].find((k) => (entry[k] || '') !== target(k));
      }
      const t = target(key);
      const v = entry[key] || '';
      let pos = 0;
      while (pos < v.length && v[pos] === t[pos]) pos++;
      entry[key] = t.slice(0, pos + 1);
      active = key;
      typed = { key, i: pos, t0: performance.now() };
      if (entry[key] === t) { mark(key, 'just'); render(); active = nextOpen(); }
      render();
      return `Filled letter ${pos + 1}`;
    }

    return {
      onKey,
      hint,
      reveal() {
        order = mids.map((_, i) => i).sort((a, b) => mids[a].order - mids[b].order);
        mids.forEach((m, i) => (entry['m' + i] = m.word));
        entry.top = p.top.word; entry.bottom = p.bottom.word;
        done = true; list.classList.add('solved'); render(); status.textContent = 'Solution shown.';
        ctx.save({ order, entry, active, done, revealed: true });
      },
    };
  },
};
