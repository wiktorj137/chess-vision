/* Draws the overlay and keeps it in sync with the board.
   We never touch lichess' own DOM — everything lands in one SVG layered on
   top, with pointer-events off so clicking pieces still works. */
(function () {
  'use strict';

  const L = globalThis.ChessVisionLogic;
  const B = globalThis.ChessVisionBoard;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ID = 'chess-vision-overlay';

  const COLORS = {
    hanging: '#e02020',
    under: '#f0a020',
    weak: '#7c5cff',
    move: '#1d9e75'
  };

  const state = {
    on: true,
    weak: false,      // weak squares are noisy, off until asked for
    diff: true,       // what the last move changed — the point of the whole thing
    observer: null,
    wrap: null,
    prevPieces: null,
    sig: null,
    lastDiff: null
  };

  function xy(square, flipped) {
    const file = 'abcdefgh'.indexOf(square[0]);
    const rank = +square[1] - 1;
    return flipped ? { x: 7 - file, y: rank } : { x: file, y: 7 - rank };
  }

  function ensureSvg(wrap) {
    let svg = wrap.querySelector('#' + ID);
    if (!svg) {
      svg = document.createElementNS(SVG_NS, 'svg');
      svg.id = ID;
      svg.setAttribute('viewBox', '0 0 8 8');
      wrap.appendChild(svg);
    }
    return svg;
  }

  function el(name, attrs, text) {
    const n = document.createElementNS(SVG_NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  /* A badge in the corner of a square. The colour alone is not enough —
     red and orange are the same colour to a lot of people — so every mark
     also carries a symbol that says what it means. */
  function badge(svg, x, y, label, fill, corner) {
    const wide = label.length > 1;
    const w = wide ? 0.52 : 0.34;
    const h = 0.32;
    const bx = corner === 'bl' ? x + 0.02 : x + 0.98 - w;
    const by = corner === 'bl' ? y + 0.98 - h : y + 0.02;
    svg.appendChild(el('rect', {
      x: bx, y: by, width: w, height: h, rx: 0.1,
      fill: fill, opacity: 0.95
    }));
    svg.appendChild(el('text', {
      x: bx + w / 2, y: by + h / 2 + 0.005,
      'font-size': 0.24, 'font-family': 'sans-serif', 'font-weight': 'bold',
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      fill: '#fff'
    }, label));
  }

  /* A thin arrow along the move that was just played. Deliberately plain:
     it says what happened, never what to play. */
  function moveArrow(svg, from, to, flipped) {
    const a = xy(from, flipped), b = xy(to, flipped);
    const x1 = a.x + 0.5, y1 = a.y + 0.5;
    const x2 = b.x + 0.5, y2 = b.y + 0.5;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const tipX = x2 - ux * 0.18, tipY = y2 - uy * 0.18;
    const backX = tipX - ux * 0.26, backY = tipY - uy * 0.26;

    svg.appendChild(el('line', {
      x1: x1 + ux * 0.28, y1: y1 + uy * 0.28, x2: backX, y2: backY,
      stroke: COLORS.move, 'stroke-width': 0.07, 'stroke-linecap': 'round', opacity: 0.75
    }));
    svg.appendChild(el('polygon', {
      points: [
        tipX + ',' + tipY,
        (backX - uy * 0.13) + ',' + (backY + ux * 0.13),
        (backX + uy * 0.13) + ',' + (backY - ux * 0.13)
      ].join(' '),
      fill: COLORS.move, opacity: 0.75
    }));
  }

  function render() {
    const board = B.readBoard(state.wrap);
    if (!board) return;
    const svg = ensureSvg(board.wrap);
    svg.replaceChildren();
    updateLegend();
    if (!state.on) return;

    const res = L.analyze(board.pieces);
    const f = board.flipped;

    // recompute the diff only when the position actually changed, otherwise
    // every redraw would compare a position with itself and wipe the marks
    const sig = board.pieces.map(p => p.square + p.color + p.type).sort().join(',');
    if (sig !== state.sig) {
      if (state.prevPieces) state.lastDiff = L.moveDiff(state.prevPieces, board.pieces);
      state.prevPieces = board.pieces;
      state.sig = sig;
    }

    if (state.weak) {
      // a square can be weak for both sides — draw it once
      for (const sq of new Set(res.weakWhite.concat(res.weakBlack))) {
        const { x, y } = xy(sq, f);
        svg.appendChild(el('rect', {
          x: x + 0.04, y: y + 0.04, width: 0.92, height: 0.92,
          fill: 'none', stroke: COLORS.weak, 'stroke-width': 0.04, opacity: 0.5
        }));
        // crossed-out pawn: "no pawn can ever cover this square"
        svg.appendChild(el('text', {
          x: x + 0.5, y: y + 0.55,
          'font-size': 0.42, 'text-anchor': 'middle', 'dominant-baseline': 'central',
          fill: COLORS.weak, opacity: 0.55
        }, '♟'));
        svg.appendChild(el('line', {
          x1: x + 0.34, y1: y + 0.68, x2: x + 0.66, y2: y + 0.32,
          stroke: COLORS.weak, 'stroke-width': 0.05, opacity: 0.75
        }));
      }
    }

    for (const m of res.underdefended) {
      const { x, y } = xy(m.square, f);
      svg.appendChild(el('circle', {
        cx: x + 0.5, cy: y + 0.5, r: 0.44,
        fill: 'none', stroke: COLORS.under, 'stroke-width': 0.08, opacity: 0.9
      }));
      // '≤' = enough defenders on paper, but a cheaper piece takes first
      const label = m.reason === 'cheap' ? '\u2264' : m.attackers + ':' + m.defenders;
      badge(svg, x, y, label, COLORS.under);
    }

    for (const m of res.hanging) {
      const { x, y } = xy(m.square, f);
      svg.appendChild(el('circle', {
        cx: x + 0.5, cy: y + 0.5, r: 0.46,
        fill: COLORS.hanging, opacity: 0.28
      }));
      svg.appendChild(el('circle', {
        cx: x + 0.5, cy: y + 0.5, r: 0.46,
        fill: 'none', stroke: COLORS.hanging, 'stroke-width': 0.07, opacity: 0.9
      }));
      badge(svg, x, y, '!', COLORS.hanging);
    }

    if (state.diff && state.lastDiff) {
      moveArrow(svg, state.lastDiff.from, state.lastDiff.to, f);
      for (const t of state.lastDiff.newThreats) {
        const { x, y } = xy(t.square, f);
        badge(svg, x, y, '→', COLORS.move, 'bl');
      }
    }
  }

  /* ---- legend ------------------------------------------------------- */

  const LEGEND_ID = 'chess-vision-legend';
  const STORE = 'chessVision.legendOpen';

  function legendOpen() {
    return localStorage.getItem(STORE) !== '0';
  }

  function buildLegend() {
    if (document.getElementById(LEGEND_ID)) return;

    const box = document.createElement('div');
    box.id = LEGEND_ID;

    const rows = [
      ['!', COLORS.hanging, 'wisi', 'atakowana, nikt nie broni'],
      ['2:1', COLORS.under, 'niedobroniona', 'atakujący : obrońcy'],
      ['≤', COLORS.under, 'tańszy bije', 'obrońcy są, ale i tak strata'],
      ['→', COLORS.move, 'nowy atak', 'to zrobił ostatni ruch'],
      ['♟', COLORS.weak, 'słabe pole', 'żaden pion już go nie pokryje']
    ];

    box.innerHTML =
      '<div class="cv-head">' +
        '<span class="cv-title">Chess Vision</span>' +
        '<button class="cv-toggle" type="button" title="zwiń">–</button>' +
      '</div>' +
      '<div class="cv-body">' +
        rows.map(([sym, color, name, desc]) =>
          '<div class="cv-row">' +
            '<span class="cv-chip" style="background:' + color + '">' + sym + '</span>' +
            '<span class="cv-name">' + name + '</span>' +
            '<span class="cv-desc">' + desc + '</span>' +
          '</div>').join('') +
        '<div class="cv-keys"><kbd>v</kbd> włącz/wyłącz &nbsp; <kbd>d</kbd> ostatni ruch &nbsp; <kbd>Shift</kbd>+<kbd>V</kbd> słabe pola</div>' +
      '</div>';

    document.body.appendChild(box);
    box.querySelector('.cv-toggle').addEventListener('click', () => {
      localStorage.setItem(STORE, legendOpen() ? '0' : '1');
      updateLegend();
    });
  }

  function updateLegend() {
    const box = document.getElementById(LEGEND_ID);
    if (!box) return;
    const open = legendOpen();
    box.classList.toggle('cv-collapsed', !open);
    box.classList.toggle('cv-off', !state.on);
    const btn = box.querySelector('.cv-toggle');
    btn.textContent = open ? '–' : '?';
    btn.title = open ? 'zwiń' : 'pokaż legendę';
    const keys = box.querySelector('.cv-keys');
    if (keys) keys.dataset.weak = state.weak ? '1' : '0';
  }

  /* ---- wiring ------------------------------------------------------- */

  let timer = null;
  function scheduleRender() {
    clearTimeout(timer);
    timer = setTimeout(render, 60);   // piece animation fires dozens of mutations
  }

  function attach() {
    const wrap = B.findWrap();
    if (!wrap || wrap === state.wrap) return;
    state.wrap = wrap;
    buildLegend();
    if (state.observer) state.observer.disconnect();
    state.observer = new MutationObserver(scheduleRender);
    state.observer.observe(wrap, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['style', 'class']
    });
    scheduleRender();
  }

  // lichess swaps boards without a page load (study chapters, next puzzle)
  new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
  attach();

  document.addEventListener('keydown', e => {
    // e.target is not always an Element (document, window), and lichess has
    // chat and comment boxes we must not steal keys from
    const t = e.target;
    if (t instanceof Element && t.closest('input, textarea, [contenteditable]')) return;
    if (e.key === 'v') { state.on = !state.on; render(); }
    if (e.key === 'V') { state.weak = !state.weak; state.on = true; render(); }
    if (e.key === 'd') { state.diff = !state.diff; render(); }
  });

  globalThis.chessVision = { render, state, COLORS };   // handy while developing
})();
