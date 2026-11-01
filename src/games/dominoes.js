import './dominoes.css';
import { h, put } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateDominoes, ruleOk, ruleLabel, dominoNeighbors } from '../gen/dominoes.js';

const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const pips = (v) => h('span', { class: 'pips', 'aria-label': `${v}` }, Array.from({ length: 9 }, (_, i) => h('i', { class: PIPS[v].includes(i) ? 'on' : '' })));
// an ivory domino face: two halves of pips, a groove between them and a brass pin in the middle
const face = (a, b) => h('span', { class: 'dom-face' }, h('span', { class: 'dom-half' }, pips(a)), h('span', { class: 'dom-half' }, pips(b)));
const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

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

    // the board is cropped to the squares in play, so it takes no more room than it needs
    const rowOf = (c) => Math.floor(c / n), colOf = (c) => c % n;
    const r0 = Math.min(...p.cells.map(rowOf)), r1 = Math.max(...p.cells.map(rowOf));
    const k0 = Math.min(...p.cells.map(colOf)), k1 = Math.max(...p.cells.map(colOf));
    const R = r1 - r0 + 1, C = k1 - k0 + 1;
    const ruleText = (rule) => {
      if (rule.t === 'sum') return `pips add up to ${rule.v}`;
      if (rule.t === 'eq') return 'all pips the same';
      if (rule.t === 'neq') return 'all pips different';
      if (rule.t === 'lt') return `total under ${rule.v}`;
      if (rule.t === 'gt') return `total over ${rule.v}`;
      return '';
    };

    const cellsEl = [];
    const grid = h('div', { class: 'dom-grid', role: 'grid', 'aria-label': 'Domino board' });
    for (let r = r0; r <= r1; r++) for (let k = k0; k <= k1; k++) {
      const c = r * n + k;
      const g = regionOf[c];
      const rule = g !== undefined ? p.regions[g].rule : null;
      const el = onBoard.has(c)
        ? h('button', { class: 'dom-cell' + (rule ? ` rg${g % 9} ruled` : ''), type: 'button', 'data-cell': c, onClick: () => tap(c) })
        : h('div', { class: 'dom-cell off', 'aria-hidden': 'true' });
      if (onBoard.has(c) && rule) {
        if (k < n - 1 && regionOf[c + 1] !== g) el.classList.add('edge-r');
        if (k > 0 && regionOf[c - 1] !== g) el.classList.add('edge-l');
        if (r < n - 1 && regionOf[c + n] !== g) el.classList.add('edge-b');
        if (r > 0 && regionOf[c - n] !== g) el.classList.add('edge-t');
      }
      cellsEl[c] = el; grid.append(el);
    }
    // placed dominoes and rule badges ride on a layer above the squares; taps fall through to the squares
    const layer = h('div', { class: 'dom-layer', 'aria-hidden': 'true' });
    const at = (c) => ({ left: `${((colOf(c) - k0) / C) * 100}%`, top: `${((rowOf(c) - r0) / R) * 100}%` });
    // rule badges on the first cell of each ruled region
    const badges = p.regions.map((r, i) => r.rule ? { cell: Math.min(...r.cells), label: ruleLabel(r.rule), i } : null).filter(Boolean);
    badges.forEach((b) => { b.el = h('span', { class: 'dom-badge', style: at(b.cell) }, b.label); });
    const wrap = h('div', { class: 'dom-wrap', style: { '--cols': C, '--rows': R } }, grid, layer);
    // the tray keeps a slot for every domino, so pieces leave a gap when placed and come back to it
    const slots = new Map();
    const tray = h('div', { class: 'dom-tray', 'aria-label': 'Dominoes to place' }, p.tray.map((t) => {
      const btn = h('button', {
        class: 'dom-piece', type: 'button', 'aria-label': `Domino ${t.a} and ${t.b}`,
        onClick: (e) => { e.currentTarget.blur(); if (done) return; pick = pick === t.id ? null : t.id; focus = null; render(); },
      }, face(t.a, t.b));
      const slot = h('span', { class: 'dom-slot' }, btn);
      slots.set(t.id, { slot, btn });
      return slot;
    }));
    const editBar = h('div', { class: 'row-actions dom-edit' },
      h('button', { class: 'btn small', type: 'button', onClick: (e) => { e.currentTarget.blur(); rotate(); } }, 'Rotate'),
      h('button', { class: 'btn small', type: 'button', onClick: (e) => { e.currentTarget.blur(); flip(); } }, 'Flip'),
      h('button', { class: 'btn small', type: 'button', onClick: (e) => { e.currentTarget.blur(); remove(); } }, 'Remove'));
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    root.append(h('div', { class: 'board dom-board' }, wrap), editBar, tray, status);

    function fitOrientation(x, exclude) {
      const occ = occupant();
      return dominoNeighbors(n, x).filter((y) => onBoard.has(y) && (!occ[y] || occ[y].id === exclude));
    }

    let flyFrom = null; // { id, rect } of a tray piece on its way to the board
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
      if (!placed[id]) flyFrom = { id, rect: slots.get(id).btn.getBoundingClientRect() };
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
    function flip() {
      if (focus === null || done) return;
      placed[focus].vals.reverse();
      flipping = focus;
      render();
    }
    function remove() { if (focus === null || done) return; delete placed[focus]; focus = null; render(); }

    function regionState() {
      const occ = occupant();
      return p.regions.map((r) => {
        if (!r.rule) return 'none';
        if (!r.cells.every((c) => occ[c])) return 'open';
        return ruleOk(r.rule, r.cells.map((c) => occ[c].val)) ? 'ok' : 'bad';
      });
    }

    // ----- dominoes on the board -----
    // Each is a 2x1 piece pinned at its first square and turned around that square's center,
    // so rotating swings it round and moving it slides it across.
    const doms = new Map(); // id -> { el, face, angle }
    let flipping = null;
    const baseAngle = (cells) => { const d = cells[1] - cells[0]; return d === 1 ? 0 : d === n ? 90 : d === -1 ? 180 : 270; };
    function place(d, cells) {
      const target = baseAngle(cells);
      d.angle += ((((target - d.angle) % 360) + 540) % 360) - 180; // shortest way round
      const a = ((d.angle % 360) + 360) % 360 * Math.PI / 180;
      d.el.style.setProperty('--x', colOf(cells[0]) - k0);
      d.el.style.setProperty('--y', rowOf(cells[0]) - r0);
      d.el.style.setProperty('--rot', `${d.angle}deg`);
      // light comes from above the board whichever way the piece faces
      d.el.style.setProperty('--dx', Math.sin(a).toFixed(3));
      d.el.style.setProperty('--dy', Math.cos(a).toFixed(3));
    }
    function syncDom(id, pl, rs) {
      let d = doms.get(id);
      const fresh = !d;
      if (fresh) {
        const f = face(pl.vals[0], pl.vals[1]);
        d = { el: h('span', { class: 'dom-dom' }, f), face: f, angle: baseAngle(pl.cells), vals: '' };
        doms.set(id, d);
        layer.prepend(d.el); // under the badges
      }
      place(d, pl.cells);
      const key = pl.vals.join();
      if (d.vals && d.vals !== key) {
        d.face.querySelectorAll('.dom-half').forEach((half, k) => put(half, pips(pl.vals[k])));
        if (flipping === id && !calm() && d.face.animate) d.face.animate([{ transform: 'rotate(180deg) scale(1.06)' }, { transform: 'rotate(0) scale(1)' }], { duration: 340, easing: 'cubic-bezier(0.3, 1.3, 0.5, 1)' });
      }
      d.vals = key;
      d.face.querySelectorAll('.dom-half').forEach((half, k) => {
        const g = regionOf[pl.cells[k]];
        half.classList.toggle('bad', g !== undefined && rs[g] === 'bad');
      });
      d.el.classList.toggle('focus', id === focus);
      if (fresh) {
        if (flyFrom && flyFrom.id === id) fly(d, flyFrom.rect, pl.cells);
        else if (!booting) replay(d.el, 'drop');
      }
    }
    // a tray piece flies to its squares, turning to face the way it will lie, then settles
    function cellsCenter(cells) {
      const a = cellsEl[cells[0]].getBoundingClientRect(), b = cellsEl[cells[1]].getBoundingClientRect();
      return { x: (a.left + a.right + b.left + b.right) / 4, y: (a.top + a.bottom + b.top + b.bottom) / 4, cell: a.width };
    }
    function ghost(d, w) {
      const g = h('span', { class: 'dom-fly', style: { width: `${w * 2}px`, height: `${w}px` } }, d.face.cloneNode(true));
      document.body.append(g);
      return g;
    }
    function fly(d, from, cells) {
      if (calm() || !d.el.animate || !from.width) { replay(d.el, 'drop'); return; }
      const to = cellsCenter(cells);
      const g = ghost(d, to.cell);
      const spin = ((((d.angle % 360) + 540) % 360) - 180);
      const s0 = from.width / (to.cell * 2);
      const x0 = from.left + from.width / 2, y0 = from.top + from.height / 2;
      d.el.classList.add('landing');
      const anim = g.animate([
        { transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) rotate(0deg) scale(${s0})` },
        { transform: `translate(${(x0 + to.x) / 2}px, ${Math.min(y0, to.y) - 30}px) translate(-50%, -50%) rotate(${spin / 2}deg) scale(${(s0 + 1) / 2 * 1.12})`, offset: 0.55 },
        { transform: `translate(${to.x}px, ${to.y}px) translate(-50%, -50%) rotate(${spin}deg) scale(1)` },
      ], { duration: 340, easing: 'cubic-bezier(0.35, 0.6, 0.4, 1)' });
      const end = () => { g.remove(); d.el.classList.remove('landing'); replay(d.el, 'settle'); };
      anim.onfinish = end; anim.oncancel = end;
    }
    // a removed piece goes home to its slot in the tray
    function flyHome(id, d) {
      const { btn } = slots.get(id);
      const r = d.face.getBoundingClientRect();
      d.el.remove();
      const to = btn.getBoundingClientRect();
      if (calm() || !d.el.animate || !to.width || !r.width) return;
      const cell = cellsEl[p.cells[0]].getBoundingClientRect().width;
      const g = ghost(d, cell);
      const spin = ((((d.angle % 360) + 540) % 360) - 180);
      const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2, x1 = to.left + to.width / 2, y1 = to.top + to.height / 2;
      const s1 = to.width / (cell * 2);
      btn.classList.add('landing');
      const anim = g.animate([
        { transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) rotate(${spin}deg) scale(1.05)` },
        { transform: `translate(${x1}px, ${y1}px) translate(-50%, -50%) rotate(0deg) scale(${s1})` },
      ], { duration: 300, easing: 'cubic-bezier(0.4, 0, 0.3, 1)' });
      const end = () => { g.remove(); btn.classList.remove('landing'); replay(btn, 'home'); };
      anim.onfinish = end; anim.oncancel = end;
    }

    // a region whose rule just came true lights up under a soft glow
    function glowRegion(i) {
      if (calm()) return;
      for (const c of p.regions[i].cells) {
        layer.append(h('span', { class: 'dom-glow', style: at(c), onAnimationend: (e) => e.currentTarget.remove() }));
      }
    }

    // the win: dominoes topple in turn across the board, like a run of dominoes falling
    function winFx() {
      if (calm()) return;
      const list = [...doms.entries()].map(([id, d]) => ({ d, c: placed[id].cells[0] })).sort((a, b) => (rowOf(a.c) + colOf(a.c)) - (rowOf(b.c) + colOf(b.c)));
      list.forEach(({ d }, i) => d.el.style.setProperty('--i', i));
      replay(layer, 'win');
      setTimeout(() => layer.classList.remove('win'), 700 + list.length * 80);
      p.regions.forEach((r, i) => r.rule && setTimeout(() => glowRegion(i), 250));
    }

    let prevRs = null, booting = true;
    function render() {
      const occ = occupant();
      const rs = regionState();
      cellsEl.forEach((el, c) => {
        if (!onBoard.has(c)) return;
        const o = occ[c];
        const g = regionOf[c];
        const rule = g !== undefined ? p.regions[g].rule : null;
        el.classList.toggle('bad', g !== undefined && rs[g] === 'bad');
        el.classList.toggle('good', g !== undefined && rs[g] === 'ok');
        el.setAttribute('aria-label', `Row ${rowOf(c) - r0 + 1}, column ${colOf(c) - k0 + 1}${rule ? `, region: ${ruleText(rule)}` : ''}${o ? `, ${o.val} pip${o.val === 1 ? '' : 's'}${o.id === focus ? ', selected' : ''}` : ', empty'}`);
      });
      for (const [id, d] of doms) if (!placed[id]) { doms.delete(id); if (booting) d.el.remove(); else flyHome(id, d); }
      for (const [id, pl] of Object.entries(placed)) syncDom(+id, pl, rs);
      flipping = null; flyFrom = null;
      badges.forEach((b) => {
        const st = rs[b.i] === 'bad' ? 'bad' : rs[b.i] === 'ok' ? 'ok' : '';
        if (!b.el.isConnected) layer.append(b.el);
        if ((b.st ?? '') !== st) {
          b.el.classList.remove('ok', 'bad');
          if (st) b.el.classList.add(st);
          if (b.st !== undefined && st) replay(b.el, 'pop');
        }
        b.st = st;
      });
      if (prevRs) rs.forEach((s, i) => { if (s === 'ok' && prevRs[i] !== 'ok') glowRegion(i); });
      prevRs = rs;
      p.tray.forEach((t) => {
        const { slot, btn } = slots.get(t.id);
        slot.classList.toggle('used', !!placed[t.id]);
        btn.classList.toggle('picked', pick === t.id);
        btn.setAttribute('aria-pressed', pick === t.id ? 'true' : 'false');
      });
      editBar.classList.toggle('off', focus === null || done);
      editBar.hidden = done;
      const left = p.tray.length - Object.keys(placed).length;
      if (!done) status.textContent = left ? `${left} domino${left > 1 ? 'es' : ''} left to place` : rs.includes('bad') ? 'A region breaks its rule (shown in red).' : '';
      if (!done && left === 0 && !rs.includes('bad')) {
        done = true; focus = null; editBar.hidden = true; grid.classList.add('solved');
        doms.forEach((d) => d.el.classList.remove('focus'));
        status.textContent = 'Every rule satisfied.';
        winFx();
        ctx.solved();
      }
      wrap.classList.toggle('done', done);
      tray.hidden = done; // every piece is on the board
      wrap.classList.toggle('armed', !done && (pick !== null || focus !== null));
      ctx.save({ placed, done });
    }
    render();
    booting = false;
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
        if (!placed[s.id]) flyFrom = { id: s.id, rect: slots.get(s.id).btn.getBoundingClientRect() };
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
