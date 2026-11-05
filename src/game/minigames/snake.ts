/**
 * «Змейка»: классика — собирая еду, растёшь, не врезайся в стены и себя.
 * Поле-сетка, ход по таймеру, с каждым куском чуть быстрее. Чистое ядро,
 * rng снаружи (новая еда), тесты детерминированы.
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
  /** сторона поля в клетках */
  cells: number
}

export interface SnakeCell {
  x: number
  y: number
}

export interface SnakeState {
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

export function createSnake(balance: SnakeBalance, rng: () => number): SnakeState {
  const mid = Math.floor(balance.cells / 2)
  return {
    snake: [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ],
    dir: 'right',
    pendingDir: null,
    food: spawnFood([], balance.cells, rng),
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
  const nx = head.x + d.x
  const ny = head.y + d.y

  // стены и собственный хвост (хвост уйдёт, если еду не едим — как в классике)
  const eating = nx === state.food.x && ny === state.food.y
  const body = eating ? state.snake : state.snake.slice(0, -1)
  const hitWall = nx < 0 || ny < 0 || nx >= balance.cells || ny >= balance.cells
  const hitSelf = body.some((c) => c.x === nx && c.y === ny)
  if (hitWall || hitSelf) return { ...state, dir, pendingDir: null, over: true, won: false }

  const snake = [{ x: nx, y: ny }, ...(eating ? state.snake : body)]
  if (!eating) return { ...state, snake, dir, pendingDir: null }

  const score = state.score + 1
  const won = score >= balance.winScore
  return {
    ...state,
    snake,
    dir,
    pendingDir: null,
    food: won ? state.food : spawnFood(snake, balance.cells, rng),
    score,
    over: won,
    won,
  }
}

function spawnFood(snake: SnakeCell[], cells: number, rng: () => number): SnakeCell {
  // свободных клеток заведомо больше занятых — ограниченных попыток хватает
  for (let i = 0; i < 200; i++) {
    const c = { x: Math.floor(rng() * cells), y: Math.floor(rng() * cells) }
    if (!snake.some((s) => s.x === c.x && s.y === c.y)) return c
  }
  return { x: 0, y: 0 }
}
