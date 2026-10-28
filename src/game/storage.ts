import type { GameConfig } from './config'
import { normalizeAppearance, type PetAppearance } from './appearance'
import { tick } from './engine'
import type { QuestId } from './quests'
import type { DailyQuests } from './quests'
import type { PetState } from './types'

const SAVE_VERSION = 1

const QUEST_IDS: QuestId[] = ['feed', 'play', 'wash', 'pet']

/**
 * Ежедневные задания появились позже сейва v1: их отсутствие или поломка
 * нормализуется в null — день начнётся заново, питомец не пострадает.
 */
function normalizeDaily(raw: unknown): DailyQuests | null {
  if (typeof raw !== 'object' || raw === null) return null
  const d = raw as Partial<DailyQuests>
  if (typeof d.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.day)) return null
  if (!Array.isArray(d.quests) || !Array.isArray(d.progress) || d.quests.length !== d.progress.length) return null
  if (!d.quests.every((q) => QUEST_IDS.includes(q))) return null
  return {
    day: d.day,
    quests: d.quests,
    progress: d.progress.map((p) => (typeof p === 'number' && p >= 0 ? Math.floor(p) : 0)),
    claimed: d.claimed === true,
  }
}

interface SaveData {
  version: number
  pet: PetState
}

export function serialize(state: PetState): string {
  return JSON.stringify({ version: SAVE_VERSION, pet: state } satisfies SaveData)
}

/**
 * Битые и несовместимые сейвы отбрасываются — игра начнётся заново.
 * fallbackAppearance подставляется сейвам старых версий (до внешности).
 */
export function deserialize(raw: string, fallbackAppearance: PetAppearance): PetState | null {
  try {
    const data = JSON.parse(raw) as Partial<SaveData>
    if (data?.version !== SAVE_VERSION) return null
    const pet = data.pet
    if (!pet || typeof pet !== 'object') return null
    if (typeof pet.ageMs !== 'number' || typeof pet.stage !== 'string' || typeof pet.stats !== 'object') return null
    // сейвы до появления имён — просто ещё не названный питомец
    // сейвы до появления внешности (и с битыми генами) получают запасную
    return {
      ...pet,
      name: typeof pet.name === 'string' ? pet.name : null,
      appearance: normalizeAppearance(pet.appearance) ?? fallbackAppearance,
      daily: normalizeDaily(pet.daily),
      streakDays: typeof pet.streakDays === 'number' && pet.streakDays >= 0 ? Math.floor(pet.streakDays) : 0,
      lastVisitDayKey: typeof pet.lastVisitDayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(pet.lastVisitDayKey)
        ? pet.lastVisitDayKey
        : null,
    }
  } catch {
    return null
  }
}

/**
 * Адаптер фактического хранилища: localStorage в браузере,
 * Telegram CloudStorage в мини-аппе. Ядро про хранилища не знает.
 */
export interface PetStorage {
  load(): string | null
  save(raw: string): void
}

/**
 * Досчитать всё время, пока приложение было закрыто: от lastTickAt до now.
 * Реальный интервал переводится в игровой через timeScale и применяется
 * кусками по catchUpChunkMs — так корректно проходят смена стадии и пороги.
 */
export function catchUp(state: PetState, nowMs: number, config: GameConfig): PetState {
  const realGap = Math.min(Math.max(0, nowMs - state.lastTickAt), config.maxOfflineMs)
  const gameGap = realGap * config.timeScale

  let next = state
  let remaining = gameGap
  while (remaining > 0) {
    const chunk = Math.min(remaining, config.catchUpChunkMs)
    next = tick(next, chunk, config)
    remaining -= chunk
  }
  return { ...next, lastTickAt: nowMs }
}

/**
 * Слияние локального и удалённого (сервер/облако) сейва. Безымянный и
 * отсутствующий локальный питомец всегда уступает удалённому: свежее яйцо
 * с нового устройства не должно побеждать настоящего питомца по lastTickAt.
 * У именованных главный тот, у кого lastTickAt новее (позже сохранялся).
 * Битый и несовместимый удалённый сейв игнорируется.
 * fallbackAppearance подставляется удалённым сейвам старых версий, когда
 * локальной внешности взять неоткуда.
 */
export function mergeRemoteSave(
  remoteRaw: string | null,
  local: PetState | null,
  fallbackAppearance: PetAppearance,
): PetState | null {
  if (!remoteRaw) return local
  const remote = deserialize(remoteRaw, local?.appearance ?? fallbackAppearance)
  if (!remote) return local
  if (local === null || local.name === null) return remote
  if (remote.lastTickAt <= local.lastTickAt) return local
  return remote
}
