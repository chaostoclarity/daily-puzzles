import './style.css';
import wordsJson from './data/words.json';
import cluesJson from './data/clues.json';
import triviaJson from './data/trivia.json';
import { initWords } from './lib/words.js';
import { connectCloud, flush } from './lib/store.js';
import { initTrivia } from './gen/trivia.js';
import { initCompounds } from './gen/ladder.js';
import compoundsJson from './data/compounds.json';
import { makeRng } from './lib/rng.js';
import { h, put, store, keyCode, fmtTime } from './lib/ui.js';
import { ICONS } from './icons.js';
import path from './games/path.js';
import crowns from './games/crowns.js';
import weave from './games/weave.js';
import ladder from './games/ladder.js';
import guess from './games/guess.js';
import mini from './games/mini.js';
import hive from './games/hive.js';
import trivia from './games/trivia.js';
import sudoku from './games/sudoku.js';
import dominoes from './games/dominoes.js';
import tiles from './games/tiles.js';
import letterbox from './games/letterbox.js';
import groups from './games/groups.js';
import threads from './games/threads.js';
import midi from './games/midi.js';
import waffle from './games/waffle.js';
import typeshift from './games/typeshift.js';
import seats from './games/seats.js';
import wordscapes from './games/wordscapes.js';
import knotwords from './games/knotwords.js';
import { initCategories } from './gen/groups.js';
import categoriesJson from './data/categories.json';

initWords(wordsJson, cluesJson);
initTrivia(triviaJson);
initCompounds(compoundsJson);
initCategories(categoriesJson);

const SECTIONS = [
  ['Logic', [path, crowns, sudoku, dominoes, tiles, seats]],
  ['Words', [guess, waffle, typeshift, wordscapes, hive, groups, threads, weave, ladder, letterbox]],
  ['Crosswords', [mini, midi, knotwords]],
  ['Knowledge', [trivia]],
];
const GAMES = SECTIONS.flatMap(([, list]) => list);
const DIFFS = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']];
const app = document.getElementById('app');

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const prettyDate = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const diffOf = (g) => store.get(`dp:diff:${g.id}`, 'medium');
const extraKey = (g, d) => `dp:n:${today()}|${g.id}|${d}`;
const seedKey = (g, d, n) => `${today()}|${g.id}|${d}|${n}`;
// Saved progress is keyed by seed plus the game's version, so when a generator changes,
// old saves for the same day don't get loaded onto a different board.
const saveKey = (g, d, n) => seedKey(g, d, n) + (g.version ? `#v${g.version}` : '');

// ---------- toast ----------
const toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
}

