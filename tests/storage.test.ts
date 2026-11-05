import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, DEV_CONFIG } from '../src/game/config'
import { rollAppearance } from '../src/game/appearance'
import { tick } from '../src/game/engine'
import { catchUp, deserialize, mergeRemoteSave, mergeStates, serialize } from '../src/game/storage'
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

  it('старый сейв без daily → daily: null (день начнётся заново)', () => {
    const pet = hatchedPet(DEFAULT_CONFIG)
    const data = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    delete data.pet.daily
    const restored = deserialize(JSON.stringify(data), TEST_APPEARANCE)
    expect(restored?.daily).toBeNull()
  })

  it('старый сейв без просьб → request: null, nextRequestAt: 0', () => {
    const pet = hatchedPet(DEFAULT_CONFIG)
    const data = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    delete data.pet.request
    delete data.pet.nextRequestAt
    const restored = deserialize(JSON.stringify(data), TEST_APPEARANCE)
    expect(restored?.request).toBeNull()
    expect(restored?.nextRequestAt).toBe(0)
  })

  it('битая просьба (неизвестное действие) → null', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { request: { kind: 'feed', expiresAt: 123 } })
    const data = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    data.pet.request = { kind: 'рыба', expiresAt: 123 }
    const restored = deserialize(JSON.stringify(data), TEST_APPEARANCE)
    expect(restored?.request).toBeNull()
  })

  it('битый daily в сейве → null: неизвестные задания и кривой прогресс отбрасываются', () => {
    const pet = hatchedPet(DEFAULT_CONFIG)
    for (const daily of [
      { day: 'не дата', quests: ['feed', 'play', 'wash'], progress: [1, 2, 3], claimed: false },
      { day: '2026-10-28', quests: ['рыба', 'play', 'wash'], progress: [1, 2, 3], claimed: false },
      { day: '2026-10-28', quests: ['feed', 'play'], progress: [1, 2, 3], claimed: false },
      'мусор',
    ]) {
      const data = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
      data.pet.daily = daily
      const restored = deserialize(JSON.stringify(data), TEST_APPEARANCE)
      expect(restored?.daily).toBeNull()
    }
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

  it('старый сейв без lastEventAt → 0: слияние считает его более старым по событиям', () => {
    const pet = hatchedPet(DEFAULT_CONFIG)
    const data = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    delete data.pet.lastEventAt
    const restored = deserialize(JSON.stringify(data), TEST_APPEARANCE)
    expect(restored?.lastEventAt).toBe(0)
  })

  it('старый сейв без рекордов мини-игр → пустая таблица', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { minigameBest: { memory: 42 } })
    const data = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    delete data.pet.minigameBest
    const restored = deserialize(JSON.stringify(data), TEST_APPEARANCE)
    expect(restored?.minigameBest).toEqual({})
  })

  it('битые рекорды мини-игр отбрасываются по одному: неизвестный вид и не-число', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { minigameBest: { memory: 42 } })
    const data = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    data.pet.minigameBest = { memory: 42, рыба: 7, runner: 'мусор', snake: -3 }
    const restored = deserialize(JSON.stringify(data), TEST_APPEARANCE)
    expect(restored?.minigameBest).toEqual({ memory: 42 })
  })

  it('старый сейв без перекорма → overfedUntil: 0', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { overfedUntil: 123 })
    const data = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    delete data.pet.overfedUntil
    const restored = deserialize(JSON.stringify(data), TEST_APPEARANCE)
    expect(restored?.overfedUntil).toBe(0)
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

