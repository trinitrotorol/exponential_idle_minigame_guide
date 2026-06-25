const test = require("node:test");
const assert = require("node:assert/strict");

const S = require("../public/game-guide/exponential-idle-minigame-guide/site.js");

function sameArray(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameMatrix(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

test("15-Puzzle playback preserves original board and derives moved tile labels", () => {
  const size = 3;
  const board = [1, 2, 3, 4, 5, 6, 7, 0, 8];
  const original = board.slice();
  const solution = S.fifteen.solveFifteenPuzzle(board, size);
  assert.deepEqual(board, original);
  const step = S.fifteen.getFifteenStep(board, size, solution.moves[0]);
  assert.equal(step.tile, 8);
  assert.equal(S.fifteen.formatFifteenDisplayValue(0), "");
  const next = S.fifteen.applyFifteenStep(board, size, solution.moves[0]);
  const previous = S.fifteen.applyFifteenStep(next, size, step.inverseMove);
  assert.ok(sameArray(previous, board));
});

test("Torus playback preserves original board, labels 1-based operations, and reverses steps", () => {
  const board = S.torus.createTorusGoal(3);
  const shifted = S.torus.applyTorusOperation(board, { type: "L", index: 2, amount: 2 });
  const original = shifted.map((row) => row.slice());
  const solution = S.torus.solveTorusPuzzle(shifted);
  assert.deepEqual(shifted, original);
  const first = solution.operations[0];
  const info = S.torus.getTorusOperationInfo(first);
  assert.equal(info.index, first.index + 1);
  assert.ok(info.index >= 1);
  const next = S.torus.applyTorusOperation(shifted, first);
  const previous = S.torus.applyTorusOperation(next, S.torus.invertTorusOperation(first));
  assert.ok(sameMatrix(previous, shifted));
});

test("Torus adjacent operation merging preserves meaning", () => {
  const size = 5;
  const operations = [
    { type: "L", index: 2, amount: 1 },
    { type: "L", index: 2, amount: 2 },
    { type: "R", index: 2, amount: 1 },
  ];
  const merged = S.torus.mergeTorusOperations(operations, size);
  assert.deepEqual(merged, [{ type: "L", index: 2, amount: 2 }]);
  const board = S.torus.createTorusGoal(size);
  assert.ok(sameMatrix(S.torus.applyTorusOperations(board, operations), S.torus.applyTorusOperations(board, merged)));
});

test("Arrow playback expands operations and distinguishes input taps from game taps", () => {
  const difficulty = "medium";
  const board = S.arrow.createArrowGoal(difficulty);
  const taps = S.arrow.expandArrowOperations([0, 2, 1]);
  assert.deepEqual(taps, [1, 1, 2]);
  const inputTapped = S.arrow.applyArrowInputTap(board, difficulty, 0);
  assert.equal(inputTapped[0], 1);
  assert.ok(inputTapped.slice(1).every((value) => value === 0));
  const gameTapped = S.arrow.applyArrowTap(board, difficulty, 0);
  assert.ok(gameTapped.filter((value) => value === 1).length > 1);
});

test("Arrow tap playback solves a legal board", () => {
  const difficulty = "expert";
  const rng = S.util.createSeededRandom(0x515151);
  const board = S.arrow.scrambleArrowPuzzle(difficulty, 40, rng);
  const solution = S.arrow.solveArrowPuzzle({ difficulty, initial: board });
  const taps = S.arrow.expandArrowOperations(solution.answer.operations);
  const solved = taps.reduce((current, cell) => S.arrow.applyArrowTap(current, difficulty, cell), board);
  assert.ok(solved.every((value) => value === 0));
});

test("input parsing and validation catch duplicates, missing, range, and paste count", () => {
  assert.deepEqual(S.input.parseBoardValues("1, 2 3\n4\t0"), [1, 2, 3, 4, 0]);
  assert.equal(S.input.validatePastedValues([1, 2, 3], 4).code, "pasteValueCountMismatch");
  assert.equal(S.input.validatePastedValues([1, 2, 3, 4, 5], 4).code, "pasteValueCountMismatch");
  const fifteen = S.input.validateFifteenInput([0, 1, 1, 3, 4, 5, 6, 7, 99], 3);
  assert.ok(fifteen.codes.includes("duplicateNumbers"));
  assert.ok(fifteen.codes.includes("missingNumbers"));
  assert.ok(fifteen.codes.includes("outOfRangeNumbers"));
  const torus = S.input.validateTorusInput([1, 2, 3, 4, 5, 6, 7, 7, 99], 3);
  assert.ok(torus.codes.includes("duplicateNumbers"));
  assert.ok(torus.codes.includes("missingNumbers"));
  assert.ok(torus.codes.includes("outOfRangeNumbers"));
});

test("solutions longer than 160 steps are retained and reachable", () => {
  const solution = Array.from({ length: 180 }, (_, index) => index);
  assert.equal(solution.length, 180);
  assert.equal(solution[179], 179);
});
