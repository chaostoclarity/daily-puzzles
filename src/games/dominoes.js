import { h, put } from '../lib/ui.js';
import { generateDominoes, ruleOk, ruleLabel, dominoNeighbors } from '../gen/dominoes.js';

const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const pips = (v) => h('span', { class: 'pips', 'aria-label': `${v}` }, Array.from({ length: 9 }, (_, i) => h('i', { class: PIPS[v].includes(i) ? 'on' : '' })));

export default {
  id: 'dominoes',
  name: 'Pops',
  tagline: 'Place every domino to meet each region’s rule',
  generate: generateDominoes,
  rules: [
    'Place every domino from the tray onto the board so it covers two squares side by side.',
    'Each colored region has a rule. A number means its pips add up to that number. = means all the same, ≠ means all different, < and > mean the total is under or over the number.',
    'Tap a domino in the tray, then tap a square to place it. Tap a placed domino to select it, then Rotate, Flip or Remove it.',
    'Squares with no color have no rule.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const { n } = p;
    const onBoard = new Set(p.cells);
    const regionOf = {};
    p.regions.forEach((r, i) => r.cells.forEach((c) => (regionOf[c] = i)));
    const saved = ctx.load();
    let placed = saved?.placed || {}; // id -> { cells: [x, y], vals: [a, b] }
    let done = !!saved?.done;
    let pick = null;      // tray domino id waiting to be placed
    let focus = null;     // placed domino id selected for editing
    const tileOf = Object.fromEntries(p.tray.map((t) => [t.id, t]));

    const occupant = () => { const m = {}; for (const [id, pl] of Object.entries(placed)) pl.cells.forEach((c, k) => (m[c] = { id: +id, val: pl.vals[k] })); return m; };

    const cellsEl = [];
    const grid = h('div', { class: 'dom-grid', style: { '--n': n }, role: 'grid', 'aria-label': 'Domino board' });
    for (let c = 0; c < n * n; c++) {
      const g = regionOf[c];
      const rule = g !== undefined ? p.regions[g].rule : null;
      const el = onBoard.has(c)
        ? h('button', { class: 'dom-cell' + (rule ? ` rg${g % 9} ruled` : ''), type: 'button', 'data-cell': c, onClick: () => tap(c) })
        : h('div', { class: 'dom-cell off', 'aria-hidden': 'true' });
      if (onBoard.has(c) && rule) {
        const r = Math.floor(c / n), k = c % n;
        if (k < n - 1 && regionOf[c + 1] !== g) el.classList.add('edge-r');
        if (k > 0 && regionOf[c - 1] !== g) el.classList.add('edge-l');
        if (r < n - 1 && regionOf[c + n] !== g) el.classList.add('edge-b');
        if (r > 0 && regionOf[c - n] !== g) el.classList.add('edge-t');
      }
      cellsEl.push(el); grid.append(el);
    }
    // rule badges on the first cell of each ruled region
    const badges = p.regions.map((r, i) => r.rule ? { cell: Math.min(...r.cells), label: ruleLabel(r.rule), i } : null).filter(Boolean);
    const tray = h('div', { class: 'dom-tray', 'aria-label': 'Dominoes to place' });
    const editBar = h('div', { class: 'row-actions' },
      h('button', { class: 'btn small', type: 'button', onClick: () => rotate() }, 'Rotate'),
      h('button', { class: 'btn small', type: 'button', onClick: () => flip() }, 'Flip'),
      h('button', { class: 'btn small', type: 'button', onClick: () => remove() }, 'Remove'));
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    root.append(h('div', { class: 'board dom-board' }, grid), editBar, tray, status);

    function fitOrientation(x, exclude) {
      const occ = occupant();
      return dominoNeighbors(n, x).filter((y) => onBoard.has(y) && (!occ[y] || occ[y].id === exclude));
    }

    function tap(c) {
      if (done) return;
      const occ = occupant();
      if (occ[c]) { focus = focus === occ[c].id ? null : occ[c].id; pick = null; return render(); }
      const id = pick ?? focus;
      if (id === null || id === undefined) { ctx.toast('Pick a domino from the tray first'); return; }
      const order = fitOrientation(c, id);
      // keep a moved domino's direction when it fits
      const prefer = placed[id] ? placed[id].cells[1] - placed[id].cells[0] : 1;
      const y = order.find((q) => q - c === prefer) ?? order.find((q) => q === c + 1) ?? order[0];
      if (y === undefined) { ctx.toast('No room for a domino there'); return; }
      const t = tileOf[id];
      placed[id] = { cells: [c, y], vals: placed[id]?.vals || [t.a, t.b] };
      pick = null; focus = id;
      render();
    }
    function rotate() {
      if (focus === null || done) return;
      const pl = placed[focus];
      const opts = fitOrientation(pl.cells[0], focus);
      const i = opts.indexOf(pl.cells[1]);
      pl.cells = [pl.cells[0], opts[(i + 1) % opts.length]];
      render();
    }
    function flip() { if (focus === null || done) return; placed[focus].vals.reverse(); render(); }
    function remove() { if (focus === null || done) return; delete placed[focus]; focus = null; render(); }

    function regionState() {
      const occ = occupant();
      return p.regions.map((r) => {
        if (!r.rule) return 'none';
        if (!r.cells.every((c) => occ[c])) return 'open';
        return ruleOk(r.rule, r.cells.map((c) => occ[c].val)) ? 'ok' : 'bad';
      });
    }

    function render() {
      const occ = occupant();
      const rs = regionState();
      cellsEl.forEach((el, c) => {
        if (!onBoard.has(c)) return;
        const o = occ[c];
        el.classList.toggle('has', !!o);
        el.classList.toggle('focus', !!o && o.id === focus);
        el.classList.remove('join-r', 'join-l', 'join-t', 'join-b');
        if (o) {
          const other = placed[o.id].cells.find((x) => x !== c);
          el.classList.add(other === c + 1 ? 'join-r' : other === c - 1 ? 'join-l' : other === c + n ? 'join-b' : 'join-t');
        }
        const g = regionOf[c];
        el.classList.toggle('bad', g !== undefined && rs[g] === 'bad');
        el.classList.toggle('good', g !== undefined && rs[g] === 'ok');
        const badge = badges.find((b) => b.cell === c);
        put(el, o ? pips(o.val) : null, badge ? h('span', { class: 'dom-badge' + (rs[badge.i] === 'bad' ? ' bad' : rs[badge.i] === 'ok' ? ' ok' : '') }, badge.label) : null);
      });
      put(tray, p.tray.filter((t) => !placed[t.id]).map((t) => h('button', {
        class: 'dom-piece' + (pick === t.id ? ' picked' : ''), type: 'button', 'aria-label': `Domino ${t.a} and ${t.b}`,
        onClick: () => { if (done) return; pick = pick === t.id ? null : t.id; focus = null; render(); },
      }, h('span', { class: 'half' }, pips(t.a)), h('span', { class: 'half' }, pips(t.b)))));
      editBar.hidden = focus === null || done;
      const left = p.tray.length - Object.keys(placed).length;
      if (!done) status.textContent = left ? `${left} domino${left > 1 ? 'es' : ''} left to place` : rs.includes('bad') ? 'A region breaks its rule (shown in red).' : '';
      if (!done && left === 0 && !rs.includes('bad')) {
        done = true; focus = null; editBar.hidden = true; grid.classList.add('solved');
        status.textContent = 'Every rule satisfied.';
        ctx.solved();
      }
      ctx.save({ placed, done });
    }
    render();
    if (done) grid.classList.add('solved');
    return {
      hint() {
        if (done) return false;
        const s = p.solution.find((d) => {
          const pl = placed[d.id];
          return !pl || pl.cells[0] !== d.cells[0] || pl.cells[1] !== d.cells[1] || pl.vals[0] !== d.values[0] || pl.vals[1] !== d.values[1];
        });
        // clear anything sitting where it belongs, then set it down
        for (const [id, pl] of Object.entries(placed)) if (+id !== s.id && pl.cells.some((c) => s.cells.includes(c))) delete placed[id];
        placed[s.id] = { cells: s.cells.slice(), vals: s.values.slice() };
        pick = null; focus = null;
        render();
        return 'Placed one domino';
      },
      reveal() {
        placed = Object.fromEntries(p.solution.map((d) => [d.id, { cells: d.cells.slice(), vals: d.values.slice() }]));
        done = true; focus = null; grid.classList.add('solved'); render(); status.textContent = 'Solution shown.';
        ctx.save({ placed, done, revealed: true });
      },
    };
  },
};
