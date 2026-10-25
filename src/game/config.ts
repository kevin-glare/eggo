import type { Stats } from './types'

/**
 * Все числа, влияющие на баланс игры. Меняются только здесь —
 * это «пульт управления» ощущением игры.
 */
export interface GameConfig {
  /** стартовые статы новорождённого (вылупившегося) питомца */
  initialStats: Stats
  /** падение статов за час игрового времени (бодрствование) */
  decayPerHour: Stats
  /** множитель затухания сытости/счастья/чистоты во сне */
  sleepDecayFactor: number
  /** восстановление энергии за час сна */
  sleepEnergyPerHour: number
  /** стат ниже этого уровня считается критическим (копится пренебрежение) */
  criticalThreshold: number
  /** столько непрерывного пренебрежения → болезнь */
  sicknessAfterMs: number
  /** средний стат выше этого уровня → выздоровление */
  healAvgThreshold: number
  /** пороги настроения по среднему стату */
  happyThreshold: number
  contentThreshold: number
  /** длительности стадий (игровое время) */
  evolution: { eggMs: number; babyMs: number }
  /** сила действий */
  actions: {
    feed: { fullness: number }
    play: { happiness: number; energy: number }
    wash: { cleanliness: number }
  }
  /** сколько игровых миллисекунд проходит за 1 мс реального времени */
  timeScale: number
  /** максимум оффлайн-времени, которое досчитывается при возврате */
  maxOfflineMs: number
  /** шаг досчёта оффлайна: заодно корректно обрабатывает смену стадии */
  catchUpChunkMs: number
  /** предел длины имени питомца (после обрезки пробелов) */
  nameMaxLength: number
}

export const MINUTE = 60_000
export const HOUR = 3_600_000
export const DAY = 24 * HOUR

/** Реальный темп игры: от 100 до 0 примерно за 8–16 часов. */
export const DEFAULT_CONFIG: GameConfig = {
  initialStats: { fullness: 80, happiness: 80, energy: 80, cleanliness: 80 },
  decayPerHour: { fullness: 12, happiness: 10, energy: 8, cleanliness: 6 },
  sleepDecayFactor: 0.5,
  sleepEnergyPerHour: 25,
  criticalThreshold: 25,
  sicknessAfterMs: 12 * HOUR,
  healAvgThreshold: 60,
  happyThreshold: 75,
  contentThreshold: 45,
  evolution: { eggMs: 10 * MINUTE, babyMs: 3 * DAY },
  actions: {
    feed: { fullness: 30 },
    play: { happiness: 25, energy: 15 },
    wash: { cleanliness: 40 },
  },
  timeScale: 1,
  maxOfflineMs: 7 * DAY,
  catchUpChunkMs: HOUR,
  nameMaxLength: 16,
}

/** Дев-режим: время ×60 — эволюцию видно за минуты. */
export const DEV_CONFIG: GameConfig = {
  ...DEFAULT_CONFIG,
  timeScale: 60,
}
