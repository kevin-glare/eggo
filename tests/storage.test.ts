import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, DEV_CONFIG } from '../src/game/config'
import { rollAppearance } from '../src/game/appearance'
import { tick } from '../src/game/engine'
import { catchUp, deserialize, serialize } from '../src/game/storage'
import { DAY, HOUR, TEST_APPEARANCE, hatchedPet, makePet } from './helpers'

describe('serialize / deserialize', () => {
  it('roundtrip восстанавливает состояние без потерь', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { sick: true, neglectMs: 123_000 })
    const restored = deserialize(serialize(pet), TEST_APPEARANCE)
    expect(restored).toEqual(pet)
  })

  it('битая строка → null', () => {
    expect(deserialize('не json', TEST_APPEARANCE)).toBeNull()
  })

  it('несовместимая версия → null', () => {
    expect(deserialize(JSON.stringify({ version: 99, pet: {} }), TEST_APPEARANCE)).toBeNull()
  })

  it('старый сейв без имени → name: null', () => {
    const pet = hatchedPet(DEFAULT_CONFIG)
    const data = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    delete data.pet.name
    const restored = deserialize(JSON.stringify(data), TEST_APPEARANCE)
    expect(restored?.name).toBeNull()
  })

  it('старый сейв без внешности → запасная внешность', () => {
    const pet = hatchedPet(DEFAULT_CONFIG)
    const data = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    delete data.pet.appearance
    const fallback = rollAppearance(() => 0.7)
    const restored = deserialize(JSON.stringify(data), fallback)
    expect(restored?.appearance).toEqual(fallback)
  })

  it('битая внешность в сейве → запасная внешность', () => {
    const pet = hatchedPet(DEFAULT_CONFIG)
    const data = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    data.pet.appearance = { body: 'мусор', palette: 5 }
    const restored = deserialize(JSON.stringify(data), TEST_APPEARANCE)
    expect(restored?.appearance).toEqual(TEST_APPEARANCE)
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
    // 5 секунд реала × 60 = 5 минут игры = eggMs в DEV_CONFIG
    const result = catchUp(egg, 5_000, DEV_CONFIG)
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
