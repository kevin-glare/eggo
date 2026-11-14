import { describe, expect, it } from 'vitest'
import { allAchievementIds, evaluateAchievements } from '../src/game/achievements'
import { DEFAULT_CONFIG } from '../src/game/config'
import { FRIENDSHIP_WEEK_MS } from '../src/game/streak'
import { DAY, hatchedPet, makePet } from './helpers'

const NOW = Date.UTC(2026, 10, 14, 12, 0, 0)

describe('achievements — каталог', () => {
  it('каталог id стабилен: все пороги из конфига дают строку в списке', () => {
    const ids = allAchievementIds(DEFAULT_CONFIG)
    expect(ids).toContain('streak-7')
    expect(ids).toContain('age-30')
    expect(ids).toContain('score-100')
    expect(ids).toContain('all-games')
    expect(ids).toContain('stars-300')
    expect(ids).toHaveLength(15)
  })

  it('у свежего питомца ничего не открыто', () => {
    const fresh = hatchedPet(DEFAULT_CONFIG, { createdAt: NOW })
    expect(evaluateAchievements(fresh, DEFAULT_CONFIG, NOW)).toEqual([])
  })
})

describe('achievements — пороги', () => {
  it('стрик, возраст, звёздочки и уровень дружбы открывают свои вехи', () => {
    const pet = makePet(DEFAULT_CONFIG, { streakDays: 7, ageMs: 30 * DAY, stars: 120, xp: 350 })
    const ids = evaluateAchievements(pet, DEFAULT_CONFIG, NOW)
    expect(ids).toContain('streak-7')
    expect(ids).toContain('age-30')
    expect(ids).toContain('stars-100')
    expect(ids).toContain('lvl-3')
    expect(ids).not.toContain('streak-14')
    expect(ids).not.toContain('stars-300')
  })

  it('недели дружбы считаются от createdAt', () => {
    const created = Date.UTC(2026, 5, 1, 12, 0, 0)
    const pet = makePet(DEFAULT_CONFIG, { createdAt: created })
    const atTwoWeeks = evaluateAchievements(pet, DEFAULT_CONFIG, created + 2 * FRIENDSHIP_WEEK_MS)
    expect(atTwoWeeks).toContain('weeks-2')
    expect(atTwoWeeks).not.toContain('weeks-6')
  })

  it('рекорды: сотня очков в любой игре и «попробовал всё»', () => {
    const one = hatchedPet(DEFAULT_CONFIG, { minigameBest: { snake: 100 } })
    const ids = evaluateAchievements(one, DEFAULT_CONFIG, NOW)
    expect(ids).toContain('score-100')
    expect(ids).not.toContain('all-games')
    const all = { memory: 1, runner: 1, flappy: 1, snake: 1, bubbles: 1 }
    expect(evaluateAchievements(hatchedPet(DEFAULT_CONFIG, { minigameBest: all }), DEFAULT_CONFIG, NOW)).toContain(
      'all-games',
    )
  })

  it('звёзды дружбы от приглашённых открывают свои вехи', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { appearance: { ...hatchedPet(DEFAULT_CONFIG).appearance, refMark: 3 } })
    const ids = evaluateAchievements(pet, DEFAULT_CONFIG, NOW)
    expect(ids).toContain('ref-1')
    expect(ids).toContain('ref-3')
  })
})
