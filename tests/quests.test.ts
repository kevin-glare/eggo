import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, type GameConfig } from '../src/game/config'
import { claimReward, dayKey, ensureDaily, recordQuest, rollQuests, type QuestId } from '../src/game/quests'
import { hatchedPet, makePet } from './helpers'

const QUESTS_CONFIG = DEFAULT_CONFIG.quests

describe('dayKey', () => {
  it('формат YYYY-MM-DD по локальному времени', () => {
    // 2026-01-05 12:00 UTC
    expect(dayKey(Date.UTC(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05')
  })

  it('граница суток: полночь начинает новый день', () => {
    const before = dayKey(Date.UTC(2026, 4, 10, 23, 59, 59))
    const after = dayKey(Date.UTC(2026, 4, 11, 0, 0, 1))
    expect(after).not.toBe(before)
    expect(after).toBe('2026-05-11')
  })
})

describe('rollQuests', () => {
  it('возвращает count уникальных заданий из пула', () => {
    const pool: QuestId[] = ['feed', 'play', 'wash', 'pet']
    const quests = rollQuests('2026-10-28', QUESTS_CONFIG.count)
    expect(quests).toHaveLength(QUESTS_CONFIG.count)
    expect(new Set(quests).size).toBe(quests.length)
    for (const q of quests) expect(pool).toContain(q)
  })

  it('детерминирован: один и тот же день — один и тот же набор (на всех устройствах)', () => {
    for (const day of ['2026-10-28', '2027-02-14', '1999-12-31']) {
      expect(rollQuests(day, 3)).toEqual(rollQuests(day, 3))
    }
  })

  it('разные дни дают разные наборы хотя бы иногда', () => {
    const sets = new Set<string>()
    for (let i = 1; i <= 30; i++) {
      const day = `2026-10-${String(i).padStart(2, '0')}`
      sets.add(rollQuests(day, 3).join(','))
    }
    expect(sets.size).toBeGreaterThan(1)
  })
})

describe('ensureDaily', () => {
  it('первый раз создаёт задания на сегодня', () => {
    const pet = hatchedPet(DEFAULT_CONFIG)
    const now = Date.UTC(2026, 9, 28, 10, 0, 0)
    const next = ensureDaily(pet, DEFAULT_CONFIG, now)
    expect(next.daily).not.toBeNull()
    expect(next.daily?.day).toBe(dayKey(now))
    expect(next.daily?.quests).toHaveLength(QUESTS_CONFIG.count)
    expect(next.daily?.progress).toEqual([0, 0, 0])
    expect(next.daily?.claimed).toBe(false)
  })

  it('тот же день — состояние не меняется', () => {
    const now = Date.UTC(2026, 9, 28, 10, 0, 0)
    const pet = ensureDaily(hatchedPet(DEFAULT_CONFIG), DEFAULT_CONFIG, now)
    expect(ensureDaily(pet, DEFAULT_CONFIG, now + 3_600_000)).toBe(pet)
  })

  it('новый день — задания переразыгрываются, прогресс и награда сбрасываются', () => {
    const now = Date.UTC(2026, 9, 28, 23, 0, 0)
    let pet = ensureDaily(hatchedPet(DEFAULT_CONFIG), DEFAULT_CONFIG, now)
    pet = recordQuest(pet, 'feed', DEFAULT_CONFIG, now)
    const nextDay = Date.UTC(2026, 9, 29, 1, 0, 0)
    const next = ensureDaily(pet, DEFAULT_CONFIG, nextDay)
    expect(next.daily?.day).toBe(dayKey(nextDay))
    expect(next.daily?.progress).toEqual([0, 0, 0])
    expect(next.daily?.claimed).toBe(false)
  })

  it('не мутирует исходное состояние', () => {
    const pet = hatchedPet(DEFAULT_CONFIG)
    ensureDaily(pet, DEFAULT_CONFIG, Date.UTC(2026, 9, 28))
    expect(pet.daily).toBeNull()
  })
})

describe('recordQuest', () => {
  const NOW = Date.UTC(2026, 9, 28, 10, 0, 0)

  it('растит прогресс только по своему заданию', () => {
    const pet = ensureDaily(hatchedPet(DEFAULT_CONFIG), DEFAULT_CONFIG, NOW)
    const next = recordQuest(pet, 'feed', DEFAULT_CONFIG, NOW)
    const daily = next.daily!
    const i = daily.quests.indexOf('feed')
    if (i !== -1) expect(daily.progress[i]).toBe(1)
    // прочие не тронуты
    daily.progress.forEach((p, j) => {
      if (daily.quests[j] !== 'feed') expect(p).toBe(0)
    })
  })

  it('не растёт выше цели', () => {
    let pet = ensureDaily(hatchedPet(DEFAULT_CONFIG), DEFAULT_CONFIG, NOW)
    const daily = pet.daily!
    const quest = daily.quests[0]!
    for (let i = 0; i < QUESTS_CONFIG.targets[quest] + 2; i++) pet = recordQuest(pet, quest, DEFAULT_CONFIG, NOW)
    expect(pet.daily!.progress[0]).toBe(QUESTS_CONFIG.targets[quest])
  })

  it('работает и для сейва без daily (создаёт по пути)', () => {
    const pet = hatchedPet(DEFAULT_CONFIG)
    const next = recordQuest(pet, 'pet', DEFAULT_CONFIG, NOW)
    expect(next.daily?.day).toBe(dayKey(NOW))
  })

  it('не мутирует исходное состояние', () => {
    const pet = ensureDaily(hatchedPet(DEFAULT_CONFIG), DEFAULT_CONFIG, NOW)
    const before = structuredClone(pet)
    recordQuest(pet, 'feed', DEFAULT_CONFIG, NOW)
    expect(pet).toEqual(before)
  })
})

describe('claimReward', () => {
  const NOW = Date.UTC(2026, 9, 28, 10, 0, 0)

  function completeQuests(pet: ReturnType<typeof hatchedPet>, config: GameConfig) {
    const daily = pet.daily!
    let next = pet
    for (const q of daily.quests) {
      for (let k = 0; k < config.quests.targets[q]; k++) next = recordQuest(next, q, config, NOW)
    }
    return next
  }

  it('незаполненные задания — отказ not-ready', () => {
    const pet = ensureDaily(hatchedPet(DEFAULT_CONFIG), DEFAULT_CONFIG, NOW)
    const result = claimReward(pet, DEFAULT_CONFIG)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not-ready')
    expect(result.state.stats.happiness).toBe(pet.stats.happiness)
  })

  it('все задания полные — награда счастьем с клэмпом и claimed', () => {
    let pet = ensureDaily(hatchedPet(DEFAULT_CONFIG, {}, { happiness: 90 }), DEFAULT_CONFIG, NOW)
    pet = completeQuests(pet, DEFAULT_CONFIG)
    const result = claimReward(pet, DEFAULT_CONFIG)
    expect(result.ok).toBe(true)
    expect(result.state.stats.happiness).toBe(100)
    expect(result.state.daily?.claimed).toBe(true)
  })

  it('повторная награда в тот же день — отказ already-claimed', () => {
    let pet = ensureDaily(hatchedPet(DEFAULT_CONFIG), DEFAULT_CONFIG, NOW)
    pet = completeQuests(pet, DEFAULT_CONFIG)
    const claimed = claimReward(pet, DEFAULT_CONFIG)
    const again = claimReward(claimed.state, DEFAULT_CONFIG)
    expect(again.ok).toBe(false)
    expect(again.reason).toBe('already-claimed')
  })

  it('в сейве без daily — отказ not-ready', () => {
    const result = claimReward(hatchedPet(DEFAULT_CONFIG), DEFAULT_CONFIG)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not-ready')
  })

  it('новый день после награды — снова можно выполнить и забрать', () => {
    let pet = ensureDaily(hatchedPet(DEFAULT_CONFIG), DEFAULT_CONFIG, NOW)
    pet = claimReward(completeQuests(pet, DEFAULT_CONFIG), DEFAULT_CONFIG).state
    const nextDay = Date.UTC(2026, 9, 29, 12, 0, 0)
    pet = ensureDaily(pet, DEFAULT_CONFIG, nextDay)
    pet = completeQuests(pet, DEFAULT_CONFIG)
    expect(claimReward(pet, DEFAULT_CONFIG).ok).toBe(true)
  })
})

describe('интеграция с makePet', () => {
  it('свежий питомец без daily', () => {
    expect(makePet(DEFAULT_CONFIG).daily).toBeNull()
  })
})
