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


  /* Which pieces are nailed to their own king, and where they may still go.

     A piece pinned against its own king cannot step off the pin line — so it
     cannot really capture, and it cannot really defend. Counting it as a full
     attacker is how the overlay ends up shouting "hanging!" at a queen that is
     perfectly safe, which is exactly the position this was written for. */
  function absolutePins(pieces, grid) {
    const pinned = new Map();

    for (const king of pieces) {
      if (king.type !== 'k') continue;
      const enemy = king.color === 'w' ? 'b' : 'w';
      const { file, rank } = toIdx(king.square);

      for (const [df, dr] of DIAG.concat(ORTHO)) {
        const diagonal = df !== 0 && dr !== 0;
        let f = file + df, r = rank + dr;
        let shield = null;
        const ray = [];

        while (onBoard(f, r)) {
          const here = grid[f][r];
          ray.push(toSquare(f, r));
          if (here) {
            if (!shield) {
              if (here.color !== king.color) break;   // enemy piece, no pin
              shield = here;
            } else {
              // second piece along the ray: a pinner only if it slides this way
              const slides = here.type === 'q' ||
                (diagonal ? here.type === 'b' : here.type === 'r');
              if (here.color === enemy && slides) {
                // the shield may move along the ray, including taking the pinner
                pinned.set(shield.square, new Set(ray));
              }
              break;
            }
          }
          f += df; r += dr;
        }
      }
    }
    return pinned;
  }

  /* Squares a piece really bears on, once the pin is taken into account. */
  function liveAttacks(piece, grid, pinned) {
    const raw = attacksFrom(piece, grid);
    const allowed = pinned && pinned.get(piece.square);
    if (!allowed) return raw;
    return raw.filter(sq => allowed.has(sq));
  }


  /* Squares a slider reaches THROUGH a friendly slider pointing the same way.

     A queen behind a bishop is not blocked, it is loaded: when the bishop
     captures, the queen takes over the diagonal. Counting only the front piece
     is how the overlay decides a pawn defended by its king is safe, when in
     fact the king cannot even recapture. */
  function batteryAttacks(piece, grid) {
    const dirs = SLIDER_DIRS[piece.type];
    if (!dirs) return [];
    const { file, rank } = toIdx(piece.square);
    const out = [];

    for (const [df, dr] of dirs) {
      const diagonal = df !== 0 && dr !== 0;
      let f = file + df, r = rank + dr, behind = false;

      while (onBoard(f, r)) {
        const here = grid[f][r];
        if (behind) out.push(toSquare(f, r));
        if (here) {
          const slides = here.type === 'q' ||
            (diagonal ? here.type === 'b' : here.type === 'r');
          if (here.color === piece.color && slides) behind = true;   // stacked
          else break;
        }
        f += df; r += dr;
      }
    }
    return out;
  }

  /* square -> {w: [attacking pieces], b: [...]} */
  function attackMap(pieces, respectPins) {
    const grid = buildGrid(pieces);
    const pinned = respectPins ? absolutePins(pieces, grid) : null;
    const map = new Map();
    const add = (sq, p) => {
      let e = map.get(sq);
      if (!e) map.set(sq, e = { w: [], b: [] });
      if (!e[p.color].includes(p)) e[p.color].push(p);
    };

    for (const p of pieces) {
      const allowed = pinned && pinned.get(p.square);
      for (const sq of liveAttacks(p, grid, pinned)) add(sq, p);
      for (const sq of batteryAttacks(p, grid)) {
        if (!allowed || allowed.has(sq)) add(sq, p);
      }
    }
    return map;
  }

  const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

  /* Anything that comes with check is forced, so it beats a bigger prize that
     the opponent still has a move to defend. */
  const FORCED_BONUS = 8;

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
        const check = hit.some(sq => {
          const i = toIdx(sq);
          return grid[i.file][i.rank].type === 'k';
        });
        out.push({
          kind: 'fork', color: p.color, origin: p.square, targets: hit, forced: check,
          // a fork with check is not a chance, it is a fact: the king must
          // move and the other piece falls. It has to outrank quiet motifs.
          weight: hit.reduce((n, sq) => {
            const i = toIdx(sq);
            return n + VALUE[grid[i.file][i.rank].type];
          }, 0) + (check ? FORCED_BONUS : 0)
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
            kind: 'pin', absolute: behind.type === 'k',
            color: p.color, origin: p.square, targets: [front.square], through: behind.square,
            weight: VALUE[behind.type]
          });
        } else if (VALUE[front.type] > VALUE[behind.type] && VALUE[front.type] >= 5) {
          // the valuable piece stands in front and must move, exposing the one behind
          out.push({
            kind: 'skewer',
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
          kind: 'discovered', check: behind.type === 'k',
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
          kind: 'trapped', color: enemy,
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
        kind: 'passed', color: p.color,
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
          kind: 'overload', color: enemy,
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
        kind: 'backrank', color: enemy,
        origin: k.square, targets: [], weight: 12
      });
    }
    return out;
  }



  /* Two sliders stacked on one line, aimed at something. Worth naming, because
     the second piece is invisible to a beginner — it looks blocked. */
  function batteries(pieces, grid) {
    const out = [];
    for (const rear of pieces) {
      const dirs = SLIDER_DIRS[rear.type];
      if (!dirs) continue;
      const enemy = rear.color === 'w' ? 'b' : 'w';
      const { file, rank } = toIdx(rear.square);

      for (const [df, dr] of dirs) {
        const diagonal = df !== 0 && dr !== 0;
        let f = file + df, r = rank + dr, front = null;

        while (onBoard(f, r)) {
          const here = grid[f][r];
          if (here) {
            const slides = here.type === 'q' ||
              (diagonal ? here.type === 'b' : here.type === 'r');
            if (!front) {
              if (here.color === rear.color && slides) front = here;
              else break;
            } else {
              if (here.color === enemy) {
                out.push({
                  kind: 'battery', color: rear.color,
                  origin: rear.square, targets: [here.square], through: front.square,
                  weight: VALUE[here.type] + 1
                });
              }
              break;
            }
          }
          f += df; r += dr;
        }
      }
    }
    return out;
  }

  /* A fork that does not exist yet. For every enemy move we ask: standing
     there, would this piece hit two valuable things at once? If yes — and if
     we cannot simply take it on that square — the square itself is the
     problem, and covering it in time is the whole lesson. */
  function threatenedForks(pieces, grid, map) {
    const best = new Map();

    const pinned = absolutePins(pieces, grid);

    for (const p of pieces) {
      const enemy = p.color === 'w' ? 'b' : 'w';

      for (const dest of liveAttacks(p, grid, pinned)) {
        const d = toIdx(dest);
        const sitting = grid[d.file][d.rank];
        if (sitting && sitting.color === p.color) continue;      // own piece in the way

        // play the move on a copy of the board
        const after = pieces.filter(q => q !== p && q.square !== dest);
        after.push({ square: dest, color: p.color, type: p.type });
        const grid2 = buildGrid(after);
        const moved = after[after.length - 1];

        const hits = [];
        for (const sq of attacksFrom(moved, grid2)) {
          const i = toIdx(sq);
          const target = grid2[i.file][i.rank];
          if (target && target.color === enemy && VALUE[target.type] >= 3) hits.push(target);
        }
        if (hits.length < 2) continue;

        // if the defender already covers the landing square, taking solves it
        const guard = map.get(dest);
        if (guard && guard[enemy].length) continue;

        const check = hits.some(h => h.type === 'k');
        const values = hits.map(h => VALUE[h.type]).sort((a, b) => b - a);
        // you save the best one and lose the next; with check you do not even
        // get to choose, so the loss is certain rather than likely
        const weight = values[1] + (check ? FORCED_BONUS : 0);
        const prev = best.get(p.square);
        if (!prev || prev.weight < weight) {
          best.set(p.square, {
            kind: 'threatfork', color: p.color, origin: p.square, targets: [dest],
            hits: hits.map(h => h.square), weight, forced: check
          });
        }
      }
    }
    return [...best.values()];
  }

  /* Every motif carries `color` = the side that BENEFITS from it, and
     `weight` = how much material is at stake, so the overlay can show the
     three that matter and drop the rest instead of burying the board. */
  function motifs(pieces) {
    const grid = buildGrid(pieces);
    const map = attackMap(pieces, true);
    return [].concat(
      pins(pieces, grid),
      discovered(pieces, grid),
      forks(pieces, grid),
      overloaded(pieces, grid, map),
      batteries(pieces, grid),
      trapped(pieces, grid, map),
      threatenedForks(pieces, grid, map),
      backRank(pieces, grid),
      passedPawns(pieces)
    ).sort((a, b) => b.weight - a.weight);
  }

  /* The three marks the overlay draws. */
  function analyze(pieces) {
    const map = attackMap(pieces, true);
    const hanging = [];
    const underdefended = [];

    for (const p of pieces) {
      if (p.type === 'k') continue;
      const e = map.get(p.square);
      if (!e) continue;
      const foes = p.color === 'w' ? e.b : e.w;
      const friends = p.color === 'w' ? e.w : e.b;
      if (foes.length === 0) continue;

      // A king cannot recapture onto a square another enemy piece still
      // covers — so with two attackers, a lone king defends nothing.
      const kingAlone = friends.length === 1 && friends[0].type === 'k';
      if (friends.length === 0 || (kingAlone && foes.length >= 2)) {
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

  const api = { attacksFrom, attackMap, absolutePins, liveAttacks, batteryAttacks, weakSquares, analyze, motifs, moveDiff, toIdx, toSquare, buildGrid };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChessVisionLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
