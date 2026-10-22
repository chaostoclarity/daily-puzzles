import { h, put } from '../lib/ui.js';
import { generateTrivia } from '../gen/trivia.js';

export default {
  id: 'trivia',
  name: 'Trivia',
  tagline: 'Ten questions, a new round every day',
  inspired: 'Daily trivia',
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
    const body = h('div', { class: 'trivia' });
    root.append(body);

    function render() {
      ctx.save({ picks, idx, done });
      const right = picks.filter((pk, i) => pk === questions[i].answer).length;
      if (done) {
        put(body, 
          h('div', { class: 'trivia-score' }, h('b', {}, `${right}/${questions.length}`), h('span', {}, right >= 8 ? 'Sharp.' : right >= 5 ? 'Solid round.' : 'Tough set.')),
          h('ol', { class: 'trivia-review' }, questions.map((q, i) => h('li', { class: picks[i] === q.answer ? 'ok' : 'no' },
            h('p', {}, q.q),
            h('p', { class: 'ans' }, picks[i] === q.answer ? `✓ ${q.answer}` : `✗ ${picks[i] ?? 'No answer'} · Answer: ${q.answer}`)))));
        return;
      }
      const q = questions[idx];
      const picked = picks[idx];
      put(body, 
        h('div', { class: 'trivia-top' },
          h('span', { class: 'trivia-count' }, `Question ${idx + 1} of ${questions.length}`),
          h('span', { class: 'trivia-cat' }, q.category)),
        h('div', { class: 'trivia-progress', 'aria-hidden': 'true' }, questions.map((qq, i) => h('i', { class: i < picks.length ? (picks[i] === qq.answer ? 'ok' : 'no') : i === idx ? 'cur' : '' }))),
        h('h2', { class: 'trivia-q' }, q.q),
        h('div', { class: 'trivia-choices' }, q.choices.map((c) => h('button', {
          class: 'choice' + (picked !== undefined ? (c === q.answer ? ' right' : c === picked ? ' wrong' : ' dim') : ''),
          type: 'button', disabled: picked !== undefined,
          onClick: () => { picks[idx] = c; render(); },
        }, c))),
        picked !== undefined ? h('button', {
          class: 'btn primary next', type: 'button',
          onClick: () => {
            if (idx < questions.length - 1) { idx++; render(); }
            else { done = true; render(); ctx.solved(`${right}/${questions.length}`); }
          },
        }, idx < questions.length - 1 ? 'Next' : 'See score') : null);
      const nb = body.querySelector('.next');
      if (nb) nb.focus({ preventScroll: true });
    }
    render();
    return {
      onKey(k) {
        if (done) return;
        const q = questions[idx];
        if (picks[idx] === undefined && /^[a-d]$/.test(k)) { const c = q.choices['abcd'.indexOf(k)]; if (c) { picks[idx] = c; render(); } }
      },
    };
  },
};
