import { h, put, s as svgEl, shake } from '../lib/ui.js';
import { generateWordscapes, ACCEPT_TIER, fits } from '../gen/wordscapes.js';
import { isWord } from '../lib/words.js';

export default {
  id: 'wordscapes',
  name: 'Wordscopes',
  tagline: 'Swipe the letter wheel to fill a crossword',
  version: 1,
  generate: generateWordscapes,
  rules: [
    'Swipe across the letters in the wheel to spell a word, then let go. You can also tap letters, or type.',
    'Words that belong in the grid fill their spot. Other real words count as bonus words.',
    'Fill the whole grid to win. Shuffle moves the letters around the wheel.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const saved = ctx.load();
    const found = new Set(saved?.found || []);
    const bonus = new Set(saved?.bonus || []);
    const shown = new Set(saved?.shown || []); // cells revealed by hints, "r,c"
    let order = saved?.order || p.letters.map((_, i) => i);
    let done = !!saved?.done;
    let path = []; // indexes into p.letters

    // grid
    const cellOf = new Map(); // "r,c" -> letter
    for (const w of p.words) for (let i = 0; i < w.word.length; i++) {
      const r = w.r + (w.dir === 'down' ? i : 0), c = w.c + (w.dir === 'across' ? i : 0);
      cellOf.set(r + ',' + c, w.word[i]);
    }
    const cellsOf = (w) => [...w.word].map((_, i) => (w.r + (w.dir === 'down' ? i : 0)) + ',' + (w.c + (w.dir === 'across' ? i : 0)));
    const grid = h('div', { class: 'wsc-grid', style: { '--rows': p.rows, '--cols': p.cols } });
    const els = new Map();
    for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
      const k = r + ',' + c;
      const el = h('div', { class: cellOf.has(k) ? 'wsc-cell' : 'wsc-gap' });
      els.set(k, el); grid.append(el);
    }

    // wheel
    const word = h('p', { class: 'wsc-word', 'aria-live': 'polite' });
    const lines = svgEl('svg', { class: 'wsc-lines', viewBox: '0 0 200 200', 'aria-hidden': 'true' });
    const wheel = h('div', { class: 'wsc-wheel', role: 'group', 'aria-label': 'Letter wheel' }, lines);
    const keys = p.letters.map((ch, i) => {
      const el = h('button', { class: 'wsc-key', type: 'button', 'data-i': i, 'aria-label': ch.toUpperCase() }, ch.toUpperCase());
      wheel.append(el);
      return el;
    });
    const info = h('p', { class: 'hint-line' });
    const shuffleBtn = h('button', { class: 'btn small', type: 'button', onClick: () => { order = shuffleOrder(order); render(); } }, 'Shuffle');
    root.append(h('div', { class: 'board wsc-board', style: { '--cols': p.cols, '--rows': p.rows } }, grid), word, h('div', { class: 'wsc-wheel-wrap' }, wheel), h('div', { class: 'row-actions' }, shuffleBtn), info);

    function shuffleOrder(o) { const a = o.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    const angle = (slot) => (slot / p.letters.length) * 2 * Math.PI - Math.PI / 2;
    const spot = (i) => { const a = angle(order.indexOf(i)); return [100 + 70 * Math.cos(a), 100 + 70 * Math.sin(a)]; };

    // swipe: pointer down on a key starts a path; moving over other keys adds them
    let swiping = false;
    const keyAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.classList?.contains('wsc-key') ? Number(el.dataset.i) : null; };
    wheel.addEventListener('pointerdown', (e) => {
      if (done) return;
      const i = keyAt(e.clientX, e.clientY);
      if (i === null) return;
      e.preventDefault();
      swiping = true; path = [i];
      wheel.setPointerCapture(e.pointerId);
      render();
    });
    wheel.addEventListener('pointermove', (e) => {
      if (!swiping) return;
      const i = keyAt(e.clientX, e.clientY);
      if (i === null) return;
      if (path.length > 1 && path[path.length - 2] === i) { path.pop(); render(); return; } // slide back to undo
      if (!path.includes(i)) { path.push(i); render(); }
    });
    const end = () => { if (!swiping) return; swiping = false; submit(); };
    wheel.addEventListener('pointerup', end);
    wheel.addEventListener('pointercancel', end);

    function submit() {
      const w = path.map((i) => p.letters[i]).join('');
      path = [];
      if (w.length < p.min) { render(); return; }
      const target = p.words.find((x) => x.word === w);
      if (target) {
        if (found.has(w)) ctx.toast('Already found');
        else { found.add(w); ctx.toast(w.toUpperCase()); }
      } else if (isWord(w, ACCEPT_TIER)) {
        if (bonus.has(w)) ctx.toast('Already a bonus word');
        else { bonus.add(w); ctx.toast(`Bonus word: ${w.toUpperCase()}`); }
      } else {
        shake(word);
      }
      finishIfDone();
      render();
    }

    function finishIfDone() {
      if (done) return;
      // a word also counts once hints have shown all its letters
      for (const w of p.words) if (!found.has(w.word) && cellsOf(w).every((k) => shown.has(k) || filledByFound(k))) found.add(w.word);
      if (found.size === p.words.length) {
        done = true;
        ctx.solved(`${p.words.length} words${bonus.size ? `, ${bonus.size} bonus` : ''}`);
      }
    }
    const filledByFound = (k) => p.words.some((w) => found.has(w.word) && cellsOf(w).includes(k));

    function render() {
      for (const [k, el] of els) {
        if (!cellOf.has(k)) continue;
        const open = filledByFound(k) || shown.has(k);
        el.textContent = open ? cellOf.get(k).toUpperCase() : '';
        el.classList.toggle('open', open);
        el.classList.toggle('hinted', shown.has(k) && !filledByFound(k));
      }
      keys.forEach((el, i) => {
        const [x, y] = spot(i);
        el.style.left = `${x / 2}%`; el.style.top = `${y / 2}%`;
        el.classList.toggle('on', path.includes(i));
        el.disabled = done;
      });
      put(lines, path.length > 1 ? svgEl('polyline', { points: path.map((i) => spot(i).join(',')).join(' ') }) : null);
      put(word, path.map((i) => p.letters[i]).join('').toUpperCase() || ' ');
      put(info, `${found.size} of ${p.words.length} words` + (bonus.size ? ` · ${bonus.size} bonus` : ''));
      grid.classList.toggle('solved', done);
      ctx.save({ found: [...found], bonus: [...bonus], shown: [...shown], order, done });
    }
    render();

    return {
      onKey(key) {
        if (done) return false;
        if (key === 'enter') { submit(); return true; }
        if (key === 'back') { path.pop(); render(); return true; }
        if (/^[a-z]$/.test(key)) {
          const i = p.letters.findIndex((ch, k) => ch === key && !path.includes(k));
          if (i < 0) { shake(word); return true; }
          path.push(i); render(); return true;
        }
        return false;
      },
      hint() {
        if (done) return false;
        // show one letter of the shortest unfound word
        const w = p.words.find((x) => !found.has(x.word));
        if (!w) return false;
        const k = cellsOf(w).find((c) => !shown.has(c) && !filledByFound(c));
        if (k) shown.add(k);
        finishIfDone();
        render();
        return 'Revealed one letter';
      },
      reveal() {
        for (const w of p.words) found.add(w.word);
        done = true; path = []; render();
      },
    };
  },
};

export { fits };
