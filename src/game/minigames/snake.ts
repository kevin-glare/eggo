/**
 * «Змейка»: классика — собирая еду, растёшь, не врезайся в себя.
 * Стены проходимы насквозь: ушёл за край — появился с противоположной
 * стороны. Поле-сетка приходит снаружи (в UI выводится из реального
 * размера канваса — игра на весь экран), ход по таймеру, с каждым куском
 * чуть быстрее. Чистое ядро, rng снаружи (новая еда).
 */

export type SnakeDir = 'up' | 'down' | 'left' | 'right'

export interface SnakeBalance {
  /** кусков еды до победы */
  winScore: number
  /** мс между ходами на старте */
  moveMs: number
  /** мс между ходами на максимуме скорости */
  moveMin: number
  /** сколько мс отнимает каждый кусок еды */
  moveStep: number
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
  score: number
  over: boolean
  won: boolean
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
    score: 0,
    over: false,
    won: false,
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
    next = advance(next, balance, rng)
    moveMsLeft += moveInterval(next, balance)
  }
  if (next.over) return next
  return { ...next, moveMsLeft }
}

/** Счёт: куски еды. */
export function snakeScore(state: SnakeState): number {
  return state.score
}

/** Текущий интервал хода: укорачивается с каждым куском. */
export function moveInterval(state: SnakeState, balance: SnakeBalance): number {
  return Math.max(balance.moveMin, balance.moveMs - state.score * balance.moveStep)
}

function advance(state: SnakeState, balance: SnakeBalance, rng: () => number): SnakeState {
  const dir = state.pendingDir ?? state.dir
  const delta: Record<SnakeDir, SnakeCell> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }
  const d = delta[dir]
  const head = state.snake[0]!
  // сквозь стены: выход за край заворачивает на противоположную сторону
  const wx = (head.x + d.x + state.grid.cols) % state.grid.cols
  const wy = (head.y + d.y + state.grid.rows) % state.grid.rows

  const eating = wx === state.food.x && wy === state.food.y
  const body = eating ? state.snake : state.snake.slice(0, -1)
  const hitSelf = body.some((c) => c.x === wx && c.y === wy)
  if (hitSelf) return { ...state, dir, pendingDir: null, over: true, won: false }

  const snake = [{ x: wx, y: wy }, ...(eating ? state.snake : body)]
  if (!eating) return { ...state, snake, dir, pendingDir: null }

  const score = state.score + 1
  const won = score >= balance.winScore
  return {
    ...state,
    snake,
    dir,
    pendingDir: null,
    food: won ? state.food : spawnFood(snake, state.grid, rng),
    score,
    over: won,
    won,
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
