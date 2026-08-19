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


  /* Named motifs. Every one of them is a *relation* between squares, never a
     single square — that is the whole point: the overlay draws the line, and
     the line is what sticks in memory. */

  const SLIDER_DIRS = { b: DIAG, r: ORTHO, q: DIAG.concat(ORTHO) };

  /* Walks one direction from a square, returning the occupied squares it meets
     in order. Used for pins, where we need the piece *behind* the target. */
  function rayPieces(from, df, dr, grid, limit) {
    const { file, rank } = toIdx(from);
    const found = [];
    let f = file + df, r = rank + dr;
    while (onBoard(f, r) && found.length < limit) {
      const piece = grid[f][r];
      if (piece) found.push(piece);
      f += df; r += dr;
    }
    return found;
  }

  function forks(pieces, grid) {
    const out = [];
    for (const p of pieces) {
      const enemy = p.color === 'w' ? 'b' : 'w';
      const hit = [];
      for (const sq of attacksFrom(p, grid)) {
        const { file, rank } = toIdx(sq);
        const target = grid[file][rank];
        // only real prey: a fork on two pawns is not worth drawing
        if (target && target.color === enemy && VALUE[target.type] >= 3) hit.push(sq);
      }
      if (hit.length >= 2) {
        out.push({
          kind: 'fork', name: 'widelec', color: p.color, origin: p.square, targets: hit,
          weight: hit.reduce((n, sq) => {
            const i = toIdx(sq);
            return n + VALUE[grid[i.file][i.rank].type];
          }, 0)
        });
      }
    }
    return out;
  }

  /* Pin and skewer are the same geometry seen from two sides: a line through
     one enemy piece onto another. Which one it is depends on which end is
     worth more, so they are detected together. */
  function pins(pieces, grid) {
    const out = [];
    for (const p of pieces) {
      const dirs = SLIDER_DIRS[p.type];
      if (!dirs) continue;
      const enemy = p.color === 'w' ? 'b' : 'w';
      for (const [df, dr] of dirs) {
        const [front, behind] = rayPieces(p.square, df, dr, grid, 2);
        if (!front || !behind) continue;
        if (front.color !== enemy || behind.color !== enemy) continue;

        if (VALUE[behind.type] > VALUE[front.type]) {
          out.push({
            kind: 'pin', name: behind.type === 'k' ? 'związanie bezwzględne' : 'związanie',
            color: p.color, origin: p.square, targets: [front.square], through: behind.square,
            weight: VALUE[behind.type]
          });
        } else if (VALUE[front.type] > VALUE[behind.type] && VALUE[front.type] >= 5) {
          // the valuable piece stands in front and must move, exposing the one behind
          out.push({
            kind: 'skewer', name: 'szpikulec',
            color: p.color, origin: p.square, targets: [front.square], through: behind.square,
            weight: VALUE[behind.type] + 1
          });
        }
      }
    }
    return out;
  }

  /* A friendly piece standing between our own slider and an enemy target:
     moving it uncovers the attack. The classic setup nobody sees coming. */
  function discovered(pieces, grid) {
    const out = [];
    for (const p of pieces) {
      const dirs = SLIDER_DIRS[p.type];
      if (!dirs) continue;
      const enemy = p.color === 'w' ? 'b' : 'w';
      for (const [df, dr] of dirs) {
        const [front, behind] = rayPieces(p.square, df, dr, grid, 2);
        if (!front || !behind) continue;
        if (front.color !== p.color || behind.color !== enemy) continue;
        if (VALUE[behind.type] < 3) continue;
        out.push({
          kind: 'discovered',
          name: behind.type === 'k' ? 'odsłonięty szach' : 'odsłona',
          color: p.color, origin: p.square, targets: [front.square], through: behind.square,
          weight: VALUE[behind.type]
        });
      }
    }
    return out;
  }

  /* A piece that is attacked and has nowhere safe to go. Worth seeing early,
     because the cure is always a move earlier than the diagnosis. */
  function trapped(pieces, grid, map) {
    const out = [];
    for (const p of pieces) {
      if (p.type === 'k' || p.type === 'p' || VALUE[p.type] < 3) continue;
      const enemy = p.color === 'w' ? 'b' : 'w';
      const here = map.get(p.square);
      if (!here || !here[enemy].length) continue;          // not attacked, not trapped

      let escape = false;
      for (const sq of attacksFrom(p, grid)) {
        const { file, rank } = toIdx(sq);
        const occupant = grid[file][rank];
        if (occupant && occupant.color === p.color) continue;   // own piece blocks
        const e = map.get(sq);
        const attacked = e && e[enemy].length;
        // capturing something valuable is an escape even onto an attacked square
        if (!attacked || (occupant && VALUE[occupant.type] >= VALUE[p.type])) { escape = true; break; }
      }
      if (!escape) {
        out.push({
          kind: 'trapped', name: 'uwięziona', color: enemy,
          origin: p.square, targets: [], weight: VALUE[p.type]
        });
      }
    }
    return out;
  }

  /* Passed pawn: no enemy pawn can stop it on its file or the two beside it. */
  function passedPawns(pieces) {
    const out = [];
    for (const p of pieces) {
      if (p.type !== 'p') continue;
      const enemy = p.color === 'w' ? 'b' : 'w';
      const dir = p.color === 'w' ? 1 : -1;
      const me = toIdx(p.square);
      const blocked = pieces.some(q => {
        if (q.type !== 'p' || q.color !== enemy) return false;
        const o = toIdx(q.square);
        if (Math.abs(o.file - me.file) > 1) return false;
        return dir > 0 ? o.rank > me.rank : o.rank < me.rank;
      });
      if (blocked) continue;
      const goal = toSquare(me.file, p.color === 'w' ? 7 : 0);
      // how close to promotion decides how loudly it should shout
      const steps = p.color === 'w' ? 7 - me.rank : me.rank;
      out.push({
        kind: 'passed', name: 'wolny pion', color: p.color,
        origin: p.square, targets: [goal], weight: Math.max(2, 9 - steps)
      });
    }
    return out;
  }

  function overloaded(pieces, grid, map) {
    const out = [];
    for (const d of pieces) {
      if (d.type === 'k') continue;
      const enemy = d.color === 'w' ? 'b' : 'w';
      const duties = [];
      for (const sq of attacksFrom(d, grid)) {
        const { file, rank } = toIdx(sq);
        const friend = grid[file][rank];
        if (!friend || friend.color !== d.color || friend.type === 'k') continue;
        const e = map.get(sq);
        if (e && e[enemy].length) duties.push(sq);   // it is defending something under fire
      }
      if (duties.length >= 2) {
        out.push({
          kind: 'overload', name: 'przeciążony', color: enemy,
          origin: d.square, targets: duties,
          weight: duties.reduce((n, sq) => {
            const i = toIdx(sq);
            return n + VALUE[grid[i.file][i.rank].type];
          }, 0)
        });
      }
    }
    return out;
  }

  function backRank(pieces, grid) {
    const out = [];
    for (const k of pieces) {
      if (k.type !== 'k') continue;
      const home = k.color === 'w' ? 0 : 7;
      const { file, rank } = toIdx(k.square);
      if (rank !== home) continue;

      const enemy = k.color === 'w' ? 'b' : 'w';
      const heavy = pieces.some(p => p.color === enemy && (p.type === 'r' || p.type === 'q'));
      if (!heavy) continue;   // no rook or queen, no mate to worry about

      const dir = k.color === 'w' ? 1 : -1;
      const escapes = [];
      for (const df of [-1, 0, 1]) {
        const f = file + df, r = rank + dir;
        if (!onBoard(f, r)) continue;
        escapes.push(grid[f][r]);
      }
      if (!escapes.length || !escapes.every(sq => sq && sq.color === k.color)) continue;

      // only worth saying when a heavy piece can actually get to that rank:
      // already there, or standing on a file with nothing in the way
      const reachable = pieces.some(q => {
        if (q.color !== enemy || (q.type !== 'r' && q.type !== 'q')) return false;
        const o = toIdx(q.square);
        if (o.rank === home) return true;
        const step = o.rank > home ? -1 : 1;
        for (let r = o.rank + step; r !== home; r += step) {
          if (grid[o.file][r]) return false;
        }
        return !grid[o.file][home] || grid[o.file][home].color === enemy;
      });
      if (!reachable) continue;

      out.push({
        kind: 'backrank', name: 'ostatni rząd', color: enemy,
        origin: k.square, targets: [], weight: 12
      });
    }
    return out;
  }

  /* Every motif carries `color` = the side that BENEFITS from it, and
     `weight` = how much material is at stake, so the overlay can show the
     three that matter and drop the rest instead of burying the board. */
  function motifs(pieces) {
    const grid = buildGrid(pieces);
    const map = attackMap(pieces);
    return [].concat(
      pins(pieces, grid),
      discovered(pieces, grid),
      forks(pieces, grid),
      overloaded(pieces, grid, map),
      trapped(pieces, grid, map),
      backRank(pieces, grid),
      passedPawns(pieces)
    ).sort((a, b) => b.weight - a.weight);
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
        hanging.push({
          square: p.square, color: p.color, value: VALUE[p.type],
          from: foes.map(f => f.square)
        });
      } else if (foes.length > friends.length) {
        underdefended.push({
          square: p.square, color: p.color,
          attackers: foes.length, defenders: friends.length,
          from: foes.map(f => f.square), reason: 'count'
        });
      } else {
        // enough defenders, but a cheaper attacker still wins material
        const cheapestFoe = Math.min(...foes.map(f => VALUE[f.type]));
        if (cheapestFoe < VALUE[p.type]) {
          underdefended.push({
            square: p.square, color: p.color,
            attackers: foes.length, defenders: friends.length,
            from: foes.map(f => f.square), reason: 'cheap'
          });
        }
      }
    }

    return {
      hanging,
      underdefended,
      motifs: motifs(pieces),
      weakWhite: weakSquares(pieces, 'w'),
      weakBlack: weakSquares(pieces, 'b'),
      attackMap: map
    };
  }

  const api = { attacksFrom, attackMap, weakSquares, analyze, motifs, moveDiff, toIdx, toSquare, buildGrid };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChessVisionLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
