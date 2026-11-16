import { describe, expect, it } from 'vitest'
import { normalizeAppearance, REF_MARK_CAP } from '../src/game/appearance'
import { DEFAULT_CONFIG } from '../src/game/config'
import { applyReferralReward } from '../src/game/referrals'
import { hatchedPet, TEST_APPEARANCE } from './helpers'

const CFG = DEFAULT_CONFIG

describe('applyReferralReward — за каждого друга', () => {
  it('первый друг: звезда дружбы и звёздочки за каждого друга', () => {
    const pet = hatchedPet(CFG)
    const reward = applyReferralReward(pet, 1, CFG)
    expect(reward.friends).toBe(1)
    expect(reward.state.appearance).toEqual({ ...pet.appearance, refMark: 1 })
    expect(reward.stars).toBe(CFG.shop.referralStarsPerFriend)
    expect(reward.state.stars).toBe(pet.stars + CFG.shop.referralStarsPerFriend)
  })

  it('награда линейна: три друга — три порции звёздочек', () => {
    const pet = hatchedPet(CFG)
    const reward = applyReferralReward(pet, 3, CFG)
    expect(reward.friends).toBe(3)
    expect(reward.stars).toBe(CFG.shop.referralStarsPerFriend * 3)
    expect(reward.state.appearance.refMark).toBe(3)
  })

  it('идемпотентна: повторный пересчёт не меняет состояние и не платит', () => {
    const pet = hatchedPet(CFG)
    const first = applyReferralReward(pet, 3, CFG)
    const again = applyReferralReward(first.state, 3, CFG)
    expect(again.state).toBe(first.state)
    expect(again.friends).toBe(3)
    expect(again.stars).toBe(0)
  })

  it('новые друзья сверху платят только за разницу', () => {
    const pet = hatchedPet(CFG, { appearance: { ...TEST_APPEARANCE, refMark: 3 } })
    const reward = applyReferralReward(pet, 5, CFG)
    expect(reward.stars).toBe(CFG.shop.referralStarsPerFriend * 2)
    expect(reward.friends).toBe(5)
    expect(reward.state.appearance.refMark).toBe(5)
  })

  it('меньше оплаченных друзей счётчик не отбирает', () => {
    const pet = hatchedPet(CFG, { appearance: { ...TEST_APPEARANCE, refMark: 5 } })
    const reward = applyReferralReward(pet, 1, CFG)
    expect(reward.state).toBe(pet)
    expect(reward.friends).toBe(5)
  })

  it('потолок счётчика не ломает идемпотентность: cap+1 платит один раз', () => {
    const pet = hatchedPet(CFG)
    const reward = applyReferralReward(pet, REF_MARK_CAP + 1, CFG)
    expect(reward.state.appearance.refMark).toBe(REF_MARK_CAP)
    const again = applyReferralReward(reward.state, REF_MARK_CAP + 1, CFG)
    expect(again.state).toBe(reward.state)
    expect(again.stars).toBe(0)
  })
})

describe('normalizeAppearance — звёзды дружбы', () => {
  it('старый сейв без звёзд → refMark: 0', () => {
    const { refMark: _нет, ...old } = TEST_APPEARANCE
    expect(normalizeAppearance(old)?.refMark).toBe(0)
  })

  it('кривое число звёзд зажимается в 0..999 (счётчик друзей не ограничен тремя)', () => {
    expect(normalizeAppearance({ ...TEST_APPEARANCE, refMark: 2 })?.refMark).toBe(2)
    expect(normalizeAppearance({ ...TEST_APPEARANCE, refMark: 7 })?.refMark).toBe(7)
    expect(normalizeAppearance({ ...TEST_APPEARANCE, refMark: 5000 })?.refMark).toBe(999)
    expect(normalizeAppearance({ ...TEST_APPEARANCE, refMark: -1 })?.refMark).toBe(0)
    expect(normalizeAppearance({ ...TEST_APPEARANCE, refMark: 'две' })?.refMark).toBe(0)
  })
})
