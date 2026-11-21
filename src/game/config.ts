import type { HolidayWindows } from './holidays'
import type { QuestId } from './quests'
import type { Stats } from './types'

/**
 * Все числа, влияющие на баланс игры. Меняются только здесь —
 * это «пульт управления» ощущением игры.
 */
/** Товар магазина: блюдо для следующего кормления или косметика.
 *  id стабильны — входят в сейв (dish/cosmetics) и словари i18n. */
export interface ShopItemConfig {
  id: string
  kind: 'dish' | 'decor' | 'accessory'
  /** цена в звёздочках */
  price: number
  /** эмодзи плитки */
  emoji: string
  /** бонус сытости за пойманную еду (kind: 'dish') */
  bonusPerFood?: number
  /** слот декора сцены (kind: 'decor') */
  decorSlot?: 'meadow' | 'sea'
  /** слот аксессуара (kind: 'accessory'): в одном слоте носят один предмет */
  accSlot?: 'head' | 'face' | 'neck'
}

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
  /** пороги запущенности сцены по neglectMs: луг вянет, питомец тоскует */
  neglect: { warnMs: number; badMs: number; criticalMs: number }
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
  /** ежедневные задания: сколько в день и цели */
  quests: {
    count: number
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
  /** случайные события на сцене: что-то появляется само, тапни — поймай */
  events: {
    /** пауза между событиями (реальное время): от минимума до максимума */
    gapMinMs: number
    gapMaxMs: number
    /** сколько событие ждёт тапа, потом исчезает */
    expireMs: number
    /** звёздочка: звёздочек в кошелёк за поимку */
    starStars: number
    /** бабочка: счастья за поимку */
    butterflyHappiness: number
    /** пузырьки: чистоты за поимку */
    bubblesCleanliness: number
  }
  /** серия дней: дни, на которых праздник */
  streak: { milestones: number[] }
  /** звёздочки — валюта заботы: начисления и каталог магазина */
  shop: {
    /** звёздочек за полный набор заданий дня */
    questStars: number
    /** звёздочек за каждый день серии дней */
    streakDayStars: number
    /** звёздочек за саму доигранную партию мини-игры, без условий */
    playStars: number
    /** звёздочек за новый личный рекорд в мини-игре */
    recordStars: number
    /** звёздочек за каждого приглашённого друга */
    referralStarsPerFriend: number
    /** цена смены имени питомца */
    renamePrice: number
    /** каталог товаров */
    items: ShopItemConfig[]
  }
  /** уровень дружбы: опыт за заботу и пороги уровней */
  friendship: {
    /** опыт за одно заботливое действие */
    xpPerAction: number
    /** опыт за партию мини-игры — сверху действия play */
    xpPerMinigame: number
    /** опыт за награду заданий дня */
    xpPerClaim: number
    /** пороги уровней: 0 — старт; уровень = 1 + число пройденных ненулевых порогов */
    levels: number[]
  }
  /** характер питомца: черты растут от стиля заботы и дают маленькие бонусы */
  character: {
    /** пороги уровней черты по счётчику: 1-й, 2-й и 3-й уровень */
    thresholds: [number, number, number]
    /** с какого уровня черта считается раскрытой и даёт бонус */
    bonusAtLevel: number
    /** сладкоежка: счастья за сессию кормления купленным блюдом */
    dish: number
    /** непоседа: счастья за доигранную партию мини-игры */
    party: number
    /** неженка: счастья за поглаживание */
    pet: number
  }
  /** автосервисы «Помощников»: суточные пропуски на автозаботу */
  services: {
    /** длительность пропуска (реальное время) */
    passMs: number
    /** кормушка: сыпет fullness при голоде ниже порога, не чаще кулдауна */
    feed: { threshold: number; cooldownMs: number; fullness: number }
    /** автомойка: отмывает до restoreTo при грязи ниже порога */
    wash: { threshold: number; cooldownMs: number; restoreTo: number }
    /** энергия ниже — питомец укладывается сам */
    sleepThreshold: number
    prices: { feed: number; wash: number; sleep: number; vitamin: number; nanny: number }
  }
  /** достижения: пороги в существующих полях состояния (id строятся из них) */
  achievements: {
    /** серия дней: дни-вехи */
    streakDays: number[]
    /** возраст питомца в днях */
    ageDays: number[]
    /** лучший счёт любой мини-игры */
    minigameBest: number
    /** недели дружбы от createdAt */
    friendshipWeeks: number[]
    /** пороги друзей для достижений (звёзды дружбы на питомце) */
    referralFriends: number[]
    /** уровни дружбы */
    friendshipLevel: number[]
    /** накопленные звёздочки */
    starsEarned: number[]
  }
  /** мини-игры кнопки «Играть»: числа баланса ядер и наград */
  minigames: {
    /** «Память»: пары в первом ряду, время, рост рядов и разгон тика таймера (конец — таймер) */
    memory: {
      pairs: number
      timeLimitMs: number
      levelBonusMs: number
      pairsPerLevel: number
      pairsMax: number
      /** +доля к скорости тика за каждый собранный ряд */
      timerRamp: number
      /** потолок скорости тика, ×N */
      timerRateMax: number
    }
    /** «Побег»: физика бега до столкновения (прыжок, гравитация, разгон) */
    runner: {
      speedStart: number
      speedGain: number
      jumpV: number
      gravity: number
      spacingMin: number
      spacingMax: number
      duckMs: number
    }
    /** «Полёт»: физика взмаха и разгон колонн; конец — столкновение */
    flappy: {
      gravity: number
      flapV: number
      pipeSpeed: number
      speedGain: number
      pipeSpacing: number
      pipeGap: number
      pipeW: number
    }
    /** «Змейка»: темп хода, разгон по времени и размер клетки (поле выводится из экрана); конец — столкновение */
    snake: { moveMs: number; moveMin: number; rampPerSec: number; cellPx: number }
    /** «Пузыри»: темп и разгон подъёма, правила групп и размер клетки (конец — переполнение) */
    bubbles: { riseMs: number; riseMinMs: number; riseStepMs: number; colors: number; minGroup: number; cellPx: number }
    /** награда сверх базовой радости play(): новый рекорд; в игре дня — ×2 */
    reward: { recordBonus: number; dailyMultiplier: number }
  }
  /** кормление-ловля: темп падения еды, поимка, серии, перекорм */
  feeding: {
    /** +сытости за пойманную еду */
    perFood: number
    /** предметов за одну сессию */
    spawnCount: number
    /** мс между предметами */
    spawnIntervalMs: number
    /** скорость падения, px/с */
    fallSpeed: number
    /** половина ширины зоны поимки, px */
    catchHalfWidth: number
    /** скорость бега к тапу, px/с */
    runSpeed: number
    /** доля несъедобного (0..1) — дезориентирует питомца */
    junkChance: number
    /** серия пойманных подряд для усиленной радости */
    streakN: number
    /** ступор от несъедобного, мс */
    stunMs: number
    /** перекорм: перерыв после объедения (реальное время) */
    overfedMs: number
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
  // сцена сдается постепенно: вялый луг через 3 ч без заботы, совсем рыжий к болезни
  neglect: { warnMs: 3 * HOUR, badMs: 8 * HOUR, criticalMs: 12 * HOUR },
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
    // цели: забота повторяется за день, «события дня» — разовые (звёздочек
    // на полянке за день бывает до нескольких)
    targets: { feed: 3, play: 2, wash: 2, pet: 3, gameOfDay: 1, catchStar: 2, shopVisit: 1, sleep: 1 },
  },
  // просьба живёт в реальном времени: окно 2 часа, потом пауза 3 часа
  requests: {
    bonusMultiplier: 2,
    windowMs: 2 * HOUR,
    cooldownMs: 3 * HOUR,
    firstDelayMs: 1 * HOUR,
  },
  // события на сцене тоже реальном времени: каждые 4–10 минут что-то
  // появляется и ждёт тапа 45 секунд — оживление между кнопками
  events: {
    gapMinMs: 4 * MINUTE,
    gapMaxMs: 10 * MINUTE,
    expireMs: 45_000,
    starStars: 1,
    butterflyHappiness: 3,
    bubblesCleanliness: 10,
  },
  streak: { milestones: [3, 7, 14, 30] },
  // звёздочки: за задания дня, каждый день серии, каждую партию, новые
  // рекорды и приглашённых; блюда — премиум-еда на одну сессию кормления (базовая еда бесплатна)
  shop: {
    questStars: 3,
    streakDayStars: 1,
    playStars: 1,
    recordStars: 2,
    referralStarsPerFriend: 5,
    renamePrice: 3,
    items: [
      { id: 'dish-cake', kind: 'dish', price: 8, emoji: '🍰', bonusPerFood: 4 },
      { id: 'dish-feast', kind: 'dish', price: 15, emoji: '🍱', bonusPerFood: 8 },
      { id: 'acc-cap', kind: 'accessory', price: 25, emoji: '🧢', accSlot: 'head' },
      { id: 'acc-bandana', kind: 'accessory', price: 30, emoji: '🧣', accSlot: 'neck' },
      { id: 'acc-glasses', kind: 'accessory', price: 35, emoji: '👓', accSlot: 'face' },
      { id: 'acc-crown', kind: 'accessory', price: 60, emoji: '👑', accSlot: 'head' },
      { id: 'dec-flower', kind: 'decor', price: 10, emoji: '🌸', decorSlot: 'meadow' },
      { id: 'dec-mushroom', kind: 'decor', price: 15, emoji: '🍄', decorSlot: 'meadow' },
      { id: 'dec-house', kind: 'decor', price: 30, emoji: '🏠', decorSlot: 'meadow' },
      { id: 'dec-boat', kind: 'decor', price: 25, emoji: '⛵', decorSlot: 'sea' },
    ],
  },
  // уровень дружбы: ~75 опыта в день заботы; уровни через ~1.5 дня, 4 дня,
  // 9 дней, 3 недели и ~5 недель
  friendship: {
    xpPerAction: 5,
    xpPerMinigame: 8,
    xpPerClaim: 15,
    levels: [0, 100, 300, 700, 1400, 2500],
  },
  // характер: черта раскрывается на 2-м уровне (20 повторов одного стиля
  // заботы) и с той поры даёт маленький бонус — к 3-му уровню он не растёт,
  // чтобы характер оставался украшением, а не гонкой за выгодой
  character: {
    thresholds: [5, 20, 50],
    bonusAtLevel: 2,
    dish: 2,
    party: 1,
    pet: 2,
  },
  // «Помощники»: суточные пропуски автозаботы. Машина не закрывает просьбы
  // и не отмечает квесты — это награда живого игрока
  services: {
    passMs: DAY,
    feed: { threshold: 40, cooldownMs: 4 * HOUR, fullness: 12 },
    wash: { threshold: 40, cooldownMs: 8 * HOUR, restoreTo: 70 },
    sleepThreshold: 40,
    prices: { feed: 12, wash: 8, sleep: 8, vitamin: 10, nanny: 24 },
  },
  // достижения: пороги поверх уже существующих полей сейва
  achievements: {
    streakDays: [7, 14, 30],
    ageDays: [7, 30],
    minigameBest: 100,
    friendshipWeeks: [2, 6],
    referralFriends: [1, 3],
    friendshipLevel: [3, 5],
    starsEarned: [100, 300],
  },
  // мини-игры: партии бесконечны («до первой ошибки»), счёт неограничен,
  // рекорды всегда бьются; новый рекорд даёт бонус к счастью (база — play())
  minigames: {
    // «Память»: 6 пар на старте, собранный ряд +30 с и на пару больше (до 8);
    // таймер тикает быстрее на 15% за ряд, потолок ×2
    memory: {
      pairs: 6,
      timeLimitMs: 60_000,
      levelBonusMs: 30_000,
      pairsPerLevel: 1,
      pairsMax: 8,
      timerRamp: 0.15,
      timerRateMax: 2,
    },
    // «Побег»: старт 200 px/с и +9 px/с² — за 30 с разгона до 470; прыжок 420
    // px/с против гравитации 1050 — окно над камнем (до 31 px) ~0.65 с;
    // препятствия каждые 200–300 px
    runner: { speedStart: 200, speedGain: 9, jumpV: 420, gravity: 1050, spacingMin: 200, spacingMax: 300, duckMs: 650 },
    // «Полёт»: колонны 130 px/с и +7 px/с²; взмах 250 против гравитации 900 — мягкое парение
    flappy: { gravity: 900, flapV: 250, pipeSpeed: 130, speedGain: 7, pipeSpacing: 200, pipeGap: 112, pipeW: 46 },
    // «Змейка»: ход раз в 160 мс и быстрее на 2 мс за каждую секунду партии
    // (пол на 90 — достигается за 35 с); клетка 26 px — поле выводится из
    // реального размера канваса
    snake: { moveMs: 160, moveMin: 90, rampPerSec: 2, cellPx: 26 },
    // «Пузыри»: ряд каждые 6.5 с и быстрее на 350 мс за ряд (не быстрее 2.5 с),
    // старт 5 рядов, группы от 3; группа от 5 — бонус +50%
    bubbles: { riseMs: 6_500, riseMinMs: 2_500, riseStepMs: 350, colors: 4, minGroup: 3, cellPx: 40 },
    reward: { recordBonus: 4, dailyMultiplier: 2 },
  },
  // кормление-ловля: 8 еды × ~5-6 пойманных ≈ прежняя сытость +25..40 за сессию
  // в ~15 секунд; несъедобного четверть, ступор 1.2 с; перекорм — 10 минут отдыха
  feeding: {
    perFood: 8,
    spawnCount: 6,
    spawnIntervalMs: 1_500,
    fallSpeed: 95,
    catchHalfWidth: 42,
    runSpeed: 150,
    junkChance: 0.25,
    streakN: 3,
    stunMs: 1_200,
    overfedMs: 10 * MINUTE,
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
  // события на сцене — тоже реальное время: в dev каждые 12–25 секунд,
  // чтобы механику было видно за сессию
  events: { ...DEFAULT_CONFIG.events, gapMinMs: 12_000, gapMaxMs: 25_000, expireMs: 30_000 },
  // перерыв после объедения тоже реальный: в dev — 20 секунд, чтобы увидеть механику
  feeding: { ...DEFAULT_CONFIG.feeding, overfedMs: 20_000 },
}
