/**
 * Общие типы мини-игр. Каждая игра — чистое ядро в src/game/minigames:
 * состояние → новое состояние, без DOM/React/хранилищ. UI-слой
 * (src/ui/minigames) рисует состояние и переводит ввод в вызовы ядра.
 */

/** Идентификаторы мини-игр: реестр, рекорды в сейве, строки i18n. */
export type MinigameId = 'memory' | 'runner' | 'flappy' | 'snake' | 'bubbles'

/** Итог сыгранной партии: счёт и флаг победы (порог победы — в config.minigames). */
export interface MinigameOutcome {
  score: number
  won: boolean
}
