import type { MinigameId } from './types'

/** Все игры проекта: строки i18n и рекорды знают полный список. */
export const MINIGAME_IDS: MinigameId[] = ['memory', 'runner', 'flappy', 'snake', 'bubbles']

/**
 * Игры, уже реализованные в UI: кнопка «Играть» выбирает случайную из них.
 * Новая партия ядер добавляется сюда вместе с рендером в ui/minigames.
 */
export const AVAILABLE_MINIGAMES: MinigameId[] = ['memory']

/** Случайная мини-игра; rng передаётся снаружи — тесты детерминированы. */
export function pickMinigame(ids: MinigameId[], rng: () => number = Math.random): MinigameId {
  return ids[Math.floor(rng() * ids.length)]!
}
