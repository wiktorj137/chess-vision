/* node --test test/logic.test.js */
const test = require('node:test');
const assert = require('node:assert');
const L = require('../src/attacks.js');

function fen(board) {
  const pieces = [];
  const rows = board.split(' ')[0].split('/');
  rows.forEach((row, i) => {
    const rank = 7 - i;
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { file += +ch; continue; }
      pieces.push({
        square: 'abcdefgh'[file] + (rank + 1),
        color: ch === ch.toUpperCase() ? 'w' : 'b',
        type: ch.toLowerCase()
      });
      file++;
    }
  });
  return pieces;
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

test('start position: nothing hanging, nothing underdefended', () => {
  const r = L.analyze(fen(START));
  assert.deepStrictEqual(r.hanging, []);
  assert.deepStrictEqual(r.underdefended, []);
});

test('start position: no weak squares for either side', () => {
  const p = fen(START);
  assert.deepStrictEqual(L.weakSquares(p, 'w'), []);
  assert.deepStrictEqual(L.weakSquares(p, 'b'), []);
});

test('lone knight attacked by a bishop is hanging', () => {
  const r = L.analyze(fen('4k3/8/8/3n4/8/8/6B1/4K3'));
  assert.deepStrictEqual(r.hanging.map(h => h.square), ['d5']);
});

test('same knight defended by a pawn is not hanging', () => {
  const r = L.analyze(fen('4k3/8/2p5/3n4/8/8/6B1/4K3'));
  assert.deepStrictEqual(r.hanging, []);
  assert.deepStrictEqual(r.underdefended, []);
});

test('two attackers against one defender is underdefended', () => {
  //  black knight d5: attacked by Bg2 and Rd1, defended only by pawn c6
  const r = L.analyze(fen('4k3/8/2p5/3n4/8/8/6B1/3RK3'));
  assert.deepStrictEqual(r.underdefended.map(u => u.square), ['d5']);
  assert.deepStrictEqual(r.hanging, []);
});

test('equal count still flagged when the attacker is cheaper', () => {
  // black rook d5 attacked by pawn c4, defended by rook d8 -> pawn wins material
  const r = L.analyze(fen('3r4/8/8/3r4/2P5/8/8/4K2k'));
  assert.ok(r.underdefended.some(u => u.square === 'd5'));
});

test('sliders are blocked by the first piece but still attack it', () => {
  const pieces = fen('4k3/8/8/8/8/8/8/R2p1K2');
  const grid = L.buildGrid(pieces);
  const rook = pieces.find(p => p.type === 'r');
  const seen = L.attacksFrom(rook, grid);
  assert.ok(seen.includes('d1'), 'attacks the blocker');
  assert.ok(!seen.includes('e1'), 'does not see past it');
});

test('pawns attack diagonally forward only', () => {
  const pieces = fen('4k3/8/8/8/8/8/4P3/4K3');
  const grid = L.buildGrid(pieces);
  const pawn = pieces.find(p => p.type === 'p');
  assert.deepStrictEqual(L.attacksFrom(pawn, grid).sort(), ['d3', 'f3']);
});

test('a missing f-pawn makes squares in front of it weak', () => {
  // white has no e- or g-pawn, so f4/f5 can never be covered by a pawn
  const weak = L.weakSquares(fen('4k3/8/8/8/8/8/PPPP1P1P/4K3'), 'w');
  assert.ok(weak.includes('f4'));
  assert.ok(!weak.includes('c4'));
});

/* ---- powód oznaczenia ---- */

test('reason says why a piece was flagged', () => {
  const byCount = L.analyze(fen('4k3/8/2p5/3n4/8/8/6B1/3RK3')).underdefended[0];
  assert.strictEqual(byCount.reason, 'count');

  const byPrice = L.analyze(fen('3r4/8/8/3r4/2P5/8/8/4K2k')).underdefended
    .find(u => u.square === 'd5');
  assert.strictEqual(byPrice.reason, 'cheap');
});

/* ---- diff ruchu ---- */

test('move diff reports the move that was played', () => {
  const before = fen('4k3/8/8/8/8/8/6B1/4K3');
  const after  = fen('4k3/8/8/8/4B3/8/8/4K3');
  const d = L.moveDiff(before, after);
  assert.strictEqual(d.from, 'g2');
  assert.strictEqual(d.to, 'e4');
  assert.strictEqual(d.type, 'b');
});

