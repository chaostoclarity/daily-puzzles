import { h, put, shake, keyboard } from '../lib/ui.js';
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

    const phrase = h('div', { class: 'wb-phrase', 'aria-label': p.words.join(' ').toUpperCase() });
    const letterEls = [];
    let pos = 0;
    p.words.forEach((w, wi) => {
      const wordEl = h('div', { class: 'wb-word' });
      for (const ch of w) { const el = h('span', { class: 'wb-letter' }, ch.toUpperCase()); letterEls.push(el); wordEl.append(el); pos++; }
      phrase.append(wordEl);
    });
    const theme = h('p', { class: 'wb-theme' }, `Theme: ${p.theme}`);
    const entry = h('p', { class: 'wb-entry', 'aria-live': 'polite' });
    const goalsEl = h('div', { class: 'wb-goals' });
    const bar = h('div', { class: 'wb-bar' }, h('span'));
    const hintEl = h('p', { class: 'wb-hint' });
    const list = h('div', { class: 'wb-found' });
    const kb = keyboard(onKey);
    root.append(phrase, theme, entry, goalsEl, hintEl, bar, list, kb.el);

    const goalsMet = () => Object.entries(p.goals).every(([L, n]) => found.filter((w) => w.length === Number(L)).length >= n);

    function submit() {
      const w = cur;
      if (w.length < p.min) { ctx.toast(`Words need ${p.min}+ letters`); shake(entry); return; }
      if (found.includes(w)) { ctx.toast('Already found'); cur = ''; render(); return; }
      if (!bindable(w, p.src)) { ctx.toast('Not in order in the phrase'); shake(entry); return; }
      if (!p.all.includes(w)) { ctx.toast('Not in the word list'); shake(entry); return; }
      found.push(w);
      if (hintWord === w) { hintWord = null; hintShown = 0; }
      ctx.toast(w.toUpperCase());
      cur = '';
      if (!done && goalsMet()) { done = true; render(); ctx.solved(`${found.length} words`); return; }
      render();
    }

    function onKey(k) {
      if (k === 'enter') submit();
      else if (k === 'back') { cur = cur.slice(0, -1); render(); }
      else if (/^[a-z]$/.test(k) && cur.length < 14) { cur += k; render(); }
      return true;
    }

    function render() {
      const { path, ok } = pathOf(cur, p.src);
      letterEls.forEach((el, i) => { el.classList.toggle('on', path.includes(i)); el.classList.toggle('twice', path.filter((x) => x === i).length > 1); });
      put(entry, h('span', { class: cur && !ok ? 'bad' : '' }, cur.toUpperCase() || ' '));
      put(goalsEl, Object.entries(p.goals).map(([L, n]) => {
        const have = found.filter((w) => w.length === Number(L)).length;
        return h('div', { class: 'wb-goal' + (have >= n ? ' met' : '') },
          h('span', {}, `${L} letters`),
          h('span', { class: 'wb-dots' }, Array.from({ length: n }, (_, k) => h('i', { class: k < have ? 'on' : '' }))));
      }));
      const pct = Math.min(100, Math.round((found.length / p.bonus) * 100));
      bar.firstChild.style.width = pct + '%';
      bar.setAttribute('aria-label', `Bonus bar ${pct}%`);
      bar.classList.toggle('full', pct >= 100);
      put(hintEl, hintWord ? `Hint: ${[...hintWord].map((ch, k) => (k < hintShown ? ch.toUpperCase() : '_')).join(' ')}` : null);
      put(list, [...found].sort((a, b) => a.length - b.length || (a < b ? -1 : 1)).map((w) => h('span', { class: 'ts-chip' }, w.toUpperCase())));
      ctx.save({ found, hintWord, hintShown, done });
    }
    render();

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
    };
  },
};
