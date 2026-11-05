import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/game/config'
import {
  createRunner,
  duckRunner,
  jumpRunner,
  RUNNER_HIT,
  RUNNER_PET_X,
  RUNNER_WORLD,
  runnerScore,
  stepRunner,
} from '../src/game/minigames/runner'
import { createFlappy, FLAPPY_PET_R, FLAPPY_WORLD, flap, flappyPetX, stepFlappy } from '../src/game/minigames/flappy'

const RUN = DEFAULT_CONFIG.minigames.runner
const FLY = DEFAULT_CONFIG.minigames.flappy

/** Всегда «камень» (rng ≥ 0.4 → камень). */
const noGull = () => 0.9
/** Всегда «чайка» (rng < 0.4 → чайка). */
const alwaysGull = () => 0.2

describe('runner — ядро «Побега»', () => {
  it('питомец стоит на земле, пока не прыгнул', () => {
    const s = stepRunner(createRunner(RUN, RUNNER_WORLD), 100, RUN, noGull)
    expect(s.py).toBe(0)
  })

  it('прыжок поднимает и возвращает на землю (баллистика)', () => {
    let s = jumpRunner(createRunner(RUN, RUNNER_WORLD), RUN)
    expect(s.vy).toBe(RUN.jumpV)
    const apex = { ...s }
    for (let t = 0; t < 400; t += 16) apex.py = Math.max(apex.py, stepRunner(s, 16, RUN, noGull).py), (s = stepRunner(s, 16, RUN, noGull))
    // высота прыжка v²/2g ≈ 65 px — перекрывает камень до 34 px
    expect(apex.py).toBeGreaterThan(50)
    let landed = s
    for (let t = 0; t < 1500 && landed.py > 0; t += 16) landed = stepRunner(landed, 16, RUN, noGull)
    expect(landed.py).toBe(0)
  })

  it('камень сбивает бегуна в полный рост', () => {
    let s = createRunner(RUN, RUNNER_WORLD)
    // гоним до первого камня и даём ему доехать
    for (let i = 0; i < 4000 && !s.over; i += 1) s = stepRunner(s, 16, RUN, noGull)
    expect(s.over).toBe(true)
    expect(s.won).toBe(false)
  })

  it('идеальный бот прыгает через все камни и добегает до победы', () => {
    let s = createRunner(RUN, RUNNER_WORLD)
    // «идеальный бот»: прыгает за 0.4 с до камня (точка апогея), как человек
    for (let i = 0; i < 5000 && !s.over; i += 1) {
      const lead = s.speed * 0.4
      const near = s.obstacles.some((o) => o.kind === 'rock' && o.x > RUNNER_PET_X - 8 && o.x - RUNNER_PET_X < lead)
      if (near && s.py === 0) s = jumpRunner(s, RUN)
      else s = stepRunner(s, 16, RUN, noGull)
    }
    expect(s.over).toBe(true)
    expect(s.won).toBe(true)
    expect(s.distance).toBeGreaterThanOrEqual(RUN.winScore * 10)
  })

  it('чайка берёт стоячего, но не пригнувшегося', () => {
    // телепортируем чайку прямо к питомцу
    const base = createRunner(RUN, RUNNER_WORLD)
    const gullHere = { ...base, obstacles: [{ x: RUNNER_PET_X - 10, kind: 'gull' as const, w: RUNNER_HIT.gullW, h: RUNNER_HIT.gullH }] }
    expect(stepRunner(gullHere, 16, RUN, noGull).over).toBe(true)
    const ducked = duckRunner(gullHere, true, RUN)
    expect(stepRunner(ducked, 16, RUN, noGull).over).toBe(false)
    const airborne = { ...gullHere, py: 12, vy: 0 }
    expect(stepRunner(airborne, 16, RUN, noGull).over).toBe(true)
  })

  it('бег с чайками без приседа заканчивается столкновением', () => {
    let s = createRunner(RUN, RUNNER_WORLD)
    for (let i = 0; i < 4000 && !s.over; i += 1) s = stepRunner(s, 16, RUN, alwaysGull)
    expect(s.over).toBe(true)
    expect(s.won).toBe(false)
  })

  it('скорость растёт со временем', () => {
    let s = createRunner(RUN, RUNNER_WORLD)
    for (let i = 0; i < 60; i += 1) s = stepRunner(s, 1000, RUN, noGull)
    expect(s.speed).toBeGreaterThan(RUN.speedStart)
  })

  it('победа по метрам: over и won вместе', () => {
    const s = { ...createRunner(RUN, RUNNER_WORLD), distance: RUN.winScore * 10 + 5 }
    const next = stepRunner(s, 16, RUN, noGull)
    expect(next.over).toBe(true)
    expect(next.won).toBe(true)
  })

  it('счёт — метры без округления вверх', () => {
    expect(runnerScore({ ...createRunner(RUN, RUNNER_WORLD), distance: 314 })).toBe(31)
  })
})

describe('flappy — ядро «Полёта»', () => {
  it('без взмахов питомец падает на землю и проигрывает', () => {
    let s = createFlappy(FLY, FLAPPY_WORLD)
    for (let i = 0; i < 600 && !s.over; i += 1) s = stepFlappy(s, 16, FLY, () => 0.5)
    expect(s.over).toBe(true)
    expect(s.won).toBe(false)
  })

  it('взмах поднимает, гравитация тянет вниз', () => {
    let s = flap(createFlappy(FLY, FLAPPY_WORLD), FLY)
    expect(s.vy).toBe(-FLY.flapV)
    const after = stepFlappy(s, 100, FLY, () => 0.5)
    expect(after.vy).toBeGreaterThan(-FLY.flapV)
  })

  it('колонны считаются, когда хвост позади питомца', () => {
    let s = createFlappy(FLY, FLAPPY_WORLD)
    const y0 = s.y
    for (let i = 0; i < 3000; i += 1) {
      s = stepFlappy(s, 16, FLY, () => 0.5)
      // держим высоту постоянной: центр зазора всегда под rng 0.5 → gapY фикс
      if (!s.over) s = { ...s, y: y0, vy: 0 }
    }
    expect(s.score).toBeGreaterThan(0)
  })

  it('столкновение с колонной заканчивает партию', () => {
    const base = createFlappy(FLY, FLAPPY_WORLD)
    // колонна прямо у питомца, питомец на уровне земли колонны
    const doomed = { ...base, pipes: [{ x: flappyPetX(FLAPPY_WORLD) - 5, gapY: 40, passed: false }] }
    const next = stepFlappy(doomed, 16, FLY, () => 0.5)
    expect(next.over).toBe(true)
  })

  it('выигрыш: winScore колонн — won без столкновений', () => {
    const base = createFlappy(FLY, FLAPPY_WORLD)
    const winner = { ...base, score: FLY.winScore - 1, pipes: [{ x: flappyPetX(FLAPPY_WORLD) - FLY.pipeW - 20, gapY: 200, passed: false }] }
    const next = stepFlappy(winner, 16, FLY, () => 0.5)
    expect(next.won).toBe(true)
    expect(next.over).toBe(true)
  })

  it('потолок мягкий: питомец не погибает об него', () => {
    const base = createFlappy(FLY, FLAPPY_WORLD)
    const high = { ...base, y: 5, vy: -300 }
    const next = stepFlappy(high, 16, FLY, () => 0.5)
    expect(next.over).toBe(false)
    expect(next.y).toBeGreaterThanOrEqual(FLAPPY_PET_R - 0.01)
  })
})
