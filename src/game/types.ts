import type { PetAppearance } from './appearance'
import type { DailyQuests } from './quests'

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
  /** ежедневные задания; null — ещё не начат день (старые сейвы нормализуются) */
  daily: DailyQuests | null
  /** серия дней с активностью; 0 у старых сейвов (нормализуется) */
  streakDays: number
  /** день последней активности ('YYYY-MM-DD'); null — активностей ещё не было */
  lastVisitDayKey: string | null
}
