import type { GameConfig } from './config'
import { REF_MARK_CAP } from './appearance'
import { earnStars } from './economy'
import type { PetState } from './types'

/**
 * Рефералка: друг открывает Eggo по ссылке игрока (startapp=ref_<id>) →
 * питомцу звезда дружбы на боку и звёздочки в кошелёк за каждого друга
 * (config.shop.referralStarsPerFriend). Счётчик приглашённых живёт
 * на сервере и приходит клиенту в ответе /sync; оплаченные друзья отмечены
 * в refMark — награда выводится из них чистой функцией, идемпотентно,
 * и потеря звёзд при слиянии двух девайсов лечится пересчётом на синке.
 */

export interface ReferralReward {
  state: PetState
  /** звёзд дружбы у питомца после пересчёта (= оплаченных друзей) */
  friends: number
  /** звёздочек начислено за новых друзей (0 — новых нет) */
  stars: number
}

/** Выдать заслуженное, если друзей стало больше оплаченных; иначе — без изменений. */
export function applyReferralReward(state: PetState, invited: number, config: GameConfig): ReferralReward {
  const paid = state.appearance.refMark
  // счётчик пишется под тем же потолком, что и clamp сейва: иначе после
  // каждого чтения refMark «отставал» бы и награда платилась заново
  const count = Math.min(invited, REF_MARK_CAP)
  if (count <= paid) return { state, friends: paid, stars: 0 }
  const stars = (count - paid) * config.shop.referralStarsPerFriend
  return {
    state: earnStars({ ...state, appearance: { ...state.appearance, refMark: count } }, stars),
    friends: count,
    stars,
  }
}
