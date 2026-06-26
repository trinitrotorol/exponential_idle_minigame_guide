const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const S = require("../public/game-guide/exponential-idle-minigame-guide/site.js");
const publicDir = path.join(__dirname, "..", "public", "game-guide", "exponential-idle-minigame-guide");

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

test("puzzle labels are centralized for Japanese and English UI", () => {
  const labels = S.ui.PUZZLE_LABELS;
  assert.deepEqual(Object.keys(labels.ja).sort(), ["arrow", "fifteen", "torus"]);
  assert.deepEqual(Object.keys(labels.en).sort(), ["arrow", "fifteen", "torus"]);
  assert.equal(labels.en.arrow, "Arrow Puzzle");
  assert.equal(labels.en.fifteen, "15-Puzzle");
  assert.equal(labels.en.torus, "Torus Puzzle");
  assert.ok(labels.ja.arrow);
  assert.ok(labels.ja.fifteen);
  assert.ok(labels.ja.torus);
});

test("recommended settings copy is not rendered in the main HTML", () => {
  const html = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
  assert.equal(html.includes('class="recommendation"'), false);
  assert.equal(html.includes("使う前のおすすめ設定"), false);
  assert.equal(html.includes("Visual Scheme"), false);
  assert.equal(html.includes("Hover/Slide Control"), false);
  assert.equal(html.includes("Animation"), false);
});
