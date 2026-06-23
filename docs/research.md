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
