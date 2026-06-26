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

test("Arrow display values are one-based for every direction count", () => {
  assert.deepEqual([0, 1].map(S.ui.arrowDisplayValue), [1, 2]);
  assert.deepEqual([0, 1, 2, 3].map(S.ui.arrowDisplayValue), [1, 2, 3, 4]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(S.ui.arrowDisplayValue), [1, 2, 3, 4, 5, 6]);
});

test("Arrow display mode storage values normalize to supported modes", () => {
  assert.equal(S.ui.normalizeArrowDisplayMode("numbers"), "numbers");
  assert.equal(S.ui.normalizeArrowDisplayMode("arrows"), "arrows");
  assert.equal(S.ui.normalizeArrowDisplayMode("both"), "both");
  assert.equal(S.ui.normalizeArrowDisplayMode("surprise"), "numbers");
  assert.equal(S.ui.normalizeArrowDisplayMode(null), "numbers");
});

test("Arrow press-count badges mark only pressed cells without next-step copy", () => {
  const counts = S.ui.createArrowPressCounts([0, 0, 3, 6, 6, 6], 8);
  assert.deepEqual(counts, [2, 0, 0, 1, 0, 0, 3, 0]);
  assert.equal(S.ui.arrowPressBadgeText(counts[0]), "×2");
  assert.equal(S.ui.arrowPressBadgeText(counts[1]), "");
  assert.equal(S.ui.arrowPressBadgeText(counts[6]), "×3");
  assert.equal(S.ui.arrowPressBadgeText(counts[6]).includes("Next"), false);
  assert.equal(S.ui.arrowPressBadgeText(counts[6]).includes("次"), false);
});

test("Arrow display helpers do not alter solver results", () => {
  const board = S.arrow.scrambleArrowPuzzle("medium", 24, S.util.createSeededRandom(20260626));
  const before = S.arrow.solveArrowPuzzle({ difficulty: "medium", initial: board }).answer.operations;
  for (const mode of S.ui.ARROW_DISPLAY_MODES) {
    assert.equal(S.ui.normalizeArrowDisplayMode(mode), mode);
  }
  const after = S.arrow.solveArrowPuzzle({ difficulty: "medium", initial: board }).answer.operations;
  assert.deepEqual(after, before);
});
