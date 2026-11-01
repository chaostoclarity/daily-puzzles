import './pileup.css';
import { h, put, shake } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generatePileup, scoreBoard, LABEL, JOKER, linesOf, boardHope } from '../gen/pileup.js';

const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_NAME = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const RANK_NAME = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: '10' };
const RANK = (r) => (r === 'T' ? '10' : r);
const money = (v) => '$' + v.toLocaleString('en-US');
const cardName = (c) => (c === JOKER ? 'Joker, wild' : `${RANK_NAME[c[0]] || c[0]} of ${SUIT_NAME[c[1]]}`);
// short hand names for the labels at the end of each row and column on the table
const SHORT = { pair: 'Pair', twopair: 'Two pair', flush: 'Flush', trips: 'Trips', straight: 'Straight', fullhouse: 'Full house', quads: 'Quads', straightflush: 'Str. flush' };

function cardEl(card, extra = '', attrs = {}) {
  if (!card) return h('span', { class: 'pk-card empty ' + extra, ...attrs });
  if (card === JOKER) return h('span', { class: 'pk-card joker ' + extra, ...attrs }, h('b', {}, '★'), h('i', {}, 'wild'));
  const red = card[1] === 'h' || card[1] === 'd';
  // the rank carries a small suit under it, like a real card's corner index; the big pip sits opposite
  return h('span', { class: `pk-card ${red ? 'red' : ''} ${extra}`, ...attrs }, h('b', { 'data-s': SUIT[card[1]] }, RANK(card[0])), h('i', {}, SUIT[card[1]]));
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

    // one-shot motion cues, read and cleared by the next render
    let cue = { deal: !done && hand.length > 0, win: false, fly: null };

    const corners = new Set(linesOf(n).find((l) => l.kind === 'corners').cells);
    const gridEl = h('div', { class: 'pk-grid', style: { '--n': n } });
    const discardEl = h('div', { class: 'pk-discard', style: { '--n': n } });
    const handEl = h('div', { class: 'pk-hand', 'aria-label': 'Your deal' });
    const nextEl = h('div', { class: 'pk-next' });
    const dealBtn = h('button', { class: 'btn primary pk-dealbtn', type: 'button', onClick: (e) => { e.currentTarget.blur(); deal(); } }, 'Deal');
    // score bar: the bankroll counts up, the multiplier chip, and a card back for every deal
    const moneyEl = h('b', { class: 'pk-money' }, money(0));
    const bump = h('span', { class: 'pk-bump', 'aria-hidden': 'true' });
    const multEl = h('span', { class: 'pk-mult' });
    const dealsEl = h('span', { class: 'pk-deals' });
    const said = h('p', { class: 'sr-only', 'aria-live': 'polite' });
    const total = h('div', { class: 'pk-total' }, h('span', { class: 'pk-bank' }, moneyEl, bump), multEl, dealsEl);
    // star targets come from a practice bot's best run on today's deals
    const goal = p.stars || [0, 0, 0];
    const starsEarned = (v) => goal.filter((g) => v >= g).length;
    const starText = (k) => '★'.repeat(k) + '☆'.repeat(3 - k);
    const meter = h('div', { class: 'pk-meter', role: 'img' },
      h('span', { class: 'pk-fill' }),
      ...goal.map((g) => h('span', { class: 'pk-tick', style: { left: `${Math.min(100, (g / goal[2]) * 100)}%` } }, h('b', {}, '★'), h('small', {}, money(g)))));
    const breakdown = h('div', { class: 'pk-lines' });
    // the table: hand names sit at the end of each row and under each column, corners in the corner
    const rowLab = h('div', { class: 'pk-rowlab', 'aria-hidden': 'true' }, Array.from({ length: n }, () => h('span')));
    const colLab = h('div', { class: 'pk-collab', 'aria-hidden': 'true' }, Array.from({ length: n }, () => h('span')));
    const cornLab = h('div', { class: 'pk-cornlab', 'aria-hidden': 'true' });
    const discLab = h('div', { class: 'pk-disclab', 'aria-hidden': 'true' });
    const felt = h('div', { class: 'board pk-felt' },
      h('div', { class: 'pk-table' }, gridEl, rowLab, colLab, cornLab),
      h('div', { class: 'pk-discrow' }, discardEl, discLab));
    // one card width for grid, discard pile and hand, sized so all three fit on one screen
    const wrap = h('div', { class: 'pk-wrap', style: { '--n': n } }, felt, handEl);
    root.append(total, meter, wrap, nextEl, breakdown, said);
    // cards are spans with role=button: Enter and Space press them like buttons
    wrap.addEventListener('keydown', (e) => {
      const t = e.target.closest?.('[role="button"]');
      if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); t.click(); }
    });

    const rectOf = (el) => (el ? el.getBoundingClientRect() : null);

    function pick(i) { if (done) return; sel = sel === i ? null : i; render(); }

    function tapCell(i) {
      if (done) return;
      if (grid[i]) {
        // pick a card placed this deal back up
        if (fresh.includes(i)) {
          cue.fly = { from: rectOf(gridEl.children[i]), to: () => handEl.children[hand.length - 1] };
          hand.push(grid[i]); grid[i] = ''; fresh = fresh.filter((x) => x !== i); sel = hand.length - 1; render();
        }
        else shake(gridEl.children[i]);
        return;
      }
      if (sel === null) return;
      const gridLeft = n - fresh.length; // grid slots still owed this deal
      if (gridLeft <= 0) { ctx.toast(`Only ${n} cards go in the grid each deal`); shake(handEl.children[sel] || handEl); return; }
      cue.fly = { from: rectOf(handEl.children[sel]), to: () => gridEl.children[i], rot: +(handEl.children[sel]?.style.getPropertyValue('--rot') || '0').replace('deg', '') };
      grid[i] = hand[sel]; hand.splice(sel, 1); fresh.push(i); sel = null;
      render();
    }

    function tapDiscard() {
      if (done) return;
      if (freshDiscard !== null) {
        cue.fly = { from: rectOf(discardEl.children[discards.length - 1]), to: () => handEl.children[hand.length - 1] };
        hand.push(freshDiscard); discards.pop(); freshDiscard = null; sel = hand.length - 1; render(); return;
      }
      if (sel === null) return;
      const k = discards.length;
      cue.fly = { from: rectOf(handEl.children[sel]), to: () => discardEl.children[k] };
      freshDiscard = hand[sel]; discards.push(freshDiscard); hand.splice(sel, 1); sel = null;
      render();
    }

    function deal() {
      if (done || hand.length) return;
      turn++; fresh = []; freshDiscard = null; sel = null;
      if (turn >= p.deals.length) {
        done = true;
        cue.win = true;
        const s = scoreBoard(n, grid, discards);
        render();
        const k = starsEarned(s.total);
        ctx.solved(`${starText(k)} ${money(s.total)}` + (k < 3 ? ` (${money(goal[k])} for ${k + 1} star${k ? 's' : ''})` : ' · beat the bot'), { value: s.total, higher: true, fmt: money });
        return;
      }
      hand = p.deals[turn].slice();
      cue.deal = true;
      render();
    }

    // a card glides from where it was to where it landed
    function flyFrom(from, el, rot = 0) {
      if (!from || !el || calm() || !el.animate) return;
      const b = el.getBoundingClientRect();
      if (!b.width) return;
      const dx = from.left + from.width / 2 - (b.left + b.width / 2), dy = from.top + from.height / 2 - (b.top + b.height / 2);
      const sc = from.width / b.width;
      el.animate([
        { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sc})`, zIndex: 6 },
        { transform: `translate(${dx * 0.12}px, ${dy * 0.12 - 6}px) rotate(${rot * 0.1}deg) scale(1.06)`, zIndex: 6, offset: 0.75 },
        { transform: 'none', zIndex: 6 },
      ], { duration: 320, easing: 'cubic-bezier(0.25, 0.8, 0.3, 1)' });
    }

    // the bankroll ticks up rather than jumping
    let shownTotal = null;
    function countTo(to) {
      const from = shownTotal;
      shownTotal = to;
      if (from == null || from === to || calm()) { moneyEl.textContent = money(to); return; }
      if (to > from) { bump.textContent = `+${money(to - from)}`; bump.classList.remove('go'); void bump.offsetWidth; bump.classList.add('go'); }
      const t0 = performance.now(), ms = 520;
      const step = (now) => {
        if (shownTotal !== to) return; // a newer count took over
        const t = Math.min(1, (now - t0) / ms), e = 1 - (1 - t) ** 3;
        moneyEl.textContent = money(Math.round(from + (to - from) * e));
        if (t < 1 && moneyEl.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    const lineKey = (l) => l.kind + l.idx;
    let prevHands = null, prevStars = null, prevMult = null;
    const name = (l) => (l.kind === 'row' ? `Row ${l.idx + 1}` : l.kind === 'col' ? `Column ${l.idx + 1}` : l.kind === 'corners' ? 'Corners ×2' : 'Discards ×3');

    function render() {
      const s = scoreBoard(n, grid, discards);
      const gridLeft = n - fresh.length;
      put(gridEl, grid.map((c, i) => cardEl(c, (corners.has(i) ? 'corner ' : '') + (fresh.includes(i) ? 'fresh' : ''), {
        role: 'button', tabindex: '0', onClick: () => tapCell(i),
        style: { '--d': Math.floor(i / n) + (i % n) },
        'aria-label': c ? `${cardName(c)}${fresh.includes(i) ? ', placed this deal' : ''}` : `Empty${corners.has(i) ? ' corner' : ''}, row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}`,
      })));
      put(discardEl, Array.from({ length: n }, (_, k) => cardEl(discards[k] || '', discards[k] && discards[k] === freshDiscard && k === discards.length - 1 ? 'fresh' : '', {
        role: 'button', tabindex: '0', onClick: tapDiscard, 'aria-label': discards[k] ? `Discard: ${cardName(discards[k])}` : 'Discard pile',
      })));
      // empty slots breathe while a card is in hand and can go there
      gridEl.classList.toggle('ready', sel !== null && gridLeft > 0);
      discardEl.classList.toggle('ready', sel !== null && freshDiscard === null);
      // once every card is placed, Deal takes the hand's spot so it's right under the board
      dealBtn.textContent = turn === p.deals.length - 1 ? 'Finish' : 'Deal';
      const mid = (hand.length - 1) / 2;
      put(handEl, hand.length
        ? hand.map((c, i) => cardEl(c, (sel === i ? 'sel ' : '') + (cue.deal ? 'dealt' : ''), {
          role: 'button', tabindex: '0', onClick: () => pick(i), 'aria-pressed': sel === i ? 'true' : 'false', 'aria-label': cardName(c),
          // a gentle fan, like cards held in a hand
          style: { '--i': i, '--rot': `${((i - mid) * 3.5).toFixed(1)}deg`, '--dy': `${(Math.abs(i - mid) ** 1.6 * 2.2).toFixed(1)}px` },
        }))
        : done ? null : dealBtn);
      put(nextEl, p.preview && !done && p.deals[turn + 1] ? [h('span', {}, 'Next deal'), ...p.deals[turn + 1].map((c) => cardEl(c, 'mini'))] : null);

      // stars and meter
      const k = starsEarned(s.total);
      meter.firstChild.style.width = `${Math.min(100, (s.total / Math.max(1, goal[2])) * 100)}%`;
      [...meter.querySelectorAll('.pk-tick')].forEach((el, j) => {
        el.classList.toggle('on', j < k);
        if (prevStars != null && j >= prevStars && j < k) { el.classList.remove('just'); void el.offsetWidth; el.classList.add('just'); }
      });
      if (prevStars != null && k > prevStars) said.textContent = `${k} star${k > 1 ? 's' : ''}!`;
      meter.setAttribute('aria-label', `${k} of 3 stars. Targets ${goal.map(money).join(', ')}`);

      // score bar
      const hands = s.lines.filter((l) => l.base).length;
      countTo(s.total);
      put(multEl, h('b', {}, `×${s.handMult}`), ` ${hands} hand${hands === 1 ? '' : 's'}`);
      if (prevMult != null && s.handMult > prevMult) { multEl.classList.remove('up'); void multEl.offsetWidth; multEl.classList.add('up'); }
      multEl.title = `Every two hands raise the multiplier`;
      put(dealsEl, h('small', {}, done ? 'Done' : `Deal ${Math.min(turn + 1, p.deals.length)}/${p.deals.length}`),
        p.deals.map((_, j) => h('i', { class: j < turn || done ? 'used' : j === turn ? 'cur' : '' })));
      total.setAttribute('aria-label', `${money(s.total)}, times ${s.handMult} for ${hands} hands, deal ${Math.min(turn + 1, p.deals.length)} of ${p.deals.length}`);

      // hand names on the table, and a flash along any line that just made a hand
      const now = {};
      for (const l of s.lines) now[lineKey(l)] = l.hand;
      const labelFor = (l, el, prefix = '') => {
        const full = l.kind === 'discard' ? discards.length === n : l.cells.every((i) => grid[i]);
        const state = l.hand ? (l.blocked ? 'blocked' : 'on') : full ? 'bust' : '';
        for (const c of ['on', 'blocked', 'bust', 'pop']) el.classList.toggle(c, c === state);
        put(el, prefix ? h('em', {}, prefix) : null, l.hand ? SHORT[l.hand] : full ? '✗' : '');
        el.title = l.hand ? LABEL[l.hand] : '';
      };
      for (const l of s.lines) {
        const el = l.kind === 'row' ? rowLab.children[l.idx] : l.kind === 'col' ? colLab.children[l.idx] : l.kind === 'corners' ? cornLab : discLab;
        labelFor(l, el, l.kind === 'corners' ? '×2' : l.kind === 'discard' ? '×3' : '');
        const was = prevHands ? prevHands[lineKey(l)] : undefined;
        if (prevHands && l.hand && l.hand !== was && !calm()) {
          el.classList.add('pop');
          const cells = l.kind === 'discard' ? [...discardEl.children] : l.cells.map((i) => gridEl.children[i]);
          cells.forEach((c, j) => { c.style.setProperty('--k', j); c.classList.add('lit'); });
          if (l.base > 0 && !l.blocked) said.textContent = `${name(l)}: ${LABEL[l.hand]}`;
        }
      }
      prevHands = now;

      const lines = s.lines.filter((l) => l.hand);
      const had = new Set([...breakdown.querySelectorAll('.pk-line')].map((el) => el.dataset.k + el.dataset.h));
      put(breakdown, lines.map((l) => h('div', { class: 'pk-line' + (l.blocked ? ' blocked' : '') + (prevStars != null && !had.has(lineKey(l) + l.hand) ? ' new' : ''), 'data-k': lineKey(l), 'data-h': l.hand },
        h('span', {}, name(l)), h('span', {}, LABEL[l.hand] + (l.blocked ? ' (needs every line)' : '')), h('b', {}, money(l.points)))));
      breakdown.hidden = !lines.length;

      gridEl.classList.toggle('solved', done);
      felt.classList.toggle('solved', done);
      if (cue.win && !calm()) { gridEl.classList.add('won'); felt.classList.add('won'); }

      // the card that just moved glides in from where it was
      if (cue.fly) { const f = cue.fly; flyFrom(f.from, f.to(), f.rot || 0); }
      prevStars = k; prevMult = s.handMult;
      cue = { deal: false, win: false, fly: null };
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
