/**
 * «Побег»: питомец бежит от препятствий — камни перепрыгнуть, чаек
 * переждать пригнувшись. Скорость растёт, счёт — метры. Чистое ядро:
 * rng передаётся снаружи (спавн препятствий), мир приходит снаружи —
 * в UI это реальный размер канваса, игра занимает весь экран.
 */

import type { MinigameWorld } from './world'

export interface RunnerBalance {
  /** метров до победы (счёт = px/10) */
  winScore: number
  /** стартовая скорость, px/с */
  speedStart: number
  /** прирост скорости за секунду, px/с² */
  speedGain: number
  /** импульс прыжка, px/с */
  jumpV: number
  /** гравитация, px/с² */
  gravity: number
  /** расстояние между препятствиями, px (мин/макс) */
  spacingMin: number
  spacingMax: number
  /** сколько держится присед после свайпа вниз, мс */
  duckMs: number
}

/** Мир по умолчанию для тестов; в UI мир = размер канваса на старте партии. */
export const RUNNER_WORLD: MinigameWorld = { w: 390, h: 420 }

/** Питомец бежит на такой высоте от левого края. */
export const RUNNER_PET_X = 62
/** Полоса земли внизу мира, px. */
export const RUNNER_GROUND_H = 50

/** Габариты, влияющие на коллизии. Хит-бокс щедрее рисунка — так честнее. */
export const RUNNER_HIT = { petW: 36, petStandH: 56, petDuckH: 30, rockW: 24, gullW: 30, gullH: 20, gullBottom: 46 } as const

export interface RunnerObstacle {
  x: number
  kind: 'rock' | 'gull'
  w: number
  h: number
}

export interface RunnerState {
  world: MinigameWorld
  /** ноги питомца над землёй, px (0 — на земле) */
  py: number
  /** px/с, вверх — положительно */
  vy: number
  ducking: boolean
  duckMsLeft: number
  speed: number
  /** пробежано, px (счёт = distance/10) */
  distance: number
  obstacles: RunnerObstacle[]
  /** px до следующего препятствия */
  nextSpawnIn: number
  over: boolean
  won: boolean
}

export function createRunner(balance: RunnerBalance, world: MinigameWorld): RunnerState {
  return {
    world,
    py: 0,
    vy: 0,
    ducking: false,
    duckMsLeft: 0,
    speed: balance.speedStart,
    distance: 0,
    obstacles: [],
    nextSpawnIn: Math.max(300, world.w * 0.5),
    over: false,
    won: false,
  }
}

/** Прыжок с земли (из приседа выпрыгивает). */
export function jumpRunner(state: RunnerState, balance: RunnerBalance): RunnerState {
  if (state.over || state.py > 0) return state
  return { ...state, py: 0.01, vy: balance.jumpV, ducking: false, duckMsLeft: 0 }
}

/** Присед: удержание (клавиша/палец) или свайп с таймером. */
export function duckRunner(state: RunnerState, on: boolean, balance: RunnerBalance): RunnerState {
  if (state.over) return state
  return on
    ? { ...state, ducking: true, duckMsLeft: balance.duckMs }
    : { ...state, ducking: false, duckMsLeft: 0 }
}

export function stepRunner(
  state: RunnerState,
  dtMs: number,
  balance: RunnerBalance,
  rng: () => number,
): RunnerState {
  if (state.over) return state
  const dt = dtMs / 1000

  const speed = state.speed + balance.speedGain * dt
  const distance = state.distance + speed * dt
  const won = distance / 10 >= balance.winScore

  // присед со свайпа держится balance.duckMs
  let ducking = state.ducking
  let duckMsLeft = state.duckMsLeft
  if (duckMsLeft > 0) {
    duckMsLeft -= dtMs
    if (duckMsLeft <= 0) {
      duckMsLeft = 0
      ducking = false
    }
  }

  // прыжок: баллистика над землёй
  let py = state.py
  let vy = state.vy
  if (py > 0 || vy > 0) {
    vy -= balance.gravity * dt
    py += vy * dt
    if (py <= 0) {
      py = 0
      vy = 0
    }
  }

  // препятствия едут навстречу
  const obstacles = state.obstacles
    .map((o) => ({ ...o, x: o.x - speed * dt }))
    .filter((o) => o.x + o.w > -24)
  let nextSpawnIn = state.nextSpawnIn - speed * dt
  if (nextSpawnIn <= 0) {
    if (rng() < 0.4) {
      obstacles.push({ x: state.world.w + 30, kind: 'gull', w: RUNNER_HIT.gullW, h: RUNNER_HIT.gullH })
    } else {
      obstacles.push({ x: state.world.w + 30, kind: 'rock', w: RUNNER_HIT.rockW, h: 24 + rng() * 7 })
    }
    nextSpawnIn += balance.spacingMin + rng() * (balance.spacingMax - balance.spacingMin)
  }

  // столкновение: камень — ноги ниже его макушки; чайка — голова в её зоне
  let over = false
  const petH = ducking ? RUNNER_HIT.petDuckH : RUNNER_HIT.petStandH
  const petTopAboveGround = py + petH
  for (const o of obstacles) {
    const overlapsX = o.x < RUNNER_PET_X + RUNNER_HIT.petW / 2 && o.x + o.w > RUNNER_PET_X - RUNNER_HIT.petW / 2
    if (!overlapsX) continue
    if (o.kind === 'rock') {
      if (py < o.h) over = true
    } else if (petTopAboveGround > RUNNER_HIT.gullBottom) over = true
    if (over) break
  }

  return {
    ...state,
    py,
    vy,
    ducking,
    duckMsLeft,
    speed,
    distance,
    obstacles,
    nextSpawnIn,
    over: over || won,
    won: won && !over,
  }
}

/** Счёт: метры с округлением вниз. */
export function runnerScore(state: RunnerState): number {
  return Math.floor(state.distance / 10)
}