// ---------- sheet (in-page dialog) ----------
function sheet(content, { onClose } = {}) {
  const close = () => { wrap.remove(); document.removeEventListener('keydown', esc); onClose?.(); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', tabindex: '-1' }, content(close));
  const wrap = h('div', { class: 'sheet-wrap', onClick: (e) => { if (e.target === wrap) close(); } }, panel);
  document.body.append(wrap);
  document.addEventListener('keydown', esc);
  // focus the dialog itself so a key held from typing can't press a button by accident
  panel.focus({ preventScroll: true });
  return close;
}

function rulesSheet(g) {
  sheet((close) => [
    h('div', { class: 'sheet-head' }, h('span', { class: 'sheet-icon', style: { '--g': `var(--g-${g.id})` }, html: ICONS[g.id] }), h('h2', {}, `How to play ${g.name}`)),
    h('ul', { class: 'rules' }, g.rules.map((r) => h('li', {}, r))),
    h('p', {}, 'Stuck? Hint solves one square or letter at a time.'),
    h('button', { class: 'btn primary wide', type: 'button', onClick: close }, 'Got it'),
  ]);
}

// ---------- home ----------
function renderHome() {
  cleanup();
  document.title = 'Daily Puzzles';
  const card = (g) => {
    const d = diffOf(g);
    const sk = saveKey(g, d, 0);
    const doneAt = store.get(`dp:done:${sk}`);
    const started = store.get(`dp:s:${sk}`);
    const chip = doneAt ? h('span', { class: 'chip done' }, 'Solved') : started ? h('span', { class: 'chip' }, 'In progress') : null;
    return h('a', { class: 'card', href: `#${g.id}`, style: { '--g': `var(--g-${g.id})` } },
      h('span', { class: 'card-icon', html: ICONS[g.id] }),
      h('span', { class: 'card-text' },
        h('span', { class: 'card-name' }, g.name),
        h('span', { class: 'card-tag' }, g.tagline)),
      h('span', { class: 'card-meta' }, chip, h('span', { class: 'card-diff' }, DIFFS.find((x) => x[0] === d)[1])));
  };
  const solvedCount = GAMES.filter((g) => store.get(`dp:done:${saveKey(g, diffOf(g), 0)}`)).length;
  put(app, h('main', { class: 'home' },
    h('header', { class: 'home-head' },
      h('p', { class: 'eyebrow' }, prettyDate()),
      h('h1', {}, 'Daily Puzzles'),
      h('p', { class: 'home-sub' }, solvedCount === GAMES.length ? `All ${GAMES.length} solved today. New set at midnight.` : `${solvedCount} of ${GAMES.length} solved today. New puzzles every midnight.`)),
    h('nav', { class: 'sections', 'aria-label': 'Games' }, SECTIONS.map(([title, list]) => h('section', { class: 'section' },
      h('h2', { class: 'section-title' }, title),
      h('div', { class: 'cards' }, list.map(card))))),
    h('footer', { class: 'foot' },
      h('p', {}, 'Every puzzle is generated on your device from the date, so each day brings a fresh set with no server and no downloads.'),
      h('p', {}, 'Word lists from SCOWL, clues from Princeton WordNet, trivia from the ', h('a', { href: 'https://opentdb.com', target: '_blank', rel: 'noopener' }, 'Open Trivia Database'), ' (CC BY-SA 4.0).'))));
  window.scrollTo(0, 0);
}

// ---------- game screen ----------
let active = null; // { g, api, timer, ... }

function cleanup() {
  pendingBuild = null;
  if (active) {
    clearInterval(active.tick);
    active.api?.destroy?.();
    active = null;
  }
}

function renderGame(g) {
  cleanup();
  // bigger grids take a moment to build; show something first
  if (g.slow) {
    put(app, h('main', { class: 'screen' }, h('p', { class: 'hint-line loading' }, `Building ${g.name}…`)));
    const token = {};
    pendingBuild = token;
    setTimeout(() => { if (pendingBuild === token) buildGame(g); }, 30);
    return;
  }
  buildGame(g);
}

let pendingBuild = null;
function buildGame(g) {
  cleanup();
  const d = diffOf(g);
  const n = store.get(extraKey(g, d), 0);
  const key = seedKey(g, d, n);
  const sk = saveKey(g, d, n);
  document.title = `${g.name} · Daily Puzzles`;

  let puzzle;
  try { puzzle = g.generate(makeRng(key), d); } catch (err) {
    console.error(err);
    puzzle = g.generate(makeRng(key + '|retry'), d);
  }

  const timeKey = `dp:t:${sk}`;
  let secs = store.get(timeKey, 0);
  let finished = !!store.get(`dp:done:${sk}`) || !!store.get(`dp:s:${sk}`)?.revealed || store.get(`dp:s:${sk}`)?.over === 'lost';
  const timerEl = h('span', { class: 'timer', 'aria-label': 'Time' }, fmtTime(secs));

  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Difficulty' }, DIFFS.map(([id, label]) => h('button', {
    class: 'seg-btn' + (id === d ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': id === d ? 'true' : 'false',
    onClick: () => { if (id !== d) { store.set(`dp:diff:${g.id}`, id); renderGame(g); } },
  }, label)));
  const label = n === 0 ? "Today's puzzle" : `Extra puzzle ${n}`;
  const hintKey = `dp:h:${sk}`;
  const revealBtn = h('button', { class: 'link', type: 'button', onClick: () => confirmReveal() }, 'Show answer');
  const hintBtn = h('button', { class: 'btn small hint-btn', type: 'button', 'aria-label': 'Hint: solve one square or letter', onClick: (e) => { e.currentTarget.blur(); useHint(); } }, 'Hint');
  const body = h('div', { class: `game game-${g.id}` });
  // Hint stays up top next to the board; difficulty and round controls sit below the
  // puzzle so the board gets the top of the screen.
  const screen = h('main', { class: 'screen', style: { '--g': `var(--g-${g.id})` } },
    h('header', { class: 'topbar' },
      h('a', { class: 'back', href: '#', 'aria-label': 'All games' }, '‹', h('span', {}, 'Games')),
      h('h1', { class: 'title' }, h('span', { class: 'title-icon', html: ICONS[g.id] }), g.name),
      timerEl,
      hintBtn,
      h('button', { class: 'icon-btn help', type: 'button', 'aria-label': 'How to play', onClick: () => rulesSheet(g) }, '?')),
    body,
    h('footer', { class: 'toolbar' },
      h('div', { class: 'toolbar-row' },
        h('span', { class: 'puzzle-label' }, label,
          n > 0 ? h('button', { class: 'link', type: 'button', onClick: () => { store.set(extraKey(g, d), 0); renderGame(g); } }, 'Back to today') : null),
        h('span', { class: 'toolbar-btns' },
          revealBtn,
          h('button', { class: 'btn small', type: 'button', onClick: newPuzzle }, 'New puzzle'))),
      seg));
  put(app, screen);
  window.scrollTo(0, 0);

  function newPuzzle() {
    store.set(extraKey(g, d), n + 1);
    renderGame(g);
    toast('New puzzle');
  }

  // Hive keeps going after it's solved, so its hints and answers stay available until revealed
  const playable = () => !finished || (g.playsOn && !store.get(`dp:s:${sk}`)?.revealed);

  function useHint() {
    if (!playable()) { toast('This puzzle is already finished'); return; }
    if (!api.hint) return;
    const msg = api.hint();
    if (msg === false) return;
    const used = store.get(hintKey, 0) + 1;
    store.set(hintKey, used);
    toast(msg || `Hint ${used}`);
  }

  function stop() { finished = true; store.set(timeKey, secs); timerEl.classList.add('stopped'); }

  function confirmReveal() {
    if (!playable()) { toast('This puzzle is already finished'); return; }
    if (!api.reveal) return;
    sheet((close) => [
      h('h2', {}, 'Show the answer?'),
      h('p', {}, 'This ends the puzzle and fills in the solution.'),
      h('div', { class: 'sheet-actions' },
        h('button', { class: 'btn', type: 'button', onClick: close }, 'Keep playing'),
        h('button', { class: 'btn primary', type: 'button', onClick: () => { close(); api.reveal(); stop(); store.set(`dp:s:${sk}`, { ...(store.get(`dp:s:${sk}`) || {}), revealed: true }); } }, 'Show answer')),
    ]);
  }

  const ctx = {
    puzzle, difficulty: d, toast,
    load: () => store.get(`dp:s:${sk}`),
    save: (state) => store.set(`dp:s:${sk}`, state),
    finished: () => stop(),
    solved: (summary) => {
      stop();
      store.set(`dp:done:${sk}`, secs);
      const mine = active;
      setTimeout(() => active === mine && sheet((close) => [
        h('div', { class: 'sheet-head' }, h('span', { class: 'sheet-icon', style: { '--g': `var(--g-${g.id})` }, html: ICONS[g.id] }), h('h2', {}, summary ? `${g.name}: ${summary}` : `${g.name} solved`)),
        h('p', { class: 'big-time' }, fmtTime(secs)),
        h('p', {}, `${DIFFS.find((x) => x[0] === d)[1]} · ${label}` + (store.get(hintKey, 0) ? ` · ${store.get(hintKey, 0)} hint${store.get(hintKey, 0) > 1 ? 's' : ''}` : '')),
        h('div', { class: 'sheet-actions' },
          h('button', { class: 'btn', type: 'button', onClick: () => { close(); location.hash = ''; } }, 'All games'),
          h('button', { class: 'btn primary', type: 'button', onClick: () => { close(); newPuzzle(); } }, 'New puzzle')),
        h('button', { class: 'link', type: 'button', onClick: close }, 'Look at the board'),
      ]), 550);
    },
  };

  window.__puzzle = puzzle; // handy for debugging in the console
  const api = g.mount(body, ctx) || {};
  if (!api.reveal) revealBtn.hidden = true;
  if (!api.hint) hintBtn.hidden = true;
  if (finished) timerEl.classList.add('stopped');
  active = {
    g, api,
    tick: setInterval(() => {
      if (finished || document.hidden) return;
      secs++;
      timerEl.textContent = fmtTime(secs);
      if (secs % 5 === 0) store.set(timeKey, secs, { lazy: true });
    }, 1000),
  };
  if (!store.get(`dp:seen:${g.id}`)) { store.set(`dp:seen:${g.id}`, true); rulesSheet(g); }
}

