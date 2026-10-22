import { h, put, shake } from '../lib/ui.js';
import { generateGroups } from '../gen/groups.js';

const LEVEL_NAMES = ['Easiest', 'Easy', 'Tricky', 'Trickiest'];

export default {
  id: 'groups',
  name: 'Groups',
  tagline: 'Sort sixteen words into four groups',
  inspired: 'Connections',
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

    const found = h('div', { class: 'grp-found' });
    const grid = h('div', { class: 'grp-grid', role: 'group', 'aria-label': 'Words' });
    const dots = h('div', { class: 'grp-mistakes', 'aria-live': 'polite' });
    const actions = h('div', { class: 'row-actions' },
      h('button', { class: 'btn', type: 'button', onClick: () => { order = shuffle(order); render(); } }, 'Shuffle'),
      h('button', { class: 'btn', type: 'button', onClick: () => { pick = []; render(); } }, 'Deselect'),
      h('button', { class: 'btn primary', type: 'button', onClick: submit }, 'Submit'));
    root.append(found, grid, dots, actions);

    function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

    function submit() {
      if (over || pick.length !== 4) { if (pick.length !== 4) ctx.toast('Select four words'); return; }
      const key = pick.slice().sort().join('|');
      if (tried.includes(key)) { ctx.toast('Already tried that one'); return; }
      tried.push(key);
      const levels = pick.map((w) => groupOf[w]);
      const lvl = levels[0];
      if (levels.every((l) => l === lvl)) {
        solved.push(lvl);
        pick = [];
        if (solved.length === 4) { over = 'won'; render(); ctx.solved(mistakes ? `${mistakes} mistake${mistakes > 1 ? 's' : ''}` : 'perfect'); return; }
        return render();
      }
      mistakes++;
      const counts = {};
      for (const l of levels) counts[l] = (counts[l] || 0) + 1;
      const oneAway = Object.values(counts).includes(3);
      [...grid.querySelectorAll('.grp-word.on')].forEach((el) => shake(el));
      if (mistakes >= 4) {
        over = 'lost';
        for (const g of p.groups) if (!solved.includes(g.level)) solved.push(g.level);
        pick = [];
        render();
        ctx.finished?.();
        return;
      }
      ctx.toast(oneAway ? 'One away' : 'Not a group');
      render();
    }

    function render() {
      put(found, solved.map((lvl) => {
        const g = p.groups.find((x) => x.level === lvl);
        return h('div', { class: `grp-bar lv${lvl}` }, h('b', {}, g.title), h('span', {}, g.words.join(', ').toUpperCase()));
      }));
      const doneWords = new Set(solved.flatMap((l) => p.groups.find((x) => x.level === l).words));
      order = order.filter((w) => !doneWords.has(w));
      put(grid, order.map((w) => h('button', {
        class: 'grp-word' + (pick.includes(w) ? ' on' : '') + (w.length > 8 ? ' long' : ''), type: 'button', 'aria-pressed': pick.includes(w) ? 'true' : 'false',
        onClick: () => {
          if (over) return;
          if (pick.includes(w)) pick = pick.filter((x) => x !== w);
          else if (pick.length < 4) pick.push(w);
          render();
        },
      }, tagged[w] !== undefined ? h('i', { class: `grp-tag lv${tagged[w]}`, 'aria-hidden': 'true' }) : null, w.toUpperCase())));
      grid.hidden = !order.length;
      actions.hidden = !!over;
      put(dots, over === 'lost' ? h('span', {}, 'Out of mistakes. Here are the groups.')
        : over === 'won' ? h('span', {}, 'All four groups found.')
          : [h('span', {}, 'Mistakes left'), ...Array.from({ length: 4 }, (_, i) => h('i', { class: i < 4 - mistakes ? 'on' : '' }))]);
      ctx.save({ order, solved, mistakes, tried, tagged, over });
    }
    render();
    return {
      hint() {
        if (over) return false;
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
        for (const g of p.groups) if (!solved.includes(g.level)) solved.push(g.level);
        over = 'lost'; pick = []; render(); ctx.save({ order, solved, mistakes, tried, tagged, over, revealed: true });
      },
    };
  },
};
