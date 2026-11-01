import './wordbind.css';
import { h, put, shake, keyboard, s as svgEl } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateWordbind, bindable } from '../gen/wordbind.js';

/** Which phrase positions a word uses, matching left to right (same rule as bindable). */
function pathOf(w, src) {
  const out = [];
  let i = 0, reuse = 0;
  for (let k = 0; k < w.length; k++) {
    const ch = w[k];
    if (k > 0 && src[i] === ch && reuse < 1 && w[k - 1] === ch) { reuse++; out.push(i); continue; }
    let j = k === 0 ? 0 : i + 1;
    while (j < src.length && src[j] !== ch) j++;
    if (j >= src.length) return { path: out, ok: false };
    i = j; reuse = 0; out.push(i);
  }
  return { path: out, ok: true };
}

export default {
  id: 'wordbind',
  name: 'Wordbund',
  tagline: 'Find words hidden in a phrase',
  version: 1,
  playsOn: true,
  generate: generateWordbind,
  rules: [
    'Spell words using the phrase\'s letters from left to right. You can skip letters.',
    'You may use the same letter twice in a row, so BALON spells BALLOON.',
    'Meet the goals for each word length to solve the puzzle. Then keep going to fill the bonus bar.',
    'A hint reveals one more letter of a word you still need.',
  ],
  mount(root, ctx) {
    const p = ctx.puzzle;
    const saved = ctx.load();
    const found = saved?.found || [];
    let hintWord = saved?.hintWord || null;
    let hintShown = saved?.hintShown || 0;
    let done = !!saved?.done;
    let cur = '';

    // The one bold thing: the phrase is a string of letter beads. As you type, a thread runs
    // behind the letters you use, in order, binding them into your word.
    const thread = svgEl('svg', { class: 'wb-thread', 'aria-hidden': 'true' });
    const phrase = h('div', { class: 'wb-phrase', 'aria-label': p.words.join(' ').toUpperCase() }, thread);
    const letterEls = [];
    let pos = 0;
    p.words.forEach((w) => {
      const wordEl = h('div', { class: 'wb-word' });
      for (const ch of w) { const el = h('span', { class: 'wb-letter', style: { '--i': pos } }, ch.toUpperCase()); letterEls.push(el); wordEl.append(el); pos++; }
      phrase.append(wordEl);
    });
    const theme = h('p', { class: 'wb-theme' }, `Theme: ${p.theme}`);
    const entry = h('p', { class: 'wb-entry', 'aria-live': 'polite' });
    const entryWrap = h('div', { class: 'wb-entry-wrap' }, entry);
    const goalsEl = h('div', { class: 'wb-goals' });
    const bar = h('div', { class: 'wb-bar' }, h('span'));
    const barWrap = h('div', { class: 'wb-barwrap' }, h('small', {}, 'Bonus'), bar);
    const hintEl = h('p', { class: 'wb-hint' });
    const list = h('div', { class: 'wb-found' });
    const kb = keyboard(onKey);
    root.append(phrase, theme, entryWrap, goalsEl, hintEl, barWrap, list, kb.el);

    const goalsMet = () => Object.entries(p.goals).every(([L, n]) => found.filter((w) => w.length === Number(L)).length >= n);
    const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    let lastAdded = null;
    let winNow = false;

    // the word just entered leaves the entry line: lifting away (good) or shaking off (bad)
    function release(kind) {
      const letters = [...entry.querySelectorAll('.lt')];
      if (letters.length && !calm()) {
        const ghost = h('p', { class: `wb-entry wb-ghost ${kind}`, 'aria-hidden': 'true' }, letters.map((el, i) => { el.classList.remove('in'); el.style.setProperty('--i', i); return el; }));
        entryWrap.append(ghost);
        setTimeout(() => ghost.remove(), 700);
      }
      // the thread flashes and lets go
      if (!calm() && thread.firstChild) {
        const t2 = thread.cloneNode(true);
        t2.classList.add('wb-thread-ghost', kind);
        phrase.append(t2);
        setTimeout(() => t2.remove(), 700);
        if (kind === 'good') pathOf(cur, p.src).path.forEach((i, k) => { const el = letterEls[i]; el.style.setProperty('--k', k); replay(el, 'bound'); });
      }
      entry.replaceChildren();
    }

    function submit() {
      const w = cur;
      if (w.length < p.min) { ctx.toast(`Words need ${p.min}+ letters`); shake(entry); return; }
      if (found.includes(w)) { ctx.toast('Already found'); release('bad'); cur = ''; render(); return; }
      if (!bindable(w, p.src)) { ctx.toast('Not in order in the phrase'); shake(entry); return; }
      if (!p.all.includes(w)) { ctx.toast('Not in the word list'); shake(entry); return; }
      release('good');
      found.push(w);
      lastAdded = w;
      if (hintWord === w) { hintWord = null; hintShown = 0; }
      ctx.toast(w.toUpperCase());
      cur = '';
      if (!done && goalsMet()) { done = true; winNow = true; render(); ctx.solved(`${found.length} words`); return; }
      render();
    }

    function onKey(k) {
      if (k === 'enter') submit();
      else if (k === 'back') { cur = cur.slice(0, -1); render(); }
      else if (/^[a-z]$/.test(k) && cur.length < 14) { cur += k; render(); }
      return true;
    }

    // the thread: one line through the centers of the letters used, behind the beads
    let shownPath = [];
    function drawThread(path) {
      const box = phrase.getBoundingClientRect();
      thread.setAttribute('viewBox', `0 0 ${box.width || 1} ${box.height || 1}`);
      if (path.length < 2) { thread.replaceChildren(); shownPath = path; return; }
      const pts = path.map((i) => { const r = letterEls[i].getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]; });
      // a letter used twice gets a little loop
      const d = (from, to) => pts.slice(from, to).map(([x, y], k, a) => {
        if (k === 0) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
        const [px, py] = a[k - 1];
        if (px === x && py === y) return `C${x - 14} ${y - 26} ${x + 14} ${y - 26} ${x.toFixed(1)} ${y.toFixed(1)}`;
        return `L${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ');
      const grew = path.length > shownPath.length && shownPath.every((v, k) => path[k] === v);
      const kids = [svgEl('path', { class: 'wb-thread-line', d: d(0, grew ? path.length - 1 : path.length) })];
      if (grew) kids.push(svgEl('path', { class: 'wb-thread-line tip', d: d(path.length - 2, path.length), pathLength: '1' }));
      thread.replaceChildren(...kids);
      shownPath = path;
    }

    let shownEntry = '';
    let prevHave = null, prevHint = 0;
    function render() {
      const { path, ok } = pathOf(cur, p.src);
      letterEls.forEach((el, i) => {
        const on = path.includes(i);
        if (on && !el.classList.contains('on')) replay(el, 'join');
        el.classList.toggle('on', on);
        el.classList.toggle('twice', path.filter((x) => x === i).length > 1);
      });
      phrase.classList.toggle('bad', !!cur && !ok);
      drawThread(path);
      // the entry line: typed letters drop in one at a time
      if (!cur) put(entry, h('span', { class: 'ph' }, done ? 'Keep going for the bonus bar' : 'Type a word'));
      else {
        const lts = [...entry.querySelectorAll('.lt')];
        if (!lts.length) entry.replaceChildren();
        let keep = 0;
        while (keep < lts.length && keep < cur.length && lts[keep].dataset.ch === cur[keep]) keep++;
        lts.slice(keep).forEach((el) => el.remove());
        for (const ch of cur.slice(keep)) entry.append(h('span', { class: 'lt in', 'data-ch': ch }, ch.toUpperCase()));
      }
      entry.classList.toggle('bad', !!cur && !ok);
      shownEntry = cur;

      // goals: a dot fills with a pop, a goal that's just been met stamps a check
      const have = {};
      put(goalsEl, Object.entries(p.goals).map(([L, n]) => {
        const got = found.filter((w) => w.length === Number(L)).length;
        have[L] = got;
        const was = prevHave ? prevHave[L] : got;
        return h('div', { class: 'wb-goal' + (got >= n ? ' met' : '') + (got >= n && was < n ? ' now' : ''), 'aria-label': `${L} letters: ${Math.min(got, n)} of ${n}` },
          h('span', {}, `${L} letters`),
          h('span', { class: 'wb-dots' }, Array.from({ length: n }, (_, k) => h('i', { class: (k < got ? 'on' : '') + (k < got && k >= was ? ' just' : '') }))),
          got >= n ? h('b', { class: 'wb-check', 'aria-hidden': 'true' }, '✓') : null);
      }));
      prevHave = have;
      const pct = Math.min(100, Math.round((found.length / p.bonus) * 100));
      bar.firstChild.style.width = pct + '%';
      bar.setAttribute('aria-label', `Bonus bar ${pct}%`);
      bar.classList.toggle('full', pct >= 100);
      // the hint: blanks, with the newest letter dropping in
      put(hintEl, hintWord ? [h('small', {}, 'Hint'), ...[...hintWord].map((ch, k) => h('span', { class: (k < hintShown ? 'on' : '') + (k === hintShown - 1 && hintShown > prevHint ? ' in' : '') }, k < hintShown ? ch.toUpperCase() : ''))] : null);
      hintEl.setAttribute('aria-label', hintWord ? `Hint: ${hintWord.slice(0, hintShown).toUpperCase()}, ${hintWord.length} letters` : '');
      prevHint = hintWord ? hintShown : 0;
      put(list, [...found].sort((a, b) => a.length - b.length || (a < b ? -1 : 1)).map((w) => h('span', { class: 'ts-chip wb-chip' + (w === lastAdded ? ' new' : '') }, w.toUpperCase())));
      lastAdded = null;
      // the win: a wave runs through the phrase
      if (winNow && !calm()) letterEls.forEach((el) => replay(el, 'wave'));
      winNow = false;
      ctx.save({ found, hintWord, hintShown, done });
    }
    render();
    // the thread is drawn in pixels, so redraw it when the phrase reflows
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => drawThread(shownPath)) : null;
    ro?.observe(phrase);

    return {
      onKey,
      hint() {
        // reveal one more letter of a common word for an unmet goal (or any unfound word after)
        if (!hintWord || hintShown >= hintWord.length) {
          const need = Object.entries(p.goals).filter(([L, n]) => found.filter((w) => w.length === Number(L)).length < n).map(([L]) => Number(L));
          const pool = p.common.filter((w) => !found.includes(w) && (!need.length || need.includes(w.length)));
          hintWord = pool[0] || p.all.find((w) => !found.includes(w)) || null;
          hintShown = 0;
          if (!hintWord) return false;
        }
        hintShown++;
        if (hintShown >= hintWord.length) {
          // the last letter gives the word away, so it counts
          const w = hintWord;
          found.push(w); hintWord = null; hintShown = 0; lastAdded = w;
          if (!done && goalsMet()) { done = true; winNow = true; render(); ctx.solved(`${found.length} words`); return `Found ${w.toUpperCase()}`; }
          render();
          return `Found ${w.toUpperCase()}`;
        }
        render();
        return `${hintWord.length}-letter word: ${hintWord.slice(0, hintShown).toUpperCase()}…`;
      },
      reveal() {
        for (const [L, n] of Object.entries(p.goals)) {
          const need = n - found.filter((w) => w.length === Number(L)).length;
          p.common.filter((w) => w.length === Number(L) && !found.includes(w)).slice(0, Math.max(0, need)).forEach((w) => found.push(w));
        }
        done = true; render();
      },
      destroy() { ro?.disconnect(); },
    };
  },
};
