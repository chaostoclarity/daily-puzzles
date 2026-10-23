import { h, put, keyboard, shake } from '../lib/ui.js';
import { generateLadder, oneApart } from '../gen/ladder.js';

export default {
  id: 'ladder',
  version: 2, // bump when the generator changes, so old saves don't load onto a new board
  name: 'Crissclimb',
  tagline: 'Climb a chain of one-letter changes',
  generate: generateLadder,
  rules: [
    'Each rung is a word that differs from the rung next to it by exactly one letter.',
    'Tap a rung to see its clue, then type the answer.',
    'When the rungs are out of order, use the arrows to move them until each step changes one letter.',
    'Solve every middle rung in order to unlock the top and bottom words. Together they make a compound word, like FIRE + WORK.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const { len } = p;
    const saved = ctx.load();
    const mids = p.middle;
    let order = saved?.order || mids.map((_, i) => i); // display order of middle rungs
    const entry = saved?.entry || {}; // key -> string
    let active = saved?.active ?? 'm' + order[0];
    let done = !!saved?.done;

    const keyFor = (k) => (k === 'top' || k === 'bottom' ? k : 'm' + k);
    const midSolved = (i) => (entry['m' + i] || '') === mids[i].word;
    const allMidSolved = () => mids.every((_, i) => midSolved(i));
    const ordered = () => order.every((idx, j) => j === 0 || oneApart(mids[order[j - 1]].word, mids[idx].word));
    const unlocked = () => allMidSolved() && ordered();
    // if the player built the chain upside down, the ends swap places
    const reversed = () => mids[order[0]].order !== 0;
    const endWord = (k) => ((k === 'top') !== reversed() ? p.top : p.bottom);

    const clueBox = h('div', { class: 'clue-bar', 'aria-live': 'polite' });
    const list = h('div', { class: 'ladder', role: 'list', style: { '--rungs': mids.length + 2 } });
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    const kb = keyboard(onKey);
    root.append(clueBox, list, status, kb.el);

    function rowEl(key, word, opts = {}) {
      const val = entry[key] || '';
      const solved = val === word;
      const row = h('div', {
        class: 'rung' + (key === active ? ' active' : '') + (solved ? ' solved' : '') + (opts.locked ? ' locked' : '') + (opts.end ? ' end' : ''),
        role: 'listitem', 'data-key': key,
        onClick: () => { if (!opts.locked && !done) { active = key; render(); } },
      },
      h('div', { class: 'rung-letters', 'aria-label': opts.locked ? 'Locked' : val || 'Empty' },
        Array.from({ length: len }, (_, i) => h('span', { class: 'tile' + (val[i] ? ' filled' : '') }, opts.locked ? '' : (val[i] || '').toUpperCase()))),
      opts.move ? h('div', { class: 'rung-move' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move up', disabled: opts.first || done, onClick: (e) => { e.stopPropagation(); move(opts.pos, -1); } }, '▲'),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move down', disabled: opts.last || done, onClick: (e) => { e.stopPropagation(); move(opts.pos, 1); } }, '▼')) : null);
      return row;
    }

    function move(pos, d) {
      const j = pos + d;
      if (j < 0 || j >= order.length) return;
      [order[pos], order[j]] = [order[j], order[pos]];
      render();
    }

    function clueText() {
      if (active === 'top' || active === 'bottom') {
        return h('div', {}, h('span', { class: 'clue-tag' }, 'Top + bottom'), `${p.compoundClue || endWord(active).clue} (two ${len}-letter words that join into one)`);
      }
      const i = +active.slice(1);
      return h('div', {}, h('span', { class: 'clue-tag' }, `${len} letters`), mids[i].clue);
    }

    function render() {
      // once the rungs are solved, flip a ladder built upside down so the ends read top to bottom
      if (allMidSolved() && ordered() && reversed()) order.reverse();
      const open = unlocked();
      const rows = [rowEl('top', endWord('top').word, { locked: !open, end: true })];
      order.forEach((idx, pos) => rows.push(rowEl('m' + idx, mids[idx].word, { move: p.scramble, pos, first: pos === 0, last: pos === order.length - 1 })));
      rows.push(rowEl('bottom', endWord('bottom').word, { locked: !open, end: true }));
      put(list, ...rows);
      put(clueBox, clueText());
      if (!done) {
        if (!allMidSolved()) status.textContent = `${mids.filter((_, i) => midSolved(i)).length} of ${mids.length} rungs solved`;
        else if (!ordered()) status.textContent = 'All rungs solved. Now order them so each step changes one letter.';
        else status.textContent = 'Ladder in order. Solve the top and bottom.';
      }
      if (!done && open && entry.top === endWord('top').word && entry.bottom === endWord('bottom').word) {
        done = true;
        list.classList.add('solved');
        status.textContent = 'Top to bottom, one letter at a time.';
        ctx.solved();
      }
      ctx.save({ order, entry, active, done });
    }

    function nextOpen() {
      const keys = order.map((i) => 'm' + i);
      if (unlocked()) keys.unshift('top'), keys.push('bottom');
      const target = (k) => (k === 'top' || k === 'bottom' ? endWord(k).word : mids[+k.slice(1)].word);
      const start = keys.indexOf(active);
      for (let s2 = 1; s2 <= keys.length; s2++) {
        const k = keys[(start + s2) % keys.length];
        if ((entry[k] || '') !== target(k)) return k;
      }
      return active;
    }

    function onKey(k) {
      if (done) return;
      const target = active === 'top' || active === 'bottom' ? endWord(active).word : mids[+active.slice(1)].word;
      let v = entry[active] || '';
      if (k === 'back') v = v.slice(0, -1);
      else if (k === 'up' || k === 'down') {
        const keys = (unlocked() ? ['top'] : []).concat(order.map((i) => 'm' + i), unlocked() ? ['bottom'] : []);
        const j = keys.indexOf(active) + (k === 'up' ? -1 : 1);
        if (j >= 0 && j < keys.length) active = keys[j];
        return render();
      } else if (k === 'enter') {
        if (v.length === len && v !== target) { const el = list.querySelector(`[data-key="${active}"]`); if (el) shake(el); }
        return;
      } else if (k.length === 1) {
        if (v === target) return;
        if (v.length >= len) v = '';
        v += k;
      } else return;
      entry[active] = v;
      if (v.length === len) {
        if (v === target) { render(); active = nextOpen(); }
        else { render(); const el = list.querySelector(`[data-key="${active}"]`); if (el) shake(el); ctx.toast('Not quite'); return; }
      }
      render();
    }

    render();
    if (done) list.classList.add('solved');
    function hint() {
      if (done) return false;
      const target = (k) => (k === 'top' || k === 'bottom' ? endWord(k).word : mids[+k.slice(1)].word);
      const unsolvedMid = order.map((i) => 'm' + i).filter((k) => (entry[k] || '') !== target(k));
      // all rungs solved but out of order: move one rung into its place
      if (!unsolvedMid.length && !ordered()) {
        for (let j = 0; j < order.length; j++) {
          if (mids[order[j]].order !== j) {
            const from = order.findIndex((i) => mids[i].order === j);
            const [x] = order.splice(from, 1);
            order.splice(j, 0, x);
            break;
          }
        }
        render();
        return 'Moved one rung into place';
      }
      let key = active;
      const locked = (k) => (k === 'top' || k === 'bottom') && !unlocked();
      if (locked(key) || (entry[key] || '') === target(key)) {
        key = unsolvedMid[0] || ['top', 'bottom'].find((k) => (entry[k] || '') !== target(k));
      }
      const t = target(key);
      const v = entry[key] || '';
      let pos = 0;
      while (pos < v.length && v[pos] === t[pos]) pos++;
      entry[key] = t.slice(0, pos + 1);
      active = key;
      if (entry[key] === t) { render(); active = nextOpen(); }
      render();
      return `Filled letter ${pos + 1}`;
    }

    return {
      onKey,
      hint,
      reveal() {
        order = mids.map((_, i) => i).sort((a, b) => mids[a].order - mids[b].order);
        mids.forEach((m, i) => (entry['m' + i] = m.word));
        entry.top = p.top.word; entry.bottom = p.bottom.word;
        done = true; list.classList.add('solved'); render(); status.textContent = 'Solution shown.';
        ctx.save({ order, entry, active, done, revealed: true });
      },
    };
  },
};
