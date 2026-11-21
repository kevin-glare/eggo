import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/game/config'
import { claimEvent, maybeSpawnEvent, SCENE_EVENT_KINDS } from '../src/game/events'
import { deserialize, mergeStates, serialize } from '../src/game/storage'
import type { SceneEventKind } from '../src/game/types'
import { hatchedPet, TEST_APPEARANCE } from './helpers'

const CFG = DEFAULT_CONFIG
const NOW = 1_000_000_000_000

/** Событие на сцене: звёздочка ждёт тапа до NOW + 1000. */
function withEvent(kind: SceneEventKind, expiresAt = NOW + 1_000, stats: Parameters<typeof hatchedPet>[2] = {}) {
  return hatchedPet(CFG, { event: { kind, expiresAt }, nextEventAt: NOW }, stats)
}

describe('maybeSpawnEvent', () => {
  it('в яйце событий не бывает', () => {
    const pet = hatchedPet(CFG, { stage: 'egg', ageMs: 0, nextEventAt: NOW - 1 })
    expect(maybeSpawnEvent(pet, CFG, NOW).event).toBeNull()
  })

  it('спящий ничего не ловит', () => {
    const pet = hatchedPet(CFG, { sleeping: true, nextEventAt: NOW - 1 })
    expect(maybeSpawnEvent(pet, CFG, NOW).event).toBeNull()
  })

  it('пора — событие появляется и живёт expireMs', () => {
    const pet = hatchedPet(CFG, { nextEventAt: NOW - 1 })
    const next = maybeSpawnEvent(pet, CFG, NOW, () => 0)
    expect(next.event?.kind).toBe('star')
    expect(next.event?.expiresAt).toBe(NOW + CFG.events.expireMs)
    expect(next.nextEventAt).toBe(NOW)
  })

  it('вид события выбирается случайностью', () => {
    const pet = hatchedPet(CFG, { nextEventAt: NOW - 1 })
    expect(maybeSpawnEvent(pet, CFG, NOW, () => 0.99).event?.kind).toBe('bubbles')
    expect(maybeSpawnEvent(pet, CFG, NOW, () => 0.5).event?.kind).toBe('butterfly')
  })

  it('пауза не вышла — состояние не меняется', () => {
    const pet = hatchedPet(CFG, { nextEventAt: NOW + 60_000 })
    expect(maybeSpawnEvent(pet, CFG, NOW)).toBe(pet)
  })

  it('активное событие не заменяется новым', () => {
    const pet = withEvent('star')
    const next = maybeSpawnEvent(pet, CFG, NOW, () => 0)
    expect(next.event).toEqual(pet.event)
    expect(next.nextEventAt).toBe(NOW)
  })

  it('просроченное событие исчезает и назначает паузу', () => {
    const pet = withEvent('star', NOW - 1)
    const next = maybeSpawnEvent(pet, CFG, NOW, () => 0)
    expect(next.event).toBeNull()
    expect(next.nextEventAt).toBe(NOW + CFG.events.gapMinMs)
  })
})

