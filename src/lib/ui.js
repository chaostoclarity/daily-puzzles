// Small DOM helpers shared by all games.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const svgNS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs = {}) {
  const el = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

/** On-screen keyboard. onKey receives a lowercase letter, 'enter' or 'back'. */
export function keyboard(onKey, { enterLabel = 'Enter' } = {}) {
  const rows = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-'];
  const keys = {};
  const el = h('div', { class: 'kb', role: 'group', 'aria-label': 'Keyboard' },
    rows.map((row) => h('div', { class: 'kb-row' }, [...row].map((ch) => {
      const code = ch === '+' ? 'enter' : ch === '-' ? 'back' : ch;
      const label = ch === '+' ? enterLabel : ch === '-' ? '⌫' : ch;
      const b = h('button', {
        class: 'kb-key' + (code.length > 1 ? ' kb-wide' : ''), type: 'button',
        'aria-label': code === 'back' ? 'Delete' : code === 'enter' ? enterLabel : ch,
        onPointerdown: (e) => { e.preventDefault(); onKey(code); },
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKey(code); } },
      }, label);
      keys[code] = b;
      return b;
    }))));
  return {
    el,
    /** states: { letter: 'hit' | 'near' | 'miss' } */
    setStates(states) {
      for (const [k, b] of Object.entries(keys)) {
        b.classList.remove('hit', 'near', 'miss');
        if (states[k]) b.classList.add(states[k]);
      }
    },
  };
}

/** Normalizes a physical keydown to the same codes the on-screen keyboard sends. */
export function keyCode(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  if (e.key === 'Enter') return 'enter';
  if (e.key === 'Backspace' || e.key === 'Delete') return 'back';
  if (/^[a-zA-Z]$/.test(e.key)) return e.key.toLowerCase();
  if (e.key.startsWith('Arrow')) return e.key.slice(5).toLowerCase();
  if (e.key === ' ') return 'space';
  if (e.key === 'Tab') return e.shiftKey ? 'shifttab' : 'tab';
  return null;
}

export function fmtTime(sec) {
  const m = Math.floor(sec / 60), s2 = Math.floor(sec % 60);
  return `${m}:${String(s2).padStart(2, '0')}`;
}

export function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

/** The cell under a pointer, for drag gestures on touch screens. */
export function cellAt(e, selector = '[data-cell]') {
  const t = document.elementFromPoint(e.clientX, e.clientY);
  const c = t && t.closest(selector);
  return c ? +c.dataset.cell : null;
}

/** replaceChildren that skips null/false (the DOM would print them as text). */
export function put(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
}
