import type { GameConfig } from './config'
import { earnStars } from './economy'
import type { PetState, SceneEvent, SceneEventKind } from './types'

/**
 * Случайные события на сцене: раз в несколько минут на полянке что-то
 * появляется — звёздочка, бабочка, пузырьки. Тапни — поймаешь и получишь
 * награду; не тапнул — исчезнет, и через паузу придёт следующее.
 * Всё чистое: state → new state, без мутаций.
 *
 * События живут в реальном времени (как просьбы): timeScale на них не
 * влияет. Спавн проверяет тик клиента раз в секунду; воркер события
 * не трогает — на сервере сцены нет.
 */

function clampStat(value: number): number {
  return Math.min(100, Math.max(0, value))
}

/** Стабильный каталог событий: входит в сейв и нормализацию. */
export const SCENE_EVENT_KINDS: SceneEventKind[] = ['star', 'butterfly', 'bubbles']

export type ClaimEventReason = 'no-event' | 'not-hatched' | 'sleeping'

/** Что дал тап: нули — у событий, у которых этой награды нет. */
export interface EventReward {
  kind: SceneEventKind
  stars: number
  happiness: number
  cleanliness: number
}

/** Дискриминированный union: у успеха награда обязательна, у отказа — причина. */
export type ClaimEventResult =
  | { state: PetState; ok: false; reason: ClaimEventReason }
  | { state: PetState; ok: true; reward: EventReward }

/** Пауза до следующего события: случайная между гэпами конфига. */
function nextGap(config: GameConfig, rand: () => number): number {
  const { gapMinMs, gapMaxMs } = config.events
  return gapMinMs + rand() * (gapMaxMs - gapMinMs)
}

/** Запланировать следующее событие от момента now. */
function scheduleNext(state: PetState, config: GameConfig, now: number, rand: () => number): PetState {
  return { ...state, nextEventAt: now + nextGap(config, rand) }
}

/**
 * Появление и просрочка событий. Вызывается в тике клиента раз в секунду
 * и при загрузке сейва. В яйце и во сне событий не бывает: спящий пропустит
 * своё окно и увидит событие после пробуждения.
 */
export function maybeSpawnEvent(state: PetState, config: GameConfig, now: number, rand: () => number = Math.random): PetState {
  if (state.stage === 'egg') return state
  if (state.event !== null) {
    if (now < state.event.expiresAt) return state
    // окно вышло: событие исчезло, до следующего — пауза
    return scheduleNext({ ...state, event: null }, config, now, rand)
  }
  if (state.sleeping || now < state.nextEventAt) return state
  const kind = SCENE_EVENT_KINDS[Math.floor(rand() * SCENE_EVENT_KINDS.length)] ?? 'star'
  const event: SceneEvent = { kind, expiresAt: now + config.events.expireMs }
  return { ...state, event, nextEventAt: now }
}

/**
 * Поймать событие тапом. Событие чужого вида, просроченное или отсутствующее
 * не ловится — состояние не меняется. Награда видна в reward: тост собирает
 * из неё вызывающий.
 */
export function claimEvent(state: PetState, kind: SceneEventKind, config: GameConfig, now: number, rand: () => number = Math.random): ClaimEventResult {
  if (state.stage === 'egg') return { state, ok: false, reason: 'not-hatched' }
  if (state.sleeping) return { state, ok: false, reason: 'sleeping' }
  if (state.event === null || state.event.kind !== kind || now > state.event.expiresAt) {
    return { state, ok: false, reason: 'no-event' }
  }
  const e = config.events
  const reward: EventReward =
    kind === 'star'
      ? { kind, stars: e.starStars, happiness: 0, cleanliness: 0 }
      : kind === 'butterfly'
        ? { kind, stars: 0, happiness: e.butterflyHappiness, cleanliness: 0 }
        : { kind, stars: 0, happiness: 0, cleanliness: e.bubblesCleanliness }
  const stats = {
    ...state.stats,
    happiness: clampStat(state.stats.happiness + reward.happiness),
    cleanliness: clampStat(state.stats.cleanliness + reward.cleanliness),
  }
  return {
    ok: true,
    reward,
    // событие поймано: до следующего — пауза
    state: scheduleNext(earnStars({ ...state, stats, event: null }, reward.stars), config, now, rand),
  }
}