describe('claimEvent', () => {
  /** Поймать и вернуть результат; отказ в тесте — ошибка теста. */
  function catchOk(pet: ReturnType<typeof withEvent>, kind: SceneEventKind, rand: () => number = Math.random) {
    const result = claimEvent(pet, kind, CFG, NOW, rand)
    if (!result.ok) throw new Error(`ожидали поимку, отказ: ${result.reason}`)
    return result
  }

  /** Поймать и вернуть причину отказа; неожиданная поимка — ошибка теста. */
  function catchFail(pet: ReturnType<typeof withEvent>, kind: SceneEventKind) {
    const result = claimEvent(pet, kind, CFG, NOW)
    if (result.ok) throw new Error('ожидали отказ, а событие поймалось')
    return result.reason
  }

  it('звёздочка: звёздочка в кошелёк', () => {
    const result = catchOk(withEvent('star'), 'star', () => 0)
    expect(result.reward).toEqual({ kind: 'star', stars: CFG.events.starStars, happiness: 0, cleanliness: 0 })
    expect(result.state.stars).toBe(CFG.events.starStars)
    expect(result.state.event).toBeNull()
    expect(result.state.nextEventAt).toBe(NOW + CFG.events.gapMinMs)
  })

  it('бабочка: счастье прибавляется и не перепрыгивает сотню', () => {
    const half = catchOk(withEvent('butterfly', NOW + 1_000, { happiness: 50 }), 'butterfly')
    expect(half.reward.happiness).toBe(CFG.events.butterflyHappiness)
    expect(half.state.stats.happiness).toBe(53)
    const full = catchOk(withEvent('butterfly', NOW + 1_000, { happiness: 99 }), 'butterfly')
    expect(full.state.stats.happiness).toBe(100)
  })

  it('пузырьки: чистота прибавляется', () => {
    const result = catchOk(withEvent('bubbles', NOW + 1_000, { cleanliness: 40 }), 'bubbles')
    expect(result.reward.cleanliness).toBe(CFG.events.bubblesCleanliness)
    expect(result.state.stats.cleanliness).toBe(40 + CFG.events.bubblesCleanliness)
  })

  it('тап по другому объекту — отказ', () => {
    const pet = withEvent('star')
    expect(catchFail(pet, 'butterfly')).toBe('no-event')
    expect(pet.event).toEqual({ kind: 'star', expiresAt: NOW + 1_000 })
  })

  it('просроченное событие не ловится', () => {
    expect(catchFail(withEvent('star', NOW - 1), 'star')).toBe('no-event')
  })

  it('без события ловить нечего', () => {
    expect(catchFail(hatchedPet(CFG), 'star')).toBe('no-event')
  })

  it('в яйце и во сне не ловится', () => {
    const egg = hatchedPet(CFG, { stage: 'egg', ageMs: 0, event: { kind: 'star', expiresAt: NOW + 1_000 } })
    expect(catchFail(egg, 'star')).toBe('not-hatched')
    const sleeping = { ...withEvent('star'), sleeping: true }
    expect(catchFail(sleeping, 'star')).toBe('sleeping')
  })

  it('виды событий — стабильный каталог', () => {
    expect(SCENE_EVENT_KINDS).toEqual(['star', 'butterfly', 'bubbles'])
  })
})

describe('нормализация событий в сейве', () => {
  it('событие переживает сериализацию', () => {
    const pet = withEvent('butterfly', NOW + 5_000)
    const back = deserialize(serialize(pet), TEST_APPEARANCE)
    expect(back?.event).toEqual({ kind: 'butterfly', expiresAt: NOW + 5_000 })
    expect(back?.nextEventAt).toBe(NOW)
  })

  it('старый сейв без полей — событий нет, таймер в нуле', () => {
    const pet = withEvent('star')
    const raw = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    delete raw.pet.event
    delete raw.pet.nextEventAt
    const back = deserialize(JSON.stringify(raw), TEST_APPEARANCE)
    expect(back?.event).toBeNull()
    expect(back?.nextEventAt).toBe(0)
  })

  it('битый вид события отбрасывается', () => {
    const pet = withEvent('star')
    const raw = JSON.parse(serialize(pet)) as { pet: { event: { kind: string } } }
    raw.pet.event.kind = 'ufo'
    const back = deserialize(JSON.stringify(raw), TEST_APPEARANCE)
    expect(back?.event).toBeNull()
  })
})

describe('слияние девайсов', () => {
  it('активное событие и таймер едут со стороной более свежего события', () => {
    const busy = { ...withEvent('star'), lastEventAt: NOW + 5 } // на этом девайсе событие появилось
    const idle = hatchedPet(CFG, { event: null, nextEventAt: NOW + 100_000 }) // на том — тишина
    const merged = mergeStates(busy, idle, CFG)
    expect(merged.event).toEqual({ kind: 'star', expiresAt: NOW + 1_000 })
    expect(merged.nextEventAt).toBe(NOW)
  })
})
