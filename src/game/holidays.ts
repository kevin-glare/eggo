/**
 * Праздничные темы: чистая логика «какая тема активна сегодня».
 * Окна праздников задаются в config.ts (пульт), рисование темы — в src/ui/themes/.
 * Состояние игры не трогает: только оформление.
 */

export type HolidayId = 'halloween'

/** [месяц 1–12, день], обе границы включительно. */
export type MonthDay = readonly [number, number]

export interface HolidayWindow {
  /** мгновенный выключатель темы без правки остального кода */
  enabled: boolean
  from: MonthDay
  to: MonthDay
}

export type HolidayWindows = Record<HolidayId, HolidayWindow>

/** Окно может переходить через Новый год (from больше to): 12-31 → 1-7. */
export function isHolidayActive(holiday: HolidayWindow, now: Date): boolean {
  if (!holiday.enabled) return false
  const key = (now.getMonth() + 1) * 100 + now.getDate()
  const from = holiday.from[0] * 100 + holiday.from[1]
  const to = holiday.to[0] * 100 + holiday.to[1]
  return from <= to ? key >= from && key <= to : key >= from || key <= to
}

/** Активный праздник на дату или null; при пересечении окон побеждает первый по порядку. */
export function getActiveHoliday(windows: HolidayWindows, now: Date): HolidayId | null {
  for (const id of Object.keys(windows) as HolidayId[]) {
    if (isHolidayActive(windows[id]!, now)) return id
  }
  return null
}
