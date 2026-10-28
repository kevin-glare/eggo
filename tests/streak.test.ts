import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/game/config'
import { dayKey } from '../src/game/quests'
import { missYou, touchStreak } from '../src/game/streak'
import { DAY, HOUR, makePet } from './helpers'

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0)

describe('touchStreak', () => {
  it('первая активность за долгое время — серия 1, без праздника', () => {
    const pet = makePet(DEFAULT_CONFIG, { streakDays: 0, lastVisitDayKey: null })
    const result = touchStreak(pet, DEFAULT_CONFIG, NOW)
    expect(result.extended).toBe(true)
    expect(result.milestone).toBeNull()
    expect(result.state.streakDays).toBe(1)
    expect(result.state.lastVisitDayKey).toBe(dayKey(NOW))
  })

  it('повторные действия в тот же день серию не двигают', () => {
    const pet = touchStreak(makePet(DEFAULT_CONFIG), DEFAULT_CONFIG, NOW).state
    const again = touchStreak(pet, DEFAULT_CONFIG, NOW + 3 * HOUR)
    expect(again.extended).toBe(false)
    expect(again.milestone).toBeNull()
    expect(again.state.streakDays).toBe(1)
    expect(again.state).toBe(pet) // состояние даже не пересоздаётся
  })

  it('вчера — серия растёт', () => {
    const pet = makePet(DEFAULT_CONFIG, { streakDays: 4, lastVisitDayKey: '2026-10-27' })
    const result = touchStreak(pet, DEFAULT_CONFIG, NOW)
    expect(result.extended).toBe(true)
    expect(result.state.streakDays).toBe(5)
  })

  it('пропустил день — серия сгорает и начинается заново с 1', () => {
    const pet = makePet(DEFAULT_CONFIG, { streakDays: 9, lastVisitDayKey: '2026-10-26' })
    const result = touchStreak(pet, DEFAULT_CONFIG, NOW)
    expect(result.state.streakDays).toBe(1)
  })

  it('порог серии — праздник; следующее продление — уже нет', () => {
    let pet = makePet(DEFAULT_CONFIG, { streakDays: 2, lastVisitDayKey: '2026-10-27' })
    const third = touchStreak(pet, DEFAULT_CONFIG, NOW)
    expect(third.milestone).toBe(3)
    const fourth = touchStreak(third.state, DEFAULT_CONFIG, NOW + DAY)
    expect(fourth.milestone).toBeNull()
    expect(fourth.state.streakDays).toBe(4)
  })

  it('пороги берутся из конфига: 7 и 14 празднуются тоже', () => {
    for (const [before, milestone] of [
      [6, 7],
      [13, 14],
    ] as const) {
      const pet = makePet(DEFAULT_CONFIG, { streakDays: before, lastVisitDayKey: '2026-10-27' })
      const result = touchStreak(pet, DEFAULT_CONFIG, NOW)
      expect(result.milestone).toBe(milestone)
    }
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
