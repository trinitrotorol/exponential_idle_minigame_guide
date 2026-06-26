# Existing Site Research

Research date: 2026-06-24

## Updated Finding

The official community guide site has a Minigames page that covers 15-Puzzle, Torus, and Arrow strategies across the available difficulties:

- https://exponential-idle-guides.netlify.app/guides/asd/

This repository focuses on an interactive, bilingual solver-oriented version rather than replacing that written guide.

## Other Checked Solver Repositories

| Candidate | Type | Notes |
| --- | --- | --- |
| [samjones246/exp-torus](https://github.com/samjones246/exp-torus) | Torus auto solver | Uses a Python adaptation of a torus sorting algorithm. |
| [forsythe/torus_puzzle](https://github.com/forsythe/torus_puzzle) | Torus recreation | Confirms row and column cyclic shift mechanics and 2x2 through 6x6 support. |
| [facu-et/exponential-idle-puzzle-solver](https://github.com/facu-et/exponential-idle-puzzle-solver) | 15-Puzzle solver reference | README states Easy / Medium / Hard support. |
| [virtuallyaverage/15-puzzle-autosolver](https://github.com/virtuallyaverage/15-puzzle-autosolver) | 15-Puzzle solver reference | Public repository, minimal contents. |
| [Blue-Beaker/arrow-puzzle-solver](https://github.com/Blue-Beaker/arrow-puzzle-solver) | Arrow solver | Hard / Expert oriented. |

## Site Direction

- Keep all solver interactions in browser with no build step.
- Match the dark in-game minigame modal style.
- Support Japanese and English text switching.
- Provide practical solve sequences for Arrow, 15-Puzzle, and Torus.

## Localized Puzzle Labels

The Japanese in-game names could not be verified from the local repository context. The site currently keeps the existing Japanese candidates in `PUZZLE_LABELS.ja` (`矢印パズル`, `15パズル`, `トーラスパズル`). When the Japanese game UI names are confirmed, update only `PUZZLE_LABELS.ja` in `site.js`.

## Implemented Game Specs

- 15-Puzzle: Easy 3x3, Medium 4x4, Hard 5x5. The blank is stored as `0`; the solved board is ascending from the top-left with the blank in the bottom-right.
- Torus Puzzle: Easy 3x3, Medium 5x5, Hard 6x6. The solved board is ascending from `1` to `n^2`.
- Arrow Puzzle:
  - Easy: 3x3 square, 4 directions, 90-degree turns.
  - Medium: 4x4 square, 4 directions, 90-degree turns.
  - Hard: side-4 hexagon, 37 cells, 2 directions, 180-degree turns.
  - Expert: side-4 hexagon, 37 cells, 6 directions, 60-degree turns.

Arrow keeps the existing adjacency model used by the site: square boards affect the pressed cell plus the surrounding 8 cells, and hex boards affect the pressed cell plus the 6 axial neighbors. The target is always internal state `0`, displayed as an upward arrow.

## Verification

Run `node --test tests/solver-core.test.js` with Node.js. The tests use fixed seeds, generate legal boards by applying legal moves from solved boards, and verify that returned operations solve Arrow, 15-Puzzle, and Torus boards for every official difficulty.
