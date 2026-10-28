import type { QuestId } from './quests'
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
  /** длительности стадий (игровое время); яйцо — 5 реальных секунд, взрослый — навсегда */
  evolution: { eggMs: number; babyMs: number; childMs: number; teenMs: number }
  /** сила действий */
  actions: {
    feed: { fullness: number }
    play: { happiness: number; energy: number }
    wash: { cleanliness: number }
    pet: { happiness: number; cooldownMs: number }
  }
  /** сколько игровых миллисекунд проходит за 1 мс реального времени */
  timeScale: number
  /** максимум оффлайн-времени, которое досчитывается при возврате */
  maxOfflineMs: number
  /** шаг досчёта оффлайна: заодно корректно обрабатывает смену стадии */
  catchUpChunkMs: number
  /** предел длины имени питомца (после обрезки пробелов) */
  nameMaxLength: number
  /** ежедневные задания: сколько в день, награда и цели */
  quests: {
    count: number
    /** +счастья за полный набор дня */
    rewardHappiness: number
    targets: Record<QuestId, number>
  }
  /** серия дней: дни, на которых праздник */
  streak: { milestones: number[] }
  /** пуши от бота: пороги и кулдауны (логика — game/notifications.ts) */
  notifications: {
    /** «в беде»: пауза между повторными пушами */
    criticalCooldownMs: number
    /** «пора спать»: порог энергии, ниже которого питомец зевает (выше критического — беду кричит critical) */
    sleepyThreshold: number
    /** «пора спать»: пауза между повторами */
    sleepyCooldownMs: number
    /** «выспался»: пауза между повторами, пока питомец спит с полной энергией */
    sleptCooldownMs: number
    /** «скучаем»: после сколького отсутствия напомнить о себе */
    missYouAfterMs: number
    /** «скучаем»: пауза между повторами */
    missYouCooldownMs: number
    /** тихие часы по местному времени игрока: часы с from (включительно) до to; окно может переходить через полночь */
    quietHours: { from: number; to: number }
  }
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
  evolution: { eggMs: 5_000, babyMs: 36 * HOUR, childMs: 72 * HOUR, teenMs: 96 * HOUR },
  actions: {
    feed: { fullness: 30 },
    play: { happiness: 25, energy: 15 },
    wash: { cleanliness: 40 },
    // кулдаун не хранится в сейве — мягкий лимит на сессию
    pet: { happiness: 3, cooldownMs: 8_000 },
  },
  timeScale: 1,
  maxOfflineMs: 7 * DAY,
  catchUpChunkMs: HOUR,
  nameMaxLength: 16,
  quests: {
    count: 3,
    rewardHappiness: 15,
    targets: { feed: 3, play: 2, wash: 2, pet: 3 },
  },
  streak: { milestones: [3, 7, 14] },
  notifications: {
    criticalCooldownMs: 6 * HOUR,
    // зевает при энергии < 40: от беды (< 25) это отделяют ~2 часа бодрствования
    sleepyThreshold: 40,
    sleepyCooldownMs: 12 * HOUR,
    sleptCooldownMs: 12 * HOUR,
    missYouAfterMs: 24 * HOUR,
    missYouCooldownMs: 24 * HOUR,
    // не будим игрока с 22:00 до 9:00 по его часам
    quietHours: { from: 22, to: 9 },
  },
}

/** Дев-режим: время ×60 — эволюцию видно за минуты. */
export const DEV_CONFIG: GameConfig = {
  ...DEFAULT_CONFIG,
  timeScale: 60,
  // яйцо должно висеть 5 реальных секунд и здесь: 5 с × 60
  evolution: { ...DEFAULT_CONFIG.evolution, eggMs: 5_000 * 60 },
}
