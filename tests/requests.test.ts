import { describe, expect, it } from 'vitest'
import { feed, play } from '../src/game/actions'
import { DEFAULT_CONFIG } from '../src/game/config'
import { updateRequest } from '../src/game/requests'
import { hatchedPet, HOUR } from './helpers'

const CFG = DEFAULT_CONFIG
const BORN = 1_000_000_000_000

/** Питомец с активной просьбой, ещё не истёкшей к моменту BORN. */
function withRequest(kind: 'feed' | 'play' | 'wash', expiresAt: number) {
  return hatchedPet(CFG, { request: { kind, expiresAt }, nextRequestAt: BORN + CFG.requests.firstDelayMs })
}

describe('updateRequest', () => {
  const NOW = BORN + CFG.requests.firstDelayMs + 1

  it('в яйце просьб не бывает', () => {
    const pet = hatchedPet(CFG, { stage: 'egg', ageMs: 0, nextRequestAt: BORN }, { fullness: 10 })
    expect(updateRequest(pet, CFG, NOW).request).toBeNull()
  })

  it('спящий не просит', () => {
    const pet = hatchedPet(CFG, { sleeping: true, nextRequestAt: BORN }, { fullness: 10 })
    expect(updateRequest(pet, CFG, NOW).request).toBeNull()
  })

  it('пора — просит самый низкий стат ниже порога комфорта', () => {
    const pet = hatchedPet(CFG, { nextRequestAt: BORN }, { fullness: 40, happiness: 80 })
    const next = updateRequest(pet, CFG, NOW)
    expect(next.request?.kind).toBe('feed')
    expect(next.request?.expiresAt).toBe(NOW + CFG.requests.windowMs)
  })

  it('самый низкий — счастье: просит игру; чистота: просит мытьё', () => {
    const playPet = hatchedPet(CFG, { nextRequestAt: BORN }, { happiness: 30, fullness: 80, cleanliness: 80 })
    expect(updateRequest(playPet, CFG, NOW).request?.kind).toBe('play')
    const washPet = hatchedPet(CFG, { nextRequestAt: BORN }, { cleanliness: 20 })
    expect(updateRequest(washPet, CFG, NOW).request?.kind).toBe('wash')
  })

  it('все статы в комфорте — просить нечего', () => {
    const pet = hatchedPet(CFG, { nextRequestAt: BORN })
    expect(updateRequest(pet, CFG, NOW).request).toBeNull()
  })

  it('пауза не вышла — просьбы нет', () => {
    const pet = hatchedPet(CFG, { nextRequestAt: BORN + HOUR }, { fullness: 10 })
    expect(updateRequest(pet, CFG, BORN + HOUR - 1).request).toBeNull()
  })

  it('просроченная просьба снимается и включает паузу', () => {
    const pet = withRequest('feed', BORN - 1)
    const now = BORN + 10
    const next = updateRequest(pet, CFG, now)
    expect(next.request).toBeNull()
    expect(next.nextRequestAt).toBe(now + CFG.requests.cooldownMs)
  })
})

describe('закрытие просьбы действием', () => {
  const NOW = BORN + 5 * HOUR

  it('корм по просьбе — двойная сытость, просьба снята', () => {
    const pet = withRequest('feed', NOW + HOUR)
    const result = feed({ ...pet, stats: { ...pet.stats, fullness: 40 } }, CFG)
    expect(result.ok).toBe(true)
    expect(result.requestBonus).toBe(true)
    expect(result.state.stats.fullness).toBe(40 + CFG.actions.feed.fullness * CFG.requests.bonusMultiplier)
    expect(result.state.request).toBeNull()
  })

  it('игра по просьбе удваивает радость, но не усталость', () => {
    const pet = withRequest('play', NOW + HOUR)
    const result = play({ ...pet, stats: { ...pet.stats, happiness: 40, energy: 80 } }, CFG)
    expect(result.requestBonus).toBe(true)
    expect(result.state.stats.happiness).toBe(40 + CFG.actions.play.happiness * CFG.requests.bonusMultiplier)
    expect(result.state.stats.energy).toBe(80 - CFG.actions.play.energy)
    expect(result.state.request).toBeNull()
  })

  it('действие не по просьбе — обычный эффект, просьба остаётся', () => {
    const pet = withRequest('feed', NOW + HOUR)
    const result = play(pet, CFG)
    expect(result.ok).toBe(true)
    expect(result.requestBonus).toBeUndefined()
    expect(result.state.request?.kind).toBe('feed')
  })
})
