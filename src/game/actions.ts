import type { GameConfig } from './config'
import type { PetState } from './types'

export type ActionReason =
  | 'not-hatched'
  | 'sleeping'
  | 'too-tired'
  | 'already-full'
  | 'already-happy'
  | 'already-clean'
  | 'already-named'
  | 'invalid-name'

export interface ActionResult {
  state: PetState
  ok: boolean
  reason?: ActionReason
  /** действие закрыло активную просьбу питомца — эффект двойной */
  requestBonus?: boolean
}

function clampStat(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function ok(state: PetState): ActionResult {
  return { state, ok: true }
}

function fail(state: PetState, reason: ActionReason): ActionResult {
  return { state, ok: false, reason }
}

/** Едят и бодрствуют только вылупившиеся питомцы. */
function guardAwake(state: PetState): ActionResult | null {
  if (state.stage === 'egg') return fail(state, 'not-hatched')
  if (state.sleeping) return fail(state, 'sleeping')
  return null
}

export function feed(state: PetState, config: GameConfig): ActionResult {
  const blocked = guardAwake(state)
  if (blocked) return blocked
  if (state.stats.fullness >= 100) return fail(state, 'already-full')
  const matched = state.request?.kind === 'feed'
  const gain = config.actions.feed.fullness * (matched ? config.requests.bonusMultiplier : 1)
  const result = ok({
    ...state,
    stats: {
      ...state.stats,
      fullness: clampStat(state.stats.fullness + gain),
    },
  })
  // просьбу закрывает только «своё» действие; паузу до следующей ставит usePet
  if (!matched) return result
  return { ...result, state: { ...result.state, request: null }, requestBonus: true }
}

export function play(state: PetState, config: GameConfig): ActionResult {
  const blocked = guardAwake(state)
  if (blocked) return blocked
  if (state.stats.happiness >= 100) return fail(state, 'already-happy')
  if (state.stats.energy < config.actions.play.energy) return fail(state, 'too-tired')
  // просьба удваивает радость, но не усталость
  const matched = state.request?.kind === 'play'
  const joy = config.actions.play.happiness * (matched ? config.requests.bonusMultiplier : 1)
  const result = ok({
    ...state,
    stats: {
      ...state.stats,
      happiness: clampStat(state.stats.happiness + joy),
      energy: clampStat(state.stats.energy - config.actions.play.energy),
    },
  })
  if (!matched) return result
  return { ...result, state: { ...result.state, request: null }, requestBonus: true }
}

export function wash(state: PetState, config: GameConfig): ActionResult {
  const blocked = guardAwake(state)
  if (blocked) return blocked
  if (state.stats.cleanliness >= 100) return fail(state, 'already-clean')
  const matched = state.request?.kind === 'wash'
  const gain = config.actions.wash.cleanliness * (matched ? config.requests.bonusMultiplier : 1)
  const result = ok({
    ...state,
    stats: {
      ...state.stats,
      cleanliness: clampStat(state.stats.cleanliness + gain),
    },
  })
  if (!matched) return result
  return { ...result, state: { ...result.state, request: null }, requestBonus: true }
}

/**
 * Погладить: ласка не запрещается даже при полном счастье —
 * просто нечего прибавлять.
 */
export function pet(state: PetState, config: GameConfig): ActionResult {
  const blocked = guardAwake(state)
  if (blocked) return blocked
  if (state.stats.happiness >= 100) return ok(state)
  return ok({
    ...state,
    stats: {
      ...state.stats,
      happiness: clampStat(state.stats.happiness + config.actions.pet.happiness),
    },
  })
}

export function startSleep(state: PetState): ActionResult {
  if (state.stage === 'egg') return fail(state, 'not-hatched')
  return ok({ ...state, sleeping: true })
}

export function wake(state: PetState): ActionResult {
  return ok({ ...state, sleeping: false })
}

/** Имя даётся один раз; безымянным может быть любой питомец — и старый сейв. */
export function namePet(state: PetState, rawName: string, config: GameConfig): ActionResult {
  if (state.name !== null) return fail(state, 'already-named')
  const name = rawName.trim()
  if (name.length === 0 || name.length > config.nameMaxLength) return fail(state, 'invalid-name')
  return ok({ ...state, name })
}
