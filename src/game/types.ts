export type Stage = 'egg' | 'baby' | 'adult'

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
  /** реальный момент последнего тика (мс, epoch) — для досчёта оффлайна */
  lastTickAt: number
}
