/**
 * Реестр праздничных тем оформления. Новая тема = один файл в themes/
 * с функцией draw + одна строка в THEMES. Активность решает
 * getActiveHoliday из game/holidays по окнам из config.ts.
 */
import { DEFAULT_CONFIG } from '../game/config'
import { getActiveHoliday, type HolidayId } from '../game/holidays'
import type { DayPalette } from './dayCycle'
import { drawHalloween } from './themes/halloween'

/** Тема рисует только декор поверх базовой сцены — палитру суток не трогает. */
export interface HolidayTheme {
  id: HolidayId
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number, sky: DayPalette) => void
}

const THEMES: Record<HolidayId, HolidayTheme> = {
  halloween: { id: 'halloween', draw: drawHalloween },
}

/** Отладка и откат без правки кода: VITE_HOLIDAY_THEME=halloween|off. */
function forcedTheme(): HolidayId | 'off' | null {
  const raw: unknown = import.meta.env.VITE_HOLIDAY_THEME
  if (raw === 'off') return 'off'
  if (typeof raw === 'string' && raw in THEMES) return raw as HolidayId
  return null
}

/** Тема на сегодня или null; null — сцена рисуется как обычно. */
export function resolveHolidayTheme(now: Date): HolidayTheme | null {
  const forced = forcedTheme()
  const id = forced === 'off' ? null : (forced ?? getActiveHoliday(DEFAULT_CONFIG.holidays, now))
  return id ? THEMES[id] : null
}
