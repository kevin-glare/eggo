import type { PetState } from './types'

/**
 * Звёздочки — валюта заботы: начисляются за квесты, вехи серии дней,
 * рекорды мини-игр и приглашённых друзей; тратятся в магазине.
 * Начисление — часть события игрока: штамп lastEventAt ставит вызывающий
 * (usePet.apply), слияние девайсов увозит кошелёк вместе с событием.
 */

/** Начислить звёздочки: сумма целая, отрицательная и нулевая — ничего. */
export function earnStars(state: PetState, amount: number): PetState {
  const add = Math.floor(amount)
  if (add <= 0) return state
  return { ...state, stars: state.stars + add }
}
