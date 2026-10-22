import { h, put } from '../lib/ui.js';
import { generateSudoku, sudokuPeers } from '../gen/sudoku.js';

export default {
  id: 'sudoku',
  name: 'Sudoku',
  tagline: 'Every row, column and box holds 1 to 9',
  inspired: 'Sudoku',
  generate: generateSudoku,
  rules: [
    'Fill the grid so every row, every column and every 3x3 box contains the numbers 1 to 9 once each.',
    'Tap a square, then tap a number. Typing 1 to 9 works too.',
    'Turn on Notes to pencil in small candidates instead.',
    'Numbers that clash with another in the same row, column or box turn red.',
  ],
  mount(root, ctx) {
    const { givens, solution } = ctx.puzzle;
    const saved = ctx.load();
    const val = saved?.val || givens.slice();
    const notes = (saved?.notes || Array.from({ length: 81 }, () => [])).map((a) => new Set(a));
    const hinted = new Set(saved?.hinted || []);
    let done = !!saved?.done;
    let sel = saved?.sel ?? givens.findIndex((g) => !g);
    let noteMode = false;
    const history = [];

    const cells = [];
    const grid = h('div', { class: 'sudoku-grid', role: 'grid', 'aria-label': 'Sudoku grid' });
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9;
      const el = h('button', {
        class: 'sd-cell' + (c % 3 === 2 && c < 8 ? ' br' : '') + (r % 3 === 2 && r < 8 ? ' bb' : '') + (givens[i] ? ' given' : ''),
        type: 'button', 'aria-label': `Row ${r + 1}, column ${c + 1}`, onClick: () => { sel = i; render(); },
      });
      cells.push(el); grid.append(el);
    }
    const noteBtn = h('button', { class: 'btn small', type: 'button', 'aria-pressed': 'false', onClick: () => { noteMode = !noteMode; render(); } }, 'Notes off');
    const pad = h('div', { class: 'sd-pad' },
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => h('button', { class: 'sd-key', type: 'button', onPointerdown: (e) => { e.preventDefault(); enter(d); } }, d)),
      h('button', { class: 'sd-key wide', type: 'button', 'aria-label': 'Erase', onPointerdown: (e) => { e.preventDefault(); enter(0); } }, '⌫'));
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    root.append(h('div', { class: 'board' }, grid),
      h('div', { class: 'row-actions' }, noteBtn,
        h('button', { class: 'btn small', type: 'button', onClick: () => { if (history.length && !done) { const st = history.pop(); val.splice(0, 81, ...st.val); st.notes.forEach((n, i) => (notes[i] = new Set(n))); render(); } } }, 'Undo')),
      pad, status);

    const snapshot = () => { history.push({ val: val.slice(), notes: notes.map((n) => [...n]) }); if (history.length > 200) history.shift(); };

    function enter(d) {
      if (done || sel < 0 || givens[sel]) return;
      snapshot();
      if (noteMode && d) {
        if (val[sel]) return;
        notes[sel].has(d) ? notes[sel].delete(d) : notes[sel].add(d);
      } else {
        val[sel] = val[sel] === d ? 0 : d;
        notes[sel].clear();
        hinted.delete(sel);
        if (d) for (const j of sudokuPeers[sel]) notes[j].delete(d); // clear that number from peers' notes
      }
      render();
    }

    function render() {
      const clash = new Set();
      for (let i = 0; i < 81; i++) if (val[i]) for (const j of sudokuPeers[i]) if (val[j] === val[i]) clash.add(i);
      const selVal = sel >= 0 ? val[sel] : 0;
      cells.forEach((el, i) => {
        el.classList.toggle('sel', i === sel);
        el.classList.toggle('peer', sel >= 0 && i !== sel && sudokuPeers[sel].includes(i));
        el.classList.toggle('same', !!selVal && val[i] === selVal && i !== sel);
        el.classList.toggle('bad', clash.has(i) && !givens[i]);
        el.classList.toggle('hinted', hinted.has(i));
        if (val[i]) put(el, String(val[i]));
        else if (notes[i].size) put(el, h('span', { class: 'sd-notes' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => h('i', {}, notes[i].has(d) ? d : ''))));
        else put(el);
      });
      noteBtn.textContent = noteMode ? 'Notes on' : 'Notes off';
      noteBtn.setAttribute('aria-pressed', noteMode ? 'true' : 'false');
      noteBtn.classList.toggle('on', noteMode);
      const left = val.filter((v) => !v).length;
      if (!done) status.textContent = left ? `${left} squares to go` : clash.size ? 'Something clashes. Look for red numbers.' : '';
      if (!done && val.every((v, i) => v === solution[i])) {
        done = true; grid.classList.add('solved'); status.textContent = 'Every row, column and box complete.';
        ctx.solved();
      }
      ctx.save({ val, notes: notes.map((n) => [...n]), hinted: [...hinted], done, sel });
    }
    render();
    if (done) grid.classList.add('solved');
    return {
      onKey(k) {
        if (/^[1-9]$/.test(k)) return enter(+k);
        if (k === 'back') return enter(0);
        const r = Math.floor(sel / 9), c = sel % 9;
        if (k === 'up' && r > 0) sel -= 9; else if (k === 'down' && r < 8) sel += 9;
        else if (k === 'left' && c > 0) sel -= 1; else if (k === 'right' && c < 8) sel += 1;
        else if (k === 'n') { noteMode = !noteMode; } else return;
        render();
      },
      hint() {
        if (done) return false;
        snapshot();
        // fix a wrong number first, otherwise fill the selected square or the next empty one
        let i = val.findIndex((v, j) => v && v !== solution[j]);
        if (i === -1) i = sel >= 0 && !val[sel] ? sel : val.findIndex((v) => !v);
        val[i] = solution[i]; notes[i].clear(); hinted.add(i); sel = i;
        for (const j of sudokuPeers[i]) notes[j].delete(solution[i]);
        render();
        return `Filled in ${solution[i]}`;
      },
      reveal() { val.splice(0, 81, ...solution); done = true; grid.classList.add('solved'); render(); status.textContent = 'Solution shown.'; ctx.save({ val, done, revealed: true }); },
    };
  },
};
