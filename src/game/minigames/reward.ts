import type { GameConfig } from '../config'
import { earnStars } from '../economy'
import type { PetState } from '../types'
import type { MinigameId } from './types'

/**
 * Награда мини-игр. База — обычный play() (радость, усталость, просьба ×2,
 * квест) — его применяет usePet после партии. Здесь только добавка:
 * бонус к счастью за победу, звёздочки за саму партию и за рекорд.
 */

/** Бонус к счастью за партию: за новый рекорд; в игре дня — двойной. */
export function minigameBonus(isRecord: boolean, isDayGame: boolean, config: GameConfig): number {
  if (!isRecord) return 0
  const base = config.minigames.reward.recordBonus
  return isDayGame ? base * config.minigames.reward.dailyMultiplier : base
}

/** Прибавить бонус к счастью с обрезкой 0..100. */
export function applyMinigameBonus(state: PetState, bonus: number): PetState {
  if (bonus <= 0) return state
  return {
    ...state,
    stats: { ...state.stats, happiness: Math.min(100, Math.max(0, state.stats.happiness + bonus)) },
  }
}

/**
 * Записать счёт партии. Рекорд — строго больше прежнего (и больше нуля):
 * счёт 0 не должен занимать место в сейве. Слияние между девайсами — по
 * максимуму (mergeStates), поэтому рекорд не теряется. Новый рекорд —
 * звёздочки в кошелёк (config.shop.recordStars).
 */
export function recordMinigameScore(
  state: PetState,
  id: MinigameId,
  score: number,
  config: GameConfig,
): { state: PetState; isRecord: boolean; stars: number } {
  const best = state.minigameBest[id]
  const isRecord = score > 0 && score > (best ?? 0)
  if (!isRecord) return { state, isRecord: false, stars: 0 }
  return {
    state: earnStars({ ...state, minigameBest: { ...state.minigameBest, [id]: score } }, config.shop.recordStars),
    isRecord: true,
    stars: config.shop.recordStars,
  }
}

/**
 * За саму доигранную партию — звёздочки в кошелёк, без условий
 * (config.shop.playStars). Выход посреди партии сюда не доходит:
 * награду применяет usePet только на финише.
 */
export function earnPartyStars(state: PetState, config: GameConfig): PetState {
  return earnStars(state, config.shop.playStars)
}
