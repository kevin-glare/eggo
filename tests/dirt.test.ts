import { describe, expect, it } from 'vitest'
import { dirtIntensity, dirtLevel, DIRT_THRESHOLDS } from '../src/ui/dirt'

describe('dirtLevel — чистота → уровень грязи сцены', () => {
  it('полная чистота — грязи нет', () => {
    expect(dirtLevel(100)).toBe(0)
    expect(dirtLevel(DEITY_LEVEL)).toBe(0)
  })

  it('пороги срабатывают ровно на границе: нижняя граница чище, ниже — грязнее', () => {
    expect(dirtLevel(DEITY_LEVEL + 0.001)).toBe(0)
    expect(dirtLevel(DIRT_THRESHOLDS.smudged)).toBe(0)
    expect(dirtLevel(DIRT_THRESHOLDS.smudged - 0.001)).toBe(1)
    expect(dirtLevel(DIRT_THRESHOLDS.dirty)).toBe(1)
    expect(dirtLevel(DIRT_THRESHOLDS.dirty - 0.001)).toBe(2)
    expect(dirtLevel(DIRT_THRESHOLDS.filthy)).toBe(2)
    expect(dirtLevel(DIRT_THRESHOLDS.filthy - 0.001)).toBe(3)
  })

  it('ноль чистоты — самый грязный уровень', () => {
    expect(dirtLevel(0)).toBe(3)
  })
})

describe('dirtIntensity — сила отрисовки для плавных переходов', () => {
  it('чистому питомцу грязь не рисуется', () => {
    expect(dirtIntensity(0)).toBe(0)
  })

  it('чем грязнее, тем сильнее, без скачков назад', () => {
    expect(dirtIntensity(1)).toBeLessThan(dirtIntensity(2))
    expect(dirtIntensity(2)).toBeLessThan(dirtIntensity(3))
    expect(dirtIntensity(3)).toBe(1)
  })
})

// читаемость: «идеальная чистота» выше верхнего порога
const DEITY_LEVEL = DIRT_THRESHOLDS.smudged + 30
