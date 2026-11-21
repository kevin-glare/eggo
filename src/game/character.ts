import type { GameConfig } from './config'
import type { PetState } from './types'

/**
 * Характер питомца: черты растут от стиля заботы. Кормил блюдами из магазина —
 * растёт Сладкоежка, доигрывал мини-игры — Непоседа, гладил — Неженка.
 * Черта не хранится: хранятся только счётчики, уровни выводятся порогами
 * конфига. С уровня bonusAtLevel черта даёт маленький бонус того же стиля
 * заботы. Всё чистое: state → new state, без мутаций.
 */

export type TraitId = 'sweetTooth' | 'playful' | 'affectionate'

/** Счётчики стиля заботы: растут только вверх; слияние девайсов — максимум. */
export interface PetCharacter {
  /** сколько раз кормили купленным блюдом */
  dishesFed: number
  /** сколько партий мини-игр доиграно */
  gamesPlayed: number
  /** сколько раз поглажен */
  petsGiven: number
}

/** Стабильный каталог черт: входит в i18n и профиль меню. */
export const TRAIT_IDS: TraitId[] = ['sweetTooth', 'playful', 'affectionate']

export const EMPTY_CHARACTER: PetCharacter = { dishesFed: 0, gamesPlayed: 0, petsGiven: 0 }

/** Черту растит свой счётчик: Сладкоежка — блюда, Непоседа — партии, Неженка — ласка. */
const COUNTER_OF: Record<TraitId, keyof PetCharacter> = {
  sweetTooth: 'dishesFed',
  playful: 'gamesPlayed',
  affectionate: 'petsGiven',
}

function clampStat(value: number): number {
  return Math.min(100, Math.max(0, value))
}

/** Уровень черты: сколько порогов конфига прошёл счётчик (0..3). */
export function traitLevel(count: number, config: GameConfig): number {
  let level = 0
  for (const t of config.character.thresholds) if (count >= t) level += 1
  return level
}

/** Уровни всех черт — выводятся из счётчиков, в сейве их нет. */
export function characterLevels(state: PetState, config: GameConfig): Record<TraitId, number> {
  return {
    sweetTooth: traitLevel(state.character.dishesFed, config),
    playful: traitLevel(state.character.gamesPlayed, config),
    affectionate: traitLevel(state.character.petsGiven, config),
  }
}

/** Засчитать повтор стиля заботы в счётчик его черты. */
export function countTrait(state: PetState, trait: TraitId): PetState {
  const key = COUNTER_OF[trait]
  return { ...state, character: { ...state.character, [key]: state.character[key] + 1 } }
}

/** Черта раскрыта — уровень от bonusAtLevel и выше: бонус того же стиля заботы. */
export function traitHappinessBonus(
  state: PetState,
  trait: TraitId,
  config: GameConfig,
): number {
  if (traitLevel(state.character[COUNTER_OF[trait]], config) < config.character.bonusAtLevel) return 0
  if (trait === 'sweetTooth') return config.character.dish
  if (trait === 'playful') return config.character.party
  return config.character.pet
}

/** Прибавить бонус счастья с клампом; нулевой бонус — состояние без изменений. */
export function applyTraitHappiness(state: PetState, bonus: number): PetState {
  if (bonus <= 0) return state
  return { ...state, stats: { ...state.stats, happiness: clampStat(state.stats.happiness + bonus) } }
}
