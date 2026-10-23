import { h, put, s as svgEl } from '../lib/ui.js';
import { generateFlipart, rotated, solvedBy } from '../gen/flipart.js';

const HUES = [8, 210, 140, 45, 280, 180, 330, 95, 25, 250, 160, 60];

export default {
  id: 'flipart',
  name: 'Flipert',
  tagline: 'Turn pieces to fill the frame',
  version: 1,
  generate: generateFlipart,
  rules: [
    'Each piece turns around its pivot, the square marked with four dots.',
    'Tap a piece to turn it a quarter turn clockwise. Where pieces overlap, tap the pivot to pick which one turns.',
    'Dark squares sit outside the frame; muted squares overlap another piece.',
    'Fill the frame exactly, with no overlaps. Par is the fewest turns that can do it.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const saved = ctx.load();
    const turns = saved?.turns || p.start.slice();
    let taps = saved?.taps || 0;
    let order = saved?.order || p.pieces.map((_, k) => k); // draw order, last on top
    let done = !!saved?.done;

    const W = p.w + 2 * p.pad, H = p.h + 2 * p.pad;
    const svg = svgEl('svg', { class: 'fa-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Pieces and frame' });
    const meter = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    root.append(h('div', { class: 'board fa-board', style: { '--ratio': `${W} / ${H}` } }, svg), meter);

    const pivotAt = (x, y) => p.pieces.findIndex((pc) => pc.pivot[0] === x && pc.pivot[1] === y);
    svg.addEventListener('click', (e) => {
      if (done) return;
      const r = svg.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * W) - p.pad;
      const y = Math.floor(((e.clientY - r.top) / r.height) * H) - p.pad;
      let k = pivotAt(x, y);
      if (k < 0) {
        // topmost piece covering the tapped square
        for (let i = order.length - 1; i >= 0; i--) {
          if (rotated(p.pieces[order[i]], turns[order[i]]).some(([cx, cy]) => cx === x && cy === y)) { k = order[i]; break; }
        }
      }
      if (k < 0) return;
      turn(k);
    });

    function turn(k, counts = true) {
      turns[k] = (turns[k] + 1) % 4;
      if (counts) taps++;
      order = order.filter((x) => x !== k).concat(k);
      check();
      render();
    }

    function check() {
      if (!done && solvedBy(p, turns)) {
        done = true;
        ctx.solved(`${taps} turn${taps === 1 ? '' : 's'}, par ${p.par}`);
      }
    }

    function render() {
      const count = new Map();
      const placed = p.pieces.map((pc, k) => rotated(pc, turns[k]));
      placed.forEach((cells) => cells.forEach(([x, y]) => count.set(x + ',' + y, (count.get(x + ',' + y) || 0) + 1)));
      const kids = [svgEl('rect', { class: 'fa-frame', x: p.pad, y: p.pad, width: p.w, height: p.h })];
      for (const k of order) {
        const g = svgEl('g', { class: 'fa-piece', style: `--hue:${HUES[k % HUES.length]}` });
        for (const [x, y] of placed[k]) {
          const out = x < 0 || y < 0 || x >= p.w || y >= p.h;
          const over = count.get(x + ',' + y) > 1;
          g.append(svgEl('rect', { class: 'fa-cell' + (out ? ' out' : over ? ' over' : ''), x: x + p.pad + 0.04, y: y + p.pad + 0.04, width: 0.92, height: 0.92, rx: 0.12 }));
        }
        const [px, py] = p.pieces[k].pivot;
        for (const [dx, dy] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) g.append(svgEl('circle', { class: 'fa-dot', cx: px + p.pad + 0.5 + dx, cy: py + p.pad + 0.5 + dy, r: 0.07 }));
        kids.push(g);
      }
      put(svg, kids);
      svg.classList.toggle('solved', done);
      const overlaps = [...count.values()].filter((v) => v > 1).length;
      const outside = placed.flat().filter(([x, y]) => x < 0 || y < 0 || x >= p.w || y >= p.h).length;
      put(meter, done ? `Filled in ${taps} turn${taps === 1 ? '' : 's'} (par ${p.par})` : `${taps} turn${taps === 1 ? '' : 's'} · par ${p.par} · ${overlaps} overlapping · ${outside} outside`);
      ctx.save({ turns, taps, order, done });
    }
    render();

    return {
      hint() {
        if (done) return false;
        const k = turns.findIndex((t) => t % 4 !== 0);
        if (k < 0) return false;
        turns[k] = 3; turn(k, false); // lands on 0, its home turn
        return 'Turned one piece into place';
      },
      reveal() {
        turns.fill(0); done = true; render();
      },
    };
  },
};
