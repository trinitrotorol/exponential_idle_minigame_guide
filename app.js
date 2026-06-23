(function (global) {
  "use strict";

  const MAX_SOLUTIONS = 1000000;

  function modValue(value, modulus) {
    const result = value % modulus;
    return result < 0 ? result + modulus : result;
  }

  function buildHexRowLengths(side) {
    const rows = [];
    for (let row = 0; row < 2 * side - 1; row += 1) {
      const distanceFromCenter = Math.abs(row - (side - 1));
      rows.push(2 * side - 1 - distanceFromCenter);
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
        const id = coordinates.length;
        coordinates.push([q, r]);
        idByCoordinate.set(`${q},${r}`, id);
      }
    }

    const directions = [
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
    ];

    return coordinates.map(([q, r], cell) => {
      const affected = [cell];

      for (const [dq, dr] of directions) {
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
    throw new Error("逆元が存在しません。");
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
        throw new Error("候補解が多すぎるため、この盤面はブラウザ版の上限を超えました。");
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

  function reduceRhs(rhs, prime) {
    return rhs.map((value) => modValue(value, prime));
  }

  function affectedSum(affected, values) {
    return affected.reduce((sum, index) => sum + values[index], 0);
  }

  function operationCost(operations) {
    return operations.reduce((sum, value) => sum + value, 0);
  }

  function considerOperations(best, operations) {
    const cost = operationCost(operations);
    if (!best.found || cost < best.cost) {
      best.found = true;
      best.cost = cost;
      best.operations = operations.slice();
    }
  }

  function solvePrimeModulus(affectedBy, rhs, prime) {
    const best = { found: false, cost: Number.MAX_SAFE_INTEGER, operations: [] };
    const solutions = solvePrimeSystem(affectedBy, reduceRhs(rhs, prime), prime);

    for (const operations of enumeratePrimeSolutions(solutions, prime)) {
      considerOperations(best, operations);
    }

    return best;
  }

  function solveMod4(affectedBy, rhs) {
    const best = { found: false, cost: Number.MAX_SAFE_INTEGER, operations: [] };
    const n = affectedBy.length;
    const pSolutions = solvePrimeSystem(affectedBy, reduceRhs(rhs, 2), 2);
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
        const qSolutions = solvePrimeSystem(affectedBy, qRhs, 2);
        qCache.set(key, enumeratePrimeSolutions(qSolutions, 2));
      }

      for (const q of qCache.get(key)) {
        const operations = Array.from({ length: n }, (_, i) => p[i] + 2 * q[i]);
        considerOperations(best, operations);
      }
    }

    return best;
  }

  function combineMod2AndMod3(mod2Value, mod3Value) {
    for (let value = 0; value < 6; value += 1) {
      if (value % 2 === mod2Value && value % 3 === mod3Value) {
        return value;
      }
    }
    throw new Error("mod 2 と mod 3 の結合に失敗しました。");
  }

  function solveMod6(affectedBy, rhs) {
    const best = { found: false, cost: Number.MAX_SAFE_INTEGER, operations: [] };
    const solutions2 = enumeratePrimeSolutions(solvePrimeSystem(affectedBy, reduceRhs(rhs, 2), 2), 2);
    const solutions3 = enumeratePrimeSolutions(solvePrimeSystem(affectedBy, reduceRhs(rhs, 3), 3), 3);
    const n = affectedBy.length;

    if (solutions2.length * solutions3.length > MAX_SOLUTIONS) {
      throw new Error("候補解が多すぎるため、この盤面はブラウザ版の上限を超えました。");
    }

    for (const mod2Solution of solutions2) {
      for (const mod3Solution of solutions3) {
        const operations = Array.from({ length: n }, (_, i) =>
          combineMod2AndMod3(mod2Solution[i], mod3Solution[i])
        );
        considerOperations(best, operations);
      }
    }

    return best;
  }

  function solveModulus(affectedBy, rhs, directions) {
    if (directions === 2 || directions === 3 || directions === 5) {
      return solvePrimeModulus(affectedBy, rhs, directions);
    }
    if (directions === 4) {
      return solveMod4(affectedBy, rhs);
    }
    if (directions === 6) {
      return solveMod6(affectedBy, rhs);
    }
    throw new Error("方向数は2から6にしてください。");
  }

  function buildRhs(initial, target, directions) {
    return initial.map((value) => modValue(target - value, directions));
  }

  function buildPuzzle(shape, height, width, side) {
    if (shape === "square") {
      if (height < 1 || height > 4 || width < 1 || width > 4 || height * width > 16) {
        throw new Error("Square は 1x1 から 4x4 までです。");
      }
      return {
        rowLengths: buildSquareRowLengths(height, width),
        affectedBy: buildSquareAffectedBy(height, width),
      };
    }

    if (side < 1 || side > 4) {
      throw new Error("Hex の side は 1 から 4 までです。");
    }

    return {
      rowLengths: buildHexRowLengths(side),
      affectedBy: buildHexAffectedBy(side),
    };
  }

  function solveArrowPuzzle(options) {
    const directions = Number(options.directions);
    if (!Number.isInteger(directions) || directions < 2 || directions > 6) {
      throw new Error("方向数は2から6にしてください。");
    }

    const puzzle = buildPuzzle(options.shape, options.height, options.width, options.side);
    const n = puzzle.affectedBy.length;
    const initial = options.initial.map((value) => Number(value));

    if (initial.length !== n) {
      throw new Error("入力された盤面サイズが設定と一致しません。");
    }

    if (initial.some((value) => !Number.isInteger(value) || value < 0 || value >= directions)) {
      throw new Error("盤面の方向が範囲外です。");
    }

    const targets =
      options.target === "auto"
        ? Array.from({ length: directions }, (_, index) => index)
        : [Number(options.target)];

    let bestAnswer = { found: false, target: -1, totalOperations: 0, operations: [] };

    for (const target of targets) {
      if (!Number.isInteger(target) || target < 0 || target >= directions) {
        throw new Error("目標方向が範囲外です。");
      }

      const rhs = buildRhs(initial, target, directions);
      const best = solveModulus(puzzle.affectedBy, rhs, directions);

      if (best.found && (!bestAnswer.found || best.cost < bestAnswer.totalOperations)) {
        bestAnswer = {
          found: true,
          target,
          totalOperations: best.cost,
          operations: best.operations,
        };
      }
    }

    return {
      ...puzzle,
      answer: bestAnswer,
    };
  }

  const ArrowSolver = {
    buildHexRowLengths,
    buildSquareRowLengths,
    buildSquareAffectedBy,
    buildHexAffectedBy,
    solveArrowPuzzle,
    modValue,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ArrowSolver;
  }

  global.ArrowSolver = ArrowSolver;
})(typeof window !== "undefined" ? window : globalThis);

(function () {
  "use strict";

  if (typeof document === "undefined") {
    return;
  }

  const PRESETS = {
    easy: { shape: "square", height: 2, width: 2, side: 2, directions: 2, target: "auto" },
    medium: { shape: "square", height: 3, width: 3, side: 2, directions: 4, target: "auto" },
    hard: { shape: "square", height: 4, width: 4, side: 2, directions: 4, target: "auto" },
    expert: { shape: "hex", height: 4, width: 4, side: 4, directions: 6, target: "auto" },
  };

  const ARROW_LABELS = {
    2: ["↑", "↓"],
    3: ["↑", "↘", "↙"],
    4: ["↑", "→", "↓", "←"],
    5: ["↑", "↗", "↘", "↙", "↖"],
    6: ["↑", "↗", "→", "↘", "↙", "←"],
  };

  const els = {
    form: document.getElementById("puzzle-form"),
    shape: document.getElementById("shape-input"),
    height: document.getElementById("height-input"),
    width: document.getElementById("width-input"),
    side: document.getElementById("side-input"),
    directions: document.getElementById("directions-input"),
    target: document.getElementById("target-input"),
    board: document.getElementById("board-root"),
    result: document.getElementById("result-root"),
    boardMeta: document.getElementById("board-meta"),
    resultSummary: document.getElementById("result-summary"),
    status: document.getElementById("solver-status"),
    solve: document.getElementById("solve-button"),
    random: document.getElementById("random-button"),
    reset: document.getElementById("reset-button"),
    presetButtons: Array.from(document.querySelectorAll("[data-preset]")),
    squareOnly: Array.from(document.querySelectorAll(".square-only")),
    hexOnly: Array.from(document.querySelectorAll(".hex-only")),
  };

  let activePreset = "easy";
  let state = {
    ...PRESETS.easy,
    values: [0, 0, 0, 0],
  };

  function clampInt(value, min, max, fallback) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, number));
  }

  function rowLengthsForState() {
    if (state.shape === "square") {
      return window.ArrowSolver.buildSquareRowLengths(state.height, state.width);
    }
    return window.ArrowSolver.buildHexRowLengths(state.side);
  }

  function cellCountForState() {
    return rowLengthsForState().reduce((sum, value) => sum + value, 0);
  }

  function affectedByForState() {
    if (state.shape === "square") {
      return window.ArrowSolver.buildSquareAffectedBy(state.height, state.width);
    }
    return window.ArrowSolver.buildHexAffectedBy(state.side);
  }

  function labelFor(value) {
    return ARROW_LABELS[state.directions][value] ?? String(value + 1);
  }

  function ensureValues(resetToZero) {
    const count = cellCountForState();
    const next = Array.from({ length: count }, (_, index) => {
      if (resetToZero) {
        return 0;
      }
      return window.ArrowSolver.modValue(state.values[index] ?? 0, state.directions);
    });
    state.values = next;
  }

  function syncControls() {
    els.shape.value = state.shape;
    els.height.value = state.height;
    els.width.value = state.width;
    els.side.value = state.side;
    els.directions.value = state.directions;

    const isSquare = state.shape === "square";
    for (const item of els.squareOnly) {
      item.hidden = !isSquare;
    }
    for (const item of els.hexOnly) {
      item.hidden = isSquare;
    }

    const currentTarget = state.target;
    els.target.innerHTML = '<option value="auto">最短</option>';
    for (let index = 0; index < state.directions; index += 1) {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${labelFor(index)} (${index + 1})`;
      els.target.append(option);
    }
    els.target.value = currentTarget === "auto" ? "auto" : String(currentTarget);

    for (const button of els.presetButtons) {
      button.classList.toggle("is-active", button.dataset.preset === activePreset);
    }
  }

  function readControls() {
    state.shape = els.shape.value;
    state.height = clampInt(els.height.value, 1, 4, state.height);
    state.width = clampInt(els.width.value, 1, 4, state.width);
    state.side = clampInt(els.side.value, 1, 4, state.side);
    state.directions = clampInt(els.directions.value, 2, 6, state.directions);
    state.target = els.target.value === "auto" ? "auto" : clampInt(els.target.value, 0, state.directions - 1, 0);

    if (state.shape === "square" && state.height * state.width > 16) {
      state.width = Math.floor(16 / state.height);
    }

    ensureValues(false);
    syncControls();
  }

  function clearResult(summary) {
    els.resultSummary.textContent = summary;
    els.result.innerHTML = '<p class="empty-state">未計算</p>';
  }

  function createCell(index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.dataset.index = String(index);
    button.textContent = labelFor(state.values[index]);
    button.setAttribute("aria-label", `cell ${index + 1}`);
    return button;
  }

  function renderBoard() {
    const rowLengths = rowLengthsForState();
    els.board.replaceChildren();

    if (state.shape === "square") {
      const board = document.createElement("div");
      board.className = "square-board";
      board.style.gridTemplateColumns = `repeat(${state.width}, minmax(0, 1fr))`;
      for (let index = 0; index < state.values.length; index += 1) {
        board.append(createCell(index));
      }
      els.board.append(board);
      els.boardMeta.textContent = `${state.height}x${state.width} / ${state.directions}方向`;
      return;
    }

    const board = document.createElement("div");
    board.className = "hex-board";
    let index = 0;
    for (const rowLength of rowLengths) {
      const row = document.createElement("div");
      row.className = "hex-row";
      for (let col = 0; col < rowLength; col += 1) {
        row.append(createCell(index));
        index += 1;
      }
      board.append(row);
    }
    els.board.append(board);
    els.boardMeta.textContent = `Hex side ${state.side} / ${state.directions}方向`;
  }

  function renderOperationBoard(rowLengths, operations) {
    const boardClass = state.shape === "square" ? "square-board" : "hex-board";
    const board = document.createElement("div");
    board.className = boardClass;

    if (state.shape === "square") {
      board.style.gridTemplateColumns = `repeat(${state.width}, minmax(0, 1fr))`;
      for (const value of operations) {
        const cell = document.createElement("span");
        cell.className = value === 0 ? "solution-cell is-zero" : "solution-cell";
        cell.textContent = String(value);
        board.append(cell);
      }
      return board;
    }

    let index = 0;
    for (const rowLength of rowLengths) {
      const row = document.createElement("div");
      row.className = "hex-row";
      for (let col = 0; col < rowLength; col += 1) {
        const value = operations[index];
        const cell = document.createElement("span");
        cell.className = value === 0 ? "solution-cell is-zero" : "solution-cell";
        cell.textContent = String(value);
        row.append(cell);
        index += 1;
      }
      board.append(row);
    }
    return board;
  }

  function solveCurrent() {
    readControls();

    try {
      const solution = window.ArrowSolver.solveArrowPuzzle({
        shape: state.shape,
        height: state.height,
        width: state.width,
        side: state.side,
        directions: state.directions,
        target: state.target,
        initial: state.values,
      });

      els.result.replaceChildren();

      if (!solution.answer.found) {
        els.resultSummary.textContent = "解なし";
        els.result.innerHTML = '<p class="empty-state">この目標では解が見つかりませんでした。</p>';
        return;
      }

      const targetLabel = labelFor(solution.answer.target);
      els.resultSummary.textContent = `${targetLabel} / ${solution.answer.totalOperations}手`;

      const summary = document.createElement("p");
      summary.className = "empty-state";
      summary.textContent = `目標 ${targetLabel}、合計 ${solution.answer.totalOperations} 回`;
      els.result.append(summary, renderOperationBoard(solution.rowLengths, solution.answer.operations));
    } catch (error) {
      els.resultSummary.textContent = "エラー";
      els.result.innerHTML = "";
      const message = document.createElement("p");
      message.className = "empty-state";
      message.textContent = error.message;
      els.result.append(message);
    }
  }

  function applyPreset(name) {
    activePreset = name;
    state = {
      ...state,
      ...PRESETS[name],
    };
    ensureValues(true);
    syncControls();
    renderBoard();
    clearResult("未計算");
  }

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  els.solve.addEventListener("click", solveCurrent);

  els.random.addEventListener("click", () => {
    readControls();
    const affectedBy = affectedByForState();
    const operations = state.values.map(() => Math.floor(Math.random() * state.directions));
    const target = Math.floor(Math.random() * state.directions);
    state.values = state.values.map(() => target);

    for (let op = 0; op < operations.length; op += 1) {
      for (let cell = 0; cell < affectedBy.length; cell += 1) {
        if (affectedBy[cell].includes(op)) {
          state.values[cell] = window.ArrowSolver.modValue(state.values[cell] - operations[op], state.directions);
        }
      }
    }

    renderBoard();
    clearResult("未計算");
  });

  els.reset.addEventListener("click", () => {
    readControls();
    ensureValues(true);
    renderBoard();
    clearResult("未計算");
  });

  els.board.addEventListener("click", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell) {
      return;
    }
    const index = Number(cell.dataset.index);
    state.values[index] = window.ArrowSolver.modValue(state.values[index] + 1, state.directions);
    renderBoard();
    clearResult("未計算");
  });

  for (const input of [els.shape, els.height, els.width, els.side, els.directions, els.target]) {
    input.addEventListener("change", () => {
      activePreset = "";
      readControls();
      renderBoard();
      clearResult("未計算");
    });
  }

  for (const button of els.presetButtons) {
    button.addEventListener("click", () => applyPreset(button.dataset.preset));
  }

  els.status.textContent = "ソルバー有効";
  syncControls();
  renderBoard();
})();
