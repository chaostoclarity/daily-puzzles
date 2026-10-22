import { h, put, shake } from '../lib/ui.js';
import { generateHive, hivePoints, hiveIsPangram, hiveKnownWord, RANKS, rankFor } from '../gen/hive.js';

export default {
  id: 'hive',
  name: 'Hive',
  tagline: 'Make words from seven letters',
  inspired: 'Spelling Bee',
  generate: generateHive,
  rules: [
    'Make words of four or more letters from the seven in the hive. Letters can repeat.',
    'Every word must use the center letter.',
    'Four-letter words score 1 point. Longer words score 1 point per letter.',
    'A word that uses all seven letters is a pangram and earns 7 bonus points.',
    'Reach Genius to count the puzzle as solved. Harder levels accept a bigger dictionary.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const saved = ctx.load();
    const found = saved?.found || [];
    let outer = p.outer.slice();
    let cur = '';
    let done = !!saved?.done;
    let revealed = !!saved?.revealed;
    let hintWord = saved?.hintWord || null; // { w, n } a word being revealed letter by letter
    const answerSet = new Set(p.words);
    const geniusAt = Math.ceil(0.7 * p.max);

    const input = h('div', { class: 'hive-input', 'aria-live': 'polite' });
    const hex = h('div', { class: 'hive', role: 'group', 'aria-label': 'Letters' });
    const meter = h('div', { class: 'hive-meter' });
    const list = h('div', { class: 'hive-found' });
    const hints = h('details', { class: 'hive-hints' });
    const hintChip = h('div', { class: 'hive-hintword', 'aria-live': 'polite' });
    root.append(meter, hintChip, input, hex,
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn', type: 'button', onClick: () => onKey('back') }, 'Delete'),
        h('button', { class: 'btn', type: 'button', 'aria-label': 'Shuffle letters', onClick: () => { outer = shuffle(outer); drawHex(); } }, 'Shuffle'),
        h('button', { class: 'btn primary', type: 'button', onClick: () => onKey('enter') }, 'Enter')),
      list, hints);

    function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

    function drawHex() {
      const letters = [p.center, ...outer];
      put(hex, ...letters.map((l, i) => h('button', {
        class: 'hex' + (i === 0 ? ' center' : ''), type: 'button', 'aria-label': l,
        style: i === 0 ? {} : { '--x': Math.cos(((i - 1) * 60 - 90) * Math.PI / 180).toFixed(3), '--y': Math.sin(((i - 1) * 60 - 90) * Math.PI / 180).toFixed(3) },
        onPointerdown: (e) => { e.preventDefault(); onKey(l); },
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKey(l); } },
      }, h('span', {}, l.toUpperCase()))));
    }

    const score = () => found.reduce((a, w) => a + hivePoints(w), 0);

    function onKey(k) {
      if (revealed) return;
      if (k === 'back') cur = cur.slice(0, -1);
      else if (k === 'enter') return submit();
      else if (k === 'space') { outer = shuffle(outer); drawHex(); return; }
      else if (k.length === 1) { if (cur.length < 19) cur += k; }
      else return;
      renderInput();
    }

    function submit() {
      const w = cur;
      const fail = (msg) => { ctx.toast(msg); shake(input); cur = ''; renderInput(); };
      if (!w) return;
      if (w.length < 4) return fail('Too short');
      if (![...w].every((ch) => ch === p.center || outer.includes(ch))) return fail('Uses a letter outside the hive');
      if (!w.includes(p.center)) return fail('Missing the center letter');
      if (found.includes(w)) return fail('Already found');
      if (!answerSet.has(w)) return fail(hiveKnownWord(w) ? 'Too obscure for this level' : 'Not in the word list');
      found.push(w);
      cur = '';
      const pts = hivePoints(w);
      ctx.toast(hiveIsPangram(w) ? `Pangram! +${pts}` : `+${pts}`);
      if (!done && score() >= geniusAt) { done = true; ctx.solved(); }
      render();
    }

    function renderInput() {
      put(input, ...(cur ? [...cur].map((ch) => h('span', { class: ch === p.center ? 'c' : !(outer.includes(ch)) ? 'bad' : '' }, ch.toUpperCase())) : [h('span', { class: 'ph' }, 'Type or tap')]));
    }

    function render() {
      const sc = score();
      const rank = rankFor(sc, p.max);
      put(meter, 
        h('div', { class: 'hive-rank' }, h('b', {}, rank), h('span', {}, `${sc} points`)),
        h('div', { class: 'hive-track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': p.max, 'aria-valuenow': sc, 'aria-label': 'Score' },
          RANKS.map(([name, f]) => h('i', { class: sc >= Math.ceil(f * p.max) ? 'on' : '', title: `${name}: ${Math.ceil(f * p.max)}`, style: { left: `${f * 100}%` } })),
          h('div', { class: 'hive-fill', style: { width: `${Math.min(100, (sc / p.max) * 100)}%` } })),
        h('div', { class: 'hive-next' }, sc >= p.max ? 'Every word found.' : `Genius at ${geniusAt} · ${found.length} of ${p.words.length} words`));
      const shown = revealed ? p.words : found.slice().sort();
      put(list, 
        h('h3', {}, revealed ? `All ${p.words.length} words` : `Found ${found.length}`),
        h('ul', {}, shown.map((w) => h('li', { class: (hiveIsPangram(w) ? 'pg ' : '') + (revealed && !found.includes(w) ? 'missed' : '') }, w))));
      // hint grid: words left by first two letters
      const left = p.words.filter((w) => !found.includes(w));
      const byTwo = {};
      for (const w of left) byTwo[w.slice(0, 2)] = (byTwo[w.slice(0, 2)] || 0) + 1;
      const pangramsLeft = left.filter(hiveIsPangram).length;
      put(hints, h('summary', {}, 'Hints'),
        h('p', {}, `${left.length} words left, ${pangramsLeft} pangram${pangramsLeft === 1 ? '' : 's'} left.`),
        h('div', { class: 'hive-two' }, Object.keys(byTwo).sort().map((k) => h('span', {}, h('b', {}, k.toUpperCase()), ` ${byTwo[k]}`))));
      renderInput();
      if (hintWord && found.includes(hintWord.w)) hintWord = null;
      hintChip.hidden = !hintWord;
      if (hintWord) put(hintChip, h('span', {}, 'Hint'), h('b', {}, [...hintWord.w].map((ch, i) => (i < hintWord.n ? ch.toUpperCase() : '_')).join(' ')));
      ctx.save({ found, done, revealed, hintWord });
    }
    drawHex();
    render();
    return {
      onKey,
      hint() {
        if (revealed) return false;
        if (!hintWord) {
          const left = p.words.filter((w) => !found.includes(w));
          if (!left.length) return false;
          // shortest words first: cheapest to finish
          left.sort((a, b) => a.length - b.length || a.localeCompare(b));
          hintWord = { w: left[0], n: 1 };
        } else hintWord.n++;
        if (hintWord.n >= hintWord.w.length) {
          const w = hintWord.w;
          hintWord = null;
          found.push(w);
          if (!done && score() >= geniusAt) { done = true; ctx.solved(); }
          render();
          return `Added ${w.toUpperCase()}`;
        }
        render();
        return `Next letter of a ${hintWord.w.length}-letter word`;
      },
      reveal() { revealed = true; render(); },
    };
  },
};
