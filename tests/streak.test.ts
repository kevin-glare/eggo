import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, type GameConfig } from '../src/game/config'
import { dayKey } from '../src/game/quests'
import { convertStreakStars, missYou, touchStreak } from '../src/game/streak'
import { DAY, HOUR, makePet } from './helpers'

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0)

describe('touchStreak', () => {
  it('первая активность — серия 1 и звёздочка за день', () => {
    const pet = makePet(DEFAULT_CONFIG, { streakDays: 0, lastVisitDayKey: null })
    const result = touchStreak(pet, DEFAULT_CONFIG, NOW)
    expect(result.extended).toBe(true)
    expect(result.days).toBe(1)
    expect(result.milestone).toBeNull()
    expect(result.stars).toBe(DEFAULT_CONFIG.shop.streakDayStars)
    expect(result.state.stars).toBe(pet.stars + DEFAULT_CONFIG.shop.streakDayStars)
    expect(result.state.streakDays).toBe(1)
    expect(result.state.lastVisitDayKey).toBe(dayKey(NOW))
  })

  it('повторные действия в тот же день серию не двигают и не платят', () => {
    const pet = touchStreak(makePet(DEFAULT_CONFIG), DEFAULT_CONFIG, NOW).state
    const again = touchStreak(pet, DEFAULT_CONFIG, NOW + 3 * HOUR)
    expect(again.extended).toBe(false)
    expect(again.milestone).toBeNull()
    expect(again.stars).toBe(0)
    expect(again.state.streakDays).toBe(1)
    expect(again.state).toBe(pet) // состояние даже не пересоздаётся
  })

  it('вчера — серия растёт и платит за каждый день', () => {
    const pet = makePet(DEFAULT_CONFIG, { streakDays: 4, lastVisitDayKey: '2026-10-27' })
    const result = touchStreak(pet, DEFAULT_CONFIG, NOW)
    expect(result.extended).toBe(true)
    expect(result.days).toBe(5)
    expect(result.state.streakDays).toBe(5)
    expect(result.state.stars).toBe(pet.stars + DEFAULT_CONFIG.shop.streakDayStars)
  })

  it('пропустил день — серия сгорает, начинается заново с 1 и платит за день', () => {
    const pet = makePet(DEFAULT_CONFIG, { streakDays: 9, lastVisitDayKey: '2026-10-26' })
    const result = touchStreak(pet, DEFAULT_CONFIG, NOW)
    expect(result.state.streakDays).toBe(1)
    expect(result.stars).toBe(DEFAULT_CONFIG.shop.streakDayStars)
  })

  it('порог серии — день конфетти, звёздочки платятся и без порога', () => {
    let pet = makePet(DEFAULT_CONFIG, { streakDays: 2, lastVisitDayKey: '2026-10-27' })
    const third = touchStreak(pet, DEFAULT_CONFIG, NOW)
    expect(third.milestone).toBe(3)
    expect(third.stars).toBe(DEFAULT_CONFIG.shop.streakDayStars)
    expect(third.state.stars).toBe(pet.stars + DEFAULT_CONFIG.shop.streakDayStars)
    const fourth = touchStreak(third.state, DEFAULT_CONFIG, NOW + DAY)
    expect(fourth.milestone).toBeNull()
    expect(fourth.stars).toBe(DEFAULT_CONFIG.shop.streakDayStars)
    expect(fourth.state.stars).toBe(third.state.stars + DEFAULT_CONFIG.shop.streakDayStars)
    expect(fourth.state.streakDays).toBe(4)
  })

  it('пороги берутся из конфига: 7, 14 и 30 — дни конфетти', () => {
    for (const [before, milestone] of [
      [6, 7],
      [13, 14],
      [29, 30],
    ] as const) {
      const pet = makePet(DEFAULT_CONFIG, { streakDays: before, lastVisitDayKey: '2026-10-27' })
      const result = touchStreak(pet, DEFAULT_CONFIG, NOW)
      expect(result.milestone).toBe(milestone)
    }
  })

  it('ставка за день берётся из конфига', () => {
    const config: GameConfig = { ...DEFAULT_CONFIG, shop: { ...DEFAULT_CONFIG.shop, streakDayStars: 7 } }
    const pet = makePet(config, { streakDays: 4, lastVisitDayKey: '2026-10-27' })
    const result = touchStreak(pet, config, NOW)
    expect(result.stars).toBe(7)
    expect(result.state.stars).toBe(pet.stars + 7)
  })

  it('не мутирует исходное состояние', () => {
    const pet = makePet(DEFAULT_CONFIG, { streakDays: 2, lastVisitDayKey: '2026-10-27' })
    const before = structuredClone(pet)
    touchStreak(pet, DEFAULT_CONFIG, NOW)
    expect(pet).toEqual(before)
  })
})

