/* Reads the position straight out of chessground's DOM.
   Lichess never reloads the page on a move, so this is the only source of
   truth we have — and the most fragile part of the extension. If lichess
   changes its markup, it breaks here and nowhere else. */
(function (root) {
  'use strict';

  const ROLE = {
    pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k'
  };

  function findWrap() {
    return document.querySelector('.cg-wrap');
  }

  function readBoard(wrap) {
    wrap = wrap || findWrap();
    if (!wrap) return null;
    const board = wrap.querySelector('cg-board');
    if (!board) return null;

    const rect = board.getBoundingClientRect();
    const size = rect.width / 8;
    if (!size) return null;
    const flipped = wrap.classList.contains('orientation-black');

    const pieces = [];
    for (const el of board.querySelectorAll('piece')) {
      // dragging clones and fading pieces would double-count squares
      if (el.classList.contains('ghost') || el.classList.contains('fading')) continue;

      const nums = (el.style.transform || '').match(/-?[\d.]+/g);
      if (!nums || nums.length < 2) continue;

      let file = Math.round(parseFloat(nums[0]) / size);
      let rank = 7 - Math.round(parseFloat(nums[1]) / size);
      if (flipped) { file = 7 - file; rank = 7 - rank; }
      if (file < 0 || file > 7 || rank < 0 || rank > 7) continue;

      const classes = el.className.trim().split(/\s+/);
      const color = classes.includes('white') ? 'w' : classes.includes('black') ? 'b' : null;
      const role = classes.map(c => ROLE[c]).find(Boolean);
      if (!color || !role) continue;

      pieces.push({ square: 'abcdefgh'[file] + (rank + 1), color, type: role });
    }
    return { pieces, flipped, wrap, board };
  }

  const api = { readBoard, findWrap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChessVisionBoard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