test('move diff lists enemy pieces the move newly attacks', () => {
  //  Bg2-e4 starts hitting the rook on h7. From g2 that rook was not attacked;
  //  b7 would be a bad test square, g2 and e4 share that diagonal.
  const before = fen('4k3/7r/8/8/8/8/6B1/4K3');
  const after  = fen('4k3/7r/8/8/4B3/8/8/4K3');
  const d = L.moveDiff(before, after);
  assert.deepStrictEqual(d.newThreats.map(t => t.square), ['h7']);
});

test('move diff ignores squares the piece already attacked', () => {
  // rook slides along the same file, the target stays attacked the whole time
  const before = fen('3r4/8/8/8/8/8/3R4/4K2k');
  const after  = fen('3r4/8/8/8/3R4/8/8/4K2k');
  const d = L.moveDiff(before, after);
  assert.deepStrictEqual(d.newThreats, []);
});

test('move diff never reports the king as a target', () => {
  const before = fen('4k3/8/8/8/8/8/6B1/4K3');
  const after  = fen('4k3/8/8/5B2/8/8/8/4K3');
  const d = L.moveDiff(before, after);
  assert.ok(d.newThreats.every(t => t.type !== 'k'));
});

test('move diff gives up on castling instead of guessing', () => {
  const before = fen('4k3/8/8/8/8/8/8/4K2R');
  const after  = fen('4k3/8/8/8/8/8/8/5RK1');
  assert.strictEqual(L.moveDiff(before, after), null);
});

test('move diff returns null without a previous position', () => {
  assert.strictEqual(L.moveDiff(null, fen(START)), null);
  assert.strictEqual(L.moveDiff([], fen(START)), null);
});

/* ---- motywy ---- */

const kinds = p => L.motifs(fen(p)).map(m => m.kind + '@' + m.origin);

test('knight forking king and rook is a fork', () => {
  //  Nf7 hits the king on d8 and the rook on h8... use e6 hitting d8 and f8
  const m = L.motifs(fen('3rkr2/8/4N3/8/8/8/8/4K3')).find(x => x.kind === 'fork');
  assert.strictEqual(m.origin, 'e6');
  assert.deepStrictEqual(m.targets.sort(), ['d8', 'f8']);
});

test('a fork on two pawns is not worth drawing', () => {
  assert.ok(!kinds('8/8/1p1p4/8/2N5/8/8/4K2k').some(k => k.startsWith('fork')));
});

test('bishop pinning a knight against the king', () => {
  // king must sit on the bishop's own diagonal — a1-h8 runs through c3 and e5
  const m = L.motifs(fen('8/8/8/4k3/8/2n5/8/B3K3')).find(x => x.kind === 'pin');
  assert.strictEqual(m.origin, 'a1');
  assert.deepStrictEqual(m.targets, ['c3']);
  assert.strictEqual(m.through, 'e5');
});

test('pin needs something more valuable behind the shield', () => {
  // rook behind a queen is not a pin — the shield is worth more than the prize
  const m = L.motifs(fen('4k3/8/8/8/8/8/8/B1q1r1K1')).find(x => x.kind === 'pin');
  assert.strictEqual(m, undefined);
});

test('absolute pin against the king is named differently', () => {
  const m = L.motifs(fen('4k3/8/8/8/8/8/4r3/4R1K1')).find(x => x.kind === 'pin');
  assert.strictEqual(m.name, 'związanie bezwzględne');
});

test('a piece defending two attacked pieces is overloaded', () => {
  //  Rd2 defends d4 (hit by Rd8) and b2 (hit by Rb1) — two duties, one rook
  const m = L.motifs(fen('3rk3/8/8/8/3P4/8/1P1R4/1r2K3')).find(x => x.kind === 'overload');
  assert.strictEqual(m.origin, 'd2');
  assert.deepStrictEqual(m.targets.sort(), ['b2', 'd4']);
});

test('king boxed in by its own pawns is a back rank motif', () => {
  const m = L.motifs(fen('r3k3/8/8/8/8/8/5PPP/6K1')).find(x => x.kind === 'backrank');
  assert.strictEqual(m.origin, 'g1');
  assert.strictEqual(m.color, 'w');
});

test('no back rank motif when the enemy has no rook or queen', () => {
  assert.ok(!kinds('4k3/8/8/8/8/8/5PPP/6K1').some(k => k.startsWith('backrank')));
});

test('no back rank motif when the king has a hole', () => {
  assert.ok(!kinds('r3k3/8/8/8/8/6P1/5P1P/6K1').some(k => k.startsWith('backrank')));
});

test('hanging and underdefended report who attacks them', () => {
  const r = L.analyze(fen('4k3/8/8/3n4/8/8/6B1/4K3'));
  assert.deepStrictEqual(r.hanging[0].from, ['g2']);
});
