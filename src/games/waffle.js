import { h, put, shake } from '../lib/ui.js';
import { generateWaffle, colorsFor, minSwaps, CELLS } from '../gen/waffle.js';

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
      els.push(el); grid.append(el);
    }
    const meter = h('p', { class: 'wf-meter', 'aria-live': 'polite' });
    root.append(h('div', { class: 'board wf-board' }, grid), meter);

    const left = () => p.swaps - used;
    const solved = () => CELLS.every((i) => cur[i] === p.sol[i]);

    function swap(a, b) { [cur[a], cur[b]] = [cur[b], cur[a]]; }

    function tap(i) {
      if (over || cur[i] === p.sol[i]) return;
      if (sel === null) { sel = i; return render(); }
      if (sel === i) { sel = null; return render(); }
      if (cur[sel] === cur[i]) { shake(els[i]); sel = null; return render(); } // same letter: nothing to gain
      swap(sel, i); used++; sel = null;
      check();
      render();
    }

    function check() {
      if (solved()) {
        over = 'won';
        const spare = left();
        ctx.solved(`${spare} swap${spare === 1 ? '' : 's'} to spare (${'★'.repeat(spare)}${'☆'.repeat(Math.max(0, 5 - spare))})`);
      } else if (left() <= 0) {
        over = 'lost';
        ctx.finished?.();
        ctx.toast('Out of swaps. Here is the answer');
        for (const i of CELLS) cur[i] = p.sol[i];
      }
    }

    function render() {
      const colors = colorsFor(cur, p.sol);
      for (const i of CELLS) {
        const el = els[i];
        el.textContent = cur[i].toUpperCase();
        el.className = `wf-tile ${colors[i]}` + (sel === i ? ' sel' : '') + (over === 'lost' ? ' shown' : '');
        el.disabled = !!over || colors[i] === 'hit';
        el.setAttribute('aria-label', `${cur[i].toUpperCase()}, ${colors[i] === 'hit' ? 'correct' : colors[i] === 'near' ? 'in a word here, wrong spot' : 'not in these words'}`);
      }
      grid.classList.toggle('solved', over === 'won');
      put(meter, over === 'won' ? h('span', {}, h('b', {}, left()), ` swap${left() === 1 ? '' : 's'} to spare`)
        : over === 'lost' ? h('span', {}, 'Out of swaps. The answer is shown.')
          : [h('span', {}, h('b', {}, left()), ` swap${left() === 1 ? '' : 's'} left`), h('span', { class: 'wf-par' }, `par ${p.par}`)]);
      ctx.save({ cur, used, over });
    }
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
        swap(pick[0], pick[1]); sel = null;
        check();
        render();
        return `Swapped ${cur[pick[0]].toUpperCase()} into place. Hints don't use up swaps`;
      },
      reveal() {
        for (const i of CELLS) cur[i] = p.sol[i];
        over = 'lost'; sel = null; render();
      },
    };
  },
};
