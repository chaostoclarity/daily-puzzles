import { h, put, shake } from '../lib/ui.js';
import { generatePileup, scoreBoard, LABEL, JOKER, linesOf, boardHope } from '../gen/pileup.js';

const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RANK = (r) => (r === 'T' ? '10' : r);
const money = (v) => '$' + v.toLocaleString('en-US');

function cardEl(card, extra = '', attrs = {}) {
  if (!card) return h('span', { class: 'pk-card empty ' + extra, ...attrs });
  if (card === JOKER) return h('span', { class: 'pk-card joker ' + extra, ...attrs }, h('b', {}, '★'), h('i', {}, 'wild'));
  const red = card[1] === 'h' || card[1] === 'd';
  return h('span', { class: `pk-card ${red ? 'red' : ''} ${extra}`, ...attrs }, h('b', {}, RANK(card[0])), h('i', {}, SUIT[card[1]]));
}

export default {
  id: 'pileup',
  name: 'Pile-Up Pokar',
  tagline: 'Deal cards into poker hands',
  version: 1,
  generate: generatePileup,
  rules: [
    'Cards come in deals. Place every card but one in the grid, and put one on the discard pile.',
    'Each row, column and the four corners make a poker hand. The discard pile is a hand too, but it only pays when every other line scores.',
    'Corners pay double and the discard pile pays triple. Every two hands you score raise the multiplier on all of them.',
    'You can rearrange this deal until you tap Deal. Then those cards are locked.',
    'Pair 5, two pair 60, flush 80, three of a kind 125, straight 180, full house 230, four of a kind 325, straight flush 450.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const n = p.n;
    const saved = ctx.load();
    const grid = saved?.grid || new Array(n * n).fill('');
    const discards = saved?.discards || [];
    let turn = saved?.turn || 0; // deals already locked in
    let fresh = saved?.fresh || []; // cells placed this deal
    let freshDiscard = saved?.freshDiscard ?? null; // card discarded this deal
    let hand = saved?.hand || (p.deals[0] ? p.deals[0].slice() : []);
    let done = !!saved?.done;
    let sel = null; // index into hand, or { cell } for a fresh grid card

    const corners = new Set(linesOf(n).find((l) => l.kind === 'corners').cells);
    const gridEl = h('div', { class: 'pk-grid', style: { '--n': n } });
    const discardEl = h('div', { class: 'pk-discard', style: { '--n': n } });
    const handEl = h('div', { class: 'pk-hand', 'aria-label': 'Your deal' });
    const nextEl = h('div', { class: 'pk-next' });
    const dealBtn = h('button', { class: 'btn primary', type: 'button', onClick: deal }, 'Deal');
    const total = h('p', { class: 'pk-total', 'aria-live': 'polite' });
    // star targets come from a practice bot's best run on today's deals
    const goal = p.stars || [0, 0, 0];
    const starsEarned = (v) => goal.filter((g) => v >= g).length;
    const starText = (k) => '★'.repeat(k) + '☆'.repeat(3 - k);
    const meter = h('div', { class: 'pk-meter', role: 'img' },
      h('span', { class: 'pk-fill' }),
      ...goal.map((g, k) => h('span', { class: 'pk-tick', style: { left: `${Math.min(100, (g / goal[2]) * 100)}%` } }, h('b', {}, '★'), h('small', {}, money(g)))));
    const breakdown = h('div', { class: 'pk-lines' });
    // one card width for grid, discard pile and hand, sized so all three fit on one screen
    const wrap = h('div', { class: 'pk-wrap', style: { '--n': n } },
      h('div', { class: 'pk-board' }, gridEl), h('p', { class: 'pk-label' }, 'Discard pile ×3'), discardEl, handEl);
    root.append(total, meter, wrap, nextEl, breakdown);

    function pick(i) { if (done) return; sel = sel === i ? null : i; render(); }

    function tapCell(i) {
      if (done) return;
      if (grid[i]) {
        // pick a card placed this deal back up
        if (fresh.includes(i)) { hand.push(grid[i]); grid[i] = ''; fresh = fresh.filter((x) => x !== i); sel = hand.length - 1; render(); }
        else shake(gridEl.children[i]);
        return;
      }
      if (sel === null) return;
      const gridLeft = n - fresh.length; // grid slots still owed this deal
      if (gridLeft <= 0) { ctx.toast(`Only ${n} cards go in the grid each deal`); return; }
      grid[i] = hand[sel]; hand.splice(sel, 1); fresh.push(i); sel = null;
      render();
    }

    function tapDiscard() {
      if (done) return;
      if (freshDiscard !== null) { hand.push(freshDiscard); discards.pop(); freshDiscard = null; sel = hand.length - 1; render(); return; }
      if (sel === null) return;
      freshDiscard = hand[sel]; discards.push(freshDiscard); hand.splice(sel, 1); sel = null;
      render();
    }

    function deal() {
      if (done || hand.length) return;
      turn++; fresh = []; freshDiscard = null; sel = null;
      if (turn >= p.deals.length) {
        done = true;
        const s = scoreBoard(n, grid, discards);
        render();
        const k = starsEarned(s.total);
        ctx.solved(`${starText(k)} ${money(s.total)}` + (k < 3 ? ` (${money(goal[k])} for ${k + 1} star${k ? 's' : ''})` : ' · beat the bot'));
        return;
      }
      hand = p.deals[turn].slice();
      render();
    }

    function render() {
      const s = scoreBoard(n, grid, discards);
      put(gridEl, grid.map((c, i) => cardEl(c, (corners.has(i) ? 'corner ' : '') + (fresh.includes(i) ? 'fresh' : ''), { role: 'button', tabindex: '0', onClick: () => tapCell(i), 'aria-label': c ? `${c}` : `Empty${corners.has(i) ? ' corner' : ''}` })));
      put(discardEl, Array.from({ length: n }, (_, k) => cardEl(discards[k] || '', discards[k] && discards[k] === freshDiscard && k === discards.length - 1 ? 'fresh' : '', { role: 'button', tabindex: '0', onClick: tapDiscard })));
      // once every card is placed, Deal takes the hand's spot so it's right under the board
      dealBtn.textContent = turn === p.deals.length - 1 ? 'Finish' : 'Deal';
      put(handEl, hand.length
        ? hand.map((c, i) => cardEl(c, sel === i ? 'sel' : '', { role: 'button', tabindex: '0', onClick: () => pick(i) }))
        : done ? null : dealBtn);
      put(nextEl, p.preview && !done && p.deals[turn + 1] ? [h('span', {}, 'Next deal'), ...p.deals[turn + 1].map((c) => cardEl(c, 'mini'))] : null);
      const k = starsEarned(s.total);
      meter.firstChild.style.width = `${Math.min(100, (s.total / Math.max(1, goal[2])) * 100)}%`;
      [...meter.querySelectorAll('.pk-tick')].forEach((el, j) => el.classList.toggle('on', j < k));
      meter.setAttribute('aria-label', `${k} of 3 stars. Targets ${goal.map(money).join(', ')}`);
      put(total, h('b', {}, money(s.total)), h('span', {}, ` · ×${s.handMult} for ${s.lines.filter((l) => l.base).length} hands · deal ${Math.min(turn + 1, p.deals.length)} of ${p.deals.length}`));
      const name = (l) => (l.kind === 'row' ? `Row ${l.idx + 1}` : l.kind === 'col' ? `Column ${l.idx + 1}` : l.kind === 'corners' ? 'Corners ×2' : 'Discards ×3');
      put(breakdown, s.lines.filter((l) => l.hand).map((l) => h('div', { class: 'pk-line' + (l.blocked ? ' blocked' : '') },
        h('span', {}, name(l)), h('span', {}, LABEL[l.hand] + (l.blocked ? ' (needs every line)' : '')), h('b', {}, money(l.points)))));
      gridEl.classList.toggle('solved', done);
      ctx.save({ grid, discards, turn, fresh, freshDiscard, hand, done });
    }
    render();

    return {
      hint() {
        if (done || !hand.length) return false;
        // place one card where it adds the most to a simple look-ahead score
        let best = null;
        // the same look-ahead the practice bot uses
        const potential = () => boardHope(n, grid, discards);
        const base = potential();
        const gridLeft = n - fresh.length;
        hand.forEach((card, k) => {
          if (gridLeft > 0) grid.forEach((c, i) => {
            if (c) return;
            grid[i] = card; const v = potential() - base; grid[i] = '';
            if (!best || v > best.v) best = { v, k, i };
          });
          if (freshDiscard === null && (gridLeft === 0 || hand.length > 1)) {
            const v = -8 + (gridLeft === 0 ? 1000 : 0);
            if (!best || v > best.v) best = { v, k, i: 'discard' };
          }
        });
        if (!best) return false;
        sel = best.k;
        if (best.i === 'discard') tapDiscard(); else tapCell(best.i);
        return best.i === 'discard' ? 'Discarded one card' : 'Placed one card';
      },
    };
  },
};
