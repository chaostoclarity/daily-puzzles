import { h, put, s, shake } from '../lib/ui.js';
import { generateLetterbox, letterboxError } from '../gen/letterbox.js';

// letter positions around a 300x300 square (three per side)
const SIDE_POS = [
  [[90, 30], [150, 30], [210, 30]],    // top
  [[270, 90], [270, 150], [270, 210]], // right
  [[210, 270], [150, 270], [90, 270]], // bottom
  [[30, 210], [30, 150], [30, 90]],    // left
];

export default {
  id: 'letterbox',
  name: 'Litter Boxed',
  tagline: 'Chain words around a square of letters',
  generate: generateLetterbox,
  rules: [
    'Make words from the twelve letters around the square. Each word needs at least three letters.',
    'Consecutive letters must come from different sides. You can reuse letters.',
    'Each new word starts with the last letter of the word before.',
    'Use every letter to solve. Try to do it within the target number of words.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const saved = ctx.load();
    const words = saved?.words || [];
    let cur = saved?.cur || (words.length ? words[words.length - 1].slice(-1) : '');
    let done = !!saved?.done;
    let hintN = saved?.hintN || 0; // letters of the two-word answer revealed
    const sideOf = {}, posOf = {};
    p.sides.forEach((sd, i) => sd.forEach((l, k) => { sideOf[l] = i; posOf[l] = SIDE_POS[i][k]; }));
    const letters = Object.keys(sideOf);

    const svg = s('svg', { class: 'lb-svg', viewBox: '0 0 300 300', role: 'group', 'aria-label': 'Letter square' });
    const wordLine = h('div', { class: 'lb-current', 'aria-live': 'polite' });
    const list = h('div', { class: 'lb-words' });
    const hintChip = h('div', { class: 'hive-hintword' });
    const status = h('p', { class: 'hint-line', 'aria-live': 'polite' });
    root.append(wordLine, h('div', { class: 'board lb-board' }, svg),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn', type: 'button', onClick: () => onKey('back') }, 'Delete'),
        h('button', { class: 'btn', type: 'button', onClick: restart }, 'Restart'),
        h('button', { class: 'btn primary', type: 'button', onClick: () => onKey('enter') }, 'Enter')),
      hintChip, list, status);

    function restart() { if (done) return; words.length = 0; cur = ''; render(); }

    function onKey(k) {
      if (done) return;
      if (k === 'back') {
        if (cur.length > 1 || (cur.length === 1 && !words.length)) cur = cur.slice(0, -1);
        else if (cur.length <= 1 && words.length) { cur = words.pop(); } // step back into the previous word
        return render();
      }
      if (k === 'enter') {
        const err = letterboxError(p, cur, words[words.length - 1]);
        if (err) { ctx.toast(err); shake(wordLine); return; }
        words.push(cur);
        cur = cur.slice(-1);
        return render();
      }
      if (k.length === 1 && sideOf[k] !== undefined) {
        const last = cur[cur.length - 1];
        if (last && sideOf[last] === sideOf[k]) { ctx.toast('Pick a letter from a different side'); shake(wordLine); return; }
        cur += k; render();
      }
    }

    function render() {
      const used = new Set(words.join('') + cur);
      // edges
      const pathFor = (w) => [...w].map((l) => posOf[l].join(',')).join(' ');
      const kids = [s('rect', { x: 30, y: 30, width: 240, height: 240, class: 'lb-box' })];
      for (const w of words) kids.push(s('polyline', { points: pathFor(w), class: 'lb-line done' }));
      if (cur.length > 1) kids.push(s('polyline', { points: pathFor(cur), class: 'lb-line' }));
      for (const l of letters) {
        const [x, y] = posOf[l];
        const sd = sideOf[l];
        const lx = sd === 1 ? x + 22 : sd === 3 ? x - 22 : x, ly = sd === 0 ? y - 16 : sd === 2 ? y + 26 : y + 7;
        const g = s('g', { class: 'lb-letter' + (used.has(l) ? ' used' : '') + (cur[cur.length - 1] === l ? ' last' : ''), tabindex: '0', role: 'button', 'aria-label': l });
        g.append(s('circle', { cx: x, cy: y, r: 9 }));
        const t = s('text', { x: lx, y: ly, 'text-anchor': 'middle' }); t.textContent = l.toUpperCase();
        g.append(t, s('circle', { cx: x, cy: y, r: 26, class: 'lb-hit' }));
        g.addEventListener('pointerdown', (e) => { e.preventDefault(); onKey(l); });
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKey(l); } });
        kids.push(g);
      }
      svg.replaceChildren(...kids);
      put(wordLine, cur ? cur.toUpperCase() : h('span', { class: 'ph' }, 'Tap letters'));
      put(list, words.length ? words.map((w, i) => h('span', {}, w.toUpperCase(), i < words.length - 1 ? ' – ' : '')) : h('span', { class: 'ph' }, `Target: ${p.par} words or fewer`));
      const sol = p.solution.join(' ');
      hintChip.hidden = !hintN;
      if (hintN) {
        let k = 0;
        const shown = [...sol].map((ch) => (ch === ' ' ? '  ' : k++ < hintN ? ch.toUpperCase() : '_')).join(' ');
        put(hintChip, h('span', {}, 'Hint'), h('b', {}, shown));
      }
      const missing = letters.filter((l) => !words.join('').includes(l)).length;
      if (!done) status.textContent = missing ? `${missing} letter${missing > 1 ? 's' : ''} still unused` : '';
      if (!done && words.length && missing === 0) {
        done = true; svg.classList.add('solved');
        status.textContent = words.length <= p.par ? `Solved in ${words.length} words. Under target.` : `Solved in ${words.length} words.`;
        ctx.solved(`${words.length} word${words.length > 1 ? 's' : ''}`);
      }
      ctx.save({ words, cur, done, hintN });
    }
    render();
    if (done) svg.classList.add('solved');
    return {
      onKey,
      hint() {
        if (done) return false;
        const total = p.solution.join('').length;
        if (hintN >= total) { ctx.toast('The whole answer is showing'); return false; }
        hintN++;
        render();
        return 'One more letter of a two-word answer';
      },
      reveal() {
        words.splice(0, words.length, ...p.solution); cur = '';
        done = true; svg.classList.add('solved'); render(); status.textContent = `One answer: ${p.solution.join(' – ').toUpperCase()}`;
        ctx.save({ words, cur, done, hintN, revealed: true });
      },
    };
  },
};
