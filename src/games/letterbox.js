import './letterbox.css';
import { h, put, s, shake } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateLetterbox, letterboxError } from '../gen/letterbox.js';

// letter positions around a 300x300 square (three per side)
const SIDE_POS = [
  [[90, 30], [150, 30], [210, 30]],    // top
  [[270, 90], [270, 150], [270, 210]], // right
  [[210, 270], [150, 270], [90, 270]], // bottom
  [[30, 210], [30, 150], [30, 90]],    // left
];

export default {
  id: 'letterbox',
  name: 'Litter Boxed',
  tagline: 'Chain words around a square of letters',
  generate: generateLetterbox,
  rules: [
    'Make words from the twelve letters around the square. Each word needs at least three letters.',
    'Consecutive letters must come from different sides. You can reuse letters.',
    'Each new word starts with the last letter of the word before.',
    'Use every letter to solve. Try to do it within the target number of words.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const saved = ctx.load();
    const words = saved?.words || [];
    let cur = saved?.cur || (words.length ? words[words.length - 1].slice(-1) : '');
    let done = !!saved?.done;
    let hintN = saved?.hintN || 0; // letters of the two-word answer revealed
    const sideOf = {}, posOf = {}, orderOf = {};
    p.sides.forEach((sd, i) => sd.forEach((l, k) => { sideOf[l] = i; posOf[l] = SIDE_POS[i][k]; orderOf[l] = i * 3 + k; }));
    const letters = Object.keys(sideOf);

    // The square is drawn once: a printed box with an offset shadow, pen lines on top, letter pegs on the rim.
    const svg = s('svg', { class: 'lb-svg', viewBox: '0 0 300 300', role: 'group', 'aria-label': 'Letter square' });
    const ink = s('rect', { x: 30, y: 30, width: 240, height: 240, rx: 3, class: 'lb-ink' }); // tints as letters get used
    const trace = s('rect', { x: 30, y: 30, width: 240, height: 240, rx: 3, class: 'lb-trace' }); // the win stroke
    const doneG = s('g', { class: 'lb-done' });
    const curG = s('g', { class: 'lb-cur' });
    const fadeG = s('g', { class: 'lb-fade' });
    const pegs = new Map(); // letter -> <g>
    svg.append(
      s('rect', { x: 36, y: 37, width: 240, height: 240, rx: 3, class: 'lb-shadow' }),
      s('rect', { x: 30, y: 30, width: 240, height: 240, rx: 3, class: 'lb-box' }),
      ink, fadeG, doneG, curG, trace);
    for (const l of letters) {
      const [x, y] = posOf[l];
      const sd = sideOf[l];
      const lx = sd === 1 ? x + 23 : sd === 3 ? x - 23 : x, ly = sd === 0 ? y - 17 : sd === 2 ? y + 28 : y + 8;
      const g = s('g', { class: 'lb-letter', tabindex: '0', role: 'button', 'aria-label': l, style: `--k:${orderOf[l]}` });
      const t = s('text', { x: lx, y: ly, 'text-anchor': 'middle', class: 'lb-label' }); t.textContent = l.toUpperCase();
      const peg = s('g', { class: 'lb-peg' });
      peg.append(s('circle', { cx: x, cy: y, r: 15, class: 'lb-ring' }), s('circle', { cx: x, cy: y, r: 10, class: 'lb-dot' }));
      g.append(peg, t, s('circle', { cx: x, cy: y, r: 26, class: 'lb-hit' }));
      g.addEventListener('pointerdown', (e) => { e.preventDefault(); onKey(l); });
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKey(l); } });
      pegs.set(l, g);
      svg.append(g);
    }

    const wordLine = h('div', { class: 'lb-current', 'aria-live': 'polite' });
    const list = h('div', { class: 'lb-words' });
    const hintChip = h('div', { class: 'hive-hintword lb-hint' });
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    const board = h('div', { class: 'board lb-board' }, svg);
    const tap = (fn) => (e) => { e.currentTarget.blur(); fn(); };
    root.append(wordLine, list, board,
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn', type: 'button', onClick: tap(() => onKey('back')) }, 'Delete'),
        h('button', { class: 'btn', type: 'button', onClick: tap(restart) }, 'Restart'),
        h('button', { class: 'btn primary', type: 'button', onClick: tap(() => onKey('enter')) }, 'Enter')),
      hintChip, status);

    const replay = (el, cls) => { el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); };
    let moment = null; // what just happened, so render() knows which motion to play: 'commit' | 'restart' | 'step-back'

    function restart() {
      if (done) return;
      if (words.length || cur.length > 1) moment = 'restart';
      words.length = 0; cur = ''; render();
    }

    function onKey(k) {
      if (done) return;
      if (k === 'back') {
        if (cur.length > 1 || (cur.length === 1 && !words.length)) cur = cur.slice(0, -1);
        else if (cur.length <= 1 && words.length) { cur = words.pop(); moment = 'step-back'; } // step back into the previous word
        return render();
      }
      if (k === 'enter') {
        const err = letterboxError(p, cur, words[words.length - 1]);
        if (err) { ctx.toast(err); shake(wordLine); replay(curG, 'bad'); return; }
        words.push(cur);
        cur = cur.slice(-1);
        moment = 'commit';
        return render();
      }
      if (k.length === 1 && sideOf[k] !== undefined) {
        const last = cur[cur.length - 1];
        if (last && sideOf[last] === sideOf[k]) {
          ctx.toast('Pick a letter from a different side'); shake(wordLine);
          replay(pegs.get(k), 'nope');
          return;
        }
        cur += k;
        replay(pegs.get(k), 'press');
        render();
      }
    }

    const seg = (a, b, cls) => {
      const [x1, y1] = posOf[a], [x2, y2] = posOf[b];
      const el = s('line', { x1, y1, x2, y2, class: cls });
      el.style.setProperty('--len', Math.hypot(x2 - x1, y2 - y1).toFixed(1));
      return el;
    };
    const pathFor = (w) => [...w].map((l) => posOf[l].join(',')).join(' ');

    // the word being drawn: one pen stroke per pair of letters, so a new stroke can draw itself in
    function drawCurrent() {
      const want = [];
      for (let i = 1; i < cur.length; i++) want.push(cur[i - 1] + cur[i]);
      const have = [...curG.children].map((el) => el.dataset.k);
      let same = 0;
      while (same < want.length && same < have.length && want[same] === have[same]) same++;
      const added = want.length - same, removed = have.length - same;
      // a single letter taken back: its stroke pulls back into the pen
      [...curG.children].slice(same).forEach((el) => {
        if (removed === 1 && added === 0 && !calm()) {
          el.classList.add('undraw');
          el.dataset.k = '';
          setTimeout(() => el.remove(), 180);
        } else el.remove();
      });
      want.slice(same).forEach((k) => {
        const el = seg(k[0], k[1], 'lb-seg' + (added === 1 && moment === null ? ' draw' : ''));
        el.dataset.k = k;
        curG.append(el);
      });
    }

    let prevUsed = null, prevWords = words.length;
    function render() {
      const usedNow = new Set(words.join('') + cur);
      const doneUsed = new Set(words.join(''));

      // finished words: faded pen lines; the one just entered settles from bright to faded
      if (moment === 'restart' && !calm()) {
        const ghost = s('g', {});
        ghost.append(...[...doneG.children, ...curG.children].map((el) => { const c = el.cloneNode(); c.setAttribute('class', 'lb-line'); return c; }));
        fadeG.replaceChildren(ghost);
        setTimeout(() => ghost.remove(), 450);
      }
      doneG.replaceChildren(...words.map((w, i) => s('polyline', {
        points: pathFor(w),
        class: 'lb-line' + (moment === 'commit' && i === words.length - 1 ? ' just' : ''),
      })));
      if (moment === 'commit' || moment === 'restart' || moment === 'step-back') curG.replaceChildren();
      drawCurrent();

      const last = cur[cur.length - 1];
      for (const [l, g] of pegs) {
        const fresh = prevUsed && usedNow.has(l) && !prevUsed.has(l);
        g.classList.toggle('used', usedNow.has(l));
        g.classList.toggle('spent', doneUsed.has(l));
        g.classList.toggle('last', last === l);
        if (fresh) replay(g, 'fill');
      }
      prevUsed = usedNow;
      svg.style.setProperty('--p', (doneUsed.size / letters.length).toFixed(3));

      renderWord();
      renderChain();

      const sol = p.solution.join(' ');
      hintChip.hidden = !hintN;
      if (hintN) {
        let k = 0;
        const shown = [...sol].map((ch) => (ch === ' ' ? '  ' : k++ < hintN ? ch.toUpperCase() : '_')).join(' ');
        put(hintChip, h('span', {}, 'Hint'), h('b', {}, shown));
      }
      const missing = letters.filter((l) => !words.join('').includes(l)).length;
      if (!done) status.textContent = missing ? `${missing} letter${missing > 1 ? 's' : ''} still unused` : '';
      if (!done && words.length && missing === 0) {
        done = true; svg.classList.add('solved');
        win();
        status.textContent = words.length <= p.par ? `Solved in ${words.length} words. Under target.` : `Solved in ${words.length} words.`;
        ctx.solved(`${words.length} word${words.length > 1 ? 's' : ''}`, { value: words.length, higher: false, fmt: (v) => `${v} word${v > 1 ? 's' : ''}` });
      }
      board.classList.toggle('done', done);
      moment = null;
      ctx.save({ words, cur, done, hintN });
    }

    // the word in progress, letter by letter; the first letter is carried over from the last word
    function renderWord() {
      const shown = [...wordLine.querySelectorAll('.lt')];
      const have = shown.map((el) => el.dataset.ch).join('');
      const carry = words.length > 0;
      const span = (ch, i, cls = '') => h('span', { class: 'lt' + (i === 0 && carry ? ' carry' : '') + cls, 'data-ch': ch }, ch.toUpperCase());
      if (!cur) { if (!wordLine.querySelector('.ph')) put(wordLine, h('span', { class: 'ph' }, 'Tap letters')); return; }
      if (cur === have && moment === null) return;
      if (have && cur.startsWith(have) && moment === null) {
        for (const [j, ch] of [...cur.slice(have.length)].entries()) wordLine.append(span(ch, have.length + j, ' in'));
        return;
      }
      if (have.startsWith(cur) && moment === null) { shown.slice(cur.length).forEach((el) => el.remove()); return; }
      put(wordLine, [...cur].map((ch, i) => span(ch, i, cur.length === 1 || moment === 'commit' ? ' in' : '')));
    }

    // the chain of entered words, each one linked to the next by its shared letter
    function renderChain() {
      if (!words.length) {
        put(list, h('span', { class: 'ph' }, `Target: ${p.par} words or fewer`));
      } else {
        put(list, words.map((w, i) => [
          i ? h('i', { class: 'lb-link', 'aria-hidden': 'true' }) : null,
          h('span', { class: 'lb-chip' + (i === words.length - 1 && words.length > prevWords ? ' new' : '') }, w.toUpperCase()),
        ]), h('span', { class: 'lb-count' + (words.length > p.par ? ' over' : '') }, `${words.length}/${p.par}`));
      }
      prevWords = words.length;
    }

    // the win: a pen traces the box in the game's color and every peg pops in turn around it
    function win() {
      if (calm()) return;
      replay(board, 'win');
      setTimeout(() => board.classList.remove('win'), 1800);
    }

    render();
    if (done) svg.classList.add('solved');
    return {
      onKey,
      hint() {
        if (done) return false;
        const total = p.solution.join('').length;
        if (hintN >= total) { ctx.toast('The whole answer is showing'); return false; }
        hintN++;
        render();
        replay(hintChip, 'more');
        return 'One more letter of a two-word answer';
      },
      reveal() {
        words.splice(0, words.length, ...p.solution); cur = '';
        moment = 'restart';
        done = true; svg.classList.add('solved'); render(); status.textContent = `One answer: ${p.solution.join(' – ').toUpperCase()}`;
        ctx.save({ words, cur, done, hintN, revealed: true });
      },
    };
  },
};
