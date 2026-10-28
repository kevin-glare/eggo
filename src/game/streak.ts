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

/** Праздник дружбы — раз в неделю от момента создания. */
export const FRIENDSHIP_WEEK_MS = 7 * 24 * 3_600_000

/**
 * Праздник дружбы: сколько полных недель питомец с хозяином, если сегодня
 * юбилейный день (локальный календарный день недели от createdAt),
 * иначе null. Праздник длится весь день юбилея, но только в этот день.
 */
export function friendshipDay(state: PetState, now: number): number | null {
  const age = now - state.createdAt
  if (age < FRIENDSHIP_WEEK_MS) return null
  const weeks = Math.floor(age / FRIENDSHIP_WEEK_MS)
  const anniversary = state.createdAt + weeks * FRIENDSHIP_WEEK_MS
  return dayKey(now) === dayKey(anniversary) ? weeks : null
}
