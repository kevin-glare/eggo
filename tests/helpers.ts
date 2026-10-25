import type { GameConfig } from '../src/game/config'
import { createPet } from '../src/game/engine'
import type { PetState, Stats } from '../src/game/types'

export const MINUTE = 60_000
export const HOUR = 3_600_000
export const DAY = 24 * HOUR

/** Собрать питомца с заданными переопределениями — для краевых случаев. */
export function makePet(
  config: GameConfig,
  overrides: Partial<PetState> = {},
  stats: Partial<Stats> = {},
): PetState {
  const base = createPet(0, config)
  return { ...base, ...overrides, stats: { ...base.stats, ...stats } }
}

/** Питомец, уже вылупившийся из яйца (стадия baby). */
export function hatchedPet(config: GameConfig, overrides: Partial<PetState> = {}, stats: Partial<Stats> = {}): PetState {
  return makePet(config, { stage: 'baby', ageMs: config.evolution.eggMs, ...overrides }, stats)
}
