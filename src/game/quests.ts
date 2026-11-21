import type { GameConfig } from './config'
import { earnStars } from './economy'
import { daySeed, mulberry32 } from './rng'
import type { PetState } from './types'

/**
 * Ежедневные задания («ритуал дня»): раз в день детерминированно от даты
 * разыгрывается набор заданий — одинаковый у всех игроков и на всех
 * устройствах. Прогресс копится от действий и живёт в сейве (pet.daily).
 * Всё чистое: state → new state, без мутаций.
 */

export type QuestId = 'feed' | 'play' | 'wash' | 'pet' | 'gameOfDay' | 'catchStar' | 'shopVisit' | 'sleep'

/**
 * Пул заданий: старая забота (кормить/играть/мыть/гладить) и «события дня»
 * (игра дня, пойманная звёздочка, магазин, укладывание спать). Порядок
 * стабильный — id входят в сейв.
 */
export const ALL_QUESTS: QuestId[] = ['feed', 'play', 'wash', 'pet', 'gameOfDay', 'catchStar', 'shopVisit', 'sleep']

export interface DailyQuests {
  /** ключ дня 'YYYY-MM-DD' (локальная дата игрока) */
  day: string
  /** задания этого дня */
  quests: QuestId[]
  /** прогресс по каждому заданию, параллельно quests */
  progress: number[]
  /** награда за полный набор уже забрана */
  claimed: boolean
}

/** Ключ дня по локальному времени: 'YYYY-MM-DD'. */
export function dayKey(now: number): string {
  const d = new Date(now)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${date}`
}

/** Детерминированный выбор count уникальных заданий для дня. */
export function rollQuests(day: string, count: number): QuestId[] {
  const rand = mulberry32(daySeed(day))
  const pool = [...ALL_QUESTS]
  const picked: QuestId[] = []
  while (picked.length < count && pool.length > 0) {
    const i = Math.floor(rand() * pool.length)
    picked.push(pool[i]!)
    pool.splice(i, 1)
  }
  return picked
}

/**
 * Гарантировать, что daily относится к сегодняшнему дню: null или вчерашний
 * день переразыгрываются, сегодняшний — возвращаются как есть.
 */
export function ensureDaily(state: PetState, config: GameConfig, now: number): PetState {
  const today = dayKey(now)
  if (state.daily !== null && state.daily.day === today) return state
  const quests = rollQuests(today, config.quests.count)
  return { ...state, daily: { day: today, quests, progress: quests.map(() => 0), claimed: false } }
}

/** Отметить действие в заданиях дня; цель не перепрыгивается. */
export function recordQuest(state: PetState, action: QuestId, config: GameConfig, now: number): PetState {
  const ensured = ensureDaily(state, config, now)
  const daily = ensured.daily
  if (daily === null) return ensured
  return {
    ...ensured,
    daily: {
      ...daily,
      progress: daily.progress.map((p, i) =>
        daily.quests[i] === action ? Math.min(p + 1, config.quests.targets[action]) : p,
      ),
    },
  }
}

export type ClaimReason = 'not-ready' | 'already-claimed'

export interface ClaimResult {
  state: PetState
  ok: boolean
  reason?: ClaimReason
}

/**
 * Забрать награду дня: все задания полные и награда ещё не забрана.
 * Награда — звёздочки в кошелёк: валюта всегда полезна, а прежний бонус
 * самому слабому стату сгорал в клэмпе при высоких показателях.
 */
export function claimReward(state: PetState, config: GameConfig): ClaimResult {
  const daily = state.daily
  if (daily === null) return { state, ok: false, reason: 'not-ready' }
  const complete = daily.quests.every((q, i) => (daily.progress[i] ?? 0) >= config.quests.targets[q])
  if (!complete) return { state, ok: false, reason: 'not-ready' }
  if (daily.claimed) return { state, ok: false, reason: 'already-claimed' }
  return {
    ok: true,
    state: {
      ...earnStars(state, config.shop.questStars),
      daily: { ...daily, claimed: true },
    },
  }
}
