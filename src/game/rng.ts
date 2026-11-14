/**
 * Детерминированный rng и зерно дня — общие для разыгрываний, которые
 * должны совпадать у всех игроков и на всех устройствах: ежедневные
 * квесты, игра дня, будущие коллекции.
 */

/** Тот же генератор, что в ui/petArt: маленький, детерминированный, без зависимостей. */
export function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Строку дня — в зерно: одинаковый день у всех игроков даёт одинаковый розыгрыш. */
export function daySeed(day: string): number {
  let h = 2166136261
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
