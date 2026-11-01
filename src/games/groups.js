import './groups.css';
import { h, put, shake } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateGroups } from '../gen/groups.js';

const LEVEL_NAMES = ['Easiest', 'Easy', 'Tricky', 'Trickiest'];

export default {
  id: 'groups',
  version: 2, // bump when the generator changes, so old saves don't load onto a new board
  name: 'Cannections',
  tagline: 'Sort sixteen words into four groups',
  generate: generateGroups,
  rules: [
    'Find four groups of four words that share something.',
    'Select four words and tap Submit. You can make four mistakes.',
    'Groups range from kinds of things (types of fish) to words that join a common word (FIRE ___).',
    'Each word belongs to exactly one group. Colors run from easiest to trickiest.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const saved = ctx.load();
    let order = saved?.order || p.words.slice();
    const solved = saved?.solved || []; // group levels in the order found
    let mistakes = saved?.mistakes || 0;
    const tried = saved?.tried || [];   // sorted guesses already made
    const tagged = saved?.tagged || {}; // word -> level, from hints
    let over = saved?.over || null;     // 'won' | 'lost'
    let pick = [];
    const groupOf = {};
    p.groups.forEach((g) => g.words.forEach((w) => (groupOf[w] = g.level)));

    // The words are cards: built once, kept, and moved around so every change can animate.
    const found = h('div', { class: 'grp-found' });
    const grid = h('div', { class: 'grp-grid', role: 'group', 'aria-label': 'Words' });
    const board = h('div', { class: 'board grp-board' }, found, grid);
    const dots = h('div', { class: 'grp-mistakes', 'aria-live': 'polite' });
    // buttons drop focus after a tap so the next tap or key isn't swallowed by them
    const tap = (fn) => (e) => { e.currentTarget.blur(); fn(); };
    const actions = h('div', { class: 'row-actions' },
      h('button', { class: 'btn', type: 'button', onClick: tap(() => { if (busy) return; order = shuffle(order); flip(layout, true); render(); }) }, 'Shuffle'),
      h('button', { class: 'btn', type: 'button', onClick: tap(() => { if (busy) return; pick = []; render(); }) }, 'Deselect'),
      h('button', { class: 'btn primary', type: 'button', onClick: tap(submit) }, 'Submit'));
    root.append(board, dots, actions);

    function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

    const cards = new Map(); // word -> button
    function card(w) {
      if (!cards.has(w)) {
        cards.set(w, h('button', {
          class: 'grp-word' + (w.length > 8 ? ' long' : ''), type: 'button', 'data-w': w,
          onClick: () => {
            if (over || busy) return;
            if (pick.includes(w)) pick = pick.filter((x) => x !== w);
            else if (pick.length < 4) pick.push(w);
            else { nudge(cards.get(w)); return; }
            render();
          },
        }, h('span', { class: 'grp-label' }, w.toUpperCase())));
      }
      return cards.get(w);
    }

    // ----- motion helpers -----
    let busy = false, finish = null;
    const running = new Set();
    const anim = (el, frames, opts) => { const a = el.animate(frames, opts); running.add(a); a.finished.catch(() => {}).then(() => running.delete(a)); return a; };
    // run fn after ms, holding input until then; flush() jumps every pending step to its end
    const after = (ms, fn) => {
      busy = true;
      const run = () => { clearTimeout(t); finish = null; busy = false; fn(); };
      const t = setTimeout(run, ms);
      finish = () => { running.forEach((a) => a.cancel()); run(); };
    };
    const flush = () => { let n = 0; while (finish && n++ < 5) finish(); };
    const nudge = (el) => { if (!calm() && el.animate) anim(el, [{ transform: 'none' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(2deg)' }, { transform: 'none' }], { duration: 260, easing: 'ease-out' }); };
    // FLIP: cards glide from where they were to wherever the change puts them
    function flip(change, deal = false) {
      const before = new Map([...cards].filter(([, el]) => el.isConnected).map(([w, el]) => [w, el.getBoundingClientRect()]));
      change();
      if (calm()) return;
      [...grid.children].forEach((el, i) => {
        const a = before.get(el.dataset.w);
        if (!a) return;
        const b = el.getBoundingClientRect();
        const dx = a.left - b.left, dy = a.top - b.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        const tilt = deal ? (Math.random() - 0.5) * 14 : 0;
        anim(el, [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.45}px) rotate(${tilt}deg) scale(${deal ? 0.92 : 1})`, offset: 0.45 },
          { transform: 'none' },
        ], { duration: deal ? 460 : 380, delay: deal ? i * 14 : 0, easing: 'cubic-bezier(0.3, 0.9, 0.35, 1.08)', fill: 'backwards' });
      });
    }

    // the four picked cards hop one after another, the way a guess is "read out"
    function hop(els) {
      els.forEach((el, i) => anim(el, [
        { transform: 'translateY(-3px)' }, { transform: 'translateY(-13px) scale(1.04)', offset: 0.4 }, { transform: 'translateY(-3px)' },
      ], { duration: 260, delay: i * 70, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' }));
      return 260 + (els.length - 1) * 70 + 40;
    }

    const save = () => ctx.save({ order, solved, mistakes, tried, tagged, over });
    const inGridOrder = (ws) => ws.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));

    function submit() {
      if (busy) return;
      if (over || pick.length !== 4) { if (pick.length !== 4) { ctx.toast('Select four words'); grid.querySelectorAll('.grp-word.on').forEach(nudge); } return; }
      const key = pick.slice().sort().join('|');
      if (tried.includes(key)) { ctx.toast('Already tried that one'); grid.querySelectorAll('.grp-word.on').forEach(nudge); return; }
      tried.push(key);
      const levels = pick.map((w) => groupOf[w]);
      const lvl = levels[0];
      const els = inGridOrder(pick).map(card);
      if (levels.every((l) => l === lvl)) {
        const group = pick.slice();
        solved.push(lvl);
        pick = [];
        const won = solved.length === 4;
        if (won) over = 'won';
        save();
        if (won) ctx.solved(mistakes ? `${mistakes} mistake${mistakes > 1 ? 's' : ''}` : 'perfect', { value: mistakes, higher: false, fmt: (v) => (v ? `${v} mistake${v > 1 ? 's' : ''}` : 'perfect') });
        if (calm()) return render();
        // read out, then the group's cards swap into the top row, take on its color, and fold into a bar
        after(won ? 0 : hop(els), () => {
          gather(group, lvl);
          after(470, () => { justSolved = lvl; render(); if (won) found.classList.add('win'); });
        });
        return;
      }
      mistakes++;
      const counts = {};
      for (const l of levels) counts[l] = (counts[l] || 0) + 1;
      const oneAway = Object.values(counts).includes(3);
      const lost = mistakes >= 4;
      if (lost) {
        over = 'lost';
        for (const g of p.groups) if (!solved.includes(g.level)) solved.push(g.level);
        pick = [];
        save();
        ctx.finished?.();
      }
      const show = () => {
        els.forEach((el) => { shake(el); el.classList.add('nope'); setTimeout(() => el.classList.remove('nope'), 420); });
        if (!lost) ctx.toast(oneAway ? 'One away' : 'Not a group');
        render();
      };
      if (calm()) return show();
      after(hop(els), show);
    }

    // move the group's cards into the first open row (swapping with what was there), then color them
    function gather(group, lvl) {
      const live = order.filter((w) => cards.get(w)?.isConnected);
      const top = live.slice(0, 4);
      const out = top.filter((w) => !group.includes(w));
      const inn = inGridOrder(group).filter((w) => !top.includes(w));
      const next = order.slice();
      out.forEach((w, i) => { const a = next.indexOf(w), b = next.indexOf(inn[i]); [next[a], next[b]] = [next[b], next[a]]; });
      order = next;
      flip(() => { layout(group); group.forEach((w) => { const el = card(w); el.classList.remove('on'); el.classList.add('merge', `lv${lvl}`); }); });
    }

    let justSolved = null, shownMistakes = mistakes, shownTags = new Set(Object.keys(tagged));
    function layout(keep = []) {
      const dw = doneWords();
      const want = order.filter((w) => !dw.has(w) || keep.includes(w)).map(card);
      const have = [...grid.children];
      if (want.length !== have.length || want.some((el, i) => el !== have[i])) grid.append(...want);
      have.forEach((el) => { if (!want.includes(el)) el.remove(); });
    }
    const doneWords = () => new Set(solved.flatMap((l) => p.groups.find((x) => x.level === l).words));

    function render() {
      // remaining cards close ranks under any new bar
      flip(() => {
        // bars: only new ones are added, so each animates in once
        const fresh = solved.slice(found.children.length);
        fresh.forEach((lvl, i) => {
          const g = p.groups.find((x) => x.level === lvl);
          const bar = h('div', { class: `grp-bar lv${lvl}` + (lvl === justSolved ? ' snap' : first ? '' : ' drop'), style: { '--i': i } },
            h('b', {}, g.title), h('span', {}, g.words.join(', ').toUpperCase()));
          found.append(bar);
        });
        justSolved = null;
        const dw = doneWords();
        order = order.filter((w) => !dw.has(w));
        layout();
      });
      for (const w of order) {
        const el = card(w);
        const on = pick.includes(w);
        el.classList.toggle('on', on);
        el.classList.remove('merge', 'lv0', 'lv1', 'lv2', 'lv3');
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
        el.disabled = !!over;
        const tag = el.querySelector('.grp-tag');
        if (tagged[w] !== undefined && !tag) el.prepend(h('i', { class: `grp-tag lv${tagged[w]}` + (shownTags.has(w) ? '' : ' new'), 'aria-hidden': 'true' }));
      }
      shownTags = new Set(Object.keys(tagged));
      grid.hidden = !order.length;
      actions.hidden = !!over;
      const lostOne = mistakes > shownMistakes;
      put(dots, over === 'lost' ? h('span', {}, 'Out of mistakes. Here are the groups.')
        : over === 'won' ? h('span', {}, 'All four groups found.')
          : [h('span', {}, 'Mistakes left'), ...Array.from({ length: 4 }, (_, i) => h('i', { class: (i < 4 - mistakes ? 'on' : '') + (lostOne && i === 4 - mistakes ? ' gone' : '') }))]);
      shownMistakes = mistakes;
      save();
    }
    let first = true;
    render();
    first = false;
    return {
      hint() {
        if (over) return false;
        flush();
        // tag one more word from the open group that has the most hints so far
        const open = p.groups.filter((g) => !solved.includes(g.level));
        open.sort((a, b) => b.words.filter((w) => tagged[w] !== undefined).length - a.words.filter((w) => tagged[w] !== undefined).length || a.level - b.level);
        for (const g of open) {
          const w = g.words.find((x) => tagged[x] === undefined);
          if (w) { tagged[w] = g.level; render(); return `${w.toUpperCase()} is in the ${LEVEL_NAMES[g.level].toLowerCase()} group (marked by color)`; }
        }
        return false;
      },
      reveal() {
        flush();
        for (const g of p.groups) if (!solved.includes(g.level)) solved.push(g.level);
        over = 'lost'; pick = []; render(); ctx.save({ order, solved, mistakes, tried, tagged, over, revealed: true });
      },
      destroy() { flush(); },
    };
  },
};
