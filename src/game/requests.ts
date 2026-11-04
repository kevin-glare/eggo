import type { GameConfig } from './config'
import type { PetRequest, PetState } from './types'

/**
 * Просьбы питомца: время от времени питомец просит конкретное действие.
 * Закрывшее действие получает двойной эффект (guard'ы и остальное — как всегда).
 * Всё чистое: state → new state.
 *
 * Срок просьбы проверяет только updateRequest (тик клиента раз в секунду):
 * действия доверяют активной просьбе — просрочка даёт льготу меньше секунды.
 * Воркер просьбы не трогает: их окно живёт на клиенте.
 */

/** Порядок приоритета просьб — как в desire(): сытость важнее всего. */
const WANT_ORDER: { key: 'fullness' | 'happiness' | 'cleanliness'; kind: PetRequest['kind'] }[] = [
  { key: 'fullness', kind: 'feed' },
  { key: 'happiness', kind: 'play' },
  { key: 'cleanliness', kind: 'wash' },
]

/** Чего просить: самый низкий стат ниже порога комфорта; всему хватает — просить нечего. */
function wantKind(state: PetState, config: GameConfig): PetRequest['kind'] | null {
  let worst: { kind: PetRequest['kind']; value: number } | null = null
  for (const { key, kind } of WANT_ORDER) {
    const value = state.stats[key]
    if (value >= config.contentThreshold) continue
    if (worst === null || value < worst.value) worst = { kind, value }
  }
  return worst?.kind ?? null
}

/**
 * Появление и просрочка просьб. Вызывается в тике клиента раз в секунду
 * и при загрузке сейва — до любого действия игрока.
 */
export function updateRequest(state: PetState, config: GameConfig, now: number): PetState {
  if (state.stage === 'egg') return state
  if (state.request === null) {
    // спящий не просит; попросит после пробуждения, если пауза уже вышла
    if (state.sleeping || now < state.nextRequestAt) return state
    const kind = wantKind(state, config)
    if (kind === null) return state
    return { ...state, request: { kind, expiresAt: now + config.requests.windowMs } }
  }
  if (now < state.request.expiresAt) return state
  // окно прошло: просьба снята, до следующей — пауза
  return { ...state, request: null, nextRequestAt: now + config.requests.cooldownMs }
}
