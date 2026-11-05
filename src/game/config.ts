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
  /** мини-игры кнопки «Играть»: числа баланса ядер и наград */
  minigames: {
    /** «Память»: пары карточек и время на всю партию; победа — собрать всё до нуля */
    memory: { pairs: number; timeLimitMs: number }
    /** «Побег»: метров до победы и физика бега (прыжок, гравитация, разгон) */
    runner: {
      winScore: number
      speedStart: number
      speedGain: number
      jumpV: number
      gravity: number
      spacingMin: number
      spacingMax: number
      duckMs: number
    }
    /** «Полёт»: колонн до победы и физика взмаха */
    flappy: {
      winScore: number
      gravity: number
      flapV: number
      pipeSpeed: number
      pipeSpacing: number
      pipeGap: number
      pipeW: number
    }
    /** «Змейка»: кусков до победы и темп хода (ускорение с каждым куском) */
    snake: { winScore: number; moveMs: number; moveMin: number; moveStep: number; cells: number }
    /** «Пузыри»: очков до победы, темп подъёма поля и правила групп */
    bubbles: { winScore: number; riseMs: number; colors: number; minGroup: number; cols: number; rows: number }
    /** награда сверх базовой радости play(): за победу и за новый рекорд */
    reward: { winBonus: number; recordBonus: number }
  }
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
  // мини-игры: «Память» — 6 пар за минуту; победа даёт бонус к счастью,
  // новый рекорд — ещё немного сверху (база — обычный play())
  minigames: {
    memory: { pairs: 6, timeLimitMs: 60_000 },
    // «Побег»: 300 м (~12–15 с с разгоном); прыжок 420 px/с против гравитации
    // 1050 — окно над камнем (до 31 px) ~0.65 с; препятствия каждые 200–300 px
    runner: { winScore: 300, speedStart: 200, speedGain: 6, jumpV: 420, gravity: 1050, spacingMin: 200, spacingMax: 300, duckMs: 650 },
    // «Полёт»: 10 колонн; взмах 250 против гравитации 900 — мягкое парение
    flappy: { winScore: 10, gravity: 900, flapV: 250, pipeSpeed: 130, pipeSpacing: 200, pipeGap: 112, pipeW: 46 },
    // «Змейка»: 12 кусков; ход раз в 160 мс и быстрее на 4 мс за кусок, не быстрее 90
    snake: { winScore: 12, moveMs: 160, moveMin: 90, moveStep: 4, cells: 15 },
    // «Пузыри»: 300 очков (30 пузырей) до подъёма поля; ряд каждые 6.5 с, группы от 3
    bubbles: { winScore: 300, riseMs: 6_500, colors: 4, minGroup: 3, cols: 8, rows: 10 },
    reward: { winBonus: 6, recordBonus: 4 },
  },
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
