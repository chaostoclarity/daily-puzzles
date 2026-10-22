// Builds the word and clue data the games use.
// Sources: SCOWL word lists (wordlist-english, MIT), WordNet 3.1 glosses (wordnet-db, WordNet license),
// LDNOOBW blocklist (naughty-words, CC BY 4.0). Run: npm run data
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const OUT = path.resolve('src/data');
fs.mkdirSync(OUT, { recursive: true });

// ---- blocklist ----
const extra = ['rape', 'raped', 'rapes', 'rapist', 'nazi', 'nazis', 'slut', 'sluts', 'whore', 'whores', 'porn', 'porno',
  'penis', 'vagina', 'boobs', 'boob', 'tits', 'titty', 'cunt', 'fuck', 'shit', 'piss', 'cock', 'dick', 'dicks', 'fag', 'fags',
  'dyke', 'homo', 'negro', 'nigga', 'spic', 'kike', 'chink', 'gook', 'wop', 'twat', 'wank', 'jizz', 'cum', 'orgasm', 'semen',
  'erotic', 'sexy', 'sex', 'sexual', 'nude', 'nudes', 'naked', 'horny', 'kinky', 'bdsm', 'anal', 'anus', 'butt', 'arse',
  'bitch', 'bastard', 'damn', 'hell', 'crap', 'suicide', 'incest', 'pedophile', 'molest', 'lynch', 'heroin', 'cocaine',
  'meth', 'opium', 'crack', 'bong', 'hooker', 'pimp', 'stripper', 'genital', 'genitals', 'testicle', 'scrotum', 'clitoris',
  'condom', 'puke', 'vomit', 'feces', 'urine', 'fart', 'turd', 'poop', 'semen', 'sperm', 'breast', 'nipple', 'nipples'];
const block = new Set([...require('naughty-words/en.json').filter(w => /^[a-z]+$/.test(w)), ...extra]);
const isBad = w => block.has(w) || [...block].some(b => b.length >= 4 && w.startsWith(b) && w.length - b.length <= 3);
const badText = t => t.toLowerCase().split(/[^a-z]+/).some(x => block.has(x));

// ---- word tiers ----
const LEVELS = [10, 20, 35, 40, 50, 55, 60];
const tier = new Map();
for (const l of LEVELS) {
  for (const set of ['english', 'american']) {
    for (const w of require(`wordlist-english/${set}-words-${l}.json`)) {
      if (!/^[a-z]{2,15}$/.test(w)) continue;
      if (!tier.has(w)) tier.set(w, l);
    }
  }
}
const badWords = new Set([...tier.keys()].filter(isBad));
const tiers = {};
for (const l of LEVELS) tiers[l] = [];
for (const [w, l] of tier) if (!badWords.has(w)) tiers[l].push(w);
for (const l of LEVELS) tiers[l].sort();
const wordsOut = {};
for (const l of LEVELS) wordsOut[l] = tiers[l].join(' ');
fs.writeFileSync(path.join(OUT, 'words.json'), JSON.stringify(wordsOut));

// ---- WordNet glosses ----
const dictDir = path.join(path.dirname(require.resolve('wordnet-db')), 'dict');
const POS = { noun: 'n', verb: 'v', adj: 'a', adv: 'r' };
const dataBuf = {};
for (const p of Object.keys(POS)) dataBuf[p] = fs.readFileSync(path.join(dictDir, 'data.' + p));
const best = new Map(); // word -> {pos, offset, tagged}
for (const p of Object.keys(POS)) {
  const lines = fs.readFileSync(path.join(dictDir, 'index.' + p), 'utf8').split('\n');
  for (const line of lines) {
    if (!line || line.startsWith(' ')) continue;
    const parts = line.trim().split(' ');
    const lemma = parts[0];
    if (!/^[a-z]{3,6}$/.test(lemma)) continue;
    const synCnt = +parts[2];
    const pCnt = +parts[3];
    const tagged = +parts[5 + pCnt];
    const offsets = parts.slice(6 + pCnt, 6 + pCnt + synCnt);
    const cur = best.get(lemma);
    const score = tagged + synCnt * 0.01;
    if (!cur || score > cur.score) best.set(lemma, { pos: p, offsets, score });
  }
}
function readSynset(pos, off) {
  const buf = dataBuf[pos];
  const start = +off;
  let end = buf.indexOf(10, start);
  const line = buf.slice(start, end).toString('utf8');
  const [head, gloss] = line.split(' | ');
  const hp = head.split(' ');
  const wcnt = parseInt(hp[3], 16);
  const lemmas = [];
  for (let i = 0; i < wcnt; i++) lemmas.push(hp[4 + i * 2].replace(/\(.*\)$/, '').toLowerCase());
  return { lemmas, gloss: gloss || '' };
}
const clues = {};
let n = 0;
for (const [w, info] of best) {
  const t = tier.get(w);
  if (!t || t > 50 || badWords.has(w)) continue;
  // try the first two senses for a clean gloss
  let def = null, syn = null;
  for (const off of info.offsets.slice(0, 2)) {
    const { lemmas, gloss } = readSynset(info.pos, off);
    let d = gloss.split(';')[0].replace(/"[^"]*"/g, '').split(':')[0];
    d = d.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim().replace(/[,.]$/, '');
    if (d.length > 80) {
      for (const sep of [', ', ' that ', ' which ', ' especially ', ' usually ', ' and ']) {
        const i = d.indexOf(sep, 15);
        if (i > 0 && i <= 80) { d = d.slice(0, i); break; }
      }
    }
    const stem = w.slice(0, Math.max(3, w.length - 2));
    const bad = !d || d.length < 6 || d.length > 80 || d.toLowerCase().split(/[^a-z]+/).some(t => t.startsWith(stem)) || badText(d);
    if (!def && !bad) def = d[0].toUpperCase() + d.slice(1);
    if (!syn) {
      const s = lemmas.find(x => x !== w && !x.includes('_') && /^[a-z]+$/.test(x) && !x.includes(stem) && !w.includes(x.slice(0, Math.max(3, x.length - 2))) && !isBad(x));
      if (s) syn = s[0].toUpperCase() + s.slice(1);
    }
    if (def) break;
  }
  if (!def) continue;
  clues[w] = syn ? [def, syn] : [def];
  n++;
}
fs.writeFileSync(path.join(OUT, 'clues.json'), JSON.stringify(clues));
const counts = Object.fromEntries(LEVELS.map(l => [l, tiers[l].length]));
console.log('words by tier', counts, 'blocked', badWords.size, 'clued', n);
