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

// ---- compound words for Ladder ends: TOP + BOTTOM, both the same length ----
// Closed compounds from the word list (firework) and two-word dictionary entries (ice cream)
// whose halves are both common words of 4 or 5 letters.
const partOk = (w) => { const t = tier.get(w); return t && t <= 35 && !badWords.has(w) && !(w.endsWith('s') && !w.endsWith('ss')); };
const compoundIdx = new Map(); // lemma -> {pos, offsets, score}
for (const p of Object.keys(POS)) {
  for (const line of fs.readFileSync(path.join(dictDir, 'index.' + p), 'utf8').split('\n')) {
    if (!line || line.startsWith(' ')) continue;
    const parts = line.trim().split(' ');
    const lemma = parts[0];
    if (!/^[a-z]+(_[a-z]+)?$/.test(lemma)) continue;
    const synCnt = +parts[2], pCnt = +parts[3], tagged = +parts[5 + pCnt];
    const offsets = parts.slice(6 + pCnt, 6 + pCnt + synCnt);
    const cur = compoundIdx.get(lemma);
    const score = tagged + synCnt * 0.01;
    if (!cur || score > cur.score) compoundIdx.set(lemma, { pos: p, offsets, score });
  }
}
const SUFFIXES = new Set(['less', 'some', 'ness', 'ment', 'hood', 'ward', 'wise', 'able', 'ible', 'ling', 'ings', 'fully', 'ance', 'ence', 'tion', 'sion', 'ious', 'ship', 'ists', 'ment', 'ally', 'like', 'ates', 'ized', 'ised', 'ness', 'ency', 'ancy', 'tive', 'ture', 'sure', 'ered']);
const PREFIXES = new Set(['over', 'under', 'anti', 'semi', 'mini', 'auto', 'tele', 'post', 'mono', 'poly', 'super', 'inter', 'trans', 'micro']);

// Hand-picked compounds with hand-written clues, to widen the pool beyond the dictionary's entries.
const EXTRA_COMPOUNDS = [
  ['bath', 'room', 'Where the tub is'], ['book', 'case', 'Shelves for your library'], ['book', 'mark', 'It saves your page'],
  ['door', 'bell', 'It rings when a visitor arrives'], ['door', 'step', 'Spot just outside the front entrance'],
  ['down', 'town', 'City center'], ['fire', 'side', 'Cozy spot by the hearth'], ['fire', 'wood', 'Logs for the hearth'],
  ['fish', 'bowl', "Goldfish's glass home"], ['foot', 'note', 'Fine print at the bottom of a page'],
  ['foot', 'path', 'Trail for walkers'], ['foot', 'step', 'Sound of someone approaching'], ['gold', 'fish', 'Classic carnival prize pet'],
  ['hair', 'line', 'Where the forehead meets the scalp'], ['hand', 'book', 'Reference manual'], ['hand', 'rail', 'Something to hold on the stairs'],
  ['head', 'line', 'Top story of the day'], ['heat', 'wave', 'Stretch of scorching weather'], ['land', 'mark', 'Famous sight that helps you find your way'],
  ['life', 'boat', 'Craft for abandoning ship'], ['meat', 'ball', 'Spaghetti companion'], ['moon', 'beam', 'Ray of night light'],
  ['moon', 'walk', 'Backward-gliding dance move'], ['nose', 'dive', 'Sudden steep plunge'], ['post', 'card', 'Greetings from your vacation'],
  ['rain', 'coat', 'Wet-weather wear'], ['rain', 'fall', 'Total precipitation'], ['road', 'side', 'Edge of the highway'],
  ['road', 'work', 'Reason for a detour'], ['rose', 'bush', 'Thorny garden shrub'], ['ship', 'yard', 'Where vessels are built'],
  ['shoe', 'lace', 'It keeps your sneaker on'], ['side', 'walk', 'Pedestrian path along a street'], ['snow', 'fall', 'Winter accumulation'],
  ['snow', 'shoe', 'Wide footwear for deep drifts'], ['tail', 'gate', 'Pregame parking-lot party'], ['text', 'book', 'Required reading for a class'],
  ['tool', 'shed', 'Backyard storage hut'], ['type', 'face', 'Font family'], ['wind', 'mill', 'Dutch landmark with sails'],
  ['wing', 'span', 'Tip-to-tip measure of a bird'], ['work', 'load', 'Amount on your plate at the office'], ['yard', 'work', 'Raking and mowing'],
  ['back', 'yard', 'Space behind the house'], ['gate', 'post', 'Pillar that holds a hinge'], ['lamp', 'post', 'Streetlight pole'],
  ['sail', 'boat', 'Wind-powered vessel'], ['song', 'bird', 'Melodious backyard visitor'], ['wind', 'pipe', 'Trachea'],
  ['worm', 'hole', 'Sci-fi shortcut through space'], ['farm', 'land', 'Acres for crops'], ['farm', 'yard', 'Area around the barn'],
  ['fish', 'hook', 'Barbed bit on a line'], ['foot', 'ball', 'Game played on Sundays in the fall'], ['hand', 'ball', 'Court game played against a wall'],
  ['home', 'work', 'After-school assignment'], ['home', 'town', 'Where you grew up'], ['jail', 'bird', 'Habitual inmate'],
  ['play', 'mate', 'Childhood friend'], ['show', 'room', 'Where cars are displayed for sale'], ['ship', 'wreck', 'Sunken vessel'],
  ['soft', 'ball', 'Underhand-pitch diamond game'], ['team', 'mate', 'Fellow player'], ['time', 'line', 'Chronological chart'],
  ['book', 'shop', 'Store for readers'], ['blue', 'bird', 'Songbird symbolizing happiness'], ['fire', 'ball', 'Blazing sphere'],
  ['flag', 'pole', 'It flies the colors'], ['goal', 'post', 'Upright at the end of the field'], ['pawn', 'shop', 'Where you hock a watch'],
  ['rain', 'drop', 'Single bead of a shower'], ['wood', 'land', 'Forested area'], ['wood', 'pile', 'Stack of logs'],
  ['light', 'house', 'Coastal beacon tower'], ['stage', 'coach', 'Horse-drawn passenger vehicle of the Old West'],
  ['table', 'cloth', 'Cover for a dining surface'], ['wrist', 'watch', 'Timepiece on your arm'], ['grand', 'child', "Your kid's kid"],
  ['water', 'front', 'Harbor-side district'], ['sweat', 'shirt', 'Fleece pullover'], ['night', 'stand', 'Bedside table'],
  ['blood', 'hound', 'Tracking dog with a keen nose'], ['guest', 'house', 'Small lodging for visitors'], ['paint', 'brush', "Artist's tool"],
  ['round', 'house', 'Wide swinging punch'], ['short', 'bread', 'Buttery Scottish cookie'], ['story', 'board', 'Sketch sequence for planning a film'],
  ['thumb', 'print', 'Mark left by a digit'], ['touch', 'stone', 'Standard for judging quality'], ['water', 'melon', 'Big green-rinded summer fruit'],
  ['white', 'water', 'Foamy river rapids'], ['brain', 'child', 'Original idea someone came up with'], ['smoke', 'stack', 'Tall factory chimney'],
  ['white', 'board', 'Dry-erase surface'], ['glass', 'house', 'Place where people shouldn\'t throw stones'],
];

