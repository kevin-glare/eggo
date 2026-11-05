/**
 * «Полёт»: тап — взмах, не падай и проходи колонны. Чистое ядро,
 * rng снаружи (высота зазора), мир приходит снаружи — реальный размер
 * канваса, тесты детерминированы.
 */

import type { MinigameWorld } from './world'

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

/** Мир по умолчанию для тестов. */
export const FLAPPY_WORLD: MinigameWorld = { w: 390, h: 420 }
/** Радиус питомца, px. */
export const FLAPPY_PET_R = 17

export interface FlappyPipe {
  x: number
  /** центр зазора, px от верха мира */
  gapY: number
  passed: boolean
}

export interface FlappyState {
  world: MinigameWorld
  /** единый масштаб мира: размеры и физика уже умножены на него */
  scale: number
  y: number
  vy: number
  pipes: FlappyPipe[]
  /** px до следующей колонны */
  nextSpawnIn: number
  score: number
  over: boolean
  won: boolean
}

/** Питомец висит на трети ширины мира. */
export function flappyPetX(world: MinigameWorld): number {
  return Math.round(world.w * 0.3)
}

/** Единый масштаб мира: колонны, зазоры и физика растут с экраном, темп тот же. */
export function flappyScale(world: MinigameWorld): number {
  return Math.min(1.9, Math.max(1, world.h / 420))
}

export function createFlappy(balance: FlappyBalance, world: MinigameWorld): FlappyState {
  return { world, scale: flappyScale(world), y: world.h * 0.45, vy: 0, pipes: [], nextSpawnIn: balance.pipeSpacing * flappyScale(world) + 60, score: 0, over: false, won: false }
}

/** Взмах: импульс вверх. */
export function flap(state: FlappyState, balance: FlappyBalance): FlappyState {
  if (state.over) return state
  return { ...state, vy: -balance.flapV * state.scale }
}

export function stepFlappy(state: FlappyState, dtMs: number, balance: FlappyBalance, rng: () => number): FlappyState {
  if (state.over) return state
  const dt = dtMs / 1000
  const { w, h } = state.world
  const s = state.scale
  const petX = flappyPetX(state.world)
  const petR = FLAPPY_PET_R * s

  const y = state.y + state.vy * dt + (balance.gravity * s * dt * dt) / 2
  const vy = state.vy + balance.gravity * s * dt

  // колонны едут влево, за левым краем выбрасываются
  let pipes = state.pipes
    .map((p) => ({ ...p, x: p.x - balance.pipeSpeed * s * dt }))
    .filter((p) => p.x + balance.pipeW * s > -8)
  let nextSpawnIn = state.nextSpawnIn - balance.pipeSpeed * s * dt
  if (nextSpawnIn <= 0) {
    const gapY = 80 * s + rng() * Math.max(40 * s, h - 200 * s)
    pipes.push({ x: w + (balance.pipeW * s) / 2, gapY, passed: false })
    nextSpawnIn = balance.pipeSpacing * s
  }

  // счёт: колонна пройдена, когда хвост колонны позади питомца
  let score = state.score
  pipes = pipes.map((p) => {
    if (!p.passed && p.x + balance.pipeW * s < petX - petR) {
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
  const gapHalf = (balance.pipeGap * s) / 2
  for (const p of pipes) {
    const nearX = petX + petR > p.x && petX - petR < p.x + balance.pipeW * s
    if (!nearX) continue
    const topBottom = p.gapY - gapHalf
    const bottomTop = p.gapY + gapHalf
    if (clampedY - petR < topBottom || clampedY + petR > bottomTop) {
      over = true
      break
    }
  }

  const won = !over && score >= balance.winScore
  return { world: state.world, scale: s, y: clampedY, vy: clampedVy, pipes, nextSpawnIn, score, over: over || won, won }
}
