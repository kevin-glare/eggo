/**
 * «Пузыри»: поле поднимается снизу, лопай группы из трёх и больше
 * одинаковых. Никакой физики — сетка и столбы. Чистое ядро, rng снаружи
 * (цвета новых рядов), тесты детерминированы.
 */

export interface BubblesBalance {
  /** очков до победы (по 10 за пузырь) */
  winScore: number
  /** мс между подъёмами нового ряда */
  riseMs: number
  /** сколько цветов на поле */
  colors: number
  /** минимальная группа для лопания */
  minGroup: number
}

/** Сетка поля в клетках — выводится из реального размера канваса. */
export interface BubblesGridSize {
  cols: number
  rows: number
}

/** -1 — пусто, 0..colors-1 — цвет. */
export type BubblesGrid = Int8Array

export interface BubblesState {
  size: BubblesGridSize
  grid: BubblesGrid
  /** ряд за рядом поднимаемся: отсчитываем до нового ряда */
  riseMsLeft: number
  score: number
  over: boolean
  won: boolean
}

export function createBubbles(balance: BubblesBalance, size: BubblesGridSize, rng: () => number): BubblesState {
  const grid = new Int8Array(size.cols * size.rows).fill(-1)
  // старт: три нижних ряда заполнены, чтобы было что лопать сразу
  for (let row = size.rows - 3; row < size.rows; row++) {
    fillRow(grid, row, balance, size, rng)
  }
  return { size, grid, riseMsLeft: balance.riseMs, score: 0, over: false, won: false }
}

export function cellAt(state: BubblesState, x: number, y: number): number {
  const { cols, rows } = state.size
  if (x < 0 || y < 0 || x >= cols || y >= rows) return -1
  return state.grid[y * cols + x]!
}

/** Лопнуть группу щелчком: < minGroup — ничего, ≥ — очки и столбы оседают. */
export function tapBubble(
  state: BubblesState,
  balance: BubblesBalance,
  x: number,
  y: number,
): { state: BubblesState; popped: number } {
  if (state.over) return { state, popped: 0 }
  const color = cellAt(state, x, y)
  if (color < 0) return { state, popped: 0 }
  const group = floodGroup(state, x, y)
  if (group.length < balance.minGroup) return { state, popped: 0 }
  const grid = state.grid
  for (const i of group) grid[i] = -1
  // пузыри над лопнувшими опускаются в своих столбах
  for (let col = 0; col < state.size.cols; col++) compactColumn(grid, col, state.size)
  const score = state.score + group.length * 10
  const won = score >= balance.winScore
  return { state: { ...state, grid, score, over: won, won }, popped: group.length }
}

export function stepBubbles(state: BubblesState, dtMs: number, balance: BubblesBalance, rng: () => number): BubblesState {
  if (state.over) return state
  const { cols, rows } = state.size
  const grid = Int8Array.from(state.grid)
  let riseMsLeft = state.riseMsLeft - dtMs
  let over = false
  while (riseMsLeft <= 0 && !over) {
    // всё поднимается на ряд: верхний ряд выдавливается — проигрыш
    for (let col = 0; col < cols; col++) {
      if (grid[col]! >= 0) over = true
    }
    if (over) break
    for (let row = 1; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        grid[(row - 1) * cols + col] = grid[row * cols + col]!
      }
    }
    fillRow(grid, rows - 1, balance, state.size, rng)
    riseMsLeft += balance.riseMs
  }
  if (over) return { ...state, grid, riseMsLeft: 0, over: true, won: false }
  return { ...state, grid, riseMsLeft }
}

/** Счёт партиями по 10 за пузырь. */
export function bubblesScore(state: BubblesState): number {
  return state.score
}

/* --- внутреннее --- */

function floodGroup(state: BubblesState, x: number, y: number): number[] {
  const { cols, rows } = state.size
  const color = cellAt(state, x, y)
  const seen = new Set<number>()
  const stack = [y * cols + x]
  const out: number[] = []
  while (stack.length > 0) {
    const i = stack.pop()!
    if (seen.has(i)) continue
    seen.add(i)
    if (state.grid[i] !== color) continue
    out.push(i)
    const cx = i % cols
    const cy = Math.floor(i / cols)
    if (cx > 0) stack.push(i - 1)
    if (cx < cols - 1) stack.push(i + 1)
    if (cy > 0) stack.push(i - cols)
    if (cy < rows - 1) stack.push(i + cols)
  }
  return out
}

/** Убрать дыры в столбе: пузыри падают вниз, пустота уходит вверх. */
function compactColumn(grid: BubblesGrid, col: number, size: BubblesGridSize): void {
  let write = size.rows - 1
  for (let row = size.rows - 1; row >= 0; row--) {
    const v = grid[row * size.cols + col]!
    if (v >= 0) {
      grid[write * size.cols + col] = v
      if (write !== row) grid[row * size.cols + col] = -1
      write -= 1
    }
  }
  for (; write >= 0; write--) grid[write * size.cols + col] = -1
}

function fillRow(grid: BubblesGrid, row: number, balance: BubblesBalance, size: BubblesGridSize, rng: () => number): void {
  for (let col = 0; col < size.cols; col++) {
    grid[row * size.cols + col] = Math.floor(rng() * balance.colors)
  }
}
