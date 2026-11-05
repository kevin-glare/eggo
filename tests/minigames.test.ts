import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, type GameConfig } from '../src/game/config'
import { createMemory, flipMemory, memoryScore, stepMemory, type MemoryState } from '../src/game/minigames/memory'
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
    const opened = flipMemory(s, a, MEM)
    expect(opened.cards[a]!.flipped).toBe(true)
    const matched = flipMemory(opened, b, MEM)
    expect(matched.cards[a]!.matched).toBe(true)
    expect(matched.cards[b]!.matched).toBe(true)
    expect(matched.matchedPairs).toBe(1)
    expect(matched.open).toEqual([])
  })

  it('несовпавшая пара закрывается сама через миг', () => {
    const s = createMemory(MEM, mulberry32(5))
    const [a, b] = differentKindPair(s)
    let next = flipMemory(flipMemory(s, a, MEM), b, MEM)
    expect(next.closeInMs).not.toBeNull()
    next = stepMemory(next, 700)
    expect(next.cards[a]!.flipped).toBe(false)
    expect(next.cards[b]!.flipped).toBe(false)
    expect(next.closeInMs).toBeNull()
  })

  it('пока несовпавшая пара не закрылась, новые тапы игнорируются', () => {
    const s = createMemory(MEM, mulberry32(5))
    const [a, b] = differentKindPair(s)
    const open = flipMemory(flipMemory(s, a, MEM), b, MEM)
    const [c] = differentKindPair(open)
    expect(flipMemory(open, c!, MEM)).toBe(open)
  })

  it('время вышло — партия проиграна', () => {
    let s = createMemory(MEM, mulberry32(9))
    s = stepMemory(s, MEM.timeLimitMs + 1)
    expect(s.over).toBe(true)
    expect(s.won).toBe(false)
    expect(memoryScore(s)).toBe(0)
  })

  it('все пары собраны — победа и бонус за оставшееся время', () => {
    let s = createMemory(MEM, mulberry32(11))
    s = stepMemory(s, 10_000) // 50 секунд в запасе
    while (!s.over) {
      const [a, b] = sameKindPair(s)
      s = flipMemory(s, a, MEM)
      if (!s.over) s = flipMemory(s, b, MEM)
    }
    expect(s.won).toBe(true)
    expect(s.matchedPairs).toBe(MEM.pairs)
    expect(memoryScore(s)).toBe(MEM.pairs * 10 + 50)
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

  it('бонус есть только за победу; рекорд добавляет сверху', () => {
    expect(minigameBonus(false, false, config)).toBe(0)
    expect(minigameBonus(true, false, config)).toBe(config.minigames.reward.winBonus)
    expect(minigameBonus(true, true, config)).toBe(
      config.minigames.reward.winBonus + config.minigames.reward.recordBonus,
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
    const first = recordMinigameScore(pet, 'memory', 42)
    expect(first.isRecord).toBe(true)
    expect(first.state.minigameBest.memory).toBe(42)
    expect(recordMinigameScore(pet, 'memory', 0).isRecord).toBe(false)
  })

  it('рекорд обновляется только строгим превышением', () => {
    const pet = hatchedPet(config, { minigameBest: { memory: 50 } })
    expect(recordMinigameScore(pet, 'memory', 50).isRecord).toBe(false)
    const better = recordMinigameScore(pet, 'memory', 51)
    expect(better.isRecord).toBe(true)
    expect(better.state.minigameBest.memory).toBe(51)
  })

  it('рекорд одной игры не трогает другую', () => {
    const pet = hatchedPet(config, { minigameBest: { memory: 50 } })
    const next = recordMinigameScore(pet, 'runner' as MinigameId, 10).state
    expect(next.minigameBest.memory).toBe(50)
    expect(next.minigameBest.runner).toBe(10)
  })
})
