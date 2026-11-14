import { DAY, type GameConfig } from './config'
import { friendshipLevel } from './friendship'
import { MINIGAME_IDS } from './minigames'
import { FRIENDSHIP_WEEK_MS } from './streak'
import type { PetState } from './types'

/**
 * Достижения: пороги поверх уже существующих полей сейва — никаких новых
 * счётчиков заботы. Список строится из config.achievements, id стабильны
 * (id входят в сейв и словари i18n: `streak-7`, `age-30`, `stars-100`...).
 * Оценка чистая: met() не смотрит ничего, кроме состояния, конфига и now.
 */

export interface Achievement {
  id: string
  /** достигнут ли порог этим состоянием */
  met: (state: PetState, config: GameConfig, now: number) => boolean
}

export function achievementList(config: GameConfig): Achievement[] {
  const a = config.achievements
  return [
    ...a.streakDays.map((d): Achievement => ({ id: `streak-${d}`, met: (s) => s.streakDays >= d })),
    ...a.ageDays.map((d): Achievement => ({ id: `age-${d}`, met: (s) => Math.floor(s.ageMs / DAY) >= d })),
    {
      id: `score-${a.minigameBest}`,
      met: (s) => Object.values(s.minigameBest).some((v) => v >= a.minigameBest),
    },
    { id: 'all-games', met: (s) => MINIGAME_IDS.every((id) => (s.minigameBest[id] ?? 0) > 0) },
    ...a.friendshipWeeks.map(
      (w): Achievement => ({ id: `weeks-${w}`, met: (s, _c, now) => Math.floor((now - s.createdAt) / FRIENDSHIP_WEEK_MS) >= w }),
    ),
    ...a.referralTier.map((t): Achievement => ({ id: `ref-${t}`, met: (s) => s.appearance.refMark >= t })),
    ...a.friendshipLevel.map((l): Achievement => ({ id: `lvl-${l}`, met: (s, c) => friendshipLevel(s.xp, c) >= l })),
    ...a.starsEarned.map((v): Achievement => ({ id: `stars-${v}`, met: (s) => s.stars >= v })),
  ]
}

/** Все открытые этим состоянием достижения — id для сейва и праздника. */
export function evaluateAchievements(state: PetState, config: GameConfig, now: number): string[] {
  return achievementList(config)
    .filter((a) => a.met(state, config, now))
    .map((a) => a.id)
}

/** Полный каталог id — счётчик «N из M» в меню и проверка новых строк i18n. */
export function allAchievementIds(config: GameConfig): string[] {
  return achievementList(config).map((a) => a.id)
}
