import './sudoku.css';
import { h, put } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateSudoku, sudokuPeers } from '../gen/sudoku.js';

const PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4.6L15.8 4.8a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 6.6l3.4 3.4" stroke="currentColor" stroke-width="2"/></svg>';

// the 27 units: rows, columns, boxes
const UNITS = [];
for (let k = 0; k < 9; k++) {
  UNITS.push(Array.from({ length: 9 }, (_, j) => k * 9 + j));
  UNITS.push(Array.from({ length: 9 }, (_, j) => j * 9 + k));
  const r0 = Math.floor(k / 3) * 3, c0 = (k % 3) * 3;
  UNITS.push(Array.from({ length: 9 }, (_, j) => (r0 + Math.floor(j / 3)) * 9 + c0 + (j % 3)));
}

export default {
  id: 'sudoku',
  name: 'Sudoku',
  tagline: 'Every row, column and box holds 1 to 9',
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
      el.style.setProperty('--w', `${(r + c) * 34}ms`);
      cells.push(el); grid.append(el);
    }
    // the selection: a frame that glides from square to square
    const cursor = h('div', { class: 'sd-cursor', 'aria-hidden': 'true' });
    grid.append(cursor);
    const noteBtn = h('button', { class: 'btn small sd-notes-btn', type: 'button', 'aria-pressed': 'false', onClick: (e) => { e.currentTarget.blur(); noteMode = !noteMode; render(); } }, h('span', { class: 'sd-pen', html: PENCIL }), h('span', { class: 'sd-notes-label' }, 'Notes off'));
    const keys = [];
    const pad = h('div', { class: 'sd-pad' },
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => { const k = h('button', { class: 'sd-key', type: 'button', onPointerdown: (e) => { e.preventDefault(); replay(k, 'press'); enter(d); } }, d); keys.push(k); return k; }),
      h('button', { class: 'sd-key wide', type: 'button', 'aria-label': 'Erase', onPointerdown: (e) => { e.preventDefault(); replay(e.currentTarget, 'press'); enter(0); } }, '⌫'));
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    root.append(h('div', { class: 'board' }, grid),
      h('div', { class: 'row-actions' }, noteBtn,
        h('button', { class: 'btn small', type: 'button', onClick: (e) => { e.currentTarget.blur(); if (history.length && !done) { const st = history.pop(); val.splice(0, 81, ...st.val); st.notes.forEach((n, i) => (notes[i] = new Set(n))); render(); } } }, 'Undo')),
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

    // ----- drawing: a square only redraws when what it shows changes, so changes can animate -----
    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    const shownVal = new Array(81).fill(null);
    const shownNotes = new Array(81).fill('');
    let wasBad = new Set();
    let wasDone = new Set(); // units complete as of the last draw
    let flash = -1; // a square a hint just filled
    const unitDone = (u) => { const s = new Set(); for (const i of u) { if (!val[i]) return false; s.add(val[i]); } return s.size === 9; };

    function render() {
      const first = shownVal[0] === null;
      const clash = new Set();
      for (let i = 0; i < 81; i++) if (val[i]) for (const j of sudokuPeers[i]) if (val[j] === val[i]) clash.add(i);
      const selVal = sel >= 0 ? val[sel] : 0;
      cells.forEach((el, i) => {
        el.classList.toggle('sel', i === sel);
        el.classList.toggle('peer', sel >= 0 && i !== sel && sudokuPeers[sel].includes(i));
        el.classList.toggle('same', !!selVal && val[i] === selVal && i !== sel);
        el.classList.toggle('bad', clash.has(i) && !givens[i]);
        el.classList.toggle('hinted', hinted.has(i));
        const nk = val[i] ? '' : [...notes[i]].sort().join('');
        if (val[i] === shownVal[i] && nk === shownNotes[i]) return;
        const had = shownVal[i], hadNotes = shownNotes[i];
        shownVal[i] = val[i]; shownNotes[i] = nk;
        if (val[i]) put(el, h('span', { class: 'sd-d' + (first ? '' : ' in') }, String(val[i])));
        else if (notes[i].size) put(el, h('span', { class: 'sd-notes' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => h('i', { class: !first && notes[i].has(d) && !hadNotes.includes(String(d)) ? 'in' : '' }, notes[i].has(d) ? d : ''))));
        else put(el);
        // a number taken away shrinks out of the square
        if (!first && had && !val[i] && !calm()) el.append(h('span', { class: 'sd-d sd-ghost', onAnimationend: (e) => e.currentTarget.remove() }, String(had)));
      });
      if (!first) for (const i of clash) if (!wasBad.has(i) && !givens[i]) replay(cells[i], 'clash');
      wasBad = clash;
      if (flash >= 0) { replay(cells[flash], 'flash'); flash = -1; }
      // a row, column or box just completed: a highlight sweeps along it from the square you filled
      const nowDone = new Set(UNITS.map((u, k) => (unitDone(u) ? k : -1)).filter((k) => k >= 0));
      const fresh = [...nowDone].filter((k) => !wasDone.has(k));
      wasDone = nowDone;
      if (!first && fresh.length && !val.every((v, i) => v === solution[i])) sweep(fresh);
      // the selection frame
      const r = Math.floor(sel / 9), c = sel % 9;
      cursor.hidden = sel < 0 || done;
      cursor.style.transform = `translate(${c * 100}%, ${r * 100}%)`;
      // numbers already placed nine times step back on the pad
      const count = new Array(10).fill(0);
      val.forEach((v) => v && count[v]++);
      keys.forEach((k, d) => {
        const full = count[d + 1] >= 9;
        if (full && !k.classList.contains('full') && !first) replay(k, 'filled');
        k.classList.toggle('full', full);
        k.setAttribute('aria-label', full ? `${d + 1}, all placed` : String(d + 1));
      });
      noteBtn.lastChild.textContent = noteMode ? 'Notes on' : 'Notes off';
      noteBtn.setAttribute('aria-pressed', noteMode ? 'true' : 'false');
      noteBtn.classList.toggle('on', noteMode);
      grid.classList.toggle('noting', noteMode);
      const left = val.filter((v) => !v).length;
      if (!done) status.textContent = left ? `${left} squares to go` : clash.size ? 'Something clashes. Look for red numbers.' : '';
      if (!done && val.every((v, i) => v === solution[i])) {
        done = true; grid.classList.add('solved'); status.textContent = 'Every row, column and box complete.';
        cursor.hidden = true;
        win();
        ctx.solved();
      }
      ctx.save({ val, notes: notes.map((n) => [...n]), hinted: [...hinted], done, sel });
    }

    function sweep(units) {
      if (calm()) return;
      const r0 = Math.floor(sel / 9), c0 = sel % 9;
      const seen = new Set();
      for (const k of units) for (const i of UNITS[k]) {
        if (seen.has(i)) continue;
        seen.add(i);
        const r = Math.floor(i / 9), c = i % 9;
        cells[i].style.setProperty('--s', `${Math.max(Math.abs(r - r0), Math.abs(c - c0)) * 45}ms`);
        replay(cells[i], 'sweep');
      }
      setTimeout(() => seen.forEach((i) => cells[i].classList.remove('sweep')), 1100);
    }

    // the win: a wave rolls across the grid from the top left corner, every number flipping in turn
    function win() {
      if (calm()) return;
      cells.forEach((el) => el.classList.remove('sweep', 'clash', 'flash'));
      replay(grid, 'wave');
      setTimeout(() => grid.classList.remove('wave'), 1500);
    }

    render();
    if (done) { grid.classList.add('solved'); cursor.hidden = true; }
    return {
      onKey(k) {
        if (/^[1-9]$/.test(k)) { replay(keys[+k - 1], 'press'); return enter(+k); }
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
        shownVal[i] = -1; // redraw it so the number pops in even when a wrong one is corrected
        flash = i;
        render();
        return `Filled in ${solution[i]}`;
      },
      reveal() { val.splice(0, 81, ...solution); done = true; grid.classList.add('solved'); render(); cursor.hidden = true; status.textContent = 'Solution shown.'; ctx.save({ val, done, revealed: true }); },
    };
  },
};
