const test = require("node:test");
const assert = require("node:assert/strict");

const S = require("../public/game-guide/exponential-idle-minigame-guide/site.js");

test("oneBasedPosition reports row and column for board labels", () => {
  assert.deepEqual(S.ui.oneBasedPosition(0, 5), { row: 1, col: 1 });
  assert.deepEqual(S.ui.oneBasedPosition(12, 5), { row: 3, col: 3 });
  assert.deepEqual(S.ui.oneBasedPosition(35, 6), { row: 6, col: 6 });
});

test("fitCellSize clamps responsive board cells to usable bounds", () => {
  assert.equal(S.ui.fitCellSize(320, 6, 4, 32, 64), 50);
  assert.equal(S.ui.fitCellSize(160, 6, 4, 32, 64), 32);
  assert.equal(S.ui.fitCellSize(900, 6, 4, 32, 64), 64);
});
