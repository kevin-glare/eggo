import type { GameConfig } from './config'
import { dayKey } from './quests'
import type { PetState } from './types'

/**
 * Серия дней («стрик») и приветствие после долгого отсутствия.
 * Активность — любое игровое действие; в день серия засчитывается один раз.
 * Всё чистое: state → new state, без мутаций.
 */

export interface StreakResult {
  state: PetState
  /** серия продлилась или началась сегодня (первая активность дня) */
  extended: boolean
  /** достигнут порог серии — повод для праздника */
  milestone: number | null
}

/**
 * Отметить активность дня: вчера — серия растёт, был перерыв — начинается
 * с 1, тот же день — состояние возвращается как есть.
 */
export function touchStreak(state: PetState, config: GameConfig, now: number): StreakResult {
  const today = dayKey(now)
  if (state.lastVisitDayKey === today) return { state, extended: false, milestone: null }
  const yesterday = dayKey(now - 24 * 3_600_000)
  const days = state.lastVisitDayKey === yesterday ? state.streakDays + 1 : 1
  const milestone = config.streak.milestones.includes(days) ? days : null
  return { state: { ...state, streakDays: days, lastVisitDayKey: today }, extended: true, milestone }
}

/** Долго ли не виделись: порог — как у пушей «скучаем» (missYouAfterMs). */
export function missYou(state: PetState, config: GameConfig, now: number): boolean {
  return now - state.lastTickAt >= config.notifications.missYouAfterMs
}
