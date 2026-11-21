import type { PetAppearance } from './appearance'
import type { DailyQuests } from './quests'
import type { MinigameId } from './minigames/types'

export type Stage = 'egg' | 'baby' | 'child' | 'teen' | 'adult'

export type Mood = 'happy' | 'content' | 'sad' | 'sick' | 'sleeping'

export interface Stats {
  /** сытость */
  fullness: number
  /** счастье */
  happiness: number
  /** энергия */
  energy: number
  /** чистота */
  cleanliness: number
}

export type StatKey = keyof Stats

/** Слоты аксессуаров: по одному из каждого — голова, лицо, шея одновременно. */
export interface PetAccessorySlots {
  /** голова: кепка или корона (макушка одна на двоих) */
  head: string | null
  /** лицо: очки */
  face: string | null
  /** шея: шарф-бандана */
  neck: string | null
}

/** Косметика питомца и сцены: покупается в магазине, рисуется поверх генов. */
export interface PetCosmetics {
  /** купленные товары: id из config.shop.items */
  owned: string[]
  /** надетые аксессуары по слотам */
  accessories: PetAccessorySlots
  /** активный декор сцены по слотам; null — слот пуст */
  decor: { meadow: string | null; sea: string | null }
}

/** Что питомец может попросить: только действия с положительным эффектом. */
export type RequestKind = 'feed' | 'play' | 'wash'

/** Активная просьба питомца: закрывшее её действие даёт двойной эффект. */
export interface PetRequest {
  kind: RequestKind
  /** до какого реального момента просьба актуальна (мс, epoch) */
  expiresAt: number
}

/** Что появляется на сцене само по себе: тапабельный объект с наградой. */
export type SceneEventKind = 'star' | 'butterfly' | 'bubbles'

/** Активное событие на сцене: тапни, чтобы поймать. */
export interface SceneEvent {
  kind: SceneEventKind
  /** до какого реального момента событие можно поймать (мс, epoch) */
  expiresAt: number
}

/** Полное состояние питомца. Все значения — чистые данные, без методов. */
export interface PetState {
  /** реальный момент создания (мс, epoch) */
  createdAt: number
  /** сколько прожил в игровом времени (мс); в dev течёт быстрее */
  ageMs: number
  stage: Stage
  stats: Stats
  /** имя, данное хозяином в стадии яйца; null — пока не назван */
  name: string | null
  sleeping: boolean
  sick: boolean
  /** сколько подряд (игрового времени) хотя бы один стат в критической зоне */
  neglectMs: number
  /** внешность («гены»): бросается при создании, дальше не меняется */
  appearance: PetAppearance
  /** реальный момент последнего тика (мс, epoch) — для досчёта оффлайна */
  lastTickAt: number
  /** реальный момент последнего события игрока (мс, epoch): действие, сон,
   *  имя, награда. Тики и catchUp его не трогают — по нему слияние двух
   *  девайсов понимает, чьи событийные поля свежее */
  lastEventAt: number
  /** ежедневные задания; null — ещё не начат день (старые сейвы нормализуются) */
  daily: DailyQuests | null
  /** серия дней с активностью; 0 у старых сейвов (нормализуется) */
  streakDays: number
  /** сколько звёздочек уже конвертировано из огоньков стрика (разовая миграция); у старых сейвов 0 (нормализуется) */
  streakStarsGiven: number
  /** день последней активности ('YYYY-MM-DD'); null — активностей ещё не было */
  lastVisitDayKey: string | null
  /** активная просьба: «исполню сейчас — эффект двойной»; null — просьбы нет */
  request: PetRequest | null
  /** реальный момент, когда питомец снова может попросить (мс, epoch) */
  nextRequestAt: number
  /** активное событие на сцене: тапни, чтобы поймать; null — событий нет (нормализуется) */
  event: SceneEvent | null
  /** реальный момент следующего появления события на сцене (мс, epoch); у старых сейвов 0 (нормализуется) */
  nextEventAt: number
  /** рекорды мини-игр: лучший счёт каждой; у старых сейвов пусто (нормализуется) */
  minigameBest: Partial<Record<MinigameId, number>>
  /** до какого реального момента питомец отдыхает после объедения (мс, epoch); 0 — не объедался */
  overfedUntil: number
  /** звёздочки в кошельке: награда за квесты, дни серии, рекорды; тратятся в магазине. У старых сейвов 0 (нормализуется) */
  stars: number
  /** накопленный опыт дружбы: растёт от заботы; у старых сейвов 0 (нормализуется) */
  xp: number
  /** открытые достижения (стабильные id из game/achievements); у старых сейвов пусто (нормализуется) */
  achievements: string[]
  /** активное блюдо для следующего кормления из магазина; null — базовая еда (нормализуется) */
  dish: string | null
  /** купленная косметика и её активация; у старых сейвов пусто (нормализуется) */
  cosmetics: PetCosmetics
  /** активные автосервисы: дедлайны пропусков и кулдауны сработки (реальное время); у старых сейвов нули (нормализуется) */
  services: { feedUntil: number; washUntil: number; sleepUntil: number; lastFeedAt: number; lastWashAt: number }
}
