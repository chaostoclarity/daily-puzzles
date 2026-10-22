// Trivia: ten multiple-choice questions per round, picked from the bundled question bank.
let bank = [];
export function initTrivia(data) { bank = data; }

const ROUND = 10;

export function generateTrivia(rng, difficulty = 'medium') {
  const pool = bank.filter((q) => q.d === difficulty);
  const src = pool.length >= ROUND ? pool : bank;
  // spread across categories: deal, then take at most 2 per category on the first pass.
  // Dealing keeps New puzzle rounds on the same day from repeating questions.
  const shuffled = rng.deal(src, 14, 'q');
  const per = {};
  const picked = [];
  for (const q of shuffled) {
    if (picked.length >= ROUND) break;
    if ((per[q.c] || 0) >= 2) continue;
    per[q.c] = (per[q.c] || 0) + 1;
    picked.push(q);
  }
  for (const q of shuffled) { if (picked.length >= ROUND) break; if (!picked.includes(q)) picked.push(q); }
  return {
    questions: picked.map((q) => ({ q: q.q, category: q.c, answer: q.a, choices: rng.shuffle([q.a, ...q.w]) })),
  };
}
