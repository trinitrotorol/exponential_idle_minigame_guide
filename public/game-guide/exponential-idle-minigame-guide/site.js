(function (global) {
  "use strict";

  const MAX_SOLUTIONS = 1000000;
  const GAME_SPECS = Object.freeze({
    arrow: Object.freeze({
      easy: Object.freeze({ shape: "square", height: 3, width: 3, side: 0, directions: 4 }),
      medium: Object.freeze({ shape: "square", height: 4, width: 4, side: 0, directions: 4 }),
      hard: Object.freeze({ shape: "hex", height: 0, width: 0, side: 4, directions: 2 }),
      expert: Object.freeze({ shape: "hex", height: 0, width: 0, side: 4, directions: 6 }),
    }),
    fifteen: Object.freeze({
      easy: Object.freeze({ size: 3 }),
      medium: Object.freeze({ size: 4 }),
      hard: Object.freeze({ size: 5 }),
    }),
    torus: Object.freeze({
      easy: Object.freeze({ size: 3 }),
      medium: Object.freeze({ size: 5 }),
      hard: Object.freeze({ size: 6 }),
    }),
  });

  const PUZZLE_LABELS = Object.freeze({
    ja: Object.freeze({
      arrow: "矢印パズル",
      fifteen: "15パズル",
      torus: "トーラスパズル",
    }),
    en: Object.freeze({
      arrow: "Arrow Puzzle",
      fifteen: "15-Puzzle",
      torus: "Torus Puzzle",
    }),
  });

  function solverError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  function modValue(value, modulus) {
    const result = value % modulus;
    return result < 0 ? result + modulus : result;
  }

  function createSeededRandom(seed) {
    let state = seed >>> 0;
    return function nextRandom() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  function randomInt(rng, max) {
    return Math.floor(rng() * max);
  }

  function getGameSpec(game, difficulty) {
    const spec = GAME_SPECS[game] && GAME_SPECS[game][difficulty];
    if (!spec) {
      throw solverError("invalidDifficulty");
    }
    return spec;
  }

  function posToRc(pos, size) {
    return [Math.floor(pos / size), pos % size];
  }

  function rcToPos(row, col, size) {
    return row * size + col;
  }

  function cloneMatrix(matrix) {
    return matrix.map((row) => row.slice());
  }

  function validatePermutation(values, expected) {
    if (values.length !== expected.length) {
      return false;
    }
    const seen = new Set(values);
    return expected.every((value) => seen.has(value)) && seen.size === expected.length;
  }

  function buildHexRowLengths(side) {
    const rows = [];
    for (let row = 0; row < 2 * side - 1; row += 1) {
      rows.push(2 * side - 1 - Math.abs(row - (side - 1)));
    }
    return rows;
  }

  function buildSquareRowLengths(height, width) {
    return Array.from({ length: height }, () => width);
  }

  function buildSquareAffectedBy(height, width) {
    const n = height * width;
    const affectedBy = Array.from({ length: n }, () => []);
    for (let cell = 0; cell < n; cell += 1) {
      const row = Math.floor(cell / width);
      const col = cell % width;
      for (let r = Math.max(0, row - 1); r <= Math.min(height - 1, row + 1); r += 1) {
        for (let c = Math.max(0, col - 1); c <= Math.min(width - 1, col + 1); c += 1) {
          affectedBy[cell].push(r * width + c);
        }
      }
    }
    return affectedBy;
  }

  function buildHexAffectedBy(side) {
    const radius = side - 1;
    const coordinates = [];
    const idByCoordinate = new Map();
    for (let r = -radius; r <= radius; r += 1) {
      const qMin = Math.max(-radius, -r - radius);
      const qMax = Math.min(radius, -r + radius);
      for (let q = qMin; q <= qMax; q += 1) {
        idByCoordinate.set(`${q},${r}`, coordinates.length);
        coordinates.push([q, r]);
      }
    }
    const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    return coordinates.map(([q, r], cell) => {
      const affected = [cell];
      for (const [dq, dr] of dirs) {
        const id = idByCoordinate.get(`${q + dq},${r + dr}`);
        if (id !== undefined) {
          affected.push(id);
        }
      }
      return affected;
    });
  }

  function inverseModPrime(value, prime) {
    const normalized = modValue(value, prime);
    for (let candidate = 1; candidate < prime; candidate += 1) {
      if ((normalized * candidate) % prime === 1) {
        return candidate;
      }
    }
    throw solverError("noModularInverse");
  }

  function solvePrimeSystem(affectedBy, rhs, prime) {
    const n = affectedBy.length;
    const rows = Array.from({ length: n }, (_, row) => {
      const values = Array.from({ length: n + 1 }, () => 0);
      for (const column of affectedBy[row]) {
        values[column] = 1;
      }
      values[n] = modValue(rhs[row], prime);
      return values;
    });
    let rank = 0;
    const pivotColumns = [];
    for (let column = 0; column < n; column += 1) {
      let pivot = -1;
      for (let row = rank; row < n; row += 1) {
        if (rows[row][column] !== 0) {
          pivot = row;
          break;
        }
      }
      if (pivot === -1) {
        continue;
      }
      [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];
      const inverse = inverseModPrime(rows[rank][column], prime);
      for (let col = column; col <= n; col += 1) {
        rows[rank][col] = (rows[rank][col] * inverse) % prime;
      }
      for (let row = 0; row < n; row += 1) {
        if (row === rank || rows[row][column] === 0) {
          continue;
        }
        const factor = rows[row][column];
        for (let col = column; col <= n; col += 1) {
          rows[row][col] = modValue(rows[row][col] - factor * rows[rank][col], prime);
        }
      }
      pivotColumns.push(column);
      rank += 1;
    }
    for (let row = rank; row < n; row += 1) {
      const allZero = rows[row].slice(0, n).every((value) => value === 0);
      if (allZero && rows[row][n] !== 0) {
        return { possible: false, particular: [], basis: [] };
      }
    }
    const particular = Array.from({ length: n }, () => 0);
    const pivotRowByColumn = Array.from({ length: n }, () => -1);
    for (let row = 0; row < rank; row += 1) {
      const pivotColumn = pivotColumns[row];
      pivotRowByColumn[pivotColumn] = row;
      particular[pivotColumn] = rows[row][n];
    }
    const basis = [];
    for (let freeColumn = 0; freeColumn < n; freeColumn += 1) {
      if (pivotRowByColumn[freeColumn] !== -1) {
        continue;
      }
      const basisVector = Array.from({ length: n }, () => 0);
      basisVector[freeColumn] = 1;
      for (let row = 0; row < rank; row += 1) {
        const pivotColumn = pivotColumns[row];
        basisVector[pivotColumn] = modValue(-rows[row][freeColumn], prime);
      }
      basis.push(basisVector);
    }
    return { possible: true, particular, basis };
  }

  function enumeratePrimeSolutions(solutions, prime) {
    if (!solutions.possible) {
      return [];
    }
    const result = [solutions.particular.slice()];
    for (const basisVector of solutions.basis) {
      const currentSize = result.length;
      if (currentSize * prime > MAX_SOLUTIONS) {
        throw solverError("tooManySolutions");
      }
      for (let i = 0; i < currentSize; i += 1) {
        const base = result[i];
        for (let multiplier = 1; multiplier < prime; multiplier += 1) {
          const next = base.slice();
          for (let j = 0; j < next.length; j += 1) {
            next[j] = modValue(next[j] + multiplier * basisVector[j], prime);
          }
          result.push(next);
        }
      }
    }
    return result;
  }

  function affectedSum(affected, values) {
    return affected.reduce((sum, index) => sum + values[index], 0);
  }

  function considerOperations(best, operations) {
    const cost = operations.reduce((sum, value) => sum + value, 0);
    if (!best.found || cost < best.cost) {
      best.found = true;
      best.cost = cost;
      best.operations = operations.slice();
    }
  }

  function solvePrimeModulus(affectedBy, rhs, prime) {
    const best = { found: false, cost: Number.MAX_SAFE_INTEGER, operations: [] };
    const solutions = solvePrimeSystem(affectedBy, rhs.map((v) => modValue(v, prime)), prime);
    for (const operations of enumeratePrimeSolutions(solutions, prime)) {
      considerOperations(best, operations);
    }
    return best;
  }

  function solveMod4(affectedBy, rhs) {
    const best = { found: false, cost: Number.MAX_SAFE_INTEGER, operations: [] };
    const n = affectedBy.length;
    const pSolutions = solvePrimeSystem(affectedBy, rhs.map((v) => modValue(v, 2)), 2);
    const qCache = new Map();
    for (const p of enumeratePrimeSolutions(pSolutions, 2)) {
      const qRhs = Array.from({ length: n }, () => 0);
      let possible = true;
      for (let cell = 0; cell < n; cell += 1) {
        const difference = modValue(rhs[cell] - affectedSum(affectedBy[cell], p), 4);
        if (difference % 2 !== 0) {
          possible = false;
          break;
        }
        qRhs[cell] = difference / 2;
      }
      if (!possible) {
        continue;
      }
      const key = qRhs.join(",");
      if (!qCache.has(key)) {
        qCache.set(key, enumeratePrimeSolutions(solvePrimeSystem(affectedBy, qRhs, 2), 2));
      }
      for (const q of qCache.get(key)) {
        considerOperations(best, Array.from({ length: n }, (_, i) => p[i] + 2 * q[i]));
      }
    }
    return best;
  }

  function solveMod6(affectedBy, rhs) {
    const best = { found: false, cost: Number.MAX_SAFE_INTEGER, operations: [] };
    const solutions2 = enumeratePrimeSolutions(solvePrimeSystem(affectedBy, rhs.map((v) => modValue(v, 2)), 2), 2);
    const solutions3 = enumeratePrimeSolutions(solvePrimeSystem(affectedBy, rhs.map((v) => modValue(v, 3)), 3), 3);
    if (solutions2.length * solutions3.length > MAX_SOLUTIONS) {
      throw solverError("tooManySolutions");
    }
    for (const mod2Solution of solutions2) {
      for (const mod3Solution of solutions3) {
        const operations = mod2Solution.map((mod2Value, i) => {
          for (let value = 0; value < 6; value += 1) {
            if (value % 2 === mod2Value && value % 3 === mod3Solution[i]) {
              return value;
            }
          }
          throw solverError("chineseRemainderFailed");
        });
        considerOperations(best, operations);
      }
    }
    return best;
  }

  function buildArrowPuzzle(shape, height, width, side) {
    if (shape === "square") {
      if (height < 1 || height > 4 || width < 1 || width > 4 || height * width > 16) {
        throw solverError("invalidArrowSpec");
      }
      return {
        rowLengths: buildSquareRowLengths(height, width),
        affectedBy: buildSquareAffectedBy(height, width),
      };
    }
    if (side < 1 || side > 4) {
      throw solverError("invalidArrowSpec");
    }
    return {
      rowLengths: buildHexRowLengths(side),
      affectedBy: buildHexAffectedBy(side),
    };
  }

  function normalizeArrowSpec(specOrDifficulty) {
    if (typeof specOrDifficulty === "string") {
      return getGameSpec("arrow", specOrDifficulty);
    }
    if (specOrDifficulty && specOrDifficulty.shape) {
      return specOrDifficulty;
    }
    throw solverError("invalidArrowSpec");
  }

  function buildArrowPuzzleFromSpec(specOrDifficulty) {
    const spec = normalizeArrowSpec(specOrDifficulty);
    return {
      ...buildArrowPuzzle(spec.shape, spec.height, spec.width, spec.side),
      spec,
    };
  }

  function arrowCellCount(specOrDifficulty) {
    return buildArrowPuzzleFromSpec(specOrDifficulty).affectedBy.length;
  }

  function createArrowGoal(specOrDifficulty) {
    return Array.from({ length: arrowCellCount(specOrDifficulty) }, () => 0);
  }

  function applyArrowOperations(initial, specOrDifficulty, operations) {
    const puzzle = buildArrowPuzzleFromSpec(specOrDifficulty);
    if (initial.length !== puzzle.affectedBy.length || operations.length !== puzzle.affectedBy.length) {
      throw solverError("invalidArrowBoard");
    }
    const values = initial.map((value) => modValue(Number(value), puzzle.spec.directions));
    for (let cell = 0; cell < puzzle.affectedBy.length; cell += 1) {
      const delta = affectedSum(puzzle.affectedBy[cell], operations);
      values[cell] = modValue(values[cell] + delta, puzzle.spec.directions);
    }
    return values;
  }

  function scrambleArrowPuzzle(specOrDifficulty, steps, rng = Math.random) {
    const puzzle = buildArrowPuzzleFromSpec(specOrDifficulty);
    const operations = Array.from({ length: puzzle.affectedBy.length }, () => 0);
    const totalSteps = steps ?? puzzle.affectedBy.length * 3;
    for (let step = 0; step < totalSteps; step += 1) {
      const cell = randomInt(rng, operations.length);
      const amount = 1 + randomInt(rng, puzzle.spec.directions - 1);
      operations[cell] = modValue(operations[cell] + amount, puzzle.spec.directions);
    }
    return applyArrowOperations(createArrowGoal(puzzle.spec), puzzle.spec, operations);
  }

  function expandArrowOperations(operations) {
    const taps = [];
    operations.forEach((count, cell) => {
      for (let index = 0; index < count; index += 1) {
        taps.push(cell);
      }
    });
    return taps;
  }

  function applyArrowTap(initial, specOrDifficulty, cell) {
    const operations = Array.from({ length: arrowCellCount(specOrDifficulty) }, () => 0);
    operations[cell] = 1;
    return applyArrowOperations(initial, specOrDifficulty, operations);
  }

  function applyArrowInputTap(initial, specOrDifficulty, cell) {
    const spec = normalizeArrowSpec(specOrDifficulty);
    const values = initial.slice();
    values[cell] = modValue(values[cell] + 1, spec.directions);
    return values;
  }

  function countArrowPressCells(operations) {
    return operations.filter((count) => count > 0).length;
  }

  function solveArrowPuzzle(options) {
    const spec = options.difficulty
      ? getGameSpec("arrow", options.difficulty)
      : normalizeArrowSpec(options.spec || options);
    const directions = Number(spec.directions);
    const puzzle = buildArrowPuzzleFromSpec(spec);
    const initial = options.initial.map(Number);
    if (initial.length !== puzzle.affectedBy.length) {
      throw solverError("invalidArrowBoard");
    }
    const rhs = initial.map((value) => modValue(0 - value, directions));
    let best;
    if (directions === 2 || directions === 3 || directions === 5) {
      best = solvePrimeModulus(puzzle.affectedBy, rhs, directions);
    } else if (directions === 4) {
      best = solveMod4(puzzle.affectedBy, rhs);
    } else if (directions === 6) {
      best = solveMod6(puzzle.affectedBy, rhs);
    } else {
      throw solverError("invalidArrowSpec");
    }
    const bestAnswer = best.found
      ? { found: true, target: 0, totalOperations: best.cost, operations: best.operations }
      : { found: false, target: 0, totalOperations: 0, operations: [] };
    return { ...puzzle, answer: bestAnswer };
  }

  function findValue(board, value) {
    return board.indexOf(value);
  }

  function applyFifteenMove(board, size, move) {
    const blank = findValue(board, 0);
    const [row, col] = posToRc(blank, size);
    let nextRow = row;
    let nextCol = col;
    if (move === "U") nextRow -= 1;
    if (move === "D") nextRow += 1;
    if (move === "L") nextCol -= 1;
    if (move === "R") nextCol += 1;
    if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) {
      throw solverError("invalidSlideMove");
    }
    const next = rcToPos(nextRow, nextCol, size);
    [board[blank], board[next]] = [board[next], board[blank]];
  }

  function isFifteenSolvable(board, size) {
    const values = board.filter((value) => value !== 0);
    let inversions = 0;
    for (let i = 0; i < values.length; i += 1) {
      for (let j = i + 1; j < values.length; j += 1) {
        if (values[i] > values[j]) inversions += 1;
      }
    }
    if (size % 2 === 1) {
      return inversions % 2 === 0;
    }
    const blankRowFromBottom = size - Math.floor(findValue(board, 0) / size);
    return (blankRowFromBottom % 2 === 0) !== (inversions % 2 === 0);
  }

  function createFifteenGoal(size) {
    const board = Array.from({ length: size * size }, (_, i) => i + 1);
    board[size * size - 1] = 0;
    return board;
  }

  function applyFifteenMoves(inputBoard, size, moves) {
    const board = inputBoard.slice();
    for (const move of moves) {
      applyFifteenMove(board, size, move);
    }
    return board;
  }

  function invertFifteenMove(move) {
    return { U: "D", D: "U", L: "R", R: "L" }[move];
  }

  function getFifteenStep(inputBoard, size, move) {
    const blankIndex = findValue(inputBoard, 0);
    const [row, col] = posToRc(blankIndex, size);
    let tileRow = row;
    let tileCol = col;
    if (move === "U") tileRow -= 1;
    if (move === "D") tileRow += 1;
    if (move === "L") tileCol -= 1;
    if (move === "R") tileCol += 1;
    if (tileRow < 0 || tileRow >= size || tileCol < 0 || tileCol >= size) {
      throw solverError("invalidSlideMove");
    }
    const tileIndex = rcToPos(tileRow, tileCol, size);
    return {
      move,
      inverseMove: invertFifteenMove(move),
      tile: inputBoard[tileIndex],
      from: tileIndex,
      to: blankIndex,
      blank: blankIndex,
    };
  }

  function applyFifteenStep(inputBoard, size, move) {
    return applyFifteenMoves(inputBoard, size, [move]);
  }

  function formatFifteenDisplayValue(value) {
    return value === 0 ? "" : String(value);
  }

  function solveTrackedTiles(board, size, targets, locked) {
    const startTiles = targets.map((target) => findValue(board, target.tile));
    const startBlank = findValue(board, 0);
    const key = (tiles, blank) => `${tiles.join(".")},${blank}`;
    const queue = [[startTiles, startBlank, ""]];
    const seen = new Set([key(startTiles, startBlank)]);
    const dirs = [["U", -1, 0], ["D", 1, 0], ["L", 0, -1], ["R", 0, 1]];
    const isGoal = (tiles) => tiles.every((pos, i) => pos === targets[i].goal);
    for (let head = 0; head < queue.length; head += 1) {
      const [tiles, blank, path] = queue[head];
      if (isGoal(tiles)) {
        return path;
      }
      const [row, col] = posToRc(blank, size);
      for (const [move, dr, dc] of dirs) {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) continue;
        const nextBlank = rcToPos(nextRow, nextCol, size);
        if (locked.has(nextBlank)) continue;
        const nextTiles = tiles.slice();
        const hit = nextTiles.indexOf(nextBlank);
        if (hit !== -1) {
          nextTiles[hit] = blank;
        }
        const nextKey = key(nextTiles, nextBlank);
        if (!seen.has(nextKey)) {
          seen.add(nextKey);
          queue.push([nextTiles, nextBlank, path + move]);
        }
      }
    }
    throw solverError("tilePlacementFailed");
  }

  function manhattanState(arrangement, cells, size) {
    let sum = 0;
    for (let i = 0; i < arrangement.length; i += 1) {
      const value = arrangement[i];
      if (value === 0) continue;
      const [row, col] = posToRc(cells[i], size);
      const [goalRow, goalCol] = posToRc(value - 1, size);
      sum += Math.abs(row - goalRow) + Math.abs(col - goalCol);
    }
    return sum;
  }

  function solveRemainingAStar(board, size, cells) {
    const start = cells.map((pos) => board[pos]);
    const goal = cells.map((pos) => (pos === size * size - 1 ? 0 : pos + 1));
    const goalKey = goal.join(",");
    if (start.join(",") === goalKey) {
      return "";
    }
    const cellIndex = new Map(cells.map((pos, i) => [pos, i]));
    const dirs = [["U", -1, 0], ["D", 1, 0], ["L", 0, -1], ["R", 0, 1]];
    const open = [{ arr: start, g: 0, h: manhattanState(start, cells, size), path: "" }];
    const best = new Map([[start.join(","), 0]]);
    for (let iter = 0; open.length && iter < 500000; iter += 1) {
      let bestIndex = 0;
      for (let i = 1; i < open.length; i += 1) {
        const a = open[i];
        const b = open[bestIndex];
        if (a.g + a.h < b.g + b.h || (a.g + a.h === b.g + b.h && a.h < b.h)) {
          bestIndex = i;
        }
      }
      const current = open.splice(bestIndex, 1)[0];
      const currentKey = current.arr.join(",");
      if (currentKey === goalKey) {
        return current.path;
      }
      if (best.get(currentKey) !== current.g) {
        continue;
      }
      const blankIndex = current.arr.indexOf(0);
      const [row, col] = posToRc(cells[blankIndex], size);
      for (const [move, dr, dc] of dirs) {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) continue;
        const nextPos = rcToPos(nextRow, nextCol, size);
        if (!cellIndex.has(nextPos)) continue;
        const nextIndex = cellIndex.get(nextPos);
        const next = current.arr.slice();
        [next[blankIndex], next[nextIndex]] = [next[nextIndex], next[blankIndex]];
        const nextKey = next.join(",");
        const nextG = current.g + 1;
        if (best.has(nextKey) && best.get(nextKey) <= nextG) {
          continue;
        }
        best.set(nextKey, nextG);
        open.push({ arr: next, g: nextG, h: manhattanState(next, cells, size), path: current.path + move });
      }
    }
    throw solverError("remainingSearchLimit");
  }

  function solveFifteenPuzzle(inputBoard, size) {
    const expected = Array.from({ length: size * size }, (_, i) => i);
    if (!validatePermutation(inputBoard, expected)) {
      throw solverError("invalidFifteenPermutation");
    }
    if (!isFifteenSolvable(inputBoard, size)) {
      throw solverError("unsolvableFifteen");
    }
    const board = inputBoard.slice();
    const locked = new Set();
    const moves = [];
    const doPath = (path) => {
      for (const move of path) {
        applyFifteenMove(board, size, move);
        moves.push(move);
      }
    };
    for (let offset = 0; size - offset > 3; offset += 1) {
      for (let col = offset; col <= size - 3; col += 1) {
        const goal = rcToPos(offset, col, size);
        doPath(solveTrackedTiles(board, size, [{ tile: goal + 1, goal }], locked));
        locked.add(goal);
      }
      let goalA = rcToPos(offset, size - 2, size);
      let goalB = rcToPos(offset, size - 1, size);
      doPath(solveTrackedTiles(board, size, [{ tile: goalA + 1, goal: goalA }, { tile: goalB + 1, goal: goalB }], locked));
      locked.add(goalA);
      locked.add(goalB);
      for (let row = offset + 1; row <= size - 3; row += 1) {
        const goal = rcToPos(row, offset, size);
        doPath(solveTrackedTiles(board, size, [{ tile: goal + 1, goal }], locked));
        locked.add(goal);
      }
      goalA = rcToPos(size - 2, offset, size);
      goalB = rcToPos(size - 1, offset, size);
      doPath(solveTrackedTiles(board, size, [{ tile: goalA + 1, goal: goalA }, { tile: goalB + 1, goal: goalB }], locked));
      locked.add(goalA);
      locked.add(goalB);
    }
    const cells = [];
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const pos = rcToPos(row, col, size);
        if (!locked.has(pos)) {
          cells.push(pos);
        }
      }
    }
    doPath(solveRemainingAStar(board, size, cells));
    return { moves, finalBoard: board };
  }

  function scrambleFifteen(size, steps, rng = Math.random) {
    const board = createFifteenGoal(size);
    const opposite = { U: "D", D: "U", L: "R", R: "L" };
    let last = "";
    for (let i = 0; i < steps; i += 1) {
      const blank = findValue(board, 0);
      const [row, col] = posToRc(blank, size);
      let moves = [];
      if (row > 0) moves.push("U");
      if (row < size - 1) moves.push("D");
      if (col > 0) moves.push("L");
      if (col < size - 1) moves.push("R");
      moves = moves.filter((move) => move !== opposite[last]);
      const move = moves[randomInt(rng, moves.length)];
      applyFifteenMove(board, size, move);
      last = move;
    }
    return board;
  }

  function applyTorusMove(matrix, op) {
    const size = matrix.length;
    for (let count = 0; count < op.amount; count += 1) {
      if (op.type === "U") {
        const first = matrix[0][op.index];
        for (let row = 0; row < size - 1; row += 1) matrix[row][op.index] = matrix[row + 1][op.index];
        matrix[size - 1][op.index] = first;
      } else if (op.type === "D") {
        const last = matrix[size - 1][op.index];
        for (let row = size - 1; row > 0; row -= 1) matrix[row][op.index] = matrix[row - 1][op.index];
        matrix[0][op.index] = last;
      } else if (op.type === "L") {
        matrix[op.index].push(matrix[op.index].shift());
      } else if (op.type === "R") {
        matrix[op.index].unshift(matrix[op.index].pop());
      }
    }
  }

  function createTorusGoal(size) {
    return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_v, col) => row * size + col + 1));
  }

  function applyTorusOperations(inputMatrix, operations) {
    const matrix = cloneMatrix(inputMatrix);
    for (const op of operations) {
      applyTorusMove(matrix, op);
    }
    return matrix;
  }

  function invertTorusOperation(op) {
    return {
      type: { U: "D", D: "U", L: "R", R: "L" }[op.type],
      index: op.index,
      amount: op.amount,
    };
  }

  function getTorusOperationInfo(op) {
    return {
      axis: op.type === "L" || op.type === "R" ? "row" : "column",
      index: op.index + 1,
      direction: op.type,
      amount: op.amount,
    };
  }

  function applyTorusOperation(inputMatrix, op) {
    return applyTorusOperations(inputMatrix, [op]);
  }

  function mergeTorusOperations(operations, size) {
    const opposite = { U: "D", D: "U", L: "R", R: "L" };
    const result = [];
    for (const op of operations) {
      let amount = modValue(op.amount, size);
      if (amount === 0) continue;
      const last = result[result.length - 1];
      if (last && last.index === op.index && (last.type === op.type || last.type === opposite[op.type])) {
        const signed = last.type === op.type ? last.amount + amount : last.amount - amount;
        if (signed === 0) {
          result.pop();
        } else if (signed > 0) {
          last.amount = modValue(signed, size);
          if (last.amount === 0) result.pop();
        } else {
          last.type = opposite[last.type];
          last.amount = modValue(-signed, size);
          if (last.amount === 0) result.pop();
        }
      } else {
        result.push({ type: op.type, index: op.index, amount });
      }
    }
    return result;
  }

  function parseBoardValues(text) {
    return text.trim().split(/[\s,\t\r\n]+/).filter(Boolean).map((token) => Number(token));
  }

  function analyzePermutation(values, expected) {
    const expectedSet = new Set(expected);
    const seen = new Map();
    const duplicateIndices = new Set();
    const outOfRangeIndices = new Set();
    values.forEach((value, index) => {
      if (!Number.isInteger(value) || !expectedSet.has(value)) {
        outOfRangeIndices.add(index);
        return;
      }
      if (seen.has(value)) {
        duplicateIndices.add(seen.get(value));
        duplicateIndices.add(index);
      } else {
        seen.set(value, index);
      }
    });
    const missingValues = expected.filter((value) => !seen.has(value));
    const codes = [];
    if (duplicateIndices.size) codes.push("duplicateNumbers");
    if (outOfRangeIndices.size) codes.push("outOfRangeNumbers");
    if (missingValues.length) codes.push("missingNumbers");
    return {
      valid: codes.length === 0 && values.length === expected.length,
      codes,
      duplicateIndices: Array.from(duplicateIndices),
      outOfRangeIndices: Array.from(outOfRangeIndices),
      invalidIndices: Array.from(new Set([...duplicateIndices, ...outOfRangeIndices])),
      missingValues,
    };
  }

  function validateFifteenInput(values, size) {
    return analyzePermutation(values, Array.from({ length: size * size }, (_, i) => i));
  }

  function validateTorusInput(values, size) {
    return analyzePermutation(values, Array.from({ length: size * size }, (_, i) => i + 1));
  }

  function validatePastedValues(values, expectedLength) {
    if (values.length !== expectedLength) {
      return { valid: false, code: "pasteValueCountMismatch" };
    }
    return { valid: true, code: "" };
  }

  function solveTorusPuzzle(inputMatrix) {
    const matrix = cloneMatrix(inputMatrix);
    const size = matrix.length;
    const expected = Array.from({ length: size * size }, (_, i) => i + 1);
    if (!validatePermutation(matrix.flat(), expected)) {
      throw solverError("invalidTorusPermutation");
    }
    const ops = [];
    const pushOp = (type, index) => {
      const opposite = { U: "D", D: "U", L: "R", R: "L" };
      const last = ops[ops.length - 1];
      if (last && last.type === opposite[type] && last.index === index) {
        last.amount -= 1;
        if (last.amount === 0) ops.pop();
        return;
      }
      if (last && last.type === type && last.index === index) {
        last.amount += 1;
      } else {
        ops.push({ type, index, amount: 1 });
      }
    };
    const vertical = (col, amount = -1) => {
      let offset = modValue(amount, size);
      if (size - offset < offset) {
        for (let k = 0; k < size - offset; k += 1) {
          pushOp("D", col);
          applyTorusMove(matrix, { type: "D", index: col, amount: 1 });
        }
      } else {
        for (let k = 0; k < offset; k += 1) {
          pushOp("U", col);
          applyTorusMove(matrix, { type: "U", index: col, amount: 1 });
        }
      }
    };
    const horizontal = (row, amount = -1) => {
      let offset = modValue(amount, size);
      if (size - offset < offset) {
        for (let k = 0; k < size - offset; k += 1) {
          pushOp("R", row);
          applyTorusMove(matrix, { type: "R", index: row, amount: 1 });
        }
      } else {
        for (let k = 0; k < offset; k += 1) {
          pushOp("L", row);
          applyTorusMove(matrix, { type: "L", index: row, amount: 1 });
        }
      }
    };
    const sorted = matrix.flat().slice().sort((a, b) => a - b);
    for (let row = 0; row < size - 1; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const current = sorted.shift();
        let flatIndex = matrix.flat().indexOf(current);
        let foundRow = Math.floor(flatIndex / size);
        let foundCol = flatIndex % size;
        if (foundRow === row) {
          if (col === 0) {
            horizontal(row, flatIndex - col);
          } else if (col < foundCol) {
            if (row) {
              vertical(foundCol, 1);
              horizontal(row, col - flatIndex);
              vertical(foundCol);
              horizontal(row, flatIndex - col);
            } else {
              vertical(flatIndex);
              horizontal(1, flatIndex - col);
              vertical(col, 1);
            }
          }
        } else {
          if (col === foundCol) {
            horizontal(foundRow);
            flatIndex += 1;
            if (flatIndex % size === 0) flatIndex -= size;
            foundRow = Math.floor(flatIndex / size);
          }
          if (row) vertical(col, row - foundRow);
          horizontal(foundRow, flatIndex - col);
          vertical(col, foundRow - row);
        }
      }
    }
    const order = matrix[size - 1].map((value) => sorted.indexOf(value));
    const scores = [];
    for (let offset = 0; offset < size; offset += 1) {
      let inversions = 0;
      for (let j = 0; j < size; j += 1) {
        for (let k = 0; k < j; k += 1) {
          if (order[(offset + j) % size] < order[(offset + k) % size]) inversions += 1;
        }
      }
      let distance = 0;
      for (let j = 0; j < size; j += 1) {
        distance += Math.abs(order[(offset + j) % size] - j);
      }
      scores.push(inversions % 2 ? size * size : distance);
    }
    const minScore = Math.min(...scores);
    const left = scores.indexOf(minScore);
    const right = -(scores.slice().reverse().indexOf(minScore) + 1);
    horizontal(size - 1, Math.abs(right) < Math.abs(left) ? right : left);
    for (let col = 0; col < size - 2; col += 1) {
      const found = matrix[size - 1].indexOf(sorted[col]);
      if (found > col) {
        let swapTarget = sorted.indexOf(matrix[size - 1][col]);
        if (swapTarget === found) {
          swapTarget = found - col === 1 ? col + 2 : col + 1;
        }
        vertical(found);
        horizontal(size - 1, col - found);
        vertical(found, 1);
        horizontal(size - 1, swapTarget - col);
        vertical(found);
        horizontal(size - 1, found - swapTarget);
        vertical(found, 1);
      }
    }
    const check = cloneMatrix(inputMatrix);
    for (const op of ops) applyTorusMove(check, op);
    if (!check.flat().every((value, i) => value === i + 1)) {
      throw solverError("unreachableTorus");
    }
    return { operations: ops, finalMatrix: check };
  }

  function scrambleTorus(size, steps, rng = Math.random) {
    const matrix = createTorusGoal(size);
    const types = ["U", "D", "L", "R"];
    for (let i = 0; i < steps; i += 1) {
      applyTorusMove(matrix, {
        type: types[randomInt(rng, types.length)],
        index: randomInt(rng, size),
        amount: 1 + randomInt(rng, size - 1),
      });
    }
    return matrix;
  }

  function oneBasedPosition(index, columns) {
    return {
      row: Math.floor(index / columns) + 1,
      col: (index % columns) + 1,
    };
  }

  function fitCellSize(availableWidth, cells, gap, minSize, maxSize) {
    const usable = availableWidth - Math.max(0, cells - 1) * gap;
    const size = usable / cells;
    return Math.max(minSize, Math.min(maxSize, size));
  }

  const ARROW_DISPLAY_MODES = Object.freeze(["numbers", "arrows", "both"]);

  function normalizeArrowDisplayMode(value) {
    return ARROW_DISPLAY_MODES.includes(value) ? value : "numbers";
  }

  function arrowDisplayValue(value) {
    return value + 1;
  }

  function createArrowPressCounts(solution, cellCount) {
    const counts = Array.from({ length: cellCount }, () => 0);
    for (const cell of solution) {
      if (Number.isInteger(cell) && cell >= 0 && cell < cellCount) counts[cell] += 1;
    }
    return counts;
  }

  function arrowPressBadgeText(count) {
    return count > 0 ? `×${count}` : "";
  }

  function actionDirectionSymbol(direction) {
    return { L: "←", R: "→", U: "↑", D: "↓" }[direction] || "";
  }

  function torusActionData(op) {
    const info = getTorusOperationInfo(op);
    return {
      axis: info.axis,
      index: info.index,
      direction: info.direction,
      symbol: actionDirectionSymbol(info.direction),
      amount: info.amount,
    };
  }

  function fifteenActionData(board, size, move) {
    const step = getFifteenStep(board, size, move);
    return {
      tile: step.tile,
      blankDirection: step.move,
      blankSymbol: actionDirectionSymbol(step.move),
      from: step.from,
      to: step.to,
    };
  }

  const solvers = {
    GAME_SPECS,
    getGameSpec,
    arrow: {
      buildHexRowLengths,
      buildSquareRowLengths,
      buildSquareAffectedBy,
      buildHexAffectedBy,
      buildArrowPuzzleFromSpec,
      createArrowGoal,
      applyArrowOperations,
      applyArrowTap,
      applyArrowInputTap,
      expandArrowOperations,
      countArrowPressCells,
      scrambleArrowPuzzle,
      solveArrowPuzzle,
    },
    fifteen: {
      createFifteenGoal,
      solveFifteenPuzzle,
      scrambleFifteen,
      applyFifteenMove,
      applyFifteenMoves,
      applyFifteenStep,
      getFifteenStep,
      invertFifteenMove,
      formatFifteenDisplayValue,
      isFifteenSolvable,
    },
    torus: {
      createTorusGoal,
      solveTorusPuzzle,
      scrambleTorus,
      applyTorusMove,
      applyTorusOperation,
      applyTorusOperations,
      invertTorusOperation,
      getTorusOperationInfo,
      mergeTorusOperations,
    },
    input: { parseBoardValues, analyzePermutation, validateFifteenInput, validateTorusInput, validatePastedValues },
    ui: {
      PUZZLE_LABELS,
      ARROW_DISPLAY_MODES,
      normalizeArrowDisplayMode,
      arrowDisplayValue,
      createArrowPressCounts,
      arrowPressBadgeText,
      actionDirectionSymbol,
      torusActionData,
      fifteenActionData,
      oneBasedPosition,
      fitCellSize,
    },
    util: { modValue, cloneMatrix, createSeededRandom },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = solvers;
  }
  global.MinigameSolvers = solvers;
})(typeof window !== "undefined" ? window : globalThis);

