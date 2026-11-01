import './seats.css';
import { h, put, shake } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateSeats, holds, ready } from '../gen/seats.js';

const HUES = [8, 210, 140, 45, 280, 180, 330, 95];

export default {
  id: 'seats',
  name: "Where's My Seet",
  tagline: 'Seat everyone so every clue is true',
  version: 1,
  generate: generateSeats,
  rules: [
    'Everyone sits in one row, numbered from the left.',
    'Tap a person, then tap a seat. Tap someone already seated to move them or send them back.',
    'Each clue turns green when it holds and red when it is broken.',
    'Only one seating fits every clue. Find it.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const saved = ctx.load();
    const seat = saved?.seat || {}; // person -> seat index
    const locked = new Set(saved?.locked || []);
    let done = !!saved?.done;
    let sel = null; // selected person

    const avatar = (i, extra = '') => h('span', { class: 'st-av' + extra, 'data-p': i, style: { '--hue': HUES[i] } }, p.names[i][0]);
    const row = h('div', { class: 'st-row', style: { '--n': p.n } });
    const bench = h('div', { class: 'st-bench', 'aria-label': 'People to seat' });
    const clueList = h('ol', { class: 'st-clues' });
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    root.append(h('div', { class: 'board st-board' }, row), bench, status, clueList);

    const at = (k) => Object.keys(seat).map(Number).find((q) => seat[q] === k);

    function tapPerson(q) {
      if (done || locked.has(q)) return;
      sel = sel === q ? null : q;
      render();
    }
    function tapSeat(k) {
      if (done) return;
      const who = at(k);
      if (sel === null) { if (who !== undefined && !locked.has(who)) { sel = who; render(); } return; }
      if (who !== undefined && locked.has(who)) { shake(row.children[k]); return; }
      const from = seat[sel];
      if (who !== undefined) { if (from !== undefined) seat[who] = from; else delete seat[who]; }
      seat[sel] = k;
      sel = null;
      check();
      render();
    }
    function toBench() {
      if (sel === null || seat[sel] === undefined || locked.has(sel)) return;
      delete seat[sel]; sel = null; render();
    }

    function check() {
      if (Object.keys(seat).length < p.n) return;
      if (p.clues.every((c) => holds(c, seat, p.n))) {
        done = true;
        win = !calm();
        ctx.solved('everyone seated');
      } else {
        ctx.toast('Everyone is seated, but a clue is broken');
      }
    }

    // Motion: before each redraw, note where every person is; afterwards, slide each one from
    // there to their new place (bench to seat, seat to seat, back to the bench).
    const spots = () => new Map([...root.querySelectorAll('[data-p]')].map((el) => [el.dataset.p + (el.classList.contains('st-av') ? 'a' : 'c'), el.getBoundingClientRect()]));
    function slide(before) {
      if (calm() || !before.size) return;
      for (const el of root.querySelectorAll('[data-p]')) {
        const key = el.dataset.p + (el.classList.contains('st-av') ? 'a' : 'c');
        const a = before.get(key), b = el.getBoundingClientRect();
        if (!a || !b.width || !el.animate) continue;
        // an avatar riding in a bench chip moves with its chip
        if (el.classList.contains('st-av') && el.closest('.st-person') && before.has(el.dataset.p + 'c')) continue;
        const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        const sc = a.width / b.width;
        const avatarMove = el.classList.contains('st-av');
        el.animate([
          { transform: `translate(${dx}px, ${dy}px) scale(${avatarMove ? sc : 1})` },
          ...(avatarMove ? [{ transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 18}px) scale(${(sc + 1) / 2 * 1.1})`, offset: 0.5 }] : []),
          { transform: 'none' },
        ], { duration: avatarMove ? 420 : 300, easing: 'cubic-bezier(0.3, 0.9, 0.35, 1.1)' });
        // the name card under a newly seated person fades in as they land
        const name = avatarMove && el.closest('.st-seat')?.querySelector('.st-name');
        if (name) name.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 0, offset: 0.55 }, { opacity: 1, transform: 'none' }], { duration: 480, easing: 'ease-out' });
      }
    }
    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    let prevClues = null, win = false;

    function render() {
      const before = spots();
      put(row, Array.from({ length: p.n }, (_, k) => {
        const who = at(k);
        return h('button', {
          class: 'st-seat' + (who !== undefined ? ' taken' : '') + (who !== undefined && who === sel ? ' sel' : '') + (who !== undefined && locked.has(who) ? ' locked' : ''),
          type: 'button', style: { '--k': k }, onClick: (e) => { e.currentTarget.blur(); tapSeat(k); },
          'aria-label': who !== undefined ? `Seat ${k + 1}: ${p.names[who]}` : `Seat ${k + 1}, empty`,
        }, who !== undefined ? [avatar(who), h('span', { class: 'st-name' }, p.names[who])] : h('span', { class: 'st-num' }, k + 1));
      }));
      const waiting = p.names.map((_, i) => i).filter((i) => seat[i] === undefined);
      put(bench, waiting.length
        ? waiting.map((i) => h('button', { class: 'st-person' + (sel === i ? ' sel' : ''), type: 'button', 'data-p': i, 'aria-pressed': sel === i ? 'true' : 'false', onClick: (e) => { e.currentTarget.blur(); tapPerson(i); } }, avatar(i), p.names[i]))
        : sel !== null && !done ? h('button', { class: 'btn small', type: 'button', onClick: toBench }, `Stand ${p.names[sel]} up`) : null);
      const states = p.clues.map((c) => {
        const live = ready(c, seat);
        return live ? (holds(c, seat, p.n) ? 'ok' : 'bad') : '';
      });
      put(clueList, p.clues.map((c, i) => {
        const st = states[i];
        // a clue that just came true checks itself off; one that just broke shakes
        const just = prevClues && prevClues[i] !== st && st ? ` just-${st}` : '';
        return h('li', { class: st + just, style: { '--k': i } }, h('span', { class: 'st-mark', 'aria-hidden': 'true' }, st === 'ok' ? '✓' : st === 'bad' ? '✗' : ''), c.text);
      }));
      prevClues = states;
      row.classList.toggle('armed', sel !== null && !done);
      const seated = Object.keys(seat).length;
      put(status, done ? 'Everyone is in the right seat.' : sel !== null ? `Seat ${p.names[sel]}: tap a seat` : `${seated} of ${p.n} seated`);
      row.classList.toggle('solved', done);
      slide(before);
      // the win: a stadium wave runs down the row, and the clues tick off in turn
      if (win) { win = false; replay(row, 'win'); replay(clueList, 'win'); setTimeout(() => { row.classList.remove('win'); clueList.classList.remove('win'); }, 2200); }
      ctx.save({ seat, locked: [...locked], done });
    }
    render();

    return {
      hint() {
        if (done) return false;
        // seat one person correctly and lock them in
        const order = p.names.map((_, i) => i).filter((i) => seat[i] !== p.seat[i]);
        const q = order[0];
        if (q === undefined) return false;
        const other = at(p.seat[q]);
        if (other !== undefined) delete seat[other];
        seat[q] = p.seat[q];
        locked.add(q); sel = null;
        check();
        render();
        return `${p.names[q]} belongs in seat ${p.seat[q] + 1}`;
      },
      reveal() {
        p.names.forEach((_, i) => { seat[i] = p.seat[i]; locked.add(i); });
        done = true; sel = null; render();
      },
    };
  },
};
