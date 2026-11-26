import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, DEV_CONFIG } from '../src/game/config'
import { rollAppearance } from '../src/game/appearance'
import { tick } from '../src/game/engine'
import { catchUp, deserialize, mergeRemoteSave, mergeStates, serialize } from '../src/game/storage'
import type { PetCosmetics, PetState } from '../src/game/types'
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

  it('старый сейв без звёздочек → кошелёк пуст', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { stars: 42 })
    const data = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    delete data.pet.stars
    const restored = deserialize(JSON.stringify(data), TEST_APPEARANCE)
    expect(restored?.stars).toBe(0)
  })

  it('старый сейв без опыта дружбы → xp: 0', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { xp: 320 })
    const data = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    delete data.pet.xp
    const restored = deserialize(JSON.stringify(data), TEST_APPEARANCE)
    expect(restored?.xp).toBe(0)
  })

  it('старый сейв без магазина → блюдо не подано, косметика пуста', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, {
      dish: 'dish-cake',
      cosmetics: { owned: ['x'], accessories: { head: 'x', face: null, neck: null }, decor: { meadow: 'y', sea: null } },
    })
    const data = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    delete data.pet.dish
    delete data.pet.cosmetics
    const restored = deserialize(JSON.stringify(data), TEST_APPEARANCE)
    expect(restored?.dish).toBeNull()
    expect(restored?.cosmetics).toEqual({ owned: [], accessories: { head: null, face: null, neck: null }, decor: { meadow: null, sea: null } })
  })

  it('промежуточный сейв с одним надетым аксессуаром раскладывается по слотам', () => {
    // сейв эпохи «один аксессуар»: activeAccessory вместо accessories
    const legacy = {
      owned: ['acc-glasses', 'acc-bandana'],
      activeAccessory: 'acc-glasses',
      decor: { meadow: null, sea: null },
    }
    const pet = hatchedPet(DEFAULT_CONFIG, { cosmetics: legacy as unknown as PetCosmetics })
    const data = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    const restored = deserialize(JSON.stringify(data), TEST_APPEARANCE)
    expect(restored?.cosmetics.accessories).toEqual({ head: null, face: 'acc-glasses', neck: null })
    // головной аксессуар старого формата едет в голову
    const cap = { ...legacy, activeAccessory: 'acc-cap' }
    const petCap = deserialize(
      JSON.stringify({ version: 1, pet: { ...JSON.parse(serialize(hatchedPet(DEFAULT_CONFIG))).pet, cosmetics: cap } }),
      TEST_APPEARANCE,
    )
    expect(petCap?.cosmetics.accessories.head).toBe('acc-cap')
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
    // уход проверяется раньше капа: раздвигаем afterMs, чтобы остался один кап
    const config = { ...DEFAULT_CONFIG, runaway: { ...DEFAULT_CONFIG.runaway, afterMs: 14 * DAY } }
    const pet = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 0 })
    const result = catchUp(pet, 10 * DAY, config)
    expect(result.ranAwayAt).toBeNull()
    expect(result.ageMs).toBe(pet.ageMs + config.maxOfflineMs)
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

  it('кошелёк звёздочек — событийное поле: траты и начисления со свежего события не затираются', () => {
    const a = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 5 * HOUR, lastEventAt: 5 * HOUR, stars: 12 })
    const b = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 5 * HOUR, lastEventAt: 2 * HOUR, stars: 3 })
    expect(mergeStates(a, b, DEFAULT_CONFIG).stars).toBe(12)
    expect(mergeStates(b, a, DEFAULT_CONFIG).stars).toBe(12)
  })

  it('опыт дружбы — по максимуму: большое XP со старого события не теряется', () => {
    const a = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 5 * HOUR, lastEventAt: 2 * HOUR, xp: 300 })
    const b = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 5 * HOUR, lastEventAt: 5 * HOUR, xp: 50 })
    expect(mergeStates(a, b, DEFAULT_CONFIG).xp).toBe(300)
    expect(mergeStates(b, a, DEFAULT_CONFIG).xp).toBe(300)
  })

  it('косметика: owned объединяется, активные слоты едут со свежим событием', () => {
    const a = hatchedPet(DEFAULT_CONFIG, {
      lastTickAt: 5 * HOUR,
      lastEventAt: 5 * HOUR,
      cosmetics: { owned: ['hat'], accessories: { head: 'hat', face: null, neck: null }, decor: { meadow: 'flower', sea: null } },
    })
    const b = hatchedPet(DEFAULT_CONFIG, {
      lastTickAt: 5 * HOUR,
      lastEventAt: 2 * HOUR,
      cosmetics: { owned: ['flower'], accessories: { head: null, face: null, neck: null }, decor: { meadow: null, sea: null } },
    })
    const merged = mergeStates(a, b, DEFAULT_CONFIG)
    expect(merged.cosmetics.owned).toEqual(['hat', 'flower'])
    // активация — событие: свежая сторона решает, что надето и что на лугу
    expect(merged.cosmetics.accessories.head).toBe('hat')
    expect(merged.cosmetics.decor.meadow).toBe('flower')
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

  it('полная ничья в штампах — событийные поля у первого аргумента (локальный/клиентский сейв)', () => {
    const base = hatchedPet(DEFAULT_CONFIG, { lastTickAt: HOUR, lastEventAt: HOUR })
    const local = { ...base, sleeping: true }
    const remote = { ...base, sleeping: false }
    // клиентское правило: то, что игрок делал на этом устройстве, не отдаётся серверу
    expect(mergeStates(local, remote, DEFAULT_CONFIG).sleeping).toBe(true)
    // серверное (аргументы те же, порядок клиент-сервер): ничья за клиентом
    expect(mergeStates(remote, local, DEFAULT_CONFIG).sleeping).toBe(false)
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

  it('ничья в штампах — событийные поля локальные: уложенный спать перед закрытием питомец не «просыпается» от сервера', () => {
    const base = hatchedPet(DEFAULT_CONFIG, { lastTickAt: HOUR, lastEventAt: HOUR }, { fullness: 100 })
    const local = { ...base, sleeping: true }
    const remote = { ...base, sleeping: false }
    const merged = mergeRemoteSave(serialize(remote), local, TEST_APPEARANCE, DEFAULT_CONFIG)
    expect(merged?.sleeping).toBe(true)
    expect(merged?.stats.fullness).toBe(100)
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

describe('уход питомца — неделя без визита', () => {
  const departedOf = (overrides: Partial<PetState> = {}) =>
    catchUp(
      hatchedPet(DEFAULT_CONFIG, { createdAt: 0, lastTickAt: 0, lastEventAt: 0, ...overrides }),
      10 * DAY,
      DEFAULT_CONFIG,
    )

  it('после недели отсутствия питомец уходит в детерминированный момент', () => {
    const departed = departedOf()
    // момент ухода = lastTickAt + afterMs, не момент возврата
    expect(departed.ranAwayAt).toBe(7 * DAY)
    expect(departed.lastTickAt).toBe(7 * DAY)
  })

  it('уход детерминирован: момент не зависит от того, когда вернулись', () => {
    const early = catchUp(hatchedPet(DEFAULT_CONFIG, { lastTickAt: 0 }), 7 * DAY, DEFAULT_CONFIG)
    const late = departedOf()
    expect(early.ranAwayAt).toBe(late.ranAwayAt)
  })

  it('в момент ухода статы заморожены: никакой симуляции распада', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 0, lastEventAt: 0 })
    const departed = departedOf()
    expect(departed.stats).toEqual(pet.stats)
    expect(departed.ageMs).toBe(pet.ageMs)
  })

  it('чуть меньше недели — питомец ещё жив и досчитывается как обычно', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { lastTickAt: 0, lastEventAt: 0 })
    const result = catchUp(pet, 7 * DAY - 1, DEFAULT_CONFIG)
    expect(result.ranAwayAt).toBeNull()
    expect(result.ageMs).toBeGreaterThan(pet.ageMs)
  })

  it('ушедший заморожен: повторный catchUp не меняет статы и момент ухода', () => {
    const departed = departedOf()
    const later = catchUp(departed, 20 * DAY, DEFAULT_CONFIG)
    expect(later.ranAwayAt).toBe(departed.ranAwayAt)
    expect(later.stats).toEqual(departed.stats)
    // шкала для слияния движется вперёд
    expect(later.lastTickAt).toBe(20 * DAY)
  })

  it('безымянное яйцо не уходит', () => {
    const egg = makePet(DEFAULT_CONFIG, { name: null, lastTickAt: 0 })
    expect(catchUp(egg, 30 * DAY, DEFAULT_CONFIG).ranAwayAt).toBeNull()
  })

  it('ушедший переживает serialize / deserialize', () => {
    expect(deserialize(serialize(departedOf()), TEST_APPEARANCE)).toEqual(departedOf())
  })

  it('старый сейв без поля ухода нормализуется: питомец жив', () => {
    const data = JSON.parse(serialize(hatchedPet(DEFAULT_CONFIG, { lastTickAt: 1_000 }))) as {
      pet: Record<string, unknown>
    }
    delete data.pet.ranAwayAt
    expect(deserialize(JSON.stringify(data), TEST_APPEARANCE)?.ranAwayAt).toBeNull()
  })
})

describe('mergeStates с ушедшим питомцем', () => {
  const departed = () =>
    catchUp(
      hatchedPet(DEFAULT_CONFIG, { createdAt: 0, lastTickAt: 0, lastEventAt: 0 }),
      10 * DAY,
      DEFAULT_CONFIG,
    )

  it('новый питомец побеждает ушедшего целиком (после прощания начали заново)', () => {
    const gone = departed()
    const freshEgg = makePet(DEFAULT_CONFIG, {
      createdAt: 10 * DAY,
      lastTickAt: 10 * DAY,
      lastEventAt: 10 * DAY,
      name: null,
    })
    const merged = mergeStates(gone, freshEgg, DEFAULT_CONFIG)
    expect(merged.ranAwayAt).toBeNull()
    expect(merged.createdAt).toBe(10 * DAY)
    expect(mergeStates(freshEgg, gone, DEFAULT_CONFIG)).toEqual(merged)
  })

  it('один питомец: ушедший на одном девайсе уходит и в слиянии со stale-вторым', () => {
    const base = hatchedPet(DEFAULT_CONFIG, { createdAt: 0, lastTickAt: 0, lastEventAt: 0 })
    const gone = catchUp(base, 10 * DAY, DEFAULT_CONFIG)
    const stale = { ...base, lastTickAt: 2 * DAY }
    expect(mergeStates(gone, stale, DEFAULT_CONFIG).ranAwayAt).toBe(7 * DAY)
  })

  it('stale-сторона сама досчитывается до того же ухода: слияние симметрично', () => {
    const base = hatchedPet(DEFAULT_CONFIG, { createdAt: 0, lastTickAt: 0, lastEventAt: 0 })
    const gone = catchUp(base, 10 * DAY, DEFAULT_CONFIG)
    const stale = { ...base, lastTickAt: 0 }
    expect(mergeStates(stale, gone, DEFAULT_CONFIG).ranAwayAt).toBe(7 * DAY)
    expect(mergeStates(gone, stale, DEFAULT_CONFIG).ranAwayAt).toBe(7 * DAY)
  })

  it('другой девайс играл недавно: лежалая сторона (>7 дней) не уносит питомца', () => {
    const base = hatchedPet(DEFAULT_CONFIG, { createdAt: 0, lastTickAt: 0, lastEventAt: 0 })
    // девайс A не открывался 10 дней и уже насчитал уход по своей памяти
    const stale = catchUp(base, 10 * DAY, DEFAULT_CONFIG)
    // девайс B играл на 9-й день: свежее событие доказывает, что питомец жив
    const fresh = { ...base, lastTickAt: 9 * DAY, lastEventAt: 9 * DAY }
    expect(mergeStates(stale, fresh, DEFAULT_CONFIG).ranAwayAt).toBeNull()
    expect(mergeStates(fresh, stale, DEFAULT_CONFIG).ranAwayAt).toBeNull()
  })

  it('оба девайса посчитали уход — слияние остаётся ушедшим', () => {
    const base = hatchedPet(DEFAULT_CONFIG, { createdAt: 0, lastTickAt: 0, lastEventAt: 0 })
    const a = catchUp(base, 10 * DAY, DEFAULT_CONFIG)
    const b = catchUp({ ...base, lastTickAt: DAY, lastEventAt: DAY }, 10 * DAY, DEFAULT_CONFIG)
    expect(mergeStates(a, b, DEFAULT_CONFIG).ranAwayAt).not.toBeNull()
    expect(mergeStates(b, a, DEFAULT_CONFIG).ranAwayAt).not.toBeNull()
  })
})

describe('mergeRemoteSave с ушедшим питомцем', () => {
  const departed = () =>
    catchUp(
      hatchedPet(DEFAULT_CONFIG, { createdAt: 0, lastTickAt: 0, lastEventAt: 0 }),
      10 * DAY,
      DEFAULT_CONFIG,
    )

  it('ушедший удалённый питомец не побеждает новое локальное яйцо', () => {
    const freshEgg = makePet(DEFAULT_CONFIG, {
      createdAt: 10 * DAY,
      lastTickAt: 10 * DAY,
      lastEventAt: 10 * DAY,
      name: null,
    })
    expect(mergeRemoteSave(serialize(departed()), freshEgg, TEST_APPEARANCE, DEFAULT_CONFIG)).toEqual(freshEgg)
  })

  it('локального нет, удалённый ушедший → возвращается ушедший (экран прощания)', () => {
    expect(mergeRemoteSave(serialize(departed()), null, TEST_APPEARANCE, DEFAULT_CONFIG)).toEqual(departed())
  })

  it('локальный ушедший не воскрешается старым безымянным яйцом с сервера', () => {
    const gone = departed()
    const staleEgg = makePet(DEFAULT_CONFIG, { createdAt: 0, lastTickAt: 0, lastEventAt: 0, name: null })
    expect(mergeRemoteSave(serialize(staleEgg), gone, TEST_APPEARANCE, DEFAULT_CONFIG)).toEqual(gone)
  })
})
