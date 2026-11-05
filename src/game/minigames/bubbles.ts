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
  cols: number
  rows: number
}

/** -1 — пусто, 0..colors-1 — цвет. */
export type BubblesGrid = Int8Array

export interface BubblesState {
  grid: BubblesGrid
  /** ряд за рядом поднимаемся: отсчитываем до нового ряда */
  riseMsLeft: number
  score: number
  over: boolean
  won: boolean
}

export function createBubbles(balance: BubblesBalance, rng: () => number): BubblesState {
  const grid = new Int8Array(balance.cols * balance.rows).fill(-1)
  // старт: три нижних ряда заполнены, чтобы было что лопать сразу
  for (let row = balance.rows - 3; row < balance.rows; row++) {
    fillRow(grid, row, balance, rng)
  }
  return { grid, riseMsLeft: balance.riseMs, score: 0, over: false, won: false }
}

export function cellAt(state: BubblesState, balance: BubblesBalance, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= balance.cols || y >= balance.rows) return -1
  return state.grid[y * balance.cols + x]!
}

/** Лопнуть группу щелчком: < minGroup — ничего, ≥ — очки и столбы оседают. */
export function tapBubble(
  state: BubblesState,
  balance: BubblesBalance,
  x: number,
  y: number,
): { state: BubblesState; popped: number } {
  if (state.over) return { state, popped: 0 }
  const color = cellAt(state, balance, x, y)
  if (color < 0) return { state, popped: 0 }
  const group = floodGroup(state, balance, x, y)
  if (group.length < balance.minGroup) return { state, popped: 0 }
  const grid = state.grid
  for (const i of group) grid[i] = -1
  // пузыри над лопнувшими опускаются в своих столбах
  for (let col = 0; col < balance.cols; col++) compactColumn(grid, col, balance)
  const score = state.score + group.length * 10
  const won = score >= balance.winScore
  return { state: { ...state, grid, score, over: won, won }, popped: group.length }
}

export function stepBubbles(state: BubblesState, dtMs: number, balance: BubblesBalance, rng: () => number): BubblesState {
  if (state.over) return state
  const grid = Int8Array.from(state.grid)
  let riseMsLeft = state.riseMsLeft - dtMs
  let over = false
  while (riseMsLeft <= 0 && !over) {
    // всё поднимается на ряд: верхний ряд выдавливается — проигрыш
    for (let col = 0; col < balance.cols; col++) {
      if (grid[col]! >= 0) over = true
    }
    if (over) break
    for (let row = 1; row < balance.rows; row++) {
      for (let col = 0; col < balance.cols; col++) {
        grid[(row - 1) * balance.cols + col] = grid[row * balance.cols + col]!
      }
    }
    fillRow(grid, balance.rows - 1, balance, rng)
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

function floodGroup(state: BubblesState, balance: BubblesBalance, x: number, y: number): number[] {
  const color = cellAt(state, balance, x, y)
  const seen = new Set<number>()
  const stack = [y * balance.cols + x]
  const out: number[] = []
  while (stack.length > 0) {
    const i = stack.pop()!
    if (seen.has(i)) continue
    seen.add(i)
    if (state.grid[i] !== color) continue
    out.push(i)
    const cx = i % balance.cols
    const cy = Math.floor(i / balance.cols)
    if (cx > 0) stack.push(i - 1)
    if (cx < balance.cols - 1) stack.push(i + 1)
    if (cy > 0) stack.push(i - balance.cols)
    if (cy < balance.rows - 1) stack.push(i + balance.cols)
  }
  return out
}

/** Убрать дыры в столбе: пузыри падают вниз, пустота уходит вверх. */
function compactColumn(grid: BubblesGrid, col: number, balance: BubblesBalance): void {
  let write = balance.rows - 1
  for (let row = balance.rows - 1; row >= 0; row--) {
    const v = grid[row * balance.cols + col]!
    if (v >= 0) {
      grid[write * balance.cols + col] = v
      if (write !== row) grid[row * balance.cols + col] = -1
      write -= 1
    }
  }
  for (; write >= 0; write--) grid[write * balance.cols + col] = -1
}

function fillRow(grid: BubblesGrid, row: number, balance: BubblesBalance, rng: () => number): void {
  for (let col = 0; col < balance.cols; col++) {
    grid[row * balance.cols + col] = Math.floor(rng() * balance.colors)
  }
}
