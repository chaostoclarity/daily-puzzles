import './guess.css';
import { h, put, keyboard } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateGuess, validGuess, score, strictError } from '../gen/guess.js';
import { clueFor } from '../lib/words.js';

const MARK = ['miss', 'near', 'hit'];
// a guess turns over one tile at a time; the keyboard and the win wave wait for the last tile
const STAGGER = 110, FLIP = 480;

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
      // each tile is two-sided: the letter as typed on the front, its color on the back
      const row = h('div', { class: 'guess-row' }, Array.from({ length: len }, (_, i) => h('span', { class: 'tile', style: { '--i': i } })));
      rowsEl.push(row); gridEl.append(row);
    }
    const result = h('div', { class: 'result-box', hidden: true });
    const revealedPos = saved?.revealedPos || []; // positions given away by hints
    const hintRow = h('div', { class: 'guess-hints', style: { '--len': len }, 'aria-label': 'Hint letters' });
    const said = h('p', { class: 'sr-only', 'aria-live': 'polite' });
    const kb = keyboard(onKey);
    root.append(h('div', { class: 'board guess-board', style: { '--len': len, '--tries': tries } }, hintRow, gridEl), result, said, kb.el);

    let flipRow = -1, flipTimer = 0, kbTimer = 0;
    let popAt = -1, hintAt = -1;
    const flipMs = () => (calm() ? 0 : (len - 1) * STAGGER + FLIP);
    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

    function keyStates() {
      const states = {};
      for (const g of history) [...g.word].forEach((ch, i) => {
        const m = MARK[g.marks[i]];
        if (states[ch] === 'hit') return;
        if (m === 'hit' || (m === 'near' && states[ch] !== 'hit') || !states[ch]) states[ch] = m;
      });
      for (const i of revealedPos) states[answer[i]] = 'hit';
      return states;
    }

    function render(revealRow = -1) {
      if (revealRow >= 0) {
        flipRow = revealRow;
        clearTimeout(flipTimer);
        flipTimer = setTimeout(() => { flipRow = -1; }, flipMs() + 50);
      }
      for (let r = 0; r < tries; r++) {
        const tiles = rowsEl[r].children;
        const g = history[r];
        rowsEl[r].classList.toggle('now', r === history.length && !over);
        for (let i = 0; i < len; i++) {
          const t = tiles[i];
          let cls = 'tile';
          if (g) {
            t.textContent = g.word[i].toUpperCase();
            cls += ` ${MARK[g.marks[i]]} filled`;
            if (r === flipRow) cls += ' flip';
          } else if (r === history.length && !over) {
            t.textContent = (cur[i] || '').toUpperCase();
            if (cur[i]) cls += ' filled' + (i === popAt ? ' pop' : '');
          } else t.textContent = '';
          if (t.className !== cls) t.className = cls;
        }
      }
      popAt = -1;
      // the keyboard learns the colors only once the tiles have turned over
      clearTimeout(kbTimer);
      const states = keyStates();
      if (revealRow >= 0 && flipMs()) kbTimer = setTimeout(() => kb.setStates(states), flipMs() - 80);
      else kb.setStates(states);
      hintRow.hidden = !revealedPos.length;
      put(hintRow, Array.from({ length: len }, (_, i) => h('span', { class: (revealedPos.includes(i) ? 'on' : '') + (i === hintAt ? ' new' : '') }, revealedPos.includes(i) ? answer[i].toUpperCase() : '')));
      hintAt = -1;
      if (over) {
        const def = clueFor(answer);
        put(result,
          h('div', { class: 'result-word' }, [...answer.toUpperCase()].map((ch, i) => h('span', { style: { '--i': i } }, ch))),
          def ? h('p', { class: 'result-def' }, def) : null,
          h('p', { class: 'result-note' }, over === 'won' ? `Solved in ${history.length} of ${tries}.` : 'Out of guesses. That was the word.'));
        // after a fresh guess the answer card waits for the tiles to turn
        result.style.setProperty('--wait', `${revealRow >= 0 ? flipMs() : 0}ms`);
        result.hidden = false;
      } else result.hidden = true;
      ctx.save({ history, over, revealedPos });
    }

    // a word that can't be played: the row shakes and its tiles flash red
    let nopeTimer = 0;
    function nope(row, msg) {
      replay(row, 'shake');
      row.classList.add('nope');
      clearTimeout(nopeTimer);
      nopeTimer = setTimeout(() => row.classList.remove('nope'), 650);
      ctx.toast(msg);
    }

    function onKey(k) {
      if (over) return;
      if (k === 'back') cur = cur.slice(0, -1);
      else if (k === 'enter') {
        const row = rowsEl[history.length];
        if (cur.length < len) { nope(row, 'Not enough letters'); return; }
        if (!validGuess(cur)) { nope(row, 'Not in the word list'); return; }
        if (p.strict) { const err = strictError(cur, history); if (err) { nope(row, err); return; } }
        history.push({ word: cur, marks: score(cur, answer) });
        const won = cur === answer;
        cur = '';
        if (won) over = 'won';
        else if (history.length >= tries) over = 'lost';
        const r = history.length - 1;
        render(r);
        const g = history[r];
        said.textContent = `${g.word}: ` + [...g.word].map((ch, i) => `${ch.toUpperCase()} ${['not in the word', 'wrong spot', 'right spot'][g.marks[i]]}`).join(', ');
        if (won) {
          // once the last tile lands, the row jumps in a wave
          const rowEl = rowsEl[r];
          setTimeout(() => replay(rowEl, 'win'), flipMs());
          ctx.solved(`in ${history.length}`, { value: history.length, higher: false, fmt: (v) => `${v} guess${v > 1 ? 'es' : ''}` });
        }
        if (over === 'lost') ctx.finished?.();
        return;
      } else if (k.length === 1 && cur.length < len) { cur += k; popAt = cur.length - 1; }
      else return;
      render();
    }

    render();
    if (over === 'won' && history.length) rowsEl[history.length - 1].classList.add('won');
    return {
      onKey,
      hint() {
        if (over) return false;
        const known = new Set(revealedPos);
        for (const g of history) g.marks.forEach((m, i) => { if (m === 2) known.add(i); });
        const i = [...Array(len).keys()].find((x) => !known.has(x));
        if (i === undefined) { ctx.toast('You already have every letter in place'); return false; }
        revealedPos.push(i);
        hintAt = i;
        render();
        return `Letter ${i + 1} is ${answer[i].toUpperCase()}`;
      },
      reveal() { if (!over) { over = 'lost'; render(); ctx.save({ history, over, revealed: true }); } },
      destroy() { clearTimeout(flipTimer); clearTimeout(kbTimer); clearTimeout(nopeTimer); },
    };
  },
};
