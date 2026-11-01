import { h, put } from '../lib/ui.js';
import { calm, centerOf } from '../lib/celebrate.js';
import { generateHive, hivePoints, hiveIsPangram, hiveKnownWord, RANKS, rankFor } from '../gen/hive.js';

export default {
  id: 'hive',
  name: 'Spilling Bee',
  tagline: 'Make words from seven letters',
  generate: generateHive,
  confetti: 'hex',
  playsOn: true, // Genius counts as solved, but words, hints and answers keep going to Queen Bee
  noTimer: true, // like the original, there's no clock: it's about points, not speed
  rules: [
    'Make words of four or more letters from the seven in the hive. Letters can repeat.',
    'Every word must use the center letter.',
    'Four-letter words score 1 point. Longer words score 1 point per letter.',
    'A word that uses all seven letters is a pangram and earns 7 bonus points.',
    'Climb the ranks from Beginner to Genius (70% of the day\'s points). Find every word for Queen Bee.',
    'There\'s no clock. Your best points for each level are your record. Harder levels accept a bigger dictionary.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const saved = ctx.load();
    const found = saved?.found || [];
    let outer = p.outer.slice();
    let cur = '';
    let revealed = !!saved?.revealed;
    let hintWord = saved?.hintWord || null; // { w, n } a word being revealed letter by letter
    const answerSet = new Set(p.words);
    const geniusAt = Math.ceil(0.7 * p.max);
    let done = (saved?.found || []).reduce((a, w) => a + hivePoints(w), 0) >= geniusAt;

    const input = h('div', { class: 'hive-input' });
    const said = h('p', { class: 'sr-only', 'aria-live': 'polite' }); // spoken feedback for screen readers
    const inputWrap = h('div', { class: 'hive-input-wrap' }, input);
    const hex = h('div', { class: 'hive', role: 'group', 'aria-label': 'Letters' });
    const meter = h('div', { class: 'hive-meter' });
    const list = h('div', { class: 'hive-found' });
    const hints = h('details', { class: 'hive-hints' });
    const hintChip = h('div', { class: 'hive-hintword', 'aria-live': 'polite' });
    root.append(meter, hintChip, inputWrap, hex,
      h('div', { class: 'row-actions' },
        // each drops focus after a tap so a later Enter key submits the word instead of pressing it again
        h('button', { class: 'btn', type: 'button', onClick: (e) => { e.currentTarget.blur(); onKey('back'); } }, 'Delete'),
        h('button', { class: 'btn', type: 'button', 'aria-label': 'Shuffle letters', onClick: (e) => { e.currentTarget.blur(); shuffleHex(); } }, 'Shuffle'),
        h('button', { class: 'btn primary', type: 'button', onClick: (e) => { e.currentTarget.blur(); onKey('enter'); } }, 'Enter')),
      list, hints, said);

    function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

    // ----- the comb: seven wax cells, built once and moved around -----
    const CELL = '26.5,3 73.5,3 97,43.3 73.5,83.6 26.5,83.6 3,43.3';
    const cellSvg = () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 86.6');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = `<polygon class="hx-wall" points="${CELL}"/><polygon class="hx-wax" points="${CELL}" transform="translate(50 43.3) scale(0.8) translate(-50 -43.3)"/>`;
      return svg;
    };
    const cells = new Map(); // letter -> { el, slot, angle }
    function makeCell(l, k) {
      const el = h('button', {
        class: 'hex' + (k < 0 ? ' center' : ''), type: 'button', 'aria-label': l.toUpperCase(),
        onPointerdown: (e) => { e.preventDefault(); onKey(l); },
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKey(l); } },
      }, h('span', { class: 'hex-in' }, cellSvg(), h('b', {}, l.toUpperCase())));
      cells.set(l, { el, slot: k, angle: k * 60 });
      if (k >= 0) { el.style.setProperty('--a', `${k * 60}deg`); el.style.setProperty('--k', k + 1); } else el.style.setProperty('--k', 0);
      return el;
    }
    put(hex, makeCell(p.center, -1), ...outer.map((l, k) => makeCell(l, k)));

    // shuffle: every outer cell orbits clockwise to its new slot
    function shuffleHex() {
      outer = shuffle(outer);
      comb('shuffling', 700);
      outer.forEach((l, k) => {
        const c = cells.get(l);
        let turn = (((k - c.slot) % 6) + 6) % 6;
        if (turn === 0) turn = 6;
        c.slot = k; c.angle += turn * 60;
        c.el.style.transitionDelay = `${k * 25}ms`;
        c.el.style.setProperty('--a', `${c.angle}deg`);
      });
    }

    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    const press = (l) => { const c = cells.get(l); if (c) replay(c.el, 'press'); };
    // a pass of motion across the whole comb (spin for a pangram, bloom for Genius), then cleared
    function comb(cls, ms) { replay(hex, cls); setTimeout(() => hex.classList.remove(cls), ms); }

    const score = () => found.reduce((a, w) => a + hivePoints(w), 0);
    const pointsFmt = (v) => `${v} pts`;
    // Genius solves the puzzle; your points are the record, updated with every word
    function progress() {
      const sc = score();
      if (!done && sc >= geniusAt) { done = true; comb('bloom', 1200); ctx.solved(`Genius · ${sc} points`, { value: sc, higher: true, fmt: pointsFmt }); return; }
      if (done) ctx.best?.({ value: sc, higher: true, fmt: pointsFmt }); // points after Genius still raise the record
      if (found.length === p.words.length) {
        comb('bloom', 1200);
        ctx.celebrate?.({ count: 2.2, origin: centerOf(hex) });
        ctx.toast('Queen Bee! Every word found');
      }
    }

    function onKey(k) {
      if (revealed) return;
      if (k === 'back') cur = cur.slice(0, -1);
      else if (k === 'enter') return submit();
      else if (k === 'space') { shuffleHex(); return; }
      else if (k.length === 1) {
        if (cur.length >= 19) return;
        cur += k;
        press(k);
        const span = renderInput();
        if (span && cells.has(k)) fly(cells.get(k).el, span, k);
        return;
      }
      else return;
      renderInput();
    }

    // a tapped letter lifts off its cell and drops into the word
    function fly(from, to, l) {
      if (calm() || !from.animate) return;
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      if (!b.width) return;
      to.classList.add('landing');
      const ghost = h('span', { class: 'hive-fly' + (l === p.center ? ' c' : '') }, l.toUpperCase());
      document.body.append(ghost);
      const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
      const anim = ghost.animate([
        { transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) scale(1.1)`, opacity: 0.9 },
        { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 26}px) translate(-50%, -50%) scale(1.15)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${x1}px, ${y1}px) translate(-50%, -50%) scale(1)`, opacity: 1 },
      ], { duration: 230, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' });
      const end = () => { ghost.remove(); to.classList.remove('landing'); };
      anim.onfinish = end; anim.oncancel = end;
    }

    // the word just entered leaves the input as a ghost: lifting away (good) or shaking off (bad)
    function release(kind, text) {
      const letters = [...input.querySelectorAll('.lt')];
      if (!letters.length || calm()) { input.replaceChildren(); return; }
      const ghost = h('div', { class: `hive-input hive-ghost ${kind}` }, letters.map((el, i) => { el.className = el.className.replace(/\b(in|landing)\b/g, ''); el.style.setProperty('--i', i); return el; }));
      inputWrap.append(ghost);
      if (text) inputWrap.append(h('span', { class: 'hive-bubble' + (kind === 'pangram' ? ' big' : ''), onAnimationend: (e) => e.currentTarget.remove() }, text));
      setTimeout(() => ghost.remove(), 700);
      input.replaceChildren();
    }

    function submit() {
      const w = cur;
      const fail = (msg) => { ctx.toast(msg); said.textContent = msg; release('bad'); cur = ''; renderInput(); };
      if (!w) return;
      if (w.length < 4) return fail('Too short');
      if (![...w].every((ch) => ch === p.center || outer.includes(ch))) return fail('Uses a letter outside the hive');
      if (!w.includes(p.center)) return fail('Missing the center letter');
      if (found.includes(w)) return fail('Already found');
      if (!answerSet.has(w)) return fail(hiveKnownWord(w) ? 'Too obscure for this level' : 'Not in the word list');
      found.push(w);
      lastAdded = w;
      const pts = hivePoints(w);
      const pg = hiveIsPangram(w);
      said.textContent = `${w}, ${pg ? 'pangram, ' : ''}${pts} point${pts === 1 ? '' : 's'}`;
      release(pg ? 'pangram' : 'good', pg ? `Pangram! +${pts}` : `+${pts}`);
      cur = '';
      replay(hex, 'glow');
      if (pg) { comb('spin', 1100); if (score() < geniusAt) ctx.celebrate?.({ cannons: false, count: 0.8, origin: centerOf(hex) }); }
      progress();
      render();
    }

    // the word being typed: letters are added and removed one at a time so each can animate in
    const letterCls = (ch) => 'lt' + (ch === p.center ? ' c' : !outer.includes(ch) ? ' bad' : '');
    function renderInput() {
      const shown = [...input.querySelectorAll('.lt')];
      const have = shown.map((el) => el.dataset.ch).join('');
      if (!cur) { if (!input.querySelector('.ph')) put(input, h('span', { class: 'ph' }, 'Type or tap')); return null; }
      if (cur === have) return null;
      if (cur.startsWith(have)) {
        if (!have) input.replaceChildren();
        let last = null;
        for (const ch of cur.slice(have.length)) { last = h('span', { class: letterCls(ch) + ' in', 'data-ch': ch }, ch.toUpperCase()); input.append(last); }
        return last;
      }
      if (have.startsWith(cur)) { shown.slice(cur.length).forEach((el) => el.remove()); return null; }
      put(input, [...cur].map((ch) => h('span', { class: letterCls(ch), 'data-ch': ch }, ch.toUpperCase())));
      return null;
    }

    let lastAdded = null, shownRank = null, shownScore = null;
    // rank stops sit evenly along the bar, as in the original; the fill moves between them by points
    const stops = RANKS.map(([, f]) => Math.ceil(f * p.max));
    function fillAt(sc) {
      let j = 0;
      while (j < stops.length - 1 && sc >= stops[j + 1]) j++;
      if (j >= stops.length - 1) return 100;
      const part = (sc - stops[j]) / Math.max(1, stops[j + 1] - stops[j]);
      return ((j + part) / (stops.length - 1)) * 100;
    }
    // points tick up rather than jump
    function countTo(el, from, to) {
      const label = (v) => `${v} point${v === 1 ? '' : 's'}`;
      if (calm() || from == null || from === to) { el.textContent = label(to); return; }
      const t0 = performance.now(), ms = 420;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms), e = 1 - (1 - t) ** 3;
        el.textContent = label(Math.round(from + (to - from) * e));
        if (t < 1 && el.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    function render() {
      const sc = score();
      const rank = rankFor(sc, p.max);
      const rankUp = shownRank !== null && rank !== shownRank;
      const pts = h('span', {});
      const prevFill = shownScore == null ? null : fillAt(shownScore);
      countTo(pts, shownScore, sc);
      if (rankUp) { ctx.toast(`New rank: ${rank}`); said.textContent += `. New rank: ${rank}`; }
      put(meter, 
        h('div', { class: 'hive-rank' }, h('b', { class: rankUp ? 'up' : '' }, rank), pts),
        h('div', { class: 'hive-track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': p.max, 'aria-valuenow': sc, 'aria-label': 'Score' },
          RANKS.map(([name, f], i) => {
            const at = Math.ceil(f * p.max);
            return h('i', { class: (sc >= at ? 'on' : '') + (shownScore != null && shownScore < at && sc >= at ? ' just' : '') + (f === 0.7 ? ' genius' : ''), title: `${name}: ${at}`, style: { left: `${(i / (RANKS.length - 1)) * 100}%` } });
          }),
          h('div', { class: 'hive-fill', style: { width: `${prevFill ?? fillAt(sc)}%` } })),
        h('div', { class: 'hive-next' }, sc >= p.max ? 'Queen Bee: every word found.' : sc >= geniusAt ? `Genius! ${p.max - sc} more points for Queen Bee · ${found.length} of ${p.words.length} words` : `${geniusAt - sc} points to Genius · ${found.length} of ${p.words.length} words`));
      // the bar grows from where it was
      const fill = meter.querySelector('.hive-fill');
      if (prevFill != null) requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = `${fillAt(sc)}%`; }));
      shownRank = rank; shownScore = sc;
      const shown = revealed ? p.words : found.slice().sort();
      put(list, 
        h('h3', {}, revealed ? `All ${p.words.length} words` : `Found ${found.length}`),
        h('ul', {}, shown.map((w) => h('li', { class: (hiveIsPangram(w) ? 'pg ' : '') + (revealed && !found.includes(w) ? 'missed ' : '') + (w === lastAdded ? 'new' : '') }, w))));
      lastAdded = null;
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
    render();
    return {
      onKey,
      hint() {
        if (revealed) return false;
        if (!hintWord) {
          const left = p.words.filter((w) => !found.includes(w));
          if (!left.length) return false;
          // shortest words first
          left.sort((a, b) => a.length - b.length || a.localeCompare(b));
          hintWord = { w: left[0], n: 1 };
        } else hintWord.n++;
        if (hintWord.n >= hintWord.w.length) {
          const w = hintWord.w;
          hintWord = null;
          found.push(w);
          lastAdded = w;
          replay(hex, 'glow');
          progress();
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
