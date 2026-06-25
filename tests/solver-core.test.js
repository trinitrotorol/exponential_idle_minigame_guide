const test = require("node:test");
const assert = require("node:assert/strict");

const S = require("../public/game-guide/exponential-idle-minigame-guide/site.js");

function sameArray(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameMatrix(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function assertErrorCode(fn, code) {
  assert.throws(fn, (error) => error && error.code === code);
}

test("GAME_SPECS matches Exponential Idle official difficulties", () => {
  assert.deepEqual(S.GAME_SPECS.arrow.easy, { shape: "square", height: 3, width: 3, side: 0, directions: 4 });
  assert.deepEqual(S.GAME_SPECS.arrow.medium, { shape: "square", height: 4, width: 4, side: 0, directions: 4 });
  assert.deepEqual(S.GAME_SPECS.arrow.hard, { shape: "hex", height: 0, width: 0, side: 4, directions: 2 });
  assert.deepEqual(S.GAME_SPECS.arrow.expert, { shape: "hex", height: 0, width: 0, side: 4, directions: 6 });
  assert.deepEqual(S.GAME_SPECS.fifteen, { easy: { size: 3 }, medium: { size: 4 }, hard: { size: 5 } });
  assert.deepEqual(S.GAME_SPECS.torus, { easy: { size: 3 }, medium: { size: 5 }, hard: { size: 6 } });
});

test("Arrow solvers solve deterministic legal boards for every official difficulty", async (t) => {
  for (const difficulty of Object.keys(S.GAME_SPECS.arrow)) {
    await t.test(difficulty, () => {
      for (let index = 0; index < 12; index += 1) {
        const rng = S.util.createSeededRandom(0xA11000 + index * 97 + difficulty.length);
        const board = S.arrow.scrambleArrowPuzzle(difficulty, S.arrow.createArrowGoal(difficulty).length + index, rng);
        const original = board.slice();
        const solution = S.arrow.solveArrowPuzzle({ difficulty, initial: board });
        const solved = S.arrow.applyArrowOperations(board, difficulty, solution.answer.operations);
        assert.deepEqual(board, original, "solver must not mutate Arrow input");
        assert.equal(solution.answer.target, 0);
        assert.ok(solved.every((value) => value === 0), `${difficulty} case ${index} should solve to all-up arrows`);
      }
    });
  }
});

test("Arrow Medium all-right regression is not treated as solved", () => {
  const board = Array.from({ length: S.arrow.createArrowGoal("medium").length }, () => 1);
  const solution = S.arrow.solveArrowPuzzle({ difficulty: "medium", initial: board });
  const solved = S.arrow.applyArrowOperations(board, "medium", solution.answer.operations);
  assert.ok(solution.answer.totalOperations > 0);
  assert.ok(solved.every((value) => value === 0));
});

test("Arrow completed boards return zero moves for every official difficulty", () => {
  for (const difficulty of Object.keys(S.GAME_SPECS.arrow)) {
    const board = S.arrow.createArrowGoal(difficulty);
    const solution = S.arrow.solveArrowPuzzle({ difficulty, initial: board });
    assert.equal(solution.answer.totalOperations, 0);
    assert.ok(solution.answer.operations.every((value) => value === 0));
  }
});

test("15-Puzzle solvers solve deterministic legal boards for every official difficulty", async (t) => {
  for (const [difficulty, spec] of Object.entries(S.GAME_SPECS.fifteen)) {
    await t.test(difficulty, () => {
      for (let index = 0; index < 12; index += 1) {
        const rng = S.util.createSeededRandom(0x150000 + spec.size * 131 + index);
        const board = S.fifteen.scrambleFifteen(spec.size, spec.size * 5 + index, rng);
        const original = board.slice();
        const solution = S.fifteen.solveFifteenPuzzle(board, spec.size);
        const solved = S.fifteen.applyFifteenMoves(board, spec.size, solution.moves);
        assert.deepEqual(board, original, "solver must not mutate 15-Puzzle input");
        assert.ok(sameArray(solved, S.fifteen.createFifteenGoal(spec.size)), `${difficulty} case ${index} should solve`);
      }
    });
  }
});

test("Torus solvers solve deterministic legal boards for every official difficulty", async (t) => {
  for (const [difficulty, spec] of Object.entries(S.GAME_SPECS.torus)) {
    await t.test(difficulty, () => {
      for (let index = 0; index < 12; index += 1) {
        const rng = S.util.createSeededRandom(0x700000 + spec.size * 173 + index);
        const board = S.torus.scrambleTorus(spec.size, spec.size * 3 + index, rng);
        const original = S.util.cloneMatrix(board);
        const solution = S.torus.solveTorusPuzzle(board);
        const solved = S.torus.applyTorusOperations(board, solution.operations);
        assert.deepEqual(board, original, "solver must not mutate Torus input");
        assert.ok(sameMatrix(solved, S.torus.createTorusGoal(spec.size)), `${difficulty} case ${index} should solve`);
      }
    });
  }
});

test("validation rejects duplicates, out-of-range values, and missing values", () => {
  assertErrorCode(() => S.fifteen.solveFifteenPuzzle([1, 1, 2, 3, 4, 5, 6, 7, 8], 3), "invalidFifteenPermutation");
  assertErrorCode(() => S.fifteen.solveFifteenPuzzle([0, 1, 2, 3, 4, 5, 6, 7, 99], 3), "invalidFifteenPermutation");
  assertErrorCode(() => S.fifteen.solveFifteenPuzzle([0, 1, 2, 3, 4, 5, 6, 7], 3), "invalidFifteenPermutation");
  assertErrorCode(() => S.torus.solveTorusPuzzle([[1, 1, 2], [3, 4, 5], [6, 7, 8]]), "invalidTorusPermutation");
  assertErrorCode(() => S.torus.solveTorusPuzzle([[1, 2, 3], [4, 5, 6], [7, 8, 99]]), "invalidTorusPermutation");
  assertErrorCode(() => S.torus.solveTorusPuzzle([[1, 2, 3], [4, 5, 6], [7, 8]]), "invalidTorusPermutation");
  assertErrorCode(() => S.arrow.solveArrowPuzzle({ difficulty: "easy", initial: [0, 1, 2] }), "invalidArrowBoard");
});
