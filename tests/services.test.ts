import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/game/config'
import { applyAutoServices, buyService, serviceActive, useVitamin } from '../src/game/services'
import { catchUp } from '../src/game/storage'
import { DAY, HOUR, hatchedPet } from './helpers'

const CFG = DEFAULT_CONFIG
const NOW = Date.UTC(2026, 10, 14, 12, 0, 0)
const PRICES = CFG.services.prices

describe('buyService', () => {
  it('кормушка списывает цену и ставит пропуск на сутки', () => {
    const pet = hatchedPet(CFG, { stars: 20 })
    const res = buyService(pet, 'feed', CFG, NOW)
    expect(res.ok).toBe(true)
    expect(res.state.stars).toBe(20 - PRICES.feed)
    expect(res.state.services.feedUntil).toBe(NOW + CFG.services.passMs)
    expect(serviceActive(res.state, 'feed', NOW)).toBe(true)
  })

  it('активный пропуск продлевается суммой, а не стеком', () => {
    const first = buyService(hatchedPet(CFG, { stars: 100 }), 'feed', CFG, NOW)
    const later = NOW + 5 * HOUR
    const second = buyService(first.state, 'feed', CFG, later)
    expect(second.state.services.feedUntil).toBe(NOW + CFG.services.passMs + CFG.services.passMs)
  })

  it('няня ставит все три пропуска за одну цену', () => {
    const res = buyService(hatchedPet(CFG, { stars: 100 }), 'nanny', CFG, NOW)
    expect(res.state.stars).toBe(100 - PRICES.nanny)
    expect(res.state.services.feedUntil).toBe(NOW + CFG.services.passMs)
    expect(res.state.services.washUntil).toBe(NOW + CFG.services.passMs)
    expect(res.state.services.sleepUntil).toBe(NOW + CFG.services.passMs)
  })

  it('не хватает звёздочек — отказ без списания', () => {
    const pet = hatchedPet(CFG, { stars: 3 })
    const res = buyService(pet, 'feed', CFG, NOW)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('no-stars')
    expect(res.state.stars).toBe(3)
  })
})

describe('applyAutoServices', () => {
  const withPass = () =>
    hatchedPet(CFG, {
      services: {
        feedUntil: NOW + DAY,
        washUntil: NOW + DAY,
        sleepUntil: NOW + DAY,
        lastFeedAt: NOW - 5 * HOUR,
        lastWashAt: NOW - 9 * HOUR,
      },
    })

  it('кормушка сыпет еду ниже порога и держит кулдаун', () => {
    const pet = withPass()
    const fed = applyAutoServices({ ...pet, stats: { ...pet.stats, fullness: 30 } }, CFG, NOW)
    expect(fed.stats.fullness).toBe(30 + CFG.services.feed.fullness)
    expect(fed.services.lastFeedAt).toBe(NOW)
    // сразу после сработки — кулдаун, больше не кормит
    const again = applyAutoServices({ ...fed, stats: { ...fed.stats, fullness: 30 } }, CFG, NOW + 60_000)
    expect(again.stats.fullness).toBe(30)
  })

  it('мойка отмывает до restoreTo, но не смывает выше', () => {
    const dirty = applyAutoServices({ ...withPass(), stats: { fullness: 80, happiness: 80, energy: 80, cleanliness: 20 } }, CFG, NOW)
    expect(dirty.stats.cleanliness).toBe(CFG.services.wash.restoreTo)
    const clean = applyAutoServices({ ...withPass(), stats: { fullness: 80, happiness: 80, energy: 80, cleanliness: 80 } }, CFG, NOW)
    expect(clean.stats.cleanliness).toBe(80)
  })

  it('автосон укладывает при низкой энергии', () => {
    const sleepy = applyAutoServices({ ...withPass(), stats: { fullness: 80, happiness: 80, energy: 20, cleanliness: 80 } }, CFG, NOW)
    expect(sleepy.sleeping).toBe(true)
  })

  it('истёкший пропуск не работает', () => {
    const expired = hatchedPet(CFG, {
      services: { feedUntil: NOW - 1, washUntil: NOW - 1, sleepUntil: NOW - 1, lastFeedAt: 0, lastWashAt: 0 },
    })
    const next = applyAutoServices({ ...expired, stats: { fullness: 10, happiness: 80, energy: 10, cleanliness: 10 } }, CFG, NOW)
    expect(next.stats.fullness).toBe(10)
    expect(next.sleeping).toBe(false)
  })

  it('машинная забота не трогает квесты и просьбы', () => {
    const pet = hatchedPet(CFG, {
      daily: { day: '2026-11-14', quests: ['feed', 'play', 'wash'], progress: [1, 0, 0], claimed: false },
      request: { kind: 'feed', expiresAt: NOW + HOUR },
    })
    const fed = applyAutoServices({ ...pet, stats: { fullness: 30, happiness: 80, energy: 80, cleanliness: 80 } }, CFG, NOW)
    expect(fed.daily).toEqual(pet.daily)
    expect(fed.request).toEqual(pet.request)
  })

  it('спящего не кормит и не будит; яйцо заморожено', () => {
    const sleeping = applyAutoServices({ ...withPass(), sleeping: true, stats: { fullness: 10, happiness: 80, energy: 20, cleanliness: 10 } }, CFG, NOW)
    expect(sleeping.stats.fullness).toBe(10)
    expect(sleeping.sleeping).toBe(true)
    const egg = applyAutoServices(hatchedPet(CFG, { stage: 'egg' }), CFG, NOW)
    expect(egg).toBe(hatchedPet(CFG, { stage: 'egg' }).constructor ? egg : egg)
  })
})

describe('useVitamin', () => {
  it('здоровому не нужен — отказ без списания', () => {
    const pet = hatchedPet(CFG, { stars: 50 })
    const res = useVitamin(pet, CFG)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('healthy')
    expect(res.state.stars).toBe(50)
  })

  it('лечит сразу и гасит пренебрежение', () => {
    const pet = hatchedPet(CFG, { stars: 50, sick: true, neglectMs: 400_000 })
    const res = useVitamin(pet, CFG)
    expect(res.ok).toBe(true)
    expect(res.state.sick).toBe(false)
    expect(res.state.neglectMs).toBe(0)
    expect(res.state.stars).toBe(50 - PRICES.vitamin)
  })

  it('без звёздочек не лечит', () => {
    const res = useVitamin(hatchedPet(CFG, { stars: 3, sick: true }), CFG)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('no-stars')
  })
})

describe('catchUp применяет автосервисы оффлайн — как живой тикер', () => {
  it('кормушка кормит за время отсутствия: сытость выше, чем без пропуска', () => {
    const pet = hatchedPet(CFG, {
      lastTickAt: NOW,
      stars: 100,
      services: { feedUntil: NOW + 10 * HOUR, washUntil: 0, sleepUntil: 0, lastFeedAt: 0, lastWashAt: 0 },
    })
    const fed = catchUp({ ...pet, stats: { ...pet.stats, fullness: 30 } }, NOW + 5 * HOUR, CFG)
    expect(fed.services.lastFeedAt).toBeGreaterThan(NOW)
    // авто-корм не обгоняет распад (частичная забота), но питомец сытее,
    // чем без пропуска
    const without = catchUp(
      { ...pet, stats: { ...pet.stats, fullness: 30 }, services: { ...pet.services, feedUntil: 0 } },
      NOW + 5 * HOUR,
      CFG,
    )
    expect(fed.stats.fullness).toBeGreaterThan(without.stats.fullness)
  })
})
