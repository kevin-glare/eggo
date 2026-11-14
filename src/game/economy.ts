import type { GameConfig, ShopItemConfig } from './config'
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

export type BuyReason = 'no-stars' | 'unknown-item' | 'dish-active' | 'already-owned'

export interface BuyResult {
  ok: boolean
  reason?: BuyReason
  state: PetState
}

/** Товар по id из каталога конфига; null — неизвестный id. */
export function itemById(config: GameConfig, id: string): ShopItemConfig | null {
  return config.shop.items.find((it) => it.id === id) ?? null
}

/**
 * Купить товар. Блюдо занимает слот «подано к следующему кормлению» —
 * второй слот не продаём, пока предыдущее не съедено. Косметика —
 * навсегда в owned и сразу активируется (декор в свой слот, аксессуар
 * на питомца); повторная покупка бессмысленна и отклоняется.
 */
export function buyItem(state: PetState, id: string, config: GameConfig): BuyResult {
  const item = itemById(config, id)
  if (!item) return { ok: false, reason: 'unknown-item', state }
  if (item.kind === 'dish') {
    if (state.dish !== null) return { ok: false, reason: 'dish-active', state }
    if (state.stars < item.price) return { ok: false, reason: 'no-stars', state }
    return { ok: true, state: { ...state, stars: state.stars - item.price, dish: id } }
  }
  if (state.cosmetics.owned.includes(id)) return { ok: false, reason: 'already-owned', state }
  if (state.stars < item.price) return { ok: false, reason: 'no-stars', state }
  const cosmetics = { ...state.cosmetics, owned: [...state.cosmetics.owned, id] }
  if (item.kind === 'decor' && item.decorSlot !== undefined) {
    cosmetics.decor = { ...cosmetics.decor, [item.decorSlot]: id }
  }
  if (item.kind === 'accessory' && item.accSlot !== undefined) {
    cosmetics.accessories = { ...cosmetics.accessories, [item.accSlot]: id }
  }
  return { ok: true, state: { ...state, stars: state.stars - item.price, cosmetics } }
}

export type ActivateReason = 'unknown-item' | 'not-owned'

/**
 * Включить или выключить купленную косметику: декор — тумблер слота,
 * аксессуар — надеть/снять в своём слоте (голова/лицо/шея независимы,
 * на макушке кепка и корона делят место). Покупка активирует сама,
 * это для переключений.
 */
export function activateItem(
  state: PetState,
  id: string,
  config: GameConfig,
): { ok: boolean; reason?: ActivateReason; state: PetState } {
  const item = itemById(config, id)
  if (!item) return { ok: false, reason: 'unknown-item', state }
  if (!state.cosmetics.owned.includes(id)) return { ok: false, reason: 'not-owned', state }
  if (item.kind === 'decor' && item.decorSlot !== undefined) {
    const active = state.cosmetics.decor[item.decorSlot] === id ? null : id
    return { ok: true, state: { ...state, cosmetics: { ...state.cosmetics, decor: { ...state.cosmetics.decor, [item.decorSlot]: active } } } }
  }
  if (item.kind === 'accessory' && item.accSlot !== undefined) {
    const active = state.cosmetics.accessories[item.accSlot] === id ? null : id
    return { ok: true, state: { ...state, cosmetics: { ...state.cosmetics, accessories: { ...state.cosmetics.accessories, [item.accSlot]: active } } } }
  }
  return { ok: false, state }
}
