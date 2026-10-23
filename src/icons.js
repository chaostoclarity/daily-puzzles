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
  sudoku: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/><path d="M5.5 6.3h1.5M17 11.5v1.5M11.2 17.5h1.6" stroke-width="1.6"/>'),
  dominoes: svg('<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M12 7v10"/><circle cx="7.5" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/><circle cx="18" cy="14" r="1" fill="currentColor"/>'),
  tiles: svg('<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" fill="currentColor" fill-opacity=".35"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" fill="currentColor" fill-opacity=".35"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.5"/><circle cx="7.25" cy="7.25" r="1.6" fill="currentColor"/><circle cx="16.75" cy="16.75" r="1.6" fill="currentColor"/>'),
  waffle: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 12h17M12 3.5v17"/><rect x="6.6" y="6.6" width="2.4" height="2.4" fill="currentColor"/><rect x="15" y="6.6" width="2.4" height="2.4" fill="currentColor"/><rect x="6.6" y="15" width="2.4" height="2.4" fill="currentColor"/><rect x="15" y="15" width="2.4" height="2.4" fill="currentColor"/>'),
  typeshift: svg('<path d="M3.5 12h17" stroke-opacity=".45"/><rect x="4" y="4" width="4" height="10" rx="1.2"/><rect x="10" y="8" width="4" height="12" rx="1.2"/><rect x="16" y="6" width="4" height="9" rx="1.2"/>'),
  seats: svg('<path d="M4 14v5M20 14v5M4 14h16"/><circle cx="7" cy="8" r="2"/><circle cx="12" cy="8" r="2" fill="currentColor"/><circle cx="17" cy="8" r="2"/>'),
  wordscapes: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="6.5" r="1.3" fill="currentColor"/><circle cx="17" cy="14.5" r="1.3" fill="currentColor"/><circle cx="7" cy="14.5" r="1.3" fill="currentColor"/><path d="M12 6.5 17 14.5 7 14.5"/>'),
  knotwords: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 12h8.5V3.5M12 12v8.5M12 16h8.5"/>'),
  pileup: svg('<rect x="3.5" y="6" width="10" height="14" rx="1.5" transform="rotate(-8 8.5 13)"/><rect x="10.5" y="4" width="10" height="14" rx="1.5" fill="currentColor" fill-opacity=".25"/><path d="M15.5 8.5l1.5 2-1.5 2-1.5-2z" fill="currentColor"/>'),
  wordbind: svg('<path d="M3 9h18M3 15h18" stroke-opacity=".35"/><path d="M5 9l4 6 4-6 3 6 3-6"/>'),
  letterbox: svg('<rect x="5" y="5" width="14" height="14"/><path d="M9 5l6 14M5 10l14 4"/>'),
  groups: svg('<rect x="3.5" y="3.5" width="7.5" height="4.5" rx="1"/><rect x="13" y="3.5" width="7.5" height="4.5" rx="1"/><rect x="3.5" y="10" width="17" height="4.5" rx="1" fill="currentColor" fill-opacity=".35"/><rect x="3.5" y="16.5" width="7.5" height="4.5" rx="1"/><rect x="13" y="16.5" width="7.5" height="4.5" rx="1"/>'),
  threads: svg('<circle cx="5" cy="6" r="1.6" fill="currentColor"/><circle cx="12" cy="6" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="18" r="1.6" fill="currentColor"/><circle cx="5" cy="18" r="1.6" fill="currentColor"/><path d="M5 6h7l7 6-7 6H5"/>'),
  midi: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 7.8h17M3.5 12h17M3.5 16.2h17M7.8 3.5v17M12 3.5v17M16.2 3.5v17"/><rect x="3.5" y="3.5" width="4.3" height="4.3" fill="currentColor"/><rect x="16.2" y="16.2" width="4.3" height="4.3" fill="currentColor"/><rect x="12" y="7.8" width="4.2" height="4.2" fill="currentColor"/>'),
};
