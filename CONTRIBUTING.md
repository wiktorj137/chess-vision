# Contributing

Chess knowledge counts as much as code here. If the overlay tells you something
wrong, that is a bug worth reporting — several of the sharpest fixes in this
repo started with a player saying "hang on, that pawn is pinned".

## Reporting a wrong call

Open an issue with **the FEN**. That is the whole ask. With a FEN anyone can
reproduce the position in one line:

```bash
node -e "const L=require('./src/attacks.js'); /* paste FEN, print L.analyze(...) */"
```

Say what the overlay drew and what it should have drawn. Screenshots help but
the FEN is what makes it fixable.

## Getting set up

No build step, no dependencies.

```bash
git clone <your fork>
npm test          # 55 tests
```

To try changes in the browser: `chrome://extensions` → Developer mode → Load
unpacked → pick the folder. **After every edit, click the reload icon on the
extension card and then refresh lichess** — a plain page refresh keeps the old
code.

To work on the drawing without opening lichess:

```bash
python3 -m http.server 8123
# then open http://localhost:8123/test/harness.html
```

The harness is a fake chessground board. In the console you get `setFen('...')`
and `chessVision.render()`.

## The shape of the code

| File | Rule |
|---|---|
| `src/attacks.js` | pure logic, **no DOM**, no wording. Everything here is testable and must have a test. |
| `src/board.js` | the only file that knows lichess' markup exists. |
| `src/content.js` | drawing and wording. Player-facing text lives here, never in the logic. |

Patterns are reported as structure — `kind`, `forced`, `absolute`, `weight` —
and turned into words in `content.js`. That is what makes translation cheap.

## Adding a pattern

1. Write the detector in `src/attacks.js`, returning
   `{ kind, color, origin, targets, weight }`. `color` is **the side that
   benefits**, `weight` is roughly the material at stake.
2. Add it to the list in `motifs()`.
3. Write tests. At minimum: one position where it fires, one where it must not.
4. Give it a colour and a shape in `src/content.js`. Reuse an existing shape if
   the pattern is geometrically the same family — the shape language is the
   whole point.
5. Add the name and description to **both** language tables.

## Adding a language

One object in `src/content.js`, no code. Copy the `en` block in `STRINGS`,
translate the values, key it by the two-letter language code. It is picked up
automatically from `navigator.language`.

## Writing tests

Positions are written as FEN and parsed by the helper at the top of
`test/logic.test.js`. A warning from experience: **it is very easy to write a
FEN that does not test what you think.** Uppercase is white. Check that the
piece you mean to be pinned is actually on the pinning line. More than one bug
in this repo was really a broken test position.

## Pull requests

- one idea per PR
- `npm test` green
- no new dependencies (this stays a zero-dependency extension)
- comments explain *why*, not *what*

## Good first issues

- a new pattern: windmill, smothered mate, Greek gift, zwischenzug
- a language
- castling and promotion in the last-move diff
- the post-game recap of patterns you met
- full static exchange evaluation to replace the current heuristic
