import type { GameConfig } from './config'
import { normalizeAppearance, type PetAppearance } from './appearance'
import { stageForAge, tick } from './engine'
import type { QuestId } from './quests'
import type { DailyQuests } from './quests'
import type { PetRequest, PetState, RequestKind, Stats } from './types'
import { MINIGAME_IDS } from './minigames'
import type { MinigameId } from './minigames/types'

const SAVE_VERSION = 1

const QUEST_IDS: QuestId[] = ['feed', 'play', 'wash', 'pet']

const REQUEST_KINDS: RequestKind[] = ['feed', 'play', 'wash']

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

/**
 * Просьбы появились позже сейва v1: их отсутствие или поломка нормализуется
 * в null — питомец просто попросит в следующий раз.
 */
function normalizeRequest(raw: unknown): PetRequest | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Partial<PetRequest>
  if (typeof r.kind !== 'string' || !REQUEST_KINDS.includes(r.kind as RequestKind)) return null
  if (typeof r.expiresAt !== 'number' || r.expiresAt < 0) return null
  return { kind: r.kind as RequestKind, expiresAt: r.expiresAt }
}

/**
 * Рекорды мини-игр появились позже сейва v1: отсутствие или поломка
 * нормализуется в пустую таблицу — просто рекордов пока нет.
 */
function normalizeMinigameBest(raw: unknown): Partial<Record<MinigameId, number>> {
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Partial<Record<MinigameId, number>> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!MINIGAME_IDS.includes(key as MinigameId)) continue
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      out[key as MinigameId] = Math.floor(value)
    }
  }
  return out
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
      // сейвы до мультидевайс-слияния: события не штамповались — считаем их старыми
      lastEventAt: typeof pet.lastEventAt === 'number' && pet.lastEventAt >= 0 ? pet.lastEventAt : 0,
      streakDays: typeof pet.streakDays === 'number' && pet.streakDays >= 0 ? Math.floor(pet.streakDays) : 0,
      lastVisitDayKey: typeof pet.lastVisitDayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(pet.lastVisitDayKey)
        ? pet.lastVisitDayKey
        : null,
      request: normalizeRequest(pet.request),
      nextRequestAt: typeof pet.nextRequestAt === 'number' && pet.nextRequestAt >= 0 ? pet.nextRequestAt : 0,
      minigameBest: normalizeMinigameBest(pet.minigameBest),
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

/** Чья сторона «событийно» свежее: по штампу события, при ничьей — по тику (старые сейвы), затем — второй аргумент. */
function newerEvent(a: PetState, b: PetState): PetState {
  if (a.lastEventAt !== b.lastEventAt) return a.lastEventAt > b.lastEventAt ? a : b
  if (a.lastTickAt !== b.lastTickAt) return a.lastTickAt > b.lastTickAt ? a : b
  return b
}

/**
 * Поле-уровневое слияние состояний одного питомца с двух устройств.
 * Распад и рост детерминированы (tick — чистая функция), расходятся состояния
 * только событиями игрока, поэтому:
 *  - обе стороны досчитываются tick'ом до общей временной шкалы;
 *  - статы и возраст берутся по максимуму: «+30 сытости» с одного девайса
 *    не затирается распадом с другого;
 *  - событийные поля (имя, сон, задания, серия) — у стороны с более свежим
 *    событием; ничья — у второго аргумента (на сервере это серверный сейв).
 * Безымянное яйцо не тикает и событий не имеет — именованная сторона всегда главная.
 */
export function mergeStates(a: PetState, b: PetState, config: GameConfig): PetState {
  const timeline = Math.max(a.lastTickAt, b.lastTickAt)
  if (a.name === null || b.name === null) {
    // два яйца: обе стороны замерли, целиком берём более свежее
    if (a.name === null && b.name === null) return newerEvent(a, b)
    return catchUp(a.name === null ? b : a, timeline, config)
  }
  const newer = newerEvent(a, b)
  const older = newer === a ? b : a
  const caughtNewer = catchUp(newer, timeline, config)
  const caughtOlder = catchUp(older, timeline, config)
  const stats: Stats = {
    fullness: Math.max(caughtNewer.stats.fullness, caughtOlder.stats.fullness),
    happiness: Math.max(caughtNewer.stats.happiness, caughtOlder.stats.happiness),
    energy: Math.max(caughtNewer.stats.energy, caughtOlder.stats.energy),
    cleanliness: Math.max(caughtNewer.stats.cleanliness, caughtOlder.stats.cleanliness),
  }
  const ageMs = Math.max(caughtNewer.ageMs, caughtOlder.ageMs)
  return {
    ...caughtNewer,
    createdAt: Math.min(a.createdAt, b.createdAt),
    ageMs,
    stage: stageForAge(ageMs, config),
    stats,
    // болезнь не снимаем задним числом: вылечит тик при достойном уходе
    sick: caughtNewer.sick || caughtOlder.sick,
    neglectMs: Math.max(caughtNewer.neglectMs, caughtOlder.neglectMs),
    // рекорды, как статы, — детерминированное поле: берём по максимуму,
    // чтобы лучший счёт с любого девайса не затирался
    minigameBest: mergeMinigameBest(caughtNewer.minigameBest, caughtOlder.minigameBest),
    lastTickAt: timeline,
  }
}

/** Рекорды по каждому виду игр — максимум из двух сторон. */
function mergeMinigameBest(
  a: Partial<Record<MinigameId, number>> | undefined,
  b: Partial<Record<MinigameId, number>> | undefined,
): Partial<Record<MinigameId, number>> {
  const out: Partial<Record<MinigameId, number>> = { ...(a ?? {}) }
  for (const id of MINIGAME_IDS) {
    const other = b?.[id]
    if (other !== undefined && other > (out[id] ?? 0)) out[id] = other
  }
  return out
}

/**
 * Слияние локального и удалённого (сервер/облако) сейва. Безымянный и
 * отсутствующий локальный питомец всегда уступает удалённому: свежее яйцо
 * с нового устройства не должно побеждать настоящего питомца. Именованные
 * стороны сливаются по полям (mergeStates).
 * Битый и несовместимый удалённый сейв игнорируется.
 * fallbackAppearance подставляется удалённым сейвам старых версий, когда
 * локальной внешности взять неоткуда.
 */
export function mergeRemoteSave(
  remoteRaw: string | null,
  local: PetState | null,
  fallbackAppearance: PetAppearance,
  config: GameConfig,
): PetState | null {
  if (!remoteRaw) return local
  const remote = deserialize(remoteRaw, local?.appearance ?? fallbackAppearance)
  if (!remote) return local
  if (local === null || local.name === null) return remote
  // безымянный удалённый сейв (до появления имён) не носитель событий
  if (remote.name === null) return remote.lastTickAt <= local.lastTickAt ? local : remote
  return mergeStates(local, remote, config)
}