(function () {
  "use strict";

  if (typeof document === "undefined") return;

  const S = window.MinigameSolvers;

  const text = {
    ja: {
      documentTitle: "Exponential Idle ミニゲーム盤面ソルバー | trinitrotorol",
      appTitleSuffix: "ミニゲーム盤面ソルバー",
      appLead: "盤面を入力して、次の操作だけを確認できます。",
      languageToggleLabel: "言語切替",
      tabListLabel: "パズル切替",
      arrowHelp: "盤面入力では各マスの表示だけを合わせます。解答後、押すマスと回数を表示します。",
      fifteenHelp: "空白は0または空欄です。解答後、次に動かす数字を表示します。",
      torusHelp: "行・列番号は1始まりです。解答後、動かす行または列と方向を表示します。",
      difficultyLabel: "難易度",
      displayLabel: "表示",
      displayNumbers: "数字",
      displayArrows: "矢印",
      displayBoth: "両方",
      easy: "Easy",
      medium: "Medium",
      hard: "Hard",
      expert: "Expert",
      solveButton: "解く",
      shuffleButton: "シャッフル",
      resetButton: "完成盤面",
      resetButtonShort: "完成",
      resetButtonAria: "完成盤面に戻す",
      arrowSolutionTitle: "押すマスと回数",
      fifteenSolutionTitle: "次に押す数字",
      torusSolutionTitle: "次の操作",
      sourceNote: "参考: Exponential Idle GuidesのMinigamesページと公開ソルバー実装。",
      arrowNote: "表示された数字や矢印を、ゲーム内の現在の向きに合わせます。",
      fifteenNote: "Hardは5x5。最適解ではなく実用手順です。",
      torusNote: "Easyは3x3、Mediumは5x5、Hardは6x6です。",
      boardInputLabel: "{puzzle}盤面入力",
      pending: "解くと表示します",
      noSolution: "解が見つかりませんでした。",
      solvedIn: "手数",
      statusLabel: "状態",
      statusSolving: "計算中…",
      statusSolved: "解答済み",
      statusError: "エラー",
      nextOperation: "次の操作",
      firstStep: "最初",
      previousStep: "前",
      nextStep: "次",
      lastStep: "最後",
      restoreInput: "入力",
      firstStepAria: "最初の手順を表示",
      previousStepAria: "前の手順を表示",
      nextStepAria: "次の手順を表示",
      lastStepAria: "最後の手順を表示",
      restoreInputAria: "入力盤面に戻す",
      stepCounter: "手順",
      completed: "完了済み",
      completedShort: "完了",
      incomplete: "未完了",
      arrowOrderNote: "順番は自由です。表示された回数だけ押してください。",
      arrowCheckSteps: "確認用ステップ",
      totalTaps: "総タップ数",
      pressedCells: "押すマス数",
      currentStep: "現在ステップ",
      tapCell: "ゲーム内で押すマス",
      remainingTaps: "残り",
      directionState: "向き",
      taps: "タップ回数",
      blankMoves: "空白の動き",
      torusOps: "操作",
      fifteenPasteHint: "複数行貼り付け可。空白は0または空欄。",
      torusPasteHint: "複数行貼り付け可。1〜n²を入力。",
      nextTileShort: "次の数字",
      blankMoveShort: "空白",
      stepPosition: "{current} / {total}",
      torusRowAction: "{index}行目を{direction}へ{amount}",
      torusColumnAction: "{index}列目を{direction}へ{amount}",
      row: "行",
      col: "列",
      up: "上",
      down: "下",
      left: "左",
      right: "右",
      blank: "空白",
      moveTileIntoBlank: "{tile}を空白へ移動",
      blankMove: "空白: {direction}",
      shiftRow: "{index}行目を{direction}へ{amount}",
      shiftColumn: "{index}列目を{direction}へ{amount}",
      cellPosition: "{row}行{col}列",
      arrowInputCellLabel: "{position}、表示 {value}。入力操作: このマスだけを次の向きへ変更します。",
      arrowSolvedCellLabel: "{position}、表示 {value}。ゲーム内で{count}回押します。",
      arrowSolvedCellNoPressLabel: "{position}、表示 {value}。このマスは押しません。",
      fifteenInputLabel: "{position}、値 {value}。0から{max}までを入力できます。",
      fifteenBlankInputLabel: "{position}、空白。0から{max}までを入力できます。",
      torusInputLabel: "{position}、値 {value}。1から{max}までを入力できます。",
      duplicateNumbers: "重複があります",
      missingNumbers: "不足があります",
      outOfRangeNumbers: "範囲外の数字があります",
      pasteValueCountMismatch: "貼り付け数が違います",
      moreMoves: "件を省略",
      invalidDifficulty: "未対応の難易度です。",
      invalidArrowSpec: "未対応のArrow設定です。",
      invalidArrowBoard: "Arrow盤面のマス数が難易度と一致しません。",
      noModularInverse: "Arrowソルバーの内部計算に失敗しました。",
      tooManySolutions: "候補が多すぎるためブラウザで解けませんでした。",
      chineseRemainderFailed: "Arrowソルバーの内部計算に失敗しました。",
      invalidSlideMove: "15パズルの操作が不正です。",
      tilePlacementFailed: "15パズルの一部タイルを配置できませんでした。",
      remainingSearchLimit: "15パズルの最後の探索が上限に達しました。",
      invalidFifteenPermutation: "0を空白として、各数字を1回ずつ入力してください。",
      unsolvableFifteen: "この15パズル盤面は解けない配置です。",
      invalidTorusPermutation: "1からn²までの各数字を1回ずつ入力してください。",
      unreachableTorus: "このTorus盤面は対応している到達可能集合の外です。",
      unknownError: "解法の計算中にエラーが発生しました。",
    },
    en: {
      documentTitle: "Exponential Idle Minigame Board Solver | trinitrotorol",
      appTitleSuffix: "Minigame Board Solver",
      appLead: "Enter the board and check only the next operation.",
      languageToggleLabel: "Language",
      tabListLabel: "Puzzle selector",
      arrowHelp: "Match only each cell's displayed direction. After solving, the cells to press and counts are shown.",
      fifteenHelp: "Use 0 or an empty cell for the blank. After solving, the next tile to move is shown.",
      torusHelp: "Rows and columns are 1-based. After solving, the row or column and direction are shown.",
      difficultyLabel: "Difficulty",
      displayLabel: "Display",
      displayNumbers: "Numbers",
      displayArrows: "Arrows",
      displayBoth: "Both",
      easy: "Easy",
      medium: "Medium",
      hard: "Hard",
      expert: "Expert",
      solveButton: "Solve",
      shuffleButton: "Shuffle",
      resetButton: "Solved board",
      resetButtonShort: "Solved",
      resetButtonAria: "Reset to the solved board",
      arrowSolutionTitle: "Cells to Press",
      fifteenSolutionTitle: "Next Tile",
      torusSolutionTitle: "Next Move",
      sourceNote: "References: Exponential Idle Guides Minigames page and public solver implementations.",
      arrowNote: "Match the shown numbers or arrows to the current in-game directions.",
      fifteenNote: "Hard is 5x5. The solver returns a practical route.",
      torusNote: "Easy is 3x3, Medium is 5x5, and Hard is 6x6.",
      boardInputLabel: "{puzzle} board input",
      pending: "Solve to show it",
      noSolution: "No solution was found.",
      solvedIn: "moves",
      statusLabel: "Status",
      statusSolving: "Solving…",
      statusSolved: "Solved",
      statusError: "Error",
      nextOperation: "Next operation",
      firstStep: "First",
      previousStep: "Prev",
      nextStep: "Next",
      lastStep: "Last",
      restoreInput: "Input",
      firstStepAria: "Show the first step",
      previousStepAria: "Show the previous step",
      nextStepAria: "Show the next step",
      lastStepAria: "Show the last step",
      restoreInputAria: "Restore the input board",
      stepCounter: "Step",
      completed: "Complete",
      completedShort: "Done",
      incomplete: "Incomplete",
      arrowOrderNote: "Order does not matter. Press each marked cell the shown number of times.",
      arrowCheckSteps: "Check steps",
      totalTaps: "Total taps",
      pressedCells: "Pressed cells",
      currentStep: "Current step",
      tapCell: "Cell to press in the game",
      remainingTaps: "remaining",
      directionState: "direction",
      taps: "tap counts",
      blankMoves: "blank moves",
      torusOps: "operations",
      fifteenPasteHint: "Paste multiple lines. Use 0 or blank for the empty cell.",
      torusPasteHint: "Paste multiple lines. Use 1 to n².",
      nextTileShort: "Next tile",
      blankMoveShort: "Blank",
      stepPosition: "{current} / {total}",
      torusRowAction: "Row {index} {symbol} {amount}",
      torusColumnAction: "Col {index} {symbol} {amount}",
      row: "row",
      col: "col",
      up: "up",
      down: "down",
      left: "left",
      right: "right",
      blank: "blank",
      moveTileIntoBlank: "Move {tile} into the blank",
      blankMove: "Blank: {direction}",
      shiftRow: "Shift row {index} {direction} by {amount}",
      shiftColumn: "Shift column {index} {direction} by {amount}",
      cellPosition: "row {row}, column {col}",
      arrowInputCellLabel: "{position}, display {value}. Input action: change only this cell to the next direction.",
      arrowSolvedCellLabel: "{position}, display {value}. Press this cell {count} times in the game.",
      arrowSolvedCellNoPressLabel: "{position}, display {value}. Do not press this cell.",
      fifteenInputLabel: "{position}, value {value}. Enter a value from 0 to {max}.",
      fifteenBlankInputLabel: "{position}, blank. Enter a value from 0 to {max}.",
      torusInputLabel: "{position}, value {value}. Enter a value from 1 to {max}.",
      duplicateNumbers: "Duplicates found",
      missingNumbers: "Missing numbers",
      outOfRangeNumbers: "Numbers are out of range",
      pasteValueCountMismatch: "Paste count mismatch",
      moreMoves: "more",
      invalidDifficulty: "Unsupported difficulty.",
      invalidArrowSpec: "Unsupported Arrow configuration.",
      invalidArrowBoard: "The Arrow board size does not match the selected difficulty.",
      noModularInverse: "The Arrow solver hit an internal calculation error.",
      tooManySolutions: "Too many candidates for the browser solver.",
      chineseRemainderFailed: "The Arrow solver hit an internal calculation error.",
      invalidSlideMove: "Invalid 15-Puzzle slide move.",
      tilePlacementFailed: "Could not place part of the 15-Puzzle board.",
      remainingSearchLimit: "The final 15-Puzzle search reached its limit.",
      invalidFifteenPermutation: "Use each number exactly once, with 0 as the blank.",
      unsolvableFifteen: "This 15-Puzzle position is not solvable.",
      invalidTorusPermutation: "Use each number from 1 to n² exactly once.",
      unreachableTorus: "This Torus position is outside the supported reachable set.",
      unknownError: "An error occurred while solving.",
    },
  };

  const GAME_SPECS = S.GAME_SPECS;
  const ARROW_DISPLAY_STORAGE_KEY = "minigameGuideArrowDisplayMode";

  let lang = localStorage.getItem("minigameGuideLang") || "ja";
  let activeGame = "arrow";
  let arrowDisplayMode = S.ui.normalizeArrowDisplayMode(localStorage.getItem(ARROW_DISPLAY_STORAGE_KEY));
  if (localStorage.getItem(ARROW_DISPLAY_STORAGE_KEY) !== arrowDisplayMode) {
    localStorage.setItem(ARROW_DISPLAY_STORAGE_KEY, arrowDisplayMode);
  }

  function createPlaybackState(board) {
    return {
      originalBoard: copyBoard(board),
      previewBoard: copyBoard(board),
      solution: [],
      currentStep: 0,
      solveStatus: "idle",
      errorCodes: [],
      invalidIndices: [],
      nextAction: null,
    };
  }

  function copyBoard(board) {
    return Array.isArray(board[0]) ? board.map((row) => row.slice()) : board.slice();
  }

  let arrowState = { difficulty: "easy", ...createPlaybackState(S.arrow.createArrowGoal("easy")) };
  let fifteenDifficulty = "easy";
  let fifteenSize = GAME_SPECS.fifteen.easy.size;
  let fifteenState = createPlaybackState(goalFifteen(fifteenSize));
  let torusDifficulty = "easy";
  let torusSize = GAME_SPECS.torus.easy.size;
  let torusState = createPlaybackState(goalTorus(torusSize));

  function t(key) {
    return text[lang][key] || text.en[key] || key;
  }

  function tt(key, values) {
    return Object.entries(values).reduce((message, [name, value]) => {
      return message.replace(`{${name}}`, String(value));
    }, t(key));
  }

  function puzzleLabels(language = lang) {
    return S.ui.PUZZLE_LABELS[language] || S.ui.PUZZLE_LABELS.en;
  }

  function puzzleLabel(game) {
    return puzzleLabels()[game] || S.ui.PUZZLE_LABELS.en[game] || game;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setResult(id, message) {
    byId(id).innerHTML = `<p>${message}</p>`;
  }

  function formatSolverError(error) {
    return t(error && error.code ? error.code : "unknownError");
  }

  function statusText(status) {
    return t(`status${status[0].toUpperCase()}${status.slice(1)}`);
  }

  function setStatus(id, state, detail = "") {
    const status = byId(id);
    status.className = `board-status is-${state.solveStatus}`;
    if (state.solveStatus === "idle" && !detail) {
      status.hidden = true;
      status.textContent = "";
      return;
    }
    status.hidden = false;
    status.innerHTML = `<strong>${t("statusLabel")}:</strong> ${statusText(state.solveStatus)}${detail ? `<br>${detail}` : ""}`;
  }

  function setActionCard(id, options) {
    const root = byId(id);
    const variant = options.variant || "idle";
    root.className = `next-action-card is-${variant}`;
    root.replaceChildren();

    const title = document.createElement("p");
    title.className = "next-action-title";
    title.textContent = options.title || t("nextOperation");

    const main = document.createElement("p");
    main.className = options.big ? "next-action-main is-big" : "next-action-main";
    main.textContent = options.main || t("pending");

    root.append(title, main);

    if (options.symbol) {
      const symbol = document.createElement("p");
      symbol.className = "next-action-symbol";
      symbol.textContent = options.symbol;
      root.append(symbol);
    }

    if (options.meta) {
      const meta = document.createElement("p");
      meta.className = "next-action-meta";
      meta.textContent = options.meta;
      root.append(meta);
    }
  }

  function validationMessage(validation) {
    if (!validation || validation.codes.length === 0) return "";
    return validation.codes.map((code) => t(code)).join(" / ");
  }

  function cellPositionLabel(index, columns) {
    return tt("cellPosition", S.ui.oneBasedPosition(index, columns));
  }

  function arrowCellPositionLabel(index) {
    const spec = currentArrowSpec();
    if (spec.shape === "square") {
      return cellPositionLabel(index, spec.width);
    }
    let offset = 0;
    const rows = arrowRowLengths();
    for (let row = 0; row < rows.length; row += 1) {
      if (index < offset + rows[row]) {
        return tt("cellPosition", { row: row + 1, col: index - offset + 1 });
      }
      offset += rows[row];
    }
    return tt("cellPosition", { row: 1, col: index + 1 });
  }

  function setBoardCells(board, cells) {
    board.style.setProperty("--board-cells", String(cells));
    board.style.setProperty("--board-max-width", `${cells * 64 + Math.max(0, cells - 1) * 5}px`);
  }

  function clearSolutionState(state) {
    state.solution = [];
    state.currentStep = 0;
    state.previewBoard = copyBoard(state.originalBoard);
    state.nextAction = null;
    state.solveStatus = state.errorCodes.length ? "error" : "idle";
  }

  function applyBoardSteps(state, startBoard, steps, applyStep) {
    let board = copyBoard(startBoard);
    for (let index = 0; index < steps; index += 1) {
      board = applyStep(board, state.solution[index]);
    }
    state.previewBoard = board;
    state.currentStep = steps;
  }

  function clampStep(state, step) {
    return Math.max(0, Math.min(state.solution.length, step));
  }

  function movePlayback(state, step, applyStep) {
    applyBoardSteps(state, state.originalBoard, clampStep(state, step), applyStep);
  }

  function currentOperationText(state, describeStep) {
    if (!state.solution.length) return t("pending");
    if (state.currentStep >= state.solution.length) return t("completed");
    return describeStep(state);
  }

  function goalFifteen(size) {
    return S.fifteen.createFifteenGoal(size);
  }

  function goalTorus(size) {
    return S.torus.createTorusGoal(size);
  }

  function fillDifficulty(select, game) {
    const current = select.value || "easy";
    const keys = Object.keys(GAME_SPECS[game]);
    select.replaceChildren(...keys.map((key) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = t(key);
      return option;
    }));
    select.value = keys.includes(current) ? current : "easy";
  }

  function fillArrowDisplayMode() {
    const select = byId("arrow-display-mode");
    const labels = {
      numbers: t("displayNumbers"),
      arrows: t("displayArrows"),
      both: t("displayBoth"),
    };
    select.replaceChildren(...S.ui.ARROW_DISPLAY_MODES.map((mode) => {
      const option = document.createElement("option");
      option.value = mode;
      option.textContent = labels[mode];
      return option;
    }));
    select.value = arrowDisplayMode;
  }

  function applyLanguage() {
    document.documentElement.lang = lang;
    document.title = t("documentTitle");
    for (const node of document.querySelectorAll("[data-i18n]")) {
      node.textContent = t(node.dataset.i18n);
    }
    for (const node of document.querySelectorAll("[data-i18n-aria-label]")) {
      node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
    }
    for (const node of document.querySelectorAll("[data-puzzle-label]")) {
      node.textContent = puzzleLabel(node.dataset.puzzleLabel);
    }
    for (const node of document.querySelectorAll("[data-puzzle-board-label]")) {
      node.setAttribute("aria-label", tt("boardInputLabel", { puzzle: puzzleLabel(node.dataset.puzzleBoardLabel) }));
    }
    for (const button of document.querySelectorAll("[data-lang]")) {
      button.classList.toggle("is-active", button.dataset.lang === lang);
    }
    fillDifficulty(byId("arrow-difficulty"), "arrow");
    fillDifficulty(byId("fifteen-difficulty"), "fifteen");
    fillDifficulty(byId("torus-difficulty"), "torus");
    fillArrowDisplayMode();
    renderAllBoards();
  }

  function renderTabs() {
    for (const button of document.querySelectorAll("[data-game]")) {
      const selected = button.dataset.game === activeGame;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
      button.tabIndex = selected ? 0 : -1;
    }
    for (const panel of document.querySelectorAll("[data-panel]")) {
      const selected = panel.dataset.panel === activeGame;
      panel.classList.toggle("is-active", selected);
      panel.hidden = !selected;
      panel.setAttribute("aria-hidden", selected ? "false" : "true");
    }
  }

  function selectGame(game, focusTab = false) {
    activeGame = game;
    renderTabs();
    if (focusTab) byId(`${game}-tab`).focus();
  }

  function handleTabKeydown(event) {
    const tabs = Array.from(document.querySelectorAll("[role='tab'][data-game]"));
    const currentIndex = tabs.indexOf(event.currentTarget);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectGame(event.currentTarget.dataset.game, true);
      return;
    }
    if (nextIndex !== currentIndex) {
      event.preventDefault();
      selectGame(tabs[nextIndex].dataset.game, true);
    }
  }

  function arrowCellCount() {
    return S.arrow.createArrowGoal(arrowState.difficulty).length;
  }

  function currentArrowSpec() {
    return S.getGameSpec("arrow", arrowState.difficulty);
  }

  function arrowRowLengths() {
    return S.arrow.buildArrowPuzzleFromSpec(currentArrowSpec()).rowLengths;
  }

  function ensureArrowValues(reset) {
    const count = arrowCellCount();
    const directions = currentArrowSpec().directions;
    const values = Array.from({ length: count }, (_, i) => reset ? 0 : S.util.modValue(arrowState.originalBoard[i] || 0, directions));
    arrowState.originalBoard = values;
    arrowState.previewBoard = values.slice();
  }

  function syncArrowInputs() {
    byId("arrow-difficulty").value = arrowState.difficulty;
    ensureArrowValues(false);
  }

  function readArrowInputs() {
    arrowState.difficulty = byId("arrow-difficulty").value;
    ensureArrowValues(false);
    syncArrowInputs();
  }

  function renderArrowBoard() {
    const root = byId("arrow-board");
    const rows = arrowRowLengths();
    const spec = currentArrowSpec();
    root.replaceChildren();
    if (spec.shape === "square") {
      const board = document.createElement("div");
      board.className = `square-board arrow-board arrow-board-${arrowState.difficulty} arrow-mode-${arrowDisplayMode}`;
      board.style.gridTemplateColumns = `repeat(${spec.width}, var(--arrow-cell))`;
      arrowState.previewBoard.forEach((value, index) => board.append(arrowButton(value, index)));
      root.append(board);
      return;
    }
    const board = document.createElement("div");
    board.className = `hex-board arrow-board arrow-board-${arrowState.difficulty} arrow-mode-${arrowDisplayMode}`;
    let index = 0;
    for (const rowLength of rows) {
      const row = document.createElement("div");
      row.className = "hex-row";
      for (let col = 0; col < rowLength; col += 1) {
        row.append(arrowButton(arrowState.previewBoard[index], index));
        index += 1;
      }
      board.append(row);
    }
    root.append(board);
  }

  function arrowAngle(value) {
    return value * (360 / currentArrowSpec().directions);
  }

  function arrowButton(value, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `arrow-tile arrow-mode-${arrowDisplayMode}${value ? " is-lit" : ""}`;
    const pressCounts = arrowState.solveStatus === "solved"
      ? S.ui.createArrowPressCounts(arrowState.solution, arrowCellCount())
      : [];
    const pressCount = pressCounts[index] || 0;
    if (pressCount) button.classList.add("is-marked-action");
    const position = arrowCellPositionLabel(index);
    const displayValue = S.ui.arrowDisplayValue(value);
    button.setAttribute("aria-label", tt(
      arrowState.solveStatus === "solved"
        ? (pressCount ? "arrowSolvedCellLabel" : "arrowSolvedCellNoPressLabel")
        : "arrowInputCellLabel",
      { position, value: displayValue, count: pressCount },
    ));
    button.setAttribute("aria-describedby", "arrow-status");
    const children = [];
    if (arrowDisplayMode !== "numbers") {
      const icon = document.createElement("span");
      icon.className = "arrow-icon";
      icon.style.setProperty("--arrow-angle", `${arrowAngle(value)}deg`);
      icon.setAttribute("aria-hidden", "true");
      children.push(icon);
    }
    if (arrowDisplayMode !== "arrows") {
      const valueText = document.createElement("span");
      valueText.className = arrowDisplayMode === "numbers" ? "arrow-main-value" : "arrow-value";
      valueText.textContent = String(displayValue);
      valueText.setAttribute("aria-hidden", "true");
      children.push(valueText);
    }
    button.replaceChildren(...children);
    if (pressCount) {
      const badge = document.createElement("span");
      badge.className = "tap-badge press-count-badge";
      badge.textContent = S.ui.arrowPressBadgeText(pressCount);
      badge.setAttribute("aria-hidden", "true");
      button.append(badge);
    }
    button.addEventListener("click", () => {
      arrowState.originalBoard = S.arrow.applyArrowInputTap(arrowState.originalBoard, arrowState.difficulty, index);
      arrowState.previewBoard = arrowState.originalBoard.slice();
      clearSolutionState(arrowState);
      renderArrowBoard();
      renderArrowPlayback();
    });
    return button;
  }

  function renderOperationBoard(rows, operations) {
    const board = document.createElement("div");
    const spec = currentArrowSpec();
    board.className = spec.shape === "square" ? "square-board mini-board" : "hex-board mini-board";
    if (spec.shape === "square") {
      board.style.gridTemplateColumns = `repeat(${spec.width}, minmax(0, 1fr))`;
      for (const value of operations) {
        const tile = document.createElement("span");
        tile.className = `solution-tile${value === 0 ? " is-zero" : ""}`;
        tile.textContent = String(value);
        board.append(tile);
      }
      return board;
    }
    let index = 0;
    for (const rowLength of rows) {
      const row = document.createElement("div");
      row.className = "hex-row";
      for (let col = 0; col < rowLength; col += 1) {
        const value = operations[index];
        const tile = document.createElement("span");
        tile.className = `solution-tile${value === 0 ? " is-zero" : ""}`;
        tile.textContent = String(value);
        row.append(tile);
        index += 1;
      }
      board.append(row);
    }
    return board;
  }

  function solveArrow() {
    readArrowInputs();
    const result = byId("arrow-result");
    byId("arrow-solve").disabled = true;
    arrowState.solveStatus = "solving";
    renderArrowPlayback();
    try {
      const solution = S.arrow.solveArrowPuzzle({ difficulty: arrowState.difficulty, initial: arrowState.originalBoard });
      if (!solution.answer.found) {
        arrowState.solveStatus = "error";
        renderArrowPlayback(t("noSolution"));
        return;
      }
      arrowState.solution = S.arrow.expandArrowOperations(solution.answer.operations);
      arrowState.currentStep = 0;
      arrowState.previewBoard = arrowState.originalBoard.slice();
      arrowState.solveStatus = "solved";
      result.replaceChildren();
      renderArrowPlayback();
      renderArrowBoard();
    } catch (error) {
      arrowState.solveStatus = "error";
      renderArrowPlayback(formatSolverError(error));
    } finally {
      byId("arrow-solve").disabled = false;
    }
  }

  function shuffleArrow() {
    readArrowInputs();
    arrowState.originalBoard = S.arrow.scrambleArrowPuzzle(arrowState.difficulty, arrowCellCount() * 4);
    clearSolutionState(arrowState);
    renderArrowBoard();
    renderArrowPlayback();
  }

  function createPlaybackControls(state, onMove, onRestore) {
    const wrapper = document.createElement("div");
    wrapper.className = "playback-controls";
    const counter = document.createElement("p");
    counter.className = "operation-copy";
    counter.innerHTML = `<strong>${t("stepCounter")}:</strong> ${state.currentStep} / ${state.solution.length}`;
    const mainButtons = document.createElement("div");
    mainButtons.className = "playback-buttons playback-buttons-main";
    const secondaryButtons = document.createElement("div");
    secondaryButtons.className = "playback-buttons playback-buttons-secondary";
    const makeButton = ([label, ariaLabel, action, disabled, role]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = role === "main" ? "game-button primary" : "game-button secondary";
      button.textContent = label;
      button.setAttribute("aria-label", ariaLabel);
      button.disabled = disabled;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.setTimeout(action, 0);
      });
      return button;
    };
    [
      [t("previousStep"), t("previousStepAria"), () => onMove(state.currentStep - 1), state.currentStep === 0, "main"],
      [t("nextStep"), t("nextStepAria"), () => onMove(state.currentStep + 1), state.currentStep >= state.solution.length, "main"],
    ].forEach((spec) => mainButtons.append(makeButton(spec)));
    [
      [t("firstStep"), t("firstStepAria"), () => onMove(0), state.currentStep === 0, "secondary"],
      [t("lastStep"), t("lastStepAria"), () => onMove(state.solution.length), state.currentStep >= state.solution.length, "secondary"],
      [t("restoreInput"), t("restoreInputAria"), () => onRestore(), false, "secondary"],
    ].forEach((spec) => secondaryButtons.append(makeButton(spec)));
    wrapper.append(counter, mainButtons, secondaryButtons);
    return wrapper;
  }

  function moveArrowPlayback(step) {
    movePlayback(arrowState, step, (board, cell) => S.arrow.applyArrowTap(board, arrowState.difficulty, cell));
    renderArrowBoard();
    renderArrowPlayback();
  }

  function restoreArrowInput() {
    moveArrowPlayback(0);
  }

  function renderArrowPlayback(message = "") {
    const root = byId("arrow-result");
    const pressCounts = S.ui.createArrowPressCounts(arrowState.solution, arrowCellCount());
    const pressedCells = pressCounts.filter(Boolean).length;
    const detail = arrowState.solveStatus === "solved"
      ? [
        `<strong>${t("totalTaps")}:</strong> ${arrowState.solution.length}`,
        `<strong>${t("pressedCells")}:</strong> ${pressedCells}`,
        t("arrowOrderNote"),
      ].join("<br>")
      : message;
    setStatus("arrow-status", arrowState, detail);
    root.replaceChildren();
    if (message && arrowState.solveStatus !== "solved") {
      const p = document.createElement("p");
      p.textContent = message;
      root.append(p);
      return;
    }
    if (arrowState.solveStatus !== "solved") {
      const p = document.createElement("p");
      p.textContent = t("pending");
      root.append(p);
      return;
    }
    const summary = document.createElement("p");
    summary.innerHTML = [
      `<strong>${t("totalTaps")}:</strong> ${arrowState.solution.length}`,
      `<strong>${t("pressedCells")}:</strong> ${pressedCells}`,
    ].join("<br>");
    const note = document.createElement("p");
    note.className = "arrow-order-note";
    note.textContent = t("arrowOrderNote");
    const details = document.createElement("details");
    details.className = "arrow-step-details";
    const stepsSummary = document.createElement("summary");
    stepsSummary.textContent = t("arrowCheckSteps");
    details.append(stepsSummary, createPlaybackControls(arrowState, moveArrowPlayback, restoreArrowInput));
    root.append(summary, note, details);
  }

  function renderFifteenBoard() {
    const root = byId("fifteen-board");
    let board = root.querySelector(".fifteen-board");
    if (!board || Number(board.dataset.size) !== fifteenSize) {
      board = document.createElement("div");
      board.className = "square-board fifteen-board";
      board.dataset.size = String(fifteenSize);
      setBoardCells(board, fifteenSize);
      board.style.gridTemplateColumns = `repeat(${fifteenSize}, minmax(0, 1fr))`;
      board.addEventListener("paste", handleFifteenPaste);
      for (let index = 0; index < fifteenSize * fifteenSize; index += 1) {
        const input = document.createElement("input");
        input.className = "tile-input";
        input.type = "number";
        input.inputMode = "numeric";
        input.min = "0";
        input.max = String(fifteenSize * fifteenSize - 1);
        input.dataset.index = String(index);
        input.setAttribute("aria-describedby", "fifteen-input-error fifteen-status");
        input.addEventListener("focus", () => input.select());
        input.addEventListener("input", () => updateFifteenInput(index, input.value));
        input.addEventListener("change", () => updateFifteenInputsView());
        input.addEventListener("keydown", (event) => focusNextInput(event, ".fifteen-board"));
        board.append(input);
      }
      root.replaceChildren(board);
    }
    updateFifteenInputsView();
  }

  function solveFifteen() {
    const validation = validateFifteenState();
    if (!validation.valid) {
      renderFifteenPlayback(validationMessage(validation));
      updateFifteenInputsView();
      return;
    }
    byId("fifteen-solve").disabled = true;
    fifteenState.solveStatus = "solving";
    renderFifteenPlayback();
    try {
      const solution = S.fifteen.solveFifteenPuzzle(fifteenState.originalBoard, fifteenSize);
      fifteenState.solution = solution.moves.slice();
      fifteenState.currentStep = 0;
      fifteenState.previewBoard = fifteenState.originalBoard.slice();
      fifteenState.solveStatus = "solved";
      renderFifteenBoard();
      renderFifteenPlayback();
    } catch (error) {
      fifteenState.solveStatus = "error";
      renderFifteenPlayback(formatSolverError(error));
    } finally {
      byId("fifteen-solve").disabled = false;
    }
  }

  function validateFifteenState() {
    const validation = S.input.validateFifteenInput(fifteenState.originalBoard, fifteenSize);
    fifteenState.errorCodes = validation.codes;
    fifteenState.invalidIndices = validation.invalidIndices;
    if (validation.codes.length) fifteenState.solveStatus = "error";
    return validation;
  }

  function updateFifteenInput(index, rawValue) {
    fifteenState.originalBoard[index] = rawValue.trim() === "" ? 0 : Number(rawValue);
    fifteenState.previewBoard = fifteenState.originalBoard.slice();
    clearSolutionState(fifteenState);
    validateFifteenState();
    updateFifteenInputsView();
    renderFifteenPlayback(validationMessage(S.input.validateFifteenInput(fifteenState.originalBoard, fifteenSize)));
  }

  function updateFifteenInputsView() {
    const validation = S.input.validateFifteenInput(fifteenState.originalBoard, fifteenSize);
    fifteenState.errorCodes = validation.codes;
    fifteenState.invalidIndices = validation.invalidIndices;
    const invalid = new Set(validation.invalidIndices);
    const next = fifteenState.solution[fifteenState.currentStep] !== undefined
      ? S.fifteen.getFifteenStep(fifteenState.previewBoard, fifteenSize, fifteenState.solution[fifteenState.currentStep])
      : null;
    const inputs = byId("fifteen-board").querySelectorAll(".tile-input");
    inputs.forEach((input) => {
      const index = Number(input.dataset.index);
      const value = fifteenState.previewBoard[index];
      if (document.activeElement !== input) {
        input.value = S.fifteen.formatFifteenDisplayValue(value);
      }
      input.classList.toggle("blank", value === 0);
      input.classList.toggle("is-invalid", invalid.has(index));
      input.classList.toggle("is-next-action", !!next && next.from === index);
      input.classList.toggle("is-related-action", !!next && next.to === index);
      input.classList.toggle("is-preview-blank", value === 0);
      input.setAttribute("aria-invalid", invalid.has(index) ? "true" : "false");
      input.setAttribute("aria-label", tt(value === 0 ? "fifteenBlankInputLabel" : "fifteenInputLabel", {
        position: cellPositionLabel(index, fifteenSize),
        value,
        max: fifteenSize * fifteenSize - 1,
      }));
    });
    const error = validationMessage(validation);
    byId("fifteen-input-error").textContent = error;
    if (fifteenState.solveStatus !== "solved") {
      fifteenState.solveStatus = error ? "error" : "idle";
    }
    renderFifteenStatus(error);
  }

  function renderFifteenStatus(message = "") {
    const detail = fifteenState.solveStatus === "solved"
      ? `<strong>${t("nextOperation")}:</strong> ${describeFifteenCurrentStep()}`
      : message;
    setStatus("fifteen-status", fifteenState, detail);
  }

  function handleFifteenPaste(event) {
    const textValue = event.clipboardData && event.clipboardData.getData("text");
    if (!textValue) return;
    const values = S.input.parseBoardValues(textValue);
    const countCheck = S.input.validatePastedValues(values, fifteenSize * fifteenSize);
    if (!countCheck.valid) {
      event.preventDefault();
      byId("fifteen-input-error").textContent = t(countCheck.code);
      fifteenState.solveStatus = "error";
      renderFifteenStatus(t(countCheck.code));
      return;
    }
    event.preventDefault();
    fifteenState.originalBoard = values;
    fifteenState.previewBoard = values.slice();
    clearSolutionState(fifteenState);
    validateFifteenState();
    renderFifteenBoard();
    renderFifteenPlayback(validationMessage(S.input.validateFifteenInput(fifteenState.originalBoard, fifteenSize)));
  }

  function focusNextInput(event, boardSelector) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const board = event.currentTarget.closest(boardSelector);
    const inputs = Array.from(board.querySelectorAll(".tile-input"));
    const index = inputs.indexOf(event.currentTarget);
    const next = inputs[(index + 1) % inputs.length];
    next.focus();
    next.select();
  }

  function directionText(move) {
    return { U: t("up"), D: t("down"), L: t("left"), R: t("right") }[move];
  }

  function describeFifteenCurrentStep() {
    if (!fifteenState.solution.length) return t("pending");
    if (fifteenState.currentStep >= fifteenState.solution.length) return t("completed");
    const move = fifteenState.solution[fifteenState.currentStep];
    const step = S.fifteen.getFifteenStep(fifteenState.previewBoard, fifteenSize, move);
    return `${tt("moveTileIntoBlank", { tile: step.tile })} (${tt("blankMove", { direction: directionText(move) })})`;
  }

  function renderFifteenActionCard(message = "") {
    if (message && fifteenState.solveStatus !== "solved") {
      setActionCard("fifteen-action-card", {
        variant: "error",
        title: t("statusError"),
        main: message,
      });
      return;
    }
    if (fifteenState.solveStatus !== "solved") {
      setActionCard("fifteen-action-card", {
        variant: "idle",
        title: t("fifteenSolutionTitle"),
        main: t("pending"),
      });
      return;
    }
    if (fifteenState.currentStep >= fifteenState.solution.length) {
      setActionCard("fifteen-action-card", {
        variant: "complete",
        title: t("fifteenSolutionTitle"),
        main: t("completedShort"),
        meta: tt("stepPosition", { current: fifteenState.solution.length, total: fifteenState.solution.length }),
      });
      return;
    }
    const data = S.ui.fifteenActionData(
      fifteenState.previewBoard,
      fifteenSize,
      fifteenState.solution[fifteenState.currentStep],
    );
    setActionCard("fifteen-action-card", {
      variant: "solved",
      title: t("nextTileShort"),
      main: String(data.tile),
      big: true,
      meta: `${t("blankMoveShort")}: ${directionText(data.blankDirection)} · ${tt("stepPosition", {
        current: fifteenState.currentStep + 1,
        total: fifteenState.solution.length,
      })}`,
    });
  }

  function moveFifteenPlayback(step) {
    movePlayback(fifteenState, step, (board, move) => S.fifteen.applyFifteenStep(board, fifteenSize, move));
    renderFifteenBoard();
    renderFifteenPlayback();
  }

  function restoreFifteenInput() {
    moveFifteenPlayback(0);
  }

  function renderFifteenPlayback(message = "") {
    const root = byId("fifteen-result");
    renderFifteenStatus(message);
    renderFifteenActionCard(message);
    root.replaceChildren();
    if (message && fifteenState.solveStatus !== "solved") {
      const p = document.createElement("p");
      p.textContent = message;
      root.append(p);
      return;
    }
    if (fifteenState.solveStatus !== "solved") {
      const p = document.createElement("p");
      p.textContent = t("pending");
      root.append(p);
      return;
    }
    const summary = document.createElement("p");
    summary.innerHTML = `<strong>${t("blankMoves")}:</strong> ${fifteenState.solution.length} ${t("solvedIn")}`;
    const operation = document.createElement("p");
    operation.className = "operation-copy";
    operation.innerHTML = `<strong>${t("nextOperation")}:</strong> ${describeFifteenCurrentStep()}`;
    root.append(summary, operation, createPlaybackControls(fifteenState, moveFifteenPlayback, restoreFifteenInput));
  }

  function renderMoveResult(id, title, moves) {
    const root = byId(id);
    root.replaceChildren();
    const summary = document.createElement("p");
    summary.innerHTML = `<strong>${title}:</strong> ${moves.length} ${t("solvedIn")}`;
    const list = document.createElement("ol");
    list.className = "step-list";
    moves.slice(0, 160).forEach((move, index) => {
      const item = document.createElement("li");
      item.textContent = `${index + 1}. ${move}`;
      list.append(item);
    });
    if (moves.length > 160) {
      const item = document.createElement("li");
      item.textContent = `... ${moves.length - 160} ${t("moreMoves")}`;
      list.append(item);
    }
    root.append(summary, list);
  }

  function renderTorusBoard() {
    const root = byId("torus-board");
    let board = root.querySelector(".torus-board");
    if (!board || Number(board.dataset.size) !== torusSize) {
      board = document.createElement("div");
      board.className = "square-board torus-board";
      board.dataset.size = String(torusSize);
      setBoardCells(board, torusSize);
      board.style.gridTemplateColumns = `repeat(${torusSize}, minmax(0, 1fr))`;
      board.addEventListener("paste", handleTorusPaste);
      for (let index = 0; index < torusSize * torusSize; index += 1) {
        const input = document.createElement("input");
        input.className = "tile-input";
        input.type = "number";
        input.inputMode = "numeric";
        input.min = "1";
        input.max = String(torusSize * torusSize);
        input.dataset.index = String(index);
        input.setAttribute("aria-describedby", "torus-input-error torus-status");
        input.addEventListener("focus", () => input.select());
        input.addEventListener("input", () => updateTorusInput(index, input.value));
        input.addEventListener("change", () => updateTorusInputsView());
        input.addEventListener("keydown", (event) => focusNextInput(event, ".torus-board"));
        board.append(input);
      }
      root.replaceChildren(board);
    }
    updateTorusInputsView();
  }

  function solveTorus() {
    const validation = validateTorusState();
    if (!validation.valid) {
      renderTorusPlayback(validationMessage(validation));
      updateTorusInputsView();
      return;
    }
    byId("torus-solve").disabled = true;
    torusState.solveStatus = "solving";
    renderTorusPlayback();
    try {
      const solution = S.torus.solveTorusPuzzle(torusState.originalBoard);
      torusState.solution = S.torus.mergeTorusOperations(solution.operations, torusSize);
      torusState.currentStep = 0;
      torusState.previewBoard = copyBoard(torusState.originalBoard);
      torusState.solveStatus = "solved";
      renderTorusBoard();
      renderTorusPlayback();
    } catch (error) {
      torusState.solveStatus = "error";
      renderTorusPlayback(formatSolverError(error));
    } finally {
      byId("torus-solve").disabled = false;
    }
  }

  function formatTorusOp(op) {
    const axis = op.type === "L" || op.type === "R" ? t("row") : t("col");
    const dir = { U: t("up"), D: t("down"), L: t("left"), R: t("right") }[op.type];
    return `${axis} ${op.index + 1} ${dir} x${op.amount}`;
  }

  function describeTorusOperation(op) {
    const info = S.torus.getTorusOperationInfo(op);
    const direction = directionText(op.type);
    if (info.axis === "row") {
      return tt("shiftRow", { index: info.index, direction, amount: info.amount });
    }
    return tt("shiftColumn", { index: info.index, direction, amount: info.amount });
  }

  function validateTorusState() {
    const validation = S.input.validateTorusInput(torusState.originalBoard.flat(), torusSize);
    torusState.errorCodes = validation.codes;
    torusState.invalidIndices = validation.invalidIndices;
    if (validation.codes.length) torusState.solveStatus = "error";
    return validation;
  }

  function updateTorusInput(index, rawValue) {
    const value = Number(rawValue);
    const row = Math.floor(index / torusSize);
    const col = index % torusSize;
    torusState.originalBoard[row][col] = value;
    torusState.previewBoard = copyBoard(torusState.originalBoard);
    clearSolutionState(torusState);
    validateTorusState();
    updateTorusInputsView();
    renderTorusPlayback(validationMessage(S.input.validateTorusInput(torusState.originalBoard.flat(), torusSize)));
  }

  function updateTorusInputsView() {
    const validation = S.input.validateTorusInput(torusState.originalBoard.flat(), torusSize);
    torusState.errorCodes = validation.codes;
    torusState.invalidIndices = validation.invalidIndices;
    const invalid = new Set(validation.invalidIndices);
    const next = torusState.solution[torusState.currentStep];
    const inputs = byId("torus-board").querySelectorAll(".tile-input");
    inputs.forEach((input) => {
      const index = Number(input.dataset.index);
      const row = Math.floor(index / torusSize);
      const col = index % torusSize;
      const value = torusState.previewBoard[row][col];
      if (document.activeElement !== input) {
        input.value = String(value);
      }
      const isTarget = !!next && ((next.type === "L" || next.type === "R") ? row === next.index : col === next.index);
      input.classList.toggle("is-invalid", invalid.has(index));
      input.classList.toggle("is-next-action", isTarget);
      input.setAttribute("aria-invalid", invalid.has(index) ? "true" : "false");
      input.setAttribute("aria-label", tt("torusInputLabel", {
        position: cellPositionLabel(index, torusSize),
        value,
        max: torusSize * torusSize,
      }));
    });
    const error = validationMessage(validation);
    byId("torus-input-error").textContent = error;
    if (torusState.solveStatus !== "solved") {
      torusState.solveStatus = error ? "error" : "idle";
    }
    renderTorusStatus(error);
  }

  function renderTorusStatus(message = "") {
    const detail = torusState.solveStatus === "solved"
      ? `<strong>${t("nextOperation")}:</strong> ${describeTorusCurrentStep()}`
      : message;
    setStatus("torus-status", torusState, detail);
  }

  function handleTorusPaste(event) {
    const textValue = event.clipboardData && event.clipboardData.getData("text");
    if (!textValue) return;
    const values = S.input.parseBoardValues(textValue);
    const countCheck = S.input.validatePastedValues(values, torusSize * torusSize);
    if (!countCheck.valid) {
      event.preventDefault();
      byId("torus-input-error").textContent = t(countCheck.code);
      torusState.solveStatus = "error";
      renderTorusStatus(t(countCheck.code));
      return;
    }
    event.preventDefault();
    torusState.originalBoard = Array.from({ length: torusSize }, (_, row) => values.slice(row * torusSize, (row + 1) * torusSize));
    torusState.previewBoard = copyBoard(torusState.originalBoard);
    clearSolutionState(torusState);
    validateTorusState();
    renderTorusBoard();
    renderTorusPlayback(validationMessage(S.input.validateTorusInput(torusState.originalBoard.flat(), torusSize)));
  }

  function describeTorusCurrentStep() {
    if (!torusState.solution.length) return t("pending");
    if (torusState.currentStep >= torusState.solution.length) return t("completed");
    return describeTorusOperation(torusState.solution[torusState.currentStep]);
  }

  function formatTorusActionMain(data) {
    const key = data.axis === "row" ? "torusRowAction" : "torusColumnAction";
    return tt(key, {
      index: data.index,
      direction: directionText(data.direction),
      symbol: data.symbol,
      amount: data.amount,
    });
  }

  function renderTorusActionCard(message = "") {
    if (message && torusState.solveStatus !== "solved") {
      setActionCard("torus-action-card", {
        variant: "error",
        title: t("statusError"),
        main: message,
      });
      return;
    }
    if (torusState.solveStatus !== "solved") {
      setActionCard("torus-action-card", {
        variant: "idle",
        title: t("torusSolutionTitle"),
        main: t("pending"),
      });
      return;
    }
    if (torusState.currentStep >= torusState.solution.length) {
      setActionCard("torus-action-card", {
        variant: "complete",
        title: t("torusSolutionTitle"),
        main: t("completedShort"),
        meta: tt("stepPosition", { current: torusState.solution.length, total: torusState.solution.length }),
      });
      return;
    }
    const data = S.ui.torusActionData(torusState.solution[torusState.currentStep]);
    setActionCard("torus-action-card", {
      variant: "solved",
      title: t("nextOperation"),
      main: formatTorusActionMain(data),
      symbol: `${data.symbol} ${data.amount}`,
      meta: tt("stepPosition", { current: torusState.currentStep + 1, total: torusState.solution.length }),
    });
  }

  function moveTorusPlayback(step) {
    movePlayback(torusState, step, (board, op) => S.torus.applyTorusOperation(board, op));
    renderTorusBoard();
    renderTorusPlayback();
  }

  function restoreTorusInput() {
    moveTorusPlayback(0);
  }

  function renderTorusPlayback(message = "") {
    const root = byId("torus-result");
    renderTorusStatus(message);
    renderTorusActionCard(message);
    root.replaceChildren();
    if (message && torusState.solveStatus !== "solved") {
      const p = document.createElement("p");
      p.textContent = message;
      root.append(p);
      return;
    }
    if (torusState.solveStatus !== "solved") {
      const p = document.createElement("p");
      p.textContent = t("pending");
      root.append(p);
      return;
    }
    const summary = document.createElement("p");
    summary.innerHTML = `<strong>${t("torusOps")}:</strong> ${torusState.solution.length} ${t("solvedIn")}`;
    const operation = document.createElement("p");
    operation.className = "operation-copy";
    operation.innerHTML = `<strong>${t("nextOperation")}:</strong> ${describeTorusCurrentStep()}`;
    root.append(summary, operation, createPlaybackControls(torusState, moveTorusPlayback, restoreTorusInput));
  }

  function renderAllBoards() {
    syncArrowInputs();
    renderArrowBoard();
    renderArrowPlayback();
    renderFifteenBoard();
    renderFifteenPlayback();
    renderTorusBoard();
    renderTorusPlayback();
  }

  function init() {
    fillDifficulty(byId("arrow-difficulty"), "arrow");
    fillDifficulty(byId("fifteen-difficulty"), "fifteen");
    fillDifficulty(byId("torus-difficulty"), "torus");
    fillArrowDisplayMode();
    byId("arrow-difficulty").addEventListener("change", (event) => {
      arrowState = { difficulty: event.target.value, ...createPlaybackState(S.arrow.createArrowGoal(event.target.value)) };
      ensureArrowValues(true);
      renderAllBoards();
    });
    byId("arrow-display-mode").addEventListener("change", (event) => {
      arrowDisplayMode = S.ui.normalizeArrowDisplayMode(event.target.value);
      localStorage.setItem(ARROW_DISPLAY_STORAGE_KEY, arrowDisplayMode);
      fillArrowDisplayMode();
      renderArrowBoard();
    });
    byId("fifteen-difficulty").addEventListener("change", (event) => {
      fifteenDifficulty = event.target.value;
      fifteenSize = GAME_SPECS.fifteen[fifteenDifficulty].size;
      fifteenState = createPlaybackState(goalFifteen(fifteenSize));
      renderFifteenBoard();
      renderFifteenPlayback();
    });
    byId("torus-difficulty").addEventListener("change", (event) => {
      torusDifficulty = event.target.value;
      torusSize = GAME_SPECS.torus[torusDifficulty].size;
      torusState = createPlaybackState(goalTorus(torusSize));
      renderTorusBoard();
      renderTorusPlayback();
    });
    byId("arrow-solve").addEventListener("click", solveArrow);
    byId("arrow-random").addEventListener("click", shuffleArrow);
    byId("arrow-reset").addEventListener("click", () => {
      ensureArrowValues(true);
      renderArrowBoard();
      renderArrowPlayback();
    });
    byId("fifteen-solve").addEventListener("click", solveFifteen);
    byId("fifteen-random").addEventListener("click", () => {
      fifteenState = createPlaybackState(S.fifteen.scrambleFifteen(fifteenSize, 80 + fifteenSize * 24));
      renderFifteenBoard();
      renderFifteenPlayback();
    });
    byId("fifteen-reset").addEventListener("click", () => {
      fifteenState = createPlaybackState(goalFifteen(fifteenSize));
      renderFifteenBoard();
      renderFifteenPlayback();
    });
    byId("torus-solve").addEventListener("click", solveTorus);
    byId("torus-random").addEventListener("click", () => {
      torusState = createPlaybackState(S.torus.scrambleTorus(torusSize, 20 + torusSize * 4));
      renderTorusBoard();
      renderTorusPlayback();
    });
    byId("torus-reset").addEventListener("click", () => {
      torusState = createPlaybackState(goalTorus(torusSize));
      renderTorusBoard();
      renderTorusPlayback();
    });
    for (const button of document.querySelectorAll("[data-game]")) {
      button.addEventListener("click", () => {
        selectGame(button.dataset.game);
      });
      button.addEventListener("keydown", handleTabKeydown);
    }
    for (const button of document.querySelectorAll("[data-lang]")) {
      button.addEventListener("click", () => {
        lang = button.dataset.lang;
        localStorage.setItem("minigameGuideLang", lang);
        applyLanguage();
      });
    }
    applyLanguage();
    renderTabs();
  }

  init();
})();
