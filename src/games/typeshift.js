import './typeshift.css';
import { h, put } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateTypeshift, ACCEPT_TIER } from '../gen/typeshift.js';
import { isWord } from '../lib/words.js';

const CELL = 48; // px per letter row; matches the CSS

export default {
  id: 'typeshift',
  name: 'Typeshaft',
  tagline: 'Slide letter columns to spell words',
  version: 1,
  generate: generateTypeshift,
  rules: [
    'Each column holds a few letters. Drag a column up or down, or tap a letter, to move it into the middle row.',
    'When the middle row spells a word, it counts and its letters turn solid.',
    'Use every letter at least once to win. Par is the fewest words that can do it.',
    'A hint moves one column toward a word you haven\'t found yet.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const saved = ctx.load();
    let hintWord = saved?.hintWord || null; // the word hints are steering toward
    const pos = saved?.pos || p.start.slice();
    const found = saved?.found || [];
    const used = new Set(saved?.used || []);
    let done = !!saved?.done;
    const n = p.cols.length;
    const tall = Math.max(...p.cols.map((c) => c.length));
    const rows = tall * 2 - 1;

    // Each column is a reel of letter tiles riding in its own shaft; the middle band is the window.
    const strips = [], lanes = [];
    const band = h('div', { class: 'ts-band', 'aria-hidden': 'true' }, h('i', { class: 'ts-sheen' }));
    const board = h('div', { class: 'ts-board', style: { '--rows': rows, '--n': n } }, band);
    p.cols.forEach((col, i) => {
      const strip = h('div', { class: 'ts-strip' }, col.map((ch, k) => h('button', {
        class: 'ts-letter', type: 'button', 'data-k': k, style: { '--i': i, '--k': k },
        onClick: (e) => { e.currentTarget.blur(); if (!dragMoved) setPos(i, k); },
      }, h('span', {}, ch.toUpperCase()))));
      // the tile that lands in the window gives a small click once its column settles
      strip.addEventListener('transitionend', (e) => { if (e.target === strip && e.propertyName === 'transform') land(i); });
      const lane = h('div', { class: 'ts-lane', role: 'group', 'aria-label': `Column ${i + 1}` }, strip);
      board.append(lane);
      strips.push(strip); lanes.push(lane);
      drag(lane, i);
    });
    const word = h('p', { class: 'ts-word', 'aria-live': 'polite' });
    const fill = h('i', {});
    const meter = h('p', { class: 'hint-line ts-meter' });
    const list = h('div', { class: 'ts-found' });
    const wrap = h('div', { class: 'board ts-wrap' }, board);
    root.append(wrap, word, h('div', { class: 'ts-progress', 'aria-hidden': 'true' }, fill), meter, list);

    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    const offset = (i, k) => (tall - 1 - k) * CELL;
    function place(i, extra = 0, animate = true) {
      strips[i].style.transition = animate ? '' : 'none';
      strips[i].style.transform = `translateY(${offset(i, pos[i]) + extra}px)`;
    }
    function land(i) {
      strips[i].style.removeProperty('--ts-dur');
      const el = strips[i].children[pos[i]];
      if (el) replay(el, 'land');
    }

    // drag a column; on release it keeps the speed of a flick, then snaps to the nearest letter
    let dragMoved = false;
    function drag(lane, i) {
      let y0 = null, startK = 0, samples = [];
      lane.addEventListener('pointerdown', (e) => {
        if (done) return;
        y0 = e.clientY; startK = pos[i]; dragMoved = false; samples = [[e.clientY, e.timeStamp]];
      });
      lane.addEventListener('pointermove', (e) => {
        if (y0 === null) return;
        const dy = e.clientY - y0;
        if (!dragMoved && Math.abs(dy) > 6) { dragMoved = true; lane.setPointerCapture(e.pointerId); lane.classList.add('held'); }
        samples.push([e.clientY, e.timeStamp]);
        if (samples.length > 5) samples.shift();
        if (!dragMoved) return;
        const max = (startK) * CELL, min = (startK - (p.cols[i].length - 1)) * CELL;
        // past the ends the column stretches a little and resists, like a reel at its stop
        const y = dy > max ? max + (dy - max) * 0.3 : dy < min ? min + (dy - min) * 0.3 : dy;
        place(i, y, false);
      });
      const end = (e) => {
        if (y0 === null) return;
        const dy = e.clientY - y0; y0 = null;
        lane.classList.remove('held');
        if (!dragMoved) return;
        let v = 0; // px per ms over the last few moves
        const a = samples[0], b = samples[samples.length - 1];
        if (b && b[1] > a[1] && e.timeStamp - b[1] < 90) v = (b[0] - a[0]) / (b[1] - a[1]);
        const fling = calm() ? 0 : Math.max(-2.4 * CELL, Math.min(2.4 * CELL, v * 110));
        const k = Math.max(0, Math.min(p.cols[i].length - 1, startK - Math.round((dy + fling) / CELL)));
        // the farther it has to travel, the longer the glide
        const rowsToGo = Math.abs(k - (startK - dy / CELL));
        strips[i].style.setProperty('--ts-dur', `${Math.round(Math.min(560, 240 + rowsToGo * 90))}ms`);
        pos[i] = startK; setPos(i, k);
        setTimeout(() => { dragMoved = false; }, 0);
      };
      lane.addEventListener('pointerup', end);
      lane.addEventListener('pointercancel', end);
    }

    function setPos(i, k) {
      if (done) return;
      if (pos[i] === k) strips[i].style.removeProperty('--ts-dur');
      pos[i] = k;
      check();
      render();
    }

    const current = () => pos.map((k, i) => p.cols[i][k]).join('');

    function take(w) {
      if (found.includes(w)) return false;
      found.push(w);
      [...w].forEach((ch, i) => used.add(i + ':' + ch));
      return true;
    }

    let fresh = null, winNow = false; // a word just found, and whether it finished the puzzle
    function check() {
      const w = current();
      if (!isWord(w, ACCEPT_TIER) || found.includes(w)) return;
      take(w);
      fresh = w;
      ctx.toast(w.toUpperCase());
      finishIfDone();
    }

    const total = p.cols.reduce((a, c) => a + c.length, 0);
    function finishIfDone() {
      if (done || used.size < total) return;
      done = true;
      winNow = true;
      ctx.solved(`${found.length} word${found.length === 1 ? '' : 's'}, par ${p.par}`, { value: found.length - p.par, higher: false, fmt: (v) => (v > 0 ? `par +${v}` : v < 0 ? `par ${v}` : 'par') });
    }

    let prevUsed = new Set(used), prevFound = found.length;
    function render() {
      p.cols.forEach((col, i) => {
        place(i);
        [...strips[i].children].forEach((el, k) => {
          const key = i + ':' + col[k];
          el.classList.toggle('used', used.has(key));
          el.classList.toggle('mid', pos[i] === k);
          el.disabled = done;
          // letters that just turned solid ink in
          if (used.has(key) && !prevUsed.has(key)) replay(el, 'inked');
        });
      });
      prevUsed = new Set(used);
      const w = current();
      const good = found.includes(w);
      put(word, [...w].map((ch, i) => h('span', { class: good ? 'ok' : '', style: { '--i': i } }, ch.toUpperCase())));
      const left = total - used.size;
      put(meter, `${left} letter${left === 1 ? '' : 's'} left · ${found.length} word${found.length === 1 ? '' : 's'} · par ${p.par}`);
      fill.style.width = `${(used.size / total) * 100}%`;
      put(list, found.map((f, j) => h('span', { class: 'ts-chip' + (j >= prevFound ? ' new' : '') }, f.toUpperCase())));
      prevFound = found.length;
      board.classList.toggle('solved', done);
      if (fresh) {
        // the word flashes across the window: a sheen runs the band and its tiles hop in turn
        replay(board, 'found');
        replay(word, 'got');
        if (!calm()) wrap.append(h('span', { class: 'ts-bubble', onAnimationend: (e) => e.currentTarget.remove() }, fresh.toUpperCase()));
        fresh = null;
      }
      if (winNow) {
        winNow = false;
        if (!calm()) { replay(board, 'win'); setTimeout(() => board.classList.remove('win'), 2200); }
      }
      ctx.save({ pos, found, used: [...used], done, hintWord });
    }
    render();

    return {
      hint() {
        if (done) return false;
        // move one column toward a word worth finding, the way Typeshift's hints work
        const gain = (w) => [...w].filter((ch, i) => !used.has(i + ':' + ch)).length;
        if (!hintWord || found.includes(hintWord)) {
          const options = p.cover.concat(p.planted).filter((w) => !found.includes(w) && gain(w) > 0);
          options.sort((a, b) => gain(b) - gain(a));
          hintWord = options[0] || null;
        }
        if (!hintWord) return false;
        const i = [...hintWord].findIndex((ch, k) => p.cols[k][pos[k]] !== ch);
        if (i < 0) { check(); render(); return `${hintWord.toUpperCase()} is lined up`; }
        pos[i] = p.cols[i].indexOf(hintWord[i]);
        strips[i].style.setProperty('--ts-dur', '520ms');
        replay(lanes[i], 'hinted');
        const left = [...hintWord].filter((ch, k) => p.cols[k][pos[k]] !== ch).length;
        check();
        render();
        return left ? `Moved column ${i + 1}. ${left} more to go for this word` : `Moved column ${i + 1}`;
      },
      reveal() {
        for (const w of p.cover) take(w);
        done = true;
        render();
      },
    };
  },
};
