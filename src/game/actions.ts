import type { GameConfig } from './config'
import type { PetState } from './types'

export type ActionReason = 'not-hatched' | 'sleeping' | 'too-tired'

export interface ActionResult {
  state: PetState
  ok: boolean
  reason?: ActionReason
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
  return ok({
    ...state,
    stats: {
      ...state.stats,
      fullness: clampStat(state.stats.fullness + config.actions.feed.fullness),
    },
  })
}

export function play(state: PetState, config: GameConfig): ActionResult {
  const blocked = guardAwake(state)
  if (blocked) return blocked
  if (state.stats.energy < config.actions.play.energy) return fail(state, 'too-tired')
  return ok({
    ...state,
    stats: {
      ...state.stats,
      happiness: clampStat(state.stats.happiness + config.actions.play.happiness),
      energy: clampStat(state.stats.energy - config.actions.play.energy),
    },
  })
}

export function wash(state: PetState, config: GameConfig): ActionResult {
  const blocked = guardAwake(state)
  if (blocked) return blocked
  return ok({
    ...state,
    stats: {
      ...state.stats,
      cleanliness: clampStat(state.stats.cleanliness + config.actions.wash.cleanliness),
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
