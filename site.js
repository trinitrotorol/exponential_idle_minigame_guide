(function (global) {
  "use strict";

  const MAX_SOLUTIONS = 1000000;

  function modValue(value, modulus) {
    const result = value % modulus;
    return result < 0 ? result + modulus : result;
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
    throw new Error("No modular inverse exists.");
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
        throw new Error("Too many candidate solutions for the browser solver.");
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
      throw new Error("Too many candidate solutions for the browser solver.");
    }
    for (const mod2Solution of solutions2) {
      for (const mod3Solution of solutions3) {
        const operations = mod2Solution.map((mod2Value, i) => {
          for (let value = 0; value < 6; value += 1) {
            if (value % 2 === mod2Value && value % 3 === mod3Solution[i]) {
              return value;
            }
          }
          throw new Error("Chinese remainder merge failed.");
        });
        considerOperations(best, operations);
      }
    }
    return best;
  }

  function buildArrowPuzzle(shape, height, width, side) {
    if (shape === "square") {
      if (height < 1 || height > 4 || width < 1 || width > 4 || height * width > 16) {
        throw new Error("Square board must be between 1x1 and 4x4.");
      }
      return {
        rowLengths: buildSquareRowLengths(height, width),
        affectedBy: buildSquareAffectedBy(height, width),
      };
    }
    if (side < 1 || side > 4) {
      throw new Error("Hex side must be between 1 and 4.");
    }
    return {
      rowLengths: buildHexRowLengths(side),
      affectedBy: buildHexAffectedBy(side),
    };
  }

  function solveArrowPuzzle(options) {
    const directions = Number(options.directions);
    const puzzle = buildArrowPuzzle(options.shape, options.height, options.width, options.side);
    const initial = options.initial.map(Number);
    const targets = options.target === "auto" ? Array.from({ length: directions }, (_, i) => i) : [Number(options.target)];
    let bestAnswer = { found: false, target: -1, totalOperations: 0, operations: [] };
    for (const target of targets) {
      const rhs = initial.map((value) => modValue(target - value, directions));
      let best;
      if (directions === 2 || directions === 3 || directions === 5) {
        best = solvePrimeModulus(puzzle.affectedBy, rhs, directions);
      } else if (directions === 4) {
        best = solveMod4(puzzle.affectedBy, rhs);
      } else if (directions === 6) {
        best = solveMod6(puzzle.affectedBy, rhs);
      } else {
        throw new Error("Directions must be between 2 and 6.");
      }
      if (best.found && (!bestAnswer.found || best.cost < bestAnswer.totalOperations)) {
        bestAnswer = { found: true, target, totalOperations: best.cost, operations: best.operations };
      }
    }
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
      throw new Error("Invalid slide move.");
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
    throw new Error("Could not place the requested tile group.");
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
    throw new Error("The remaining 3x3 search exceeded its limit.");
  }

  function solveFifteenPuzzle(inputBoard, size) {
    const expected = Array.from({ length: size * size }, (_, i) => i);
    if (!validatePermutation(inputBoard, expected)) {
      throw new Error("Use each number exactly once, with 0 as the blank.");
    }
    if (!isFifteenSolvable(inputBoard, size)) {
      throw new Error("This 15-Puzzle position is not solvable.");
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

  function scrambleFifteen(size, steps) {
    const board = Array.from({ length: size * size }, (_, i) => i + 1);
    board[size * size - 1] = 0;
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
      const move = moves[Math.floor(Math.random() * moves.length)];
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

  function solveTorusPuzzle(inputMatrix) {
    const matrix = cloneMatrix(inputMatrix);
    const size = matrix.length;
    const expected = Array.from({ length: size * size }, (_, i) => i + 1);
    if (!validatePermutation(matrix.flat(), expected)) {
      throw new Error("Use each number from 1 to n^2 exactly once.");
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
      throw new Error("This Torus position is outside the supported reachable set.");
    }
    return { operations: ops, finalMatrix: check };
  }

  function scrambleTorus(size, steps) {
    const matrix = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_v, col) => row * size + col + 1));
    const types = ["U", "D", "L", "R"];
    for (let i = 0; i < steps; i += 1) {
      applyTorusMove(matrix, {
        type: types[Math.floor(Math.random() * types.length)],
        index: Math.floor(Math.random() * size),
        amount: 1 + Math.floor(Math.random() * (size - 1)),
      });
    }
    return matrix;
  }

  const solvers = {
    arrow: { buildHexRowLengths, buildSquareRowLengths, buildSquareAffectedBy, buildHexAffectedBy, solveArrowPuzzle },
    fifteen: { solveFifteenPuzzle, scrambleFifteen, applyFifteenMove, isFifteenSolvable },
    torus: { solveTorusPuzzle, scrambleTorus, applyTorusMove },
    util: { modValue, cloneMatrix },
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
      appTitle: "ミニゲーム攻略",
      appLead: "ゲーム画面に近い見た目で、盤面を入力して解法を確認できます。",
      arrowTitle: "矢印パズル",
      arrowHelp: "タイルをタップしてすべての矢印を上向きにします。",
      fifteenTitle: "15パズル",
      fifteenHelp: "四角をスライドして数字を順番通りに並べます。空白は0で入力します。",
      torusTitle: "トーラスパズル",
      torusHelp: "行または列を巡回シフトして、左上から昇順に並べます。",
      timeLabel: "時間",
      bestLabel: "最高記録",
      difficultyLabel: "難易度",
      shapeLabel: "盤面",
      heightLabel: "高さ",
      widthLabel: "幅",
      directionsLabel: "方向数",
      targetLabel: "目標",
      solveButton: "解く",
      shuffleButton: "シャッフル",
      resetButton: "リセット",
      solutionTitle: "解法",
      sourceNote: "参考: Exponential Idle GuidesのMinigamesページと公開ソルバー実装。",
      fifteenNote: "Hardは5x5です。最適解ではなく、層を固定して解く実用手順を出します。",
      torusNote: "Easyは3x3、Mediumは5x5、Hardは6x6です。",
      autoTarget: "最短",
      pending: "未計算",
      noSolution: "解が見つかりませんでした。",
      solvedIn: "手数",
      target: "目標",
      taps: "タップ回数",
      blankMoves: "空白の動き",
      torusOps: "操作",
      row: "行",
      col: "列",
      up: "上",
      down: "下",
      left: "左",
      right: "右",
    },
    en: {
      appTitle: "Minigame Guide",
      appLead: "Enter a board and inspect the solving steps in a game-like screen.",
      arrowTitle: "Arrow Puzzle",
      arrowHelp: "Tap tiles until every arrow points upward.",
      fifteenTitle: "15-Puzzle",
      fifteenHelp: "Slide numbered tiles into order. Enter 0 for the blank.",
      torusTitle: "Torus Puzzle",
      torusHelp: "Rotate rows or columns cyclically until numbers are sorted.",
      timeLabel: "Time",
      bestLabel: "Best Time",
      difficultyLabel: "Difficulty",
      shapeLabel: "Board",
      heightLabel: "Height",
      widthLabel: "Width",
      directionsLabel: "Directions",
      targetLabel: "Target",
      solveButton: "Solve",
      shuffleButton: "Shuffle",
      resetButton: "Reset",
      solutionTitle: "Solution",
      sourceNote: "References: Exponential Idle Guides Minigames page and public solver implementations.",
      fifteenNote: "Hard is 5x5. The solver returns a practical layer-by-layer route, not an optimal route.",
      torusNote: "Easy is 3x3, Medium is 5x5, and Hard is 6x6.",
      autoTarget: "Shortest",
      pending: "Not calculated",
      noSolution: "No solution was found.",
      solvedIn: "moves",
      target: "target",
      taps: "tap counts",
      blankMoves: "blank moves",
      torusOps: "operations",
      row: "row",
      col: "col",
      up: "up",
      down: "down",
      left: "left",
      right: "right",
    },
  };

  const DIFFICULTIES = {
    arrow: {
      easy: { shape: "square", height: 2, width: 2, side: 2, directions: 2 },
      medium: { shape: "square", height: 3, width: 3, side: 2, directions: 4 },
      hard: { shape: "hex", height: 4, width: 4, side: 4, directions: 2 },
      expert: { shape: "hex", height: 4, width: 4, side: 4, directions: 6 },
    },
    fifteen: { easy: 3, medium: 4, hard: 5 },
    torus: { easy: 3, medium: 5, hard: 6 },
  };

  const arrowLabels = {
    2: ["↑", "↓"],
    3: ["↑", "↘", "↙"],
    4: ["↑", "→", "↓", "←"],
    5: ["↑", "↗", "↘", "↙", "↖"],
    6: ["↑", "↗", "→", "↘", "↙", "←"],
  };

  let lang = localStorage.getItem("minigameGuideLang") || "ja";
  let activeGame = "arrow";
  let arrowState = { ...DIFFICULTIES.arrow.easy, target: "auto", values: [0, 0, 0, 0] };
  let fifteenSize = DIFFICULTIES.fifteen.easy;
  let fifteenBoard = goalFifteen(fifteenSize);
  let torusSize = DIFFICULTIES.torus.easy;
  let torusBoard = goalTorus(torusSize);

  function t(key) {
    return text[lang][key] || text.en[key] || key;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setResult(id, message) {
    byId(id).innerHTML = `<p>${message}</p>`;
  }

  function goalFifteen(size) {
    const board = Array.from({ length: size * size }, (_, i) => i + 1);
    board[size * size - 1] = 0;
    return board;
  }

  function goalTorus(size) {
    return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_v, col) => row * size + col + 1));
  }

  function fillDifficulty(select, includeExpert) {
    const current = select.value || "easy";
    const keys = includeExpert ? ["easy", "medium", "hard", "expert"] : ["easy", "medium", "hard"];
    select.replaceChildren(...keys.map((key) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = key[0].toUpperCase() + key.slice(1);
      return option;
    }));
    select.value = keys.includes(current) ? current : "easy";
  }

  function applyLanguage() {
    document.documentElement.lang = lang;
    for (const node of document.querySelectorAll("[data-i18n]")) {
      node.textContent = t(node.dataset.i18n);
    }
    for (const button of document.querySelectorAll("[data-lang]")) {
      button.classList.toggle("is-active", button.dataset.lang === lang);
    }
    renderArrowControls();
    renderAllBoards();
    setResult("arrow-result", t("pending"));
    setResult("fifteen-result", t("pending"));
    setResult("torus-result", t("pending"));
  }

  function renderTabs() {
    for (const button of document.querySelectorAll("[data-game]")) {
      button.classList.toggle("is-active", button.dataset.game === activeGame);
    }
    for (const panel of document.querySelectorAll("[data-panel]")) {
      panel.classList.toggle("is-active", panel.dataset.panel === activeGame);
    }
  }

  function arrowCellCount() {
    return arrowRowLengths().reduce((sum, value) => sum + value, 0);
  }

  function arrowRowLengths() {
    return arrowState.shape === "square"
      ? S.arrow.buildSquareRowLengths(arrowState.height, arrowState.width)
      : S.arrow.buildHexRowLengths(arrowState.side);
  }

  function ensureArrowValues(reset) {
    const count = arrowCellCount();
    arrowState.values = Array.from({ length: count }, (_, i) => reset ? 0 : S.util.modValue(arrowState.values[i] || 0, arrowState.directions));
  }

  function arrowLabel(value) {
    return (arrowLabels[arrowState.directions] || [])[value] || String(value + 1);
  }

  function renderArrowControls() {
    const target = byId("arrow-target");
    target.replaceChildren();
    const auto = document.createElement("option");
    auto.value = "auto";
    auto.textContent = t("autoTarget");
    target.append(auto);
    for (let i = 0; i < arrowState.directions; i += 1) {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = `${arrowLabel(i)} (${i + 1})`;
      target.append(option);
    }
    target.value = arrowState.target;
  }

  function syncArrowInputs() {
    byId("arrow-shape").value = arrowState.shape;
    byId("arrow-height").value = arrowState.height;
    byId("arrow-width").value = arrowState.width;
    byId("arrow-side").value = arrowState.side;
    byId("arrow-directions").value = arrowState.directions;
    for (const el of document.querySelectorAll(".arrow-square")) el.hidden = arrowState.shape !== "square";
    for (const el of document.querySelectorAll(".arrow-hex")) el.hidden = arrowState.shape === "square";
    renderArrowControls();
  }

  function readArrowInputs() {
    arrowState.shape = byId("arrow-shape").value;
    arrowState.height = Math.max(1, Math.min(4, Number(byId("arrow-height").value) || 2));
    arrowState.width = Math.max(1, Math.min(4, Number(byId("arrow-width").value) || 2));
    arrowState.side = Math.max(1, Math.min(4, Number(byId("arrow-side").value) || 2));
    arrowState.directions = Math.max(2, Math.min(6, Number(byId("arrow-directions").value) || 2));
    arrowState.target = byId("arrow-target").value;
    ensureArrowValues(false);
    syncArrowInputs();
  }

  function renderArrowBoard() {
    const root = byId("arrow-board");
    const rows = arrowRowLengths();
    root.replaceChildren();
    if (arrowState.shape === "square") {
      const board = document.createElement("div");
      board.className = "square-board";
      board.style.gridTemplateColumns = `repeat(${arrowState.width}, minmax(0, 1fr))`;
      arrowState.values.forEach((value, index) => board.append(arrowButton(value, index)));
      root.append(board);
      return;
    }
    const board = document.createElement("div");
    board.className = "hex-board";
    let index = 0;
    for (const rowLength of rows) {
      const row = document.createElement("div");
      row.className = "hex-row";
      for (let col = 0; col < rowLength; col += 1) {
        row.append(arrowButton(arrowState.values[index], index));
        index += 1;
      }
      board.append(row);
    }
    root.append(board);
  }

  function arrowButton(value, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `arrow-tile${value ? " is-lit" : ""}`;
    button.textContent = arrowLabel(value);
    button.addEventListener("click", () => {
      arrowState.values[index] = S.util.modValue(arrowState.values[index] + 1, arrowState.directions);
      renderArrowBoard();
      setResult("arrow-result", t("pending"));
    });
    return button;
  }

  function renderOperationBoard(rows, operations) {
    const board = document.createElement("div");
    board.className = arrowState.shape === "square" ? "square-board mini-board" : "hex-board mini-board";
    if (arrowState.shape === "square") {
      board.style.gridTemplateColumns = `repeat(${arrowState.width}, minmax(0, 1fr))`;
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
    try {
      const solution = S.arrow.solveArrowPuzzle({ ...arrowState, initial: arrowState.values });
      if (!solution.answer.found) {
        setResult("arrow-result", t("noSolution"));
        return;
      }
      result.replaceChildren();
      const summary = document.createElement("p");
      summary.innerHTML = `<strong>${t("target")}:</strong> ${arrowLabel(solution.answer.target)}<br><strong>${t("solvedIn")}:</strong> ${solution.answer.totalOperations}`;
      result.append(summary, renderOperationBoard(solution.rowLengths, solution.answer.operations));
    } catch (error) {
      setResult("arrow-result", error.message);
    }
  }

  function shuffleArrow() {
    readArrowInputs();
    const puzzle = arrowState.shape === "square"
      ? S.arrow.buildSquareAffectedBy(arrowState.height, arrowState.width)
      : S.arrow.buildHexAffectedBy(arrowState.side);
    const target = Math.floor(Math.random() * arrowState.directions);
    const operations = arrowState.values.map(() => Math.floor(Math.random() * arrowState.directions));
    arrowState.values = arrowState.values.map(() => target);
    for (let op = 0; op < operations.length; op += 1) {
      for (let cell = 0; cell < puzzle.length; cell += 1) {
        if (puzzle[cell].includes(op)) {
          arrowState.values[cell] = S.util.modValue(arrowState.values[cell] - operations[op], arrowState.directions);
        }
      }
    }
    renderArrowBoard();
    setResult("arrow-result", t("pending"));
  }

  function renderFifteenBoard() {
    const root = byId("fifteen-board");
    root.replaceChildren();
    const board = document.createElement("div");
    board.className = "square-board fifteen-board";
    board.style.gridTemplateColumns = `repeat(${fifteenSize}, minmax(0, 1fr))`;
    fifteenBoard.forEach((value, index) => {
      const input = document.createElement("input");
      input.className = `tile-input${value === 0 ? " blank" : ""}`;
      input.type = "number";
      input.min = "0";
      input.max = String(fifteenSize * fifteenSize - 1);
      input.value = String(value);
      input.addEventListener("change", () => {
        fifteenBoard[index] = Number(input.value);
        renderFifteenBoard();
        setResult("fifteen-result", t("pending"));
      });
      board.append(input);
    });
    root.append(board);
  }

  function solveFifteen() {
    try {
      const solution = S.fifteen.solveFifteenPuzzle(fifteenBoard, fifteenSize);
      fifteenBoard = solution.finalBoard.slice();
      renderFifteenBoard();
      renderMoveResult("fifteen-result", t("blankMoves"), solution.moves);
    } catch (error) {
      setResult("fifteen-result", error.message);
    }
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
      item.textContent = `... ${moves.length - 160} more`;
      list.append(item);
    }
    root.append(summary, list);
  }

  function renderTorusBoard() {
    const root = byId("torus-board");
    root.replaceChildren();
    const board = document.createElement("div");
    board.className = "square-board torus-board";
    board.style.gridTemplateColumns = `repeat(${torusSize}, minmax(0, 1fr))`;
    torusBoard.flat().forEach((value, index) => {
      const input = document.createElement("input");
      input.className = "tile-input";
      input.type = "number";
      input.min = "1";
      input.max = String(torusSize * torusSize);
      input.value = String(value);
      input.addEventListener("change", () => {
        const row = Math.floor(index / torusSize);
        const col = index % torusSize;
        torusBoard[row][col] = Number(input.value);
        renderTorusBoard();
        setResult("torus-result", t("pending"));
      });
      board.append(input);
    });
    root.append(board);
  }

  function solveTorus() {
    try {
      const solution = S.torus.solveTorusPuzzle(torusBoard);
      torusBoard = solution.finalMatrix.map((row) => row.slice());
      renderTorusBoard();
      const moves = solution.operations.map(formatTorusOp);
      renderMoveResult("torus-result", t("torusOps"), moves);
    } catch (error) {
      setResult("torus-result", error.message);
    }
  }

  function formatTorusOp(op) {
    const axis = op.type === "L" || op.type === "R" ? t("row") : t("col");
    const dir = { U: t("up"), D: t("down"), L: t("left"), R: t("right") }[op.type];
    return `${axis} ${op.index + 1} ${dir} x${op.amount}`;
  }

  function renderAllBoards() {
    syncArrowInputs();
    renderArrowBoard();
    renderFifteenBoard();
    renderTorusBoard();
  }

  function init() {
    fillDifficulty(byId("arrow-difficulty"), true);
    fillDifficulty(byId("fifteen-difficulty"), false);
    fillDifficulty(byId("torus-difficulty"), false);
    byId("arrow-difficulty").addEventListener("change", (event) => {
      arrowState = { ...arrowState, ...DIFFICULTIES.arrow[event.target.value], target: "auto" };
      ensureArrowValues(true);
      renderAllBoards();
      setResult("arrow-result", t("pending"));
    });
    byId("fifteen-difficulty").addEventListener("change", (event) => {
      fifteenSize = DIFFICULTIES.fifteen[event.target.value];
      fifteenBoard = goalFifteen(fifteenSize);
      renderFifteenBoard();
      setResult("fifteen-result", t("pending"));
    });
    byId("torus-difficulty").addEventListener("change", (event) => {
      torusSize = DIFFICULTIES.torus[event.target.value];
      torusBoard = goalTorus(torusSize);
      renderTorusBoard();
      setResult("torus-result", t("pending"));
    });
    for (const id of ["arrow-shape", "arrow-height", "arrow-width", "arrow-side", "arrow-directions", "arrow-target"]) {
      byId(id).addEventListener("change", () => {
        readArrowInputs();
        renderArrowBoard();
        setResult("arrow-result", t("pending"));
      });
    }
    byId("arrow-solve").addEventListener("click", solveArrow);
    byId("arrow-random").addEventListener("click", shuffleArrow);
    byId("arrow-reset").addEventListener("click", () => {
      ensureArrowValues(true);
      renderArrowBoard();
      setResult("arrow-result", t("pending"));
    });
    byId("fifteen-solve").addEventListener("click", solveFifteen);
    byId("fifteen-random").addEventListener("click", () => {
      fifteenBoard = S.fifteen.scrambleFifteen(fifteenSize, 80 + fifteenSize * 24);
      renderFifteenBoard();
      setResult("fifteen-result", t("pending"));
    });
    byId("fifteen-reset").addEventListener("click", () => {
      fifteenBoard = goalFifteen(fifteenSize);
      renderFifteenBoard();
      setResult("fifteen-result", t("pending"));
    });
    byId("torus-solve").addEventListener("click", solveTorus);
    byId("torus-random").addEventListener("click", () => {
      torusBoard = S.torus.scrambleTorus(torusSize, 20 + torusSize * 4);
      renderTorusBoard();
      setResult("torus-result", t("pending"));
    });
    byId("torus-reset").addEventListener("click", () => {
      torusBoard = goalTorus(torusSize);
      renderTorusBoard();
      setResult("torus-result", t("pending"));
    });
    for (const button of document.querySelectorAll("[data-game]")) {
      button.addEventListener("click", () => {
        activeGame = button.dataset.game;
        renderTabs();
      });
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
