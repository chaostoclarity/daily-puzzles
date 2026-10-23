import { h, shake } from '../lib/ui.js';
import { generateTiles, shared, LAYER_VALUES } from '../gen/tiles.js';

const SHAPES = {
  circle: '<circle cx="50" cy="50" r="22"/>',
  square: '<rect x="30" y="30" width="40" height="40" rx="3"/>',
  diamond: '<path d="M50 24 76 50 50 76 24 50z"/>',
  triangle: '<path d="M50 25 76 71H24z"/>',
  ring: '<circle cx="50" cy="50" r="20" fill="none" stroke-width="9"/>',
  cross: '<path d="M43 26h14v17h17v14H57v17H43V57H26V43h17z"/>',
};
const MARKS = {
  dots: '<circle cx="14" cy="14" r="4"/><circle cx="26" cy="14" r="4"/><circle cx="14" cy="26" r="4"/>',
  stripes: '<path d="M6 30 30 6M6 42 42 6" stroke-width="5" fill="none"/>',
  corner: '<path d="M100 76v24H76z"/>',
  bar: '<rect x="8" y="86" width="84" height="7" rx="3"/>',
  wave: '<path d="M8 90q10-10 20 0t20 0 20 0 20 0" stroke-width="5" fill="none"/>',
  grid: '<path d="M78 8v20M88 8v20M68 18h30" stroke-width="4" fill="none"/>',
};

function tileSvg(t) {
  const bgIndex = t.bg ? LAYER_VALUES.bg.indexOf(t.bg) : -1;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    ${t.bg ? `<rect x="3" y="3" width="94" height="94" rx="12" class="tb${bgIndex}"/>` : ''}
    ${t.shape ? `<g class="tshape">${SHAPES[t.shape]}</g>` : ''}
    ${t.mark ? `<g class="tmark">${MARKS[t.mark]}</g>` : ''}
  </svg>`;
}
const describe = (t) => Object.entries(t).filter(([, v]) => v).map(([k, v]) => `${v} ${k === 'bg' ? 'background' : k}`).join(', ') || 'cleared';

export default {
  id: 'tiles',
  name: 'Toles',
  tagline: 'Match designs to clear the board',
  generate: generateTiles,
  rules: [
    'Each tile stacks a few designs: a background color, a shape, and on harder levels a small pattern.',
    'Tap two tiles that share a design. Whatever they share disappears from both.',
    'A tile is gone once all its designs are cleared. Clear the whole board.',
    'Matches in a row build your combo. A pair with nothing in common resets it.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const saved = ctx.load();
    const tiles = saved?.tiles || p.tiles.map((t) => ({ ...t }));
    let combo = saved?.combo || 0, best = saved?.best || 0, moves = saved?.moves || 0;
    let done = !!saved?.done;
    let sel = null;
    const els = [];
    const grid = h('div', { class: 'tile-grid', style: { '--c': p.cols }, role: 'grid', 'aria-label': 'Tiles' });
    tiles.forEach((t, i) => {
      const el = h('button', { class: 'tile-btn', type: 'button', onClick: () => tap(i) });
      els.push(el); grid.append(el);
    });
    const meter = h('div', { class: 'tile-meter', 'aria-live': 'polite' });
    root.append(meter, h('div', { class: 'board tile-board' }, grid));

    const empty = (t) => !Object.values(t).some(Boolean);

    function match(a, b, byHint = false) {
      const sh = shared(tiles[a], tiles[b]);
      if (!sh.length) return false;
      for (const k of sh) { tiles[a][k] = null; tiles[b][k] = null; }
      moves++;
      if (!byHint) { combo++; best = Math.max(best, combo); }
      return true;
    }

    function tap(i) {
      if (done || empty(tiles[i])) return;
      if (sel === null) { sel = i; return render(); }
      if (sel === i) { sel = null; return render(); }
      if (match(sel, i)) { sel = null; render(); return; }
      shake(els[sel]); shake(els[i]);
      combo = 0; sel = null;
      ctx.toast('Nothing in common. Combo reset');
      render();
    }

    function render() {
      tiles.forEach((t, i) => {
        const el = els[i];
        el.innerHTML = empty(t) ? '' : tileSvg(t);
        el.classList.toggle('gone', empty(t));
        el.classList.toggle('sel', sel === i);
        el.disabled = empty(t);
        el.setAttribute('aria-label', describe(t));
      });
      const left = tiles.filter((t) => !empty(t)).length;
      meter.replaceChildren(
        h('span', {}, h('b', {}, combo), ' combo'),
        h('span', {}, h('b', {}, best), ' best'),
        h('span', {}, h('b', {}, left), ' tiles left'));
      if (!done && left === 0) {
        done = true; grid.classList.add('solved');
        ctx.solved(`best combo ${best}`);
      }
      ctx.save({ tiles, combo, best, moves, done });
    }
    render();
    if (done) grid.classList.add('solved');
    return {
      hint() {
        if (done) return false;
        // prefer a match for the tile you've selected
        const live = tiles.map((t, i) => i).filter((i) => !empty(tiles[i]));
        const firsts = sel !== null ? [sel] : live;
        for (const a of firsts) for (const b of live) {
          if (a !== b && shared(tiles[a], tiles[b]).length) { match(a, b, true); sel = null; render(); return 'Made one match for you'; }
        }
        return false;
      },
    };
  },
};
