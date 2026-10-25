import { describe, expect, it } from 'vitest'
import {
  ARM_KINDS,
  BODY_SHAPES,
  EAR_KINDS,
  EYE_KINDS,
  LEG_KINDS,
  NOSE_KINDS,
  PALETTE_KINDS,
  SPOT_KINDS,
  normalizeAppearance,
  rollAppearance,
  type PetAppearance,
} from '../src/game/appearance'

describe('rollAppearance', () => {
  it('каждый «ген» берётся из своего каталога', () => {
    const look = rollAppearance(Math.random)
    expect(BODY_SHAPES).toContain(look.body)
    expect(EAR_KINDS).toContain(look.ears)
    expect(EYE_KINDS).toContain(look.eyes)
    expect(NOSE_KINDS).toContain(look.nose)
    expect(ARM_KINDS).toContain(look.arms)
    expect(LEG_KINDS).toContain(look.legs)
    expect(PALETTE_KINDS).toContain(look.palette)
    expect(SPOT_KINDS).toContain(look.spots)
  })

  it('одинаковая случайность → одинаковая внешность', () => {
    const first = rollAppearance(() => 0.42)
    const second = rollAppearance(() => 0.42)
    expect(second).toEqual(first)
  })

  it('края диапазона: rand 0 → первые варианты, почти 1 → последние', () => {
    expect(rollAppearance(() => 0)).toEqual({
      body: 'round',
      ears: 'round',
      eyes: 'big',
      nose: 'oval',
      arms: 'none',
      legs: 'round',
      palette: 'sunny',
      spots: 'none',
    })
    expect(rollAppearance(() => 0.9999)).toEqual({
      body: 'tall',
      ears: 'tuft',
      eyes: 'wide',
      nose: 'none',
      arms: 'long',
      legs: 'tiny',
      palette: 'kiwi',
      spots: 'socks',
    })
  })

  it('rand() = 1 не выпадает из каталога', () => {
    const look = rollAppearance(() => 1)
    expect(PALETTE_KINDS).toContain(look.palette)
    expect(LEG_KINDS).toContain(look.legs)
    expect(SPOT_KINDS).toContain(look.spots)
  })

  it('при долгом броске выпадают все варианты каждого гена', () => {
    // детерминированный линейный конгруэнтный рандом — тест стабилен
    let seed = 1
    const lcg = () => {
      seed = (seed * 48271) % 2147483647
      return seed / 2147483647
    }
    const seen: Record<keyof PetAppearance, Set<string>> = {
      body: new Set(),
      ears: new Set(),
      eyes: new Set(),
      nose: new Set(),
      arms: new Set(),
      legs: new Set(),
      palette: new Set(),
      spots: new Set(),
    }
    for (let i = 0; i < 900; i++) {
      const look = rollAppearance(lcg)
      seen.body.add(look.body)
      seen.ears.add(look.ears)
      seen.eyes.add(look.eyes)
      seen.nose.add(look.nose)
      seen.arms.add(look.arms)
      seen.legs.add(look.legs)
      seen.palette.add(look.palette)
      seen.spots.add(look.spots)
    }
    expect(seen.body.size).toBe(BODY_SHAPES.length)
    expect(seen.ears.size).toBe(EAR_KINDS.length)
    expect(seen.eyes.size).toBe(EYE_KINDS.length)
    expect(seen.nose.size).toBe(NOSE_KINDS.length)
    expect(seen.arms.size).toBe(ARM_KINDS.length)
    expect(seen.legs.size).toBe(LEG_KINDS.length)
    expect(seen.palette.size).toBe(PALETTE_KINDS.length)
    expect(seen.spots.size).toBe(SPOT_KINDS.length)
  })
})

describe('normalizeAppearance', () => {
  it('валидная внешность проходит насквозь', () => {
    const look = rollAppearance(() => 0.5)
    expect(normalizeAppearance(look)).toEqual(look)
  })

  it('старый сейв без пятнышек → spots: none, остальное сохранено', () => {
    const look = rollAppearance(() => 0.5)
    const { spots, ...legacy } = look
    expect(spots).toBeDefined()
    expect(normalizeAppearance(legacy)).toEqual({ ...look, spots: 'none' })
  })

  it('отвергает мусор: не объект, отсутствие гена, чужое значение', () => {
    expect(normalizeAppearance(null)).toBeNull()
    expect(normalizeAppearance('sunny')).toBeNull()
    const look = rollAppearance(() => 0.3)
    expect(normalizeAppearance({ ...look, body: 'мусор' })).toBeNull()
    const { ears, ...withoutEars } = look
    expect(ears).toBeDefined()
    expect(normalizeAppearance(withoutEars)).toBeNull()
  })
})
