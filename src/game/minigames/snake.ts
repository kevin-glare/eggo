/**
 * «Змейка»: классика — собирая еду, растёшь, не врезайся в себя
 * и в стены: край поля смертелен. Партия бесконечна, со временем
 * ход ускоряется — чем дольше живёшь, тем быстрее поле.
 * Поле-сетка приходит снаружи (в UI выводится из реального размера
 * канваса — игра на весь экран). Чистое ядро, rng снаружи (новая еда).
 */

export type SnakeDir = 'up' | 'down' | 'left' | 'right'

export interface SnakeBalance {
  /** мс между ходами на старте */
  moveMs: number
  /** мс между ходами на максимуме скорости */
  moveMin: number
  /** сколько мс разгона за каждую секунду партии */
  rampPerSec: number
}

/** Сетка поля в клетках — выводится из размера канваса. */
export interface SnakeGrid {
  cols: number
  rows: number
}

export interface SnakeCell {
  x: number
  y: number
}

export interface SnakeState {
  grid: SnakeGrid
  /** голова первая */
  snake: SnakeCell[]
  dir: SnakeDir
  /** поворот, ждущий следующего хода (за шаг — один, без разворота на 180°) */
  pendingDir: SnakeDir | null
  food: SnakeCell
  moveMsLeft: number
  /** сколько миллисекунд партия уже идёт — ключ разгона */
  elapsedMs: number
  score: number
  over: boolean
}

export function createSnake(balance: SnakeBalance, grid: SnakeGrid, rng: () => number): SnakeState {
  const mid = { x: Math.floor(grid.cols / 2), y: Math.floor(grid.rows / 2) }
  return {
    grid,
    snake: [mid, { x: (mid.x - 1 + grid.cols) % grid.cols, y: mid.y }, { x: (mid.x - 2 + grid.cols) % grid.cols, y: mid.y }],
    dir: 'right',
    pendingDir: null,
    food: spawnFood([], grid, rng),
    moveMsLeft: balance.moveMs,
    elapsedMs: 0,
    score: 0,
    over: false,
  }
}

/** Поворот: противоположное направление игнорируется, как и повтор текущего. */
export function turnSnake(state: SnakeState, dir: SnakeDir): SnakeState {
  if (state.over) return state
  const current = state.pendingDir ?? state.dir
  const opposite: Record<SnakeDir, SnakeDir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
  if (dir === current || dir === opposite[current]) return state
  return { ...state, pendingDir: dir }
}

export function stepSnake(state: SnakeState, dtMs: number, balance: SnakeBalance, rng: () => number): SnakeState {
  if (state.over) return state
  let next = state
  let moveMsLeft = state.moveMsLeft - dtMs
  while (moveMsLeft <= 0 && !next.over) {
    next = advance(next, rng)
    moveMsLeft += moveInterval(next, balance)
  }
  if (next.over) return next
  return { ...next, moveMsLeft, elapsedMs: state.elapsedMs + dtMs }
}

/** Счёт: куски еды. */
export function snakeScore(state: SnakeState): number {
  return state.score
}

/** Текущий интервал хода: укорачивается со временем партии, пол на moveMin. */
export function moveInterval(state: SnakeState, balance: SnakeBalance): number {
  return Math.max(balance.moveMin, balance.moveMs - (state.elapsedMs / 1000) * balance.rampPerSec)
}

function advance(state: SnakeState, rng: () => number): SnakeState {
  const dir = state.pendingDir ?? state.dir
  const delta: Record<SnakeDir, SnakeCell> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }
  const d = delta[dir]
  const head = state.snake[0]!
  // стены смертельны: шаг за край — конец
  const nx = head.x + d.x
  const ny = head.y + d.y
  if (nx < 0 || nx >= state.grid.cols || ny < 0 || ny >= state.grid.rows) {
    return { ...state, dir, pendingDir: null, over: true }
  }
  const wx = nx
  const wy = ny

  const eating = wx === state.food.x && wy === state.food.y
  const body = eating ? state.snake : state.snake.slice(0, -1)
  const hitSelf = body.some((c) => c.x === wx && c.y === wy)
  if (hitSelf) return { ...state, dir, pendingDir: null, over: true }

  const snake = [{ x: wx, y: wy }, ...(eating ? state.snake : body)]
  if (!eating) return { ...state, snake, dir, pendingDir: null }

  const score = state.score + 1
  return {
    ...state,
    snake,
    dir,
    pendingDir: null,
    food: spawnFood(snake, state.grid, rng),
    score,
  }
}

function spawnFood(snake: SnakeCell[], grid: SnakeGrid, rng: () => number): SnakeCell {
  // свободных клеток заведомо больше занятых — ограниченных попыток хватает
  for (let i = 0; i < 200; i++) {
    const c = { x: Math.floor(rng() * grid.cols), y: Math.floor(rng() * grid.rows) }
    if (!snake.some((s) => s.x === c.x && s.y === c.y)) return c
  }
  return { x: 0, y: 0 }
}
