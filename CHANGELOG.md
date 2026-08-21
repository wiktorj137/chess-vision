# Changelog

## 0.12.0

- works in games against the Stockfish AI and against BOT accounts, where
  there is no human opponent to disadvantage
- still dark in every game against a person, and while spectating anything
- the check fails closed: whatever it cannot identify counts as a human game

## 0.11.0

Lichess prohibits outside assistance in any game in progress, not only rated
ones. Earlier versions said casual games were fine — that was wrong, and the
lichess forum was right to call it out.

- the extension is registered only for analysis, studies, puzzles, practice and
  the board editor; it is never loaded on a live game page
- a second check removes the overlay if a live board turns up anyway
- README rewritten to state the rule instead of hedging it

## 0.10.0

- ⏻ button in the panel header turns the overlay off and on, stays reachable
  when the panel is collapsed, and the choice survives a reload
- trapped now weighs the escape squares instead of just checking whether they
  are attacked: a square guarded by us, where only a more valuable piece can
  take, is a perfectly good square to run to
- labels no longer land on top of each other
- overloaded only fires when the defender is actually holding something up; a
  pawn chain that defends itself no longer makes every nearby piece look
  overloaded
- language picker in the panel: Auto, English, Polski — switches the panel and
  the on-board labels, and is remembered
- patterns are counted once per occurrence instead of once per position; a
  threat standing for six moves is one thing to learn, not six
- forced patterns keep a faint mark forever instead of disappearing at the
  mastered threshold

## 0.9.0

- forks that come with check jump the queue — forced beats valuable
- one of the three drawing slots is always reserved for your own opportunity
- English by default, Polish picked up from the browser; wording moved out of
  the logic layer so a new language is one object

## 0.8.0

- a piece behind a piece on the same line counts as another attacker (battery)
- the king stops counting as a defender once a second attacker covers the square
- new pattern: battery, drawn as a double rail

## 0.7.0

- pinned pieces no longer count as attackers or defenders — they cannot leave
  the pin line
- a pinned piece may still capture the piece pinning it

## 0.6.0

- warns about forks **one move before they happen**, circling the square to cover
- back-rank warning only when a heavy piece can actually reach the rank
- calmer panel: three rows on first run, tactics behind a fold, light-theme support

## 0.5.0

- learner mode: patterns fade out as your counter grows, and disappear once
  mastered
- progress stored between sessions, one button to switch the fading off

## 0.4.0

- new patterns: skewer, discovered attack, trapped piece, passed pawn
- patterns carry material weight and the side that benefits
- their threats bright, your chances dimmed; three patterns at a time

## 0.3.0

- threats drawn as lines between squares instead of coloured squares
- every pattern gets a fixed shape and a name on the board
- lines draw themselves along the direction of the threat

## 0.2.0

- shows what the last move changed and what it started attacking
- distinct mark for "defended, but a cheaper piece takes first"

## 0.1.0

- hanging pieces, losing trades, weak squares
