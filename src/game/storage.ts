import type { GameConfig } from './config'
import { tick } from './engine'
import type { PetState } from './types'

const SAVE_VERSION = 1

interface SaveData {
  version: number
  pet: PetState
}

export function serialize(state: PetState): string {
  return JSON.stringify({ version: SAVE_VERSION, pet: state } satisfies SaveData)
}

/** Битые и несовместимые сейвы отбрасываются — игра начнётся заново. */
export function deserialize(raw: string): PetState | null {
  try {
    const data = JSON.parse(raw) as Partial<SaveData>
    if (data?.version !== SAVE_VERSION) return null
    const pet = data.pet
    if (!pet || typeof pet !== 'object') return null
    if (typeof pet.ageMs !== 'number' || typeof pet.stage !== 'string' || typeof pet.stats !== 'object') return null
    // сейвы до появления имён — просто ещё не названный питомец
    return { ...pet, name: typeof pet.name === 'string' ? pet.name : null }
  } catch {
    return null
  }
}

/**
 * Адаптер фактического хранилища: localStorage в браузере,
 * Telegram CloudStorage в мини-аппе. Ядро про хранилища не знает.
 */
export interface PetStorage {
  load(): string | null
  save(raw: string): void
}

/**
 * Досчитать всё время, пока приложение было закрыто: от lastTickAt до now.
 * Реальный интервал переводится в игровой через timeScale и применяется
 * кусками по catchUpChunkMs — так корректно проходят смена стадии и пороги.
 */
export function catchUp(state: PetState, nowMs: number, config: GameConfig): PetState {
  const realGap = Math.min(Math.max(0, nowMs - state.lastTickAt), config.maxOfflineMs)
  const gameGap = realGap * config.timeScale

  let next = state
  let remaining = gameGap
  while (remaining > 0) {
    const chunk = Math.min(remaining, config.catchUpChunkMs)
    next = tick(next, chunk, config)
    remaining -= chunk
  }
  return { ...next, lastTickAt: nowMs }
}
