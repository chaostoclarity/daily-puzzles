import { h, put } from '../lib/ui.js';
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
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const saved = ctx.load();
    const pos = saved?.pos || p.start.slice();
    const found = saved?.found || [];
    const used = new Set(saved?.used || []);
    let done = !!saved?.done;
    const n = p.cols.length;
    const tall = Math.max(...p.cols.map((c) => c.length));
    const rows = tall * 2 - 1;

    const strips = [];
    const board = h('div', { class: 'ts-board', style: { '--rows': rows, '--n': n } },
      h('div', { class: 'ts-band', 'aria-hidden': 'true' }));
    p.cols.forEach((col, i) => {
      const strip = h('div', { class: 'ts-strip' }, col.map((ch, k) => h('button', {
        class: 'ts-letter', type: 'button', 'data-k': k,
        onClick: () => { if (!dragMoved) setPos(i, k); },
      }, ch.toUpperCase())));
      const lane = h('div', { class: 'ts-lane', role: 'group', 'aria-label': `Column ${i + 1}` }, strip);
      board.append(lane);
      strips.push(strip);
      drag(lane, i);
    });
    const word = h('p', { class: 'ts-word', 'aria-live': 'polite' });
    const list = h('div', { class: 'ts-found' });
    const meter = h('p', { class: 'hint-line' });
    root.append(h('div', { class: 'board ts-wrap' }, board), word, meter, list);

    const offset = (i, k) => (tall - 1 - k) * CELL;
    function place(i, extra = 0, animate = true) {
      strips[i].style.transition = animate ? '' : 'none';
      strips[i].style.transform = `translateY(${offset(i, pos[i]) + extra}px)`;
    }

    // drag a column; snap to the nearest letter on release
    let dragMoved = false;
    function drag(lane, i) {
      let y0 = null, startK = 0;
      lane.addEventListener('pointerdown', (e) => {
        if (done) return;
        y0 = e.clientY; startK = pos[i]; dragMoved = false;
      });
      lane.addEventListener('pointermove', (e) => {
        if (y0 === null) return;
        const dy = e.clientY - y0;
        if (!dragMoved && Math.abs(dy) > 6) { dragMoved = true; lane.setPointerCapture(e.pointerId); }
        if (!dragMoved) return;
        const max = (startK) * CELL, min = (startK - (p.cols[i].length - 1)) * CELL;
        place(i, Math.max(min, Math.min(max, dy)), false);
      });
      const end = (e) => {
        if (y0 === null) return;
        const dy = e.clientY - y0; y0 = null;
        if (!dragMoved) return;
        const k = Math.max(0, Math.min(p.cols[i].length - 1, startK - Math.round(dy / CELL)));
        pos[i] = startK; setPos(i, k);
        setTimeout(() => { dragMoved = false; }, 0);
      };
      lane.addEventListener('pointerup', end);
      lane.addEventListener('pointercancel', end);
    }

    function setPos(i, k) {
      if (done) return;
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

    function check() {
      const w = current();
      if (!isWord(w, ACCEPT_TIER) || found.includes(w)) return;
      take(w);
      ctx.toast(w.toUpperCase());
      finishIfDone();
    }

    const total = p.cols.reduce((a, c) => a + c.length, 0);
    function finishIfDone() {
      if (done || used.size < total) return;
      done = true;
      ctx.solved(`${found.length} word${found.length === 1 ? '' : 's'}, par ${p.par}`);
    }

    function render() {
      p.cols.forEach((col, i) => {
        place(i);
        [...strips[i].children].forEach((el, k) => {
          el.classList.toggle('used', used.has(i + ':' + col[k]));
          el.classList.toggle('mid', pos[i] === k);
          el.disabled = done;
        });
      });
      const w = current();
      const good = found.includes(w);
      put(word, h('span', { class: good ? 'ok' : '' }, w.toUpperCase()));
      put(meter, `${total - used.size} letter${total - used.size === 1 ? '' : 's'} left · ${found.length} word${found.length === 1 ? '' : 's'} · par ${p.par}`);
      put(list, found.map((f) => h('span', { class: 'ts-chip' }, f.toUpperCase())));
      board.classList.toggle('solved', done);
      ctx.save({ pos, found, used: [...used], done });
    }
    render();

    return {
      hint() {
        if (done) return false;
        // line up the unfound word that uses the most unused letters
        const options = p.cover.concat(p.planted).filter((w) => !found.includes(w));
        options.sort((a, b) => [...b].filter((ch, i) => !used.has(i + ':' + ch)).length - [...a].filter((ch, i) => !used.has(i + ':' + ch)).length);
        const w = options[0];
        if (!w) return false;
        [...w].forEach((ch, i) => { pos[i] = p.cols[i].indexOf(ch); });
        take(w);
        finishIfDone();
        render();
        return `Lined up ${w.toUpperCase()}`;
      },
      reveal() {
        for (const w of p.cover) take(w);
        done = true;
        render();
      },
    };
  },
};
