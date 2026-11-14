import type { GameConfig } from './config'
import type { PetState } from './types'

/**
 * Автосервисы «Помощников»: суточные пропуски на автозаботу — кормушка,
 * автомойка, автоукладывание. Машина не закрывает просьбы и не отмечает
 * квесты — это награда живого игрока. Срабатывания живут в catchUp:
 * воркер досчитывает тем же ядром и видит те же услуги без своих правок.
 */

export type ServiceId = 'feed' | 'wash' | 'sleep'

/** Активен ли пропуск сервиса на момент now (реальное время). */
export function serviceActive(state: PetState, id: ServiceId, now: number): boolean {
  const until = id === 'feed' ? state.services.feedUntil : id === 'wash' ? state.services.washUntil : state.services.sleepUntil
  return until > now
}

export interface ServiceBuyResult {
  ok: boolean
  reason?: 'no-stars'
  state: PetState
}

/** Купить суточный пропуск («няня» — все три): активный продлевается суммой, не стеком. */
export function buyService(
  state: PetState,
  id: ServiceId | 'nanny',
  config: GameConfig,
  now: number,
): ServiceBuyResult {
  const price = id === 'nanny' ? config.services.prices.nanny : config.services.prices[id]
  if (state.stars < price) return { ok: false, reason: 'no-stars', state }
  const services = { ...state.services }
  const ids: ServiceId[] = id === 'nanny' ? ['feed', 'wash', 'sleep'] : [id]
  for (const sid of ids) {
    const key = `${sid}Until` as 'feedUntil' | 'washUntil' | 'sleepUntil'
    services[key] = Math.max(services[key], now) + config.services.passMs
  }
  return { ok: true, state: { ...state, stars: state.stars - price, services } }
}

/**
 * Срабатывания активных автосервисов на момент now. Вызывается из catchUp
 * по кусочкам реального времени — живой тикер и оффлайн-досчёт ведут себя
 * одинаково. Спящего питомца не будим и не кормим.
 */
export function applyAutoServices(state: PetState, config: GameConfig, now: number): PetState {
  if (state.stage === 'egg') return state
  const cfg = config.services
  const s = state.services
  let next = state
  if (s.feedUntil > now && !next.sleeping && next.stats.fullness < cfg.feed.threshold && now - s.lastFeedAt >= cfg.feed.cooldownMs) {
    next = {
      ...next,
      stats: { ...next.stats, fullness: Math.min(100, next.stats.fullness + cfg.feed.fullness) },
      services: { ...next.services, lastFeedAt: now },
    }
  }
  if (s.washUntil > now && next.stats.cleanliness < cfg.wash.threshold && now - s.lastWashAt >= cfg.wash.cooldownMs) {
    next = {
      ...next,
      stats: { ...next.stats, cleanliness: Math.max(next.stats.cleanliness, cfg.wash.restoreTo) },
      services: { ...next.services, lastWashAt: now },
    }
  }
  if (s.sleepUntil > now && !next.sleeping && next.stats.energy < cfg.sleepThreshold) {
    next = { ...next, sleeping: true }
  }
  return next
}

export type VitaminReason = 'healthy' | 'no-stars'

/** Витамин: мгновенное лечение болезни; здоровому не нужен — звёзды не списываем. */
export function useVitamin(
  state: PetState,
  config: GameConfig,
): { ok: boolean; reason?: VitaminReason; state: PetState } {
  if (!state.sick) return { ok: false, reason: 'healthy', state }
  const price = config.services.prices.vitamin
  if (state.stars < price) return { ok: false, reason: 'no-stars', state }
  return { ok: true, state: { ...state, sick: false, neglectMs: 0, stars: state.stars - price } }
}
