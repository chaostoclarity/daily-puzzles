import { h, put, shake } from '../lib/ui.js';
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

    const avatar = (i, extra = '') => h('span', { class: 'st-av' + extra, style: { '--hue': HUES[i] } }, p.names[i][0]);
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
        ctx.solved('everyone seated');
      } else {
        ctx.toast('Everyone is seated, but a clue is broken');
      }
    }

    function render() {
      put(row, Array.from({ length: p.n }, (_, k) => {
        const who = at(k);
        return h('button', {
          class: 'st-seat' + (who !== undefined ? ' taken' : '') + (who !== undefined && who === sel ? ' sel' : '') + (who !== undefined && locked.has(who) ? ' locked' : ''),
          type: 'button', onClick: () => tapSeat(k),
          'aria-label': who !== undefined ? `Seat ${k + 1}: ${p.names[who]}` : `Seat ${k + 1}, empty`,
        }, who !== undefined ? [avatar(who), h('span', { class: 'st-name' }, p.names[who])] : h('span', { class: 'st-num' }, k + 1));
      }));
      const waiting = p.names.map((_, i) => i).filter((i) => seat[i] === undefined);
      put(bench, waiting.length
        ? waiting.map((i) => h('button', { class: 'st-person' + (sel === i ? ' sel' : ''), type: 'button', onClick: () => tapPerson(i) }, avatar(i), p.names[i]))
        : sel !== null && !done ? h('button', { class: 'btn small', type: 'button', onClick: toBench }, `Stand ${p.names[sel]} up`) : null);
      put(clueList, p.clues.map((c) => {
        const live = ready(c, seat);
        const ok = live && holds(c, seat, p.n);
        return h('li', { class: live ? (ok ? 'ok' : 'bad') : '' }, h('span', { class: 'st-mark', 'aria-hidden': 'true' }, live ? (ok ? '✓' : '✗') : '•'), c.text);
      }));
      const seated = Object.keys(seat).length;
      put(status, done ? 'Everyone is in the right seat.' : sel !== null ? `Seat ${p.names[sel]}: tap a seat` : `${seated} of ${p.n} seated`);
      row.classList.toggle('solved', done);
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
