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
    threatfork: '#d4537e',
    backrank: '#e24b4a',
    weak: '#7c5cff',
    move: '#1d9e75'
  };

  const state = {
    on: true,
    weak: false,      // weak squares are noisy, off until asked for
    names: true,      // motif names — the word makes the picture stick
    maxMotifs: 3,     // a board with seven motifs on it shows nothing at all
    fade: true,       // scaffolding that removes itself as you learn
    peek: false,      // show everything again, whatever the counters say
    seen: null,       // how many times each motif kind has been shown
    diff: true,       // what the last move changed
    observer: null,
    wrap: null,
    prevPieces: null,
    sig: null,
    lastDiff: null,
    animate: false
  };

  /* The whole point of the extension is to stop being needed. A motif you have
     already been shown hundreds of times gets drawn quieter, then not at all —
     the geometry outlives the label, and the habit outlives the overlay.
     `p` brings everything back, and the learner mode can be switched off. */
  const SEEN_STORE = 'chessVision.seen';
  const FADE_STORE = 'chessVision.fade';
  const QUIET_AT = 40;    // drawn thinner, name drops away
  const GONE_AT = 150;    // not drawn at all unless asked for

  function loadProgress() {
    try {
      state.seen = JSON.parse(localStorage.getItem(SEEN_STORE)) || {};
    } catch (e) {
      state.seen = {};
    }
    state.fade = localStorage.getItem(FADE_STORE) !== '0';
  }

  function saveProgress() {
    try {
      localStorage.setItem(SEEN_STORE, JSON.stringify(state.seen));
    } catch (e) { /* private mode: learning still works, it just forgets */ }
  }

  function fadeLevel(kind) {
    if (!state.fade || state.peek) return 0;
    const n = (state.seen && state.seen[kind]) || 0;
    if (n >= GONE_AT) return 2;
    if (n >= QUIET_AT) return 1;
    return 0;
  }

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

  function drawMotif(svg, mo, f, o, level) {
    const color = COLORS[mo.kind] || COLORS.hanging;
    if (level === 2) return;
    if (level === 1) o = o * 0.55;
    const named = level === 0;

    if (mo.kind === 'pin' || mo.kind === 'skewer') {
      // one line running THROUGH the front piece to the prize behind it
      relation(svg, mo.origin, mo.through, f, color, { width: 0.06, opacity: o });
      ring(svg, mo.targets[0], f, color, 0.05, o);
      if (named) label(svg, mo.targets[0], mo.name, color, f, o);

    } else if (mo.kind === 'discovered') {
      // dashed, because the attack is not live yet — the blocker must move
      relation(svg, mo.origin, mo.through, f, color, { dashed: true, opacity: o });
      ring(svg, mo.targets[0], f, color, 0.05, o);
      if (named) label(svg, mo.targets[0], mo.name, color, f, o);

    } else if (mo.kind === 'fork') {
      // a fan of lines out of one square is always a fork
      for (const t of mo.targets) relation(svg, mo.origin, t, f, color, { width: 0.06, opacity: o });
      if (named) label(svg, mo.origin, mo.name, color, f, o);

    } else if (mo.kind === 'overload') {
      for (const t of mo.targets) relation(svg, mo.origin, t, f, color, { dashed: true, opacity: o });
      if (named) label(svg, mo.origin, mo.name, color, f, o);

    } else if (mo.kind === 'threatfork') {
      // the fan is dashed because the fork is not there yet, and the landing
      // square gets its own ring: that is the square you have to cover
      const land = mo.targets[0];
      for (const h of mo.hits) relation(svg, land, h, f, color, { dashed: true, opacity: o * 0.8 });
      const c = center(land, f);
      svg.appendChild(el('circle', {
        cx: c.x, cy: c.y, r: 0.4,
        fill: 'none', stroke: color, 'stroke-width': 0.055,
        'stroke-dasharray': '0.1 0.07', opacity: o,
        class: state.animate ? 'cv-pop' : null
      }));
      if (named) label(svg, land, mo.name, color, f, o);

    } else if (mo.kind === 'passed') {
      relation(svg, mo.origin, mo.targets[0], f, color, { dashed: true, gapB: 0.1, opacity: o });
      if (named) label(svg, mo.origin, mo.name, color, f, o);

    } else if (mo.kind === 'trapped' || mo.kind === 'backrank') {
      const p = xy(mo.origin, f);
      svg.appendChild(el('rect', {
        x: p.x + 0.06, y: p.y + 0.06, width: 0.88, height: 0.88, rx: 0.1,
        fill: 'none', stroke: color, 'stroke-width': 0.06,
        'stroke-dasharray': mo.kind === 'backrank' ? '0.12 0.08' : null,
        opacity: o,
        class: state.animate ? 'cv-pop' : null
      }));
      if (named) label(svg, mo.origin, mo.name, color, f, o);
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
    const changed = sig !== state.sig;
    if (changed) {
      if (state.prevPieces) state.lastDiff = L.moveDiff(state.prevPieces, board.pieces);
      state.prevPieces = board.pieces;
      state.sig = sig;
    }
    state.animate = changed;   // replay the draw-in only on a real move

    svg.replaceChildren();
    updateLegend();
    if (!state.on) return;

    const res = L.analyze(board.pieces);
    const f = board.flipped;
    const moved = state.animate;

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
      drawMotif(svg, mo, f, o, fadeLevel(mo.kind));
    }

    // one tick per motif kind per position, not per redraw
    if (moved) {
      let touched = false;
      for (const kind of new Set(shown.map(m => m.kind))) {
        state.seen[kind] = (state.seen[kind] || 0) + 1;
        touched = true;
      }
      if (touched) saveProgress();
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

  const SECTION_STORE = 'chessVision.tacticsOpen';

  function tacticsOpen() {
    return localStorage.getItem(SECTION_STORE) === '1';
  }

  function row(kind, color, name, desc) {
    return '<div class="cv-row"' + (kind ? ' data-kind="' + kind + '"' : '') + '>' +
      '<span class="cv-swatch" style="background:' + color + '"></span>' +
      '<span class="cv-text"><b>' + name + '</b><i>' + desc + '</i></span>' +
      (kind ? '<span class="cv-count"></span>' : '') +
    '</div>';
  }

  function buildLegend() {
    if (document.getElementById(LEGEND_ID)) return;

    const box = document.createElement('div');
    box.id = LEGEND_ID;

    // Deliberately two tiers: a first-time user meets three rows, not eleven.
    // The tactics list is there when curiosity arrives, folded until then.
    const tactics = [
      ['threatfork', COLORS.threatfork, 'grozi widelec', 'kółko = pole do pokrycia'],
      ['fork', COLORS.fork, 'widelec', 'wachlarz linii z jednej figury'],
      ['pin', COLORS.pin, 'związanie', 'linia na wylot do cenniejszej'],
      ['skewer', COLORS.skewer, 'szpikulec', 'cenniejsza z przodu musi uciec'],
      ['discovered', COLORS.discovered, 'odsłona', 'ruszysz ją, otworzysz atak'],
      ['overload', COLORS.overload, 'przeciążony', 'broni dwóch rzeczy naraz'],
      ['trapped', COLORS.trapped, 'uwięziona', 'nie ma bezpiecznego pola'],
      ['backrank', COLORS.backrank, 'ostatni rząd', 'król bez okienka'],
      ['passed', COLORS.passed, 'wolny pion', 'droga do promocji wolna']
    ];

    box.innerHTML =
      '<div class="cv-head">' +
        '<span class="cv-title">Chess Vision</span>' +
        '<button class="cv-toggle" type="button"></button>' +
      '</div>' +
      '<div class="cv-body">' +
        '<div class="cv-group">' +
          row(null, COLORS.hanging, 'wisi', 'linia ciągła: kto bije i co') +
          row(null, COLORS.under, 'strata', 'kreskowana: obrońców za mało') +
          row(null, COLORS.move, 'ostatni ruch', 'i co zaczął atakować') +
        '</div>' +
        '<button class="cv-more" type="button"></button>' +
        '<div class="cv-group cv-tactics">' + tactics.map(t => row(...t)).join('') + '</div>' +
        '<p class="cv-hint">Mocny kolor to zagrożenie przeciwnika, przygaszony to Twoja szansa.</p>' +
        '<div class="cv-actions">' +
          '<button class="cv-learn" type="button"></button>' +
          '<button class="cv-reset" type="button" title="wyzeruj postęp nauki">↺</button>' +
        '</div>' +
        '<div class="cv-keys"><kbd>v</kbd> nakładka <kbd>n</kbd> nazwy <kbd>m</kbd> ile ' +
        '<kbd>p</kbd> opanowane <kbd>d</kbd> ruch</div>' +
      '</div>';

    document.body.appendChild(box);

    box.querySelector('.cv-toggle').addEventListener('click', () => {
      localStorage.setItem(STORE, legendOpen() ? '0' : '1');
      updateLegend();
    });
    box.querySelector('.cv-more').addEventListener('click', () => {
      localStorage.setItem(SECTION_STORE, tacticsOpen() ? '0' : '1');
      updateLegend();
    });
    box.querySelector('.cv-learn').addEventListener('click', () => {
      state.fade = !state.fade;
      localStorage.setItem(FADE_STORE, state.fade ? '1' : '0');
      render();
    });
    box.querySelector('.cv-reset').addEventListener('click', () => {
      state.seen = {};
      saveProgress();
      render();
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

    const more = box.querySelector('.cv-more');
    const showTactics = tacticsOpen();
    box.classList.toggle('cv-tactics-open', showTactics);
    more.textContent = (showTactics ? '▾ ' : '▸ ') + 'taktyki';

    const learn = box.querySelector('.cv-learn');
    learn.textContent = state.fade ? 'Tryb ucznia' : 'Tryb ucznia: off';
    learn.title = state.fade
      ? 'znaki blakną i znikają, gdy motyw masz już opanowany'
      : 'wszystko rysowane pełną siłą, bez wycofywania';
    learn.classList.toggle('cv-on', state.fade);

    // the counters are the progress bar: you watch the scaffolding retreat
    for (const r of box.querySelectorAll('.cv-row[data-kind]')) {
      const n = (state.seen && state.seen[r.dataset.kind]) || 0;
      const level = !state.fade ? 0 : n >= GONE_AT ? 2 : n >= QUIET_AT ? 1 : 0;
      r.querySelector('.cv-count').textContent = n || '';
      r.classList.toggle('cv-quiet', level === 1);
      r.classList.toggle('cv-mastered', level === 2);
    }
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

  loadProgress();

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
    if (e.key === 'p') { state.peek = !state.peek; render(); }
    if (e.key === 'm') {
      state.maxMotifs = state.maxMotifs === 3 ? 6 : state.maxMotifs === 6 ? 99 : 3;
      render();
    }
  });

  globalThis.chessVision = {   // handy while developing
    render, state, COLORS,
    resetProgress() { state.seen = {}; saveProgress(); render(); }
  };
})();