// ---------- keys & routing ----------
document.addEventListener('keydown', (e) => {
  if (!active?.api?.onKey) return;
  if (document.querySelector('.sheet-wrap')) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
  if (t && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'SUMMARY') && (e.key === 'Enter' || e.key === ' ')) return;
  const k = keyCode(e);
  if (!k) return;
  if ((k === 'tab' || k === 'shifttab') && active.g.id !== 'mini' && active.g.id !== 'midi') return;
  if (k === 'space' && active.g.id !== 'mini' && active.g.id !== 'midi' && active.g.id !== 'hive') return;
  if (/^[0-9]$/.test(k) && active.g.id !== 'sudoku') return;
  e.preventDefault();
  active.api.onKey(k);
});

function route() {
  flush();
  document.querySelectorAll('.sheet-wrap').forEach((el) => el.remove());
  toastEl.classList.remove('show');
  const id = location.hash.replace(/^#\/?/, '');
  const g = GAMES.find((x) => x.id === id);
  if (g) renderGame(g); else renderHome();
}
window.addEventListener('hashchange', route);
document.body.append(toastEl);
route();
// as a Claude artifact, progress also lives in the viewer's private cloud store
connectCloud(today()).then((changed) => { if (changed && !document.querySelector('.sheet-wrap')) route(); });
