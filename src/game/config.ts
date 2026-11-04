import type { HolidayWindows } from './holidays'
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
    /** + к самому слабому стату за полный набор дня */
    reward: number
    targets: Record<QuestId, number>
  }
  /** просьбы питомца: активная просьба указывает действие с двойным эффектом */
  requests: {
    /** множитель положительного эффекта действия, закрывшего просьбу */
    bonusMultiplier: number
    /** сколько реального времени живёт просьба */
    windowMs: number
    /** пауза после закрытой (действием или просрочкой) просьбы до следующей */
    cooldownMs: number
    /** пауза от рождения питомца до первой просьбы */
    firstDelayMs: number
  }
  /** рефералка: пороги приглашённых — каждая звезда дружбы питомцу */
  referrals: {
    milestones: number[]
  }
  /** серия дней: дни, на которых праздник */
  streak: { milestones: number[] }
  /** праздничные темы оформления: окна по (месяц, день) включительно; откат темы — enabled: false */
  holidays: HolidayWindows
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
    /** свежая активность игрока: был в приложении недавно — несрочные пуши молчат, он всё видит сам; беда (critical) кричит всегда */
    activityWindowMs: number
    /** тихие часы по местному времени игрока: часы с from (включительно) до to; окно может переходить через полночь */
    quietHours: { from: number; to: number }
  }
}

export const MINUTE = 60_000
export const HOUR = 3_600_000
export const DAY = 24 * HOUR

/** Реальный темп: забота нужна каждые ~3–4 часа; одно действие не доводит
 *  стат до предела — повторная забота вскоре снова имеет смысл. */
export const DEFAULT_CONFIG: GameConfig = {
  initialStats: { fullness: 80, happiness: 80, energy: 80, cleanliness: 80 },
  decayPerHour: { fullness: 14, happiness: 12, energy: 8, cleanliness: 8 },
  sleepDecayFactor: 0.5,
  sleepEnergyPerHour: 25,
  criticalThreshold: 25,
  sicknessAfterMs: 12 * HOUR,
  healAvgThreshold: 60,
  happyThreshold: 75,
  contentThreshold: 45,
  evolution: { eggMs: 5_000, babyMs: 36 * HOUR, childMs: 72 * HOUR, teenMs: 96 * HOUR },
  actions: {
    feed: { fullness: 25 },
    play: { happiness: 20, energy: 15 },
    wash: { cleanliness: 30 },
    // кулдаун не хранится в сейве — мягкий лимит на сессию
    pet: { happiness: 3, cooldownMs: 8_000 },
  },
  timeScale: 1,
  maxOfflineMs: 7 * DAY,
  catchUpChunkMs: HOUR,
  nameMaxLength: 16,
  quests: {
    count: 3,
    reward: 15,
    targets: { feed: 3, play: 2, wash: 2, pet: 3 },
  },
  // просьба живёт в реальном времени: окно 2 часа, потом пауза 3 часа
  requests: {
    bonusMultiplier: 2,
    windowMs: 2 * HOUR,
    cooldownMs: 3 * HOUR,
    firstDelayMs: 1 * HOUR,
  },
  // рефералка: пересечённый порог приглашённых = +звезда дружбы питомцу
  referrals: {
    milestones: [1, 3, 10],
  },
  streak: { milestones: [3, 7, 14] },
  // Хэллоуин: с 24 октября по 2 ноября
  holidays: {
    halloween: { enabled: true, from: [10, 24], to: [11, 2] },
  },
  notifications: {
    criticalCooldownMs: 6 * HOUR,
    // зевает при энергии < 40: от беды (< 25) это отделяют ~2 часа бодрствования
    sleepyThreshold: 40,
    sleepyCooldownMs: 12 * HOUR,
    sleptCooldownMs: 12 * HOUR,
    missYouAfterMs: 24 * HOUR,
    missYouCooldownMs: 24 * HOUR,
    // крон шлёт каждые 30 мин: окно в 10 минут надёжно перекрывает сессию в аппе
    activityWindowMs: 10 * MINUTE,
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
  // просьбы живут в реальном времени — timeScale на них не влияет,
  // поэтому в dev они короткие, чтобы механику было видно за сессию
  requests: { bonusMultiplier: 2, windowMs: 2 * MINUTE, cooldownMs: MINUTE, firstDelayMs: 15_000 },
}
