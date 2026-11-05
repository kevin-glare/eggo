/**
 * «Полёт»: тап — взмах, не падай и проходи колонны. Чистое ядро,
 * rng снаружи (высота зазора), тесты детерминированы.
 */

export interface FlappyBalance {
  /** пройденных колонн до победы */
  winScore: number
  /** гравитация, px/с² */
  gravity: number
  /** импульс взмаха, px/с (вверх) */
  flapV: number
  /** скорость колонн, px/с */
  pipeSpeed: number
  /** расстояние между колоннами, px */
  pipeSpacing: number
  /** высота зазора, px */
  pipeGap: number
  /** ширина колонны, px */
  pipeW: number
}

export const FLAPPY_WORLD = { w: 390, h: 420, petX: 120, petR: 17 } as const

export interface FlappyPipe {
  x: number
  /** центр зазора, px от верха мира */
  gapY: number
  passed: boolean
}

export interface FlappyState {
  y: number
  vy: number
  pipes: FlappyPipe[]
  /** px до следующей колонны */
  nextSpawnIn: number
  score: number
  over: boolean
  won: boolean
}

export function createFlappy(balance: FlappyBalance): FlappyState {
  return { y: FLAPPY_WORLD.h * 0.45, vy: 0, pipes: [], nextSpawnIn: balance.pipeSpacing + 60, score: 0, over: false, won: false }
}

/** Взмах: импульс вверх. */
export function flap(state: FlappyState, balance: FlappyBalance): FlappyState {
  if (state.over) return state
  return { ...state, vy: -balance.flapV }
}

export function stepFlappy(state: FlappyState, dtMs: number, balance: FlappyBalance, rng: () => number): FlappyState {
  if (state.over) return state
  const dt = dtMs / 1000
  const { w, h, petX, petR } = FLAPPY_WORLD

  const y = state.y + state.vy * dt + (balance.gravity * dt * dt) / 2
  const vy = state.vy + balance.gravity * dt

  // колонны едут влево, за левым краем выбрасываются
  let pipes = state.pipes
    .map((p) => ({ ...p, x: p.x - balance.pipeSpeed * dt }))
    .filter((p) => p.x + balance.pipeW > -8)
  let nextSpawnIn = state.nextSpawnIn - balance.pipeSpeed * dt
  if (nextSpawnIn <= 0) {
    const gapY = 80 + rng() * (h - 200)
    pipes.push({ x: w + balance.pipeW / 2, gapY, passed: false })
    nextSpawnIn = balance.pipeSpacing
  }

  // счёт: колонна пройдена, когда хвост колонны позади питомца
  let score = state.score
  pipes = pipes.map((p) => {
    if (!p.passed && p.x + balance.pipeW < petX - petR) {
      score += 1
      return { ...p, passed: true }
    }
    return p
  })

  // пол: коснулся — конец; потолок: мягко держим
  let over = y + petR >= h - 8
  const clampedY = Math.max(petR, y)
  const clampedVy = y < petR ? Math.max(0, vy) : vy

  // колонны: круг против двух прямоугольников
  const gapHalf = balance.pipeGap / 2
  for (const p of pipes) {
    const nearX = petX + petR > p.x && petX - petR < p.x + balance.pipeW
    if (!nearX) continue
    const topBottom = p.gapY - gapHalf
    const bottomTop = p.gapY + gapHalf
    if (clampedY - petR < topBottom || clampedY + petR > bottomTop) {
      over = true
      break
    }
  }

  const won = !over && score >= balance.winScore
  return { y: clampedY, vy: clampedVy, pipes, nextSpawnIn, score, over: over || won, won }
}
