import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, type GameConfig } from '../src/game/config'
import {
  createMemory,
  flipMemory,
  memoryLevelPairs,
  memoryScore,
  memoryTimerRate,
  stepMemory,
  type MemoryState,
} from '../src/game/minigames/memory'
import { AVAILABLE_MINIGAMES, MINIGAME_IDS, pickMinigame } from '../src/game/minigames'
import { applyMinigameBonus, minigameBonus, recordMinigameScore } from '../src/game/minigames/reward'
import type { MinigameId } from '../src/game/minigames/types'
import { hatchedPet } from './helpers'

/** Детерминированный rng для тестов (та же формула, что в petArt/quests). */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MEM = DEFAULT_CONFIG.minigames.memory

describe('memory — ядро «Памяти»', () => {
  it('колода состоит из пар, все карточки закрыты', () => {
    const s = createMemory(MEM, mulberry32(1))
    expect(s.cards).toHaveLength(MEM.pairs * 2)
    expect(s.cards.every((c) => !c.flipped && !c.matched)).toBe(true)
    const kinds = s.cards.map((c) => c.kind).sort((a, b) => a - b)
    expect(kinds).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
  })

  it('одинаковый rng — одинаковая раскладка; разный — разная', () => {
    expect(createMemory(MEM, mulberry32(7))).toEqual(createMemory(MEM, mulberry32(7)))
    expect(createMemory(MEM, mulberry32(7)).cards).not.toEqual(createMemory(MEM, mulberry32(8)).cards)
  })

  it('первый тап открывает карточку, второй решает пару', () => {
    const s = createMemory(MEM, mulberry32(3))
    const [a, b] = sameKindPair(s)
    expect(a).not.toBe(b)
    const opened = flipMemory(s, a, MEM, mulberry32(3))
    expect(opened.cards[a]!.flipped).toBe(true)
    const matched = flipMemory(opened, b, MEM, mulberry32(3))
    expect(matched.cards[a]!.matched).toBe(true)
    expect(matched.cards[b]!.matched).toBe(true)
    expect(matched.matchedPairs).toBe(1)
    expect(matched.open).toEqual([])
  })

  it('несовпавшая пара закрывается сама через миг', () => {
    const s = createMemory(MEM, mulberry32(5))
    const [a, b] = differentKindPair(s)
    let next = flipMemory(flipMemory(s, a, MEM, mulberry32(5)), b, MEM, mulberry32(5))
    expect(next.closeInMs).not.toBeNull()
    next = stepMemory(next, 700, MEM)
    expect(next.cards[a]!.flipped).toBe(false)
    expect(next.cards[b]!.flipped).toBe(false)
    expect(next.closeInMs).toBeNull()
  })

  it('пока несовпавшая пара не закрылась, новые тапы игнорируются', () => {
    const s = createMemory(MEM, mulberry32(5))
    const [a, b] = differentKindPair(s)
    const open = flipMemory(flipMemory(s, a, MEM, mulberry32(5)), b, MEM, mulberry32(5))
    const [c] = differentKindPair(open)
    expect(flipMemory(open, c!, MEM, mulberry32(5))).toBe(open)
  })

  it('время вышло — партия проиграна', () => {
    let s = createMemory(MEM, mulberry32(9))
    s = stepMemory(s, MEM.timeLimitMs + 1, MEM)
    expect(s.over).toBe(true)
    expect(memoryScore(s)).toBe(0)
  })

  it('в первом ряду таймер тикает в реальном времени, дальше — быстрее', () => {
    const s1 = stepMemory(createMemory(MEM, mulberry32(9)), 1000, MEM)
    expect(MEM.timeLimitMs - s1.timeLeftMs).toBe(1000)
    // ряд 2 (ставим напрямую): тик = ×(1 + timerRamp)
    const lvl2 = { ...createMemory(MEM, mulberry32(9)), level: 2 }
    const s2 = stepMemory(lvl2, 1000, MEM)
    expect(MEM.timeLimitMs - s2.timeLeftMs).toBeCloseTo(1000 * (1 + MEM.timerRamp))
  })

  it('скорость тика растёт на timerRamp за ряд и упирается в timerRateMax', () => {
    expect(memoryTimerRate(MEM, 1)).toBe(1)
    expect(memoryTimerRate(MEM, 2)).toBeCloseTo(1 + MEM.timerRamp)
    expect(memoryTimerRate(MEM, 99)).toBe(MEM.timerRateMax)
  })

  it('ряд собран — новый ряд больше, время продлено, счёт копится', () => {
    const rng = mulberry32(11)
    let s = createMemory(MEM, rng)
    const pairs0 = s.cards.length / 2
    const t0 = s.timeLeftMs
    for (let i = 0; i < pairs0; i++) {
      const [a, b] = sameKindPair(s)
      s = flipMemory(s, a, MEM, rng)
      s = flipMemory(s, b, MEM, rng)
    }
    expect(s.level).toBe(2)
    expect(s.cards).toHaveLength((pairs0 + MEM.pairsPerLevel) * 2)
    expect(s.timeLeftMs).toBe(t0 + MEM.levelBonusMs)
    expect(s.over).toBe(false)
    expect(memoryScore(s)).toBe(pairs0 * 10)
  })

  it('рост пар ограничен pairsMax', () => {
    expect(memoryLevelPairs(MEM, 1)).toBe(MEM.pairs)
    expect(memoryLevelPairs(MEM, 99)).toBe(MEM.pairsMax)
  })

  /** Индексы двух карточек одного вида (раскладка известна из seeded-состояния). */
  function sameKindPair(s: MemoryState): [number, number] {
    for (let i = 0; i < s.cards.length; i++)
      for (let j = i + 1; j < s.cards.length; j++)
        if (s.cards[i]!.kind === s.cards[j]!.kind && !s.cards[i]!.matched && !s.cards[j]!.matched) return [i, j]
    throw new Error('пара не найдена')
  }

  function differentKindPair(s: MemoryState): [number, number] {
    for (let i = 0; i < s.cards.length; i++)
      for (let j = i + 1; j < s.cards.length; j++)
        if (
          s.cards[i]!.kind !== s.cards[j]!.kind &&
          !s.cards[i]!.flipped &&
          !s.cards[j]!.flipped &&
          !s.cards[i]!.matched &&
          !s.cards[j]!.matched
        )
          return [i, j]
    throw new Error('разная пара не найдена')
  }
})