// words that split evenly into two real words but aren't compounds of them
const NOT_COMPOUNDS = new Set(['chaplain', 'coverage', 'delivery', 'scarcity', 'thousand', 'fourteen', 'nineteen', 'mustache',
  'cashmere', 'stoppage', 'mushroom', 'shamrock', 'pleating', 'somebody', 'database', 'leveraging']);
const compounds = [];
for (const [lemma, info] of compoundIdx) {
  let a, b, closed;
  if (info.pos !== 'noun') continue; // real compounds, not accidental splits like rest+rain
  if (lemma.includes('_')) continue; // closed compounds only (firework, not fire alarm)
  {
    if (lemma.length !== 8 && lemma.length !== 10) continue;
    const t = tier.get(lemma);
    if (!t || t > 35) continue;
    a = lemma.slice(0, lemma.length / 2); b = lemma.slice(lemma.length / 2); closed = true;
  }
  if (SUFFIXES.has(b) || PREFIXES.has(a) || lemma.endsWith('ing') || NOT_COMPOUNDS.has(lemma)) continue;
  if (a.length !== b.length || (a.length !== 4 && a.length !== 5) || a === b) continue;
  if (!partOk(a) || !partOk(b) || badWords.has(lemma)) continue;
  // gloss that doesn't give away either half
  let clue = null;
  for (const off of info.offsets.slice(0, 2)) {
    const { gloss } = readSynset(info.pos, off);
    let d = gloss.split(';')[0].replace(/"[^"]*"/g, '').split(':')[0].replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim().replace(/[,.]$/, '');
    if (d.length > 90) { const i = d.indexOf(', ', 20); if (i > 0 && i <= 90) d = d.slice(0, i); }
    const toks = d.toLowerCase().split(/[^a-z]+/);
    const leak = toks.some((t) => t.startsWith(a.slice(0, 3)) && t.length >= 3 || t.startsWith(b.slice(0, 3)) && t.length >= 3);
    if (d.length >= 8 && d.length <= 90 && !leak && !badText(d)) { clue = d[0].toUpperCase() + d.slice(1); break; }
  }
  if (!clue) continue;
  compounds.push([a, b, clue, closed ? 1 : 0]);
}
const haveCompound = new Set(compounds.map((c) => c[0] + c[1]));
for (const [a, b, clue] of EXTRA_COMPOUNDS) {
  if (haveCompound.has(a + b) || a.length !== b.length || !partOk(a) || !partOk(b)) continue;
  compounds.push([a, b, clue, 1]); haveCompound.add(a + b);
}
compounds.sort((x, y) => (x[0] + x[1]).localeCompare(y[0] + y[1]));
fs.writeFileSync(path.join(OUT, 'compounds.json'), JSON.stringify(compounds));
console.log('compounds', compounds.length, 'len4', compounds.filter((c) => c[0].length === 4).length, 'len5', compounds.filter((c) => c[0].length === 5).length);
