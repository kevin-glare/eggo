import { describe, expect, it } from 'vitest'
import { normalizeAppearance } from '../src/game/appearance'
import { DEFAULT_CONFIG } from '../src/game/config'
import { applyReferralReward, referralTier } from '../src/game/referrals'
import { hatchedPet, TEST_APPEARANCE } from './helpers'

const CFG = DEFAULT_CONFIG

describe('referralTier', () => {
  it('считает пересечённые пороги', () => {
    expect(referralTier(0, CFG)).toBe(0)
    expect(referralTier(1, CFG)).toBe(1)
    expect(referralTier(2, CFG)).toBe(1)
    expect(referralTier(3, CFG)).toBe(2)
    expect(referralTier(9, CFG)).toBe(2)
    expect(referralTier(10, CFG)).toBe(3)
    expect(referralTier(99, CFG)).toBe(3)
  })
})

describe('applyReferralReward', () => {
  it('выдаёт звёзды, когда порог пересечён; остальные гены не тронуты', () => {
    const pet = hatchedPet(CFG)
    const reward = applyReferralReward(pet, 1, CFG)
    expect(reward.tier).toBe(1)
    expect(reward.state.appearance).toEqual({ ...pet.appearance, refMark: 1 })
  })

  it('идемпотентна: повторный пересчёт не меняет состояние', () => {
    const pet = hatchedPet(CFG)
    const first = applyReferralReward(pet, 3, CFG)
    const again = applyReferralReward(first.state, 3, CFG)
    expect(again.state).toBe(first.state)
    expect(again.tier).toBe(2)
  })

  it('меньше заработанного звёзд не отбирает', () => {
    const pet = hatchedPet(CFG, { appearance: { ...TEST_APPEARANCE, refMark: 3 } })
    const reward = applyReferralReward(pet, 1, CFG)
    expect(reward.state).toBe(pet)
    expect(reward.tier).toBe(3)
  })
})

describe('normalizeAppearance — звёзды дружбы', () => {
  it('старый сейв без звёзд → refMark: 0', () => {
    const { refMark: _нет, ...old } = TEST_APPEARANCE
    expect(normalizeAppearance(old)?.refMark).toBe(0)
  })

  it('кривое число звёзд зажимается в 0..3', () => {
    expect(normalizeAppearance({ ...TEST_APPEARANCE, refMark: 2 })?.refMark).toBe(2)
    expect(normalizeAppearance({ ...TEST_APPEARANCE, refMark: 7 })?.refMark).toBe(3)
    expect(normalizeAppearance({ ...TEST_APPEARANCE, refMark: -1 })?.refMark).toBe(0)
    expect(normalizeAppearance({ ...TEST_APPEARANCE, refMark: 'две' })?.refMark).toBe(0)
  })
})
