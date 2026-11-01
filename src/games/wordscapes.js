import './wordscapes.css';
import { h, put, s as svgEl, shake } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateWordscapes, ACCEPT_TIER, fits } from '../gen/wordscapes.js';
import { isWord } from '../lib/words.js';

const SHUFFLE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3.5c2 0 3.2.9 4.3 2.6l.9 1.4M4 17h3.5c2 0 3.2-.9 4.3-2.6l2.4-3.8C15.3 8.9 16.5 8 18.5 8H20M17 5l3 3-3 3M20 16h-1.5c-1.6 0-2.7-.6-3.6-1.7M17 13l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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

    // grid: empty boxes waiting for letters
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
      const el = h('div', { class: cellOf.has(k) ? 'wsc-cell' : 'wsc-gap', style: { '--d': r + c } });
      els.set(k, el); grid.append(el);
    }

    // wheel: the letters sit on a dial and orbit to new places when shuffled
    const word = h('p', { class: 'wsc-word', 'aria-live': 'polite' });
    const wordWrap = h('div', { class: 'wsc-word-wrap' }, word);
    const trail = svgEl('polyline', { class: 'wsc-trail' });
    const lines = svgEl('svg', { class: 'wsc-lines', viewBox: '0 0 200 200', 'aria-hidden': 'true' });
    lines.append(trail);
    const wheel = h('div', { class: 'wsc-wheel', role: 'group', 'aria-label': 'Letter wheel' }, lines);
    const angles = p.letters.map((_, i) => (order.indexOf(i) / p.letters.length) * 360);
    const keys = p.letters.map((ch, i) => {
      const el = h('button', { class: 'wsc-key', type: 'button', 'data-i': i, 'aria-label': ch.toUpperCase() }, h('span', {}, ch.toUpperCase()));
      el.style.setProperty('--wsc-a', `${angles[i]}deg`);
      wheel.append(el);
      return el;
    });
    const count = h('div', { class: 'wsc-count', 'aria-live': 'polite' });
    const shuffleBtn = h('button', {
      class: 'icon-btn wsc-shuffle', type: 'button', 'aria-label': 'Shuffle letters', html: SHUFFLE_ICON,
      onClick: (e) => { e.currentTarget.blur(); shuffleWheel(); },
    });
    const board = h('div', { class: 'board wsc-board', style: { '--cols': p.cols, '--rows': p.rows } }, grid);
    root.append(board, wordWrap, h('div', { class: 'wsc-wheel-wrap' }, shuffleBtn, wheel, count));

    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    function shuffleOrder(o) { const a = o.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    const angle = (slot) => (slot / p.letters.length) * 2 * Math.PI - Math.PI / 2;
    const spot = (i) => { const a = angle(order.indexOf(i)); return [100 + 70 * Math.cos(a), 100 + 70 * Math.sin(a)]; };

    // every letter orbits clockwise to its new place
    function setAngles(extra = 0) {
      keys.forEach((el, i) => {
        const target = (order.indexOf(i) / p.letters.length) * 360;
        let turn = (((target - angles[i]) % 360) + 360) % 360;
        if (turn === 0) turn = extra ? 0 : 360;
        angles[i] += turn + extra;
        el.style.transitionDelay = `${order.indexOf(i) * 22}ms`;
        el.style.setProperty('--wsc-a', `${angles[i]}deg`);
      });
    }
    function shuffleWheel() {
      if (done) return;
      order = shuffleOrder(order);
      setAngles();
      replay(wheel, 'spin');
      render();
    }

    // swipe: pointer down on a key starts a path; moving over other keys adds them
    let swiping = false;
    const keyAt = (x, y) => { const el = document.elementFromPoint(x, y)?.closest?.('.wsc-key'); return el && wheel.contains(el) ? Number(el.dataset.i) : null; };
    let finger = null; // the pointer, in wheel units, so the trail can follow it
    const toWheel = (e) => { const r = wheel.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 200, ((e.clientY - r.top) / r.height) * 200]; };
    wheel.addEventListener('pointerdown', (e) => {
      if (done) return;
      const i = keyAt(e.clientX, e.clientY);
      if (i === null) return;
      e.preventDefault();
      swiping = true; path = [i]; finger = toWheel(e);
      wheel.setPointerCapture(e.pointerId);
      render();
    });
    wheel.addEventListener('pointermove', (e) => {
      if (!swiping) return;
      finger = toWheel(e);
      const i = keyAt(e.clientX, e.clientY);
      if (i !== null && path.length > 1 && path[path.length - 2] === i) { path.pop(); render(); return; } // slide back to undo
      if (i !== null && !path.includes(i)) { path.push(i); render(); return; }
      drawTrail();
    });
    const end = () => { if (!swiping) return; swiping = false; finger = null; submit(); };
    wheel.addEventListener('pointerup', end);
    wheel.addEventListener('pointercancel', end);

    function submit() {
      const w = path.map((i) => p.letters[i]).join('');
      // where the spelled letters are now, so they can fly from there
      const from = [...word.querySelectorAll('.lt')].map((el) => el.getBoundingClientRect());
      path = [];
      if (w.length < p.min) { release(w ? 'fade' : null); render(); return; }
      const target = p.words.find((x) => x.word === w);
      let fly = null;
      if (target) {
        if (found.has(w)) { ctx.toast('Already found'); release('fade'); pulse(cellsOf(target), 'again'); }
        else { found.add(w); ctx.toast(w.toUpperCase()); fly = { cells: cellsOf(target), from }; word.replaceChildren(); }
      } else if (isWord(w, ACCEPT_TIER)) {
        if (bonus.has(w)) { ctx.toast('Already a bonus word'); release('fade'); }
        else { bonus.add(w); ctx.toast(`Bonus word: ${w.toUpperCase()}`); release('bonus'); replay(count, 'bump'); }
      } else {
        release('bad');
        shake(word);
      }
      const before = new Set([...els.keys()].filter(isOpen));
      finishIfDone();
      render(fly ? new Set(fly.cells.filter((k) => !before.has(k))) : null);
      if (fly) flyIn(fly.cells, fly.from, before);
    }

    function finishIfDone() {
      if (done) return;
      // a word also counts once hints have shown all its letters
      for (const w of p.words) if (!found.has(w.word) && cellsOf(w).every((k) => shown.has(k) || filledByFound(k))) found.add(w.word);
      if (found.size === p.words.length) {
        done = true;
        ctx.solved(`${p.words.length} words${bonus.size ? `, ${bonus.size} bonus` : ''}`);
        win();
      }
    }
    const filledByFound = (k) => p.words.some((w) => found.has(w.word) && cellsOf(w).includes(k));
    const isOpen = (k) => cellOf.has(k) && (filledByFound(k) || shown.has(k));

    // the spelled word leaves the bubble: shaking off (bad), lifting away (bonus) or fading (repeat)
    function release(kind) {
      const letters = [...word.querySelectorAll('.lt')];
      if (!kind || !letters.length || calm()) return;
      const ghost = h('p', { class: `wsc-word wsc-ghost ${kind}` }, letters.map((el) => el.cloneNode(true)));
      wordWrap.append(ghost);
      if (kind === 'bonus') wordWrap.append(h('span', { class: 'wsc-bubble', onAnimationend: (e) => e.currentTarget.remove() }, 'Bonus!'));
      setTimeout(() => ghost.remove(), 650);
      word.replaceChildren();
    }

    function pulse(cells, cls) { for (const k of cells) replay(els.get(k), cls); }

    // each letter of a found word flies from the bubble into its box, one after another
    function flyIn(cells, from, before) {
      if (calm() || !document.body.animate) { pulse(cells, 'pop'); return; }
      cells.forEach((k, j) => {
        const to = els.get(k);
        const a = from[j], b = to.getBoundingClientRect();
        if (!a || !b.width) { to.classList.remove('landing'); replay(to, 'pop'); return; }
        const ghost = h('span', { class: 'wsc-fly' }, cellOf.get(k).toUpperCase());
        ghost.style.width = `${b.width}px`; ghost.style.height = `${b.height}px`;
        document.body.append(ghost);
        const x0 = a.left + a.width / 2 - b.width / 2, y0 = a.top + a.height / 2 - b.height / 2;
        const s0 = Math.max(0.6, a.height / b.height);
        const anim = ghost.animate([
          { transform: `translate(${x0}px, ${y0}px) scale(${s0})`, opacity: 1 },
          { transform: `translate(${(x0 + b.left) / 2}px, ${Math.min(y0, b.top) - 30}px) scale(${s0 * 1.1})`, opacity: 1, offset: 0.45 },
          { transform: `translate(${b.left}px, ${b.top}px) scale(1)`, opacity: 1 },
        ], { duration: 420, delay: j * 70, easing: 'cubic-bezier(0.35, 0.1, 0.25, 1)', fill: 'backwards' });
        const done_ = () => { ghost.remove(); to.classList.remove('landing'); replay(to, before.has(k) ? 'again' : 'pop'); };
        anim.onfinish = done_; anim.oncancel = done_;
      });
    }

    // the win: a ripple flips across the grid, corner to corner, and the dial takes a full turn
    function win() {
      if (calm()) return;
      setTimeout(() => { // after the last letters have landed
        if (!grid.isConnected) return;
        replay(grid, 'win');
        setAngles(360);
        setTimeout(() => grid.classList.remove('win'), 1800);
      }, 700);
    }

    let prevPath = [];
    function render(landing = null) {
      for (const [k, el] of els) {
        if (!cellOf.has(k)) continue;
        const open = isOpen(k);
        const was = el.classList.contains('open');
        el.textContent = open ? cellOf.get(k).toUpperCase() : '';
        el.classList.toggle('open', open);
        el.classList.toggle('hinted', shown.has(k) && !filledByFound(k));
        if (landing?.has(k) && !calm()) el.classList.add('landing');
        else if (open && !was && prevRendered && !landing) replay(el, 'pop');
      }
      keys.forEach((el, i) => {
        const on = path.includes(i);
        el.classList.toggle('on', on);
        if (on && !prevPath.includes(i)) replay(el, 'pick');
        el.disabled = done;
      });
      prevPath = path.slice();
      drawTrail();
      if (path.length) put(word, path.map((i, j) => h('span', { class: 'lt' + (j === path.length - 1 ? ' in' : '') }, p.letters[i].toUpperCase())));
      else if (word.querySelector('.lt')) word.replaceChildren();
      word.classList.toggle('on', path.length > 0);
      put(count, h('b', {}, `${found.size}`, h('small', {}, `/${p.words.length}`)), h('span', {}, 'words'),
        bonus.size ? h('em', {}, `+${bonus.size} bonus`) : null);
      count.setAttribute('aria-label', `${found.size} of ${p.words.length} words` + (bonus.size ? `, ${bonus.size} bonus` : ''));
      grid.classList.toggle('solved', done);
      wheel.classList.toggle('done', done);
      prevRendered = true;
      ctx.save({ found: [...found], bonus: [...bonus], shown: [...shown], order, done });
    }
    let prevRendered = false;

    // the trail: from letter to letter, and on to the finger while swiping
    function drawTrail() {
      const pts = path.map((i) => spot(i));
      if (swiping && finger && pts.length) pts.push(finger);
      trail.setAttribute('points', pts.length > 1 ? pts.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ') : '');
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
