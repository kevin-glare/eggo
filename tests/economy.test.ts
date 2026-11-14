import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/game/config'
import { earnStars } from '../src/game/economy'
import { hatchedPet } from './helpers'

describe('earnStars', () => {
  it('начисляет звёздочки', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { stars: 10 })
    expect(earnStars(pet, 5).stars).toBe(15)
  })

  it('отрицательная и нулевая сумма — ничего, дробная округляется вниз', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { stars: 10 })
    expect(earnStars(pet, -3).stars).toBe(10)
    expect(earnStars(pet, 0).stars).toBe(10)
    expect(earnStars(pet, 2.9).stars).toBe(12)
  })

  it('нулевое начисление возвращает тот же объект', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { stars: 1 })
    expect(earnStars(pet, 0)).toBe(pet)
  })

  it('не мутирует исходное состояние', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { stars: 1 })
    earnStars(pet, 4)
    expect(pet.stars).toBe(1)
  })
})
