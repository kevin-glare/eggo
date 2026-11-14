import type { GameConfig } from './config'
import type { PetState } from './types'

/**
 * Уровень дружбы: опыт капает за заботу — действия, партии мини-игр,
 * награда заданий дня. Уровни — по таблице порогов из config.friendship.
 * XP только растёт: слияние девайсов — по максимуму, как возраст.
 */

/** Начислить опыт: сумма целая и положительная, иначе состояние как есть. */
export function addXp(state: PetState, amount: number): PetState {
  const add = Math.floor(amount)
  if (add <= 0) return state
  return { ...state, xp: state.xp + add }
}

/** Уровень дружбы по накопленному опыту: 1 + число пройденных ненулевых порогов. */
export function friendshipLevel(xp: number, config: GameConfig): number {
  return 1 + config.friendship.levels.filter((t) => t > 0 && xp >= t).length
}

/** Опыт до следующего уровня; null — высший уровень достигнут. */
export function xpToNextLevel(xp: number, config: GameConfig): number | null {
  const next = config.friendship.levels.find((t) => t > xp)
  return next === undefined ? null : next - xp
}
