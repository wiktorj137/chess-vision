/* Pure position logic: no DOM here, so it can be unit-tested under Node.
   A "piece" is {square:'e4', color:'w'|'b', type:'p'|'n'|'b'|'r'|'q'|'k'}. */
(function (root) {
  'use strict';

  const FILES = 'abcdefgh';

  function toIdx(square) {
    return { file: FILES.indexOf(square[0]), rank: +square[1] - 1 };
  }
  function toSquare(file, rank) {
    return FILES[file] + (rank + 1);
  }
  function onBoard(file, rank) {
    return file >= 0 && file < 8 && rank >= 0 && rank < 8;
  }

  const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const DIAG = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /* Squares a single piece attacks. Sliders stop at the first occupied square
     but still attack it — that is what makes capture counting work. */
  function attacksFrom(piece, grid) {
    const { file, rank } = toIdx(piece.square);
    const out = [];
    const push = (f, r) => { if (onBoard(f, r)) out.push(toSquare(f, r)); };

    if (piece.type === 'p') {
      const dir = piece.color === 'w' ? 1 : -1;
      push(file - 1, rank + dir);
      push(file + 1, rank + dir);
      return out;
    }
    if (piece.type === 'n') {
      KNIGHT.forEach(([df, dr]) => push(file + df, rank + dr));
      return out;
    }
    if (piece.type === 'k') {
      DIAG.concat(ORTHO).forEach(([df, dr]) => push(file + df, rank + dr));
      return out;
    }

    let dirs;
    if (piece.type === 'b') dirs = DIAG;
    else if (piece.type === 'r') dirs = ORTHO;
    else dirs = DIAG.concat(ORTHO);

    for (const [df, dr] of dirs) {
      let f = file + df, r = rank + dr;
      while (onBoard(f, r)) {
        out.push(toSquare(f, r));
        if (grid[f][r]) break;
        f += df; r += dr;
      }
    }
    return out;
  }

  function buildGrid(pieces) {
    const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (const p of pieces) {
      const { file, rank } = toIdx(p.square);
      if (onBoard(file, rank)) grid[file][rank] = p;
    }
    return grid;
  }

  /* square -> {w: [attacking pieces], b: [...]} */
  function attackMap(pieces) {
    const grid = buildGrid(pieces);
    const map = new Map();
    for (const p of pieces) {
      for (const sq of attacksFrom(p, grid)) {
        let e = map.get(sq);
        if (!e) map.set(sq, e = { w: [], b: [] });
        e[p.color].push(p);
      }
    }
    return map;
  }

  const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

  /* Squares no enemy pawn can ever attack again, in the middle of the board.
     "weak for white" means White can no longer cover it with a pawn. */
  function weakSquares(pieces, color) {
    const pawns = pieces.filter(p => p.type === 'p' && p.color === color);
    const dir = color === 'w' ? 1 : -1;
    const out = [];
    for (let file = 0; file < 8; file++) {
      for (let rank = 2; rank <= 5; rank++) {
        const covered = pawns.some(p => {
          const i = toIdx(p.square);
          if (Math.abs(i.file - file) !== 1) return false;
          // pawn must still be behind the square to ever attack it
          return dir > 0 ? i.rank < rank : i.rank > rank;
        });
        if (!covered) out.push(toSquare(file, rank));
      }
    }
    return out;
  }


  /* What did the last move change? Compares two positions and reports which
     enemy pieces the mover now hits that it did not hit before. No engine,
     no "best move" — just the consequence of the move that was played. */
  function moveDiff(prev, cur) {
    if (!prev || !prev.length) return null;

    const key = p => p.square + p.color + p.type;
    const prevKeys = new Set(prev.map(key));
    const curKeys = new Set(cur.map(key));
    const gone = prev.filter(p => !curKeys.has(key(p)));
    const appeared = cur.filter(p => !prevKeys.has(key(p)));

    // castling moves two pieces, promotion changes the type: skip both
    if (gone.length === 0 || appeared.length !== 1) return null;
    const to = appeared[0];
    const from = gone.find(p => p.color === to.color && p.type === to.type);
    if (!from || from.square === to.square) return null;

    const beforeGrid = buildGrid(prev);
    const afterGrid = buildGrid(cur);
    const before = new Set(attacksFrom(from, beforeGrid));
    const after = attacksFrom(to, afterGrid);

    const enemy = to.color === 'w' ? 'b' : 'w';
    const occupied = new Map(cur.map(p => [p.square, p]));

    const newThreats = [];
    for (const sq of after) {
      if (before.has(sq)) continue;
      const target = occupied.get(sq);
      if (target && target.color === enemy && target.type !== 'k') {
        newThreats.push({ square: sq, type: target.type });
      }
    }

    return { from: from.square, to: to.square, color: to.color, type: to.type, newThreats };
  }

  /* The three marks the overlay draws. */
  function analyze(pieces) {
    const map = attackMap(pieces);
    const hanging = [];
    const underdefended = [];

    for (const p of pieces) {
      if (p.type === 'k') continue;
      const e = map.get(p.square);
      if (!e) continue;
      const foes = p.color === 'w' ? e.b : e.w;
      const friends = p.color === 'w' ? e.w : e.b;
      if (foes.length === 0) continue;

      if (friends.length === 0) {
        hanging.push({ square: p.square, color: p.color, value: VALUE[p.type] });
      } else if (foes.length > friends.length) {
        underdefended.push({
          square: p.square, color: p.color,
          attackers: foes.length, defenders: friends.length,
          reason: 'count'
        });
      } else {
        // enough defenders, but a cheaper attacker still wins material
        const cheapestFoe = Math.min(...foes.map(f => VALUE[f.type]));
        if (cheapestFoe < VALUE[p.type]) {
          underdefended.push({
            square: p.square, color: p.color,
            attackers: foes.length, defenders: friends.length,
            reason: 'cheap'
          });
        }
      }
    }

    return {
      hanging,
      underdefended,
      weakWhite: weakSquares(pieces, 'w'),
      weakBlack: weakSquares(pieces, 'b'),
      attackMap: map
    };
  }

  const api = { attacksFrom, attackMap, weakSquares, analyze, moveDiff, toIdx, toSquare, buildGrid };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChessVisionLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
