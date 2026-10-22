// Small line icons for each game, drawn on a 24px grid.
const svg = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const ICONS = {
  path: svg('<path d="M5 5h14v7H5v7h14"/><circle cx="5" cy="5" r="2" fill="currentColor"/><circle cx="19" cy="19" r="2" fill="currentColor"/>'),
  crowns: svg('<path d="M4 17h16l-1.4-8.5-4.3 3.8L12 6l-2.3 6.3-4.3-3.8z"/><path d="M4 20.5h16"/>'),
  weave: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M7.5 8h4v8h5"/><path d="M16.5 8v3.5"/>'),
  ladder: svg('<path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10"/>'),
  guess: svg('<rect x="2.5" y="8" width="5.5" height="8" rx="1"/><rect x="9.25" y="8" width="5.5" height="8" rx="1" fill="currentColor" fill-opacity=".35"/><rect x="16" y="8" width="5.5" height="8" rx="1" fill="currentColor"/>'),
  mini: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/><rect x="3.5" y="3.5" width="5.7" height="5.7" fill="currentColor"/><rect x="14.8" y="14.8" width="5.7" height="5.7" fill="currentColor"/>'),
  hive: svg('<path d="M12 3.5l4 2.3v4.6l-4 2.3-4-2.3V5.8z" fill="currentColor" fill-opacity=".35"/><path d="M8 12.7l4 2.3v4.6l-4 2.3-4-2.3V15z"/><path d="M16 12.7l4 2.3v4.6l-4 2.3-4-2.3V15z"/>'),
  trivia: svg('<path d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 014 13.5z"/><path d="M10 8a2 2 0 113 1.7c-.6.4-1 .8-1 1.5"/><circle cx="12" cy="13.3" r=".6" fill="currentColor"/>'),
};
