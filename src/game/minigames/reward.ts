import type { GameConfig } from '../config'
import type { PetState } from '../types'
import type { MinigameId } from './types'

/**
 * Награда мини-игр. База — обычный play() (радость, усталость, просьба ×2,
 * квест) — его применяет usePet после партии. Здесь только добавка:
 * бонус к счастью за победу и запись рекорда.
 */

/** Бонус к счастью за партию: за победу плюс за новый рекорд. */
export function minigameBonus(won: boolean, isRecord: boolean, config: GameConfig): number {
  if (!won) return 0
  return config.minigames.reward.winBonus + (isRecord ? config.minigames.reward.recordBonus : 0)
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
 * максимуму (mergeStates), поэтому рекорд не теряется.
 */
export function recordMinigameScore(
  state: PetState,
  id: MinigameId,
  score: number,
): { state: PetState; isRecord: boolean } {
  const best = state.minigameBest[id]
  const isRecord = score > 0 && score > (best ?? 0)
  if (!isRecord) return { state, isRecord: false }
  return {
    state: { ...state, minigameBest: { ...state.minigameBest, [id]: score } },
    isRecord: true,
  }
}
