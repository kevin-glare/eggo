import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, DEV_CONFIG } from '../src/game/config'
import { rollAppearance } from '../src/game/appearance'
import { tick } from '../src/game/engine'
import { catchUp, deserialize, mergeRemoteSave, serialize } from '../src/game/storage'
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

  it('внешность без пятнышек (прошлая версия) → пятнышек нет, вид сохранён', () => {
    const look = { ...TEST_APPEARANCE, spots: 'dots' as const }
    const pet = { ...hatchedPet(DEFAULT_CONFIG), appearance: look }
    const data = JSON.parse(serialize(pet)) as { pet: { appearance: Record<string, unknown> } }
    delete data.pet.appearance.spots
    const restored = deserialize(JSON.stringify(data), TEST_APPEARANCE)
    expect(restored?.appearance).toEqual({ ...look, spots: 'none' })
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

describe('mergeRemoteSave — именованные: кто новее; безымянный и пустой локальный уступает серверу', () => {
  it('удалённый новее → побеждает он, время досчитает catchUp', () => {
    const local = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 1_000, name: 'Локал' })
    const remote = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 2_000, name: 'Сервер' })
    expect(mergeRemoteSave(serialize(remote), local, TEST_APPEARANCE)).toEqual(remote)
  })

  it('удалённый старее или тот же момент → локальный без изменений', () => {
    const local = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 2_000, name: 'Локал' })
    const older = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 1_000, name: 'Сервер' })
    expect(mergeRemoteSave(serialize(older), local, TEST_APPEARANCE)).toBe(local)
    expect(mergeRemoteSave(serialize(local), local, TEST_APPEARANCE)).toBe(local)
  })

  it('null и битый удалённый сейв → локальный', () => {
    const local = hatchedPet(DEFAULT_CONFIG)
    expect(mergeRemoteSave(null, local, TEST_APPEARANCE)).toBe(local)
    expect(mergeRemoteSave('мусор', local, TEST_APPEARANCE)).toBe(local)
  })

  it('свежее безымянное яйцо проигрывает именованному питомцу с сервера — даже если оно «новее»', () => {
    const freshEgg = makePet(DEFAULT_CONFIG, { lastTickAt: 9_000, name: null })
    const serverPet = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 1_000, name: 'Настоящий' })
    expect(mergeRemoteSave(serialize(serverPet), freshEgg, TEST_APPEARANCE)).toEqual(serverPet)
  })

  it('локального нет → валидный удалённый становится питомцем (новое устройство)', () => {
    const remote = hatchedPet(DEFAULT_CONFIG, { name: 'Сервер' })
    expect(mergeRemoteSave(serialize(remote), null, TEST_APPEARANCE)).toEqual(remote)
  })

  it('локального нет, удалённый пуст или битый → питомца нет', () => {
    expect(mergeRemoteSave(null, null, TEST_APPEARANCE)).toBeNull()
    expect(mergeRemoteSave('мусор', null, TEST_APPEARANCE)).toBeNull()
  })

  it('удалённый сейв без внешности получает внешность локального', () => {
    const local = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 1_000 })
    const data = JSON.parse(serialize(hatchedPet(DEFAULT_CONFIG, { lastTickAt: 9_000 }))) as {
      pet: Record<string, unknown>
    }
    delete data.pet.appearance
    const merged = mergeRemoteSave(JSON.stringify(data), local, TEST_APPEARANCE)
    expect(merged?.appearance).toEqual(local.appearance)
    expect(merged?.lastTickAt).toBe(9_000)
  })
})
