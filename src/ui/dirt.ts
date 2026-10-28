/**
 * Видимая грязность питомца: чистота из стейта переводится в уровень
 * «запущенности» сцены. Чистая логика без React/DOM — как dayCycle.
 */

export type DirtLevel = 0 | 1 | 2 | 3

/** Пороги чистоты, ниже которых сцена становится грязнее. */
export const DIRT_THRESHOLDS = { smudged: 70, dirty: 40, filthy: 15 } as const

export function dirtLevel(cleanliness: number): DirtLevel {
  if (cleanliness >= DIRT_THRESHOLDS.smudged) return 0
  if (cleanliness >= DIRT_THRESHOLDS.dirty) return 1
  if (cleanliness >= DIRT_THRESHOLDS.filthy) return 2
  return 3
}

/** Сила отрисовки грязи 0..1 — чтобы грязь появлялась и смывалась плавно. */
export function dirtIntensity(level: DirtLevel): number {
  return level === 0 ? 0 : level === 1 ? 0.5 : level === 2 ? 0.8 : 1
}
