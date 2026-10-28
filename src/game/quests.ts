import type { GameConfig } from './config'
import type { PetState } from './types'

/**
 * Ежедневные задания («ритуал дня»): раз в день детерминированно от даты
 * разыгрывается набор заданий — одинаковый у всех игроков и на всех
 * устройствах. Прогресс копится от действий и живёт в сейве (pet.daily).
 * Всё чистое: state → new state, без мутаций.
 */

export type QuestId = 'feed' | 'play' | 'wash' | 'pet'

const ALL_QUESTS: QuestId[] = ['feed', 'play', 'wash', 'pet']

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

/** Тот же генератор, что в ui/petArt: маленький, детерминированный, без зависимостей. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Строку дня — в зерно: одинаковый день у всех игроков даёт одинаковый набор. */
function daySeed(day: string): number {
  let h = 2166136261
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
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

/** Забрать награду дня: все задания полные и награда ещё не забрана. */
export function claimReward(state: PetState, config: GameConfig): ClaimResult {
  const daily = state.daily
  if (daily === null) return { state, ok: false, reason: 'not-ready' }
  const complete = daily.quests.every((q, i) => (daily.progress[i] ?? 0) >= config.quests.targets[q])
  if (!complete) return { state, ok: false, reason: 'not-ready' }
  if (daily.claimed) return { state, ok: false, reason: 'already-claimed' }
  const happiness = Math.min(100, state.stats.happiness + config.quests.rewardHappiness)
  return {
    ok: true,
    state: {
      ...state,
      stats: { ...state.stats, happiness },
      daily: { ...daily, claimed: true },
    },
  }
}
