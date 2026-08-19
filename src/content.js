/* Draws the overlay and keeps it in sync with the board.

   Design rule: a threat is a RELATION between two squares, so it is drawn as a
   line, never as a coloured square. A line has direction and length — that is
   what the eye remembers ("the bishop cuts the whole long diagonal"), and a
   tinted square is forgotten the moment it disappears.

   Every motif keeps the same shape wherever it occurs, so the shape itself
   becomes recognisable: a fan of lines out of one piece is always a fork, a
   line running through a piece is always a pin. */
(function () {
  'use strict';

  const L = globalThis.ChessVisionLogic;
  const B = globalThis.ChessVisionBoard;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ID = 'chess-vision-overlay';

  const COLORS = {
    hanging: '#e02020',
    under: '#f0a020',
    fork: '#d4537e',
    pin: '#378add',
    skewer: '#378add',
    discovered: '#7048c4',
    overload: '#d85a30',
    trapped: '#a32d2d',
    passed: '#ba7517',
    backrank: '#e24b4a',
    weak: '#7c5cff',
    move: '#1d9e75'
  };

  const state = {
    on: true,
    weak: false,      // weak squares are noisy, off until asked for
    names: true,      // motif names — the word makes the picture stick
    maxMotifs: 3,     // a board with seven motifs on it shows nothing at all
    diff: true,       // what the last move changed
    observer: null,
    wrap: null,
    prevPieces: null,
    sig: null,
    lastDiff: null,
    animate: false
  };

  function xy(square, flipped) {
    const file = 'abcdefgh'.indexOf(square[0]);
    const rank = +square[1] - 1;
    return flipped ? { x: 7 - file, y: rank } : { x: file, y: 7 - rank };
  }
  function center(square, flipped) {
    const p = xy(square, flipped);
    return { x: p.x + 0.5, y: p.y + 0.5 };
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
    // setAttribute('class', null) writes the string "null" — skip empty values
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---- the vocabulary -------------------------------------------------- */

  /* A relation line. Stops short of both squares so the pieces stay readable
     and the direction of the threat is obvious. */
  function relation(svg, fromSq, toSq, flipped, color, opts) {
    opts = opts || {};
    const a = center(fromSq, flipped), b = center(toSq, flipped);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    const gapA = opts.gapA == null ? 0.34 : opts.gapA;
    const gapB = opts.gapB == null ? 0.34 : opts.gapB;

    const line = el('line', {
      x1: a.x + ux * gapA, y1: a.y + uy * gapA,
      x2: b.x - ux * gapB, y2: b.y - uy * gapB,
      stroke: color, 'stroke-width': opts.width || 0.055,
      'stroke-linecap': 'round',
      opacity: opts.opacity == null ? 0.85 : opts.opacity,
      pathLength: 1
    });
    if (opts.dashed) line.setAttribute('stroke-dasharray', '0.06 0.06');
    else if (state.animate) line.setAttribute('class', 'cv-draw');
    svg.appendChild(line);

    // a dot at the origin: "the threat starts here"
    svg.appendChild(el('circle', {
      cx: a.x + ux * gapA, cy: a.y + uy * gapA, r: 0.055,
      fill: color, opacity: opts.opacity == null ? 0.85 : opts.opacity
    }));
  }

  /* Thin ring around the piece under threat — marks the target without
     flooding the square with colour. */
  function ring(svg, square, flipped, color, width, opacity) {
    const c = center(square, flipped);
    svg.appendChild(el('circle', {
      cx: c.x, cy: c.y, r: 0.44,
      fill: 'none', stroke: color, 'stroke-width': width || 0.05,
      opacity: opacity == null ? 0.9 : opacity,
      class: state.animate ? 'cv-pop' : null
    }));
  }

  /* The motif name, in words. Picture plus word beats picture alone — this is
     why coaches make you say "fork" out loud. */
  function label(svg, square, text, color, flipped, opacity) {
    if (!state.names) return;
    const c = center(square, flipped);
    const w = text.length * 0.108 + 0.18;
    const h = 0.28;
    let x = c.x - w / 2;
    let y = c.y - 0.72;
    x = Math.max(0.02, Math.min(8 - w - 0.02, x));
    y = Math.max(0.02, Math.min(8 - h - 0.02, y));

    const g = el('g', { class: state.animate ? 'cv-pop' : null });
    g.appendChild(el('rect', {
      x, y, width: w, height: h, rx: 0.09, fill: color,
      opacity: opacity == null ? 0.95 : opacity
    }));
    g.appendChild(el('text', {
      x: x + w / 2, y: y + h / 2 + 0.005,
      'font-size': 0.2, 'font-family': 'sans-serif', 'font-weight': 'bold',
      'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff'
    }, text));
    svg.appendChild(g);
  }

  function badge(svg, x, y, text, fill, corner) {
    const wide = text.length > 1;
    const w = wide ? 0.5 : 0.32;
    const h = 0.3;
    const bx = corner === 'bl' ? x + 0.02 : x + 0.98 - w;
    const by = corner === 'bl' ? y + 0.98 - h : y + 0.02;
    svg.appendChild(el('rect', { x: bx, y: by, width: w, height: h, rx: 0.09, fill, opacity: 0.95 }));
    svg.appendChild(el('text', {
      x: bx + w / 2, y: by + h / 2 + 0.005,
      'font-size': 0.22, 'font-family': 'sans-serif', 'font-weight': 'bold',
      'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff'
    }, text));
  }

  function moveArrow(svg, from, to, flipped) {
    const a = center(from, flipped), b = center(to, flipped);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    const tipX = b.x - ux * 0.18, tipY = b.y - uy * 0.18;
    const backX = tipX - ux * 0.26, backY = tipY - uy * 0.26;

    svg.appendChild(el('line', {
      x1: a.x + ux * 0.28, y1: a.y + uy * 0.28, x2: backX, y2: backY,
      stroke: COLORS.move, 'stroke-width': 0.07, 'stroke-linecap': 'round', opacity: 0.7,
      pathLength: 1, class: state.animate ? 'cv-draw' : null
    }));
    svg.appendChild(el('polygon', {
      points: [
        tipX + ',' + tipY,
        (backX - uy * 0.13) + ',' + (backY + ux * 0.13),
        (backX + uy * 0.13) + ',' + (backY - ux * 0.13)
      ].join(' '),
      fill: COLORS.move, opacity: 0.7
    }));
  }

  function drawMotif(svg, mo, f, o) {
    const color = COLORS[mo.kind] || COLORS.hanging;

    if (mo.kind === 'pin' || mo.kind === 'skewer') {
      // one line running THROUGH the front piece to the prize behind it
      relation(svg, mo.origin, mo.through, f, color, { width: 0.06, opacity: o });
      ring(svg, mo.targets[0], f, color, 0.05, o);
      label(svg, mo.targets[0], mo.name, color, f, o);

    } else if (mo.kind === 'discovered') {
      // dashed, because the attack is not live yet — the blocker must move
      relation(svg, mo.origin, mo.through, f, color, { dashed: true, opacity: o });
      ring(svg, mo.targets[0], f, color, 0.05, o);
      label(svg, mo.targets[0], mo.name, color, f, o);

    } else if (mo.kind === 'fork') {
      // a fan of lines out of one square is always a fork
      for (const t of mo.targets) relation(svg, mo.origin, t, f, color, { width: 0.06, opacity: o });
      label(svg, mo.origin, mo.name, color, f, o);

    } else if (mo.kind === 'overload') {
      for (const t of mo.targets) relation(svg, mo.origin, t, f, color, { dashed: true, opacity: o });
      label(svg, mo.origin, mo.name, color, f, o);

    } else if (mo.kind === 'passed') {
      relation(svg, mo.origin, mo.targets[0], f, color, { dashed: true, gapB: 0.1, opacity: o });
      label(svg, mo.origin, mo.name, color, f, o);

    } else if (mo.kind === 'trapped' || mo.kind === 'backrank') {
      const p = xy(mo.origin, f);
      svg.appendChild(el('rect', {
        x: p.x + 0.06, y: p.y + 0.06, width: 0.88, height: 0.88, rx: 0.1,
        fill: 'none', stroke: color, 'stroke-width': 0.06,
        'stroke-dasharray': mo.kind === 'backrank' ? '0.12 0.08' : null,
        opacity: o,
        class: state.animate ? 'cv-pop' : null
      }));
      label(svg, mo.origin, mo.name, color, f, o);
    }
  }

  /* ---- rendering ------------------------------------------------------- */

  function render() {
    const board = B.readBoard(state.wrap);
    if (!board) return;
    const svg = ensureSvg(board.wrap);

    // recompute the diff only when the position actually changed, otherwise
    // every redraw would compare a position with itself and wipe the marks
    const sig = board.pieces.map(p => p.square + p.color + p.type).sort().join(',');
    const moved = sig !== state.sig;
    if (moved) {
      if (state.prevPieces) state.lastDiff = L.moveDiff(state.prevPieces, board.pieces);
      state.prevPieces = board.pieces;
      state.sig = sig;
    }
    state.animate = moved;   // replay the draw-in only on a real move

    svg.replaceChildren();
    updateLegend();
    if (!state.on) return;

    const res = L.analyze(board.pieces);
    const f = board.flipped;

    if (state.weak) {
      // a square can be weak for both sides — draw it once
      for (const sq of new Set(res.weakWhite.concat(res.weakBlack))) {
        const p = xy(sq, f);
        svg.appendChild(el('rect', {
          x: p.x + 0.04, y: p.y + 0.04, width: 0.92, height: 0.92,
          fill: 'none', stroke: COLORS.weak, 'stroke-width': 0.04, opacity: 0.45
        }));
        svg.appendChild(el('text', {
          x: p.x + 0.5, y: p.y + 0.55,
          'font-size': 0.4, 'text-anchor': 'middle', 'dominant-baseline': 'central',
          fill: COLORS.weak, opacity: 0.5
        }, '♟'));
        svg.appendChild(el('line', {
          x1: p.x + 0.34, y1: p.y + 0.68, x2: p.x + 0.66, y2: p.y + 0.32,
          stroke: COLORS.weak, 'stroke-width': 0.05, opacity: 0.7
        }));
      }
    }

    // underdefended: dashed line — "this costs material", not "this is free"
    for (const m of res.underdefended) {
      for (const a of m.from) relation(svg, a, m.square, f, COLORS.under, { dashed: true });
      ring(svg, m.square, f, COLORS.under, 0.05);
      const p = xy(m.square, f);
      badge(svg, p.x, p.y, m.reason === 'cheap' ? '≤' : m.attackers + ':' + m.defenders, COLORS.under);
    }

    // hanging: solid line — the strongest signal on the board
    for (const m of res.hanging) {
      for (const a of m.from) relation(svg, a, m.square, f, COLORS.hanging, { width: 0.065 });
      ring(svg, m.square, f, COLORS.hanging, 0.06);
      const p = xy(m.square, f);
      badge(svg, p.x, p.y, '!', COLORS.hanging);
    }

    // Your own chances are drawn quietly, the opponent's threats loudly.
    // Which is which is the single most important thing on the board.
    const you = f ? 'b' : 'w';
    const threats = res.motifs.filter(m => m.color !== you);
    const chances = res.motifs.filter(m => m.color === you);
    const shown = threats.slice(0, state.maxMotifs)
      .concat(chances.slice(0, Math.max(0, state.maxMotifs - Math.min(threats.length, state.maxMotifs))));

    for (const mo of shown) {
      const strong = mo.color !== you;
      const o = strong ? 0.85 : 0.32;
      drawMotif(svg, mo, f, o);
    }

    if (state.diff && state.lastDiff) {
      moveArrow(svg, state.lastDiff.from, state.lastDiff.to, f);
      for (const t of state.lastDiff.newThreats) {
        const p = xy(t.square, f);
        badge(svg, p.x, p.y, '→', COLORS.move, 'bl');
      }
    }
  }

  /* ---- legend ---------------------------------------------------------- */

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
      [COLORS.hanging, 'wisi', 'linia ciągła: kto bije i co'],
      [COLORS.under, 'strata', 'kreskowana: obrońcy są, ale za mało'],
      [COLORS.fork, 'widelec', 'wachlarz linii z jednej figury'],
      [COLORS.pin, 'związanie', 'linia na wylot do cenniejszej'],
      [COLORS.discovered, 'odsłona', 'ruszysz figurę, otworzysz atak'],
      [COLORS.overload, 'przeciążony', 'broni dwóch rzeczy naraz'],
      [COLORS.trapped, 'uwięziona', 'nie ma bezpiecznego pola'],
      [COLORS.backrank, 'ostatni rząd', 'król bez okienka'],
      [COLORS.passed, 'wolny pion', 'droga do promocji wolna'],
      [COLORS.move, 'ostatni ruch', 'i co zaczął atakować']
    ];

    box.innerHTML =
      '<div class="cv-head">' +
        '<span class="cv-title">Chess Vision</span>' +
        '<button class="cv-toggle" type="button" title="zwiń">–</button>' +
      '</div>' +
      '<div class="cv-body">' +
        rows.map(([color, name, desc]) =>
          '<div class="cv-row">' +
            '<span class="cv-swatch" style="background:' + color + '"></span>' +
            '<span class="cv-name">' + name + '</span>' +
            '<span class="cv-desc">' + desc + '</span>' +
          '</div>').join('') +
        '<div class="cv-hint">Mocny kolor = zagrożenie przeciwnika. ' +
        'Przygaszony = Twoja szansa.</div>' +
        '<div class="cv-keys"><kbd>v</kbd> nakładka &nbsp; <kbd>n</kbd> nazwy &nbsp; ' +
        '<kbd>m</kbd> ile motywów &nbsp; <kbd>d</kbd> ostatni ruch &nbsp; ' +
        '<kbd>Shift</kbd>+<kbd>V</kbd> słabe pola</div>' +
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
  }

  /* ---- wiring ---------------------------------------------------------- */

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
    // our own SVG lives inside the observed wrap, so drawing it triggers the
    // observer again — that second pass wiped the animation classes
    state.observer = new MutationObserver(records => {
      const ours = records.every(r => {
        const node = r.target;
        return node instanceof Element && node.closest('#' + ID);
      });
      if (!ours) scheduleRender();
    });
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
    if (e.key === 'n') { state.names = !state.names; render(); }
    if (e.key === 'd') { state.diff = !state.diff; render(); }
    if (e.key === 'm') {
      state.maxMotifs = state.maxMotifs === 3 ? 6 : state.maxMotifs === 6 ? 99 : 3;
      render();
    }
  });

  globalThis.chessVision = { render, state, COLORS };   // handy while developing
})();