describe('mergeStates — слияние состояний одного питомца с двух девайсов', () => {
  it('кормление с одного девайса выживает, хотя другой тикал до более позднего момента', () => {
    // общий момент старта: сытость 70
    const base = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 0, lastEventAt: 0 }, { fullness: 70 })
    // девайс A в момент HOUR кормит (→ 100) и закрывается
    const a = { ...base, lastTickAt: HOUR, lastEventAt: HOUR, stats: { ...base.stats, fullness: 100 } }
    // девайс B событий не имел, но тикает до 5×HOUR — по старому правилу
    // lastTickAt он «новее» и затёр бы кормление
    const b = catchUp(base, 5 * HOUR, DEFAULT_CONFIG)
    const merged = mergeStates(a, b, DEFAULT_CONFIG)
    // сытость A досчитана распадом до общей шкалы и не затёрта распавшейся B
    expect(merged.stats.fullness).toBe(catchUp(a, 5 * HOUR, DEFAULT_CONFIG).stats.fullness)
    expect(merged.stats.fullness).toBeGreaterThan(b.stats.fullness)
    expect(merged.lastTickAt).toBe(5 * HOUR)
  })

  it('слияние симметрично: статы не зависят от порядка аргументов', () => {
    const base = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 0, lastEventAt: 0 }, { fullness: 70, happiness: 40 })
    const a = { ...base, lastTickAt: HOUR, lastEventAt: HOUR, stats: { ...base.stats, fullness: 100 } }
    const b = catchUp(base, 3 * HOUR, DEFAULT_CONFIG)
    expect(mergeStates(a, b, DEFAULT_CONFIG).stats).toEqual(mergeStates(b, a, DEFAULT_CONFIG).stats)
  })

  it('событийные поля (сон) берутся у стороны с более свежим событием', () => {
    const a = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 5 * HOUR, lastEventAt: 5 * HOUR, sleeping: true })
    const b = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 5 * HOUR, lastEventAt: 2 * HOUR })
    expect(mergeStates(a, b, DEFAULT_CONFIG).sleeping).toBe(true)
    expect(mergeStates(b, a, DEFAULT_CONFIG).sleeping).toBe(true)
  })

  it('болезнь, досчитанная на одной из сторон, не снимается слиянием задним числом', () => {
    const a = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 9 * HOUR, lastEventAt: 9 * HOUR, sick: false })
    const b = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 9 * HOUR, lastEventAt: HOUR, sick: true, neglectMs: 400_000 })
    expect(mergeStates(a, b, DEFAULT_CONFIG).sick).toBe(true)
    expect(mergeStates(b, a, DEFAULT_CONFIG).sick).toBe(true)
  })

  it('возраст — по максимуму: яйцо с одного девайса не «омолаживает» подросшего питомца', () => {
    const a = makePet(DEFAULT_CONFIG, { lastTickAt: HOUR, lastEventAt: HOUR, ageMs: 100, stage: 'egg' })
    const b = catchUp(hatchedPet(DEFAULT_CONFIG, { lastTickAt: HOUR, lastEventAt: 0 }), 9 * HOUR, DEFAULT_CONFIG)
    const merged = mergeStates(a, b, DEFAULT_CONFIG)
    expect(merged.ageMs).toBe(b.ageMs)
    expect(merged.stage).toBe('baby')
    expect(merged.lastTickAt).toBe(9 * HOUR)
  })

  it('безымянное яйцо, даже «созданное позже», не затирает именованного питомца', () => {
    const named = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 1_500, lastEventAt: HOUR, name: 'Настоящий' })
    const freshEgg = makePet(DEFAULT_CONFIG, {
      lastTickAt: 2_000,
      lastEventAt: 2_000,
      name: null,
      stage: 'egg',
      ageMs: 0,
    })
    for (const [x, y] of [[named, freshEgg], [freshEgg, named]] as const) {
      const merged = mergeStates(x, y, DEFAULT_CONFIG)
      expect(merged.name).toBe('Настоящий')
      expect(merged.stage).toBe('baby')
      expect(merged.lastEventAt).toBe(HOUR)
    }
  })

  it('два безымянных яйца — целиком побеждает более свежее', () => {
    const e1 = makePet(DEFAULT_CONFIG, { lastTickAt: HOUR, lastEventAt: HOUR, name: null })
    const e2 = makePet(DEFAULT_CONFIG, { lastTickAt: 2 * HOUR, lastEventAt: 2 * HOUR, name: null })
    expect(mergeStates(e1, e2, DEFAULT_CONFIG)).toEqual(e2)
    expect(mergeStates(e2, e1, DEFAULT_CONFIG)).toEqual(e2)
  })

  it('рекорды мини-игр сливаются по максимуму с обеих сторон', () => {
    const a = hatchedPet(DEFAULT_CONFIG, { lastTickAt: HOUR, lastEventAt: HOUR, minigameBest: { memory: 70, runner: 5 } })
    const b = hatchedPet(DEFAULT_CONFIG, { lastTickAt: HOUR, lastEventAt: HOUR, minigameBest: { memory: 30, snake: 9 } })
    expect(mergeStates(a, b, DEFAULT_CONFIG).minigameBest).toEqual({ memory: 70, runner: 5, snake: 9 })
    expect(mergeStates(b, a, DEFAULT_CONFIG).minigameBest).toEqual({ memory: 70, runner: 5, snake: 9 })
  })

  it('перерыв после объедения живёт по максимуму: отсиденный на другом девайсе не сокращается', () => {
    const a = hatchedPet(DEFAULT_CONFIG, { lastTickAt: HOUR, lastEventAt: HOUR, overfedUntil: 9 * HOUR })
    const b = hatchedPet(DEFAULT_CONFIG, { lastTickAt: HOUR, lastEventAt: HOUR, overfedUntil: 5 * HOUR })
    expect(mergeStates(a, b, DEFAULT_CONFIG).overfedUntil).toBe(9 * HOUR)
    expect(mergeStates(b, a, DEFAULT_CONFIG).overfedUntil).toBe(9 * HOUR)
  })
})

