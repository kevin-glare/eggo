import { describe, expect, it } from 'vitest'
import { phaseName, sampleDayCycle } from '../src/ui/dayCycle'

describe('sampleDayCycle — непрерывный цикл суток', () => {
  it('полночь и 24 часа дают одинаковое небо (цикл замкнут)', () => {
    const a = sampleDayCycle(0)
    const b = sampleDayCycle(24)
    expect(a.skyTop).toEqual(b.skyTop)
    expect(a.star).toBe(b.star)
    expect(a.sun).toBe(b.sun)
  })

  it('в полдень: день — звёзд нет, солнце полное, облака есть', () => {
    const noon = sampleDayCycle(13)
    expect(noon.star).toBe(0)
    expect(noon.cloud).toBeGreaterThan(0.9)
    expect(noon.sun).toBeGreaterThan(0.99)
  })

  it('ночью: звёзды полные, солнца нет (только луна)', () => {
    const night = sampleDayCycle(2)
    expect(night.star).toBeGreaterThan(0.95)
    expect(night.sun).toBeLessThan(0.01)
  })

  it('между якорями значения интерполируются плавно', () => {
    const nightStar = sampleDayCycle(4.5).star
    const dawnStar = sampleDayCycle(6.5).star
    const between = sampleDayCycle(5.5).star
    expect(between).toBeGreaterThan(dawnStar)
    expect(between).toBeLessThan(nightStar)
  })

  it('все цвета в допустимых пределах в течение суток', () => {
    for (let h = 0; h <= 24; h += 0.5) {
      const p = sampleDayCycle(h)
      const colors = [p.skyTop, p.skyMid, p.skyBot, p.hillBack, p.hillFront, p.sunColor, p.cloudColor, p.rim]
      for (const c of colors) {
        for (const channel of c) {
          expect(channel).toBeGreaterThanOrEqual(0)
          expect(channel).toBeLessThanOrEqual(255)
        }
      }
      expect(p.warm).toBeGreaterThanOrEqual(0)
      expect(p.warm).toBeLessThanOrEqual(1)
    }
  })
})

describe('луна живёт по своему расписанию', () => {
  it('днём луны нет', () => {
    expect(sampleDayCycle(13).moon).toBe(0)
    expect(sampleDayCycle(10).moon).toBeLessThan(0.1)
  })

  it('ночью луна полная', () => {
    expect(sampleDayCycle(2).moon).toBeGreaterThan(0.95)
  })

  it('луна не следует за солнцем: на рассвете солнце уже есть, луны уже нет', () => {
    const dawn = sampleDayCycle(6.5)
    expect(dawn.sun).toBeGreaterThan(0.4)
    expect(dawn.moon).toBe(0)
  })

  it('луна поднимается к сумеркам и заходит к рассвету', () => {
    const dusk = sampleDayCycle(20.5)
    expect(dusk.moon).toBeGreaterThan(0.4)
    expect(dusk.moon).toBeLessThan(1)
    const predawn = sampleDayCycle(5.5)
    expect(predawn.moon).toBeGreaterThan(0.4)
    expect(predawn.moon).toBeLessThan(1)
  })
})

describe('phaseName — подпись части суток', () => {
  it('определяет часть суток по часу', () => {
    expect(phaseName(2)).toBe('ночь')
    expect(phaseName(8)).toBe('утро')
    expect(phaseName(13)).toBe('день')
    expect(phaseName(20)).toBe('вечер')
    expect(phaseName(23)).toBe('ночь')
  })
})
