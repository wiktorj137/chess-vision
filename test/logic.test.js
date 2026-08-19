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
