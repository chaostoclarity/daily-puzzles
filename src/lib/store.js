// Saved progress. Reads are synchronous from an in-memory copy. Every write goes to
// browser storage, and, when the page runs as a Claude artifact, to the viewer's own
// private cloud store too, so progress survives reloads, app restarts and other devices.
//
// Cloud layout under data/users/<viewer id>/:
//   prefs        difficulty per game, rules already seen
//   d<date>      everything for one day: board states, timers, solved marks, extra rounds
// One document per day keeps the store small and writes few.

const LS_PREFIX = '';
const mem = new Map();          // key -> JSON string
const touched = new Set();      // keys written during this visit (they beat older cloud copies)
const dirtyDocs = new Set();    // cloud docs waiting to be written
let cloud = null;               // { col } once connected
let flushTimer = null;
const writing = new Map();      // doc id -> promise of the write in flight

const DATE_RE = /(\d{4}-\d{2}-\d{2})/;
const docIdFor = (key) => {
  const m = key.match(DATE_RE);
  return m ? 'd' + m[1] : 'prefs';
};

// seed from browser storage where it works
try {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('dp:')) mem.set(k, localStorage.getItem(k));
  }
} catch { /* storage blocked: memory only until the cloud answers */ }

export const store = {
  get(key, fallback = null) {
    const v = mem.get(key);
    if (v === undefined || v === null) return fallback;
    try { return JSON.parse(v); } catch { return fallback; }
  },
  /** lazy: keep it, but don't trigger a cloud write on its own (timer ticks). */
  set(key, value, { lazy = false } = {}) {
    const s = JSON.stringify(value);
    if (mem.get(key) === s) return;
    mem.set(key, s);
    touched.add(key);
    try { localStorage.setItem(LS_PREFIX + key, s); } catch { /* ignore */ }
    dirtyDocs.add(docIdFor(key));
    if (!lazy) scheduleFlush();
  },
};

function scheduleFlush() {
  if (!cloud) return;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 1200);
}

function bodyFor(docId) {
  const keys = {};
  for (const [k, v] of mem) if (docIdFor(k) === docId) keys[k] = v;
  return { keys, savedAt: Date.now() };
}

export async function flush() {
  if (!cloud) return;
  clearTimeout(flushTimer);
  const ids = [...dirtyDocs];
  dirtyDocs.clear();
  await Promise.all(ids.map(async (id) => {
    // one write at a time per document
    const prev = writing.get(id) || Promise.resolve();
    const next = prev.then(async () => {
      try { await cloud.col.doc(id).set(bodyFor(id)); }
      catch (e) {
        if (e && e.code === 'unavailable') {
          await new Promise((r) => setTimeout(r, 800 + Math.random() * 800));
          try { await cloud.col.doc(id).set(bodyFor(id)); } catch { dirtyDocs.add(id); }
        } else if (e && (e.code === 'invalid_argument' || e.code === 'revoked' || e.code === 'not_granted')) {
          cloud = null; // this viewer can't save here; browser storage still works
        } else dirtyDocs.add(id);
      }
    });
    writing.set(id, next);
    return next;
  }));
}

/**
 * Connects to the cloud store when running as an artifact. Resolves true when cloud
 * data changed what is in memory (the caller re-renders), false otherwise.
 */
export async function connectCloud(today) {
  const c = typeof window !== 'undefined' && window.claude;
  if (!c || typeof c.use !== 'function') return false;
  let db, user;
  try { [db, user] = await Promise.all([c.use('db'), c.use('user')]); } catch { return false; }
  if (!db || !user) return false;
  let uid = null;
  try { uid = await user.id(); } catch { /* no id */ }
  if (!uid) return false;
  const col = db.collection('data/users/' + uid);
  let changed = false;
  const cloudKeys = {};
  try {
    const snaps = await Promise.all(['prefs', 'd' + today].map((id) => col.doc(id).get()));
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const keys = (snap.data() || {}).keys || {};
      Object.assign(cloudKeys, keys);
      for (const [k, v] of Object.entries(keys)) {
        if (touched.has(k) || typeof v !== 'string') continue; // this visit's moves win
        if (mem.get(k) !== v) {
          mem.set(k, v);
          try { localStorage.setItem(k, v); } catch { /* ignore */ }
          changed = true;
        }
      }
    }
  } catch { return false; }
  cloud = { col };
  // push only what this device knows that the cloud doesn't have yet
  for (const [k, v] of mem) {
    const id = docIdFor(k);
    if ((id === 'prefs' || id === 'd' + today) && cloudKeys[k] !== v) dirtyDocs.add(id);
  }
  if (dirtyDocs.size) scheduleFlush();
  // save promptly when the app is backgrounded or closed
  const bye = () => { if (dirtyDocs.size) flush(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) bye(); });
  window.addEventListener('pagehide', bye);
  return changed;
}

export const cloudConnected = () => !!cloud;
