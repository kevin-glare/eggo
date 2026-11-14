import type { GameConfig } from './config'
import { earnStars } from './economy'
import type { PetState } from './types'

/**
 * Рефералка: друг открывает Eggo по ссылке игрока (startapp=ref_<id>) →
 * питомцу звезда дружбы и звёздочки в кошелёк. Счётчик приглашённых живёт
 * на сервере и приходит клиенту в ответе /sync; награда выводится из него
 * чистой функцией — идемпотентно, и потеря звёзд при слиянии двух девайсов
 * лечится пересчётом на следующем синке.
 */

export interface ReferralReward {
  state: PetState
  /** сколько звёзд у питомца после пересчёта (0..milestones.length) */
  tier: number
  /** звёздочек начислено за пересечённые пороги (0 — порог не рос) */
  stars: number
}

/** Уровень по счётчику приглашённых: число пересечённых порогов. */
export function referralTier(invited: number, config: GameConfig): number {
  return config.referrals.milestones.filter((m) => invited >= m).length
}

/** Выдать заслуженные звёзды, если их стало больше; иначе состояние без изменений. */
export function applyReferralReward(state: PetState, invited: number, config: GameConfig): ReferralReward {
  const tier = referralTier(invited, config)
  if (tier <= state.appearance.refMark) return { state, tier: state.appearance.refMark, stars: 0 }
  // все пороги между прежним и новым уровнями: сумма их звёздочек
  const stars = config.referrals.milestones
    .filter((_, i) => i >= state.appearance.refMark && i < tier)
    .reduce((sum, m) => sum + (config.shop.referralStars[m] ?? 0), 0)
  return {
    state: earnStars({ ...state, appearance: { ...state.appearance, refMark: tier } }, stars),
    tier,
    stars,
  }
}
