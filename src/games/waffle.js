import './waffle.css';
import { h, put, shake } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateWaffle, colorsFor, minSwaps, CELLS } from '../gen/waffle.js';

const FLY = 420; // ms for two tiles to trade places

export default {
  id: 'waffle',
  name: 'Woffle',
  tagline: 'Swap letters until six words line up',
  version: 1,
  generate: generateWaffle,
  rules: [
    'Six five-letter words run across and down the waffle. Their letters are scrambled.',
    'Tap a letter, then tap another to swap them.',
    'Green is in the right spot. Yellow belongs somewhere else in a word that runs through that square. Gray belongs in neither of its words.',
    'Solve it before your swaps run out. The fewest possible is shown as par; every swap you save is a star.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const saved = ctx.load();
    const cur = saved?.cur || p.start.slice();
    let used = saved?.used || 0;
    let over = saved?.over || null; // 'won' | 'lost'
    let sel = null;
    const els = [];
    const grid = h('div', { class: 'wf-grid', role: 'grid', 'aria-label': 'Waffle' });
    for (let i = 0; i < 25; i++) {
      const el = CELLS.includes(i)
        ? h('button', { class: 'wf-tile', type: 'button', onClick: () => tap(i) })
        : h('div', { class: 'wf-hole', 'aria-hidden': 'true' });
      el.style.setProperty('--d', Math.floor(i / 5) + (i % 5)); // diagonal, for waves across the board
      els.push(el); grid.append(el);
    }
    const board = h('div', { class: 'board wf-board' }, grid);
    // swaps as pips: the ones up to par are the swaps you need, the rest are stars you keep by not spending them
    const pips = h('div', { class: 'wf-pips', 'aria-hidden': 'true' });
    const meter = h('p', { class: 'wf-meter', 'aria-live': 'polite' });
    root.append(board, h('div', { class: 'wf-status' }, pips, meter));

    const left = () => p.swaps - used;
    const solved = () => CELLS.every((i) => cur[i] === p.sol[i]);
    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

    function swap(a, b) { [cur[a], cur[b]] = [cur[b], cur[a]]; }

    // two tiles trade places along opposite arcs: one passes in front, the other ducks behind
    function fly(a, b, ra, rb) {
      if (calm() || !els[a].animate) return;
      const path = (el, from, to, side, front) => {
        const dx = from.left - to.left, dy = from.top - to.top;
        const dist = Math.hypot(dx, dy) || 1;
        const lift = Math.min(46, dist * 0.32) * side;
        const nx = (-dy / dist) * lift, ny = (dx / dist) * lift;
        const frames = [];
        for (let k = 0; k <= 8; k++) {
          const t = k / 8, u = 1 - t;
          // quadratic curve from the old spot to the new one, bowed out to one side
          const x = u * u * dx + 2 * u * t * (dx / 2 + nx);
          const y = u * u * dy + 2 * u * t * (dy / 2 + ny);
          const sc = 1 + Math.sin(Math.PI * t) * (front ? 0.14 : -0.1);
          frames.push({ transform: `translate(${x}px, ${y}px) scale(${sc})`, offset: t });
        }
        el.style.zIndex = front ? 3 : 2;
        el.classList.add('flying');
        const an = el.animate(frames, { duration: FLY, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' });
        const end = () => { el.style.zIndex = ''; el.classList.remove('flying'); };
        an.onfinish = end; an.oncancel = end;
      };
      path(els[a], rb, ra, 1, true);
      path(els[b], ra, rb, -1, false);
    }

    // swap with motion: measure, change, render, then fly the tiles from where they were
    function swapTiles(a, b) {
      const ra = els[a].getBoundingClientRect(), rb = els[b].getBoundingClientRect();
      swap(a, b);
      return () => fly(a, b, ra, rb);
    }

    function tap(i) {
      if (over || cur[i] === p.sol[i]) return;
      if (sel === null) { sel = i; return render(); }
      if (sel === i) { sel = null; return render(); }
      if (cur[sel] === cur[i]) { shake(els[i]); sel = null; return render(); } // same letter: nothing to gain
      const go = swapTiles(sel, i); used++; sel = null;
      check();
      render(true);
      go();
    }

    function check() {
      if (solved()) {
        over = 'won';
        const spare = left();
        replay(board, 'win');
        ctx.solved(`${spare} swap${spare === 1 ? '' : 's'} to spare (${'★'.repeat(spare)}${'☆'.repeat(Math.max(0, 5 - spare))})`, { value: spare, higher: true, fmt: (v) => `${v} spare` });
      } else if (left() <= 0) {
        over = 'lost';
        ctx.finished?.();
        ctx.toast('Out of swaps. Here is the answer');
        for (const i of CELLS) cur[i] = p.sol[i];
        replay(board, 'shown');
      }
    }

    let prevColors = null, shownLeft = null;
    function render(swapped = false) {
      const colors = colorsFor(cur, p.sol);
      for (const i of CELLS) {
        const el = els[i];
        el.textContent = cur[i].toUpperCase();
        // a square that just turned green locks in with a pop
        const lock = el.classList.contains('lock') || (swapped && prevColors && prevColors[i] !== 'hit' && colors[i] === 'hit' && over !== 'lost');
        el.className = `wf-tile ${colors[i]}` + (sel === i ? ' sel' : '') + (over === 'lost' ? ' shown' : '') + (lock ? ' lock' : '');
        el.disabled = !!over || colors[i] === 'hit';
        el.setAttribute('aria-label', `${cur[i].toUpperCase()}, ${colors[i] === 'hit' ? 'correct' : colors[i] === 'near' ? 'in a word here, wrong spot' : 'not in these words'}`);
      }
      prevColors = colors;
      grid.classList.toggle('picking', sel !== null);
      grid.classList.toggle('solved', over === 'won');
      put(pips, Array.from({ length: p.swaps }, (_, k) => h('i', {
        class: (k >= p.par ? 'star' : '') + (k < used ? ' used' : '') + (shownLeft != null && k < used && k >= p.swaps - shownLeft ? ' just' : ''),
      })));
      const n = h('b', { class: shownLeft != null && shownLeft !== left() ? 'tick' : '' }, left());
      put(meter, over === 'won' ? h('span', {}, n, ` swap${left() === 1 ? '' : 's'} to spare`)
        : over === 'lost' ? h('span', {}, 'Out of swaps. The answer is shown.')
          : [h('span', {}, n, ` swap${left() === 1 ? '' : 's'} left`), h('span', { class: 'wf-par' }, `par ${p.par}`)]);
      shownLeft = left();
      ctx.save({ cur, used, over });
    }
    // a lock pop clears itself once it has played
    grid.addEventListener('animationend', (e) => { if (e.animationName === 'wf-lock') e.target.classList.remove('lock'); });
    render();

    return {
      hint() {
        if (over) return false;
        // make one swap from a fastest solution: fix two squares at once when possible
        const wrong = CELLS.filter((i) => cur[i] !== p.sol[i]);
        const need = minSwaps(cur, p.sol);
        let pick = null;
        for (const a of wrong) for (const b of wrong) if (a < b && cur[a] === p.sol[b] && cur[b] === p.sol[a]) { pick ||= [a, b]; }
        if (!pick) {
          for (const a of wrong) {
            for (const b of wrong) {
              if (a === b || cur[b] !== p.sol[a]) continue;
              swap(a, b);
              const ok = minSwaps(cur, p.sol) === need - 1;
              swap(a, b);
              if (ok) { pick = [a, b]; break; }
            }
            if (pick) break;
          }
        }
        if (!pick) return false;
        const go = swapTiles(pick[0], pick[1]); sel = null;
        check();
        render(true);
        go();
        return `Swapped ${cur[pick[0]].toUpperCase()} into place. Hints don't use up swaps`;
      },
      reveal() {
        for (const i of CELLS) cur[i] = p.sol[i];
        over = 'lost'; sel = null; render();
        replay(board, 'shown');
      },
    };
  },
};
