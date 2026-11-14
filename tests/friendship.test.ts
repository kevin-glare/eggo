import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/game/config'
import { addXp, friendshipLevel, xpToNextLevel } from '../src/game/friendship'
import { hatchedPet } from './helpers'

describe('addXp', () => {
  it('начисляет опыт', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { xp: 40 })
    expect(addXp(pet, 5).xp).toBe(45)
  })

  it('отрицательное и нулевое — ничего; дробное округляется вниз', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { xp: 40 })
    expect(addXp(pet, 0).xp).toBe(40)
    expect(addXp(pet, -3).xp).toBe(40)
    expect(addXp(pet, 2.7).xp).toBe(42)
  })

  it('не мутирует исходное состояние', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { xp: 40 })
    addXp(pet, 5)
    expect(pet.xp).toBe(40)
  })
})

describe('friendshipLevel', () => {
  const cfg = DEFAULT_CONFIG

  it('старт — уровень 1', () => {
    expect(friendshipLevel(0, cfg)).toBe(1)
  })

  it('пороги дают уровни; выше высшего не растёт', () => {
    expect(friendshipLevel(99, cfg)).toBe(1)
    expect(friendshipLevel(100, cfg)).toBe(2)
    expect(friendshipLevel(1400, cfg)).toBe(5)
    expect(friendshipLevel(2500, cfg)).toBe(6)
    expect(friendshipLevel(99_999, cfg)).toBe(6)
  })

  it('xpToNextLevel считает остаток; на высшем — null', () => {
    expect(xpToNextLevel(40, cfg)).toBe(60)
    expect(xpToNextLevel(2500, cfg)).toBeNull()
  })
})
