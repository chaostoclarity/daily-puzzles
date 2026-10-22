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
    if (!/^[a-z]{3,7}$/.test(lemma)) continue;
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

// ---- categories for Groups and Threads ----
// Each WordNet noun category ("fish", "tree", "fruit") with the common one-word names under it.
// A word counts only when this is one of its two main senses, so "cat" doesn't land under "whip".
const LEX_OK = new Set(['04', '05', '06', '08', '13', '17', '18', '20', '27', '28']);
const nounBuf = dataBuf.noun;
const syn = new Map(); // offset -> { lex, lemmas, hypo: [offsets], gloss }
{
  const text = nounBuf.toString('utf8');
  for (const line of text.split('\n')) {
    if (!line || line.startsWith(' ')) continue;
    const [head, gloss] = line.split(' | ');
    const f = head.split(' ');
    const off = f[0], lex = f[1];
    const wcnt = parseInt(f[3], 16);
    const lemmas = [];
    for (let i = 0; i < wcnt; i++) lemmas.push(f[4 + i * 2].replace(/\(.*\)$/, ''));
    let k = 4 + wcnt * 2;
    const pcnt = +f[k]; k++;
    const hypo = [];
    for (let i = 0; i < pcnt; i++) {
      const sym = f[k], o = f[k + 1], pos = f[k + 2];
      if (sym === '~' && pos === 'n') hypo.push(o);
      k += 4;
    }
    syn.set(off, { lex, lemmas, hypo, gloss: (gloss || '').split(';')[0].replace(/"[^"]*"/g, '').trim() });
  }
}
// main senses of each noun lemma (first two offsets in index order)
const mainSense = new Map();
const firstSense = new Map();
for (const line of fs.readFileSync(path.join(dictDir, 'index.noun'), 'utf8').split('\n')) {
  if (!line || line.startsWith(' ')) continue;
  const parts = line.trim().split(' ');
  const synCnt = +parts[2], pCnt = +parts[3];
  const offs = parts.slice(6 + pCnt, 6 + pCnt + synCnt);
  mainSense.set(parts[0], new Set(offs.slice(0, 2)));
  firstSense.set(parts[0], offs[0]);
}
const memberOk = (w, off) => /^[a-z]{3,9}$/.test(w) && (tier.get(w) ?? 99) <= 50 && !badWords.has(w)
  && !(w.endsWith('s') && !w.endsWith('ss')) && mainSense.get(w)?.has(off);
// everyday, family-friendly categories with recognizable members
const ALLOW = new Set(['game', 'field game', 'card game', 'sport', 'contact sport', 'water sport', 'dancing', 'cooking', 'cleaning',
  'celebration', 'singing', 'tennis stroke', 'golf stroke', 'swimming', 'exercise', 'domestic animal', 'bird', 'wading bird', 'dog',
  'hunting dog', 'cat', 'big cat', 'insect', 'horse', 'cattle', 'fish', 'food fish', 'aircraft', 'bag', 'bed', 'boat', 'bottle', 'box',
  'bridge', 'car', 'coat', 'cutting implement', 'edge tool', 'farm machine', 'furniture', 'game equipment', 'glass', 'hand tool', 'house',
  'lamp', 'motor vehicle', 'musical instrument', 'paint', 'path', 'picture', 'pipe', 'playing card', 'public transport', 'road', 'ship',
  'shoe', 'shop', 'small boat', 'sports equipment', 'table', 'tool', 'tower', 'trap', 'truck', 'vehicle', 'wheel', 'white goods',
  'wind instrument', 'writing implement', 'hair', 'bone', 'tooth', 'organ', 'internal organ', 'sense organ', 'limb', 'joint', 'dish',
  'meal', 'baked goods', 'meat', 'bread', 'sandwich', 'produce', 'vegetable', 'root vegetable', 'snack food', 'beer', 'wine', 'liquor',
  'mixed drink', 'hill', 'lake', 'stream', 'valley', 'imaginary being', 'fairy', 'actor', 'artist', 'doctor', 'musician', 'scientist',
  'singer', 'soldier', 'teacher', 'writer', 'relative', 'parent', 'flower', 'grass', 'fruit tree', 'fruit', 'seed', 'nut', 'rock', 'fur',
  'leather', 'building material', 'soil', 'fiber', 'natural fiber', 'fuel', 'gas', 'liquid', 'oil', 'paper', 'coloring material', 'salt',
  'wood', 'chemical element', 'time unit', 'day', 'calendar day', 'snake', 'pastry', 'waterfowl', 'condiment', 'place of worship',
  'plaything', 'cheese', 'dessert', 'cake', 'cookie', 'candy', 'sauce', 'soup', 'pasta', 'herb', 'spice', 'tree', 'shrub', 'reptile',
  'rodent', 'mammal', 'primate', 'shellfish', 'crustacean', 'mollusk', 'songbird', 'bird of prey', 'parrot', 'duck', 'monkey', 'ape',
  'whale', 'shark', 'beetle', 'butterfly', 'spider', 'garment', 'hat', 'jacket', 'skirt', 'trouser', 'footwear', 'jewelry', 'fabric',
  'color', 'shade', 'gem', 'metal', 'weather', 'storm', 'wind', 'cloud', 'month', 'planet', 'constellation', 'instrument', 'percussion instrument',
  'stringed instrument', 'keyboard instrument', 'drum', 'dance', 'board game', 'ball game', 'outdoor game', 'martial art', 'container', 'kitchen utensil',
  'cooking utensil', 'pot', 'pan', 'knife', 'cutlery', 'tableware', 'dwelling', 'room', 'building', 'vessel', 'beverage', 'juice', 'coffee', 'tea']);
const VAGUE = new Set(['area', 'line', 'earth', 'thing', 'object', 'part', 'piece', 'unit', 'device', 'means', 'matter', 'material',
  'person', 'people', 'worker', 'maker', 'young', 'whole', 'form', 'kind', 'type', 'group', 'set', 'item', 'stuff', 'act', 'action',
  'activity', 'process', 'state', 'quality', 'attribute', 'relation', 'measure', 'amount', 'structure', 'instrumentality', 'artifact',
  'covering', 'system', 'way', 'place', 'point', 'region', 'land', 'room', 'creation', 'product', 'organism', 'being', 'entity', 'leader',
  'expert', 'adult', 'lover', 'communicator', 'traveler', 'user', 'owner', 'holder', 'member', 'friend', 'enemy', 'native', 'case',
  'container', 'support', 'surface', 'opening', 'end', 'top', 'side', 'base', 'edge', 'block', 'body', 'remedy', 'course', 'document']);
const isUnder = (x, top) => {
  const st = [[top, 0]];
  while (st.length) { const [o, d] = st.pop(); if (o === x && d > 0) return true; if (d >= 3) continue; for (const h2 of syn.get(o)?.hypo || []) st.push([h2, d + 1]); }
  return false;
};
const categories = [];
for (const [off, s] of syn) {
  if (!LEX_OK.has(s.lex)) continue;
  const name = s.lemmas[0];
  if (!/^[a-z_]+$/.test(name) || name.length > 18) continue;
  // only categories people name in everyday speech, in the sense meant here
  const nameParts = name.split('_');
  if (nameParts.length > 2 || nameParts.some((x) => (tier.get(x) ?? 99) > 20)) continue;
  if (nameParts.length === 1 && firstSense.get(name) !== off) continue; // "car" the automobile, not the railcar
  if (!ALLOW.has(name.replace(/_/g, ' '))) continue;
  const members = new Set();
  const walk = (o, depth) => {
    const x = syn.get(o);
    if (!x || depth > 3) return;
    for (const l of x.lemmas) if (l !== name && memberOk(l, o)) members.add(l);
    for (const h2 of x.hypo) walk(h2, depth + 1);
  };
  for (const h2 of s.hypo) walk(h2, 1);
  const common = [...members].filter((w) => tier.get(w) <= 35);
  if (common.length < 5 || members.size > 80) continue;
  // f: members for which this is their first, everyday sense (used on Easy and Medium)
  const first = [...members].filter((w) => syn.get(firstSense.get(w)) && isUnder(firstSense.get(w), off));
  categories.push({ n: name.replace(/_/g, ' '), k: 'kind', w: [...members].sort(), f: first.sort(), g: s.gloss });
}
// word-before / word-after groups from closed compounds: FIRE___ and ___BALL
// halves that make accidental splits (con+fusion, car+nation, sea+son) rather than real compounds
const BAD_HEAD = new Set(['con', 'per', 'pro', 'car', 'bar', 'man', 'pan', 'pass', 'bull', 'stop', 'war', 'ant', 'art', 'pen', 'pot', 'tar', 'pat', 'cat', 'ten', 'tan', 'can', 'par', 'for', 'ear', 'leg', 'den', 'mat', 'pin', 'arm', 'ion', 'sea']);
const BAD_TAIL = new Set(['ion', 'her', 'hip', 'ability', 'ties', 'per', 'age', 'son', 'rant', 'ton', 'rot', 'nation', 'pet', 'let', 'ant', 'ent', 'ate', 'ice', 'ire', 'ward', 'end', 'tin', 'den', 'ten', 'man', 'men', 'ore', 'one', 'rate', 'tion', 'tor', 'ter', 'ted', 'red', 'ran', 'row', 'ale', 'are', 'ally', 'lace', 'sent', 'tent', 'tender', 'version', 'mission', 'portion', 'motion', 'fusion', 'gain', 'rage', 'fines', 'cent', 'fume', 'jury', 'former', 'file', 'fit', 'quest', 'science', 'course', 'currency', 'junction', 'notation', 'dries', 'date', 'kind', 'power', 'hole', 'ion']);
const closedNouns = [];
for (const [w, t] of tier) {
  if (t > 35 || w.length < 6 || badWords.has(w) || w.endsWith('ing') || NOT_COMPOUNDS.has(w)) continue;
  if (!compoundIdx.get(w) || compoundIdx.get(w).pos !== 'noun') continue;
  for (let i = 3; i <= w.length - 3; i++) {
    const a = w.slice(0, i), b = w.slice(i);
    if ((tier.get(a) ?? 99) <= 20 && (tier.get(b) ?? 99) <= 20 && !SUFFIXES.has(b) && !PREFIXES.has(a)
      && !BAD_HEAD.has(a) && !BAD_TAIL.has(b) && !(b.endsWith('s') && !b.endsWith('ss')) && !(a.endsWith('s') && !a.endsWith('ss'))) closedNouns.push([a, b]);
  }
}
const byFirst = new Map(), bySecond = new Map();
for (const [a, b] of closedNouns) {
  if (!byFirst.has(a)) byFirst.set(a, new Set()); byFirst.get(a).add(b);
  if (!bySecond.has(b)) bySecond.set(b, new Set()); bySecond.get(b).add(a);
}
for (const [a, set] of byFirst) if (set.size >= 4) categories.push({ n: a.toUpperCase() + ' ___', k: 'before', w: [...set].sort(), g: '' });
for (const [b, set] of bySecond) if (set.size >= 4) categories.push({ n: '___ ' + b.toUpperCase(), k: 'after', w: [...set].sort(), g: '' });
fs.writeFileSync(path.join(OUT, 'categories.json'), JSON.stringify(categories));
console.log('categories', categories.length, 'kinds', categories.filter((c) => c.k === 'kind').length, 'compound groups', categories.filter((c) => c.k !== 'kind').length);
