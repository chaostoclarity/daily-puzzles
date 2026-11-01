import './trivia.css';
import { h, put } from '../lib/ui.js';
import { calm } from '../lib/celebrate.js';
import { generateTrivia } from '../gen/trivia.js';

export default {
  id: 'trivia',
  version: 2, // bump when the generator changes, so old saves don't load onto a new board
  name: 'Trivia',
  tagline: 'Ten questions, a new round every day',
  generate: generateTrivia,
  rules: [
    'Answer ten multiple-choice questions. Tap an answer to lock it in.',
    'You see right away whether you got it. Tap Next to keep going.',
    'Difficulty changes which questions you get, from household facts to deep cuts.',
    'Questions come from the Open Trivia Database (CC BY-SA 4.0).',
  ],
  mount(root, ctx) {
    const { questions } = ctx.puzzle;
    const saved = ctx.load();
    const picks = saved?.picks || [];
    let idx = saved?.idx ?? 0;
    let done = !!saved?.done;
    const cut = saved?.cut || {}; // question index -> wrong answers removed by hints
    const body = h('div', { class: 'trivia' });
    root.append(body);

    // one-shot motion cues for the next render
    let cue = { picked: false, next: false, cut: null, done: false };

    // the score ticks up from where it was
    function countTo(el, from, to, fmt) {
      if (calm() || from === to) { el.textContent = fmt(to); return; }
      const t0 = performance.now(), ms = Math.min(1100, 160 + Math.abs(to - from) * 90);
      el.textContent = fmt(from);
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms), e = 1 - (1 - t) ** 3;
        el.textContent = fmt(Math.round(from + (to - from) * e));
        if (t < 1 && el.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    const pips = (justAt = -1) => h('div', { class: 'trivia-progress', 'aria-hidden': 'true' }, questions.map((qq, i) => h('i', {
      class: (i < picks.length && picks[i] !== undefined ? (picks[i] === qq.answer ? 'ok' : 'no') : i === idx && !done ? 'cur' : '') + (i === justAt ? ' just' : ''),
      style: { '--i': i },
    })));

    function render() {
      ctx.save({ picks, idx, done, cut });
      const right = picks.filter((pk, i) => pk === questions[i].answer).length;
      const c = cue;
      cue = { picked: false, next: false, cut: null, done: false };
      if (done) {
        const num = h('b', {});
        countTo(num, c.done ? 0 : right, right, (v) => `${v}/${questions.length}`);
        put(body,
          h('div', { class: 'trivia-score' + (c.done ? ' reveal' : ''), 'aria-label': `${right} of ${questions.length} right` }, num, h('span', {}, right >= 8 ? 'Sharp.' : right >= 5 ? 'Solid round.' : 'Tough set.')),
          h('div', { class: 'trivia-final' + (c.done ? ' wave' : '') }, pips()),
          h('ol', { class: 'trivia-review' + (c.done ? ' reveal' : '') }, questions.map((q, i) => h('li', { class: picks[i] === q.answer ? 'ok' : 'no', style: { '--i': i } },
            h('p', {}, q.q),
            h('p', { class: 'ans' }, picks[i] === q.answer ? `✓ ${q.answer}` : `✗ ${picks[i] ?? 'No answer'} · Answer: ${q.answer}`)))));
        return;
      }
      const q = questions[idx];
      const picked = picks[idx];
      const shownRight = c.picked && picked === q.answer ? right - 1 : right;
      const scoreNum = h('b', {});
      countTo(scoreNum, shownRight, right, (v) => `${v}`);
      put(body,
        h('div', { class: 'trivia-top' },
          h('span', { class: 'trivia-count' }, h('b', {}, `${idx + 1}`), ` of ${questions.length}`),
          h('span', { class: 'trivia-cat' }, q.category),
          h('span', { class: 'trivia-tally' + (c.picked && picked === q.answer ? ' up' : ''), 'aria-label': `${right} right so far` }, h('i', { 'aria-hidden': 'true' }, '✓'), scoreNum)),
        pips(c.picked ? idx : -1),
        h('div', { class: 'trivia-card' + (c.next ? ' enter' : '') },
          h('h2', { class: 'trivia-q' }, q.q),
          h('div', { class: 'trivia-choices' + (picked !== undefined ? ' locked' : '') }, q.choices.map((ch, k) => {
            const isCut = (cut[idx] || []).includes(ch);
            const state = picked !== undefined ? (ch === q.answer ? 'right' : ch === picked ? 'wrong' : 'dim') : isCut ? 'cut' : '';
            // the pick flips over first; when it was wrong, the right answer flips a beat later
            const flip = c.picked && (state === 'right' || state === 'wrong') ? ` flip${state === 'right' && picked !== q.answer ? ' late' : ''}` : '';
            return h('button', {
              class: 'choice' + (state ? ` ${state}` : '') + flip + (c.cut === ch ? ' cutting' : ''),
              type: 'button', disabled: picked !== undefined || isCut, style: { '--k': k },
              'aria-label': ch + (state === 'right' ? ', correct answer' : state === 'wrong' ? ', your answer, wrong' : isCut ? ', removed by hint' : ''),
              onClick: () => { picks[idx] = ch; cue.picked = true; render(); },
            }, h('span', { class: 'ch-key', 'aria-hidden': 'true' }, 'ABCD'[k]), h('span', { class: 'ch-text' }, ch),
              state === 'right' ? h('span', { class: 'ch-mark', 'aria-hidden': 'true' }, '✓') : state === 'wrong' ? h('span', { class: 'ch-mark', 'aria-hidden': 'true' }, '✗') : null);
          }))),
        picked !== undefined ? h('button', {
          class: 'btn primary next' + (c.picked ? ' arrive' : ''), type: 'button',
          onClick: () => {
            if (idx < questions.length - 1) { idx++; cue.next = true; render(); }
            else { done = true; cue.done = true; render(); ctx.solved(`${right}/${questions.length}`, { value: right, higher: true, fmt: (v) => `${v}/${questions.length}` }); }
          },
        }, idx < questions.length - 1 ? 'Next' : 'See score') : null);
      const nb = body.querySelector('.next');
      if (nb) nb.focus({ preventScroll: true });
    }
    render();
    return {
      hint() {
        if (done || picks[idx] !== undefined) return false;
        const q = questions[idx];
        const gone = cut[idx] || [];
        const left = q.choices.filter((c) => c !== q.answer && !gone.includes(c));
        if (left.length <= 1) { ctx.toast('Down to two answers. Your call.'); return false; }
        const drop = left[Math.floor(Math.random() * left.length)];
        cut[idx] = [...gone, drop];
        cue.cut = drop;
        render();
        return 'Removed one wrong answer';
      },
      onKey(k) {
        if (done) return;
        const q = questions[idx];
        if (picks[idx] === undefined && /^[a-d]$/.test(k)) { const c = q.choices['abcd'.indexOf(k)]; if (c) { picks[idx] = c; cue.picked = true; render(); } }
      },
    };
  },
};
