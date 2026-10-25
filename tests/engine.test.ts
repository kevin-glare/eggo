import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, DEV_CONFIG } from '../src/game/config'
import { averageStats, createPet, getMood, tick } from '../src/game/engine'
import type { PetState } from '../src/game/types'
import { DAY, HOUR, MINUTE, hatchedPet, makePet } from './helpers'

describe('createPet', () => {
  it('создаёт яйцо с начальными статами', () => {
    const pet = createPet(1_000, DEFAULT_CONFIG)
    expect(pet.stage).toBe('egg')
    expect(pet.stats).toEqual(DEFAULT_CONFIG.initialStats)
    expect(pet.ageMs).toBe(0)
    expect(pet.createdAt).toBe(1_000)
    expect(pet.lastTickAt).toBe(1_000)
    expect(pet.sleeping).toBe(false)
    expect(pet.sick).toBe(false)
    expect(pet.name).toBeNull()
  })
})

describe('tick — затухание статов', () => {
  it('за час бодрствования статы падают на decayPerHour', () => {
    const pet = hatchedPet(DEFAULT_CONFIG)
    const next = tick(pet, HOUR, DEFAULT_CONFIG)
    expect(next.stats.fullness).toBeCloseTo(80 - 12)
    expect(next.stats.happiness).toBeCloseTo(80 - 10)
    expect(next.stats.energy).toBeCloseTo(80 - 8)
    expect(next.stats.cleanliness).toBeCloseTo(80 - 6)
  })

  it('не опускает статы ниже 0', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, {}, { fullness: 1 })
    const next = tick(pet, 10 * DAY, DEFAULT_CONFIG)
    expect(next.stats.fullness).toBe(0)
  })

  it('в яйце статы заморожены', () => {
    const pet = makePet(DEFAULT_CONFIG)
    // 1 секунда < eggMs (5 секунд) — весь тик остаётся внутри стадии яйца
    const next = tick(pet, 1_000, DEFAULT_CONFIG)
    expect(next.stats).toEqual(DEFAULT_CONFIG.initialStats)
  })

  it('без имени жизнь не начинается: тик ничего не меняет', () => {
    const pet = makePet(DEFAULT_CONFIG, { name: null })
    expect(tick(pet, HOUR, DEFAULT_CONFIG)).toEqual(pet)
  })

  it('во сне энергия восстанавливается, прочие статы падают медленнее', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { sleeping: true }, { energy: 20 })
    const next = tick(pet, 2 * HOUR, DEFAULT_CONFIG)
    expect(next.stats.energy).toBeCloseTo(20 + 25 * 2)
    expect(next.stats.fullness).toBeCloseTo(80 - 12 * 0.5 * 2)
  })

  it('не мутирует исходное состояние', () => {
    const pet = hatchedPet(DEFAULT_CONFIG)
    const before = structuredClone(pet)
    tick(pet, HOUR, DEFAULT_CONFIG)
    expect(pet).toEqual(before)
  })
})

describe('tick — эволюция', () => {
  it('яйцо вылупляется по достижении eggMs', () => {
    const pet = makePet(DEFAULT_CONFIG)
    const next = tick(pet, DEFAULT_CONFIG.evolution.eggMs, DEFAULT_CONFIG)
    expect(next.stage).toBe('baby')
  })

  it('малыш становится взрослым после eggMs + babyMs', () => {
    const pet = makePet(DEFAULT_CONFIG)
    const next = tick(pet, DEFAULT_CONFIG.evolution.eggMs + DEFAULT_CONFIG.evolution.babyMs, DEFAULT_CONFIG)
    expect(next.stage).toBe('adult')
  })

  it('возраст накапливается', () => {
    const pet = hatchedPet(DEFAULT_CONFIG)
    const next = tick(tick(pet, HOUR, DEFAULT_CONFIG), HOUR, DEFAULT_CONFIG)
    expect(next.ageMs).toBe(pet.ageMs + 2 * HOUR)
  })
})

describe('tick — болезнь', () => {
  it('копит пренебрежение, когда любой стат в критической зоне', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, {}, { fullness: 10 })
    const next = tick(pet, HOUR, DEFAULT_CONFIG)
    expect(next.neglectMs).toBe(HOUR)
  })

  it('сбрасывает пренебрежение, когда всё в порядке', () => {
    const pet: PetState = { ...hatchedPet(DEFAULT_CONFIG, {}, { fullness: 10 }), neglectMs: HOUR }
    const healed = tick({ ...pet, stats: { ...pet.stats, fullness: 80 } }, HOUR, DEFAULT_CONFIG)
    expect(healed.neglectMs).toBe(0)
  })

  it('долгое пренебрежение приводит к болезни', () => {
    const threshold = DEFAULT_CONFIG.sicknessAfterMs
    const pet = hatchedPet(DEFAULT_CONFIG, { neglectMs: threshold - MINUTE }, { fullness: 10 })
    const next = tick(pet, 2 * MINUTE, DEFAULT_CONFIG)
    expect(next.sick).toBe(true)
  })

  it('забота лечит: средний стат выше порога — выздоровление', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { sick: true, neglectMs: DAY })
    const next = tick(pet, MINUTE, DEFAULT_CONFIG)
    expect(next.sick).toBe(false)
    expect(next.neglectMs).toBe(0)
  })
})

describe('getMood', () => {
  const cfg = DEFAULT_CONFIG

  it('спит → sleeping', () => {
    expect(getMood(hatchedPet(cfg, { sleeping: true }), cfg)).toBe('sleeping')
  })

  it('болен → sick', () => {
    expect(getMood(hatchedPet(cfg, { sick: true }), cfg)).toBe('sick')
  })

  it('высокий средний стат → happy', () => {
    expect(getMood(hatchedPet(cfg, {}, { fullness: 90, happiness: 90, energy: 90, cleanliness: 90 }), cfg)).toBe('happy')
  })

  it('средний стат в середине → content', () => {
    expect(getMood(hatchedPet(cfg, {}, { fullness: 60, happiness: 60, energy: 60, cleanliness: 60 }), cfg)).toBe('content')
  })

  it('низкий средний стат → sad', () => {
    expect(getMood(hatchedPet(cfg, {}, { fullness: 30, happiness: 30, energy: 30, cleanliness: 30 }), cfg)).toBe('sad')
  })
})

describe('averageStats', () => {
  it('считает среднее по четырём статам', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, {}, { fullness: 100, happiness: 0, energy: 50, cleanliness: 50 })
    expect(averageStats(pet)).toBe(50)
  })
})

describe('DEV_CONFIG', () => {
  it('ускоряет игровое время в 60 раз', () => {
    const egg = makePet(DEV_CONFIG, { lastTickAt: 0 })
    const fiveSeconds = 5_000
    // 5 секунд реального времени × 60 = 5 минут игры — ровно eggMs в dev
    expect(egg.stage).toBe('egg')
    expect(fiveSeconds * DEV_CONFIG.timeScale).toBeGreaterThanOrEqual(DEV_CONFIG.evolution.eggMs)
  })
})