describe('pickMinigame', () => {
  it('возвращает элемент списка и детерминирован при заданном rng', () => {
    expect(pickMinigame(MINIGAME_IDS, () => 0)).toBe(MINIGAME_IDS[0])
    expect(pickMinigame(MINIGAME_IDS, () => 0.999)).toBe(MINIGAME_IDS[MINIGAME_IDS.length - 1])
  })

  it('на этом этапе в «Играть» доступны только сделанные игры', () => {
    for (const id of AVAILABLE_MINIGAMES) expect(MINIGAME_IDS).toContain(id)
  })
})

describe('награды мини-игр', () => {
  const config: GameConfig = DEFAULT_CONFIG

  it('бонус к счастью — за новый рекорд, в игре дня двойной', () => {
    expect(minigameBonus(false, false, config)).toBe(0)
    expect(minigameBonus(true, false, config)).toBe(config.minigames.reward.recordBonus)
    expect(minigameBonus(true, true, config)).toBe(
      config.minigames.reward.recordBonus * config.minigames.reward.dailyMultiplier,
    )
  })

  it('бонус прибавляется к счастью с обрезкой сотней', () => {
    const pet = hatchedPet(config, {}, { happiness: 98 })
    expect(applyMinigameBonus(pet, 6).stats.happiness).toBe(100)
    expect(applyMinigameBonus(pet, 0)).toBe(pet)
  })

  it('первый счёт — уже рекорд, ноль — нет', () => {
    const pet = hatchedPet(config)
    expect(pet.minigameBest).toEqual({})
    const first = recordMinigameScore(pet, 'memory', 42, config)
    expect(first.isRecord).toBe(true)
    expect(first.state.minigameBest.memory).toBe(42)
    expect(recordMinigameScore(pet, 'memory', 0, config).isRecord).toBe(false)
  })

  it('новый рекорд платит звёздочками; ноль — нет', () => {
    const pet = hatchedPet(config)
    const first = recordMinigameScore(pet, 'memory', 42, config)
    expect(first.stars).toBe(config.shop.recordStars)
    expect(first.state.stars).toBe(pet.stars + config.shop.recordStars)
    expect(recordMinigameScore(pet, 'memory', 0, config).stars).toBe(0)
    expect(recordMinigameScore(pet, 'memory', 0, config).state).toBe(pet)
  })

  it('рекорд обновляется только строгим превышением', () => {
    const pet = hatchedPet(config, { minigameBest: { memory: 50 } })
    expect(recordMinigameScore(pet, 'memory', 50, config).isRecord).toBe(false)
    const better = recordMinigameScore(pet, 'memory', 51, config)
    expect(better.isRecord).toBe(true)
    expect(better.state.minigameBest.memory).toBe(51)
    expect(better.stars).toBe(config.shop.recordStars)
  })

  it('рекорд одной игры не трогает другую', () => {
    const pet = hatchedPet(config, { minigameBest: { memory: 50 } })
    const next = recordMinigameScore(pet, 'runner' as MinigameId, 10, config).state
    expect(next.minigameBest.memory).toBe(50)
    expect(next.minigameBest.runner).toBe(10)
  })
})
