import { describe, expect, it } from 'vitest'
import { getActiveHoliday, isHolidayActive, type HolidayWindows } from '../src/game/holidays'
import { DEFAULT_CONFIG } from '../src/game/config'

const halloween = { enabled: true, from: [10, 24] as const, to: [11, 2] as const }
const windows: HolidayWindows = { halloween }

describe('isHolidayActive — границы окна включительно', () => {
  it('до окна праздника нет', () => {
    expect(isHolidayActive(halloween, new Date(2026, 9, 23, 12))).toBe(false)
  })

  it('первый и последний день — активны', () => {
    expect(isHolidayActive(halloween, new Date(2026, 9, 24, 0, 1))).toBe(true)
    expect(isHolidayActive(halloween, new Date(2026, 10, 2, 23, 59))).toBe(true)
  })

  it('внутри окна (сам Хэллоуин) — активно', () => {
    expect(isHolidayActive(halloween, new Date(2026, 9, 31, 18))).toBe(true)
  })

  it('после окна праздника нет', () => {
    expect(isHolidayActive(halloween, new Date(2026, 10, 3, 0, 0))).toBe(false)
  })

  it('enabled: false выключает праздник даже внутри окна', () => {
    expect(isHolidayActive({ ...halloween, enabled: false }, new Date(2026, 9, 31, 18))).toBe(false)
  })
})

describe('окно, переходящее через Новый год', () => {
  const newYear = { enabled: true, from: [12, 31] as const, to: [1, 7] as const }

  it('до окна, внутри и после', () => {
    expect(isHolidayActive(newYear, new Date(2026, 11, 30, 12))).toBe(false)
    expect(isHolidayActive(newYear, new Date(2026, 11, 31, 12))).toBe(true)
    expect(isHolidayActive(newYear, new Date(2027, 0, 1, 12))).toBe(true)
    expect(isHolidayActive(newYear, new Date(2027, 0, 7, 12))).toBe(true)
    expect(isHolidayActive(newYear, new Date(2027, 0, 8, 12))).toBe(false)
  })
})

describe('getActiveHoliday — активная тема на дату', () => {
  it('возвращает идентификатор праздника внутри окна', () => {
    expect(getActiveHoliday(windows, new Date(2026, 9, 31, 18))).toBe('halloween')
  })

  it('вне окна темы нет', () => {
    expect(getActiveHoliday(windows, new Date(2026, 6, 15, 12))).toBe(null)
  })

  it('окно Хэллоуина в DEFAULT_CONFIG накрывает 31 октября — страховка «сегодня праздник»', () => {
    expect(getActiveHoliday(DEFAULT_CONFIG.holidays, new Date(2026, 9, 31, 18))).toBe('halloween')
  })
})
