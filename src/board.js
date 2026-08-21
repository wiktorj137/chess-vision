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

  /* ---- who is playing, and is any of this live? ------------------------

     Lichess gives a game against the AI the same URL as a game against a
     person, so the only way to tell them apart is to read the page. This
     fails closed: anything it cannot identify counts as a human game. */

  function liveRound() {
    return !!document.querySelector('.round__app, .rclock, .rmoves');
  }

  function myUsername() {
    const el = document.querySelector('#user_tag');
    return el ? el.textContent.trim().toLowerCase() : null;
  }

  function playerBoxes() {
    return [...document.querySelectorAll('.ruser, .ruser-top, .ruser-bottom')];
  }

  function boxLooksLikeBot(box) {
    const title = box.querySelector('.utitle, .title');
    if (title && title.textContent.trim().toUpperCase() === 'BOT') return true;
    return /stockfish|lichess ai/i.test(box.textContent || '');
  }

  function boxName(box) {
    const link = box.querySelector('a.user-link, .user-link');
    const raw = (link ? link.textContent : box.textContent) || '';
    // strip title badges and ratings: "GM Magnus (2800)" -> "magnus"
    return raw.replace(/\([^)]*\)/g, '')
              .replace(/\b(GM|IM|FM|CM|WGM|WIM|WFM|WCM|NM|LM|BOT)\b/g, '')
              .trim().toLowerCase();
  }

  /* { live, bot } — bot is true only for a two-player live game where exactly
     one side is a bot and the viewer is the other side. */
  function gameContext() {
    if (!liveRound()) return { live: false, bot: false };

    const boxes = playerBoxes();
    if (boxes.length !== 2) return { live: true, bot: false };

    const bots = boxes.filter(boxLooksLikeBot);
    if (bots.length !== 1) return { live: true, bot: false };

    const me = myUsername();
    if (!me) return { live: true, bot: false };          // logged out: spectating

    const human = boxes.find(b => !boxLooksLikeBot(b));
    return { live: true, bot: boxName(human).includes(me) };
  }

  const api = { readBoard, findWrap, gameContext, liveRound };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChessVisionBoard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
