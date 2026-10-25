import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, DEV_CONFIG } from '../src/game/config'
import { tick } from '../src/game/engine'
import { catchUp, deserialize, serialize } from '../src/game/storage'
import { DAY, HOUR, hatchedPet, makePet } from './helpers'

describe('serialize / deserialize', () => {
  it('roundtrip восстанавливает состояние без потерь', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { sick: true, neglectMs: 123_000 })
    const restored = deserialize(serialize(pet))
    expect(restored).toEqual(pet)
  })

  it('битая строка → null', () => {
    expect(deserialize('не json')).toBeNull()
  })

  it('несовместимая версия → null', () => {
    expect(deserialize(JSON.stringify({ version: 99, pet: {} }))).toBeNull()
  })
})

describe('catchUp — оффлайн-время', () => {
  it('досчитывает затухание за время отсутствия', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 0 })
    const now = 2 * HOUR
    const result = catchUp(pet, now, DEFAULT_CONFIG)
    // 2 часа без заботы: сравнимаем с двумя тиками по часу
    const expected = tick(tick(pet, HOUR, DEFAULT_CONFIG), HOUR, DEFAULT_CONFIG)
    expect(result.stats).toEqual(expected.stats)
    expect(result.ageMs).toBe(expected.ageMs)
    expect(result.lastTickAt).toBe(now)
  })

  it('яйцо вылупляется за время отсутствия (с учётом timeScale)', () => {
    const egg = makePet(DEV_CONFIG, { lastTickAt: 0 })
    // 10 секунд реала × 60 = 10 минут игры = eggMs в DEV_CONFIG
    const result = catchUp(egg, 10_000, DEV_CONFIG)
    expect(result.stage).toBe('baby')
  })

  it('не считает больше maxOfflineMs', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 0 })
    const result = catchUp(pet, 10 * DAY, DEFAULT_CONFIG)
    expect(result.ageMs).toBe(pet.ageMs + DEFAULT_CONFIG.maxOfflineMs)
  })

  it('нулевой интервал не меняет состояние', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 1_000 })
    const result = catchUp(pet, 1_000, DEFAULT_CONFIG)
    expect(result).toEqual(pet)
  })
})
