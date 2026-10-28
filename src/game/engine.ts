import type { GameConfig } from './config'
import type { PetAppearance } from './appearance'
import type { Mood, PetState, Stage, StatKey, Stats } from './types'

const STAT_KEYS = ['fullness', 'happiness', 'energy', 'cleanliness'] as const
const HOUR = 3_600_000

export function createPet(now: number, config: GameConfig, appearance: PetAppearance): PetState {
  return {
    createdAt: now,
    ageMs: 0,
    stage: 'egg',
    stats: { ...config.initialStats },
    name: null,
    sleeping: false,
    sick: false,
    neglectMs: 0,
    lastTickAt: now,
    appearance,
    daily: null,
  }
}

function clampStat(value: number): number {
  return Math.min(100, Math.max(0, value))
}

export function averageStats(state: PetState): number {
  const total = STAT_KEYS.reduce((sum, key) => sum + state.stats[key], 0)
  return total / STAT_KEYS.length
}

function stageForAge(ageMs: number, config: GameConfig): Stage {
  const { eggMs, babyMs, childMs, teenMs } = config.evolution
  if (ageMs < eggMs) return 'egg'
  if (ageMs < eggMs + babyMs) return 'baby'
  if (ageMs < eggMs + babyMs + childMs) return 'child'
  if (ageMs < eggMs + babyMs + childMs + teenMs) return 'teen'
  return 'adult'
}

/** Продвинуть игровое время на dtMs. Чистая: возвращает новое состояние. */
export function tick(state: PetState, dtMs: number, config: GameConfig): PetState {
  if (dtMs <= 0) return state
  // жизнь не начинается, пока питомец не получил имени: яйцо просто ждёт
  if (state.name === null) return state

  const ageMs = state.ageMs + dtMs
  const stage = stageForAge(ageMs, config)

  // В яйце жизнь заморожена: только время до вылупления.
  if (stage === 'egg') {
    return { ...state, ageMs, stage }
  }

  const hours = dtMs / HOUR
  const wakeFactor = state.sleeping ? config.sleepDecayFactor : 1
  const d = config.decayPerHour

  const stats: Stats = {
    fullness: clampStat(state.stats.fullness - d.fullness * hours * wakeFactor),
    happiness: clampStat(state.stats.happiness - d.happiness * hours * wakeFactor),
    cleanliness: clampStat(state.stats.cleanliness - d.cleanliness * hours * wakeFactor),
    energy: state.sleeping
      ? clampStat(state.stats.energy + config.sleepEnergyPerHour * hours)
      : clampStat(state.stats.energy - d.energy * hours),
  }

  // Пренебрежение: любой стат в критической зоне копит счётчик непрерывно.
  const critical = STAT_KEYS.some((key) => stats[key] < config.criticalThreshold)
  let neglectMs = critical ? state.neglectMs + dtMs : 0
  let sick = state.sick

  if (!sick && neglectMs >= config.sicknessAfterMs) sick = true
  // Лечит только забота: все статы вне критической зоны и средний выше порога.
  if (sick && !critical && averageStats({ ...state, stats }) >= config.healAvgThreshold) {
    sick = false
    neglectMs = 0
  }

  return { ...state, ageMs, stage, stats, neglectMs, sick }
}

/** Настроение — производное от состояния, нигде не хранится. */
export function getMood(state: PetState, config: GameConfig): Mood {
  if (state.stage === 'egg') return 'content'
  if (state.sleeping) return 'sleeping'
  if (state.sick) return 'sick'
  const avg = averageStats(state)
  if (avg >= config.happyThreshold) return 'happy'
  if (avg >= config.contentThreshold) return 'content'
  return 'sad'
}

export type DesireKind = 'feed' | 'play' | 'wash' | 'sleep'

/**
 * Чего питомец хочет прямо сейчас: самый низкий стат ниже порога комфорта.
 * Производное, нигде не хранится; во сне и в яйце желаний нет.
 * Ничья разрешается в порядке перечисления — сытость важнее всего.
 */
export function desire(state: PetState, config: GameConfig): DesireKind | null {
  if (state.stage === 'egg' || state.sleeping) return null
  const wants: [StatKey, DesireKind][] = [
    ['fullness', 'feed'],
    ['happiness', 'play'],
    ['cleanliness', 'wash'],
    ['energy', 'sleep'],
  ]
  let worst: { kind: DesireKind; value: number } | null = null
  for (const [key, kind] of wants) {
    const value = state.stats[key]
    if (value >= config.contentThreshold) continue
    if (worst === null || value < worst.value) worst = { kind, value }
  }
  return worst?.kind ?? null
}
