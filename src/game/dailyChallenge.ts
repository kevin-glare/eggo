import { MINIGAME_IDS } from './minigames'
import type { MinigameId } from './minigames/types'
import { daySeed, mulberry32 } from './rng'

/**
 * Игра дня: одна мини-игра на день, детерминированно от даты —
 * одинаковая у всех игроков и на всех устройствах. В ней рекорд даёт
 * двойной бонус (config.minigames.reward.dailyMultiplier).
 */

export function dayGame(day: string): MinigameId {
  // префикс отделяет зерно игры дня от зерна квестов того же дня
  const rand = mulberry32(daySeed(`game:${day}`))
  return MINIGAME_IDS[Math.floor(rand() * MINIGAME_IDS.length)]!
}
