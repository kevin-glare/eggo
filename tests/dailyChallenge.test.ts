import { describe, expect, it } from 'vitest'
import { dayGame } from '../src/game/dailyChallenge'
import { MINIGAME_IDS } from '../src/game/minigames'

describe('dayGame — игра дня', () => {
  it('возвращает игру из реестра', () => {
    for (const day of ['2026-11-01', '2026-11-02', '2027-05-20']) {
      expect(MINIGAME_IDS).toContain(dayGame(day))
    }
  })

  it('детерминирована: один день — одна игра (на всех устройствах)', () => {
    for (const day of ['2026-11-01', '2026-11-02', '1999-12-31']) {
      expect(dayGame(day)).toBe(dayGame(day))
    }
  })

  it('разные дни дают разные игры хотя бы иногда', () => {
    const set = new Set<string>()
    for (let i = 1; i <= 30; i++) set.add(dayGame(`2026-11-${String(i).padStart(2, '0')}`))
    expect(set.size).toBeGreaterThan(1)
  })
})
