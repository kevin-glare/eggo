import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, HOUR } from '../src/game/config'
import { isQuietHour, pendingNotifications, userLocalHour, type SentNotifications } from '../src/game/notifications'
import { hatchedPet, makePet } from './helpers'

const config = DEFAULT_CONFIG
const NOW = 100 * HOUR // произвольная точка «сейчас»
const DAY_HOUR = 14 // день: тихие часы не вмешиваются в старые сценарии

/** Отметка «взросление уже поздравляли» — воркер ставит её при включении пушей. */
const GROWN_SEEN: SentNotifications = { 'grown:baby': 1 }

describe('pendingNotifications — «питомец в беде»', () => {
  it('критическая шкала → пуш с причиной', () => {
    const pet = hatchedPet(config, {}, { fullness: 20 })
    const list = pendingNotifications(pet, NOW, config, NOW - HOUR, {}, DAY_HOUR)
    expect(list[0]?.kind).toBe('critical')
    expect(list[0]?.text).toContain('голодает')
  })

  it('болезнь упомянута в тексте даже при низких шкалах', () => {
    const pet = hatchedPet(config, { sick: true }, { fullness: 20 })
    const list = pendingNotifications(pet, NOW, config, NOW - HOUR, {}, DAY_HOUR)
    expect(list[0]?.kind).toBe('critical')
    expect(list[0]?.text).toContain('заболел')
  })

  it('все шкалы в порядке → уведомлений нет', () => {
    const pet = hatchedPet(config)
    expect(pendingNotifications(pet, NOW, config, NOW - HOUR, GROWN_SEEN, DAY_HOUR)).toEqual([])
  })

  it('кулдаун 6 часов: раньше молчим, позже повторяем', () => {
    const pet = hatchedPet(config, {}, { fullness: 20 })
    const recently: SentNotifications = { ...GROWN_SEEN, critical: NOW - 5 * HOUR }
    expect(pendingNotifications(pet, NOW, config, NOW - HOUR, recently, DAY_HOUR)).toEqual([])
    const longAgo: SentNotifications = { ...GROWN_SEEN, critical: NOW - 7 * HOUR }
    expect(pendingNotifications(pet, NOW, config, NOW - HOUR, longAgo, DAY_HOUR)[0]?.kind).toBe('critical')
  })
})

describe('pendingNotifications — «взросление»', () => {
  it('стадия без отметки → поздравление с названием стадии', () => {
    const pet = hatchedPet(config, { stage: 'teen' })
    const first = pendingNotifications(pet, NOW, config, NOW - HOUR, {}, DAY_HOUR)
    expect(first[0]?.kind).toBe('grown:teen')
    expect(first[0]?.text).toContain('подросток')
  })

  it('отметка о стадии стоит навсегда — повторов нет', () => {
    const pet = hatchedPet(config, { stage: 'teen' })
    const sent: SentNotifications = { 'grown:teen': NOW - 100 * HOUR }
    expect(pendingNotifications(pet, NOW, config, NOW - HOUR, sent, DAY_HOUR)).toEqual([])
  })

  it('яйцо не поздравляем', () => {
    const egg = makePet(config)
    expect(pendingNotifications(egg, NOW, config, NOW - HOUR, {}, DAY_HOUR)).toEqual([])
  })
})

describe('pendingNotifications — «скучаем»', () => {
  it('игрока не видно больше суток → пуш', () => {
    const pet = hatchedPet(config)
    const list = pendingNotifications(pet, NOW, config, NOW - 25 * HOUR, GROWN_SEEN, DAY_HOUR)
    expect(list[0]?.kind).toBe('missYou')
    expect(list[0]?.text).toContain('скучает')
  })

  it('меньше суток → молчим', () => {
    const pet = hatchedPet(config)
    expect(pendingNotifications(pet, NOW, config, NOW - 23 * HOUR, GROWN_SEEN, DAY_HOUR)).toEqual([])
  })

  it('повтор не чаще раза в сутки', () => {
    const pet = hatchedPet(config)
    expect(pendingNotifications(pet, NOW, config, NOW - 30 * HOUR, { ...GROWN_SEEN, missYou: NOW - 23 * HOUR }, DAY_HOUR)).toEqual([])
    expect(pendingNotifications(pet, NOW, config, NOW - 30 * HOUR, { ...GROWN_SEEN, missYou: NOW - 25 * HOUR }, DAY_HOUR)[0]?.kind).toBe('missYou')
  })
})

describe('pendingNotifications — приоритеты и имя', () => {
  it('беда важнее взросления, взросление важнее «скучаем»', () => {
    const pet = hatchedPet(config, { stage: 'adult' }, { fullness: 10 })
    const kinds = pendingNotifications(pet, NOW, config, NOW - 30 * HOUR, {}, DAY_HOUR).map((n) => n.kind)
    expect(kinds).toEqual(['critical', 'grown:adult', 'missYou'])
  })

  it('безымянному питомцу пишем «Питомец»', () => {
    const pet = hatchedPet(config, { name: null }, { fullness: 10 })
    expect(pendingNotifications(pet, NOW, config, NOW - HOUR, {}, DAY_HOUR)[0]?.text).toContain('Питомец')
  })
})

describe('тихие часы — не будим игрока (окно 22–9)', () => {
  it('окно переходит через полночь: 21 ещё день, 22–8 ночь, 9 уже утро', () => {
    expect(isQuietHour(21, config)).toBe(false)
    for (const hour of [22, 23, 0, 3, 8]) expect(isQuietHour(hour, config)).toBe(true)
    expect(isQuietHour(9, config)).toBe(false)
  })

  it('окно без перехода через полночь работает как обычный интервал', () => {
    const lateNight = { ...config, notifications: { ...config.notifications, quietHours: { from: 1, to: 6 } } }
    expect(isQuietHour(2, lateNight)).toBe(true)
    expect(isQuietHour(6, lateNight)).toBe(false)
    expect(isQuietHour(23, lateNight)).toBe(false)
  })

  it('ночью «в беде» уходит молча, взросление и «скучаем» придерживаются до утра', () => {
    const pet = hatchedPet(config, { stage: 'adult' }, { fullness: 10 })
    const list = pendingNotifications(pet, NOW, config, NOW - 30 * HOUR, {}, 3)
    const byKind = Object.fromEntries(list.map((n) => [n.kind, n.delivery]))
    expect(byKind['critical']).toBe('silent')
    expect(byKind['grown:adult']).toBe('hold')
    expect(byKind['missYou']).toBe('hold')
  })

  it('днём всё уходит громко', () => {
    const pet = hatchedPet(config, { stage: 'adult' }, { fullness: 10 })
    const list = pendingNotifications(pet, NOW, config, NOW - 30 * HOUR, {}, DAY_HOUR)
    expect(list.map((n) => n.delivery)).toEqual(['now', 'now', 'now'])
  })

  it('userLocalHour: смещение к востоку от UTC, через полночь заворачивает', () => {
    const tenUtc = 10 * HOUR // 10:00 UTC
    expect(userLocalHour(tenUtc, 0)).toBe(10)
    expect(userLocalHour(tenUtc, 180)).toBe(13) // Москва
    expect(userLocalHour(tenUtc, -300)).toBe(5) // Нью-Йорк (UTC−5)
    expect(userLocalHour(23 * HOUR, 180)).toBe(2) // 23:00 UTC + 3 часа
  })
})
