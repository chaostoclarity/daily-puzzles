import { h, put, keyboard, shake } from '../lib/ui.js';
import { generateGuess, validGuess, score, strictError } from '../gen/guess.js';
import { clueFor } from '../lib/words.js';

const MARK = ['miss', 'near', 'hit'];

export default {
  id: 'guess',
  version: 2, // bump when the generator changes, so old saves don't load onto a new board
  name: 'Werdle',
  tagline: 'Find the hidden word in six tries',
  generate: generateGuess,
  rules: [
    'Guess the hidden word. Each guess must be a real word.',
    'Green means the letter is in the right spot. Gold means it is in the word but somewhere else. Gray means it is not in the word.',
    'Easy uses four-letter words. Medium and Hard use five.',
    'Hard is stricter: every hint you uncover must be used in your next guesses.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const { len, tries, answer } = p;
    const saved = ctx.load();
    const history = saved?.history || []; // { word, marks }
    let cur = '';
    let over = saved?.over || null; // 'won' | 'lost'

    const rowsEl = [];
    const gridEl = h('div', { class: 'guess-grid', style: { '--len': len }, 'aria-label': 'Guesses' });
    for (let r = 0; r < tries; r++) {
      const row = h('div', { class: 'guess-row' }, Array.from({ length: len }, () => h('span', { class: 'tile' })));
      rowsEl.push(row); gridEl.append(row);
    }
    const result = h('div', { class: 'result-box', hidden: true });
    const revealedPos = saved?.revealedPos || []; // positions given away by hints
    const hintRow = h('div', { class: 'guess-hints', style: { '--len': len }, 'aria-label': 'Hint letters' });
    const kb = keyboard(onKey);
    root.append(h('div', { class: 'board guess-board', style: { '--len': len } }, hintRow, gridEl), result, kb.el);

    function render(revealRow = -1) {
      for (let r = 0; r < tries; r++) {
        const tiles = rowsEl[r].children;
        const g = history[r];
        for (let i = 0; i < len; i++) {
          const t = tiles[i];
          t.className = 'tile';
          if (g) {
            t.textContent = g.word[i].toUpperCase();
            t.classList.add(MARK[g.marks[i]], 'filled');
            if (r === revealRow) { t.classList.add('flip'); t.style.animationDelay = `${i * 90}ms`; } else t.style.animationDelay = '';
          } else if (r === history.length && !over) {
            t.textContent = (cur[i] || '').toUpperCase();
            if (cur[i]) t.classList.add('filled');
          } else t.textContent = '';
        }
      }
      const states = {};
      for (const g of history) [...g.word].forEach((ch, i) => {
        const m = MARK[g.marks[i]];
        if (states[ch] === 'hit') return;
        if (m === 'hit' || (m === 'near' && states[ch] !== 'hit') || !states[ch]) states[ch] = m;
      });
      for (const i of revealedPos) states[answer[i]] = 'hit';
      kb.setStates(states);
      hintRow.hidden = !revealedPos.length;
      put(hintRow, Array.from({ length: len }, (_, i) => h('span', { class: revealedPos.includes(i) ? 'on' : '' }, revealedPos.includes(i) ? answer[i].toUpperCase() : '')));
      if (over) {
        result.hidden = false;
        const def = clueFor(answer);
        put(result, 
          h('div', { class: 'result-word' }, answer.toUpperCase()),
          def ? h('p', { class: 'result-def' }, def) : null,
          h('p', { class: 'result-note' }, over === 'won' ? `Solved in ${history.length} of ${tries}.` : 'Out of guesses. That was the word.'));
      } else result.hidden = true;
      ctx.save({ history, over, revealedPos });
    }

    function onKey(k) {
      if (over) return;
      if (k === 'back') cur = cur.slice(0, -1);
      else if (k === 'enter') {
        const row = rowsEl[history.length];
        if (cur.length < len) { shake(row); ctx.toast('Not enough letters'); return; }
        if (!validGuess(cur)) { shake(row); ctx.toast('Not in the word list'); return; }
        if (p.strict) { const err = strictError(cur, history); if (err) { shake(row); ctx.toast(err); return; } }
        history.push({ word: cur, marks: score(cur, answer) });
        const won = cur === answer;
        cur = '';
        if (won) over = 'won';
        else if (history.length >= tries) over = 'lost';
        render(history.length - 1);
        if (won) ctx.solved();
        if (over === 'lost') ctx.finished?.();
        return;
      } else if (k.length === 1 && cur.length < len) cur += k;
      else return;
      render();
    }

    render();
    return {
      onKey,
      hint() {
        if (over) return false;
        const known = new Set(revealedPos);
        for (const g of history) g.marks.forEach((m, i) => { if (m === 2) known.add(i); });
        const i = [...Array(len).keys()].find((x) => !known.has(x));
        if (i === undefined) { ctx.toast('You already have every letter in place'); return false; }
        revealedPos.push(i);
        render();
        return `Letter ${i + 1} is ${answer[i].toUpperCase()}`;
      },
      reveal() { if (!over) { over = 'lost'; render(); ctx.save({ history, over, revealed: true }); } },
    };
  },
};
