// Groups (Connections-style): sixteen words hide four groups of four.
// Groups come from dictionary categories (kinds of fish) and compound patterns (FIRE ___).
// Every word fits only its own group among the four on the board.
import { tier } from '../lib/words.js';
import { rotate } from '../lib/rng.js';

let categories = [];
export function initCategories(data) { categories = data; }
export const getCategories = () => categories;

const SETTINGS = {
  easy: { tier: 35, compound: [0, 0], first: true },
  medium: { tier: 40, compound: [1, 1], first: true },
  hard: { tier: 50, compound: [1, 2], first: false },
};

export const groupTitle = (c) => (c.k === 'kind' ? `Kinds of ${c.n}` : c.n);

export function generateGroups(rng, difficulty = 'medium') {
  const s = SETTINGS[difficulty] || SETTINGS.medium;
  const fullSet = categories.map((c) => new Set(c.w));
  const usable = (w) => (tier(w) ?? 99) <= s.tier && w.length <= 10;
  // Deal kinds and patterns as two decks so New puzzle rounds on the same day move on to
  // categories not used yet. Only categories with four usable words go in.
  const fits = (ci) => (s.first && categories[ci].f ? categories[ci].f : categories[ci].w).filter(usable).length >= 4;
  const keys = [...categories.keys()].filter(fits);
  const kinds = rng.deal(keys.filter((ci) => categories[ci].k === 'kind'), 5, 'k');
  const patterns = rng.deal(keys.filter((ci) => categories[ci].k !== 'kind'), 2, 'p');
  for (let attempt = 0; attempt < 200; attempt++) {
    const wantCompound = rng.range(s.compound[0], s.compound[1]);
    const picked = []; // { ci, words }
    // a failed attempt slides a little further along the decks rather than starting over
    const order = [...rotate(kinds, attempt * 2), ...rotate(patterns, attempt)];
    for (const ci of order) {
      if (picked.length === 4) break;
      const c = categories[ci];
      const compoundsSoFar = picked.filter((p) => categories[p.ci].k !== 'kind').length;
      if (c.k !== 'kind' && compoundsSoFar >= wantCompound) continue;
      if (c.k === 'kind' && picked.length - compoundsSoFar >= 4 - wantCompound) continue;
      if (picked.some((p) => categories[p.ci].n === c.n)) continue;
      const chosenWords = picked.flatMap((p) => p.words);
      // a candidate word must not belong to any other picked category, and earlier words must not belong to this one
      if (chosenWords.some((w) => fullSet[ci].has(w))) continue;
      const pool = (s.first && c.f ? c.f : c.w).filter((w) => usable(w) && !picked.some((p) => fullSet[p.ci].has(w)) && !chosenWords.includes(w));
      // skip near-duplicates like broil / broiling inside one group
      const four = [];
      for (const w of rng.shuffle(pool)) { if (four.length < 4 && !four.some((x) => x.slice(0, 4) === w.slice(0, 4))) four.push(w); }
      if (four.length < 4) continue;
      picked.push({ ci, words: four });
    }
    if (picked.length < 4) continue;
    // order by difficulty: common category words first, compound patterns last
    const score = (p) => (categories[p.ci].k === 'kind' ? 0 : 100) + p.words.reduce((a, w) => a + (tier(w) ?? 60), 0) / 4;
    picked.sort((a, b) => score(a) - score(b));
    const groups = picked.map((p, level) => ({ title: groupTitle(categories[p.ci]), words: p.words, level }));
    const words = rng.shuffle(groups.flatMap((g) => g.words));
    return { groups, words };
  }
  throw new Error('groups generation failed');
}