describe('mergeRemoteSave — обёртка mergeStates над raw-строками', () => {
  it('кормление с другого девайса доезжает до локально живущего питомца', () => {
    const base = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 0, lastEventAt: 0 }, { fullness: 70 })
    const local = catchUp(base, 5 * HOUR, DEFAULT_CONFIG)
    const remote = { ...base, lastTickAt: HOUR, lastEventAt: HOUR, stats: { ...base.stats, fullness: 100 } }
    const merged = mergeRemoteSave(serialize(remote), local, TEST_APPEARANCE, DEFAULT_CONFIG)
    expect(merged?.stats.fullness).toBe(catchUp(remote, 5 * HOUR, DEFAULT_CONFIG).stats.fullness)
    expect(merged?.lastTickAt).toBe(5 * HOUR)
  })

  it('событие локально свежее — событийные поля локальные, но стат сервера выживает', () => {
    const base = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 0, lastEventAt: 0 }, { fullness: 100 })
    const local = {
      ...catchUp(base, 5 * HOUR, DEFAULT_CONFIG),
      lastEventAt: 5 * HOUR,
      sleeping: true,
    }
    const remote = { ...base, lastTickAt: HOUR, lastEventAt: HOUR }
    const merged = mergeRemoteSave(serialize(remote), local, TEST_APPEARANCE, DEFAULT_CONFIG)
    expect(merged?.sleeping).toBe(true)
    // сытость сервера (100, распавшаяся до 5×HOUR) выше локальной за тот же срок
    expect(merged?.stats.fullness).toBe(catchUp(remote, 5 * HOUR, DEFAULT_CONFIG).stats.fullness)
    expect(merged?.stats.fullness).toBeGreaterThan(local.stats.fullness)
  })

  it('null и битый удалённый сейв → локальный', () => {
    const local = hatchedPet(DEFAULT_CONFIG)
    expect(mergeRemoteSave(null, local, TEST_APPEARANCE, DEFAULT_CONFIG)).toBe(local)
    expect(mergeRemoteSave('мусор', local, TEST_APPEARANCE, DEFAULT_CONFIG)).toBe(local)
  })

  it('свежее безымянное яйцо проигрывает именованному питомцу с сервера — даже если оно «новее»', () => {
    const freshEgg = makePet(DEFAULT_CONFIG, { lastTickAt: 9_000, lastEventAt: 9_000, name: null })
    const serverPet = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 1_000, lastEventAt: 1_000, name: 'Настоящий' })
    expect(mergeRemoteSave(serialize(serverPet), freshEgg, TEST_APPEARANCE, DEFAULT_CONFIG)).toEqual(serverPet)
  })

  it('локального нет → валидный удалённый становится питомцем (новое устройство)', () => {
    const remote = hatchedPet(DEFAULT_CONFIG, { name: 'Сервер' })
    expect(mergeRemoteSave(serialize(remote), null, TEST_APPEARANCE, DEFAULT_CONFIG)).toEqual(remote)
  })

  it('локального нет, удалённый пуст или битый → питомца нет', () => {
    expect(mergeRemoteSave(null, null, TEST_APPEARANCE, DEFAULT_CONFIG)).toBeNull()
    expect(mergeRemoteSave('мусор', null, TEST_APPEARANCE, DEFAULT_CONFIG)).toBeNull()
  })

  it('удалённый сейв без внешности получает внешность локального', () => {
    const local = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 1_000 })
    const data = JSON.parse(serialize(hatchedPet(DEFAULT_CONFIG, { lastTickAt: 9_000 }))) as {
      pet: Record<string, unknown>
    }
    delete data.pet.appearance
    const merged = mergeRemoteSave(JSON.stringify(data), local, TEST_APPEARANCE, DEFAULT_CONFIG)
    expect(merged?.appearance).toEqual(local.appearance)
    expect(merged?.lastTickAt).toBe(9_000)
  })
})
