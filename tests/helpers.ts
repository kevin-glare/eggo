import type { GameConfig } from '../src/game/config'
import { rollAppearance } from '../src/game/appearance'
import { createPet } from '../src/game/engine'
import type { PetState, Stats } from '../src/game/types'

export const MINUTE = 60_000
export const HOUR = 3_600_000
export const DAY = 24 * HOUR

/** Внешность для тестов: первые варианты каждого каталога (rand → 0). */
export const TEST_APPEARANCE = rollAppearance(() => 0)

/** Собрать питомца с заданными переопределениями — для краевых случаев. */
export function makePet(
  config: GameConfig,
  overrides: Partial<PetState> = {},
  stats: Partial<Stats> = {},
): PetState {
  const base = createPet(0, config, TEST_APPEARANCE)
  // питомцы в тестах по умолчанию названные: без имени жизнь не начинается
  return { ...base, name: 'Тест', ...overrides, stats: { ...base.stats, ...stats } }
}

/** Питомец, уже вылупившийся из яйца (стадия baby). */
export function hatchedPet(config: GameConfig, overrides: Partial<PetState> = {}, stats: Partial<Stats> = {}): PetState {
  return makePet(config, { stage: 'baby', ageMs: config.evolution.eggMs, ...overrides }, stats)
}

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Подписать initData так же, как это делает Telegram — для тестов воркера. */
export async function signInitData(params: Record<string, string>, botToken: string): Promise<string> {
  const dataCheckString = Object.entries(params)
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const hmac = async (key: string | ArrayBuffer, message: string): Promise<ArrayBuffer> => {
    const raw = typeof key === 'string' ? enc.encode(key) : key
    const cryptoKey = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  }
  const secret = await hmac('WebAppData', botToken)
  const hash = toHex(await hmac(secret, dataCheckString))
  return new URLSearchParams({ ...params, hash }).toString()
}