describe('missYou', () => {
  it('отсутствовал меньше порога — не скучали', () => {
    const pet = makePet(DEFAULT_CONFIG, { lastTickAt: NOW - 12 * HOUR })
    expect(missYou(pet, DEFAULT_CONFIG, NOW)).toBe(false)
  })

  it('отсутствовал дольше missYouAfterMs — скучали', () => {
    const pet = makePet(DEFAULT_CONFIG, { lastTickAt: NOW - 25 * HOUR })
    expect(missYou(pet, DEFAULT_CONFIG, NOW)).toBe(true)
  })

  it('порог берётся из конфига (missYouAfterMs пушей)', () => {
    const pet = makePet(DEFAULT_CONFIG, { lastTickAt: NOW - DEFAULT_CONFIG.notifications.missYouAfterMs - 1 })
    expect(missYou(pet, DEFAULT_CONFIG, NOW)).toBe(true)
  })
})

import { friendshipDay } from '../src/game/streak'

describe('friendshipDay', () => {
  const CREATED = Date.UTC(2026, 9, 21, 12, 0, 0)
  const created = () => makePet(DEFAULT_CONFIG, { createdAt: CREATED })

  it('моложе недели — праздника нет', () => {
    expect(friendshipDay(created(), CREATED + 6 * DAY)).toBeNull()
  })

  it('ровно неделя от создания — первая годовщина', () => {
    expect(friendshipDay(created(), CREATED + 7 * DAY)).toBe(1)
  })

  it('весь календарный день юбилея — праздник', () => {
    // юбилей наступает в 12:00 UTC, вечер того же дня — ещё праздник
    expect(friendshipDay(created(), CREATED + 7 * DAY + 10 * HOUR)).toBe(1)
  })

  it('на следующий день праздник кончился', () => {
    expect(friendshipDay(created(), CREATED + 7 * DAY + DAY)).toBeNull()
  })

  it('две недели — вторая годовщина', () => {
    expect(friendshipDay(created(), CREATED + 14 * DAY)).toBe(2)
  })

  it('не мутирует состояние и не зависит от lastTickAt', () => {
    const pet = makePet(DEFAULT_CONFIG, { createdAt: CREATED, lastTickAt: NOW })
    expect(friendshipDay(pet, CREATED + 7 * DAY)).toBe(1)
  })
})

describe('convertStreakStars — разовая конвертация огоньков стрика', () => {
  it('накопленные дни превращаются в звёздочки 1:1', () => {
    const pet = makePet(DEFAULT_CONFIG, { streakDays: 12, stars: 5 })
    const converted = convertStreakStars(pet)
    expect(converted.stars).toBe(5 + 12)
    expect(converted.streakStarsGiven).toBe(12)
  })

  it('проводится один раз: повторный вызов ничего не меняет', () => {
    const pet = makePet(DEFAULT_CONFIG, { streakDays: 12, stars: 17, streakStarsGiven: 12 })
    expect(convertStreakStars(pet)).toBe(pet)
  })

  it('без стрика конвертировать нечего', () => {
    const pet = makePet(DEFAULT_CONFIG, { streakDays: 0 })
    expect(convertStreakStars(pet)).toBe(pet)
  })

  it('не мутирует исходное состояние', () => {
    const pet = makePet(DEFAULT_CONFIG, { streakDays: 8, stars: 0 })
    convertStreakStars(pet)
    expect(pet.stars).toBe(0)
    expect(pet.streakStarsGiven).toBe(0)
  })
})
