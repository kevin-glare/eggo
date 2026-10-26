import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, HOUR } from '../src/game/config'
import { pendingNotifications, type SentNotifications } from '../src/game/notifications'
import { hatchedPet, makePet } from './helpers'

const config = DEFAULT_CONFIG
const NOW = 100 * HOUR // произвольная точка «сейчас»

/** Отметка «взросление уже поздравляли» — воркер ставит её при включении пушей. */
const GROWN_SEEN: SentNotifications = { 'grown:baby': 1 }

describe('pendingNotifications — «питомец в беде»', () => {
  it('критическая шкала → пуш с причиной', () => {
    const pet = hatchedPet(config, {}, { fullness: 20 })
    const list = pendingNotifications(pet, NOW, config, NOW - HOUR, {})
    expect(list[0]?.kind).toBe('critical')
    expect(list[0]?.text).toContain('голодает')
  })

  it('болезнь упомянута в тексте даже при низких шкалах', () => {
    const pet = hatchedPet(config, { sick: true }, { fullness: 20 })
    const list = pendingNotifications(pet, NOW, config, NOW - HOUR, {})
    expect(list[0]?.kind).toBe('critical')
    expect(list[0]?.text).toContain('заболел')
  })

  it('все шкалы в порядке → уведомлений нет', () => {
    const pet = hatchedPet(config)
    expect(pendingNotifications(pet, NOW, config, NOW - HOUR, GROWN_SEEN)).toEqual([])
  })

  it('кулдаун 6 часов: раньше молчим, позже повторяем', () => {
    const pet = hatchedPet(config, {}, { fullness: 20 })
    const recently: SentNotifications = { ...GROWN_SEEN, critical: NOW - 5 * HOUR }
    expect(pendingNotifications(pet, NOW, config, NOW - HOUR, recently)).toEqual([])
    const longAgo: SentNotifications = { ...GROWN_SEEN, critical: NOW - 7 * HOUR }
    expect(pendingNotifications(pet, NOW, config, NOW - HOUR, longAgo)[0]?.kind).toBe('critical')
  })
})

describe('pendingNotifications — «взросление»', () => {
  it('стадия без отметки → поздравление с названием стадии', () => {
    const pet = hatchedPet(config, { stage: 'teen' })
    const first = pendingNotifications(pet, NOW, config, NOW - HOUR, {})
    expect(first[0]?.kind).toBe('grown:teen')
    expect(first[0]?.text).toContain('подросток')
  })

  it('отметка о стадии стоит навсегда — повторов нет', () => {
    const pet = hatchedPet(config, { stage: 'teen' })
    const sent: SentNotifications = { 'grown:teen': NOW - 100 * HOUR }
    expect(pendingNotifications(pet, NOW, config, NOW - HOUR, sent)).toEqual([])
  })

  it('яйцо не поздравляем', () => {
    const egg = makePet(config)
    expect(pendingNotifications(egg, NOW, config, NOW - HOUR, {})).toEqual([])
  })
})

describe('pendingNotifications — «скучаем»', () => {
  it('игрока не видно больше суток → пуш', () => {
    const pet = hatchedPet(config)
    const list = pendingNotifications(pet, NOW, config, NOW - 25 * HOUR, GROWN_SEEN)
    expect(list[0]?.kind).toBe('missYou')
    expect(list[0]?.text).toContain('скучает')
  })

  it('меньше суток → молчим', () => {
    const pet = hatchedPet(config)
    expect(pendingNotifications(pet, NOW, config, NOW - 23 * HOUR, GROWN_SEEN)).toEqual([])
  })

  it('повтор не чаще раза в сутки', () => {
    const pet = hatchedPet(config)
    expect(pendingNotifications(pet, NOW, config, NOW - 30 * HOUR, { ...GROWN_SEEN, missYou: NOW - 23 * HOUR })).toEqual([])
    expect(pendingNotifications(pet, NOW, config, NOW - 30 * HOUR, { ...GROWN_SEEN, missYou: NOW - 25 * HOUR })[0]?.kind).toBe('missYou')
  })
})

describe('pendingNotifications — приоритеты и имя', () => {
  it('беда важнее взросления, взросление важнее «скучаем»', () => {
    const pet = hatchedPet(config, { stage: 'adult' }, { fullness: 10 })
    const kinds = pendingNotifications(pet, NOW, config, NOW - 30 * HOUR, {}).map((n) => n.kind)
    expect(kinds).toEqual(['critical', 'grown:adult', 'missYou'])
  })

  it('безымянному питомцу пишем «Питомец»', () => {
    const pet = hatchedPet(config, { name: null }, { fullness: 10 })
    expect(pendingNotifications(pet, NOW, config, NOW - HOUR, {})[0]?.text).toContain('Питомец')
  })
})
